/* ============================================================================
 * app.js — application state, layout and mount.
 * ==========================================================================*/
var DG = window.DG || (window.DG = {});

(function (DG) {
  'use strict';

  var html = DG.html;
  var useState = React.useState;
  var useCallback = React.useCallback;
  var useMemo = React.useMemo;
  var useRef = React.useRef;

  function colourOf(id, list, fallback) {
    for (var i = 0; i < list.length; i++) if (list[i].id === id) return list[i].value;
    return fallback.value;
  }

  function App() {
    var paramsState = useState(DG.DEFAULTS);
    var params = paramsState[0];
    var setParams = paramsState[1];
    var imageState = useState(null); // { sampler, url, name }
    var image = imageState[0];
    var setImage = imageState[1];
    var useImageState = useState(false);
    var useImage = useImageState[0];
    var setUseImage = useImageState[1];
    var countState = useState(0);
    var count = countState[0];
    var setCount = countState[1];
    var exportSizeState = useState(2000);
    var exportSize = exportSizeState[0];
    var setExportSize = exportSizeState[1];
    var fileRef = useRef(null);

    var set = useCallback(function (patch) {
      setParams(function (prev) { return Object.assign({}, prev, patch); });
    }, []);

    var preset = DG.getPreset(params.preset);
    var sampler = useImage && image ? image.sampler : undefined;

    var style = useMemo(function () {
      return {
        background: colourOf(params.background, DG.BACKGROUNDS, DG.BACKGROUNDS[0]),
        solid: colourOf(params.colorMode, DG.SOLIDS, DG.SOLIDS[0]),
        useGradient: params.colorMode === 'gradient',
        shape: params.shape
      };
    }, [params.background, params.colorMode, params.shape]);

    function onFile(e) {
      var file = e.target.files && e.target.files[0];
      if (!file) return;
      DG.loadImageFile(file).then(function (res) {
        if (image && image.url) URL.revokeObjectURL(image.url);
        setImage({ sampler: DG.createSampler(res.img), url: res.url, name: file.name });
        setUseImage(true);
      }).catch(function (err) { alert(err.message); });
    }

    function clearImage() {
      if (image && image.url) URL.revokeObjectURL(image.url);
      setImage(null);
      setUseImage(false);
      if (fileRef.current) fileRef.current.value = '';
    }

    var stem = params.preset + '-dots';
    var exportHeight = Math.round(exportSize / DG.frameRatio(params.frame));

    return html`
      <div class="app">
        <header class="topbar">
          <div class="brand">
            <span class="brand-mark"></span>
            <div>
              <h1>Dotted Grid Studio</h1>
              <p>Twelve wave textures · dot size mapped to the wave</p>
            </div>
          </div>
          <div class="topbar-actions">
            <span class="readout">${count.toLocaleString()} dots · ${exportSize} × ${exportHeight}</span>
            <select value=${exportSize} onChange=${function (e) { setExportSize(parseInt(e.target.value, 10)); }}>
              <option value=${1200}>1200 px wide</option>
              <option value=${2000}>2000 px wide</option>
              <option value=${3200}>3200 px wide</option>
            </select>
            <button type="button" class="primary"
              onClick=${function () { DG.exportSVG(params, sampler, style, exportSize, stem + '.svg'); }}>
              Download SVG
            </button>
            <button type="button" onClick=${function () { DG.exportPNG(params, sampler, style, exportSize, stem + '.png'); }}>PNG</button>
            <button type="button" onClick=${function () { DG.exportJSON(params, stem + '.json'); }}>JSON</button>
          </div>
        </header>

        <div class="layout">
          <aside class="panel panel-presets">
            <h2>Waves</h2>
            <div class="thumbs">
              ${DG.PRESETS.map(function (p) {
                return html`
                  <${DG.PresetThumb}
                    key=${p.id}
                    preset=${p}
                    params=${params}
                    style=${style}
                    active=${p.id === params.preset}
                    onSelect=${function (id) { set({ preset: id }); }}
                  />`;
              })}
            </div>
          </aside>

          <main class="canvas-area">
            <${DG.PatternCanvas} params=${params} sampler=${sampler} style=${style} onCount=${setCount} />
            <div class="caption">
              <h2>${preset.name}</h2>
              <p><em>${preset.subtitle}</em> — ${preset.blurb}</p>
            </div>
          </main>

          <aside class="panel panel-controls">
            <section>
              <h2>Dots</h2>
              <${DG.Choice} label="Depth from" value=${params.depth}
                options=${[
                  { id: 'spacing', label: 'Spacing — same size, tone from packing' },
                  { id: 'size', label: 'Size — halftone' }
                ]}
                onChange=${function (v) { set({ depth: v }); }} />
              <${DG.Choice} label="Mark" value=${params.shape}
                options=${[
                  { id: 'circle', label: 'Circle' },
                  { id: 'square', label: 'Square' }
                ]}
                onChange=${function (v) { set({ shape: v }); }} />
              <${DG.Slider} label="Grid density" value=${params.grid} min=${8} max=${140} step=${1}
                format=${function (v) { return v + ' across'; }}
                onChange=${function (v) { set({ grid: v }); }} />
              <${DG.Slider} label="Mark size" value=${params.dotScale} min=${0.1} max=${1.6}
                onChange=${function (v) { set({ dotScale: v }); }} />
              ${params.depth === 'spacing'
                ? html`<${DG.Slider} label="Gathering" value=${params.spacingRange} min=${0} max=${1}
                    onChange=${function (v) { set({ spacingRange: v }); }} />`
                : html`<${DG.Slider} label="Size variation" value=${params.sizeVariation} min=${0} max=${1}
                    onChange=${function (v) { set({ sizeVariation: v }); }} />`}
              <${DG.Slider} label="Contrast" value=${params.contrast} min=${0.3} max=${3}
                onChange=${function (v) { set({ contrast: v }); }} />
              ${params.depth === 'size' && html`
                <div class="row">
                  <${DG.Slider} label="Scatter" value=${params.scatter} min=${0} max=${1}
                    onChange=${function (v) { set({ scatter: v }); }} />
                  <button type="button" class="ghost"
                    onClick=${function () { set({ seed: 1 + Math.floor(Math.random() * 999) }); }}>Shuffle</button>
                </div>`}
              <p class="hint">
                ${params.depth === 'spacing'
                  ? 'Every mark is the same size. Gathering is how far the wave pulls them onto its crests, so the packing carries the tone.'
                  : 'Size variation is how much bigger a crest dot is than a trough dot. Scatter drops dots out of the troughs.'}
              </p>
            </section>

            <section>
              <h2>Wave</h2>
              <${DG.Slider} label="Wave scale" value=${params.waveScale} min=${0.2} max=${3}
                onChange=${function (v) { set({ waveScale: v }); }} />
              <${DG.AngleDial} value=${params.angle} onChange=${function (v) { set({ angle: v }); }} />
              <span class="ctrl-label">Frame</span>
              <div class="chips">
                ${DG.FRAMES.map(function (f) {
                  return html`
                    <button key=${f.id} type="button"
                      class=${'chip' + (params.frame === f.id ? ' is-active' : '')}
                      onClick=${function () { set({ frame: f.id }); }}>${f.label}</button>`;
                })}
              </div>
            </section>

            <section>
              <h2>Colour</h2>
              <${DG.ColourControls} params=${params} set=${set} />
            </section>

            <section>
              <h2>Image mode</h2>
              <p class="hint">Optional. Light in an image drives dot size instead of the pattern.</p>
              <input ref=${fileRef} type="file" accept="image/*" onChange=${onFile} />
              ${image && html`
                <${React.Fragment}>
                  <div class="image-row">
                    <img src=${image.url} alt="" />
                    <div>
                      <span class="filename">${image.name}</span>
                      <label class="check">
                        <input type="checkbox" checked=${useImage}
                          onChange=${function (e) { setUseImage(e.target.checked); }} />
                        <span>Use image</span>
                      </label>
                      <button type="button" class="ghost" onClick=${clearImage}>Remove</button>
                    </div>
                  </div>
                  <${DG.Choice} label="Combine with pattern" value=${params.imageBlend}
                    options=${[
                      { id: 'replace', label: 'Image only' },
                      { id: 'multiply', label: 'Image inside the pattern' }
                    ]}
                    onChange=${function (v) { set({ imageBlend: v }); }} />
                  <label class="check">
                    <input type="checkbox" checked=${params.imageInvert}
                      onChange=${function (e) { set({ imageInvert: e.target.checked }); }} />
                    <span>Invert light</span>
                  </label>
                <//>`}
            </section>

            <button type="button" class="ghost wide"
              onClick=${function () { setParams(Object.assign({}, DG.DEFAULTS, { preset: params.preset })); }}>
              Reset controls
            </button>
          </aside>
        </div>
      </div>`;
  }

  DG.App = App;

  ReactDOM.createRoot(document.getElementById('root')).render(html`<${App} />`);
})(DG);
