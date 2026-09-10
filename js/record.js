/* ============================================================================
 * record.js — stills and footage.
 *
 * The patterns loop with a period of one cycle, so an export is recorded over a
 * whole number of cycles and the file loops without a jump at the join. The
 * requested length is kept exactly: the number of cycles is chosen to suit it
 * and the clock is stretched to fit.
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
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }
  DG.download = download;

  /* ---- stills, at the moment the button is pressed ---------------------- */

  /* SVG keeps the background. */
  DG.exportSVG = function (params, style, t, width, filename) {
    var height = Math.round(width / DG.frameRatio(params.frame));
    var svg = DG.dotsToSVG(DG.generateDots(params, width, height, t), {
      width: width,
      height: height,
      background: style.background,
      solid: style.solid,
      shape: style.shape,
      useGradient: style.useGradient
    });
    download(new Blob([svg], { type: 'image/svg+xml' }), filename);
  };

  /* PNG leaves it out, so the frame drops straight onto something else. */
  DG.exportPNG = function (params, style, t, width, filename) {
    var height = Math.round(width / DG.frameRatio(params.frame));
    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    DG.renderDots(canvas.getContext('2d'), DG.generateDots(params, width, height, t), {
      width: width,
      height: height,
      background: null,
      solid: style.solid,
      shape: style.shape,
      useGradient: style.useGradient
    });
    canvas.toBlob(function (blob) { if (blob) download(blob, filename); });
  };

  /* ---- footage ---------------------------------------------------------- */

  /* Whole cycles, and the clock stretched so the length comes out as asked. */
  function cyclesFor(seconds, speed) {
    return Math.max(1, Math.round(seconds * (speed || 1)));
  }

  /*
   * GIF is drawn frame by frame rather than recorded, so it does not depend on
   * the machine keeping up — every frame lands exactly where it should.
   */
  DG.exportGIF = function (params, style, seconds, opts, onProgress) {
    var fps = opts.fps || 12.5;
    var width = opts.width || 480;
    var height = Math.round(width / DG.frameRatio(params.frame));
    var total = Math.max(2, Math.round(seconds * fps));
    var cycles = cyclesFor(seconds, params.speed);

    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    var frames = [];
    var i = 0;

    return new Promise(function (resolve, reject) {
      function step() {
        var until = Date.now() + 40;                 // stay responsive
        while (i < total && Date.now() < until) {
          var t = (i / total) * cycles;
          DG.renderDots(ctx, DG.generateDots(params, width, height, t), {
            width: width,
            height: height,
            // A GIF can hold one transparent index, so Transparent is honoured
            // here rather than filled in with black as it used to be.
            background: style.background,
            solid: style.solid,
            shape: style.shape,
            useGradient: style.useGradient
          });
          frames.push(ctx.getImageData(0, 0, width, height).data);
          i++;
        }
        if (onProgress) onProgress(i / total * 0.75);
        if (i < total) return setTimeout(step, 0);

        setTimeout(function () {
          try {
            var bytes = DG.encodeGIF(frames, width, height, 1000 / fps, !style.background);
            if (onProgress) onProgress(1);
            resolve(new Blob([bytes], { type: 'image/gif' }));
          } catch (e) { reject(e); }
        }, 0);
      }
      step();
    });
  };

  /* What the browser will actually record. */
  DG.videoType = function () {
    if (typeof MediaRecorder === 'undefined') return null;
    var wanted = ['video/mp4;codecs=avc1.42E01E', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
    for (var i = 0; i < wanted.length; i++) {
      if (MediaRecorder.isTypeSupported(wanted[i])) {
        return { mime: wanted[i], ext: wanted[i].indexOf('mp4') >= 0 ? 'mp4' : 'webm' };
      }
    }
    return null;
  };

  /*
   * Video is recorded off a live canvas, so it runs for as long as the clip
   * lasts. A recorder stamps its frames by the wall clock, so feeding them
   * faster would only produce a clip that played too fast.
   */
  DG.exportVideo = function (params, style, seconds, opts, onProgress) {
    var type = DG.videoType();
    if (!type) return Promise.reject(new Error('This browser cannot record video.'));

    var width = opts.width || 1280;
    var height = Math.round(width / DG.frameRatio(params.frame));
    var fps = opts.fps || 30;
    var cycles = cyclesFor(seconds, params.speed);

    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext('2d');
    var stream = canvas.captureStream(fps);
    var chunks = [];
    var rec = new MediaRecorder(stream, { mimeType: type.mime, videoBitsPerSecond: opts.bitrate || 8e6 });
    rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };

    return new Promise(function (resolve, reject) {
      rec.onerror = function (e) { reject(e.error || new Error('Recording failed.')); };
      rec.onstop = function () { resolve({ blob: new Blob(chunks, { type: type.mime }), ext: type.ext }); };

      var start = performance.now();
      function frame(now) {
        var elapsed = (now - start) / 1000;
        if (elapsed >= seconds) {
          rec.stop();
          return;
        }
        var t = (elapsed / seconds) * cycles;
        DG.renderDots(ctx, DG.generateDots(params, width, height, t), {
          width: width,
          height: height,
          background: style.background || '#000000',
          solid: style.solid,
          shape: style.shape,
          useGradient: style.useGradient
        });
        if (onProgress) onProgress(elapsed / seconds);
        requestAnimationFrame(frame);
      }
      rec.start();
      requestAnimationFrame(frame);
    });
  };
})(DG);
