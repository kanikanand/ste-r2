/**
 * Image mode. The uploaded picture is cover-fitted into the square and read
 * back as luminance, so light in the photograph becomes dot size and density.
 */
const RES = 384;

export function createSampler(img) {
  const canvas = document.createElement('canvas');
  canvas.width = RES;
  canvas.height = RES;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, RES, RES);

  const scale = Math.max(RES / img.naturalWidth, RES / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  ctx.drawImage(img, (RES - w) / 2, (RES - h) / 2, w, h);

  const { data } = ctx.getImageData(0, 0, RES, RES);
  const lum = new Float32Array(RES * RES);
  for (let i = 0; i < lum.length; i++) {
    const o = i * 4;
    lum[i] = (0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) / 255;
  }

  return (nx, ny) => {
    const px = Math.round(((nx + 1) / 2) * (RES - 1));
    const py = Math.round(((ny + 1) / 2) * (RES - 1));
    if (px < 0 || py < 0 || px >= RES || py >= RES) return 0;
    return lum[py * RES + px];
  };
}

export function loadImageFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ img, url });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that image.'));
    };
    img.src = url;
  });
}
