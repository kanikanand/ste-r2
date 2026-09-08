/* ============================================================================
 * image.js — image mode.
 *
 * The uploaded picture is cover-fitted into the frame and read back as
 * luminance, so light in the photograph becomes dot height, size and density.
 * ==========================================================================*/
var DG = window.DG || (window.DG = {});

(function (DG) {
  'use strict';

  var RES_H = 288;
  var RES_W = Math.round(RES_H * DG.ASPECT);

  var samplerId = 0;

  DG.createSampler = function (img) {
    var canvas = document.createElement('canvas');
    canvas.width = RES_W;
    canvas.height = RES_H;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, RES_W, RES_H);

    var scale = Math.max(RES_W / img.naturalWidth, RES_H / img.naturalHeight);
    var w = img.naturalWidth * scale;
    var h = img.naturalHeight * scale;
    ctx.drawImage(img, (RES_W - w) / 2, (RES_H - h) / 2, w, h);

    var data = ctx.getImageData(0, 0, RES_W, RES_H).data;
    var lum = new Float32Array(RES_W * RES_H);
    for (var i = 0; i < lum.length; i++) {
      var o = i * 4;
      lum[i] = (0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]) / 255;
    }

    // Addressed in frame coordinates: u and v run 0..1 across the whole frame.
    var sample = function (u, v) {
      var px = Math.round(u * (RES_W - 1));
      var py = Math.round(v * (RES_H - 1));
      if (px < 0 || py < 0 || px >= RES_W || py >= RES_H) return 0;
      return lum[py * RES_W + px];
    };
    sample.samplerId = ++samplerId;   // lets the line cache tell images apart
    return sample;
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
