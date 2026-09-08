import { useEffect, useRef } from 'react';
import { generateDots, renderDots } from '../lib/generate.js';

const THUMB = 132;

/**
 * A small live preview of one preset, drawn with the current settings. It
 * always shows the preset's own field — never the uploaded image — so the
 * gallery stays readable as a field picker while image mode is on.
 */
export default function PresetThumb({ preset, params, style, active, onSelect }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = THUMB * dpr;
    canvas.height = THUMB * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const thumbParams = { ...params, preset: preset.id, grid: Math.min(26, params.grid) };
    renderDots(ctx, generateDots(thumbParams, THUMB), { ...style, size: THUMB });
  }, [preset, params, style]);

  return (
    <button
      type="button"
      className={`thumb${active ? ' is-active' : ''}`}
      onClick={() => onSelect(preset.id)}
      title={preset.blurb}
    >
      <canvas ref={ref} style={{ width: THUMB, height: THUMB }} />
      <span className="thumb-name">{preset.name}</span>
      <span className="thumb-sub">{preset.subtitle}</span>
    </button>
  );
}
