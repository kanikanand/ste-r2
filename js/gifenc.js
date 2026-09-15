/* ============================================================================
 * gifenc.js — a small GIF89a encoder.
 *
 * Written out rather than pulled in so the page keeps working offline and from
 * the filesystem, with no worker and nothing to download.
 *
 * A GIF carries at most 256 colours, so the frames are quantised: a palette is
 * chosen by median cut over a sample of the footage, and a coarse lookup cube
 * is filled in once so that mapping each pixel afterwards is a single read
 * rather than a search through the palette.
 * ==========================================================================*/
var DG = window.DG || (window.DG = {});

(function (DG) {
  'use strict';

  /* ---- palette ---------------------------------------------------------- */

  function medianCut(samples, want) {
    var boxes = [{ lo: 0, hi: samples.length / 3 }];
    var order = new Uint32Array(samples.length / 3);
    for (var i = 0; i < order.length; i++) order[i] = i;

    function rangeOf(box) {
      var mn = [255, 255, 255];
      var mx = [0, 0, 0];
      for (var k = box.lo; k < box.hi; k++) {
        var o = order[k] * 3;
        for (var c = 0; c < 3; c++) {
          var v = samples[o + c];
          if (v < mn[c]) mn[c] = v;
          if (v > mx[c]) mx[c] = v;
        }
      }
      var best = 0;
      for (var c2 = 1; c2 < 3; c2++) if (mx[c2] - mn[c2] > mx[best] - mn[best]) best = c2;
      return { channel: best, spread: mx[best] - mn[best] };
    }

    while (boxes.length < want) {
      var pick = -1;
      var widest = 0;
      for (var b = 0; b < boxes.length; b++) {
        if (boxes[b].hi - boxes[b].lo < 2) continue;
        var r = rangeOf(boxes[b]);
        if (r.spread > widest) { widest = r.spread; pick = b; boxes[b]._ch = r.channel; }
      }
      if (pick < 0) break;

      var box = boxes[pick];
      var ch = box._ch;
      var slice = Array.prototype.slice.call(order.subarray(box.lo, box.hi));
      slice.sort(function (p, q) { return samples[p * 3 + ch] - samples[q * 3 + ch]; });
      order.set(slice, box.lo);
      var mid = (box.lo + box.hi) >> 1;
      boxes.splice(pick, 1, { lo: box.lo, hi: mid }, { lo: mid, hi: box.hi });
    }

    var palette = [];
    for (var n = 0; n < boxes.length; n++) {
      var acc = [0, 0, 0];
      var count = boxes[n].hi - boxes[n].lo;
      if (!count) continue;
      for (var m = boxes[n].lo; m < boxes[n].hi; m++) {
        var off = order[m] * 3;
        acc[0] += samples[off];
        acc[1] += samples[off + 1];
        acc[2] += samples[off + 2];
      }
      palette.push([Math.round(acc[0] / count), Math.round(acc[1] / count), Math.round(acc[2] / count)]);
    }
    while (palette.length < 2) palette.push([0, 0, 0]);
    return palette;
  }

  /* A 32-per-channel cube of nearest palette entries, filled in once. */
  function buildLookup(palette) {
    var lut = new Uint8Array(32 * 32 * 32);
    for (var r = 0; r < 32; r++) {
      for (var g = 0; g < 32; g++) {
        for (var b = 0; b < 32; b++) {
          var rr = r * 8 + 4;
          var gg = g * 8 + 4;
          var bb = b * 8 + 4;
          var best = 0;
          var bestD = Infinity;
          for (var i = 0; i < palette.length; i++) {
            var dr = palette[i][0] - rr;
            var dg = palette[i][1] - gg;
            var db = palette[i][2] - bb;
            var d = dr * dr + dg * dg + db * db;
            if (d < bestD) { bestD = d; best = i; }
          }
          lut[(r << 10) | (g << 5) | b] = best;
        }
      }
    }
    return lut;
  }

  /* ---- output ----------------------------------------------------------- */

  /*
   * Bytes go into a Uint8Array that doubles when it fills, not a plain array.
   * A number array costs eight bytes an entry in practice, so a 100MB GIF was
   * costing the better part of a gigabyte to hold while it was being built —
   * which is the sort of thing that only shows up once the sizes get large.
   */
  function Sink() {
    this.buf = new Uint8Array(1 << 16);
    this.len = 0;
  }
  Sink.prototype.room = function (n) {
    if (this.len + n <= this.buf.length) return;
    var size = this.buf.length;
    while (size < this.len + n) size *= 2;
    var next = new Uint8Array(size);
    next.set(this.buf.subarray(0, this.len));
    this.buf = next;
  };
  Sink.prototype.push = function (v) {
    this.room(1);
    this.buf[this.len++] = v & 255;
  };
  Sink.prototype.bytes = function () { return this.buf.slice(0, this.len); };

  /* ---- LZW -------------------------------------------------------------- */

  function lzw(indices, minCodeSize, out) {
    var clear = 1 << minCodeSize;
    var eoi = clear + 1;
    var codeSize = minCodeSize + 1;
    var next = eoi + 1;
    var dict = new Map();
    var cur = -1;
    var bits = 0;
    var nbits = 0;
    var chunk = [];

    function flushChunk(force) {
      while (chunk.length >= 255) {
        out.push(255);
        for (var i = 0; i < 255; i++) out.push(chunk[i]);
        chunk = chunk.slice(255);
      }
      if (force && chunk.length) {
        out.push(chunk.length);
        for (var j = 0; j < chunk.length; j++) out.push(chunk[j]);
        chunk = [];
      }
    }

    function emit(code) {
      bits |= code << nbits;
      nbits += codeSize;
      while (nbits >= 8) {
        chunk.push(bits & 255);
        bits >>= 8;
        nbits -= 8;
      }
      flushChunk(false);
    }

    emit(clear);
    for (var i = 0; i < indices.length; i++) {
      var k = indices[i];
      if (cur < 0) { cur = k; continue; }
      var key = cur * 4096 + k;
      var found = dict.get(key);
      if (found !== undefined) {
        cur = found;
      } else {
        emit(cur);
        dict.set(key, next);
        next++;
        if (next > (1 << codeSize)) {
          if (codeSize < 12) {
            codeSize++;
          } else {
            emit(clear);
            dict.clear();
            codeSize = minCodeSize + 1;
            next = eoi + 1;
          }
        }
        cur = k;
      }
    }
    if (cur >= 0) emit(cur);
    emit(eoi);
    if (nbits > 0) chunk.push(bits & 255);
    flushChunk(true);
    out.push(0);                       // block terminator
  }

  /* ---- the encoder ------------------------------------------------------ */

  /*
   * Chosen from a sample of the run, then handed to a writer that encodes each
   * frame as it arrives and lets it go. Holding every frame until the end is
   * what used to put a ceiling on the size a long GIF could be asked for: the
   * cost was frames x pixels x 4 bytes, and a minute at 1080 would have run the
   * tab out of memory before any of it reached the encoder.
   */
  DG.gifPalette = function (sampleFrames, transparent) {
    var CLEAR = 255;
    var want = transparent ? 255 : 256;
    var step = 4;
    var i, f, px;

    var cut = 128;
    if (transparent) {
      var peak = 0;
      for (f = 0; f < sampleFrames.length; f++) {
        px = sampleFrames[f];
        for (i = 3; i < px.length; i += step) if (px[i] > peak) peak = px[i];
      }
      cut = Math.max(8, Math.min(128, Math.round(peak / 2)));
    }

    var samples = [];
    for (f = 0; f < sampleFrames.length; f++) {
      px = sampleFrames[f];
      var stride = Math.max(1, Math.floor(px.length / 4 / 4000)) * 4;
      for (i = 0; i < px.length; i += stride) {
        if (transparent && px[i + 3] < cut) continue;
        samples.push(px[i], px[i + 1], px[i + 2]);
      }
    }
    if (!samples.length) samples.push(0, 0, 0);
    var palette = medianCut(new Uint8Array(samples), want);
    return { palette: palette, lut: buildLookup(palette), cut: cut,
      transparent: !!transparent, clearIndex: CLEAR };
  };

  DG.GifWriter = function (width, height, delayMs, pal) {
    var out = new Sink();
    var indices = new Uint8Array(width * height);
    var delay = Math.max(2, Math.round(delayMs / 10));   // GIF counts hundredths

    function byte(v) { out.push(v); }
    function short(v) { out.push(v & 255); out.push((v >> 8) & 255); }
    function str(t) { for (var i = 0; i < t.length; i++) out.push(t.charCodeAt(i)); }

    str('GIF89a');
    short(width);
    short(height);
    byte(0xf7);                        // global table, 256 entries
    byte(0);
    byte(0);
    for (var c = 0; c < 256; c++) {
      var e = pal.palette[c] || [0, 0, 0];
      byte(e[0]); byte(e[1]); byte(e[2]);
    }

    str('!');                          // NETSCAPE loop for ever
    byte(0xff); byte(11);
    str('NETSCAPE2.0');
    byte(3); byte(1); short(0); byte(0);

    this.addFrame = function (data) {
      for (var p = 0, q = 0; p < indices.length; p++, q += 4) {
        if (pal.transparent && data[q + 3] < pal.cut) { indices[p] = pal.clearIndex; continue; }
        indices[p] = pal.lut[((data[q] >> 3) << 10) | ((data[q + 1] >> 3) << 5) | (data[q + 2] >> 3)];
      }
      // Disposal 2 — restore to background — clears the frame before the next
      // one is drawn. Without it each frame is painted over the last, and every
      // hole in the animation shows the frames behind it rather than the page.
      str('!'); byte(0xf9); byte(4); byte(pal.transparent ? 0x09 : 0);
      short(delay);
      byte(pal.transparent ? pal.clearIndex : 0); byte(0);
      str(',');
      short(0); short(0); short(width); short(height); byte(0);
      byte(8);
      lzw(indices, 8, out);
    };

    this.finish = function () {
      byte(0x3b);
      return out.bytes();
    };
  };

  /*
   * The all-at-once form, kept for callers that already hold every frame.
   * frames: array of Uint8ClampedArray RGBA buffers, all width x height.
   * delayMs: how long each frame is held.
   * transparent: keep clear pixels clear instead of filling them.
   *
   * A GIF has no alpha channel — it has one palette entry nominated as
   * "see through". So transparency here is all or nothing per pixel: a dot's
   * soft edge cannot fade into the page behind it, and the last index is spent
   * on the hole rather than on a colour.
   */
  DG.encodeGIF = function (frames, width, height, delayMs, transparent) {
    var stride = Math.max(1, Math.floor(frames.length / 12));
    var sample = [];
    for (var f = 0; f < frames.length; f += stride) sample.push(frames[f]);
    var writer = new DG.GifWriter(width, height, delayMs, DG.gifPalette(sample, transparent));
    for (var i = 0; i < frames.length; i++) writer.addFrame(frames[i]);
    return writer.finish();
  };
})(DG);
