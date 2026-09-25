/* ============================================================================
 * field.js — Patterns mode: the dots for one moment.
 *
 * A plain lattice that never moves; the pattern beneath it does. The pattern's
 * value at each point becomes that dot's size — that is the only thing it may
 * become. Nothing displaces a dot from its cell, so every apparent gathering
 * or thinning of the field is dot area, and the grid stays legible under it.
 *
 * Lifted from the motion branch unchanged apart from its surroundings: the
 * frame sizes and the renderer that used to sit in this file are now shared
 * with the other two modes and live in render.js, and the last few lines hand
 * this generator to the suite by name rather than claiming DG.generateDots
 * for itself.
 * ==========================================================================*/
var DG = window.DG || (window.DG = {});

(function (DG) {
  'use strict';

  DG.DEFAULTS = {
    pattern: 'expansion',
    frame: '16:9',
    grid: 44,             // dots across the width
    dotScale: 0.8,        // largest dot, against the gap between dots
    sizeVariation: 0.85,  // difference between the smallest and largest dot
    dotAlpha: 1,          // how opaque the dots are drawn, over the background
    contrast: 1,          // gamma on the pattern before it becomes size
    scatter: 0,           // randomly thin the dots where the pattern is dark
    scale: 1,             // size of the pattern against the frame height
    speed: 1,             // cycles per second
    angle: 0,             // turns the pattern under the lattice
    seed: 1,
    colorMode: 'slate',   // a solid by default: colour is a treatment, not the form
    mesh: null,           // the gradient's nodes; null takes the shared arrangement
    size: 'L',            // download size: S, M or L
    background: 'paper'
  };

  function hash2(i, j, seed) {
    var h = Math.imul(i, 0x27d4eb2d) + Math.imul(j, 0x165667b1) + Math.imul(seed, 0x9e3779b1);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }

  /* `t` is the position in the loop, 0..1. */
  DG.generateDots = function (params, width, height, t) {
    var p = Object.assign({}, DG.DEFAULTS, params);
    var pattern = DG.getPattern(p.pattern);

    var cols = Math.max(2, Math.round(p.grid));
    var gap = width / cols;
    var rows = Math.max(1, Math.round(height / gap));
    var maxR = (gap / 2) * p.dotScale;

    var half = height / 2;
    var cx = width / 2;
    var cy = height / 2;
    var a = (p.angle * Math.PI) / 180;
    var cos = Math.cos(a);
    var sin = Math.sin(a);
    var phase = t - Math.floor(t);

    // Sampled at the dot's own place in the frame, which is the same place
    // the ground's mesh is painted from, so the two agree exactly.
    var tint = DG.meshHexSampler(p.mesh, p.meshBlend);
    var useGradient = p.colorMode === 'gradient';
    var dots = [];

    // Behaviours that need to line up with the lattice — rows of pulses, bands —
    // work from the real distance between neighbouring dots rather than from
    // the requested column count, which is otherwise only right on a square
    // frame.
    p.pitch = gap / half;

    // Some behaviours need work done once per frame rather than per dot: a
    // curve sampled, a set of clusters resolved. It is optional; a pattern
    // that needs none just reads its value.
    var ctx = pattern.prepare ? pattern.prepare(phase, p) : null;

    for (var j = 0; j < rows; j++) {
      for (var i = 0; i < cols; i++) {
        var x = (i + 0.5) * gap;
        var y = (j + 0.5) * gap + (height - rows * gap) / 2;

        // The lattice stays square; the pattern turns underneath it.
        var dx = (x - cx) / half;
        var dy = (y - cy) / half;
        var fx = dx * cos + dy * sin;
        var fy = -dx * sin + dy * cos;

        var v = Math.pow(DG.clamp01(pattern.at(fx, fy, phase, p, ctx)), p.contrast);

        if (p.scatter > 0 && hash2(i, j, p.seed) > 1 - p.scatter * (1 - v)) continue;

        var r = maxR * (1 - p.sizeVariation + p.sizeVariation * v);
        if (r < 0.1) continue;

        var dot = { x: x, y: y, r: r, v: v, nx: dx, ny: dy };
        if (useGradient) {
          dot.color = tint(dot.x / width, dot.y / height);
        }
        dots.push(dot);
      }
    }
    return dots;
  };

  /*
   * Handed over by name. Every mode used to be a whole app with DG.DEFAULTS
   * and DG.generateDots to itself; here three of them share a page, so each
   * registers under its own key and modes.js decides which one the renderer,
   * the recorder and the exporters are talking to.
   */
  DG.register('patterns', { labels: null });
})(DG);
