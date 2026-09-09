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
      form: 'One broad horizontal wave whose arches all differ — tall and short, smooth and sharp, thick and thin.',
      blurb: 'A wide band crosses the frame; each arch rises to its own height, holds its own shape, and moves at its own rate.',
      prepare: function (t) {
        return { t: t };
      },
      at: function (x, y, t, p, c) {
        var fx = x / p.scale;
        var fy = y / p.scale;

        // Arches are fixed in place and change character where they stand,
        // rather than the whole wave sliding past. A travelling wave has to be
        // periodic in its own index to close its loop, which forces every arch
        // to be identical — the one thing this behaviour must not be.
        var u = fx * 0.5 + 8;
        var i = Math.floor(u);
        var s = u - i;

        /*
         * Each arch moves at its own RATE, not merely on its own phase. Give
         * them all one turn per cycle and they rise and fall together whenever
         * their phases happen to sit near each other — which they will, since
         * only two or three arches are on screen at once, and three hashes are
         * far too small a sample to look spread out. Different whole numbers
         * of turns is what makes the movement read as uneven; whole numbers,
         * so each still closes its own loop.
         */
        var rate = 1 + Math.floor(hash3(i, 23, 71) * 3);
        var swing = 0.5 + 0.5 * Math.sin(TAU * (rate * c.t + hash3(i, 7, 33)));
        var height = (0.40 + 0.62 * hash3(i, 3, 21)) * (0.5 + 0.7 * swing);

        // The exponent is what separates a round arch from a peaked one. Below
        // 1 the crest flattens into a shoulder; above it the arch draws to a
        // point. It runs at its own rate too.
        var srate = 1 + Math.floor(hash3(i, 29, 83) * 3);
        var soft = 0.5 + 1.8 * hash3(i, 11, 45);
        var edge = soft * (0.55 + 0.9 * (0.5 - 0.5 * Math.cos(TAU * (srate * c.t + hash3(i, 13, 57)))));
        var lift = Math.pow(Math.sin(Math.PI * s), Math.max(0.35, edge));

        // Alternating, so consecutive arches read as one wave rather than as a
        // row of bumps. sin() reaches zero at both ends of every arch, so the
        // band is continuous across the joins whatever the exponents do.
        var centre = ((i & 1) ? -1 : 1) * height * lift;

        // A broad band, and one that swells along its own length: the extra
        // TAU * s term walks the bulge through the arch as the cycle turns, so
        // the wave thickens and thins where it stands instead of only rising
        // and falling.
        var brate = 1 + Math.floor(hash3(i, 31, 95) * 3);
        var bulge = 0.72 + 0.5 * (0.5 + 0.5 * Math.sin(TAU * (brate * c.t + hash3(i, 37, 101)) + TAU * s));
        var band = (0.44 + 0.34 * hash3(i, 17, 69)) * bulge;

        return clamp01(0.08 + 1.1 * (1 - smoothstep(band * 0.5, band, Math.abs(fy - centre))));
      }
    },
    {
      id: 'synchronise',
      name: 'Synchronise',
      form: 'Horizontal signals that drift, fall into a shared beat, and part again.',
      blurb: 'Pulses travel at one speed but out of phase, align, hold, then separate.',
      prepare: function (t) {
        // Alignment rises and falls once across the cycle, so the field ends
        // as loose as it began.
        return { sync: 0.5 - 0.5 * Math.cos(TAU * t), t: t };
      },
      at: function (x, y, t, p, c) {
        // Pinned to the lattice: one pattern row per row of dots. Deriving it
        // from anything but the real dot pitch puts the signals between the
        // rows and the field reads as scatter.
        var rowH = p.pitch || 2 / Math.max(4, p.grid);
        var row = Math.floor((y + 4) / rowH);
        // Squeezed towards a shared beat, but only ever towards it. Closing
        // the offsets completely stacks every row's pulse in the same columns
        // and the field turns into vertical bars — the rhythm stops being
        // something you read across a row and becomes a grid.
        var offset = (hash3(row, 2, 8) - 0.5) * 0.85 * (1 - 0.7 * c.sync);
        // Rows also run at slightly different pitches, so their crests cannot
        // line up into columns even at their closest. The coefficient on t is
        // untouched, so every row still completes a whole turn per cycle.
        var rate = 0.66 + 0.34 * hash3(row, 9, 12);
        var pulse = wave(x * 0.8 * rate * p.scale - c.t + offset);
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
