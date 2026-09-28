/* ============================================================================
 * app.js — state, layout and mount for the three modes.
 *
 * The state is in two halves. The shared half is what the tool owns — the
 * frame, the download size, the palette, the ground — and it follows you from
 * mode to mode. The other half is a set of settings per mode, so leaving
 * Globe and coming back finds the globe where you left it rather than reset.
 * modes.js puts the two together for whichever mode is showing, and the
 * renderer and the exporters never learn which one that was.
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
   * The star's gallery. The form is one construction at four settings — the
   * rings round, flattened, gathered onto their own curves, or kneaded by the
   * field — so these are places on those four sliders rather than shapes of
   * their own, and every one of them is reachable by hand.
   */
  var STAR_PRESETS = [
    { name: 'Globe', blurb: 'The rings round: one sphere',
      params: { morph: 0, spike: 0.2, inflate: 1, fluid: 0.1 } },
    { name: 'Between', blurb: 'Part flattened, part round',
      params: { morph: 0.35, spike: 0.6, inflate: 0.6, fluid: 0.25 } },
    { name: 'Star', blurb: 'Flat rings, eight points',
      params: { morph: 1, spike: 0.85, inflate: 0.55, fluid: 0.15 } },
    { name: 'Wireframe', blurb: 'Gathered onto the four curves',
      params: { morph: 0.8, spike: 0.7, inflate: 0, fluid: 0.2 } },
    { name: 'Amoeba', blurb: 'The field kneading it out of shape',
      params: { morph: 0.6, spike: 0.6, inflate: 0.6, fluid: 0.9 } }
  ];

  function sameAs(params, preset) {
    var keys = Object.keys(preset.params);
    for (var i = 0; i < keys.length; i++) {
      if (Math.abs(params[keys[i]] - preset.params[keys[i]]) > 0.001) return false;
    }
    return true;
  }

  /*
   * A bucket of settings per engine rather than per mode, because a mode can
   * hold two formations and they are different engines with different
   * settings — Sphere's orbit counts particles in thousands and the star in
   * tens of thousands. Which formation a mode is showing is its own small
   * piece of state, kept per mode so leaving Sphere and coming back finds the
   * formation you left it on.
   */
  function initialState() {
    var byEngine = {};
    Object.keys(DG.ENGINES).forEach(function (id) { byEngine[id] = {}; });
    var formation = {};
    DG.MODES.forEach(function (m) {
      var list = DG.formations(m.id);
      if (list) formation[m.id] = list[0].id;
    });
    return {
      mode: 'patterns',
      formation: formation,
      shared: Object.assign({}, DG.SHARED_DEFAULTS),
      byEngine: byEngine
    };
  }

  function App() {
    var stateBox = useState(initialState);
    var state = stateBox[0];
    var setState = stateBox[1];

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

    /*
     * One setter for every control. A patch is split by key rather than by
     * who sent it, so a control never has to know whether the thing it moves
     * belongs to the tool or to the mode — Frame lands in the shared half and
     * Grid density in this mode's half, from the same call.
     */
    var set = useCallback(function (patch) {
      setState(function (prev) {
        var shared = null;
        var mine = null;
        Object.keys(patch).forEach(function (k) {
          if (DG.isShared(k)) (shared = shared || {})[k] = patch[k];
          else (mine = mine || {})[k] = patch[k];
        });
        var next = Object.assign({}, prev);
        if (shared) next.shared = Object.assign({}, prev.shared, shared);
        if (mine) {
          var key = DG.activeEngine(prev);
          next.byEngine = Object.assign({}, prev.byEngine);
          next.byEngine[key] = Object.assign({}, prev.byEngine[key], mine);
        }
        return next;
      });
    }, []);

    var goMode = useCallback(function (id) {
      setState(function (prev) { return Object.assign({}, prev, { mode: id }); });
    }, []);

    var goFormation = useCallback(function (id) {
      setState(function (prev) {
        var formation = Object.assign({}, prev.formation);
        formation[prev.mode] = id;
        return Object.assign({}, prev, { formation: formation });
      });
    }, []);

    // Reset is the formation you are in, not the mode: the other one is not
    // on screen and has nothing to do with what you are looking at.
    var resetMode = useCallback(function () {
      setState(function (prev) {
        var byEngine = Object.assign({}, prev.byEngine);
        byEngine[DG.activeEngine(prev)] = {};
        return Object.assign({}, prev, { byEngine: byEngine });
      });
    }, []);

    var mode = state.mode;
    var params = DG.modeParams(state);
    var formations = DG.formations(mode);
    var formation = params.engine;

    var style = useMemo(function () {
      var bg = null;
      for (var i = 0; i < DG.BACKGROUNDS.length; i++) {
        if (DG.BACKGROUNDS[i].id === params.background) bg = DG.BACKGROUNDS[i];
      }
      var ground = bg && bg.gradient ? null : colourOf(params.background, DG.BACKGROUNDS, DG.BACKGROUNDS[2]);
      return {
        background: ground,
        mesh: bg && bg.gradient ? DG.tidyMesh(params.mesh) : null,
        meshBlend: params.meshBlend,
        solid: colourOf(params.colorMode, DG.SOLIDS, DG.SOLIDS[0]),
        highlight: colourOf(params.highlightMode, DG.SOLIDS, DG.SOLIDS[0]),
        useGradient: params.colorMode === 'gradient',
        alpha: params.dotAlpha,
        // The pill reads against the ground it sits on, so it borrows it —
        // and falls back to white when the ground is a gradient or nothing at
        // all, where there is no single colour to borrow.
        labelFill: ground || '#ffffff',
        labelText: DG.readableOn(ground || '#ffffff')
      };
    }, [params.background, params.colorMode, params.highlightMode, params.dotAlpha,
        params.mesh, params.meshBlend]);

    // What the exports actually draw on. Video is left out of it: MP4 has no
    // alpha, so it always carries a ground.
    var exportStyle = useMemo(function () {
      return clearBg ? Object.assign({}, style, { background: null, mesh: null }) : style;
    }, [style, clearBg]);

    // What a download is called: the pattern in Patterns, and the formation
    // rather than the mode in Sphere, so a star and an orbit do not land in
    // the same folder under the same name.
    var stem = mode === 'patterns' ? params.pattern + '-motion' : params.engine;
    var video = DG.videoType();

    function runFootage(kind, seconds) {
      if (job) return;
      var what = kind + ' · ' + seconds + 's';
      setJob({ what: what, progress: 0 });
      var onProgress = function (v) { setJob({ what: what, progress: v }); };
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

    /* ---- the left panel, which is the only part that is a mode's own ----- */

    function presets() {
      if (mode === 'patterns') {
        return html`
          <${React.Fragment}>
            <h2>Patterns</h2>
            <div class="thumbs">
              ${DG.PATTERNS.map(function (p) {
                return html`<${DG.PresetThumb} key=${p.id} params=${params} style=${style}
                  preset=${{ name: p.name, blurb: p.blurb, params: { pattern: p.id } }}
                  active=${p.id === params.pattern}
                  onSelect=${function () { set({ pattern: p.id }); }} />`;
              })}
            </div>
          <//>`;
      }
      if (mode === 'globe') {
        return html`
          <${React.Fragment}>
            <h2>Countries</h2>
            <${DG.CountryPicker} picked=${params.highlights} set=${set} />
          <//>`;
      }
      var switcher = html`
        <div class="chips formations">
          ${formations.map(function (f) {
            return html`<button key=${f.id} type="button" title=${f.blurb}
              class=${'chip' + (f.engine === formation ? ' is-active' : '')}
              onClick=${function () { goFormation(f.id); }}>${f.label}</button>`;
          })}
        </div>`;

      if (formation === 'star') {
        return html`
          <${React.Fragment}>
            <h2>Formation</h2>
            ${switcher}
            <div class="thumbs">
              ${STAR_PRESETS.map(function (p) {
                return html`<${DG.PresetThumb} key=${p.name} params=${params} style=${style}
                  preset=${p} active=${sameAs(params, p)}
                  onSelect=${function () { set(p.params); }} />`;
              })}
            </div>
          <//>`;
      }

      return html`
        <${React.Fragment}>
          <h2>Formation</h2>
          ${switcher}
          <h2>Distortion</h2>
          <div class="thumbs">
            ${DG.SPHERE_PATTERNS.map(function (p) {
              return html`<${DG.PresetThumb} key=${p.id} params=${params} style=${style}
                preset=${{ name: p.label, params: { distortionMode: p.id } }}
                active=${p.id === params.distortionMode}
                onSelect=${function () { set({ distortionMode: p.id }); }} />`;
            })}
          </div>
        <//>`;
    }

    function caption() {
      if (mode === 'patterns') {
        var pattern = DG.getPattern(params.pattern);
        return html`<${React.Fragment}><h2>${pattern.name}</h2><p>${pattern.blurb}</p><//>`;
      }
      if (mode === 'globe') {
        return html`
          <${React.Fragment}>
            <h2>${params.highlights.length
              ? params.highlights.map(function (i) { return DG.countryNames()[i]; }).join(' · ')
              : 'The world'}</h2>
            <p>Drag the globe to turn it. It turns once over a cycle — twenty-four
               seconds at the spin it starts on.</p>
          <//>`;
      }
      if (formation === 'star') {
        return html`
          <${React.Fragment}>
            <h2>${params.dist < 1 ? 'Inside the form'
              : params.morph < 0.02 && params.spike < 0.02 ? 'Globe'
              : params.morph > 0.98 ? 'Star' : 'Between'}</h2>
            <p>Drag to turn and lean it. Distance is in form radii, and below 1 the camera
               is inside looking out.</p>
          <//>`;
      }
      return html`
        <${React.Fragment}>
          <h2>${(function () {
            for (var i = 0; i < DG.SPHERE_PATTERNS.length; i++) {
              if (DG.SPHERE_PATTERNS[i].id === params.distortionMode) return DG.SPHERE_PATTERNS[i].label;
            }
            return 'Sphere';
          })()}</h2>
          <p>Drag to turn the sphere, scroll to zoom. The orbit and the distortion both
             come back to where they started at the end of a cycle.</p>
        <//>`;
    }

    /* ---- the mode's own half of the right panel -------------------------- */

    function modeControls() {
      if (mode === 'patterns') {
        return html`
          <${React.Fragment}>
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
          <//>`;
      }

      if (mode === 'globe') {
        return html`
          <${React.Fragment}>
            <section>
              <h2>Highlight</h2>
              <div class="swatches">
                ${DG.SOLIDS.map(function (c) {
                  return html`<button key=${c.id} type="button" title=${c.label}
                    class=${'swatch' + (params.highlightMode === c.id ? ' is-active' : '')}
                    style=${{ background: c.value }}
                    onClick=${function () { set({ highlightMode: c.id }); }}></button>`;
                })}
              </div>
              <${DG.Slider} label="Highlight size" value=${params.hotSize} min=${0.6} max=${2.4}
                format=${function (v) { return v.toFixed(2) + '×'; }}
                onChange=${function (v) { set({ hotSize: v }); }} />
              <${DG.Slider} label="Highlight density" value=${params.hotDensity} min=${1} max=${3}
                format=${function (v) { return v < 1.01 ? 'same' : v.toFixed(2) + '×'; }}
                onChange=${function (v) { set({ hotDensity: v }); }} />
            </section>

            <section>
              <h2>Dots</h2>
              <${DG.Slider} label="Grid density" value=${params.grid} min=${20} max=${160} step=${1}
                format=${function (v) { return v + ' rings'; }}
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
              <h2>Globe</h2>
              <${DG.Slider} label="Size" value=${params.globeSize} min=${0.4} max=${1.15}
                format=${function (v) { return Math.round(v * 100) + '%'; }}
                onChange=${function (v) { set({ globeSize: v }); }} />
              <${DG.Slider} label="Spin" value=${Math.round(1 / params.speed)} min=${10} max=${100} step=${1}
                format=${function (v) { return Math.round(v) + ' s a turn'; }}
                onChange=${function (v) { set({ speed: 1 / v }); }} />
              <${DG.Slider} label="Axis tilt" value=${params.axisTilt} min=${-90} max=${90} step=${0.1}
                format=${function (v) {
                  var d = (v > 0 ? '+' : '') + v.toFixed(1) + '°';
                  return Math.abs(v) < 0.05 ? 'upright'
                    : Math.abs(v - 23.4) < 0.05 ? d + ' — the Earth’s' : d;
                }}
                onChange=${function (v) { set({ axisTilt: v }); }} />
              <${DG.Slider} label="Sea dots" value=${params.seaDots} min=${0} max=${0.6}
                format=${function (v) { return v ? Math.round(v * 100) + '%' : 'none'; }}
                onChange=${function (v) { set({ seaDots: v }); }} />
              <p class="note">Axis tilt leans the line it turns about across the frame; the
                 drag's own lean tips that line towards you or away.</p>
              <label class="check">
                <input type="checkbox" checked=${params.labels}
                  onChange=${function (e) { set({ labels: e.target.checked }); }} />
                <span>Name the countries picked</span>
              </label>
            </section>
          <//>`;
      }

      if (formation === 'star') {
        return html`
          <${React.Fragment}>
            <section>
              <h2>Form</h2>
              <${DG.Slider} label="Morph" value=${params.morph} min=${0} max=${1}
                format=${function (v) { return v < 0.005 ? 'round' : v > 0.995 ? 'flat'
                  : Math.round(v * 100) + '%'; }}
                onChange=${function (v) { set({ morph: v }); }} />
              <${DG.Slider} label="Inflate" value=${params.inflate} min=${0} max=${1}
                format=${function (v) { return v < 0.005 ? 'bands' : v > 0.995 ? 'shells'
                  : Math.round(v * 100) + '%'; }}
                onChange=${function (v) { set({ inflate: v }); }} />
              <${DG.Slider} label="Reach" value=${params.spike} min=${0} max=${1}
                format=${function (v) { return Math.round(v * 100) + '%'; }}
                onChange=${function (v) { set({ spike: v }); }} />
              <${DG.Slider} label="Fluidity" value=${params.fluid} min=${0} max=${1}
                format=${function (v) { return v < 0.005 ? 'held'
                  : v > 0.7 ? Math.round(v * 100) + '% — amoeba'
                  : Math.round(v * 100) + '% alive'; }}
                onChange=${function (v) { set({ fluid: v }); }} />
              <p class="note">Morph flattens the four rings until their eight ends are the
                 points of a star; Reach is how far those ends go. Inflate is how much of
                 a ring is filled, from four bands to four shells.</p>
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
                format=${function (v) { return v < 1 ? 'held — rows intact'
                  : v === 1 ? 'one turn a cycle' : 'up to ' + v + ' turns a cycle'; }}
                onChange=${function (v) { set({ orbit: v }); }} />
              <p class="note">Distance is in form radii; below 1 is inside. Orbit is whole
                 turns a cycle, so a particle is back where it began at the end of one.</p>
            </section>
          <//>`;
      }

      return html`
        <${React.Fragment}>
          <section>
            <h2>Particles</h2>
            <${DG.Slider} label="Particle count" value=${params.count} min=${500} max=${3500} step=${250}
              format=${function (v) { return Math.round(v).toLocaleString(); }}
              onChange=${function (v) { set({ count: v }); }} />
            <${DG.Slider} label="Particle size" value=${params.particleSize} min=${1} max=${5} step=${0.5}
              format=${function (v) { return v.toFixed(1) + 'px'; }}
              onChange=${function (v) { set({ particleSize: v }); }} />
            <${DG.Slider} label="Opacity" value=${params.dotAlpha} min=${0.05} max=${1}
              format=${function (v) { return Math.round(v * 100) + '%'; }}
              onChange=${function (v) { set({ dotAlpha: v }); }} />
            <${DG.Slider} label="Farthest particle fade" value=${params.farFade} min=${0} max=${1} step=${0.01}
              format=${function (v) { return Math.round(v * 100) + '%'; }}
              onChange=${function (v) { set({ farFade: v }); }} />
            <p class="note">How much opacity is taken off the particles farthest from the
               camera. At 100% the farthest are invisible and the nearest fully opaque.</p>
          </section>

          <section>
            <h2>Distortion</h2>
            <${DG.Slider} label="Distortion amount" value=${params.wave} min=${0} max=${0.65} step=${0.01}
              format=${function (v) { return v.toFixed(2); }}
              onChange=${function (v) { set({ wave: v }); }} />
            <${DG.Slider} label="Pattern frequency" value=${params.frequency} min=${0.5} max=${10} step=${0.1}
              format=${function (v) { return v.toFixed(1); }}
              onChange=${function (v) { set({ frequency: v }); }} />
            <${DG.Slider} label="Distortion motion" value=${params.distortionSpeed} min=${0} max=${4} step=${0.1}
              format=${function (v) { return v.toFixed(1) + '×'; }}
              onChange=${function (v) { set({ distortionSpeed: v }); }} />
            <${DG.Slider} label="Detail mix" value=${params.detail} min=${0} max=${1} step=${0.05}
              format=${function (v) { return Math.round(v * 100) + '%'; }}
              onChange=${function (v) { set({ detail: v }); }} />
            <${DG.Slider} label="Surface twist" value=${params.twist} min=${-1} max=${1} step=${0.05}
              format=${function (v) { return (v >= 0 ? '+' : '') + v.toFixed(2); }}
              onChange=${function (v) { set({ twist: v }); }} />
            <${DG.Slider} label="Vertical stretch" value=${params.stretch} min=${-1} max=${1} step=${0.05}
              format=${function (v) { return (v >= 0 ? '+' : '') + v.toFixed(2); }}
              onChange=${function (v) { set({ stretch: v }); }} />
          </section>

          <section>
            <h2>Camera</h2>
            <${DG.Slider} label="Orbit speed" value=${params.orbitSpeed} min=${0} max=${3} step=${0.1}
              format=${function (v) { return v.toFixed(1) + '×'; }}
              onChange=${function (v) { set({ orbitSpeed: v }); }} />
            <${DG.Slider} label="Loop length" value=${Math.round(1 / params.speed)} min=${10} max=${100} step=${1}
              format=${function (v) { return Math.round(v) + ' s a cycle'; }}
              onChange=${function (v) { set({ speed: 1 / v }); }} />
            <${DG.Slider} label="Zoom" value=${params.cameraZ} min=${200} max=${1000} step=${1}
              format=${function (v) { return Math.round(v) + ''; }}
              onChange=${function (v) { set({ cameraZ: v }); }} />
            <p class="note">Drag the sphere to turn it and scroll over it to zoom. Orbit
               speed and distortion motion are rounded to whole turns of a cycle, so the
               motion comes back to where it began at the end of one.</p>
          </section>
        <//>`;
    }

    var current = null;
    for (var mi = 0; mi < DG.MODES.length; mi++) if (DG.MODES[mi].id === mode) current = DG.MODES[mi];

    return html`
      <div class="app">
        <header class="topbar">
          <div class="brand">
            <img class="brand-mark" src="logo.png" alt="" width="28" height="28" />
            <div>
              <h1>STE Visual Suite</h1>
              <p>${current.blurb}</p>
            </div>
          </div>

          <div class="modes" role="tablist" aria-label="Mode">
            ${DG.MODES.map(function (m) {
              return html`<button key=${m.id} type="button" role="tab"
                aria-selected=${m.id === mode}
                class=${'mode' + (m.id === mode ? ' is-active' : '')}
                onClick=${function () { goMode(m.id); }}>${m.label}</button>`;
            })}
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

            <div class="dl-group" title="The length on the button, at the speed on screen. A GIF has one see-through palette entry, so with No bg on, a dot edge cannot fade into whatever sits behind it.">
              <span class="dl-label">GIF</span>
              ${DURATIONS.map(function (d) {
                return html`<button key=${d.id} type="button" class="chip" disabled=${!!job}
                  onClick=${function () { runFootage('GIF', d.id); }}>${d.label}</button>`;
              })}
            </div>

            <div class="dl-group" title=${(video && video.ext !== 'mp4' ? 'This browser records WebM rather than MP4. ' : '') +
              'The length on the button, at the speed on screen. Drawn frame by frame, so a slow frame makes the recording take longer rather than the clip come out short and fast.'}>
              <span class="dl-label">${video ? (video.ext === 'mp4' ? 'MP4' : 'WebM') : 'Video'}</span>
              ${DURATIONS.map(function (d) {
                return html`<button key=${d.id} type="button" class="chip" disabled=${!!job || !video}
                  onClick=${function () { runFootage('Video', d.id); }}>${d.label}</button>`;
              })}
            </div>
          </div>
        </header>

        <div class="layout">
          <aside class="panel panel-presets">${presets()}</aside>

          <main class="canvas-area">
            <${DG.Stage} params=${params} style=${style} set=${set}
              onFrame=${function (t) { clock.current = t; }} />
            <div class="caption">${caption()}</div>
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

            ${/*
               * One mesh, so one editor, rather than a copy under whichever
               * control happens to be using it. It appears as soon as either
               * the ground or the dots are set to the mesh, and both read the
               * same arrangement.
               */
              (params.background === 'gradient' || params.colorMode === 'gradient') && html`
              <section>
                <h2>Mesh gradient</h2>
                <${DG.MeshControls} nodes=${params.mesh} blend=${params.meshBlend}
                  frame=${params.frame} set=${set} />
              </section>`}

            ${modeControls()}

            <button type="button" class="ghost wide" onClick=${resetMode}>
              Reset ${current.label} controls
            </button>
          </aside>
        </div>
      </div>`;
  }

  DG.App = App;
  ReactDOM.createRoot(document.getElementById('root')).render(html`<${App} />`);
})(DG);
