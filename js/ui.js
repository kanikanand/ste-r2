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

    /*
     * Dragging aims whichever mode wants aiming, and each is dragged the way
     * it was written to be: the globe moves its heading and lean, the sphere
     * its own two rotations at the rate the prototype used, and the flat
     * patterns have no camera to aim so the pointer does nothing. The angle
     * lives in the settings rather than in a rotation held here, so what you
     * drag to is what an export draws.
     *
     * Both signs follow the surface rather than the camera: drag right and
     * what is under the pointer goes right, as though the form itself were
     * being pushed.
     */
    var drag = useRef(null);

    function draggable() {
      return props.params.mode === 'globe' || props.params.mode === 'sphere';
    }

    function onDown(e) {
      if (!draggable()) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = { x: e.clientX, y: e.clientY };
    }

    function onMove(e) {
      if (!drag.current || !e.currentTarget.hasPointerCapture(e.pointerId)) return;
      var d = drag.current;
      var mx = e.clientX - d.x;
      var my = e.clientY - d.y;
      drag.current = { x: e.clientX, y: e.clientY };

      if (props.params.mode === 'sphere') {
        // The prototype's own rate, in radians a pixel.
        props.set({
          rotY: props.params.rotY + mx * 0.005,
          rotX: props.params.rotX + my * 0.005
        });
        return;
      }

      /*
       * The globe. Scaled by the radius, so the grab keeps pace with the
       * pointer at any globe size, and the pointer's travel is turned back
       * through the axis tilt before it is read — that tilt is a roll applied
       * after everything else, so on a tilted globe the screen's right is not
       * the globe's right.
       */
      var span = Math.max(80, size.w * props.params.globeSize * 0.5);
      var a = (props.params.axisTilt || 0) * Math.PI / 180;
      var ca = Math.cos(a), sa = Math.sin(a);
      var gx = mx * ca + (-my) * sa;
      var gy = -mx * sa + (-my) * ca;

      var heading = props.params.heading + gx / span * 90;
      var tilt = props.params.tilt - gy / span * 90;
      props.set({
        heading: ((heading % 360) + 360) % 360,
        tilt: Math.max(-80, Math.min(80, tilt))
      });
    }

    function onUp(e) {
      drag.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    }

    /*
     * The wheel zooms the sphere, as it did in the prototype, between the same
     * two stops. Registered by hand rather than as a React prop because a
     * passive listener cannot stop the page scrolling under it.
     */
    var wheelLive = useRef(null);
    wheelLive.current = { params: props.params, set: props.set };

    useEffect(function () {
      var el = canvasRef.current;
      if (!el) return undefined;
      function onWheel(e) {
        var cur = wheelLive.current;
        if (cur.params.mode !== 'sphere') return;
        e.preventDefault();
        var z = cur.params.cameraZ + e.deltaY * 0.5;
        cur.set({ cameraZ: Math.max(200, Math.min(1000, z)) });
      }
      el.addEventListener('wheel', onWheel, { passive: false });
      return function () { el.removeEventListener('wheel', onWheel); };
    }, []);

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
            useGradient: cur.style.useGradient,
            alpha: cur.style.alpha,
            mesh: cur.style.mesh,
            meshBlend: cur.style.meshBlend,
            highlight: cur.style.highlight,
            labelFill: cur.style.labelFill,
            labelText: cur.style.labelText,
            labels: DG.generateLabels(cur.params, cur.size.w, cur.size.h, t)
          });
        }
        raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);
      return function () { cancelAnimationFrame(raf); };
    }, []);

    return html`
      <div class="stage" ref=${wrapRef}>
        <canvas ref=${canvasRef} class=${'stage-canvas' + (props.style.background ? '' : ' is-transparent') +
            (draggable() ? ' is-draggable' : '')}
          onPointerDown=${onDown} onPointerMove=${onMove} onPointerUp=${onUp} onPointerCancel=${onUp}></canvas>
      </div>`;
  };

  /* ---- one preset in a gallery, animating ------------------------------- */
  var THUMB_W = 168;

  /*
   * A live thumbnail of one preset. It renders the same engine the stage does,
   * with whatever the preset overrides, so a gallery is never a set of stale
   * pictures — change the palette or the frame and every thumbnail follows.
   * The grid is capped on the way in, because a hundred and sixty rings in a
   * hundred and sixty pixels is a grey rectangle.
   */
  DG.PresetThumb = function PresetThumb(props) {
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
          var params = Object.assign({}, cur.params, cur.preset.params);
          if (params.grid) params.grid = Math.min(22, params.grid);
          if (params.count) params.count = Math.min(900, params.count);
          DG.renderDots(ctx, DG.generateDots(params, THUMB_W, h, DG.clock || 0), {
            width: THUMB_W,
            height: h,
            background: cur.style.background || '#ffffff',
            solid: cur.style.solid,
            useGradient: cur.style.useGradient,
            alpha: cur.style.alpha,
            mesh: cur.style.mesh,
            meshBlend: cur.style.meshBlend,
            highlight: cur.style.highlight
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
        onClick=${props.onSelect}
        title=${props.preset.blurb || props.preset.name}>
        <canvas ref=${ref} style=${{ height: THUMB_H }}></canvas>
        <span class="thumb-name">${props.preset.name}</span>
      </button>`;
  };

  /*
   * The country picker. 177 names is too many for a list of buttons and too
   * few to need searching machinery, so it is a text field with the whole set
   * behind a datalist — type two letters and the browser offers the rest — and
   * the chosen ones sit underneath as chips you can take off again.
   */
  DG.CountryPicker = function CountryPicker(props) {
    var picked = props.picked;
    var set = props.set;
    var textState = useState('');
    var text = textState[0];
    var setText = textState[1];
    var names = DG.countryNames();

    function add(value) {
      var i = DG.countryIndex(value);
      if (i < 0) return;
      if (picked.indexOf(i) < 0) set({ highlights: picked.concat([i]) });
      setText('');
    }

    function remove(i) {
      set({ highlights: picked.filter(function (x) { return x !== i; }) });
    }

    return html`
      <${React.Fragment}>
        <form class="picker" onSubmit=${function (e) { e.preventDefault(); add(text); }}>
          <input type="text" list="dg-countries" placeholder="Add a country" value=${text}
            onChange=${function (e) {
              var v = e.target.value;
              setText(v);
              // Choosing from the browser's own list fires a change with the
              // whole name, so an exact match is taken as a pick rather than
              // waiting for a keypress that will never come.
              if (names.indexOf(v) >= 0) add(v);
            }} />
          <datalist id="dg-countries">
            ${names.map(function (n, i) { return html`<option key=${i} value=${n}></option>`; })}
          </datalist>
          <button type="submit" class="ghost">Add</button>
        </form>
        ${picked.length > 0 && html`
          <div class="chips chips-wrap">
            ${picked.map(function (i) {
              return html`<button key=${i} type="button" class="chip chip-pick"
                title="Remove" onClick=${function () { remove(i); }}>${names[i]}<span class="x">×</span></button>`;
            })}
          </div>`}
        ${picked.length > 0 && html`
          <button type="button" class="ghost wide"
            onClick=${function () { set({ highlights: [] }); }}>Clear all</button>`}
        ${picked.length === 0 && html`
          <p class="note">Nothing picked yet — the globe shows land alone. Add a country and it lifts out of the surface.</p>`}
      <//>`;
  };

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
  /*
   * Where the three ramp colours sit. One set of positions serves the dot ramp
   * and the gradient background alike — they are the same three colours, and
   * letting them drift apart gives you two different gradients on one page.
   *
   * Each slider is bounded by its neighbours rather than left free and sorted
   * afterwards: sorting after the fact makes a dragged stop jump past the one
   * it met, which feels like the control fighting you.
   */
  /* ---- the mesh editor --------------------------------------------------
   *
   * The mesh is edited where it can be seen: a small frame of the gradient
   * itself with a ring on every node, dragged to where the colour should be.
   * Pick a ring and the palette below sets that node's colour. It is the whole
   * of the control — there is no direction to choose, because a mesh has none,
   * and where a colour is standing is the only thing there is to say about it.
   * ---------------------------------------------------------------------- */
  DG.MeshControls = function MeshControls(props) {
    var nodes = DG.tidyMesh(props.nodes);
    var blend = props.blend === undefined ? 0.5 : props.blend;
    var set = props.set;
    var boxRef = useRef(null);
    var canvasRef = useRef(null);
    var pickedState = useState(0);
    var picked = Math.min(pickedState[0], nodes.length - 1);
    var setPicked = pickedState[1];
    var ratio = DG.frameRatio(props.frame);

    function put(i, patch) {
      var next = nodes.map(function (n, k) { return k === i ? Object.assign({}, n, patch) : n; });
      set({ mesh: next });
    }

    function addNode() {
      if (nodes.length >= DG.MESH_MAX) return;
      // Somewhere there is not already a node, rather than always the middle:
      // two nodes on the same spot is a colour you cannot get hold of again.
      var c = DG.MESH_COLOURS[nodes.length % DG.MESH_COLOURS.length];
      var next = nodes.concat([{ x: 0.2 + 0.6 * Math.random(), y: 0.2 + 0.6 * Math.random(), c: c }]);
      set({ mesh: next });
      setPicked(next.length - 1);
    }

    function removeNode() {
      if (nodes.length <= 2) return;
      set({ mesh: nodes.filter(function (n, k) { return k !== picked; }) });
      setPicked(Math.max(0, picked - 1));
    }

    /* Dragging. The pointer is captured on the frame, not on the ring, so a
       fast drag that outruns the ring does not drop it. */
    var drag = useRef(null);

    function place(e) {
      var el = boxRef.current;
      if (!el) return null;
      var r = el.getBoundingClientRect();
      return {
        x: Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)),
        y: Math.max(0, Math.min(1, (e.clientY - r.top) / r.height))
      };
    }

    function nearest(pt) {
      var best = 0, bestD = Infinity;
      for (var i = 0; i < nodes.length; i++) {
        var d = (nodes[i].x - pt.x) * (nodes[i].x - pt.x) + (nodes[i].y - pt.y) * (nodes[i].y - pt.y);
        if (d < bestD) { bestD = d; best = i; }
      }
      return { i: best, d: Math.sqrt(bestD) };
    }

    function onDown(e) {
      var pt = place(e);
      if (!pt) return;
      var near = nearest(pt);
      if (near.d > 0.12) return;             // a miss is a miss, not a jump
      e.currentTarget.setPointerCapture(e.pointerId);
      drag.current = near.i;
      setPicked(near.i);
      put(near.i, pt);
    }

    function onMove(e) {
      if (drag.current === null || drag.current === undefined) return;
      var pt = place(e);
      if (pt) put(drag.current, pt);
    }

    function onUp(e) {
      drag.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
    }

    /* The backdrop is the real sampler, not a CSS stand-in: this is the one
       place the arrangement has to be shown exactly as it will be drawn. */
    useEffect(function () {
      var canvas = canvasRef.current;
      var box = boxRef.current;
      if (!canvas || !box) return;
      var w = Math.max(40, Math.round(box.clientWidth));
      var h = Math.max(24, Math.round(w / ratio));
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr; canvas.height = h * dpr;
      }
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      var ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var tile = DG.meshRaster(nodes, blend, ratio);
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(tile, 0, 0, tile.width, tile.height, 0, 0, w, h);
    });

    return html`
      <div class="sub-block">
        <div class="mesh-box" ref=${boxRef} style=${{ aspectRatio: String(ratio) }}
          onPointerDown=${onDown} onPointerMove=${onMove} onPointerUp=${onUp} onPointerCancel=${onUp}>
          <canvas ref=${canvasRef} class="mesh-canvas"></canvas>
          ${nodes.map(function (n, i) {
            return html`<span key=${i}
              class=${'mesh-node' + (i === picked ? ' is-picked' : '')}
              style=${{ left: (n.x * 100) + '%', top: (n.y * 100) + '%' }}></span>`;
          })}
        </div>

        <span class="ctrl-label">Node ${picked + 1} of ${nodes.length}</span>
        <div class="swatches">
          ${DG.SOLIDS.map(function (c) {
            return html`<button key=${c.id} type="button" title=${c.label}
              class=${'swatch' + (nodes[picked].c === c.value ? ' is-active' : '')}
              style=${{ background: c.value }}
              onClick=${function () { put(picked, { c: c.value }); }}></button>`;
          })}
        </div>
        <div class="row">
          <button type="button" class="ghost" disabled=${nodes.length >= DG.MESH_MAX}
            onClick=${addNode}>Add node</button>
          <button type="button" class="ghost" disabled=${nodes.length <= 2}
            onClick=${removeNode}>Remove</button>
        </div>
        <${DG.Slider} label="Blend" value=${blend} min=${0} max=${1} step=${0.01}
          format=${function (v) { return v < 0.02 ? 'pockets' : v > 0.98 ? 'one wash' : Math.round(v * 100) + '%'; }}
          onChange=${function (v) { set({ meshBlend: v }); }} />
        <p class="note">Drag a ring to move its colour. Blend is how far each
           node reaches — low keeps them as pockets, high makes one wash.</p>
      </div>`;
  };

  DG.BackgroundControl = function BackgroundControl(props) {
    var params = props.params;
    var set = props.set;
    return html`
      <${React.Fragment}>
      <div class="swatches">
        ${DG.BACKGROUNDS.map(function (b) {
          return html`<button key=${b.id} type="button" title=${b.label}
            class=${'swatch' + (params.background === b.id ? ' is-active' : '') +
              (b.value || b.gradient ? '' : ' swatch-none') + (b.gradient ? ' swatch-wide' : '')}
            style=${b.gradient ? { background: DG.cssMesh(params.mesh, params.meshBlend) } : (b.value ? { background: b.value } : {})}
            onClick=${function () { set({ background: b.id }); }}></button>`;
        })}
      </div>
    <//>`;
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
          <button type="button" title="Mesh gradient"
            class=${'swatch swatch-wide' + (isGradient ? ' is-active' : '')}
            style=${{ background: DG.cssMesh(params.mesh, params.meshBlend) }}
            onClick=${function () { set({ colorMode: 'gradient' }); }}></button>
        </div>
      <//>`;
  };

})(DG);
