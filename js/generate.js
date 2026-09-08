/* ============================================================================
 * generate.js — the dot texture.
 *
 * Two ways of turning a wave into a texture.
 *
 *   spacing  every mark is the same size and the wave squeezes the gaps
 *            between them, so density alone carries the tone. Rows march down
 *            the frame at a pitch set by the wave across that row, and marks
 *            march along each row at a pitch set by the wave under them.
 *
 *   size     a plain fixed lattice where the wave sets each mark's size, the
 *            ordinary halftone.
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
    depth: 'spacing',     // spacing (same-size dots, tone from density) | size (halftone)
    shape: 'circle',      // circle | square
    grid: 56,             // dots across the width
    spacingRange: 0.55,   // spacing mode: how hard the wave gathers the marks
    dotScale: 0.82,       // largest dot, as a fraction of the gap between dots
    sizeVariation: 0.9,   // difference between the smallest and largest dot
    contrast: 1,          // gamma on the field before it becomes size
    scatter: 0,           // randomly thin the dots out where the field is dark
    waveScale: 1,         // size of the waves, against the frame height
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

  /* Deterministic per-dot noise, so a given seed always redraws identically. */
  function hash2(i, j, seed) {
    var h = Math.imul(i, 0x27d4eb2d) + Math.imul(j, 0x165667b1) + Math.imul(seed, 0x9e3779b1);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }

  /*
   * Same-size marks, tone from how tightly they are packed.
   *
   * Every mark starts on an even lattice and then walks a little way up the
   * wave's own slope, so marks gather on the crests and leave the troughs open.
   * Walking in small steps and capping the total keeps neighbours from
   * swapping places, so the texture stays legible however hard it is pushed.
   */
  function spacingDots(p, width, height, heightAt, ramp, useGradient) {
    var base = width / Math.max(2, Math.round(p.grid));
    // Every mark is full size here, so the frame carries far more ink than in
    // size mode — half the nominal radius keeps the two modes comparable.
    var r = (base / 2) * p.dotScale * 0.5;
    if (r < 0.1) return [];

    var pull = Math.max(0, p.spacingRange);
    var maxMove = base * 0.92 * pull;      // never far enough to cross a neighbour
    var STEPS = 5;
    var reach = base * 0.6;                // how far apart the slope is measured
    var stepLen = maxMove / STEPS;

    var cx = width / 2;
    var cy = height / 2;
    var cols = Math.ceil(width / base) + 2;
    var rows = Math.ceil(height / base) + 2;
    var dots = [];

    /*
     * How steep this preset gets at this scale, so travel can be proportional
     * to the slope rather than saturating. Without it a gentle wave would not
     * move at all and a steep one would slam every mark onto its crests.
     */
    var slopes = [];
    for (var sy = 0; sy < 12; sy++) {
      for (var sx = 0; sx < 12; sx++) {
        var px = (width * (sx + 0.5)) / 12;
        var py = (height * (sy + 0.5)) / 12;
        slopes.push(Math.hypot(
          heightAt(px + reach, py) - heightAt(px - reach, py),
          heightAt(px, py + reach) - heightAt(px, py - reach)
        ));
      }
    }
    slopes.sort(function (a, b) { return a - b; });
    var gScale = Math.max(1e-4, slopes[Math.floor(slopes.length * 0.9)]);

    for (var j = 0; j < rows; j++) {
      for (var i = 0; i < cols; i++) {
        var ox = (i - 0.5) * base + base / 2;
        var oy = (j - 0.5) * base + base / 2;
        var x = ox;
        var y = oy;

        for (var s = 0; s < STEPS && pull > 0; s++) {
          var gx = heightAt(x + reach, y) - heightAt(x - reach, y);
          var gy = heightAt(x, y + reach) - heightAt(x, y - reach);
          var len = Math.hypot(gx, gy);
          if (len < 1e-6) break;
          // Direction from the slope, distance in proportion to it, so marks on
          // the steep flanks travel and those on crests and in troughs stay put.
          var commit = Math.min(1, len / gScale);
          x += (gx / len) * stepLen * commit;
          y += (gy / len) * stepLen * commit;
        }

        // Cap the total move so the lattice deforms without tangling.
        var dx = x - ox;
        var dy = y - oy;
        var move = Math.hypot(dx, dy);
        if (move > maxMove) {
          x = ox + (dx / move) * maxMove;
          y = oy + (dy / move) * maxMove;
        }

        if (x < -r || x > width + r || y < -r || y > height + r) continue;

        var dot = { x: x, y: y, r: r, v: heightAt(x, y), nx: (x - cx) / cx, ny: (y - cy) / cy };
        if (useGradient) {
          var t = DG.gradientCoord(p.gradientMap, dot);
          if (p.gradientReverse) t = 1 - t;
          dot.color = ramp[Math.min(ramp.length - 1, Math.max(0, Math.round(t * (ramp.length - 1))))];
        }
        dots.push(dot);
      }
    }
    return dots;
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

    var half = (height * Math.max(0.1, p.waveScale)) / 2;
    var cx = width / 2;
    var cy = height / 2;
    var a = (p.angle * Math.PI) / 180;
    var cos = Math.cos(a);
    var sin = Math.sin(a);
    var ramp = DG.buildRamp();
    var useGradient = p.colorMode === 'gradient';

    /* The wave under a frame pixel, with the image folded in if there is one. */
    function heightAt(x, y) {
      var dx = x - cx;
      var dy = y - cy;
      var value = preset.density((dx * cos + dy * sin) / half, (-dx * sin + dy * cos) / half);
      if (sampler) {
        var img = sampler(x / width, y / height);
        if (p.imageInvert) img = 1 - img;
        value = p.imageBlend === 'multiply' ? img * value : img;
      }
      return Math.pow(DG.clamp01(value), p.contrast);
    }

    if (p.depth === 'spacing') return spacingDots(p, width, height, heightAt, ramp, useGradient);

    var dots = [];

    for (var j = 0; j < rows; j++) {
      for (var i = 0; i < cols; i++) {
        var x = (i + 0.5) * gap;
        var y = (j + 0.5) * gap + (height - rows * gap) / 2;

        var v = heightAt(x, y);

        if (p.scatter > 0 && hash2(i, j, p.seed) > 1 - p.scatter * (1 - v)) continue;

        var r = maxR * (1 - p.sizeVariation + p.sizeVariation * v);
        if (r < 0.1) continue;

        var dot = { x: x, y: y, r: r, v: v, nx: (x - cx) / cx, ny: (y - cy) / cy };
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
    var square = opts.shape === 'square';
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      if (opts.useGradient) ctx.fillStyle = d.color;
      if (square) {
        ctx.fillRect(d.x - d.r, d.y - d.r, d.r * 2, d.r * 2);
      } else {
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  };

  /*
   * The same drawing as an SVG document. With no background it comes out with
   * a transparent ground, which is what you want to lay it over a photograph.
   */
  DG.dotsToSVG = function (dots, opts) {
    var square = opts.shape === 'square';
    var body = dots.map(function (d) {
      var fill = opts.useGradient ? ' fill="' + d.color + '"' : '';
      if (square) {
        return '<rect x="' + (d.x - d.r).toFixed(2) + '" y="' + (d.y - d.r).toFixed(2) +
          '" width="' + (d.r * 2).toFixed(2) + '" height="' + (d.r * 2).toFixed(2) + '"' + fill + '/>';
      }
      return '<circle cx="' + d.x.toFixed(2) + '" cy="' + d.y.toFixed(2) + '" r="' + d.r.toFixed(2) + '"' + fill + '/>';
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
