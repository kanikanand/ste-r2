/* ============================================================================
 * patterns.js — six behaviours of one dot system.
 *
 * The circles are the base geometry. Everything else — the sense of mass, of a
 * centre, of a ribbon or a signal — comes from radius, local spacing and
 * selective absence. No connecting lines, no gradients inside a dot, no
 * shadows.
 *
 * Each behaviour is a function of place and time returning 0..1, and each is
 * periodic in time with a period of exactly one cycle. That single rule is what
 * lets any length of footage loop without a jump, and it constrains every
 * animated term: each must complete a whole number of turns per cycle. Nearly
 * every way this goes wrong is a term that completes half a turn, or a
 * cross-fade that eases back to the wrong end.
 *
 * A behaviour may also declare prepare(t, p): work done once per frame — a
 * curve sampled, clusters resolved — returned as a context passed to `at`.
 *
 * Nothing here moves a dot. The lattice is fixed; a behaviour may only decide
 * how much of each cell its dot fills, so every apparent shift of density is a
 * shift of dot size.
 *
 * x and y run -1..1 over the frame's height, so a wide frame shows more of the
 * pattern rather than stretching it. p.pitch is the distance between
 * neighbouring dots in those same units, for behaviours that need to line up
 * with the lattice rather than float over it.
 * ==========================================================================*/
var DG = window.DG || (window.DG = {});

