import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { generateDots, renderDots } from '../lib/generate.js';

/** The main stage: a square canvas that redraws whenever anything changes. */
export default function PatternCanvas({ params, sampler, style, onCount }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [size, setSize] = useState(720);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => {
      const box = entry.contentRect;
      setSize(Math.max(160, Math.floor(Math.min(box.width, box.height))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const dots = generateDots(params, size, sampler);
    renderDots(ctx, dots, { ...style, size });
    onCount?.(dots.length);
  }, [params, sampler, style, size, onCount]);

  return (
    <div className="stage" ref={wrapRef}>
      <canvas ref={canvasRef} className="stage-canvas" />
    </div>
  );
}
