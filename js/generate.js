/* ============================================================================
 * generate.js — dot placement, plus the two renderers.
 *
 * A preset's density is read as a HEIGHT SURFACE, not as a mask over a fixed
 * lattice. Rows of points run across the frame in the flow direction, and each
 * point is pushed perpendicular to its row by the height of the form beneath
 * it. So the rows ripple into the shape the preset describes, and the dots sit
 * on those waves. Height also drives dot size and density, so light still
 * carries the depth.
 *
 * Rows are generated across the frame's rotated bounding box and clipped to
 * the frame, so turning the angle lets the pattern bleed off every edge
 * instead of being contained by it.
 * ==========================================================================*/
var DG = window.DG || (window.DG = {});

(function (DG) {
  'use strict';

  DG.ASPECT = 16 / 9;

  DG.DEFAULTS = {
    preset: 'emergence',
    placement: 'lines',   // lines (dots strung along field lines) | grid (rows of points)
    lineDensity: 62,      // field lines across the height of the frame
    dotSpacing: 0.36,     // spacing along a line, against the spacing between lines
    detail: 0.24,         // turbulence folded into the height, which wrinkles the lines
    pointDensity: 30,     // points across the height of the frame
    patternScale: 1.5,    // size of one copy of the form, against frame height
    repeat: 'off',        // off | x | grid — tile the form into a repeating wave
    waveHeight: 0.55,     // how far the form displaces its rows
    waveMode: 'ridge',    // ridge (rows ride over the surface) | bulge (rows open around it)
    hideBehind: true,     // drop points the surface in front of them occludes
    dotScale: 1.1,        // largest dot as a fraction of the point spacing
    sizeVariation: 0.8,   // extent of the difference between small and large dots
    contrast: 0.8,        // gamma on the height before it becomes size
    densityFade: 0.2,     // how much the field thins the points out
    flowAngle: 0,         // degrees — the direction the rows run
    flowStrength: 0,      // drift along the preset's own field lines
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

  /* Layered sines, for wrinkling the height field. Cheap and seamless. */
  function turbulence(x, y) {
    var v = 0;
    var a = 1;
    var f = 1.7;
    for (var i = 0; i < 3; i++) {
      v += a * Math.sin(x * f + 1.3 * i) * Math.cos(y * f * 1.31 + 2.1 * i);
      a *= 0.5;
      f *= 2.13;
    }
    return v * 0.57;  // roughly -1..1
  }

  /* Fold a coordinate back into -1..1, for tiling the form. */
  function tile(v) {
    var t = (v + 1) % 2;
    if (t < 0) t += 2;
    return t - 1;
  }

  /* Deterministic per-point noise, so a given seed always redraws identically. */
  function hash2(i, j, seed) {
    var h = Math.imul(i, 0x27d4eb2d) + Math.imul(j, 0x165667b1) + Math.imul(seed, 0x9e3779b1);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }

  /*
   * Build the dot list for a frame of `width` x `height` pixels.
   *
   * `sampler(u, v) -> 0..1` is the optional image source, addressed in frame
   * coordinates (0..1 across the whole frame, never tiled) so a photograph
   * stays put while the form repeats beneath it.
   */
  DG.generateDots = function (params, width, height, sampler) {
    var p = Object.assign({}, DG.DEFAULTS, params);
    var preset = DG.getPreset(p.preset);
    p.imgKey = sampler ? sampler.samplerId || 0 : 0;

    var spacing = height / Math.max(2, p.pointDensity);
    var half = (height * Math.max(0.05, p.patternScale)) / 2;  // half a copy of the form
    var amp = p.waveHeight * half;                              // displacement in px
    var maxR = (spacing / 2) * p.dotScale;
    var cx = width / 2;
    var cy = height / 2;

    var th = (p.flowAngle * Math.PI) / 180;
    var cos = Math.cos(th);
    var sin = Math.sin(th);

    // Cover the frame's rotated bounding box, with room for the displacement.
    var reach = Math.hypot(width, height) / 2 + amp + spacing * 2;
    var steps = Math.ceil(reach / spacing);

    var ramp = DG.buildRamp();
    var useGradient = p.colorMode === 'gradient';
    var repeatX = p.repeat === 'x' || p.repeat === 'grid';
    var repeatY = p.repeat === 'grid';
    var drift = (p.flowStrength * (spacing / half) * 3) / FLOW_STEPS;

    /* Frame pixel -> the form's own coordinates, tiled if the form repeats. */
    function toField(x, y) {
      var fx = (x - cx) / half;
      var fy = (y - cy) / half;
      return [repeatX ? tile(fx) : fx, repeatY ? tile(fy) : fy];
    }

    function heightAt(fx, fy, x, y) {
      var base = preset.density(fx, fy);
      // Blended, not added and clamped: adding would push a peak over 1 and the
      // clamp would flatten it straight back into a plateau.
      if (p.detail > 0) {
        base = base * (1 - p.detail) + p.detail * (0.5 + 0.5 * turbulence(fx * 2.4, fy * 2.4));
      }
      if (!sampler) return base;
      var img = sampler(x / width, y / height);
      if (p.imageInvert) img = 1 - img;
      var v;
      if (p.imageBlend === 'multiply') v = img * base;
      else if (p.imageBlend === 'average') v = (img + base) / 2;
      else v = img;
      return DG.clamp01(base + (v - base) * p.imageAmount);
    }

    /* Height at a frame pixel, going through the tiling. */
    function heightPx(x, y) {
      var f = toField(x, y);
      return DG.clamp01(heightAt(f[0], f[1], x, y));
    }

    if (p.placement === 'lines') {
      return DG.dotsAlongLines(p, width, height, heightPx, half, th, ramp, useGradient);
    }

    var dots = [];
    var margin = maxR + 1;

    // Horizon per column, for hiding what the surface occludes. Rows are walked
    // front to back and a point is kept only if it clears everything already
    // drawn in front of it — which is also what stops steep parts of the form
    // from crowding rows into smears.
    var occlude = p.hideBehind && p.waveMode === 'ridge' && amp !== 0;
    var horizon = occlude ? new Float64Array(2 * steps + 1).fill(Infinity) : null;
    // Rows crowding closer than this are smeared into each other, so the ones
    // behind are dropped rather than drawn on top of the row in front.
    var minGap = maxR * 1.2;

    for (var jv = steps; jv >= -steps; jv--) {
      var v = jv * spacing;                    // which row
      for (var iu = -steps; iu <= steps; iu++) {
        var u = iu * spacing;                  // position along the row

        if (p.jitter > 0) {
          u += (hash2(iu, jv, p.seed) - 0.5) * spacing * p.jitter;
          v += (hash2(iu, jv, p.seed + 991) - 0.5) * spacing * p.jitter;
        }

        // Base position of the point on its undisplaced row.
        var x = cx + u * cos - v * sin;
        var y = cy + u * sin + v * cos;

        var f = toField(x, y);
        var fx = f[0];
        var fy = f[1];

        // Optional drift along the preset's own field lines.
        if (drift !== 0) {
          for (var s = 0; s < FLOW_STEPS; s++) {
            var a = DG.flowAt(preset, fx, fy) + th;
            fx += Math.cos(a) * drift;
            fy += Math.sin(a) * drift;
          }
          x = cx + fx * half;
          y = cy + fy * half;
          if (repeatX) fx = tile(fx);
          if (repeatY) fy = tile(fy);
        }

        var raw = DG.clamp01(heightAt(fx, fy, x, y));
        var hgt = Math.pow(raw, p.contrast);

        // Push the point out of its row by the height of the form beneath it,
        // along the row's normal. In bulge mode rows open away from the form's
        // mid-line so the volume stays centred; in ridge mode every row lifts
        // the same way, like a contour map.
        if (amp !== 0) {
          var d;
          if (p.waveMode === 'ridge') {
            // Measured from mid-height, so the form straddles its rows instead
            // of piling the whole pattern to one side.
            d = -(hgt - 0.5) * amp;
          } else {
            var side = -(x - cx) * sin + (y - cy) * cos;   // offset along the normal
            if (repeatX || repeatY) side = tile(side / half) * half;
            d = (side < 0 ? -1 : 1) * hgt * amp;
          }
          x += -sin * d;
          y += cos * d;

          if (occlude) {
            var col = iu + steps;
            var vDisp = v + d;                 // where the row sits after displacing
            if (vDisp >= horizon[col] - minGap) continue;
            horizon[col] = vDisp;
          }
        }

        // Clip to the frame: the pattern bleeds off the edges.
        if (x < -margin || x > width + margin || y < -margin || y > height + margin) continue;

        // Density: the darker the field, the more likely the point is dropped.
        var keep = 1 - p.densityFade * (1 - hgt);
        if (hash2(iu, jv, p.seed + 7717) > keep) continue;

        var r = maxR * (1 - p.sizeVariation + p.sizeVariation * hgt);
        if (r < 0.12) continue;

        var dot = { x: x, y: y, r: r, v: hgt, nx: (x - cx) / (width / 2), ny: (y - cy) / (height / 2) };
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

  /*
   * Dots strung along evenly spaced field lines.
   *
   * The lines follow the contours of the height surface — perpendicular to its
   * gradient — so they loop around the form's peaks and part at its saddles.
   * The angle rotates that direction, which opens the closed contours into
   * spirals. Height still sets dot size and thins the dots out.
   */
  var lineCache = new Map();
  var LINE_CACHE_MAX = 20;

  DG.dotsAlongLines = function (p, width, height, heightPx, half, th, ramp, useGradient) {
    var dSep = height / Math.max(4, p.lineDensity);
    var along = dSep * Math.max(0.08, p.dotSpacing);
    var maxR = (along / 2) * p.dotScale;
    var grad = Math.max(0.75, dSep * 0.35);   // sampling distance for the gradient

    /*
     * Contour direction: perpendicular to the gradient. Deep inside a peak the
     * slope can vanish at close range, so widen the stencil before giving up —
     * that picks up the shape of the bowl and keeps the lines circulating
     * instead of collapsing into straight stripes.
     */
    function dirAt(x, y) {
      for (var r = grad, i = 0; i < 3; i++, r *= 4) {
        var gx = heightPx(x + r, y) - heightPx(x - r, y);
        var gy = heightPx(x, y + r) - heightPx(x, y - r);
        if (Math.abs(gx) > 1e-9 || Math.abs(gy) > 1e-9) {
          return Math.atan2(gy, gx) + Math.PI / 2 + th;
        }
      }
      return th;
    }

    // Tracing is the expensive part and depends only on the field and the line
    // spacing, so dot size, spacing and colour changes reuse the same curves.
    var key = [
      p.preset, p.patternScale, p.repeat, p.detail, p.flowAngle, p.lineDensity,
      width, height, p.imgKey || 0, p.imageBlend, p.imageInvert, p.imageAmount
    ].join('|');

    var lines = lineCache.get(key);
    if (!lines) {
      lines = DG.traceStreamlines({
        width: width,
        height: height,
        dSep: dSep,
        dirAt: dirAt,
        step: Math.max(0.6, dSep * 0.42)
      });
      if (lineCache.size >= LINE_CACHE_MAX) lineCache.delete(lineCache.keys().next().value);
      lineCache.set(key, lines);
    }

    var dots = [];
    var cx = width / 2;
    var cy = height / 2;
    var seed = p.seed;
    var n = 0;

    for (var i = 0; i < lines.length; i++) {
      var pts = lines[i];
      var carried = 0;                        // arc length since the last dot
      for (var k = 2; k < pts.length; k += 2) {
        var x = pts[k];
        var y = pts[k + 1];
        carried += Math.hypot(x - pts[k - 2], y - pts[k - 1]);
        if (carried < along) continue;
        carried = 0;
        n++;

        var hgt = Math.pow(heightPx(x, y), p.contrast);
        var keep = 1 - p.densityFade * (1 - hgt);
        if (hash2(i, n, seed + 7717) > keep) continue;

        var r = maxR * (1 - p.sizeVariation + p.sizeVariation * hgt);
        if (r < 0.12) continue;

        var dot = { x: x, y: y, r: r, v: hgt, nx: (x - cx) / (width / 2), ny: (y - cy) / (height / 2) };
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

  /* Same drawing, as a standalone SVG document. */
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
