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
    { id: 'white', label: 'White', value: '#ffffff' }
  ];

  DG.GRADIENT_MAPS = [
    { id: 'intensity', label: 'Dot size' },
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

  function sampleGradient(t) {
    var c = t <= 0 ? 0 : t >= 1 ? 1 : t;
    var seg = c * (STOP_RGB.length - 1);
    var i = Math.min(STOP_RGB.length - 2, Math.floor(seg));
    var f = seg - i;
    var a = STOP_RGB[i];
    var b = STOP_RGB[i + 1];
    return rgbToHex([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]);
  }
  DG.sampleGradient = sampleGradient;

  DG.buildRamp = function (steps) {
    var n = steps || 96;
    var out = new Array(n);
    for (var i = 0; i < n; i++) out[i] = sampleGradient(i / (n - 1));
    return out;
  };

  DG.cssGradient = function (dir) {
    return 'linear-gradient(' + (dir || 'to right') + ', ' + GRADIENT_STOPS.join(', ') + ')';
  };

  DG.gradientCoord = function (map, dot) {
    switch (map) {
      case 'x': return (dot.nx + 1) / 2;
      case 'y': return (dot.ny + 1) / 2;
      case 'radial': return Math.min(1, Math.hypot(dot.nx, dot.ny) / Math.SQRT2);
      // Mirrored rather than wrapped, so both ends of the circle land on the
      // same colour instead of meeting as a hard seam.
      case 'angle': return Math.abs(Math.atan2(dot.ny, dot.nx)) / Math.PI;
      default: return dot.v;
    }
  };
})(DG);
