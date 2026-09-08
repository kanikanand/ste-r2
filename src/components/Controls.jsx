import { useCallback, useRef } from 'react';
import { SOLIDS, BACKGROUNDS, GRADIENT_MAPS, cssGradient } from '../lib/color.js';

export function Slider({ label, value, min, max, step = 0.01, format, onChange }) {
  return (
    <label className="ctrl">
      <span className="ctrl-head">
        <span>{label}</span>
        <span className="ctrl-val">{format ? format(value) : value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}

/** Drag-anywhere dial for the direction the field lines run. */
export function AngleDial({ value, onChange }) {
  const ref = useRef(null);

  const pick = useCallback(
    (e) => {
      const el = ref.current;
      if (!el) return;
      const box = el.getBoundingClientRect();
      const dx = e.clientX - (box.left + box.width / 2);
      const dy = e.clientY - (box.top + box.height / 2);
      let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (deg < 0) deg += 360;
      onChange(Math.round(deg));
    },
    [onChange]
  );

  const start = (e) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    pick(e);
  };

  const rad = (value * Math.PI) / 180;
  const cx = 30 + Math.cos(rad) * 21;
  const cy = 30 + Math.sin(rad) * 21;

  return (
    <div className="dial-row">
      <svg
        ref={ref}
        className="dial"
        viewBox="0 0 60 60"
        width="60"
        height="60"
        onPointerDown={start}
        onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && pick(e)}
        role="slider"
        aria-label="Angle of flow"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={359}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange((value + 355) % 360);
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange((value + 5) % 360);
        }}
      >
        <circle cx="30" cy="30" r="27" className="dial-ring" />
        <line x1="30" y1="30" x2={cx} y2={cy} className="dial-needle" />
        <circle cx={cx} cy={cy} r="4" className="dial-knob" />
      </svg>
      <div className="dial-meta">
        <span className="ctrl-label">Angle of flow</span>
        <input
          type="number"
          min="0"
          max="359"
          value={value}
          onChange={(e) => onChange(((parseInt(e.target.value, 10) || 0) % 360 + 360) % 360)}
        />
        <span className="unit">deg</span>
      </div>
    </div>
  );
}

export function ColourControls({ params, set }) {
  const isGradient = params.colorMode === 'gradient';
  return (
    <>
      <span className="ctrl-label">Dot colour</span>
      <div className="swatches">
        {SOLIDS.map((s) => (
          <button
            key={s.id}
            type="button"
            title={s.label}
            className={`swatch${params.colorMode === s.id ? ' is-active' : ''}`}
            style={{ background: s.value }}
            onClick={() => set({ colorMode: s.id })}
          />
        ))}
        <button
          type="button"
          title="Gradient: #de2027 → #687099 → #c5eef9"
          className={`swatch swatch-wide${isGradient ? ' is-active' : ''}`}
          style={{ background: cssGradient() }}
          onClick={() => set({ colorMode: 'gradient' })}
        />
      </div>

      {isGradient && (
        <div className="sub-block">
          <label className="ctrl">
            <span className="ctrl-head">
              <span>Gradient mapped to</span>
            </span>
            <select value={params.gradientMap} onChange={(e) => set({ gradientMap: e.target.value })}>
              {GRADIENT_MAPS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={params.gradientReverse}
              onChange={(e) => set({ gradientReverse: e.target.checked })}
            />
            <span>Reverse ramp</span>
          </label>
        </div>
      )}

      <span className="ctrl-label">Background</span>
      <div className="swatches">
        {BACKGROUNDS.map((b) => (
          <button
            key={b.id}
            type="button"
            title={b.label}
            className={`swatch${params.background === b.id ? ' is-active' : ''}`}
            style={{ background: b.value }}
            onClick={() => set({ background: b.id })}
          />
        ))}
      </div>
    </>
  );
}
