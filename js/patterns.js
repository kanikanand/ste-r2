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
 * A behaviour may also declare:
 *   prepare(t, p)  work done once per frame — a curve sampled, clusters
 *                  resolved — returned as a context passed to `at`.
 *   offset(...)    a displacement in field units, for the few cases where
 *                  moving a dot says something resizing it cannot.
 *
 * x and y run -1..1 over the frame's height, so a wide frame shows more of the
 * pattern rather than stretching it.
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
      form: 'A directional field growing from fine grain into visual mass.',
      blurb: 'Weight gathers at one corner; a broad swell travels diagonally away from it.',
      at: function (x, y, t, p) {
        // One diagonal coordinate carries both the static falloff and the swell.
        var s = (x + y) * 0.35 * p.scale;
        var mass = clamp01(0.5 - s * 0.55);              // heaviest upper-left
        var swell = wave(s * 0.9 - t);                    // one turn per cycle
        return clamp01(mass * (0.5 + 0.55 * swell) * 1.5);
      }
    },
    {
      id: 'convergence',
      name: 'Convergence',
      form: 'A soft central concentration, like a lens or a gravitational well.',
      blurb: 'The centre inhales — dots swell and draw in, then return.',
      prepare: function (t) {
        // Breath: spread and pull share one slow turn, so the cycle closes
        // exactly where it opened with no snap at either end.
        var breath = 0.5 - 0.5 * Math.cos(TAU * t);
        return { spread: 0.42 + 0.26 * breath, pull: 0.1 * breath };
      },
      at: function (x, y, t, p, c) {
        var d = Math.hypot(x, y) / p.scale;
        return clamp01(0.1 + 1.05 * Math.exp(-(d * d) / (2 * c.spread * c.spread)));
      },
      offset: function (x, y, t, p, c) {
        // Drawn towards the centre in proportion to belonging to it, and capped
        // well inside the gap so neighbours never trade places.
        var d = Math.hypot(x, y) / p.scale;
        var w = Math.exp(-(d * d) / (2 * c.spread * c.spread));
        var k = -c.pull * w;
        return [x * k, y * k];
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
        var n = loopNoise(x * 2.6 * p.scale, y * 2.6 * p.scale, t, 11);
        // A window, not a threshold: dots leave by shrinking, so the lattice
        // loosens instead of flickering out.
        var visible = smoothstep(0.30, 0.52, n);
        return clamp01(0.12 + 1.05 * visible);
      },
      offset: function (x, y, t, p) {
        var n = loopNoise(x * 0.6 * p.scale + 9, y * 0.6 * p.scale - 4, t, 27) - 0.5;
        var m = loopNoise(x * 0.6 * p.scale - 3, y * 0.6 * p.scale + 7, t, 41) - 0.5;
        return [n * 0.055, m * 0.055];
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
      form: 'A flowing, folded ribbon revealed only through changes in dot scale.',
      blurb: 'A winding band flexes across the field; the dots never move, they take turns being heavy.',
      prepare: function (t, p) {
        // A curve whose control points ride whole turns, so it returns exactly.
        var a = TAU * t;
        // Waypoints the band actually passes through. Bezier control points
        // only pull the curve towards themselves, which left the ribbon almost
        // straight; a Catmull-Rom spline goes through them, so the wind reads.
        var pts = [
          [-1.7, -0.55 + 0.2 * Math.sin(a)],
          [-1.05, -0.62 + 0.18 * Math.sin(a)],
          [-0.35, 0.5 + 0.26 * Math.cos(a)],
          [0.35, -0.5 + 0.26 * Math.sin(a)],
          [1.05, 0.62 + 0.18 * Math.cos(a)],
          [1.7, 0.55 + 0.2 * Math.cos(a)]
        ];
        // Sampled once per frame into a polyline; each dot then only needs its
        // distance to that, which is cheap.
        var line = [];
        for (var seg = 1; seg < pts.length - 2; seg++) {
          var p0 = pts[seg - 1];
          var p1 = pts[seg];
          var p2 = pts[seg + 1];
          var p3 = pts[seg + 2];
          for (var i = 0; i < 20; i++) {
            var u = i / 20;
            var u2 = u * u;
            var u3 = u2 * u;
            line.push(
              0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * u +
                (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * u2 +
                (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * u3),
              0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * u +
                (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2 +
                (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * u3)
            );
          }
        }
        return { line: line, width: 0.3 + 0.06 * Math.sin(a) };
      },
      at: function (x, y, t, p, c) {
        var sx = x / p.scale;
        var sy = y / p.scale;
        var best = 1e9;
        var line = c.line;
        for (var i = 0; i < line.length; i += 2) {
          var dx = line[i] - sx;
          var dy = line[i + 1] - sy;
          var d = dx * dx + dy * dy;
          if (d < best) best = d;
        }
        return clamp01(0.08 + 1.05 * (1 - smoothstep(0, c.width, Math.sqrt(best))));
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
        // Pinned to the lattice: one pattern row per row of dots, or the
        // signals fall between them and the field reads as scatter.
        var rowH = 2 / Math.max(4, p.grid);
        var row = Math.floor((y + 4) / rowH);
        var offset = (hash3(row, 2, 8) - 0.5) * 0.85 * (1 - c.sync);  // squeezed out as they lock
        var pulse = wave(x * 1.35 * p.scale - c.t + offset);
        // Long pulses, short dashes and quiet stretches within each row.
        // Each row shaped differently: some long pulses, some short dashes,
        // some barely there.
        // Rows differ in how long their pulses run, not in how hard they snap:
        // sharpen too far and the runs break into isolated dots.
        var shape = hash3(row, 6, 4);
        return clamp01(Math.pow(pulse, 0.75 + 1.5 * shape) * 1.3);
      }
    }
  ];

  DG.PATTERNS_BY_ID = {};
  DG.PATTERNS.forEach(function (p) { DG.PATTERNS_BY_ID[p.id] = p; });
  DG.getPattern = function (id) { return DG.PATTERNS_BY_ID[id] || DG.PATTERNS[0]; };
})(DG);
