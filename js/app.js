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

    var pattern = DG.getPattern(params.pattern);

    var style = useMemo(function () {
      var bg = null;
      for (var i = 0; i < DG.BACKGROUNDS.length; i++) {
        if (DG.BACKGROUNDS[i].id === params.background) bg = DG.BACKGROUNDS[i];
      }
      return {
        background: bg && bg.gradient ? null : colourOf(params.background, DG.BACKGROUNDS, DG.BACKGROUNDS[1]),
        bgGradient: bg && bg.gradient ? DG.gradientStops(params.stops) : null,
        solid: colourOf(params.colorMode, DG.SOLIDS, DG.SOLIDS[0]),
        useGradient: params.colorMode === 'gradient',
        alpha: params.dotAlpha
      };
    }, [params.background, params.colorMode, params.dotAlpha, params.stops]);

    // What the exports actually draw on. Video is left out of it: MP4 has no
    // alpha, so it always carries a ground.
    var exportStyle = useMemo(function () {
      return clearBg ? Object.assign({}, style, { background: null, bgGradient: null }) : style;
    }, [style, clearBg]);

    var stem = params.pattern + '-motion';
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
        DG.exportGIF(params, exportStyle, seconds, { width: 480, fps: 12.5 }, onProgress)
          .then(function (blob) { DG.download(blob, gifName); done(); })
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
              <h1>Ingenuity Unleashed</h1>
              <p>Five patterns in constant flow</p>
            </div>
          </div>
          <div class="topbar-actions">
            ${job && html`<span class="readout job">${job.what} — ${Math.round(job.progress * 100)}%</span>`}
            <button type="button" onClick=${function () { set({ paused: !params.paused }); }}>
              ${params.paused ? 'Play' : 'Pause'}
            </button>

            <button type="button" aria-pressed=${clearBg}
              class=${'chip chip-toggle' + (clearBg ? ' is-active' : '')}
              title=${clearBg
                ? 'SVG, PNG and GIF are saved with no background, as -clear. Video always carries one — MP4 has no alpha.'
                : 'Exports carry the background you can see. Press for no background.'}
              onClick=${function () { setClearBg(!clearBg); }}>No bg</button>

            <div class="dl-group" title="The frame showing when you press it.">
              <span class="dl-label">Still</span>
              <button type="button" class="chip"
                onClick=${function () { DG.exportSVG(params, exportStyle, clock.current, 2000, stem + (clearBg ? '-clear' : '') + '.svg'); }}>SVG</button>
              <button type="button" class="chip"
                onClick=${function () { DG.exportPNG(params, exportStyle, clock.current, 2000, stem + (clearBg ? '-clear' : '') + '.png'); }}>PNG</button>
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
              <${DG.Slider} label="Grid density" value=${params.grid} min=${8} max=${120} step=${1}
                format=${function (v) { return v + ' across'; }}
                onChange=${function (v) { set({ grid: v }); }} />
              <${DG.Slider} label="Dot size" value=${params.dotScale} min=${0.1} max=${1.6}
                onChange=${function (v) { set({ dotScale: v }); }} />
              <${DG.Slider} label="Size variation" value=${params.sizeVariation} min=${0} max=${1}
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
              <h2>Motion</h2>
              <${DG.Slider} label="Speed" value=${params.speed} min=${0.05} max=${3}
                format=${function (v) { return v.toFixed(2) + ' cyc/s'; }}
                onChange=${function (v) { set({ speed: v }); }} />
              <${DG.Slider} label="Pattern scale" value=${params.scale} min=${0.2} max=${4}
                onChange=${function (v) { set({ scale: v }); }} />
            </section>

            <section>
              <h2>Angle</h2>
              <${DG.AngleDial} value=${params.angle} onChange=${function (v) { set({ angle: v }); }} />
            </section>

            <button type="button" class="ghost wide"
              onClick=${function () { setParams(Object.assign({}, DG.DEFAULTS, { paused: params.paused, pattern: params.pattern })); }}>
              Reset controls
            </button>
          </aside>
        </div>
      </div>`;
  }

  DG.App = App;
  ReactDOM.createRoot(document.getElementById('root')).render(html`<${App} />`);
})(DG);
