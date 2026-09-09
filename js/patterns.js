/* ============================================================================
 * patterns.js — the six patterns, as fields that move.
 *
 * Each one is a function of place and time returning 0..1, and each is periodic
 * in time with a period of exactly 1. Recording a whole number of periods
 * therefore loops seamlessly, which is what lets a ten second and a sixty
 * second export both come back without a jump at the join.
 *
 * x and y run -1..1 over the frame's height, so a wide frame simply shows more
 * of the pattern rather than stretching it.
 * ==========================================================================*/
var DG = window.DG || (window.DG = {});

(function (DG) {
  'use strict';

  var TAU = Math.PI * 2;

  var clamp01 = (DG.clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; });

  /* A travelling wave: phase in turns -> 0..1, as a triangle so the sizes grade
     evenly rather than snapping between full and gone at the extremes. */
  function wave(turns) {
    var t = turns - Math.floor(turns);
    return t < 0.5 ? t * 2 : 2 - t * 2;
  }

  /* Smooth value noise that drifts, for the scattered patterns. */
  function hash3(i, j, k) {
    var h = Math.imul(i, 0x27d4eb2d) + Math.imul(j, 0x165667b1) + Math.imul(k, 0x9e3779b1);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }

  function noise2(x, y, seed) {
    var x0 = Math.floor(x);
    var y0 = Math.floor(y);
    var fx = x - x0;
    var fy = y - y0;
    var sx = fx * fx * (3 - 2 * fx);
    var sy = fy * fy * (3 - 2 * fy);
    var a = hash3(x0, y0, seed);
    var b = hash3(x0 + 1, y0, seed);
    var c = hash3(x0, y0 + 1, seed);
    var d = hash3(x0 + 1, y0 + 1, seed);
    var top = a + (b - a) * sx;
    return top + (c + (d - c) * sx - top) * sy;
  }

  /*
   * Noise that loops in time. One layer drifts away over the cycle while a
   * second drifts in to meet it, cross-faded straight across so that the layer
   * the cycle ends on is exactly the layer it began on. Easing that fade would
   * return it to the wrong layer and leave a jump at the join.
   */
  function loopNoise(x, y, t, seed) {
    var a = noise2(x + t * 1.7, y - t * 1.1, seed);
    var b = noise2(x - (1 - t) * 1.7, y + (1 - t) * 1.1, seed);
    return a * (1 - t) + b * t;
  }

  DG.PATTERNS = [
    {
      id: 'expansion',
      name: 'Expansion',
      blurb: 'Rings travel outward, the dots swelling as each one passes.',
      at: function (x, y, t, p) {
        var r = Math.hypot(x, y);
        return wave(r * p.scale * 1.1 - t);
      }
    },
    {
      id: 'convergence',
      name: 'Convergence',
      blurb: 'The same rings drawn inward, gathering on the centre.',
      at: function (x, y, t, p) {
        var r = Math.hypot(x, y);
        return wave(r * p.scale * 1.1 + t) * (0.45 + 0.55 / (1 + 0.5 * r * r));
      }
    },
    {
      id: 'diffusion',
      name: 'Diffusion',
      blurb: 'Loose clusters break up and reform as they drift.',
      at: function (x, y, t, p) {
        var n = loopNoise(x * p.scale * 0.9, y * p.scale * 0.9, t, 11);
        return clamp01((n - 0.28) * 2.1);
      }
    },
    {
      id: 'intelligence',
      name: 'Intelligence',
      blurb: 'Rows break into runs that slide past each other.',
      at: function (x, y, t, p) {
        var row = Math.floor((y * p.scale + 4) * 1.6);
        var dir = hash3(row, 9, 5) < 0.5 ? -1 : 1;
        var freq = 0.6 + 0.9 * hash3(row, 7, 3);
        var v = wave(x * p.scale * freq - dir * t);
        // The run each point falls in slides along the row. Wrapping the run
        // index on its own period is what lets it return to where it started:
        // an ordinary shift would land on different runs at the end of a cycle.
        var period = 6;
        var seg = Math.floor(x * p.scale * 1.3 + dir * period * t);
        var g = ((seg % period) + period) % period;
        return clamp01(v * (hash3(g, row, 17) > 0.4 ? 1 : 0.12));
      }
    },
    {
      id: 'adaptation',
      name: 'Adaptation',
      blurb: 'A diagonal grade sweeps across, one corner filling as the other empties.',
      at: function (x, y, t, p) {
        return wave((x + y) * p.scale * 0.42 - t);
      }
    },
    {
      id: 'synchronise',
      name: 'Synchronise',
      blurb: 'An S-shaped band travels through, the rows falling into step behind it.',
      at: function (x, y, t, p) {
        // The band's centre line is an S across the height, and the whole thing
        // travels sideways.
        var s = 0.55 * Math.sin(Math.PI * y * 0.85);
        var phase = (x - s) * p.scale * 0.5 - t;
        // The modulation runs at twice the rate, not half: at half it would
        // take two cycles to come back and the loop would jump.
        return clamp01(wave(phase) * (0.5 + 0.5 * wave(phase * 2)) * 1.8);
      }
    }
  ];

  DG.PATTERNS_BY_ID = {};
  DG.PATTERNS.forEach(function (p) { DG.PATTERNS_BY_ID[p.id] = p; });
  DG.getPattern = function (id) { return DG.PATTERNS_BY_ID[id] || DG.PATTERNS[0]; };
})(DG);
