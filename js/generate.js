/* ============================================================================
 * generate.js — the dot texture.
 *
 * A plain square lattice of dots. Each preset is a field over the pattern's own
 * coordinates; the field value at a dot sets that dot's size, and thins dots
 * out where it is dark. The lattice itself never moves, so the texture stays
 * regular and tiles cleanly.
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
    preset: 'emergence',
    frame: '16:9',
    grid: 40,             // dots across the width
    dotScale: 0.82,       // largest dot, as a fraction of the gap between dots
    sizeVariation: 0.9,   // difference between the smallest and largest dot
    contrast: 1,          // gamma on the field before it becomes size
    scatter: 0,           // randomly thin the dots out where the field is dark
    patternSize: 1,       // one copy of the pattern, against the frame height
    tiling: 'tile',       // tile | single
    angle: 0,             // rotates the pattern under the lattice
    seed: 1,
    colorMode: 'red',     // a solid id, or 'gradient'
    gradientMap: 'intensity',
    gradientReverse: false,
    background: 'transparent',
    // Image mode
    imageBlend: 'replace', // replace | multiply
    imageInvert: false
  };

  /* Fold a coordinate back into -1..1, which is what makes the pattern tile. */
  function tile(v) {
    var t = (v + 1) % 2;
    if (t < 0) t += 2;
    return t - 1;
  }

  /* Deterministic per-dot noise, so a given seed always redraws identically. */
  function hash2(i, j, seed) {
    var h = Math.imul(i, 0x27d4eb2d) + Math.imul(j, 0x165667b1) + Math.imul(seed, 0x9e3779b1);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }

  /*
   * Build the dots for a frame of `width` x `height` pixels.
   * `sampler(u, v) -> 0..1` is the optional image source, in frame coordinates.
   */
  DG.generateDots = function (params, width, height, sampler) {
    var p = Object.assign({}, DG.DEFAULTS, params);
    var preset = DG.getPreset(p.preset);

    var cols = Math.max(2, Math.round(p.grid));
    var gap = width / cols;
    var rows = Math.max(1, Math.round(height / gap));
    var maxR = (gap / 2) * p.dotScale;

    var half = (height * Math.max(0.1, p.patternSize)) / 2;
    var cx = width / 2;
    var cy = height / 2;
    var a = (p.angle * Math.PI) / 180;
    var cos = Math.cos(a);
    var sin = Math.sin(a);
    var repeat = p.tiling === 'tile';

    var ramp = DG.buildRamp();
    var useGradient = p.colorMode === 'gradient';
    var dots = [];

    for (var j = 0; j < rows; j++) {
      for (var i = 0; i < cols; i++) {
        var x = (i + 0.5) * gap;
        var y = (j + 0.5) * gap + (height - rows * gap) / 2;

        // The lattice stays square; the pattern turns underneath it.
        var dx = x - cx;
        var dy = y - cy;
        var fx = (dx * cos + dy * sin) / half;
        var fy = (-dx * sin + dy * cos) / half;
        if (repeat) {
          fx = tile(fx);
          fy = tile(fy);
        }

        var value = preset.density(fx, fy);
        if (sampler) {
          var img = sampler(x / width, y / height);
          if (p.imageInvert) img = 1 - img;
          value = p.imageBlend === 'multiply' ? img * value : img;
        }
        var v = Math.pow(DG.clamp01(value), p.contrast);

        if (p.scatter > 0 && hash2(i, j, p.seed) > 1 - p.scatter * (1 - v)) continue;

        var r = maxR * (1 - p.sizeVariation + p.sizeVariation * v);
        if (r < 0.1) continue;

        var dot = { x: x, y: y, r: r, v: v, nx: dx / (width / 2), ny: dy / (height / 2) };
        if (useGradient) {
          var t = DG.gradientCoord(p.gradientMap, dot);
          if (p.gradientReverse) t = 1 - t;
          dot.color = ramp[Math.min(ramp.length - 1, Math.max(0, Math.round(t * (ramp.length - 1))))];
        }
        dots.push(dot);
      }
    }
    return dots;
  };

  /* Paint the dots onto a 2D context already sized in logical pixels. */
  DG.renderDots = function (ctx, dots, opts) {
    ctx.save();
    ctx.clearRect(0, 0, opts.width, opts.height);
    if (opts.background) {
      ctx.fillStyle = opts.background;
      ctx.fillRect(0, 0, opts.width, opts.height);
    }
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

  /*
   * The same drawing as an SVG document. With no background it comes out with
   * a transparent ground, which is what you want to lay it over a photograph.
   */
  DG.dotsToSVG = function (dots, opts) {
    var body = dots.map(function (d) {
      return '<circle cx="' + d.x.toFixed(2) + '" cy="' + d.y.toFixed(2) + '" r="' + d.r.toFixed(2) + '"' +
        (opts.useGradient ? ' fill="' + d.color + '"' : '') + '/>';
    }).join('');
    return [
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + opts.width + '" height="' + opts.height +
        '" viewBox="0 0 ' + opts.width + ' ' + opts.height + '">',
      opts.background ? '<rect width="' + opts.width + '" height="' + opts.height + '" fill="' + opts.background + '"/>' : '',
      '<g' + (opts.useGradient ? '' : ' fill="' + opts.solid + '"') + '>' + body + '</g>',
      '</svg>'
    ].join('');
  };
})(DG);
