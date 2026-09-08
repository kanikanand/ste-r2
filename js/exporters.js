/* ============================================================================
 * exporters.js — PNG, SVG and settings downloads.
 *
 * Geometry is generated fresh at the export size rather than scaled up, so
 * output is resolution independent and the SVG is true vector circles.
 * ==========================================================================*/
var DG = window.DG || (window.DG = {});

(function (DG) {
  'use strict';

  function download(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  DG.exportPNG = function (params, sampler, style, size, filename) {
    var canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext('2d');
    DG.renderDots(ctx, DG.generateDots(params, size, sampler), {
      size: size,
      background: style.background,
      solid: style.solid,
      useGradient: style.useGradient
    });
    canvas.toBlob(function (blob) { if (blob) download(blob, filename); });
  };

  DG.exportSVG = function (params, sampler, style, size, filename) {
    var svg = DG.dotsToSVG(DG.generateDots(params, size, sampler), {
      size: size,
      background: style.background,
      solid: style.solid,
      useGradient: style.useGradient
    });
    download(new Blob([svg], { type: 'image/svg+xml' }), filename);
  };

  DG.exportJSON = function (params, filename) {
    download(new Blob([JSON.stringify(params, null, 2)], { type: 'application/json' }), filename);
  };
})(DG);
