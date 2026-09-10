/* ============================================================================
 * ui.js — the animated stage, the pattern gallery, and the control widgets.
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

  /* ---- the stage, running the clock ------------------------------------- */
  DG.Stage = function Stage(props) {
    var wrapRef = useRef(null);
    var canvasRef = useRef(null);
    var boxState = useState({ w: 960, h: 540 });
    var box = boxState[0];
    var setBox = boxState[1];

    var ratio = DG.frameRatio(props.params.frame);
    var w = Math.max(240, Math.floor(Math.min(box.w, box.h * ratio)));
    var size = { w: w, h: Math.round(w / ratio) };

    useLayoutEffect(function () {
      var el = wrapRef.current;
      if (!el || typeof ResizeObserver === 'undefined') return undefined;
      var ro = new ResizeObserver(function (entries) {
        var r = entries[0].contentRect;
        setBox({ w: r.width, h: r.height });
      });
      ro.observe(el);
      return function () { ro.disconnect(); };
    }, []);

    // One loop for the life of the stage; the latest settings are read through
    // a ref so changing a control never restarts the animation.
    var live = useRef({});
    live.current = { params: props.params, style: props.style, size: size, onFrame: props.onFrame };

    useEffect(function () {
      var raf = 0;
      var last = performance.now();
      var t = 0;

      function tick(now) {
        var cur = live.current;
        var dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        if (!cur.params.paused) t += dt * cur.params.speed;
        DG.clock = t;
        if (cur.onFrame) cur.onFrame(t);

        var canvas = canvasRef.current;
        if (canvas) {
          var dpr = Math.min(window.devicePixelRatio || 1, 2);
          if (canvas.width !== cur.size.w * dpr || canvas.height !== cur.size.h * dpr) {
            canvas.width = cur.size.w * dpr;
            canvas.height = cur.size.h * dpr;
            canvas.style.width = cur.size.w + 'px';
            canvas.style.height = cur.size.h + 'px';
          }
          var ctx = canvas.getContext('2d');
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          var dots = DG.generateDots(cur.params, cur.size.w, cur.size.h, t);
          DG.renderDots(ctx, dots, {
            width: cur.size.w,
            height: cur.size.h,
            background: cur.style.background,
            solid: cur.style.solid,
            shape: cur.style.shape,
            useGradient: cur.style.useGradient
          });
        }
        raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);
      return function () { cancelAnimationFrame(raf); };
    }, []);

    return html`
      <div class="stage" ref=${wrapRef}>
        <canvas ref=${canvasRef} class=${'stage-canvas' + (props.style.background ? '' : ' is-transparent')}></canvas>
      </div>`;
  };

  /* ---- one pattern in the gallery, animating ---------------------------- */
  var THUMB_W = 168;

  DG.PatternThumb = function PatternThumb(props) {
    var ref = useRef(null);
    var live = useRef({});
    live.current = props;
    var THUMB_H = Math.round(THUMB_W / DG.frameRatio(props.params.frame));

    useEffect(function () {
      var raf = 0;
      function tick() {
        var cur = live.current;
        var canvas = ref.current;
        if (canvas) {
          var dpr = Math.min(window.devicePixelRatio || 1, 2);
          var h = Math.round(THUMB_W / DG.frameRatio(cur.params.frame));
          if (canvas.width !== THUMB_W * dpr) { canvas.width = THUMB_W * dpr; }
          if (canvas.height !== h * dpr) { canvas.height = h * dpr; }
          var ctx = canvas.getContext('2d');
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          var params = Object.assign({}, cur.params, {
            pattern: cur.pattern.id,
            grid: Math.min(22, cur.params.grid)
          });
          DG.renderDots(ctx, DG.generateDots(params, THUMB_W, h, DG.clock || 0), {
            width: THUMB_W,
            height: h,
            background: cur.style.background || '#0b0b0e',
            solid: cur.style.solid,
            shape: cur.style.shape,
            useGradient: cur.style.useGradient
          });
        }
        raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);
      return function () { cancelAnimationFrame(raf); };
    }, []);

    return html`
      <button type="button"
        class=${'thumb' + (props.active ? ' is-active' : '')}
        onClick=${function () { props.onSelect(props.pattern.id); }}
        title=${props.pattern.blurb}>
        <canvas ref=${ref} style=${{ height: THUMB_H }}></canvas>
        <span class="thumb-name">${props.pattern.name}</span>
      </button>`;
  };

  /* ---- controls --------------------------------------------------------- */
  DG.Slider = function Slider(props) {
    return html`
      <label class="ctrl">
        <span class="ctrl-head">
          <span>${props.label}</span>
          <span class="ctrl-val">${props.format ? props.format(props.value) : props.value.toFixed(2)}</span>
        </span>
        <input type="range" min=${props.min} max=${props.max}
          step=${props.step === undefined ? 0.01 : props.step}
          value=${props.value}
          onChange=${function (e) { props.onChange(parseFloat(e.target.value)); }} />
      </label>`;
  };

  DG.Choice = function Choice(props) {
    return html`
      <label class="ctrl">
        <span class="ctrl-head"><span>${props.label}</span></span>
        <select value=${props.value} onChange=${function (e) { props.onChange(e.target.value); }}>
          ${props.options.map(function (o) {
            return html`<option key=${o.id} value=${o.id}>${o.label}</option>`;
          })}
        </select>
      </label>`;
  };

  DG.AngleDial = function AngleDial(props) {
    var ref = useRef(null);
    var value = props.value;
    var onChange = props.onChange;

    var pick = useCallback(function (e) {
      var el = ref.current;
      if (!el) return;
      var b = el.getBoundingClientRect();
      var deg = (Math.atan2(e.clientY - (b.top + b.height / 2), e.clientX - (b.left + b.width / 2)) * 180) / Math.PI;
      if (deg < 0) deg += 360;
      onChange(Math.round(deg));
    }, [onChange]);

    var rad = (value * Math.PI) / 180;
    var cx = 30 + Math.cos(rad) * 21;
    var cy = 30 + Math.sin(rad) * 21;

    return html`
      <div class="dial-row">
        <svg ref=${ref} class="dial" viewBox="0 0 60 60" width="60" height="60"
          role="slider" aria-label="Pattern angle" aria-valuenow=${value} aria-valuemin=${0} aria-valuemax=${359} tabIndex=${0}
          onPointerDown=${function (e) { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); pick(e); }}
          onPointerMove=${function (e) { if (e.currentTarget.hasPointerCapture(e.pointerId)) pick(e); }}
          onKeyDown=${function (e) {
            if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange((value + 355) % 360);
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange((value + 5) % 360);
          }}>
          <circle cx="30" cy="30" r="27" class="dial-ring"></circle>
          <line x1="30" y1="30" x2=${cx} y2=${cy} class="dial-needle"></line>
          <circle cx=${cx} cy=${cy} r="4" class="dial-knob"></circle>
        </svg>
        <div class="dial-meta">
          <input type="number" min="0" max="359" value=${value} aria-label="Angle in degrees"
            onChange=${function (e) { onChange((((parseInt(e.target.value, 10) || 0) % 360) + 360) % 360); }} />
          <span class="unit">deg</span>
        </div>
      </div>`;
  };

  /*
   * Background and dot colour are two components rather than one, because the
   * panel wants them in different places: the background belongs with the
   * frame, near the top, and the dot colour with everything else that shapes a
   * dot.
   */
  DG.BackgroundControl = function BackgroundControl(props) {
    var params = props.params;
    var set = props.set;
    return html`
      <div class="swatches">
        ${DG.BACKGROUNDS.map(function (b) {
          return html`<button key=${b.id} type="button" title=${b.label}
            class=${'swatch' + (params.background === b.id ? ' is-active' : '') + (b.value ? '' : ' swatch-none')}
            style=${b.value ? { background: b.value } : {}}
            onClick=${function () { set({ background: b.id }); }}></button>`;
        })}
      </div>`;
  };

  DG.DotColourControl = function DotColourControl(props) {
    var params = props.params;
    var set = props.set;
    var isGradient = params.colorMode === 'gradient';

    return html`
      <${React.Fragment}>
        <div class="swatches">
          ${DG.SOLIDS.map(function (s) {
            return html`<button key=${s.id} type="button" title=${s.label}
              class=${'swatch' + (params.colorMode === s.id ? ' is-active' : '')}
              style=${{ background: s.value }}
              onClick=${function () { set({ colorMode: s.id }); }}></button>`;
          })}
          <button type="button" title="Gradient"
            class=${'swatch swatch-wide' + (isGradient ? ' is-active' : '')}
            style=${{ background: DG.cssGradient() }}
            onClick=${function () { set({ colorMode: 'gradient' }); }}></button>
        </div>
        ${isGradient && html`
          <div class="sub-block">
            <${DG.Choice} label="Gradient mapped to" value=${params.gradientMap}
              options=${DG.GRADIENT_MAPS}
              onChange=${function (v) { set({ gradientMap: v }); }} />
            <label class="check">
              <input type="checkbox" checked=${params.gradientReverse}
                onChange=${function (e) { set({ gradientReverse: e.target.checked }); }} />
              <span>Reverse ramp</span>
            </label>
          </div>`}
      <//>`;
  };

})(DG);
