/** Palette and colouring. The gradient is the brand ramp: red → slate → ice. */

export const GRADIENT_STOPS = ['#de2027', '#687099', '#c5eef9'];

export const SOLIDS = [
  { id: 'red', label: 'Red', value: '#de2027' },
  { id: 'slate', label: 'Slate', value: '#687099' },
  { id: 'ice', label: 'Ice', value: '#c5eef9' },
  { id: 'white', label: 'White', value: '#ffffff' },
  { id: 'black', label: 'Black', value: '#0a0a0a' },
];

export const BACKGROUNDS = [
  { id: 'black', label: 'Black', value: '#000000' },
  { id: 'ink', label: 'Ink', value: '#12141c' },
  { id: 'paper', label: 'Paper', value: '#f5f2ec' },
  { id: 'white', label: 'White', value: '#ffffff' },
];

/** Which quantity the gradient is mapped along. */
export const GRADIENT_MAPS = [
  { id: 'intensity', label: 'Light' },
  { id: 'x', label: 'Horizontal' },
  { id: 'y', label: 'Vertical' },
  { id: 'radial', label: 'Radial' },
  { id: 'angle', label: 'Angular' },
];

const hexToRgb = (hex) => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const rgbToHex = ([r, g, b]) =>
  '#' + [r, g, b].map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

const STOP_RGB = GRADIENT_STOPS.map(hexToRgb);

/** Sample the three-stop ramp at t (0..1). */
export function sampleGradient(t) {
  const c = t <= 0 ? 0 : t >= 1 ? 1 : t;
  const seg = c * (STOP_RGB.length - 1);
  const i = Math.min(STOP_RGB.length - 2, Math.floor(seg));
  const f = seg - i;
  const a = STOP_RGB[i];
  const b = STOP_RGB[i + 1];
  return rgbToHex([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]);
}

/** Pre-computed ramp so per-dot colouring is a lookup, not a mix. */
export function buildRamp(steps = 96) {
  return Array.from({ length: steps }, (_, i) => sampleGradient(i / (steps - 1)));
}

export const cssGradient = (dir = 'to right') => `linear-gradient(${dir}, ${GRADIENT_STOPS.join(', ')})`;

/** The 0..1 value a dot's gradient position is read from. */
export function gradientCoord(map, dot) {
  switch (map) {
    case 'x':
      return (dot.nx + 1) / 2;
    case 'y':
      return (dot.ny + 1) / 2;
    case 'radial':
      return Math.min(1, Math.hypot(dot.nx, dot.ny) / Math.SQRT2);
    case 'angle':
      return (Math.atan2(dot.ny, dot.nx) + Math.PI) / (Math.PI * 2);
    case 'intensity':
    default:
      return dot.v;
  }
}
