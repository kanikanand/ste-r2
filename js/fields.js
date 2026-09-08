/* ============================================================================
 * fields.js — the twelve wave fields.
 *
 * Each preset is a wave: a periodic field over the pattern's own coordinates,
 * returning 0..1. The value at a dot becomes its size, so the waves read as
 * bands, ripples and interference across the whole frame rather than as a
 * shape sitting on it. The descriptions say what the waves do — where they
 * radiate from, how they meet, how they travel — not what outline they draw.
 *
 * Coordinates count in cycles: 1 unit of phase is one full band, so a factor
 * like 2.6 * r means two and a half rings per half-height.
 * ==========================================================================*/
var DG = window.DG || (window.DG = {});

(function (DG) {
  'use strict';

  var TAU = Math.PI * 2;

  DG.clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; };
  var clamp01 = DG.clamp01;

  /*
   * One wave: phase in cycles -> 0..1, as a triangle rather than a sine. A sine
   * spends most of its range near 0 and 1, so dot sizes snap between full and
   * gone; a triangle spreads the values evenly and the sizes grade across the
   * band, which is what makes it read as texture.
   */
  function w(cycles) {
    var t = cycles - Math.floor(cycles);
    return t < 0.5 ? t * 2 : 2 - t * 2;
  }

  /* A gentle large-scale ramp, so a texture can lean without gaining an edge. */
  function ramp(t, lo, hi) {
    var c = t < 0 ? 0 : t > 1 ? 1 : t;
    return lo + (hi - lo) * (c * c * (3 - 2 * c));
  }

  /*
   * Averaging several waves pulls everything towards the middle, so the
   * interference presets stretch the deviation back out around mid-grey.
   */
  function stretch(v, gain) {
    return clamp01(0.5 + (v - 0.5) * gain);
  }

  function dist(x, y, cx, cy) {
    return Math.hypot(x - cx, y - cy);
  }

  DG.PRESETS = [
    {
      id: 'emergence',
      name: 'Emergence',
      subtitle: 'Emerging core',
      blurb: 'Rings radiate from one centre, tightening as they travel out.',
      density: function (x, y) {
        var r = Math.hypot(x, y);
        return w(1.55 * r + 0.3 * r * r) * ramp(1 / (1 + 0.45 * r * r), 0.45, 1);
      }
    },
    {
      id: 'ingenuity',
      name: 'Ingenuity',
      subtitle: 'Soft star',
      blurb: 'The same rings, pulled into five soft points as they spread.',
      density: function (x, y) {
        var r = Math.hypot(x, y);
        var a = Math.atan2(y, x);
        var lean = 0.26 * Math.cos(5 * a - Math.PI / 2) * (r / (0.7 + r));
        return w(1.5 * r + lean);
      }
    },
    {
      id: 'progress',
      name: 'Progress',
      subtitle: 'Directional plume',
      blurb: 'Bowed wavefronts sweep to the right, opening as they go.',
      density: function (x, y) {
        return w(1.3 * (x - 0.28 * y * y)) * ramp((x + 2) / 4, 0.4, 1);
      }
    },
    {
      id: 'convergence',
      name: 'Convergence',
      subtitle: 'Gathering field',
      blurb: 'Four ring sources draw inward, their crests gathering at one centre.',
      density: function (x, y) {
        var s = 0;
        for (var i = 0; i < 3; i++) {
          var a = -Math.PI / 2 + (i * TAU) / 3;
          s += w(0.95 * dist(x, y, Math.cos(a) * 1.5, Math.sin(a) * 1.5));
        }
        s += 1.5 * w(1.2 * Math.hypot(x, y));
        return stretch(s / 4.5, 2.1);
      }
    },
    {
      id: 'expansion',
      name: 'Expansion',
      subtitle: 'Expanding halo',
      blurb: 'Rings widen as they travel outward, the crests growing apart.',
      density: function (x, y) {
        var r = Math.hypot(x, y);
        return w(1.7 * r - 0.24 * r * r) * ramp(r / 1.6, 0.5, 1);
      }
    },
    {
      id: 'adaptation',
      name: 'Adaptation',
      subtitle: 'Flowing saddle',
      blurb: 'Hyperbolic fringes bend through a saddle, rising one way and dipping the other.',
      density: function (x, y) {
        return w(0.72 * (x * x - y * y) + 0.3 * x) * ramp((x + 2.2) / 4.4, 0.5, 1);
      }
    },
    {
      id: 'connection',
      name: 'Connection',
      subtitle: 'Connecting bridge',
      blurb: 'Two sources interfere, their fringes bridging the gap between them.',
      density: function (x, y) {
        var a = w(1.15 * dist(x, y, -1.05, 0));
        var b = w(1.15 * dist(x, y, 1.05, 0));
        return stretch((a + b) / 2, 1.9);
      }
    },
    {
      id: 'collaboration',
      name: 'Collaboration',
      subtitle: 'Interference bloom',
      blurb: 'Two overlapping wave trains beat against each other into a third, denser rhythm.',
      density: function (x, y) {
        var a = w(1.1 * dist(x, y, -0.8, 0.25));
        var b = w(1.1 * dist(x, y, 0.8, -0.25));
        return stretch(0.3 * (a + b) + 0.9 * a * b, 1.5);
      }
    },
    {
      id: 'precision',
      name: 'Precision',
      subtitle: 'Focused lens',
      blurb: 'Tight parallel bands, bowed just enough to read as a lens.',
      density: function (x, y) {
        return w(2 * (y + 0.16 * x * x)) * ramp(1 / (1 + 0.7 * y * y), 0.5, 1);
      }
    },
    {
      id: 'transformation',
      name: 'Transformation',
      subtitle: 'Twisted column',
      blurb: 'Bands turn as they rise, so the grain runs one way above and another below.',
      density: function (x, y) {
        var t = 0.8 * y;
        return w(1.45 * (x * Math.cos(t) + y * Math.sin(t)));
      }
    },
    {
      id: 'synergy',
      name: 'Synergy',
      subtitle: 'Balanced lobes',
      blurb: 'Three sources at equal spacing, their waves settling into one shared weave.',
      density: function (x, y) {
        var s = 0;
        for (var i = 0; i < 3; i++) {
          var a = -Math.PI / 2 + (i * TAU) / 3;
          s += w(0.95 * dist(x, y, Math.cos(a) * 1.25, Math.sin(a) * 1.25));
        }
        return stretch(s / 3, 2.2);
      }
    },
    {
      id: 'momentum',
      name: 'Momentum',
      subtitle: 'Continuous wave',
      blurb: 'A travelling wave train, its bands oscillating across the frame.',
      density: function (x, y) {
        var s = 0.5 * Math.sin(TAU * 0.3 * x);
        return w(1.5 * (y - s)) * ramp(0.5 + 0.5 * Math.cos(TAU * 0.3 * x), 0.55, 1);
      }
    }
  ];

  DG.PRESETS_BY_ID = {};
  DG.PRESETS.forEach(function (p) { DG.PRESETS_BY_ID[p.id] = p; });

  DG.getPreset = function (id) { return DG.PRESETS_BY_ID[id] || DG.PRESETS[0]; };
})(DG);
