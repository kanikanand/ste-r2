/* ============================================================================
 * color.js — palette, the three-stop brand ramp, and gradient mapping.
 * ==========================================================================*/
var DG = window.DG || (window.DG = {});

(function (DG) {
  'use strict';

  var GRADIENT_STOPS = (DG.GRADIENT_STOPS = ['#de2027', '#687099', '#c5eef9']);

  DG.SOLIDS = [
    { id: 'red', label: 'Red', value: '#de2027' },
    { id: 'slate', label: 'Slate', value: '#687099' },
    { id: 'ice', label: 'Ice', value: '#c5eef9' },
    { id: 'white', label: 'White', value: '#ffffff' },
    { id: 'black', label: 'Black', value: '#0a0a0a' }
  ];

  /* Backgrounds, including the brand solids. */
  DG.BACKGROUNDS = [
    { id: 'transparent', label: 'Transparent', value: null },
    { id: 'black', label: 'Black', value: '#000000' },
    { id: 'ink', label: 'Ink', value: '#12141c' },
    { id: 'red', label: 'Red', value: '#de2027' },
    { id: 'slate', label: 'Slate', value: '#687099' },
    { id: 'ice', label: 'Ice', value: '#c5eef9' },
    { id: 'paper', label: 'Paper', value: '#f5f2ec' },
    { id: 'white', label: 'White', value: '#ffffff' },
    // Painted from the same three stops as the dots, so the two stay in step.
    { id: 'gradient', label: 'Gradient', value: null, gradient: true }
  ];

  /*
   * Every map is positional. Mapping colour to the dot's own value was the one
   * that let the gradient restate the form, which then read as a field made of
   * colour rather than of size.
   */
  DG.GRADIENT_MAPS = [
    { id: 'x', label: 'Horizontal' },
    { id: 'y', label: 'Vertical' },
    { id: 'radial', label: 'Radial' },
    { id: 'angle', label: 'Angular' }
  ];

  function hexToRgb(hex) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h.replace(/./g, function (c) { return c + c; });
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgbToHex(c) {
    return '#' + c.map(function (v) {
      return Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
    }).join('');
  }

  var STOP_RGB = GRADIENT_STOPS.map(hexToRgb);

  /* Where each colour sits along the ramp, 0..1. */
  DG.DEFAULT_STOPS = [0, 0.5, 1];

  /*
   * Kept sorted and never coincident. Two stops at the same position make the
   * segment between them zero-wide, and the ramp either divides by zero or
   * turns into a hard edge depending on which way the rounding falls.
   */
  var tidyStops = (DG.tidyStops = function (stops) {
    var s = (stops && stops.length === STOP_RGB.length ? stops : DG.DEFAULT_STOPS).slice();
    for (var i = 0; i < s.length; i++) {
      var v = typeof s[i] === 'number' ? s[i] : DG.DEFAULT_STOPS[i];
      s[i] = v < 0 ? 0 : v > 1 ? 1 : v;
    }
    for (i = 1; i < s.length; i++) if (s[i] < s[i - 1] + 0.01) s[i] = Math.min(1, s[i - 1] + 0.01);
    for (i = s.length - 2; i >= 0; i--) if (s[i] > s[i + 1] - 0.01) s[i] = Math.max(0, s[i + 1] - 0.01);
    return s;
  });

  function sampleGradient(t, stops) {
    var pos = tidyStops(stops);
    var c = t <= 0 ? 0 : t >= 1 ? 1 : t;
    // Outside the first and last stop the ramp holds its end colour, which is
    // what lets a stop be dragged inward without the ends going undefined.
    if (c <= pos[0]) return GRADIENT_STOPS[0];
    if (c >= pos[pos.length - 1]) return GRADIENT_STOPS[GRADIENT_STOPS.length - 1];
    var i = 0;
    while (i < pos.length - 2 && c > pos[i + 1]) i++;
    var f = (c - pos[i]) / (pos[i + 1] - pos[i]);
    var a = STOP_RGB[i];
    var b = STOP_RGB[i + 1];
    return rgbToHex([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]);
  }
  DG.sampleGradient = sampleGradient;

  DG.buildRamp = function (steps, stops) {
    var n = steps || 96;
    var pos = tidyStops(stops);
    var out = new Array(n);
    for (var i = 0; i < n; i++) out[i] = sampleGradient(i / (n - 1), pos);
    return out;
  };

  /* The stops as [colour, position] pairs, for canvas and SVG alike. */
  DG.gradientStops = function (stops) {
    var pos = tidyStops(stops);
    return GRADIENT_STOPS.map(function (c, i) { return [c, pos[i]]; });
  };

  DG.cssGradient = function (dir, stops) {
    var pos = tidyStops(stops);
    return 'linear-gradient(' + (dir || 'to right') + ', ' +
      GRADIENT_STOPS.map(function (c, i) { return c + ' ' + Math.round(pos[i] * 100) + '%'; }).join(', ') + ')';
  };

  DG.gradientCoord = function (map, dot) {
    switch (map) {
      case 'x': return (dot.nx + 1) / 2;
      case 'y': return (dot.ny + 1) / 2;
      case 'radial': return Math.min(1, Math.hypot(dot.nx, dot.ny) / Math.SQRT2);
      // Mirrored rather than wrapped, so both ends of the circle land on the
      // same colour instead of meeting as a hard seam.
      case 'angle': return Math.abs(Math.atan2(dot.ny, dot.nx)) / Math.PI;
      default: return (dot.ny + 1) / 2;
    }
  };
})(DG);
