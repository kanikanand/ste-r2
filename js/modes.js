/* ============================================================================
 * modes.js — three engines, one page.
 *
 * Each mode arrived as a whole app with DG.DEFAULTS and DG.generateDots to
 * itself. Rather than pick one and bend the others into it, each registers
 * under its own key and this file decides which one the renderer, the
 * recorder and the four exporters are talking to. None of them had to change:
 * they were already written against a list of dots in screen pixels and know
 * nothing about what made it.
 *
 * What is shared is what a mode has no opinion about — the frame, the download
 * size, the colours, the ground — and what is not shared is everything that
 * makes a mode itself. So each mode keeps its own settings while it is not
 * looking, and switching back returns to what was left rather than to the
 * defaults.
 * ==========================================================================*/
var DG = window.DG || (window.DG = {});

(function (DG) {
  'use strict';

  DG.ENGINES = {};

  DG.MODES = [
    { id: 'patterns', label: 'Patterns', blurb: 'A flat lattice, five motions' },
    { id: 'globe', label: 'Globe', blurb: 'The real world, in dots' },
    { id: 'sphere', label: 'Sphere', blurb: 'Orbiting particles, distorted' }
  ];

  /*
   * The settings that belong to the tool rather than to a mode. Changing the
   * frame or the palette in one mode changes it in all three, which is the
   * point of them being one tool; changing the grid density does not, because
   * two of the modes have no grid.
   */
  DG.SHARED_KEYS = [
    'frame', 'size', 'background', 'colorMode', 'mesh', 'meshBlend',
    'dotAlpha', 'highlightMode', 'paused'
  ];

  DG.SHARED_DEFAULTS = {
    frame: '16:9',
    size: 'L',
    background: 'white',
    colorMode: 'black',
    mesh: DG.MESH_DEFAULT,
    meshBlend: 0.65,
    dotAlpha: 1,
    highlightMode: 'red',
    paused: false
  };

  DG.engine = function (mode) {
    return DG.ENGINES[mode] || DG.ENGINES[DG.MODES[0].id];
  };

  /*
   * The settings one mode is working with: its own defaults, then whatever it
   * was left at, then the shared ones on top — shared last, so the tool's
   * palette wins over the default a mode was written with.
   */
  DG.modeParams = function (state) {
    var e = DG.engine(state.mode);
    return Object.assign({}, e.defaults, state.byMode[state.mode], state.shared, { mode: state.mode });
  };

  DG.isShared = function (key) {
    return DG.SHARED_KEYS.indexOf(key) !== -1;
  };

  /*
   * The engine each of these is for is looked up at the moment of the call,
   * not when this file loads: the engines register after it, and the mode
   * changes while the page is open.
   */
  function generateDots(params, width, height, t) {
    var e = DG.engine(params.mode);
    return e.dots(Object.assign({}, e.defaults, params), width, height, t);
  }

  function generateLabels(params, width, height, t) {
    var e = DG.engine(params.mode);
    if (!e.labels) return [];
    return e.labels(Object.assign({}, e.defaults, params), width, height, t);
  }

  /*
   * How a mode hands itself over. Each arrived as a whole app and writes its
   * DG.DEFAULTS and DG.generateDots on the way past, exactly as it did when it
   * was the only thing on the page; this takes them under the mode's own name
   * and puts the dispatcher back, so whichever engine loaded last does not end
   * up answering for all three.
   */
  DG.register = function (id, extra) {
    var e = Object.assign({
      id: id,
      defaults: DG.DEFAULTS,
      dots: DG.generateDots,
      labels: DG.generateLabels
    }, extra || {});
    DG.ENGINES[id] = e;
    DG.generateDots = generateDots;
    DG.generateLabels = generateLabels;
    delete DG.DEFAULTS;
    return e;
  };

  DG.generateDots = generateDots;
  DG.generateLabels = generateLabels;
})(DG);
