/* ============================================================================
 * image.js — image mode.
 *
 * The uploaded picture is cover-fitted into the square and read back as
 * luminance, so light in the photograph becomes dot size and density.
 * ==========================================================================*/
var DG = window.DG || (window.DG = {});

(function (DG) {
  'use strict';

  var RES = 384;

  DG.createSampler = function (img) {
    var canvas = document.createElement('canvas');
    canvas.width = RES;
    canvas.height = RES;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, RES, RES);

    var scale = Math.max(RES / img.naturalWidth, RES / img.naturalHeight);
    var w = img.naturalWidth * scale;
    var h = img.naturalHeight * scale;
    ctx.drawImage(img, (RES - w) / 2, (RES - h) / 2, w, h);

    var data = ctx.getImageData(0, 0, RES, RES).data;
    var lum = new Float32Array(RES * RES);
    for (var i = 0; i < lum.length; i++) {
      var o = i * 4;
      lum[i] = (0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) / 255;
    }

    return function (nx, ny) {
      var px = Math.round(((nx + 1) / 2) * (RES - 1));
      var py = Math.round(((ny + 1) / 2) * (RES - 1));
      if (px < 0 || py < 0 || px >= RES || py >= RES) return 0;
      return lum[py * RES + px];
    };
  };

  DG.loadImageFile = function (file) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () { resolve({ img: img, url: url }); };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('Could not read that image.'));
      };
      img.src = url;
    });
  };
})(DG);
