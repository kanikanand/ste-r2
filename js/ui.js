/* ============================================================================
 * ui.js — the React pieces: canvas stage, preset thumbnails, control widgets.
 *
 * Markup is written with htm, which reads like JSX but is parsed at runtime,
 * so the page needs no build step. React and htm are vendored in vendor/.
 * ==========================================================================*/
var DG = window.DG || (window.DG = {});

(function (DG) {
  'use strict';

  var html = htm.bind(React.createElement);
  var useState = React.useState;
  var useEffect = React.useEffect;
  var useRef = React.useRef;
  var useCallback = React.useCallback;
  var useLayoutEffect = React.useLayoutEffect;

  DG.html = html;

  /* ---- the main stage: a square canvas that redraws when anything changes -- */
  DG.PatternCanvas = function PatternCanvas(props) {
    var wrapRef = useRef(null);
    var canvasRef = useRef(null);
    var sizeState = useState(720);
    var size = sizeState[0];
    var setSize = sizeState[1];

    useLayoutEffect(function () {
      var el = wrapRef.current;
      if (!el || typeof ResizeObserver === 'undefined') return undefined;
      var ro = new ResizeObserver(function (entries) {
        var box = entries[0].contentRect;
        setSize(Math.max(160, Math.floor(Math.min(box.width, box.height))));
      });
      ro.observe(el);
      return function () { ro.disconnect(); };
    }, []);

    useEffect(function () {
      var canvas = canvasRef.current;
      if (!canvas) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = size * dpr;
      canvas.height = size * dpr;
      canvas.style.width = size + 'px';
      canvas.style.height = size + 'px';
      var ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var dots = DG.generateDots(props.params, size, props.sampler);
      DG.renderDots(ctx, dots, {
        size: size,
        background: props.style.background,
        solid: props.style.solid,
        useGradient: props.style.useGradient
      });
      if (props.onCount) props.onCount(dots.length);
    });

    return html`
      <div class="stage" ref=${wrapRef}>
        <canvas ref=${canvasRef} class="stage-canvas"></canvas>
      </div>`;
  };

  /* ---- one preset preview ------------------------------------------------ */
  var THUMB = 132;

  /*
   * Always shows the preset's own field — never the uploaded image — so the
   * gallery stays readable as a field picker while image mode is on.
   */
  DG.PresetThumb = function PresetThumb(props) {
    var ref = useRef(null);
    var preset = props.preset;
    var params = props.params;
    var style = props.style;

    useEffect(function () {
      var canvas = ref.current;
      if (!canvas) return;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = THUMB * dpr;
      canvas.height = THUMB * dpr;
      var ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var thumbParams = Object.assign({}, params, {
        preset: preset.id,
        grid: Math.min(26, params.grid)
      });
      DG.renderDots(ctx, DG.generateDots(thumbParams, THUMB), {
        size: THUMB,
        background: style.background,
        solid: style.solid,
        useGradient: style.useGradient
      });
    });

    return html`
      <button
        type="button"
        class=${'thumb' + (props.active ? ' is-active' : '')}
        onClick=${function () { props.onSelect(preset.id); }}
        title=${preset.blurb}
      >
        <canvas ref=${ref} style=${{ width: THUMB, height: THUMB }}></canvas>
        <span class="thumb-name">${preset.name}</span>
        <span class="thumb-sub">${preset.subtitle}</span>
      </button>`;
  };

  /* ---- controls ---------------------------------------------------------- */
  DG.Slider = function Slider(props) {
    return html`
      <label class="ctrl">
        <span class="ctrl-head">
          <span>${props.label}</span>
          <span class="ctrl-val">${props.format ? props.format(props.value) : props.value.toFixed(2)}</span>
        </span>
        <input
          type="range"
          min=${props.min}
          max=${props.max}
          step=${props.step === undefined ? 0.01 : props.step}
          value=${props.value}
          onChange=${function (e) { props.onChange(parseFloat(e.target.value)); }}
        />
      </label>`;
  };

  /* Drag-anywhere dial for the direction the field lines run. */
  DG.AngleDial = function AngleDial(props) {
    var ref = useRef(null);
    var value = props.value;
    var onChange = props.onChange;

    var pick = useCallback(function (e) {
      var el = ref.current;
      if (!el) return;
      var box = el.getBoundingClientRect();
      var dx = e.clientX - (box.left + box.width / 2);
      var dy = e.clientY - (box.top + box.height / 2);
      var deg = (Math.atan2(dy, dx) * 180) / Math.PI;
      if (deg < 0) deg += 360;
      onChange(Math.round(deg));
    }, [onChange]);

    var rad = (value * Math.PI) / 180;
    var cx = 30 + Math.cos(rad) * 21;
    var cy = 30 + Math.sin(rad) * 21;

    return html`
      <div class="dial-row">
        <svg
          ref=${ref}
          class="dial"
          viewBox="0 0 60 60"
          width="60"
          height="60"
          role="slider"
          aria-label="Angle of flow"
          aria-valuenow=${value}
          aria-valuemin=${0}
          aria-valuemax=${359}
          tabIndex=${0}
          onPointerDown=${function (e) {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            pick(e);
          }}
          onPointerMove=${function (e) {
            if (e.currentTarget.hasPointerCapture(e.pointerId)) pick(e);
          }}
          onKeyDown=${function (e) {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange((value + 355) % 360);
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange((value + 5) % 360);
          }}
        >
          <circle cx="30" cy="30" r="27" class="dial-ring"></circle>
          <line x1="30" y1="30" x2=${cx} y2=${cy} class="dial-needle"></line>
          <circle cx=${cx} cy=${cy} r="4" class="dial-knob"></circle>
        </svg>
        <div class="dial-meta">
          <span class="ctrl-label">Angle of flow</span>
          <input
            type="number"
            min="0"
            max="359"
            value=${value}
            onChange=${function (e) {
              onChange((((parseInt(e.target.value, 10) || 0) % 360) + 360) % 360);
            }}
          />
          <span class="unit">deg</span>
        </div>
      </div>`;
  };

  DG.ColourControls = function ColourControls(props) {
    var params = props.params;
    var set = props.set;
    var isGradient = params.colorMode === 'gradient';

    return html`
      <${React.Fragment}>
        <span class="ctrl-label">Dot colour</span>
        <div class="swatches">
          ${DG.SOLIDS.map(function (s) {
            return html`
              <button
                key=${s.id}
                type="button"
                title=${s.label}
                class=${'swatch' + (params.colorMode === s.id ? ' is-active' : '')}
                style=${{ background: s.value }}
                onClick=${function () { set({ colorMode: s.id }); }}
              ></button>`;
          })}
          <button
            type="button"
            title="Gradient: #de2027 → #687099 → #c5eef9"
            class=${'swatch swatch-wide' + (isGradient ? ' is-active' : '')}
            style=${{ background: DG.cssGradient() }}
            onClick=${function () { set({ colorMode: 'gradient' }); }}
          ></button>
        </div>

        ${isGradient && html`
          <div class="sub-block">
            <label class="ctrl">
              <span class="ctrl-head"><span>Gradient mapped to</span></span>
              <select
                value=${params.gradientMap}
                onChange=${function (e) { set({ gradientMap: e.target.value }); }}
              >
                ${DG.GRADIENT_MAPS.map(function (m) {
                  return html`<option key=${m.id} value=${m.id}>${m.label}</option>`;
                })}
              </select>
            </label>
            <label class="check">
              <input
                type="checkbox"
                checked=${params.gradientReverse}
                onChange=${function (e) { set({ gradientReverse: e.target.checked }); }}
              />
              <span>Reverse ramp</span>
            </label>
          </div>`}

        <span class="ctrl-label">Background</span>
        <div class="swatches">
          ${DG.BACKGROUNDS.map(function (b) {
            return html`
              <button
                key=${b.id}
                type="button"
                title=${b.label}
                class=${'swatch' + (params.background === b.id ? ' is-active' : '')}
                style=${{ background: b.value }}
                onClick=${function () { set({ background: b.id }); }}
              ></button>`;
          })}
        </div>
      <//>`;
  };
})(DG);
