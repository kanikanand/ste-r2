/* ============================================================================
 * record.js — stills and footage.
 *
 * The patterns loop with a period of one cycle, so an export is recorded over a
 * whole number of cycles and the file loops without a jump at the join. The
 * requested length is kept exactly: the number of cycles is chosen to suit it
 * and the clock is stretched to fit.
 * ==========================================================================*/
var DG = window.DG || (window.DG = {});

(function (DG) {
  'use strict';

  function download(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }
  DG.download = download;

  /* ---- stills, at the moment the button is pressed ---------------------- */

  /*
   * Both stills follow whatever background the style carries, so the No bg
   * switch decides for them. PNG used to drop it unconditionally, which meant
   * there was no way to get a PNG of what you were actually looking at.
   */
  DG.exportSVG = function (params, style, t, height, filename) {
    var width = Math.round(height * DG.frameRatio(params.frame));
    var svg = DG.dotsToSVG(DG.generateDots(params, width, height, t), {
      width: width,
      height: height,
      background: style.background,
      solid: style.solid,
      useGradient: style.useGradient,
      alpha: style.alpha,
      bgGradient: style.bgGradient
    });
    download(new Blob([svg], { type: 'image/svg+xml' }), filename);
  };

  DG.exportPNG = function (params, style, t, height, filename) {
    var width = Math.round(height * DG.frameRatio(params.frame));
    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    DG.renderDots(canvas.getContext('2d'), DG.generateDots(params, width, height, t), {
      width: width,
      height: height,
      background: style.background,
      solid: style.solid,
      useGradient: style.useGradient,
      alpha: style.alpha,
      bgGradient: style.bgGradient
    });
    canvas.toBlob(function (blob) { if (blob) download(blob, filename); });
  };

  /* ---- footage ---------------------------------------------------------- */

  /* Whole cycles, and the clock stretched so the length comes out as asked. */
  function cyclesFor(seconds, speed) {
    return Math.max(1, Math.round(seconds * (speed || 1)));
  }

  /*
   * GIF is drawn frame by frame rather than recorded, so it does not depend on
   * the machine keeping up — every frame lands exactly where it should.
   */
  DG.exportGIF = function (params, style, seconds, opts, onProgress) {
    var fps = opts.fps || 12.5;
    var height = opts.height || 540;
    var width = Math.round(height * DG.frameRatio(params.frame));
    var total = Math.max(2, Math.round(seconds * fps));
    var cycles = cyclesFor(seconds, params.speed);

    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });

    function paint(i) {
      DG.renderDots(ctx, DG.generateDots(params, width, height, (i / total) * cycles), {
        width: width,
        height: height,
        background: style.background,
        solid: style.solid,
        useGradient: style.useGradient,
        alpha: style.alpha,
        bgGradient: style.bgGradient
      });
      return ctx.getImageData(0, 0, width, height).data;
    }

    /*
     * Two passes, and neither of them keeps the footage. The first renders a
     * dozen frames spread across the run to choose a palette that suits all of
     * it; the second renders every frame, hands it straight to the writer and
     * lets it go.
     *
     * Holding every frame until the end — which is what this used to do — costs
     * frames x pixels x 4 bytes, so a minute at 1080 would have needed six
     * gigabytes and the size had to be capped to keep the tab alive. Encoding
     * as it goes, the peak is one frame and the compressed output.
     */
    return new Promise(function (resolve, reject) {
      var sample = [];
      var sampleStep = Math.max(1, Math.floor(total / 12));
      for (var k = 0; k < total; k += sampleStep) sample.push(paint(k));

      var writer;
      try {
        writer = new DG.GifWriter(width, height, 1000 / fps, DG.gifPalette(sample, !style.background && !style.bgGradient));
      } catch (e) { return reject(e); }
      sample.length = 0;

      var i = 0;
      function step() {
        try {
          var until = Date.now() + 40;                 // stay responsive
          while (i < total && Date.now() < until) {
            writer.addFrame(paint(i));
            i++;
          }
        } catch (e) { return reject(e); }
        if (onProgress) onProgress(i / total);
        if (i < total) return setTimeout(step, 0);
        setTimeout(function () {
          try {
            resolve(new Blob([writer.finish()], { type: 'image/gif' }));
          } catch (e) { reject(e); }
        }, 0);
      }
      step();
    });
  };

  /* What the browser will actually record. */
  DG.videoType = function () {
    if (typeof MediaRecorder === 'undefined') return null;
    var wanted = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
    for (var i = 0; i < wanted.length; i++) {
      if (MediaRecorder.isTypeSupported(wanted[i])) {
        return { mime: wanted[i], ext: wanted[i].indexOf('mp4') >= 0 ? 'mp4' : 'webm' };
      }
    }
    return null;
  };

  /*
   * Video is recorded off a live canvas, so it runs for as long as the clip
   * lasts. A recorder stamps its frames by the wall clock, so feeding them
   * faster would only produce a clip that played too fast.
   */
  DG.exportVideo = function (params, style, seconds, opts, onProgress) {
    var type = DG.videoType();
    if (!type) return Promise.reject(new Error('This browser cannot record video.'));

    var height = opts.height || 1080;
    var width = Math.round(height * DG.frameRatio(params.frame));
    var fps = opts.fps || 30;
    var cycles = cyclesFor(seconds, params.speed);

    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext('2d');
    var stream = canvas.captureStream(fps);
    var chunks = [];
    // Scaled to the frame rather than fixed. A flat 8 Mbit was generous for the
    // 720-high recording this used to make and thin for a 1080-high one, which
    // is exactly the size the L option now asks for.
    var bitrate = opts.bitrate ||
      Math.max(4e6, Math.min(24e6, Math.round(width * height * fps * 0.2)));
    var rec = new MediaRecorder(stream, { mimeType: type.mime, videoBitsPerSecond: bitrate });
    rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };

    return new Promise(function (resolve, reject) {
      rec.onerror = function (e) { reject(e.error || new Error('Recording failed.')); };
      rec.onstop = function () { resolve({ blob: new Blob(chunks, { type: type.mime }), ext: type.ext }); };

      var start = performance.now();
      function frame(now) {
        var elapsed = (now - start) / 1000;
        if (elapsed >= seconds) {
          rec.stop();
          return;
        }
        var t = (elapsed / seconds) * cycles;
        DG.renderDots(ctx, DG.generateDots(params, width, height, t), {
          width: width,
          height: height,
          background: style.background || '#000000',
          solid: style.solid,
          useGradient: style.useGradient,
          alpha: style.alpha,
          bgGradient: style.bgGradient
        });
        if (onProgress) onProgress(elapsed / seconds);
        requestAnimationFrame(frame);
      }
      rec.start();
      requestAnimationFrame(frame);
    });
  };
})(DG);
