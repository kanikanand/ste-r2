import { generateDots, dotsToSVG } from './generate.js';

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportPNG(params, sampler, style, size, filename) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const dots = generateDots(params, size, sampler);
  if (style.background) {
    ctx.fillStyle = style.background;
    ctx.fillRect(0, 0, size, size);
  }
  if (!style.useGradient) ctx.fillStyle = style.solid;
  for (const d of dots) {
    if (style.useGradient) ctx.fillStyle = d.color;
    ctx.beginPath();
    ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }
  canvas.toBlob((blob) => blob && download(blob, filename));
}

export function exportSVG(params, sampler, style, size, filename) {
  const dots = generateDots(params, size, sampler);
  const svg = dotsToSVG(dots, { ...style, size });
  download(new Blob([svg], { type: 'image/svg+xml' }), filename);
}

export function exportJSON(params, filename) {
  download(new Blob([JSON.stringify(params, null, 2)], { type: 'application/json' }), filename);
}
