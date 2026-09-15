/* ============================================================================
 * app.js — state, layout and mount.
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

  var DURATIONS = [
    { id: 10, label: '10 sec' },
    { id: 30, label: '30 sec' },
    { id: 60, label: '1 min' }
  ];

  function App() {
    var paramsState = useState(Object.assign({}, DG.DEFAULTS, { paused: false }));
    var params = paramsState[0];
    var setParams = paramsState[1];
    // One switch for every export, rather than each format having its own
    // fixed habit: exports carry the background you are looking at unless this
    // is pressed. It is separate from the Background swatch so a still or a
    // loop can be pulled without a background you still want on screen.
    var clearBgState = useState(false);
    var clearBg = clearBgState[0];
    var setClearBg = clearBgState[1];
    var jobState = useState(null);        // { what, progress }
    var job = jobState[0];
    var setJob = jobState[1];
    var clock = useRef(0);

    var set = useCallback(function (patch) {
      setParams(function (prev) { return Object.assign({}, prev, patch); });
    }, []);

    var style = useMemo(function () {
      var bg = null;
      for (var i = 0; i < DG.BACKGROUNDS.length; i++) {
        if (DG.BACKGROUNDS[i].id === params.background) bg = DG.BACKGROUNDS[i];
      }
      var ground = bg && bg.gradient ? null : colourOf(params.background, DG.BACKGROUNDS, DG.BACKGROUNDS[1]);
      return {
        background: ground,
        bgGradient: bg && bg.gradient ? DG.gradientStops(params.stops) : null,
        solid: colourOf(params.colorMode, DG.SOLIDS, DG.SOLIDS[0]),
        highlight: colourOf(params.highlightMode, DG.SOLIDS, DG.SOLIDS[0]),
        useGradient: params.colorMode === 'gradient',
        alpha: params.dotAlpha,
        // The pill reads against the ground it sits on, so it borrows it —
        // and falls back to ink when the ground is a gradient or nothing at
        // all, where there is no single colour to borrow.
        labelFill: ground || '#12141c',
        labelText: DG.readableOn(ground || '#12141c')
      };
    }, [params.background, params.colorMode, params.highlightMode, params.dotAlpha, params.stops]);

    // What the exports actually draw on. Video is left out of it: MP4 has no
    // alpha, so it always carries a ground.
    var exportStyle = useMemo(function () {
      return clearBg ? Object.assign({}, style, { background: null, bgGradient: null }) : style;
    }, [style, clearBg]);

    var stem = 'form';
    var video = DG.videoType();

    function runFootage(kind, seconds) {
      if (job) return;
      setJob({ what: kind + ' · ' + seconds + 's', progress: 0 });
      var onProgress = function (v) { setJob({ what: kind + ' · ' + seconds + 's', progress: v }); };
      var done = function () { setJob(null); };
      var fail = function (e) { setJob(null); alert(e.message || String(e)); };

      if (kind === 'GIF') {
        // Named apart, so downloading both leaves you with two files rather
        // than one and a copy.
        var gifName = stem + '-' + seconds + 's' + (clearBg ? '-clear' : '') + '.gif';
        DG.exportGIF(params, exportStyle, seconds, { height: DG.sizeHeight(params.size), fps: 12.5 }, onProgress)
          .then(function (blob) { DG.download(blob, gifName); done(); })
          .catch(fail);
      } else {
        DG.exportVideo(params, style, seconds, { height: DG.sizeHeight(params.size), fps: 30 }, onProgress)
          .then(function (r) { DG.download(r.blob, stem + '-' + seconds + 's.' + r.ext); done(); })
          .catch(fail);
      }
    }

    return html`
      <div class="app">
        <header class="topbar">
          <div class="brand">
            <span class="brand-mark"></span>
            <div>
              <h1>Ingenuity Unleashed</h1>
              <p>Orbiting particles, sphere to star</p>
            </div>
          </div>
          <div class="topbar-actions">
            ${job && html`<span class="readout job">${job.what} — ${Math.round(job.progress * 100)}%</span>`}
            <button type="button" onClick=${function () { set({ paused: !params.paused }); }}>
              ${params.paused ? 'Play' : 'Pause'}
            </button>

            <div class="dl-group" title="The height is fixed per size; the width follows the frame you are in, so every download at one size is the same height.">
              <span class="dl-label">Size</span>
              ${DG.SIZES.map(function (z) {
                var d = DG.exportSize(z.id, params.frame);
                return html`<button key=${z.id} type="button"
                  class=${'chip' + (params.size === z.id ? ' is-active' : '')}
                  onClick=${function () { set({ size: z.id }); }}>
                  ${z.label}<span class="chip-dim">${d.width + '×' + d.height}</span>
                </button>`;
              })}
            </div>

            <button type="button" aria-pressed=${clearBg}
              class=${'chip chip-toggle' + (clearBg ? ' is-active' : '')}
              title=${clearBg
                ? 'SVG, PNG and GIF are saved with no background, as -clear. Video always carries one — MP4 has no alpha.'
                : 'Exports carry the background you can see. Press for no background.'}
              onClick=${function () { setClearBg(!clearBg); }}>No bg</button>

            <div class="dl-group" title="The frame showing when you press it.">
              <span class="dl-label">Still</span>
              <button type="button" class="chip"
                onClick=${function () { DG.exportSVG(params, exportStyle, clock.current, DG.sizeHeight(params.size), stem + (clearBg ? '-clear' : '') + '.svg'); }}>SVG</button>
              <button type="button" class="chip"
                onClick=${function () { DG.exportPNG(params, exportStyle, clock.current, DG.sizeHeight(params.size), stem + (clearBg ? '-clear' : '') + '.png'); }}>PNG</button>
            </div>

            <div class="dl-group" title="Looping footage. A GIF has one see-through palette entry, so with No bg on, a dot edge cannot fade into whatever sits behind it.">
              <span class="dl-label">GIF</span>
              ${DURATIONS.map(function (d) {
                return html`<button key=${d.id} type="button" class="chip" disabled=${!!job}
                  onClick=${function () { runFootage('GIF', d.id); }}>${d.label}</button>`;
              })}
            </div>

            <div class="dl-group" title=${video && video.ext !== 'mp4'
              ? 'This browser records WebM rather than MP4. Recorded as it plays, so a minute takes a minute.'
              : 'Recorded as it plays, so a minute takes a minute.'}>
              <span class="dl-label">${video ? (video.ext === 'mp4' ? 'MP4' : 'WebM') : 'Video'}</span>
              ${DURATIONS.map(function (d) {
                return html`<button key=${d.id} type="button" class="chip" disabled=${!!job || !video}
                  onClick=${function () { runFootage('Video', d.id); }}>${d.label}</button>`;
              })}
            </div>
          </div>
        </header>

        <div class="layout">
          <aside class="panel panel-presets">
            <h2>Form</h2>
            <${DG.Slider} label="Morph" value=${params.morph} min=${0} max=${1}
              format=${function (v) { return v < 0.005 ? 'sphere' : v > 0.995 ? 'star' : Math.round(v * 100) + '%'; }}
              onChange=${function (v) { set({ morph: v }); }} />
            <${DG.Slider} label="Breathe" value=${params.breathe} min=${0} max=${1}
              format=${function (v) { return v < 0.005 ? 'held' : Math.round(v * 100) + '%'; }}
              onChange=${function (v) { set({ breathe: v }); }} />
            <${DG.Slider} label="Reach" value=${params.spike} min=${0} max=${1}
              onChange=${function (v) { set({ spike: v }); }} />
            <${DG.Slider} label="Sharpness" value=${params.sharp} min=${1} max=${12}
              onChange=${function (v) { set({ sharp: v }); }} />
            <${DG.Slider} label="Fluidity" value=${params.fluid} min=${0} max=${1}
              format=${function (v) { return v < 0.005 ? 'smooth' : Math.round(v * 100) + '% scattered'; }}
              onChange=${function (v) { set({ fluid: v }); }} />
            <p class="note">
              The star is four spokes crossing at one centre — eight points — with
              their axes spread through space rather than round one waist, so it reads
              as a star from any angle. Each spoke is a cone: Reach is how far the
              points run, Sharpness how wide they start. Fluidity leaves the form where
              it is and scatters the particles across it, roughening the points rather
              than blowing them apart.
            </p>
          </aside>

          <main class="canvas-area">
            <${DG.Stage} params=${params} style=${style} set=${set}
              onFrame=${function (t) { clock.current = t; }} />
            <div class="caption">
              <h2>${params.dist < 1 ? 'Inside the form' : params.morph < 0.02 ? 'Sphere'
                : params.morph > 0.98 ? 'Star' : 'Between'}</h2>
              <p>Drag to turn the form and lean it. Push Distance below 1 to pass through
                 the surface and look out from within — hold the Orbit and keep Fluidity
                 low, and the inside reads as long curving rows of dots.</p>
            </div>
          </main>

          <aside class="panel panel-controls">
            <section>
              <h2>Frame</h2>
              <div class="chips">
                ${DG.FRAMES.map(function (f) {
                  return html`<button key=${f.id} type="button"
                    class=${'chip' + (params.frame === f.id ? ' is-active' : '')}
                    onClick=${function () { set({ frame: f.id }); }}>${f.label}</button>`;
                })}
              </div>
            </section>

            <section>
              <h2>Background</h2>
              <${DG.BackgroundControl} params=${params} set=${set} />
            </section>

            <section>
              <h2>Dot colour</h2>
              <${DG.DotColourControl} params=${params} set=${set} />
            </section>

            <section>
              <h2>Dots</h2>
              <${DG.Slider} label="Particles" value=${params.count} min=${400} max=${14000} step=${100}
                format=${function (v) { return Math.round(v).toLocaleString(); }}
                onChange=${function (v) { set({ count: v }); }} />
              <${DG.Slider} label="Dot size" value=${params.dotScale} min=${0.1} max=${1.6}
                onChange=${function (v) { set({ dotScale: v }); }} />
              <${DG.Slider} label="Depth falloff" value=${params.sizeVariation} min=${0} max=${1}
                onChange=${function (v) { set({ sizeVariation: v }); }} />
              <${DG.Slider} label="Opacity" value=${params.dotAlpha} min=${0.05} max=${1}
                format=${function (v) { return Math.round(v * 100) + '%'; }}
                onChange=${function (v) { set({ dotAlpha: v }); }} />
              <${DG.Slider} label="Contrast" value=${params.contrast} min=${0.3} max=${3}
                onChange=${function (v) { set({ contrast: v }); }} />
              <div class="row">
                <${DG.Slider} label="Scatter" value=${params.scatter} min=${0} max=${1}
                  onChange=${function (v) { set({ scatter: v }); }} />
                <button type="button" class="ghost"
                  onClick=${function () { set({ seed: 1 + Math.floor(Math.random() * 999) }); }}>Shuffle</button>
              </div>
            </section>

            <section>
              <h2>Camera</h2>
              <${DG.Slider} label="Distance" value=${params.dist} min=${0.15} max=${5}
                format=${function (v) { return v < 1 ? v.toFixed(2) + ' — inside' : v.toFixed(2); }}
                onChange=${function (v) { set({ dist: v }); }} />
              <${DG.Slider} label="Lens" value=${params.lens} min=${0.4} max=${2.2}
                format=${function (v) { return v.toFixed(2) + '×'; }}
                onChange=${function (v) { set({ lens: v }); }} />
              <${DG.Slider} label="Spin" value=${Math.round(1 / params.speed)} min=${10} max=${100} step=${1}
                format=${function (v) { return Math.round(v) + ' s a turn'; }}
                onChange=${function (v) { set({ speed: 1 / v }); }} />
              <${DG.Slider} label="Orbit" value=${params.orbit} min=${0} max=${4} step=${1}
                format=${function (v) { return v < 1 ? 'held' : v === 1 ? 'one turn a cycle'
                  : 'up to ' + v + ' turns a cycle'; }}
                onChange=${function (v) { set({ orbit: v }); }} />
              <p class="note">
                Drag to turn the form and lean it. Distance is in form radii — below 1 the
                camera is through the surface, and the form wraps around the view.
              </p>
            </section>

            <button type="button" class="ghost wide"
              onClick=${function () { setParams(Object.assign({}, DG.DEFAULTS, { paused: params.paused })); }}>
              Reset controls
            </button>
          </aside>
        </div>
      </div>`;
  }

  DG.App = App;
  ReactDOM.createRoot(document.getElementById('root')).render(html`<${App} />`);
})(DG);
