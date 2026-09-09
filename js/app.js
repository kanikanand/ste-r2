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

  /*
   * Someone who has asked their system for less motion should not be handed a
   * canvas that starts animating. They get the same tool, opened on a still
   * frame, with the Play button to hand.
   */
  function prefersStill() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function App() {
    var paramsState = useState(Object.assign({}, DG.DEFAULTS, { paused: prefersStill() }));
    var params = paramsState[0];
    var setParams = paramsState[1];
    var jobState = useState(null);        // { what, progress }
    var job = jobState[0];
    var setJob = jobState[1];
    var clock = useRef(0);

    var set = useCallback(function (patch) {
      setParams(function (prev) { return Object.assign({}, prev, patch); });
    }, []);

    var pattern = DG.getPattern(params.pattern);

    var style = useMemo(function () {
      return {
        background: colourOf(params.background, DG.BACKGROUNDS, DG.BACKGROUNDS[1]),
        solid: colourOf(params.colorMode, DG.SOLIDS, DG.SOLIDS[0]),
        useGradient: params.colorMode === 'gradient',
        shape: params.shape
      };
    }, [params.background, params.colorMode, params.shape]);

    var stem = params.pattern + '-motion';
    var video = DG.videoType();

    function runFootage(kind, seconds) {
      if (job) return;
      setJob({ what: kind + ' · ' + seconds + 's', progress: 0 });
      var onProgress = function (v) { setJob({ what: kind + ' · ' + seconds + 's', progress: v }); };
      var done = function () { setJob(null); };
      var fail = function (e) { setJob(null); alert(e.message || String(e)); };

      if (kind === 'GIF') {
        DG.exportGIF(params, style, seconds, { width: 480, fps: 12.5 }, onProgress)
          .then(function (blob) { DG.download(blob, stem + '-' + seconds + 's.gif'); done(); })
          .catch(fail);
      } else {
        DG.exportVideo(params, style, seconds, { width: 1280, fps: 30 }, onProgress)
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
              <h1>Dotted Grid Motion</h1>
              <p>Six patterns in constant flow</p>
            </div>
          </div>
          <div class="topbar-actions">
            ${job && html`<span class="readout job">${job.what} — ${Math.round(job.progress * 100)}%</span>`}
            <button type="button" onClick=${function () { set({ paused: !params.paused }); }}>
              ${params.paused ? 'Play' : 'Pause'}
            </button>
            <button type="button" class="primary"
              onClick=${function () { DG.exportSVG(params, style, clock.current, 2000, stem + '.svg'); }}>SVG</button>
            <button type="button"
              onClick=${function () { DG.exportPNG(params, style, clock.current, 2000, stem + '.png'); }}>PNG</button>
          </div>
        </header>

        <div class="layout">
          <aside class="panel panel-presets">
            <h2>Patterns</h2>
            <div class="thumbs">
              ${DG.PATTERNS.map(function (p) {
                return html`<${DG.PatternThumb} key=${p.id} pattern=${p} params=${params} style=${style}
                  active=${p.id === params.pattern}
                  onSelect=${function (id) { set({ pattern: id }); }} />`;
              })}
            </div>
          </aside>

          <main class="canvas-area">
            <${DG.Stage} params=${params} style=${style}
              onFrame=${function (t) { clock.current = t; }} />
            <div class="caption">
              <h2>${pattern.name}</h2>
              <p>${pattern.blurb}</p>
            </div>
          </main>

          <aside class="panel panel-controls">
            <section>
              <h2>Motion</h2>
              <${DG.Slider} label="Speed" value=${params.speed} min=${0.05} max=${3}
                format=${function (v) { return v.toFixed(2) + ' cyc/s'; }}
                onChange=${function (v) { set({ speed: v }); }} />
              <${DG.Slider} label="Pattern scale" value=${params.scale} min=${0.2} max=${4}
                onChange=${function (v) { set({ scale: v }); }} />
              <${DG.AngleDial} value=${params.angle} onChange=${function (v) { set({ angle: v }); }} />
              <p class="hint">
                Every pattern repeats over one cycle, so footage is recorded over
                whole cycles and loops without a jump.
              </p>
            </section>

            <section>
              <h2>Dots</h2>
              <${DG.Choice} label="Mark" value=${params.shape}
                options=${[{ id: 'circle', label: 'Circle' }, { id: 'square', label: 'Square' }]}
                onChange=${function (v) { set({ shape: v }); }} />
              <${DG.Slider} label="Grid density" value=${params.grid} min=${8} max=${120} step=${1}
                format=${function (v) { return v + ' across'; }}
                onChange=${function (v) { set({ grid: v }); }} />
              <${DG.Slider} label="Dot size" value=${params.dotScale} min=${0.1} max=${1.6}
                onChange=${function (v) { set({ dotScale: v }); }} />
              <${DG.Slider} label="Size variation" value=${params.sizeVariation} min=${0} max=${1}
                onChange=${function (v) { set({ sizeVariation: v }); }} />
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
              <h2>Network</h2>
              <${DG.Slider} label="Clusters" value=${params.clusters} min=${4} max=${48} step=${1}
                format=${function (v) { return v + ' centres'; }}
                onChange=${function (v) { set({ clusters: v }); }} />
              <${DG.Slider} label="Field distortion" value=${params.distort} min=${0} max=${1}
                onChange=${function (v) { set({ distort: v }); }} />
              <${DG.Slider} label="Timing spread" value=${params.timing} min=${0} max=${1}
                onChange=${function (v) { set({ timing: v }); }} />
              <${DG.Slider} label="Displacement" value=${params.drift} min=${0} max=${0.1} step=${0.005}
                format=${function (v) { return Math.round(v * 100) + '% of gap'; }}
                onChange=${function (v) { set({ drift: v }); }} />
              <p class="hint">
                Clusters are scattered across a field wider than the frame, so
                the count includes centres just outside it. Displacement moves
                neighbouring dots together and stops at a tenth of the gap —
                past that the lattice stops reading, and so does everything
                happening on it.
              </p>
            </section>

            <section>
              <h2>Colour</h2>
              <${DG.ColourControls} params=${params} set=${set} />
              <span class="ctrl-label">Frame</span>
              <div class="chips">
                ${DG.FRAMES.map(function (f) {
                  return html`<button key=${f.id} type="button"
                    class=${'chip' + (params.frame === f.id ? ' is-active' : '')}
                    onClick=${function () { set({ frame: f.id }); }}>${f.label}</button>`;
                })}
              </div>
            </section>

            <section>
              <h2>Footage</h2>
              <span class="ctrl-label">GIF</span>
              <div class="chips">
                ${DURATIONS.map(function (d) {
                  return html`<button key=${d.id} type="button" class="chip" disabled=${!!job}
                    onClick=${function () { runFootage('GIF', d.id); }}>${d.label}</button>`;
                })}
              </div>
              <span class="ctrl-label">${video ? (video.ext === 'mp4' ? 'MP4' : 'WebM') : 'Video'}</span>
              <div class="chips">
                ${DURATIONS.map(function (d) {
                  return html`<button key=${d.id} type="button" class="chip" disabled=${!!job || !video}
                    onClick=${function () { runFootage('Video', d.id); }}>${d.label}</button>`;
                })}
              </div>
              <p class="hint">
                SVG and PNG take the frame showing the moment you press them —
                SVG with the background, PNG without.
                ${video && video.ext !== 'mp4' ? ' This browser records WebM rather than MP4.' : ''}
                Video is recorded as it plays, so a minute takes a minute.
              </p>
            </section>

            <button type="button" class="ghost wide"
              onClick=${function () { setParams(Object.assign({}, DG.DEFAULTS, { paused: false, pattern: params.pattern })); }}>
              Reset controls
            </button>
          </aside>
        </div>
      </div>`;
  }

  DG.App = App;
  ReactDOM.createRoot(document.getElementById('root')).render(html`<${App} />`);
})(DG);
