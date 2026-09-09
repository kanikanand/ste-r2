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
    var exportSizeState = useState(2560);
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
        useGradient: params.colorMode === 'gradient'
      };
    }, [params.background, params.colorMode]);

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

    var stem = params.preset + '-dotted-grid';

    return html`
      <div class="app">
        <header class="topbar">
          <div class="brand">
            <span class="brand-mark"></span>
            <div>
              <h1>Dotted Grid Studio</h1>
              <p>Twelve flow fields · depth through dot size and density</p>
            </div>
          </div>
          <div class="topbar-actions">
            <span class="readout">${count.toLocaleString()} dots</span>
            <select
              value=${exportSize}
              onChange=${function (e) { setExportSize(parseInt(e.target.value, 10)); }}
            >
              <option value=${1600}>1600 × 900</option>
              <option value=${2560}>2560 × 1440</option>
              <option value=${3840}>3840 × 2160</option>
            </select>
            <button type="button" onClick=${function () { DG.exportPNG(params, sampler, style, exportSize, stem + '.png'); }}>PNG</button>
            <button type="button" onClick=${function () { DG.exportSVG(params, sampler, style, exportSize, stem + '.svg'); }}>SVG</button>
            <button type="button" onClick=${function () { DG.exportJSON(params, stem + '.json'); }}>JSON</button>
          </div>
        </header>

        <div class="layout">
          <aside class="panel panel-presets">
            <h2>Presets</h2>
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
              <h2>Grid</h2>
              <${DG.Slider} label="Point density" value=${params.pointDensity} min=${6} max=${120} step=${1}
                format=${function (v) { return v + ' across'; }}
                onChange=${function (v) { set({ pointDensity: v }); }} />
              <${DG.Slider} label="Dot size" value=${params.dotScale} min=${0.08} max=${1.4}
                onChange=${function (v) { set({ dotScale: v }); }} />
              <${DG.Slider} label="Dot size variation" value=${params.sizeVariation} min=${0} max=${1}
                onChange=${function (v) { set({ sizeVariation: v }); }} />
              <${DG.Slider} label="Depth contrast" value=${params.contrast} min=${0.25} max=${3}
                onChange=${function (v) { set({ contrast: v }); }} />
              <${DG.Slider} label="Density falloff" value=${params.densityFade} min=${0} max=${1}
                onChange=${function (v) { set({ densityFade: v }); }} />
              <div class="row">
                <${DG.Slider} label="Seed" value=${params.seed} min=${1} max=${999} step=${1}
                  format=${function (v) { return String(v); }}
                  onChange=${function (v) { set({ seed: v }); }} />
                <button type="button" class="ghost"
                  onClick=${function () { set({ seed: 1 + Math.floor(Math.random() * 999) }); }}>Shuffle</button>
              </div>
            </section>

            <section>
              <h2>Wave</h2>
              <${DG.Slider} label="Wave height" value=${params.waveHeight} min=${0} max=${1.4}
                onChange=${function (v) { set({ waveHeight: v }); }} />
              <${DG.Choice} label="Displacement" value=${params.waveMode}
                options=${[
                  { id: 'ridge', label: 'Ridge — rows ride over the form' },
                  { id: 'bulge', label: 'Bulge — rows open around it' }
                ]}
                onChange=${function (v) { set({ waveMode: v }); }} />
              <label class="check">
                <input type="checkbox" checked=${params.hideBehind}
                  onChange=${function (e) { set({ hideBehind: e.target.checked }); }} />
                <span>Keep crowded rows apart</span>
              </label>
              <${DG.Slider} label="Pattern scale" value=${params.patternScale} min=${0.15} max=${2.5}
                onChange=${function (v) { set({ patternScale: v }); }} />
              <${DG.Choice} label="Repeat the form" value=${params.repeat}
                options=${DG.WALLPAPER}
                onChange=${function (v) { set({ repeat: v }); }} />
              <${DG.Slider} label="Softness" value=${params.softness} min=${0} max=${1}
                onChange=${function (v) { set({ softness: v }); }} />
              <${DG.AngleDial} value=${params.flowAngle} onChange=${function (v) { set({ flowAngle: v }); }} />
              <${DG.Slider} label="Field drift" value=${params.flowStrength} min=${0} max=${1.5}
                onChange=${function (v) { set({ flowStrength: v }); }} />
              <p class="hint">
                Rows of points run along the angle and are pushed out of line by the
                height of ${preset.name.toLowerCase()} beneath them. Repeating folds
                the form through one of the plane symmetry groups — mirrors, glides
                and rotations, not just translation. Softness blurs the form, so its
                edges and the seams between copies stay smooth.
              </p>
            </section>

            <section>
              <h2>Colour</h2>
              <${DG.ColourControls} params=${params} set=${set} />
            </section>

            <section>
              <h2>Image mode</h2>
              <p class="hint">
                Light in the image drives dot size and density, and the pattern's
                shape pushes the picture around as it is read — so each of the
                twelve bends the same photograph its own way.
              </p>
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
                  <label class="ctrl">
                    <span class="ctrl-head"><span>Tone from the image</span></span>
                    <select value=${params.imageBlend}
                      onChange=${function (e) { set({ imageBlend: e.target.value }); }}>
                      <option value="average">Half image, half pattern</option>
                      <option value="multiply">Image inside the pattern</option>
                      <option value="replace">Image only</option>
                    </select>
                  </label>
                  <${DG.Slider} label="Distortion" value=${params.imageDistort} min=${0} max=${1}
                    onChange=${function (v) { set({ imageDistort: v }); }} />
                  <${DG.Slider} label="Image amount" value=${params.imageAmount} min=${0} max=${1}
                    onChange=${function (v) { set({ imageAmount: v }); }} />
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
