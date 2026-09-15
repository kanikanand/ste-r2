/* ============================================================================
 * geo.js — turning country outlines into something a dot can ask a question of.
 *
 * Every dot on the globe needs one answer, a few thousand times a frame: which
 * country am I standing on, if any. Testing a point against 286 polygons that
 * often is hopeless, so the outlines are rasterised once into an
 * equirectangular mask of country indices and every later lookup is a single
 * array read.
 *
 * The mask is built on a canvas rather than by scanning polygons in JavaScript
 * — the browser already has a filled-polygon routine, and it is the fastest
 * code here by a wide margin.
 * ==========================================================================*/
var DG = window.DG || (window.DG = {});

(function (DG) {
  'use strict';

  /*
   * 0.18 degrees a cell, about twenty kilometres at the equator. The coarser
   * grid this started on could not hold the small states at all — Singapore,
   * Malta, Monaco are each a cell or two wide — and a country that owns no cell
   * can never be found, let alone highlighted.
   */
  var MW = 2048;
  var MH = 1024;
  var mask = null;                     // Uint8Array of country index + 1, 0 = sea
  var anchors = null;                  // where a country's label should sit

  /*
   * Longitudes made continuous. Four rings in this data — Russia twice, Fiji,
   * Antarctica — cross the antimeridian, and in the file that shows up as a
   * jump from +179 to -179. Drawn as given, the ring doubles back across the
   * whole map and fills a band through the middle of the world. Adding or
   * subtracting a turn whenever consecutive points jump more than half of one
   * makes the ring continuous again; it then sits outside the map's range,
   * which is what the three passes below are for.
   */
  function unwrap(ring) {
    var out = new Float64Array(ring.length);
    var prev = ring[0];
    out[0] = prev;
    out[1] = ring[1];
    for (var i = 2; i < ring.length; i += 2) {
      var lon = ring[i];
      while (lon - prev > 180) lon -= 360;
      while (lon - prev < -180) lon += 360;
      out[i] = lon;
      out[i + 1] = ring[i + 1];
      prev = lon;
    }
    return out;
  }

  function build() {
    var world = window.DG_WORLD;
    if (!world) throw new Error('world-50m.js has not loaded.');

    var cv = document.createElement('canvas');
    cv.width = MW;
    cv.height = MH;
    var ctx = cv.getContext('2d', { willReadFrequently: true });
    mask = new Uint8Array(MW * MH);

    /*
     * One country at a time, as a stencil, rather than all of them into one
     * image with the index as the colour.
     *
     * The colour approach is the obvious one and it is quietly wrong: a filled
     * path is antialiased, so every pixel along a coast comes back as a blend
     * of the country's index and whatever was under it. The blend is a
     * perfectly ordinary number, so there is no way to tell it from a real
     * index — it simply names the wrong country. It read Sydney as El Salvador
     * and New York as Tanzania, while inland cities were right, which is the
     * shape of the bug: only coasts were affected, and almost everywhere
     * anybody looks on a world map is a coast.
     *
     * Drawn white on black and thresholded at half, a blended edge pixel falls
     * to one side or the other and the index it carries is always a real one.
     * Each country is cleared and read back over its own bounding box only, so
     * the cost is the sum of the countries' areas rather than 177 full frames.
     */
    for (var c = 0; c < world.polys.length; c++) {
      var rings = world.polys[c];
      var minX = MW, maxX = 0, minY = MH, maxY = 0;
      var paths = [];

      for (var r = 0; r < rings.length; r++) {
        var ring = unwrap(rings[r]);
        for (var pass = -1; pass <= 1; pass++) {
          var shift = pass * 360;
          var path = new Float64Array(ring.length);
          var inView = false;
          for (var i = 0; i < ring.length; i += 2) {
            var x = ((ring[i] + shift) + 180) / 360 * MW;
            var y = (90 - ring[i + 1]) / 180 * MH;
            path[i] = x;
            path[i + 1] = y;
            if (x > -2 && x < MW + 2) inView = true;
          }
          if (!inView) continue;                  // a copy that lands off the map
          paths.push(path);
          for (i = 0; i < path.length; i += 2) {
            if (path[i] < minX) minX = path[i];
            if (path[i] > maxX) maxX = path[i];
            if (path[i + 1] < minY) minY = path[i + 1];
            if (path[i + 1] > maxY) maxY = path[i + 1];
          }
        }
      }
      if (!paths.length) continue;

      var x0 = Math.max(0, Math.floor(minX) - 1);
      var x1 = Math.min(MW, Math.ceil(maxX) + 1);
      var y0 = Math.max(0, Math.floor(minY) - 1);
      var y1 = Math.min(MH, Math.ceil(maxY) + 1);
      if (x1 <= x0 || y1 <= y0) continue;

      ctx.clearRect(x0, y0, x1 - x0, y1 - y0);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      for (var q = 0; q < paths.length; q++) {
        var pp = paths[q];
        for (i = 0; i < pp.length; i += 2) {
          if (i === 0) ctx.moveTo(pp[0], pp[1]); else ctx.lineTo(pp[i], pp[i + 1]);
        }
        ctx.closePath();
      }
      // Even-odd, so a country's holes stay holes whichever way its rings are
      // wound — which is not something this data promises.
      ctx.fill('evenodd');

      var px = ctx.getImageData(x0, y0, x1 - x0, y1 - y0).data;
      var w = x1 - x0;
      for (var yy = y0; yy < y1; yy++) {
        for (var xx = x0; xx < x1; xx++) {
          if (px[((yy - y0) * w + (xx - x0)) * 4 + 3] >= 128) mask[yy * MW + xx] = c + 1;
        }
      }
    }

    /*
     * Anything smaller than a cell leaves no trace. Forty-seven of these —
     * Vatican, Monaco, most of the Pacific island states — are a fraction of a
     * cell across, so the stencil threshold rejects them outright and they end
     * up owning nothing at all. A country with no cell cannot be found by a
     * dot, cannot be given a label anchor, and so cannot be highlighted: it is
     * in the picker and does nothing when picked.
     *
     * So each of them is granted the single cell its outline sits in. The cell
     * may already belong to a larger country, and it is taken anyway — the
     * Vatican really is inside Rome, and on a globe at this scale one cell is
     * the smallest truth available.
     */
    var owned = new Uint8Array(world.polys.length);
    var granted = new Uint8Array(mask.length);
    for (var m = 0; m < mask.length; m++) if (mask[m]) owned[mask[m] - 1] = 1;
    for (c = 0; c < world.polys.length; c++) {
      if (owned[c]) continue;
      var sumX = 0, sumY = 0, n = 0;
      var cr = world.polys[c];
      for (r = 0; r < cr.length; r++) {
        for (i = 0; i < cr[r].length; i += 2) { sumX += cr[r][i]; sumY += cr[r][i + 1]; n++; }
      }
      if (!n) continue;
      var mx = Math.floor(((sumX / n) + 180) / 360 * MW);
      var my = Math.floor((90 - (sumY / n)) / 180 * MH);
      if (mx < 0) mx = 0; else if (mx >= MW) mx = MW - 1;
      if (my < 0) my = 0; else if (my >= MH) my = MH - 1;

      /*
       * Step aside if another of these has already taken the cell. Saint Martin
       * and Sint Maarten are two halves of one island a few kilometres across,
       * so they round to the same cell and the second would simply erase the
       * first. Taking a neighbouring cell keeps both on the map; overwriting a
       * large country's cell is fine, overwriting another small one's only
       * class hands the same problem back.
       */
      var slot = my * MW + mx;
      if (granted[slot]) {
        for (var ring = 1; ring <= 3 && granted[slot]; ring++) {
          for (var dy = -ring; dy <= ring && granted[slot]; dy++) {
            for (var dx = -ring; dx <= ring; dx++) {
              var ny = my + dy, nx2 = mx + dx;
              if (ny < 0 || ny >= MH) continue;
              if (nx2 < 0) nx2 += MW; else if (nx2 >= MW) nx2 -= MW;
              var cand = ny * MW + nx2;
              if (!granted[cand]) { slot = cand; break; }
            }
          }
        }
      }
      mask[slot] = c + 1;
      granted[slot] = 1;
    }

    /*
     * The data stops at 85.6 degrees south — the projection it was quantised
     * in cannot reach the pole — so Antarctica arrives with its bottom edge
     * cut off and a band of sea below it. Carrying the last row of land down
     * to the pole closes it.
     */
    var lastRow = Math.floor((90 - -85.0) / 180 * MH);
    for (var y = lastRow; y < MH; y++) {
      for (var x = 0; x < MW; x++) {
        if (!mask[y * MW + x]) mask[y * MW + x] = mask[(y - 1) * MW + x];
      }
    }

    findAnchors(world.names.length);
  }

  /*
   * Where to hang a label. The average of a country's cells is the obvious
   * answer and the wrong one — the mean of a crescent, or of a country with
   * distant islands, lands in the sea. So the mean is only a target, and the
   * anchor is the cell of that country nearest to it.
   */
  function findAnchors(count) {
    var sx = new Float64Array(count);
    var sy = new Float64Array(count);
    var n = new Float64Array(count);
    var x, y, i;

    for (y = 0; y < MH; y++) {
      for (x = 0; x < MW; x++) {
        i = mask[y * MW + x];
        if (!i) continue;
        sx[i - 1] += x; sy[i - 1] += y; n[i - 1]++;
      }
    }

    var best = new Float64Array(count);
    anchors = new Array(count);
    for (i = 0; i < count; i++) best[i] = Infinity;

    for (y = 0; y < MH; y++) {
      for (x = 0; x < MW; x++) {
        i = mask[y * MW + x];
        if (!i) continue;
        var k = i - 1;
        if (!n[k]) continue;
        var dx = x - sx[k] / n[k];
        var dy = y - sy[k] / n[k];
        var d = dx * dx + dy * dy;
        if (d < best[k]) {
          best[k] = d;
          anchors[k] = { lon: (x + 0.5) / MW * 360 - 180, lat: 90 - (y + 0.5) / MH * 180 };
        }
      }
    }
    for (i = 0; i < count; i++) if (!anchors[i]) anchors[i] = { lon: 0, lat: 0 };
  }

  DG.geoReady = function () {
    if (!mask) build();
    return !!mask;
  };

  /* Country index at a position, or -1 for sea. */
  DG.countryAt = function (lon, lat) {
    if (!mask) build();
    var x = Math.floor((lon + 180) / 360 * MW);
    var y = Math.floor((90 - lat) / 180 * MH);
    if (x < 0) x += MW; else if (x >= MW) x -= MW;
    if (y < 0) y = 0; else if (y >= MH) y = MH - 1;
    return mask[y * MW + x] - 1;
  };

  DG.countryAnchor = function (index) {
    if (!mask) build();
    return anchors[index] || { lon: 0, lat: 0 };
  };

  DG.countryNames = function () { return (window.DG_WORLD || { names: [] }).names; };

  /* Index by name, case and punctuation insensitive, for the picker. */
  DG.countryIndex = function (name) {
    var names = DG.countryNames();
    var want = String(name).toLowerCase().replace(/[^a-z]/g, '');
    if (!want) return -1;
    var partial = -1;
    for (var i = 0; i < names.length; i++) {
      var got = names[i].toLowerCase().replace(/[^a-z]/g, '');
      if (got === want) return i;
      if (partial < 0 && got.indexOf(want) === 0) partial = i;
    }
    return partial;
  };
})(DG);