(function (DG) {
  'use strict';

  var TAU = Math.PI * 2;

  var clamp01 = (DG.clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; });

  function smoothstep(e0, e1, x) {
    var t = clamp01((x - e0) / (e1 - e0));
    return t * t * (3 - 2 * t);
  }

  /*
   * A triangle rather than a sine. A sine spends most of its range near its
   * extremes, so dot sizes cluster at full and gone with little in between; a
   * triangle spreads them evenly and the field grades properly.
   */
  function wave(turns) {
    var t = turns - Math.floor(turns);
    return t < 0.5 ? t * 2 : 2 - t * 2;
  }

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
   * Noise that loops. One layer drifts away across the cycle while a second
   * drifts in to meet it, cross-faded STRAIGHT ACROSS. Easing the fade is the
   * classic mistake: an eased curve returns to the layer it left rather than
   * the one it is heading for, and the loop jumps.
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
      form: 'Dense fields growing in area, one behind the next, left to right.',
      blurb: 'A front advances across the frame, gains ground, and hands over to the one behind it.',
      at: function (x, y, t, p) {
        // Repetition, not a single crossing. A diagonal coordinate gave one
        // angled edge that swept the frame once and left it; a periodic one
        // gives the same swell over and over, so any width of canvas is
        // covered by the behaviour rather than by whatever the edge left
        // behind.
        //
        // Two noise layers bend the front. The coarse one decides where it
        // bulges and lags, the fine one keeps the boundary from reading as a
        // drawn curve.
        // Both layers are stretched along x and compressed along y. Noise that
        // varies as fast across the frame as it does down it is nearly
        // constant over any one column, and the front comes out as a straight
        // vertical edge; the boundary can only wander if the warp changes
        // faster down the frame than the front travels across it.
        var warp = 0.55 * (loopNoise(x * 0.35 * p.scale, y * 2.2 * p.scale, t, 3) - 0.5) +
          0.20 * (loopNoise(x * 0.9 * p.scale, y * 4.5 * p.scale, t, 8) - 0.5);
        var u = x * 0.34 * p.scale - t + warp;
        var f = u - Math.floor(u);
        // Area accumulates through most of the repeat, then gives way. Both
        // ends reach zero, so consecutive fronts meet in open ground instead
        // of at a seam.
        var body = smoothstep(0.02, 0.62, f) * (1 - smoothstep(0.82, 0.99, f));
        return clamp01(0.1 + 1.1 * body);
      }
    },
    {
      id: 'convergence',
      name: 'Convergence',
      form: 'Concentric rings closing on a centre.',
      blurb: 'Rings travel inward and gather; the lattice underneath never moves.',
      prepare: function (t) {
        // One slow turn, so the cycle closes exactly where it opened. The
        // rings tighten and open on this breath.
        var breath = 0.5 - 0.5 * Math.cos(TAU * t);
        return { k: 1.9 + 0.35 * breath };
      },
      at: function (x, y, t, p, c) {
        var d = Math.hypot(x, y) / p.scale;
        // Rings rather than one Gaussian well: the concentration recurs at
        // every radius instead of sitting in the middle of the frame once, so
        // the behaviour reaches the corners.
        //
        // +t, not -t. The phase has to move towards the centre for this to be
        // convergence; outward is the same figure playing backwards.
        var ring = wave(d * c.k + t);
        var core = Math.exp(-(d * d) / (2 * 0.85 * 0.85));
        return clamp01(0.08 + 1.15 * Math.pow(ring, 0.85) * (0.35 + 0.75 * core));
      }
    },
    {
      id: 'diffusion',
      name: 'Diffusion',
      form: 'A stable lattice turning porous, opening irregular white channels.',
      blurb: 'Pockets of empty space migrate; dots shrink away ahead and regrow behind.',
      at: function (x, y, t, p) {
        // Fine enough that the gaps read as channels through a lattice rather
        // than as one soft cloud over it.
        var n = loopNoise(x * 2.2 * p.scale, y * 2.2 * p.scale, t, 11);
        // A wide window, not a narrow one. Narrow, the noise crosses it in a
        // couple of dots and the field splits into patches with a hard rim;
        // wide, the same noise grades across five or six dots and the dense
        // and open areas belong to one surface.
        var visible = smoothstep(0.16, 0.74, n);
        // A second, slower field so the surviving lattice is not uniformly
        // heavy — held gentle, or it reinstates the patchiness the wide
        // window just removed.
        var swell = loopNoise(x * 1.0 * p.scale + 9, y * 1.0 * p.scale - 4, t, 27);
        return clamp01(0.1 + visible * (0.8 + 0.32 * swell));
      }
    },
    {
      id: 'intelligence',
      name: 'Intelligence',
      form: 'Clustered information — an abstract circuit, or glyphs that never resolve.',
      blurb: 'Clusters light up in turn, one gaining as its neighbour recedes.',
      prepare: function (t) { return { t: t }; },
      at: function (x, y, t, p, c) {
        // A stable map of grid-aligned cells. The map never changes; only which
        // cells are awake does, so the field reads as sequence rather than as
        // flicker.
        var cell = 0.135 / p.scale;
        var cx = Math.floor(x / cell);
        var cy = Math.floor(y / cell);
        var group = Math.floor(cx / 4) * 31 + Math.floor(cy / 3) * 7;
        if (hash3(cx, cy, 5) < 0.28) return 0.06;         // blank cells

        var quiet = 0.12 + 0.16 * hash3(cx, cy, 13);
        var loud = 0.55 + 0.45 * hash3(cx, cy, 17);

        // Each cluster wakes at its own moment in the cycle, and neighbours are
        // offset slightly so activity passes across the field.
        var phase = hash3(group, 3, 9);
        var u = (c.t - phase + 1) % 1;
        var active = smoothstep(0, 0.18, u) * (1 - smoothstep(0.34, 0.62, u));
        return clamp01(quiet + (loud - quiet) * active);
      }
    },
    {
      id: 'adaptation',
      name: 'Adaptation',
      form: 'Stacked bands that shift between a soft squiggle and a hard zigzag.',
      blurb: 'The same run of bands relaxes into curves and tightens into angles, over and over.',
      prepare: function (t) {
        // Smooth at 0, sharp at the half, smooth again at 1 — one turn, so the
        // change of character is itself the loop rather than something that
        // has to be undone at the end.
        return { m: 0.5 - 0.5 * Math.cos(TAU * t), t: t };
      },
      at: function (x, y, t, p, c) {
        var fx = x / p.scale;
        var fy = y / p.scale;
        var ph = TAU * (fx * 0.55 - c.t);

        // Two waves on one phase, not one wave bent harder. A sine carrying a
        // third harmonic reads as a squiggle; the triangle of the same phase
        // reads as folded. Crossfading them keeps every crest in place while
        // its character changes, which is what makes the morph read as one
        // band adapting rather than as a shape being replaced.
        var soft = Math.sin(ph) + 0.34 * Math.sin(3 * ph + 1.1);
        var hard = 1.15 * (2 / Math.PI) * Math.asin(Math.sin(ph));
        // Amplitude morphs with the shape. Crossfading sine into triangle at a
        // fixed amplitude is a change too small to read at this band width —
        // the squiggle has to be shallow and busy before the fold can arrive
        // as tall and spare.
        var centre = (0.20 + 0.30 * c.m) * (soft + (hard - soft) * c.m);

        // Stacked copies: one ribbon crossing the frame left the rest of it
        // empty.
        var pitch = 0.85;
        var yy = fy - centre + pitch * 0.5;
        var d = Math.abs(yy - pitch * Math.floor(yy / pitch) - pitch * 0.5);
        return clamp01(0.08 + 1.1 * (1 - smoothstep(0.06, 0.26, d)));
      }
    },
    {
      id: 'synchronise',
      name: 'Synchronise',
      form: 'One continuous spiral, winding in and out of itself.',
      blurb: 'Arms of a single curve sweep inward; the spiral tightens, holds, and opens again.',
      prepare: function (t) {
        // Tightness rides one turn, so the spiral ends as open as it began.
        var breath = 0.5 - 0.5 * Math.cos(TAU * t);
        return { k: 2.2 + 0.6 * breath, t: t };
      },
      at: function (x, y, t, p, c) {
        var d = Math.hypot(x, y) / p.scale;
        var a = Math.atan2(y, x);
        // One figure across the whole frame, in place of a row of independent
        // signals: the arms are the repetition, and they are all the same
        // curve, so the field reads as one thing turning.
        //
        // ARMS must be a whole number. atan2 jumps by a full turn along the
        // negative x axis, and only a whole number of arms turns that jump
        // into no jump at all; a fractional count leaves a seam straight
        // across the frame.
        // One arm, wound several times over the radius. Three arms at a low
        // winding rate read as a pinwheel — wide wedges meeting in the middle
        // — where a single arm crossing its own track reads as a spiral.
        var u = (a / TAU) + d * c.k - c.t;
        return clamp01(0.08 + 1.2 * Math.pow(wave(u), 1.3));
      }
    }
  ];

  DG.PATTERNS_BY_ID = {};
  DG.PATTERNS.forEach(function (p) { DG.PATTERNS_BY_ID[p.id] = p; });
  DG.getPattern = function (id) { return DG.PATTERNS_BY_ID[id] || DG.PATTERNS[0]; };
})(DG);
