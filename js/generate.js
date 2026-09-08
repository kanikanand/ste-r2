/* ============================================================================
 * generate.js — lattice -> flow advection -> dot list, plus the two renderers.
 * ==========================================================================*/
var DG = window.DG || (window.DG = {});

(function (DG) {
  'use strict';

  DG.DEFAULTS = {
    preset: 'emergence',
    grid: 34,             // dots across
    dotScale: 0.72,       // largest dot as a fraction of a cell
    sizeVariation: 0.85,  // extent of the difference between small and large dots
    contrast: 1.0,        // gamma on the field before it becomes size
    densityFade: 0.2,     // how much the field thins the grid out
    flowAngle: 0,         // degrees added to every field line
    flowStrength: 0,      // how far dots are carried along the flow
    jitter: 0,            // random offset within the cell
    seed: 1,
    colorMode: 'red',     // a solid id, or 'gradient'
    gradientMap: 'intensity',
    gradientReverse: false,
    background: 'black',
    // Image mode
    imageBlend: 'replace', // replace | multiply | average
    imageInvert: false,
    imageAmount: 1
  };

  var FLOW_STEPS = 6;

  /* Keep advected dots inside the square by wrapping them round. */
  function wrap(v) {
    var t = (v + 1) % 2;
    if (t < 0) t += 2;
    return t - 1;
  }

  /* Deterministic per-cell noise, so a given seed always redraws identically. */
  function hash2(i, j, seed) {
    var h = Math.imul(i, 0x27d4eb2d) + Math.imul(j, 0x165667b1) + Math.imul(seed, 0x9e3779b1);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }

  /*
   * Build the dot list for a square of `size` pixels.
   *
   * `sampler(nx, ny) -> 0..1` is the optional image source; when present it is
   * combined with the preset field according to `imageBlend`.
   */
  DG.generateDots = function (params, size, sampler) {
    var p = Object.assign({}, DG.DEFAULTS, params);
    var preset = DG.getPreset(p.preset);
    var cols = Math.max(2, Math.round(p.grid));
    var cell = size / cols;
    var maxR = (cell / 2) * p.dotScale;
    var norm = 2 / cols;  // one cell in field space
    var stepLen = (p.flowStrength * norm * 3) / FLOW_STEPS;
    var angleOffset = (p.flowAngle * Math.PI) / 180;
    var ramp = DG.buildRamp();
    var useGradient = p.colorMode === 'gradient';

    function field(nx, ny) {
      var base = preset.density(nx, ny);
      if (!sampler) return base;
      var img = sampler(nx, ny);
      if (p.imageInvert) img = 1 - img;
      var v;
      if (p.imageBlend === 'multiply') v = img * base;
      else if (p.imageBlend === 'average') v = (img + base) / 2;
      else v = img;
      return DG.clamp01(base + (v - base) * p.imageAmount);
    }

    var dots = [];
    for (var j = 0; j < cols; j++) {
      for (var i = 0; i < cols; i++) {
        var nx = ((i + 0.5) / cols) * 2 - 1;
        var ny = ((j + 0.5) / cols) * 2 - 1;

        if (p.jitter > 0) {
          nx += (hash2(i, j, p.seed) - 0.5) * norm * p.jitter;
          ny += (hash2(i, j, p.seed + 991) - 0.5) * norm * p.jitter;
        }

        // Carry the dot along the field lines, wrapping so the frame stays full.
        if (stepLen !== 0) {
          for (var s = 0; s < FLOW_STEPS; s++) {
            var a = DG.flowAt(preset, nx, ny) + angleOffset;
            nx += Math.cos(a) * stepLen;
            ny += Math.sin(a) * stepLen;
          }
          nx = wrap(nx);
          ny = wrap(ny);
        }

        var raw = DG.clamp01(field(nx, ny));
        var v = Math.pow(raw, p.contrast);

        // Density: the darker the field, the more likely the dot is dropped.
        var keep = 1 - p.densityFade * (1 - v);
        if (hash2(i, j, p.seed + 7717) > keep) continue;

        var r = maxR * (1 - p.sizeVariation + p.sizeVariation * v);
        if (r < 0.12) continue;

        var dot = {
          x: ((nx + 1) / 2) * size,
          y: ((ny + 1) / 2) * size,
          r: r,
          v: v,
          nx: nx,
          ny: ny
        };
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

  /* Paint the dots onto a 2D context already sized to `size` logical pixels. */
  DG.renderDots = function (ctx, dots, opts) {
    ctx.save();
    ctx.clearRect(0, 0, opts.size, opts.size);
    if (opts.background) {
      ctx.fillStyle = opts.background;
      ctx.fillRect(0, 0, opts.size, opts.size);
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

  /* Same drawing, as a standalone SVG document. */
  DG.dotsToSVG = function (dots, opts) {
    var body = dots.map(function (d) {
      return '<circle cx="' + d.x.toFixed(2) + '" cy="' + d.y.toFixed(2) + '" r="' + d.r.toFixed(2) + '"' +
        (opts.useGradient ? ' fill="' + d.color + '"' : '') + '/>';
    }).join('');
    return [
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + opts.size + '" height="' + opts.size +
        '" viewBox="0 0 ' + opts.size + ' ' + opts.size + '">',
      opts.background ? '<rect width="' + opts.size + '" height="' + opts.size + '" fill="' + opts.background + '"/>' : '',
      '<g' + (opts.useGradient ? '' : ' fill="' + opts.solid + '"') + '>' + body + '</g>',
      '</svg>'
    ].join('');
  };
})(DG);
