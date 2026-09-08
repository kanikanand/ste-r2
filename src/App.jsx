import { useCallback, useMemo, useRef, useState } from 'react';
import { PRESETS, getPreset } from './lib/fields.js';
import { DEFAULTS } from './lib/generate.js';
import { SOLIDS, BACKGROUNDS } from './lib/color.js';
import { createSampler, loadImageFile } from './lib/image.js';
import { exportPNG, exportSVG, exportJSON } from './lib/exporters.js';
import PatternCanvas from './components/PatternCanvas.jsx';
import PresetThumb from './components/PresetThumb.jsx';
import { Slider, AngleDial, ColourControls } from './components/Controls.jsx';

const colourOf = (id, list, fallback) => (list.find((c) => c.id === id) || fallback).value;

export default function App() {
  const [params, setParams] = useState(DEFAULTS);
  const [image, setImage] = useState(null); // { sampler, url, name }
  const [useImage, setUseImage] = useState(false);
  const [count, setCount] = useState(0);
  const [exportSize, setExportSize] = useState(2000);
  const fileRef = useRef(null);

  const set = useCallback((patch) => setParams((prev) => ({ ...prev, ...patch })), []);
  const preset = getPreset(params.preset);

  const sampler = useImage && image ? image.sampler : undefined;

  const style = useMemo(
    () => ({
      background: colourOf(params.background, BACKGROUNDS, BACKGROUNDS[0]),
      solid: colourOf(params.colorMode, SOLIDS, SOLIDS[0]),
      useGradient: params.colorMode === 'gradient',
    }),
    [params.background, params.colorMode]
  );

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { img, url } = await loadImageFile(file);
      if (image?.url) URL.revokeObjectURL(image.url);
      setImage({ sampler: createSampler(img), url, name: file.name });
      setUseImage(true);
    } catch (err) {
      alert(err.message);
    }
  };

  const clearImage = () => {
    if (image?.url) URL.revokeObjectURL(image.url);
    setImage(null);
    setUseImage(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const stem = `${params.preset}-dotted-grid`;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" />
          <div>
            <h1>Dotted Grid Studio</h1>
            <p>Twelve flow fields · depth through dot size and density</p>
          </div>
        </div>
        <div className="topbar-actions">
          <span className="readout">{count.toLocaleString()} dots</span>
          <select value={exportSize} onChange={(e) => setExportSize(parseInt(e.target.value, 10))}>
            <option value={1000}>1000 px</option>
            <option value={2000}>2000 px</option>
            <option value={4000}>4000 px</option>
          </select>
          <button type="button" onClick={() => exportPNG(params, sampler, style, exportSize, `${stem}.png`)}>
            PNG
          </button>
          <button type="button" onClick={() => exportSVG(params, sampler, style, exportSize, `${stem}.svg`)}>
            SVG
          </button>
          <button type="button" onClick={() => exportJSON(params, `${stem}.json`)}>
            JSON
          </button>
        </div>
      </header>

      <div className="layout">
        <aside className="panel panel-presets">
          <h2>Presets</h2>
          <div className="thumbs">
            {PRESETS.map((p) => (
              <PresetThumb
                key={p.id}
                preset={p}
                params={params}
                style={style}
                active={p.id === params.preset}
                onSelect={(id) => set({ preset: id })}
              />
            ))}
          </div>
        </aside>

        <main className="canvas-area">
          <PatternCanvas params={params} sampler={sampler} style={style} onCount={setCount} />
          <div className="caption">
            <h2>{preset.name}</h2>
            <p>
              <em>{preset.subtitle}</em> — {preset.blurb}
            </p>
          </div>
        </main>

        <aside className="panel panel-controls">
          <section>
            <h2>Grid</h2>
            <Slider
              label="Grid density"
              value={params.grid}
              min={6}
              max={90}
              step={1}
              format={(v) => `${v} × ${v}`}
              onChange={(v) => set({ grid: v })}
            />
            <Slider label="Dot size" value={params.dotScale} min={0.08} max={1.4} onChange={(v) => set({ dotScale: v })} />
            <Slider
              label="Dot size variation"
              value={params.sizeVariation}
              min={0}
              max={1}
              onChange={(v) => set({ sizeVariation: v })}
            />
            <Slider
              label="Depth contrast"
              value={params.contrast}
              min={0.25}
              max={3}
              onChange={(v) => set({ contrast: v })}
            />
            <Slider
              label="Density falloff"
              value={params.densityFade}
              min={0}
              max={1}
              onChange={(v) => set({ densityFade: v })}
            />
            <Slider label="Jitter" value={params.jitter} min={0} max={1} onChange={(v) => set({ jitter: v })} />
            <div className="row">
              <Slider
                label="Seed"
                value={params.seed}
                min={1}
                max={999}
                step={1}
                format={(v) => String(v)}
                onChange={(v) => set({ seed: v })}
              />
              <button type="button" className="ghost" onClick={() => set({ seed: 1 + Math.floor(Math.random() * 999) })}>
                Shuffle
              </button>
            </div>
          </section>

          <section>
            <h2>Flow</h2>
            <AngleDial value={params.flowAngle} onChange={(v) => set({ flowAngle: v })} />
            <Slider
              label="Flow strength"
              value={params.flowStrength}
              min={0}
              max={1.5}
              onChange={(v) => set({ flowStrength: v })}
            />
            <p className="hint">
              At zero the dots sit on a straight lattice. Raise it and they are carried along the field lines of{' '}
              {preset.name.toLowerCase()}.
            </p>
          </section>

          <section>
            <h2>Colour</h2>
            <ColourControls params={params} set={set} />
          </section>

          <section>
            <h2>Image mode</h2>
            <p className="hint">Light in the image drives dot size and density.</p>
            <input ref={fileRef} type="file" accept="image/*" onChange={onFile} />
            {image && (
              <>
                <div className="image-row">
                  <img src={image.url} alt="" />
                  <div>
                    <span className="filename">{image.name}</span>
                    <label className="check">
                      <input type="checkbox" checked={useImage} onChange={(e) => setUseImage(e.target.checked)} />
                      <span>Use image</span>
                    </label>
                    <button type="button" className="ghost" onClick={clearImage}>
                      Remove
                    </button>
                  </div>
                </div>
                <label className="ctrl">
                  <span className="ctrl-head">
                    <span>Combine with field</span>
                  </span>
                  <select value={params.imageBlend} onChange={(e) => set({ imageBlend: e.target.value })}>
                    <option value="replace">Replace field</option>
                    <option value="multiply">Multiply by field</option>
                    <option value="average">Average with field</option>
                  </select>
                </label>
                <Slider
                  label="Image amount"
                  value={params.imageAmount}
                  min={0}
                  max={1}
                  onChange={(v) => set({ imageAmount: v })}
                />
                <label className="check">
                  <input
                    type="checkbox"
                    checked={params.imageInvert}
                    onChange={(e) => set({ imageInvert: e.target.checked })}
                  />
                  <span>Invert light</span>
                </label>
              </>
            )}
          </section>

          <button type="button" className="ghost wide" onClick={() => setParams({ ...DEFAULTS, preset: params.preset })}>
            Reset controls
          </button>
        </aside>
      </div>
    </div>
  );
}
