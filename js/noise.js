/* ============================================================================
 * noise.js — the deterministic field maths every behaviour shares.
 *
 * Nothing here reads a clock or a random number generator. Given the same
 * place, time and seed it returns the same value on every frame, in every
 * export, on every machine — which is what makes a ten-second GIF and a
 * one-minute video the same footage at different lengths, and what lets a
 * pattern be trusted to close its loop.
 * ==========================================================================*/
var DG = window.DG || (window.DG = {});

(function (DG) {
  'use strict';

  DG.TAU = Math.PI * 2;

  var clamp01 = (DG.clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; });

  DG.smoothstep = function (e0, e1, x) {
    var t = clamp01((x - e0) / (e1 - e0));
    return t * t * (3 - 2 * t);
  };

  /*
   * A triangle rather than a sine. A sine spends most of its range near its
   * extremes, so dot sizes cluster at full and gone with little in between; a
   * triangle spreads them evenly and the field grades properly.
   */
  DG.tri = function (turns) {
    var t = turns - Math.floor(turns);
    return t < 0.5 ? t * 2 : 2 - t * 2;
  };

  /*
   * An integer mixer, not a product of sines. The obvious hash — xor a couple
   * of multiplied coordinates — leaves neighbouring cells correlated, and dots
   * that should be independent drop out in clumps.
   */
  var hash3 = (DG.hash3 = function (i, j, k) {
    var h = Math.imul(i, 0x27d4eb2d) + Math.imul(j, 0x165667b1) + Math.imul(k, 0x9e3779b1);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  });

  var noise2 = (DG.noise2 = function (x, y, seed) {
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
  });

  /*
   * Noise that loops. One layer drifts away across the cycle while a second
   * drifts in to meet it, cross-faded STRAIGHT ACROSS. Easing the fade is the
   * classic mistake: an eased curve returns to the layer it left rather than
   * the one it is heading for, and the loop jumps.
   */
  DG.loopNoise = function (x, y, t, seed) {
    var a = noise2(x + t * 1.7, y - t * 1.1, seed);
    var b = noise2(x - (1 - t) * 1.7, y + (1 - t) * 1.1, seed);
    return a * (1 - t) + b * t;
  };

  /*
   * Distance from a point to a quadratic Bezier, by sampling. Exact solutions
   * exist; none of them is worth the code here, where the curve is short and
   * the answer only sets a dot's radius.
   */
  DG.pointOnQuad = function (ax, ay, cx, cy, bx, by, s, out) {
    var m = 1 - s;
    out[0] = m * m * ax + 2 * m * s * cx + s * s * bx;
    out[1] = m * m * ay + 2 * m * s * cy + s * s * by;
    return out;
  };
})(DG);
