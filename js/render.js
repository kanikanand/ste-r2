/* ============================================================================
 * render.js — frames, download sizes, and putting marks on a surface.
 *
 * Nothing here knows what it is drawing. It is handed a list of dots in screen
 * pixels and a few choices about colour, and it puts them on a canvas or into
 * an SVG. The globe that produced them is globe.js's business.
 * ==========================================================================*/
var DG = window.DG || (window.DG = {});

(function (DG) {
  'use strict';

  DG.FRAMES = [
    { id: '16:9', label: '16 : 9', ratio: 16 / 9 },
    { id: '1:1', label: '1 : 1', ratio: 1 },
    { id: '4:5', label: '4 : 5', ratio: 4 / 5 },
    { id: '9:16', label: '9 : 16', ratio: 9 / 16 }
  ];

  /*
   * Download sizes. The height is the fixed thing and the width follows the
   * frame's ratio, so the same tier gives a consistent object height whether
   * the frame is 16:9 or 9:16 — a wide frame is wider, not shorter.
   */
  DG.SIZES = [
    { id: 'S', label: 'S', height: 540 },
    { id: 'M', label: 'M', height: 810 },
    { id: 'L', label: 'L', height: 1080 }
  ];

  DG.sizeHeight = function (id) {
    for (var i = 0; i < DG.SIZES.length; i++) if (DG.SIZES[i].id === id) return DG.SIZES[i].height;
    return DG.SIZES[DG.SIZES.length - 1].height;
  };

  /* The pixel dimensions a download comes out at. */
  DG.exportSize = function (sizeId, frameId, height) {
    var h = height || DG.sizeHeight(sizeId);
    return { width: Math.round(h * DG.frameRatio(frameId)), height: h };
  };

  DG.frameRatio = function (id) {
    for (var i = 0; i < DG.FRAMES.length; i++) if (DG.FRAMES[i].id === id) return DG.FRAMES[i].ratio;
    return 16 / 9;
  };

  DG.renderDots = function (ctx, dots, opts) {
    ctx.save();
    ctx.clearRect(0, 0, opts.width, opts.height);
    if (opts.bgGradient) {
      // Top to bottom, matching the default mapping of the dot ramp, so a
      // gradient background and gradient dots read as one field rather than
      // as two ramps crossing.
      var g = ctx.createLinearGradient(0, 0, 0, opts.height);
      for (var st = 0; st < opts.bgGradient.length; st++) {
        g.addColorStop(opts.bgGradient[st][1], opts.bgGradient[st][0]);
      }
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, opts.width, opts.height);
    } else if (opts.background) {
      ctx.fillStyle = opts.background;
      ctx.fillRect(0, 0, opts.width, opts.height);
    }
    // After the background, never before: set on the whole context it would
    // fade the ground as well, and a half-opaque black on a white page is grey.
    if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
    if (!opts.useGradient) ctx.fillStyle = opts.solid;
    for (var i = 0; i < dots.length; i++) {
      var d = dots[i];
      // A picked country takes the highlight colour outright, gradient or not.
      // Running the ramp through it as well would leave the highlight reading
      // as a slightly different shade of the same thing in some parts of the
      // frame and not others, which is not a highlight.
      if (d.hot) ctx.fillStyle = opts.highlight;
      else if (opts.useGradient) ctx.fillStyle = d.color;
      else ctx.fillStyle = opts.solid;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
      ctx.fill();
    }
    if (opts.labels) drawLabels(ctx, opts);
    ctx.restore();
  };

  /*
   * A pill with the country's name, sitting above its anchor with a stem down
   * to it. Measured before it is drawn so the pill fits the word rather than
   * the word being trusted to fit the pill.
   */
  var LABEL_FONT = '500 {size}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

  function labelMetrics(opts) {
    var size = Math.max(11, Math.round(Math.min(opts.width, opts.height) * 0.026));
    return { size: size, padX: Math.round(size * 0.85), h: Math.round(size * 2.05),
      lift: Math.round(size * 1.9), dot: Math.max(2, Math.round(size * 0.2)) };
  }

  function drawLabels(ctx, opts) {
    var m = labelMetrics(opts);
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.font = LABEL_FONT.replace('{size}', m.size);
    ctx.textBaseline = 'middle';
    for (var i = 0; i < opts.labels.length; i++) {
      var L = opts.labels[i];
      var w = ctx.measureText(L.text).width + m.padX * 2 + m.size * 0.9;
      var x = L.x - w / 2;
      var y = L.y - m.lift - m.h / 2;
      ctx.globalAlpha = L.fade;

      ctx.beginPath();
      ctx.moveTo(L.x, L.y);
      ctx.lineTo(L.x, y + m.h);
      ctx.strokeStyle = opts.highlight;
      ctx.lineWidth = Math.max(1, m.size * 0.09);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(L.x, L.y, m.dot, 0, Math.PI * 2);
      ctx.fillStyle = opts.highlight;
      ctx.fill();

      roundRect(ctx, x, y, w, m.h, m.h / 2);
      ctx.fillStyle = opts.labelFill;
      ctx.fill();
      ctx.strokeStyle = opts.highlight;
      ctx.lineWidth = Math.max(1, m.size * 0.07);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x + m.padX + m.size * 0.22, y + m.h / 2, m.size * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = opts.highlight;
      ctx.fill();

      ctx.fillStyle = opts.labelText;
      ctx.fillText(L.text, x + m.padX + m.size * 0.9, y + m.h / 2 + 1);
    }
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  DG.dotsToSVG = function (dots, opts) {
    var body = dots.map(function (d) {
      var fill = d.hot ? ' fill="' + opts.highlight + '"'
        : (opts.useGradient ? ' fill="' + d.color + '"' : '');
      return '<circle cx="' + d.x.toFixed(2) + '" cy="' + d.y.toFixed(2) + '" r="' + d.r.toFixed(2) + '"' + fill + '/>';
    }).join('');

    /*
     * Labels as real text, not outlines. The file is meant to be opened and
     * edited, and a name that has been converted to paths cannot be corrected
     * or restyled. The pill is sized from an estimate here rather than a
     * measurement, since there is no canvas to ask — a little generous, so a
     * word never touches the edge of its own pill.
     */
    var type = '';
    if (opts.labels && opts.labels.length) {
      var m = labelMetrics(opts);
      type = opts.labels.map(function (L) {
        var w = L.text.length * m.size * 0.58 + m.padX * 2 + m.size * 0.9;
        var x = L.x - w / 2;
        var y = L.y - m.lift - m.h / 2;
        return '<g opacity="' + L.fade.toFixed(2) + '">' +
          '<line x1="' + L.x.toFixed(1) + '" y1="' + L.y.toFixed(1) + '" x2="' + L.x.toFixed(1) +
            '" y2="' + (y + m.h).toFixed(1) + '" stroke="' + opts.highlight +
            '" stroke-width="' + Math.max(1, m.size * 0.09).toFixed(1) + '"/>' +
          '<circle cx="' + L.x.toFixed(1) + '" cy="' + L.y.toFixed(1) + '" r="' + m.dot +
            '" fill="' + opts.highlight + '"/>' +
          '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + w.toFixed(1) +
            '" height="' + m.h + '" rx="' + (m.h / 2) + '" fill="' + opts.labelFill +
            '" stroke="' + opts.highlight + '" stroke-width="' + Math.max(1, m.size * 0.07).toFixed(1) + '"/>' +
          '<circle cx="' + (x + m.padX + m.size * 0.22).toFixed(1) + '" cy="' + (y + m.h / 2).toFixed(1) +
            '" r="' + (m.size * 0.3).toFixed(1) + '" fill="' + opts.highlight + '"/>' +
          '<text x="' + (x + m.padX + m.size * 0.9).toFixed(1) + '" y="' + (y + m.h / 2).toFixed(1) +
            '" fill="' + opts.labelText + '" font-family="ui-sans-serif, system-ui, sans-serif" font-size="' +
            m.size + '" font-weight="500" dominant-baseline="middle">' + esc(L.text) + '</text></g>';
      }).join('');
    }
    // A real gradient definition, not a flattened fill: the stops stay editable
    // wherever the file is opened.
    var defs = '';
    var ground = '';
    if (opts.bgGradient) {
      defs = '<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">' +
        opts.bgGradient.map(function (st) {
          return '<stop offset="' + (st[1] * 100).toFixed(1) + '%" stop-color="' + st[0] + '"/>';
        }).join('') + '</linearGradient></defs>';
      ground = '<rect width="' + opts.width + '" height="' + opts.height + '" fill="url(#bg)"/>';
    } else if (opts.background) {
      ground = '<rect width="' + opts.width + '" height="' + opts.height + '" fill="' + opts.background + '"/>';
    }

    return [
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + opts.width + '" height="' + opts.height +
        '" viewBox="0 0 ' + opts.width + ' ' + opts.height + '">',
      defs,
      ground,
      // fill-opacity on the group rather than a colour with alpha, so the
      // dots stay editable as flat fills wherever the file is opened.
      '<g' + (opts.useGradient ? '' : ' fill="' + opts.solid + '"') +
        (opts.alpha !== undefined && opts.alpha < 1 ? ' fill-opacity="' + opts.alpha + '"' : '') +
        '>' + body + '</g>',
      type,
      '</svg>'
    ].join('');
  };
})(DG);
