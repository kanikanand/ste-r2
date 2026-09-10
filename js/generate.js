/* ============================================================================
 * generate.js — the dots for one moment.
 *
 * A plain lattice that never moves; the pattern beneath it does. The pattern's
 * value at each point becomes that dot's size — that is the only thing it may
 * become. Nothing displaces a dot from its cell, so every apparent gathering
 * or thinning of the field is dot area, and the grid stays legible under it.
 * ==========================================================================*/
var DG = window.DG || (window.DG = {});

(function (DG) {
  'use strict';

  DG.FRAMES = [
    { id: '16:9', label: '16 : 9', ratio: 16 / 9 },
    { id: '1:1', label: '1 : 1', ratio: 1 },
    { id: '4:5', label: '4 : 5', ratio: 4 / 5 },
    { id: '9:16', label: '9 : 16', ratio: 9 / 16 }
  ];

  DG.frameRatio = function (id) {
    for (var i = 0; i < DG.FRAMES.length; i++) if (DG.FRAMES[i].id === id) return DG.FRAMES[i].ratio;
    return 16 / 9;
  };

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
    gradientMap: 'y',
    stops: [0, 0.5, 1],   // where the three ramp colours sit, 0..1
    gradientReverse: false,
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

    var ramp = DG.buildRamp(96, p.stops);
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
          var g = DG.gradientCoord(p.gradientMap, dot);
          if (p.gradientReverse) g = 1 - g;
          dot.color = ramp[Math.min(ramp.length - 1, Math.max(0, Math.round(g * (ramp.length - 1))))];
        }
        dots.push(dot);
      }
    }
    return dots;
  };

  DG.renderDots = function (ctx, dots, opts) {
    ctx.save();
    ctx.clearRect(0, 0, opts.width, opts.height);
    if (opts.bgGradient) {
      // Top to bottom, matching the default mapping of the dot ramp, so a
      // gradient background and gradient dots read as one field rather than
      // as two ramps crossing.
      var g = ctx.createLinearGradient(0, 0, 0, opts.height);
      for (var st = 0; st < opts.bgGradient.length; st++) {
        g.addColorStop(opts.bgGradient[st][1], opts.bgGradient[st][0]);
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, opts.width, opts.height);
    } else if (opts.background) {
      ctx.fillStyle = opts.background;
      ctx.fillRect(0, 0, opts.width, opts.height);
    }
    // After the background, never before: set on the whole context it would
    // fade the ground as well, and a half-opaque black on a white page is grey.
    if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
    if (!opts.useGradient) ctx.fillStyle = opts.solid;
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      if (opts.useGradient) ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  };

  DG.dotsToSVG = function (dots, opts) {
    var body = dots.map(function (d) {
      var fill = opts.useGradient ? ' fill="' + d.color + '"' : '';
      return '<circle cx="' + d.x.toFixed(2) + '" cy="' + d.y.toFixed(2) + '" r="' + d.r.toFixed(2) + '"' + fill + '/>';
    }).join('');
    // A real gradient definition, not a flattened fill: the stops stay editable
    // wherever the file is opened.
    var defs = '';
    var ground = '';
    if (opts.bgGradient) {
      defs = '<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">' +
        opts.bgGradient.map(function (st) {
          return '<stop offset="' + (st[1] * 100).toFixed(1) + '%" stop-color="' + st[0] + '"/>';
        }).join('') + '</linearGradient></defs>';
      ground = '<rect width="' + opts.width + '" height="' + opts.height + '" fill="url(#bg)"/>';
    } else if (opts.background) {
      ground = '<rect width="' + opts.width + '" height="' + opts.height + '" fill="' + opts.background + '"/>';
    }

    return [
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + opts.width + '" height="' + opts.height +
        '" viewBox="0 0 ' + opts.width + ' ' + opts.height + '">',
      defs,
      ground,
      // fill-opacity on the group rather than a colour with alpha, so the
      // dots stay editable as flat fills wherever the file is opened.
      '<g' + (opts.useGradient ? '' : ' fill="' + opts.solid + '"') +
        (opts.alpha !== undefined && opts.alpha < 1 ? ' fill-opacity="' + opts.alpha + '"' : '') +
        '>' + body + '</g>',
      '</svg>'
    ].join('');
  };
})(DG);
