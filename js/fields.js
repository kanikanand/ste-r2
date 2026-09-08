/* ============================================================================
 * fields.js — the twelve fields.
 *
 * Every preset is described by two functions in a normalised square where
 * x and y run from -1 to 1:
 *
 *   density(x, y) -> 0..1   how much "light" is at this point. It drives dot
 *                           size and dot density, which is what reads as depth.
 *   flow(x, y)    -> angle  the direction the field lines run at this point.
 *                           Dot placement is advected along it, so the lattice
 *                           streams with the form instead of sitting square.
 *
 * A preset can omit `flow`, in which case the direction falls back to the
 * tangent of the density contour through that point (see flowAt below), which
 * makes the dots trace the shape's own iso-lines.
 * ==========================================================================*/
var DG = window.DG || (window.DG = {});

(function (DG) {
  'use strict';

  const TAU = Math.PI * 2;

var clamp01 = DG.clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

const gauss = (d, s) => Math.exp(-(d * d) / (2 * s * s));

/*
 * Soft ceiling. A hard clamp flattens the top of a form into a plateau with no
 * gradient, which leaves contour lines nothing to follow — they collapse into
 * straight stripes. This is the identity below 0.8 and eases onto 1 above it,
 * so a peak always has a little slope left.
 */
const sat = (v) => (v <= 0.8 ? (v < 0 ? 0 : v) : 1 - 0.2 * Math.exp(-(v - 0.8) / 0.2));

const smoothstep = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};

const blob = (x, y, cx, cy, s) => gauss(Math.hypot(x - cx, y - cy), s);

/** Gaussian lobe with its own orientation and aspect. */
const lobe = (x, y, cx, cy, ang, sx, sy) => {
  const dx = x - cx;
  const dy = y - cy;
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const u = dx * c + dy * s;
  const v = -dx * s + dy * c;
  return Math.exp(-((u * u) / (2 * sx * sx) + (v * v) / (2 * sy * sy)));
};

/** Distance from a point to a line segment — used for the channels and necks. */
const segDist = (x, y, ax, ay, bx, by) => {
  const dx = bx - ax;
  const dy = by - ay;
  const l2 = dx * dx + dy * dy;
  const t = l2 ? clamp01(((x - ax) * dx + (y - ay) * dy) / l2) : 0;
  return Math.hypot(x - (ax + dx * t), y - (ay + dy * t));
};

var PRESETS = DG.PRESETS = [
  {
    id: 'emergence',
    name: 'Emergence',
    subtitle: 'Emerging core',
    blurb: 'A concentrated circular field.',
    density(x, y) {
      const r = Math.hypot(x, y);
      return sat(gauss(r, 0.3) + gauss(r, 0.66) * 0.42);
    },
    // Radiating outward from the core.
    flow: (x, y) => Math.atan2(y, x),
  },
  {
    id: 'ingenuity',
    name: 'Ingenuity',
    subtitle: 'Soft star',
    blurb: 'A rounded central mass stretches into five soft points.',
    density(x, y) {
      const r = Math.hypot(x, y);
      const a = Math.atan2(y, x);
      const R = 0.5 + 0.26 * Math.cos(5 * a - Math.PI / 2);
      const points = smoothstep(R + 0.2, R - 0.22, r); // the five soft points
      const core = gauss(r, 0.3); // the simple circle they grow out of
      return sat(points * 0.8 + core * 0.62);
    },
    flow: (x, y) => Math.atan2(y, x),
  },
  {
    id: 'progress',
    name: 'Progress',
    subtitle: 'Directional plume',
    blurb: 'A right-moving diffused plume, as if zooming in on one of the points.',
    density(x, y) {
      const t = clamp01((x + 1) / 2);
      const w = 0.09 + 0.6 * Math.pow(t, 1.35); // widens downstream
      const core = gauss(y, w);
      const start = smoothstep(-1.1, -0.72, x);
      const fade = 1 - 0.62 * smoothstep(0.2, 1.15, x);
      const packing = 0.5 + 0.7 * (1 - t); // tightest at the source
      return sat(core * start * fade * packing * 1.5);
    },
    // Streaming right, fanning out as it goes.
    flow: (x, y) => Math.atan2(y * 0.55 * clamp01((x + 1) / 2), 1),
  },
  {
    id: 'convergence',
    name: 'Convergence',
    subtitle: 'Gathering field',
    blurb: 'Soft concentrations draw inward to one shared centre through subtle channels.',
    density(x, y) {
      let s = 1.25 * gauss(Math.hypot(x, y), 0.22);
      for (let i = 0; i < 5; i++) {
        const a = -Math.PI / 2 + (i * TAU) / 5;
        const cx = Math.cos(a) * 0.64;
        const cy = Math.sin(a) * 0.64;
        s += blob(x, y, cx, cy, 0.2);
        s += 0.4 * gauss(segDist(x, y, cx, cy, 0, 0), 0.07); // channel
      }
      return sat(s * 0.78);
    },
    // Everything falls toward the centre.
    flow: (x, y) => Math.atan2(-y, -x),
  },
  {
    id: 'expansion',
    name: 'Expansion',
    subtitle: 'Expanding halo',
    blurb: 'A broad ring of larger dots surrounds a small, deep central point.',
    density(x, y) {
      const r = Math.hypot(x, y);
      const ring = gauss(r - 0.62, 0.16);
      const core = 0.85 * gauss(r, 0.085);
      const inner = 0.22 * gauss(r, 0.36);
      return sat(ring + core + inner);
    },
    // Tangential: the halo rolls around the centre.
    flow: (x, y) => Math.atan2(y, x) + Math.PI / 2,
  },
  {
    id: 'adaptation',
    name: 'Adaptation',
    subtitle: 'Flowing saddle',
    blurb: 'A continuous undulating form rises on one side and dips, diffused, on the other.',
    density(x, y) {
      const s = 1.1 * (x * x - y * y) + 0.3 * x; // saddle, tilted to rise on the right
      const rise = smoothstep(-0.15, 0.85, s);
      const dip = 0.26 * smoothstep(0.0, -0.9, s); // the diffused side
      const flex = 0.82 + 0.28 * Math.sin(x * 2.4 + y * 2.0);
      const mask = gauss(Math.hypot(x * 0.92, y), 0.82);
      return sat((rise * flex + dip) * mask * 1.35);
    },
    // Contour tangent of the saddle — flows around the pass.
  },
  {
    id: 'connection',
    name: 'Connection',
    subtitle: 'Connecting bridge',
    blurb: 'Two rounded masses joined by a narrow dotted neck.',
    density(x, y) {
      const a = blob(x, y, -0.52, 0, 0.3);
      const b = blob(x, y, 0.52, 0, 0.3);
      const neck = 0.62 * gauss(segDist(x, y, -0.52, 0, 0.52, 0), 0.08);
      return sat(a + b + neck);
    },
    // Along the bridge, curving into each mass.
    flow: (x, y) => Math.atan2(y * 0.8 * Math.abs(x), 1),
  },
  {
    id: 'collaboration',
    name: 'Collaboration',
    subtitle: 'Interference bloom',
    blurb: 'Two overlapping fields make a third, denser formation where they meet.',
    density(x, y) {
      const a = blob(x, y, -0.36, 0.12, 0.4);
      const b = blob(x, y, 0.36, -0.12, 0.4);
      return sat(0.7 * (a + b) + 1.7 * a * b);
    },
    // Contour tangent — the two fields braid around the overlap.
  },
  {
    id: 'precision',
    name: 'Precision',
    subtitle: 'Focused lens',
    blurb: 'A flattened ellipse concentrating into a tight central band with graduated edges.',
    density(x, y) {
      const e = Math.hypot(x / 0.98, y / 0.44);
      const body = 0.5 * smoothstep(1.2, 0.2, e);
      const band = 0.95 * gauss(y, 0.1) * gauss(x, 0.6);
      return sat(body + band);
    },
    flow: () => 0, // strictly horizontal, held under control
  },
  {
    id: 'transformation',
    name: 'Transformation',
    subtitle: 'Twisted column',
    blurb: 'A vertical form narrows and turns at its midpoint into differently oriented lobes.',
    density(x, y) {
      const up = lobe(x, y, 0, 0.5, 0.62, 0.36, 0.17);
      const dn = lobe(x, y, 0, -0.5, -0.62, 0.36, 0.17);
      const waist = 0.7 * gauss(x, 0.075) * gauss(y, 0.45);
      return sat(up + dn + waist);
    },
    // Vertical, twisting as it passes the waist.
    flow: (x, y) => Math.PI / 2 + 0.85 * Math.tanh(y * 2.2),
  },
  {
    id: 'synergy',
    name: 'Synergy',
    subtitle: 'Balanced lobes',
    blurb: 'Rounded volumes gather around a shared centre, distinct but coherent.',
    density(x, y) {
      let s = 0;
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i * TAU) / 3;
        s += blob(x, y, Math.cos(a) * 0.5, Math.sin(a) * 0.5, 0.25);
      }
      s += 0.3 * gauss(Math.hypot(x, y), 0.26); // the shared centre
      return sat(s * 0.88);
    },
    // A gentle shared swirl holds the lobes together.
    flow: (x, y) => Math.atan2(y, x) + Math.PI * 0.42,
  },
  {
    id: 'momentum',
    name: 'Momentum',
    subtitle: 'Continuous wave',
    blurb: 'A stretched, oscillating ribbon carrying alternating concentrations across the frame.',
    density(x, y) {
      const k = 4.2;
      const y0 = 0.36 * Math.sin(x * k);
      const band = gauss(y - y0, 0.2);
      const pulse = 0.5 + 0.5 * (0.5 + 0.5 * Math.cos(x * k * 1.4)); // alternating
      const ends = 1 - 0.5 * smoothstep(0.75, 1.2, Math.abs(x));
      return sat(band * pulse * ends * 1.3);
    },
    // Tangent of the ribbon itself.
    flow: (x) => Math.atan(0.36 * 4.2 * Math.cos(x * 4.2)),
  },
];

DG.PRESETS_BY_ID = Object.fromEntries(PRESETS.map(function (p) { return [p.id, p]; }));

DG.getPreset = function (id) { return DG.PRESETS_BY_ID[id] || PRESETS[0]; };

/**
 * Direction of the field line at a point. Presets that define their own `flow`
 * use it; the rest follow the tangent of their density contour, found from a
 * small central difference.
 */
DG.flowAt = function flowAt(preset, x, y) {
  if (preset.flow) return preset.flow(x, y);
  const h = 0.02;
  const gx = preset.density(x + h, y) - preset.density(x - h, y);
  const gy = preset.density(x, y + h) - preset.density(x, y - h);
  if (gx === 0 && gy === 0) return 0;
  return Math.atan2(gy, gx) + Math.PI / 2;
};
})(DG);
