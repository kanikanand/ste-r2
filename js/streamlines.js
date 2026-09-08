/* ============================================================================
 * streamlines.js — evenly spaced field lines.
 *
 * Traces curves that follow the field and keeps them a set distance apart
 * (Jobard & Lefebvre): integrate a curve until it leaves the frame, closes on
 * itself, or comes within dTest of a curve already drawn; then seed the next
 * curve one separation away from the one just accepted. The result covers the
 * frame evenly with lines that loop around the form's peaks and split at its
 * saddles, which is what dots are then strung along.
 * ==========================================================================*/
var DG = window.DG || (window.DG = {});

(function (DG) {
  'use strict';

  DG.traceStreamlines = function (opts) {
    var w = opts.width;
    var h = opts.height;
    var dirAt = opts.dirAt;
    var dSep = Math.max(1.2, opts.dSep);
    var dTest = dSep * (opts.testRatio || 0.6);
    var step = opts.step || dSep * 0.42;
    var maxSteps = opts.maxSteps || 4000;
    var margin = opts.margin || dSep * 1.5;
    var maxSamples = opts.maxSamples || 300000;
    var minPoints = opts.minPoints || 4;

    // Spatial hash of accepted samples, one cell per separation distance.
    var cell = dSep;
    var cols = Math.ceil((w + 2 * margin) / cell) + 1;
    var rows = Math.ceil((h + 2 * margin) / cell) + 1;
    var buckets = new Array(cols * rows);
    var sampleCount = 0;

    function addSample(x, y) {
      var cx = Math.floor((x + margin) / cell);
      var cy = Math.floor((y + margin) / cell);
      if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) return;
      var i = cy * cols + cx;
      var b = buckets[i] || (buckets[i] = []);
      b.push(x, y);
      sampleCount++;
    }

    function tooClose(x, y, d2) {
      var cx = Math.floor((x + margin) / cell);
      var cy = Math.floor((y + margin) / cell);
      for (var j = cy - 1; j <= cy + 1; j++) {
        if (j < 0 || j >= rows) continue;
        for (var i = cx - 1; i <= cx + 1; i++) {
          if (i < 0 || i >= cols) continue;
          var b = buckets[j * cols + i];
          if (!b) continue;
          for (var k = 0; k < b.length; k += 2) {
            var dx = b[k] - x;
            var dy = b[k + 1] - y;
            if (dx * dx + dy * dy < d2) return true;
          }
        }
      }
      return false;
    }

    var inBounds = function (x, y) {
      return x >= -margin && x <= w + margin && y >= -margin && y <= h + margin;
    };

    /* One half of a curve, integrated with midpoint steps. */
    function integrate(sx, sy, sign, out) {
      var x = sx;
      var y = sy;
      var px = 0;
      var py = 0;
      var d2 = dTest * dTest;
      for (var s = 0; s < maxSteps; s++) {
        var a = dirAt(x, y);
        var vx = Math.cos(a);
        var vy = Math.sin(a);
        if (s === 0) {
          vx *= sign;
          vy *= sign;
        } else if (vx * px + vy * py < 0) {
          vx = -vx;                       // keep heading the same way
          vy = -vy;
        }
        var a2 = dirAt(x + vx * step * 0.5, y + vy * step * 0.5);
        var wx = Math.cos(a2);
        var wy = Math.sin(a2);
        if (wx * vx + wy * vy < 0) {
          wx = -wx;
          wy = -wy;
        }
        x += wx * step;
        y += wy * step;
        px = wx;
        py = wy;

        if (!inBounds(x, y)) break;
        if (tooClose(x, y, d2)) break;
        // A closed contour comes back to where it started.
        if (s > 12 && Math.hypot(x - sx, y - sy) < step) break;
        out.push(x, y);
      }
    }

    var lines = [];
    var queue = [[w / 2, h / 2]];
    var qi = 0;

    while (qi < queue.length && sampleCount < maxSamples) {
      var seed = queue[qi++];
      if (tooClose(seed[0], seed[1], dSep * dSep)) continue;

      var back = [];
      integrate(seed[0], seed[1], -1, back);
      var fwd = [seed[0], seed[1]];
      integrate(seed[0], seed[1], 1, fwd);

      // back was walked outward from the seed, so it reverses onto the front.
      var pts = [];
      for (var i = back.length - 2; i >= 0; i -= 2) pts.push(back[i], back[i + 1]);
      for (var j = 0; j < fwd.length; j++) pts.push(fwd[j]);
      if (pts.length < minPoints * 2) continue;

      for (var k = 0; k < pts.length; k += 2) addSample(pts[k], pts[k + 1]);
      lines.push(pts);

      // Offer seeds a separation away on both sides of the curve just accepted.
      var stride = Math.max(2, Math.round(dSep / step)) * 2;
      for (var m = 0; m + 3 < pts.length; m += stride) {
        var tx = pts[m + 2] - pts[m];
        var ty = pts[m + 3] - pts[m + 1];
        var len = Math.hypot(tx, ty);
        if (!len) continue;
        var nx = -ty / len;
        var ny = tx / len;
        queue.push([pts[m] + nx * dSep, pts[m + 1] + ny * dSep]);
        queue.push([pts[m] - nx * dSep, pts[m + 1] - ny * dSep]);
      }
    }

    return lines;
  };
})(DG);
