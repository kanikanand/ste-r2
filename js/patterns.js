/* ============================================================================
 * patterns.js — five behaviours of one dot system.
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
  function loopNoise(x, y, t, seed, drift) {
    // `drift` scales how far the layers travel, and nothing else. It matters
    // because the distance is fixed in noise space: over a coordinate that has
    // been stretched to a third of its frequency, the same 1.7 becomes five
    // field units a cycle, and the warp ends up racing the thing it is meant
    // to be bending. The loop holds at any drift — at t = 0 the result is the
    // first layer read at its own origin, and at t = 1 the second layer read
    // at exactly the same place.
    var d = drift === undefined ? 1 : drift;
    var a = noise2(x + t * 1.7 * d, y - t * 1.1 * d, seed);
    var b = noise2(x - (1 - t) * 1.7 * d, y + (1 - t) * 1.1 * d, seed);
    return a * (1 - t) + b * t;
  }

  DG.PATTERNS = [
    {
      id: 'expansion',
      name: 'Expansion',
      form: 'Fields advancing at different speeds, overtaking each other and merging into larger ground.',
      blurb: 'Fronts cross the frame at their own rates; where they overlap they become one broader field, then draw apart again.',
      at: function (x, y, t, p) {
        // Divided by scale, not multiplied: turning Pattern scale up has to
        // make the fields larger. Multiplying raises the spatial frequency
        // instead, and at the top of the slider the behaviour degenerates into
        // a fine vertical grating.
        var sx = x / p.scale;
        var sy = y / p.scale;

        /*
         * Three fronts rather than one. A single periodic coordinate can only
         * ever hold one speed, so every stripe it draws marches in lockstep and
         * the spacing between them never changes — which is a moving grating,
         * not an expansion. Three layers of different widths drift against each
         * other: they overtake, overlap into one broader field, and separate
         * again.
         *
         * The differing speeds come from the widths, not from the rates. A
         * front travels its own repeat once per cycle, so its speed is one
         * repeat per cycle — wide fronts cover more ground than narrow ones in
         * the same time. Running the layers at two and three turns instead made
         * the behaviour three to five times faster than any other, since a rate
         * has to be a whole number and two is already double.
         *
         * Combined by taking the strongest, not by adding. Added, three
         * overlapping fronts saturate wherever any two meet and the merge is
         * exactly where the picture goes flat.
         */
        var best = 0;
        for (var n = 0; n < 3; n++) {
          var sd = 3 + n * 13;
          var rate = 1;                           // one whole turn per cycle
          var freq = 0.50 + 0.15 * n;

          // Two noise layers bend the front. The coarse one decides where it
          // bulges and lags, the fine one keeps the boundary from reading as a
          // drawn curve. Both are stretched along x and compressed along y:
          // noise that varies as fast across the frame as it does down it is
          // nearly constant over any one column, and the front comes out as a
          // straight vertical edge.
          var warp = 0.55 * (loopNoise(sx * 0.35, sy * 2.2, t, sd, 0.25) - 0.5) +
            0.20 * (loopNoise(sx * 0.9, sy * 4.5, t, sd + 5, 0.35) - 0.5);

          var u = sx * freq - rate * t + hash3(n, 1, 5) + warp;
          var f = u - Math.floor(u);
          // About a third of the repeat each, not most of it. One front could
          // afford to be wide; three of them taken together cannot — at the old
          // duty the union covered the frame and there was no open ground left
          // for anything to advance into. Both ends still reach zero, so
          // consecutive fronts meet in clear space rather than at a seam.
          //
          // Long ramps rather than hard edges. At one turn per cycle every dot
          // traverses exactly one repeat, whatever the width of the fields, so
          // the ramps are the only thing that sets how fast any one dot changes
          // size — and that is most of what reads as speed. Over the old
          // 0.13-wide edge a dot went from smallest to largest in an eighth of
          // a cycle, where every other behaviour here takes about a half.
          //
          // Which also means the field width is free: it costs nothing in pace,
          // so it is set as wide as the duty allows.
          var body = smoothstep(0.02, 0.24, f) * (1 - smoothstep(0.30, 0.56, f));

          // A slow vertical envelope, so a front is a field with a top and a
          // bottom rather than a bar the full height of the frame. Without it
          // the density only ever varies horizontally.
          // The envelope sways rather than runs: its phase is displaced by a
          // sine of the cycle instead of advancing with it, so where a front
          // carries its weight drifts up and down slowly without adding to how
          // fast the front itself crosses the frame.
          var vy = 0.5 + 0.5 * Math.sin(TAU * (sy * (0.30 + 0.10 * n) +
            0.28 * Math.sin(TAU * (t + hash3(n, 4, 19))) + hash3(n, 2, 9)));
          var v = body * (0.22 + 0.78 * vy);
          if (v > best) best = v;
        }
        return clamp01(0.1 + 1.15 * best);
      }
    },
    {
      id: 'convergence',
      name: 'Convergence',
      form: 'Concentric rings closing on a centre, unevenly spaced and unevenly drawn.',
      blurb: 'Rings travel inward and gather — some broad, some fine, bunching at some radii and opening at others.',
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
        // Two ways of being uneven, and they do different jobs. Warping the
        // radius before the wave sees it changes where the rings fall — they
        // bunch at some radii and open out at others. The exponent then
        // changes how wide each one is drawn. With only the first the rings
        // are unevenly spaced but all the same weight; with only the second
        // they are evenly spaced and merely lighter and heavier.
        //
        // The warp's slope has to stay positive or rings fold through each
        // other: 1 - (0.26 * 1.7) - (0.10 * 3.3) leaves 0.23 in hand.
        var warp = d + 0.26 * Math.sin(d * 1.7 + 1.1) + 0.10 * Math.sin(d * 3.3 - 0.4);
        var ring = wave(warp * c.k + t);
        // A wide range, which it can afford now that the centre's weight is
        // added rather than multiplied: a high exponent narrows a ring without
        // draining it, so every ring still reaches full size at its crest and
        // they differ in width instead of in weight.
        var width = 0.75 + 1.35 * (0.5 + 0.5 * Math.sin(d * 1.3 + 2.0));
        // The centre's weight is added, not multiplied. Multiplying scales the
        // ring contrast by the same falloff, so the rings fade out towards the
        // corners while saturating at 1 in the middle — flat at both ends and
        // only legible in a band between them. Added, every ring is drawn with
        // the same contrast and the middle simply carries more weight.
        var core = Math.exp(-(d * d) / (2 * 0.85 * 0.85));
        return clamp01(0.05 + 0.20 * core + 0.95 * Math.pow(ring, width));
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
        // Divided, like every other behaviour. Multiplying the coordinate by
        // Pattern scale raises the frequency, so the slider ran backwards: its
        // top gave the finest channels rather than the widest.
        var n = loopNoise(x * 2.2 / p.scale, y * 2.2 / p.scale, t, 11);
        // A wide window, not a narrow one. Narrow, the noise crosses it in a
        // couple of dots and the field splits into patches with a hard rim;
        // wide, the same noise grades across five or six dots and the dense
        // and open areas belong to one surface.
        var visible = smoothstep(0.16, 0.74, n);
        // A second, slower field so the surviving lattice is not uniformly
        // heavy — held gentle, or it reinstates the patchiness the wide
        // window just removed.
        var swell = loopNoise(x * 1.0 / p.scale + 9, y * 1.0 / p.scale - 4, t, 27);
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
        // Multiplied, because this is a cell SIZE and not a coordinate: the
        // two go opposite ways. Dividing shrank the cells as the slider rose,
        // which is the same inversion Diffusion had by the opposite arithmetic.
        var cell = 0.135 * p.scale;
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
      id: 'synchronise',
      name: 'Synchronise',
      form: 'Horizontal signals that drift, fall into a shared beat, and part again.',
      blurb: 'Pulses travel at one speed but out of phase, align, hold, then separate.',
      prepare: function (t) {
        /*
         * Four stages, not a cosine. A raised cosine is only ever arriving at
         * or leaving alignment, so there is no moment that reads as locked —
         * the field just breathes. Two smoothsteps give the drift, the pull
         * into step, a real plateau to hold on, and the separation.
         *
         * It closes its own loop: the first term is 0 at t = 0 and the second
         * has fallen to 0 by t = 1, so the field is equally loose at both ends.
         */
        var u = t - Math.floor(t);
        var sync = smoothstep(0.06, 0.34, u) * (1 - smoothstep(0.60, 0.94, u));
        return { sync: sync, t: t };
      },
      at: function (x, y, t, p, c) {
        // Pinned to the lattice: one pattern row per row of dots. Deriving it
        // from anything but the real dot pitch puts the signals between the
        // rows and the field reads as scatter.
        var rowH = p.pitch || 2 / Math.max(4, p.grid);
        var row = Math.floor((y + 4) / rowH);
        // The offsets close all the way. Holding a residual back keeps the
        // field from ever banding, but it also means the rows never actually
        // arrive — and arriving is the whole behaviour.
        var offset = (hash3(row, 2, 8) - 0.5) * 0.9 * (1 - c.sync);
        // One pitch for every row. Rows at different pitches cannot line up at
        // any phase, however far their offsets close.
        //
        // Divided by scale, like every other behaviour: multiplying turns the
        // top of the Pattern scale slider into a fine grating instead of a
        // larger pattern.
        var pulse = wave(x * 0.8 / p.scale - c.t + offset);
        // Long pulses, short dashes and quiet stretches within each row.
        // Each row shaped differently: some long pulses, some short dashes,
        // some barely there.
        // Rows differ in how long their pulses run, not in how hard they snap:
        // sharpen too far and the runs break into isolated dots.
        // Rows still differ in how long their runs are, but less than they
        // did: a wide range of exponents leaves some rows almost solid and
        // others almost empty, and the field stripes horizontally instead of
        // reading as several parts keeping time.
        var shape = hash3(row, 6, 4);
        return clamp01(Math.pow(pulse, 0.95 + 0.85 * shape) * 1.25);
      }
    }
  ];

  DG.PATTERNS_BY_ID = {};
  DG.PATTERNS.forEach(function (p) { DG.PATTERNS_BY_ID[p.id] = p; });
  DG.getPattern = function (id) { return DG.PATTERNS_BY_ID[id] || DG.PATTERNS[0]; };
})(DG);
