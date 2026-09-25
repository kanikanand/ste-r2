/* ============================================================================
 * color.js — the suite's palette, its four-stop ramp, and gradient mapping.
 *
 * One palette for all three modes, and the same one for dots and for grounds:
 * black, white, the three pastels and the red.
 *
 * The gradient is a mesh rather than a ramp. A ramp has one direction and
 * every colour in a fixed order along it; a mesh has each colour standing at a
 * place in the frame, and what any point takes is the blend of whichever nodes
 * are near it. So the same four colours can be a wash from one corner, a
 * pocket of red in the middle of a cool field, or anything else, without a
 * direction control — where the colour is *is* the control.
 * ==========================================================================*/
var DG = window.DG || (window.DG = {});

(function (DG) {
  'use strict';

  DG.MESH_COLOURS = ['#ebbfff', '#ffd091', '#babeff', '#ff0000'];

  DG.SOLIDS = [
    { id: 'black', label: 'Black', value: '#000000' },
    { id: 'white', label: 'White', value: '#ffffff' },
    { id: 'lilac', label: 'Lilac', value: '#ebbfff' },
    { id: 'apricot', label: 'Apricot', value: '#ffd091' },
    { id: 'periwinkle', label: 'Periwinkle', value: '#babeff' },
    { id: 'red', label: 'Red', value: '#ff0000' }
  ];

  /* The same list for the ground, with nothing at all and the ramp added. */
  DG.BACKGROUNDS = [
    { id: 'transparent', label: 'Transparent', value: null },
    { id: 'black', label: 'Black', value: '#000000' },
    { id: 'white', label: 'White', value: '#ffffff' },
    { id: 'lilac', label: 'Lilac', value: '#ebbfff' },
    { id: 'apricot', label: 'Apricot', value: '#ffd091' },
    { id: 'periwinkle', label: 'Periwinkle', value: '#babeff' },
    { id: 'red', label: 'Red', value: '#ff0000' },
    // Painted from the same four stops as the dots, so the two stay in step.
    { id: 'gradient', label: 'Gradient', value: null, gradient: true }
  ];

  function hexToRgb(hex) {
    var h = String(hex).replace('#', '');
    if (h.length === 3) h = h.replace(/./g, function (c) { return c + c; });
    var n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgbToHex(c) {
    return '#' + c.map(function (v) {
      return Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0');
    }).join('');
  }

  /* ---- the mesh ---------------------------------------------------------- */

  /*
   * Where the four colours stand by default, which is the arrangement in the
   * reference: red up at the top, apricot out to the right, lilac low on the
   * left and periwinkle at the foot. Positions are fractions of the frame, so
   * a mesh set up in 16:9 keeps its shape in 9:16.
   */
  DG.MESH_DEFAULT = [
    { x: 0.16, y: 0.10, c: '#ff0000' },
    { x: 0.88, y: 0.48, c: '#ffd091' },
    { x: 0.11, y: 0.63, c: '#ebbfff' },
    { x: 0.31, y: 0.96, c: '#babeff' }
  ];

  DG.MESH_MAX = 8;

  /* Clamped into the frame, and never fewer than two — one node is a flat fill. */
  var tidyMesh = (DG.tidyMesh = function (nodes) {
    var list = (nodes && nodes.length >= 2 ? nodes : DG.MESH_DEFAULT).slice(0, DG.MESH_MAX);
    return list.map(function (n, i) {
      var d = DG.MESH_DEFAULT[i % DG.MESH_DEFAULT.length];
      return {
        x: Math.max(0, Math.min(1, typeof n.x === 'number' ? n.x : d.x)),
        y: Math.max(0, Math.min(1, typeof n.y === 'number' ? n.y : d.y)),
        c: n.c || d.c
      };
    });
  });

  /*
   * A sampler for one arrangement, built once and then asked for point after
   * point — the node colours are unpacked here rather than inside the loop
   * that runs over every dot in the frame.
   *
   * The blend is inverse distance weighting: each node pulls the colour
   * towards itself by one over its distance raised to a power, and the pulls
   * are normalised. Two things follow from writing it that way, and both are
   * what a mesh wants. A node's own colour comes out exactly at the node,
   * because its weight runs away as the distance closes. And every point in
   * the frame is defined, however the nodes are arranged, so there is no
   * outside the mesh and no seam at its edge.
   *
   * Blend is that power, read backwards so the control runs the way it reads:
   * a high power makes the weight fall away quickly and each node holds a
   * small pocket, a low one lets them all reach across the frame. So Blend at
   * zero is pockets with hard ground between them, and at one it is a wash.
   */
  DG.meshSampler = function (nodes, blend) {
    var list = tidyMesh(nodes);
    var n = list.length;
    var xs = new Float64Array(n), ys = new Float64Array(n);
    var rs = new Float64Array(n), gs = new Float64Array(n), bs = new Float64Array(n);
    for (var i = 0; i < n; i++) {
      xs[i] = list[i].x; ys[i] = list[i].y;
      var c = hexToRgb(list[i].c);
      rs[i] = c[0]; gs[i] = c[1]; bs[i] = c[2];
    }
    var b = Math.max(0, Math.min(1, blend === undefined ? 0.5 : blend));
    var power = 2.6 - 1.7 * b;
    var half = power;                      // the distance is already squared
    var out = [0, 0, 0];

    return function (u, v) {
      var wr = 0, wg = 0, wb = 0, sum = 0;
      for (var k = 0; k < n; k++) {
        var dx = u - xs[k], dy = v - ys[k];
        // The floor keeps the weight finite at the node itself, where the
        // distance is zero and one over it is not a number.
        var w = Math.pow(dx * dx + dy * dy + 0.0012, -half);
        wr += rs[k] * w; wg += gs[k] * w; wb += bs[k] * w; sum += w;
      }
      out[0] = wr / sum; out[1] = wg / sum; out[2] = wb / sum;
      return out;
    };
  };

  /*
   * The same, handing back a colour string, with the strings kept. A frame of
   * seven thousand dots would otherwise build seven thousand of them every
   * time it is drawn, and there are only ever a few thousand distinct colours
   * in a mesh of four.
   */
  DG.meshHexSampler = function (nodes, blend) {
    var sample = DG.meshSampler(nodes, blend);
    var seen = {};
    return function (u, v) {
      var c = sample(u, v);
      var key = (Math.round(c[0]) << 16) | (Math.round(c[1]) << 8) | Math.round(c[2]);
      var hex = seen[key];
      if (hex === undefined) { hex = seen[key] = rgbToHex(c); }
      return hex;
    };
  };

  /*
   * The mesh as pixels. Drawn small and stretched: the field is smooth, so a
   * few hundred samples upscaled is indistinguishable from one sample per
   * pixel and costs a thousandth as much — which matters when a minute of
   * footage is eighteen hundred frames. Kept against the arrangement that
   * produced it, since the nodes do not move while a clip is recording.
   */
  var rasterCache = { key: '', canvas: null };
  var RASTER_W = 160;

  DG.meshRaster = function (nodes, blend, ratio) {
    var w = RASTER_W;
    var h = Math.max(8, Math.round(RASTER_W / (ratio || 1)));
    var key = JSON.stringify(tidyMesh(nodes)) + '|' + blend + '|' + w + 'x' + h;
    if (rasterCache.key === key) return rasterCache.canvas;

    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var ctx = c.getContext('2d');
    var img = ctx.createImageData(w, h);
    var data = img.data;
    var sample = DG.meshSampler(nodes, blend);
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        // Sampled at the middle of each cell, so the smoothing that stretches
        // it has a value on both sides of every edge and the border is not
        // half a cell of flat colour.
        var col = sample((x + 0.5) / w, (y + 0.5) / h);
        var i = (y * w + x) * 4;
        data[i] = col[0]; data[i + 1] = col[1]; data[i + 2] = col[2]; data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    rasterCache.key = key;
    rasterCache.canvas = c;
    return c;
  };

  /*
   * A CSS stand-in, for the swatches and the editor's own backdrop. Layered
   * radial gradients are not the same arithmetic as the sampler, but at the
   * size of a swatch nothing could tell them apart, and it costs no canvas.
   */
  DG.cssMesh = function (nodes, blend) {
    var list = tidyMesh(nodes);
    var spread = 46 + 34 * Math.max(0, Math.min(1, blend === undefined ? 0.5 : blend));
    var layers = list.slice().reverse().map(function (n) {
      return 'radial-gradient(circle at ' + (n.x * 100).toFixed(1) + '% ' + (n.y * 100).toFixed(1) +
        '%, ' + n.c + ' 0%, ' + n.c + '00 ' + spread.toFixed(0) + '%)';
    });
    // The last one also paints the ground, so there is no gap behind them.
    return layers.join(', ') + ', ' + list[0].c;
  };

  /*
   * Black or white, whichever the pill's own ground can carry. Relative
   * luminance rather than a plain average: the eye takes far more of its
   * brightness from green than from blue, and an average calls mid-blue light
   * when it reads as dark.
   */
  DG.readableOn = function (hex) {
    var c = hexToRgb(hex).map(function (v) {
      var x = v / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    });
    var L = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    return L > 0.36 ? '#0a0a0a' : '#ffffff';
  };

})(DG);
