import { clamp01, flowAt, getPreset } from './fields.js';
import { buildRamp, gradientCoord } from './color.js';

export const DEFAULTS = {
  preset: 'emergence',
  grid: 34, // dots across
  dotScale: 0.72, // largest dot as a fraction of a cell
  sizeVariation: 0.85, // extent of the difference between small and large dots
  contrast: 1.0, // gamma on the field before it becomes size
  densityFade: 0.2, // how much the field thins the grid out
  flowAngle: 0, // degrees added to every field line
  flowStrength: 0, // how far dots are carried along the flow
  jitter: 0, // random offset within the cell
  seed: 1,
  colorMode: 'red', // a solid id, or 'gradient'
  gradientMap: 'intensity',
  gradientReverse: false,
  background: 'black',
  // Image mode
  imageBlend: 'replace', // replace | multiply | average
  imageInvert: false,
  imageAmount: 1,
};

const FLOW_STEPS = 6;

/** Keep advected dots inside the square by wrapping them round. */
const wrap = (v) => {
  let t = (v + 1) % 2;
  if (t < 0) t += 2;
  return t - 1;
};

/** Deterministic per-cell noise, so a given seed always redraws identically. */
function hash2(i, j, seed) {
  let h = Math.imul(i, 0x27d4eb2d) + Math.imul(j, 0x165667b1) + Math.imul(seed, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/**
 * Build the dot list for a square of `size` pixels.
 *
 * `sampler(nx, ny) -> 0..1` is the optional image source; when present it is
 * combined with the preset field according to `imageBlend`.
 */
export function generateDots(params, size, sampler) {
  const p = { ...DEFAULTS, ...params };
  const preset = getPreset(p.preset);
  const cols = Math.max(2, Math.round(p.grid));
  const cell = size / cols;
  const maxR = (cell / 2) * p.dotScale;
  const norm = 2 / cols; // one cell in field space
  const stepLen = (p.flowStrength * norm * 3) / FLOW_STEPS;
  const angleOffset = (p.flowAngle * Math.PI) / 180;
  const ramp = buildRamp();
  const useGradient = p.colorMode === 'gradient';

  const field = (nx, ny) => {
    const base = preset.density(nx, ny);
    if (!sampler) return base;
    let img = sampler(nx, ny);
    if (p.imageInvert) img = 1 - img;
    let v;
    if (p.imageBlend === 'multiply') v = img * base;
    else if (p.imageBlend === 'average') v = (img + base) / 2;
    else v = img;
    return clamp01(base + (v - base) * p.imageAmount);
  };

  const dots = [];
  for (let j = 0; j < cols; j++) {
    for (let i = 0; i < cols; i++) {
      let nx = ((i + 0.5) / cols) * 2 - 1;
      let ny = ((j + 0.5) / cols) * 2 - 1;

      if (p.jitter > 0) {
        nx += (hash2(i, j, p.seed) - 0.5) * norm * p.jitter;
        ny += (hash2(i, j, p.seed + 991) - 0.5) * norm * p.jitter;
      }

      // Carry the dot along the field lines, wrapping so the frame stays full.
      if (stepLen !== 0) {
        for (let s = 0; s < FLOW_STEPS; s++) {
          const a = flowAt(preset, nx, ny) + angleOffset;
          nx += Math.cos(a) * stepLen;
          ny += Math.sin(a) * stepLen;
        }
        nx = wrap(nx);
        ny = wrap(ny);
      }

      const raw = clamp01(field(nx, ny));
      const v = Math.pow(raw, p.contrast);

      // Density: the darker the field, the more likely the dot is dropped.
      const keep = 1 - p.densityFade * (1 - v);
      if (hash2(i, j, p.seed + 7717) > keep) continue;

      const r = maxR * (1 - p.sizeVariation + p.sizeVariation * v);
      if (r < 0.12) continue;

      const dot = {
        x: ((nx + 1) / 2) * size,
        y: ((ny + 1) / 2) * size,
        r,
        v,
        nx,
        ny,
      };
      if (useGradient) {
        let t = gradientCoord(p.gradientMap, dot);
        if (p.gradientReverse) t = 1 - t;
        dot.color = ramp[Math.min(ramp.length - 1, Math.max(0, Math.round(t * (ramp.length - 1))))];
      }
      dots.push(dot);
    }
  }
  return dots;
}

/** Paint the dots onto a 2D context already sized to `size` logical pixels. */
export function renderDots(ctx, dots, { size, background, solid, useGradient }) {
  ctx.save();
  ctx.clearRect(0, 0, size, size);
  if (background) {
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, size, size);
  }
  if (!useGradient) ctx.fillStyle = solid;
  for (const d of dots) {
    if (useGradient) ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Same drawing, as a standalone SVG document. */
export function dotsToSVG(dots, { size, background, solid, useGradient }) {
  const body = dots
    .map(
      (d) =>
        `<circle cx="${d.x.toFixed(2)}" cy="${d.y.toFixed(2)}" r="${d.r.toFixed(2)}"${
          useGradient ? ` fill="${d.color}"` : ''
        }/>`
    )
    .join('');
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    background ? `<rect width="${size}" height="${size}" fill="${background}"/>` : '',
    `<g${useGradient ? '' : ` fill="${solid}"`}>${body}</g>`,
    `</svg>`,
  ].join('');
}
