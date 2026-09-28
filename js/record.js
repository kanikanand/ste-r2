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

  /*
   * Both stills follow whatever background the style carries, so the No bg
   * switch decides for them. PNG used to drop it unconditionally, which meant
   * there was no way to get a PNG of what you were actually looking at.
   */
  DG.exportSVG = function (params, style, t, height, filename) {
    var width = Math.round(height * DG.frameRatio(params.frame));
    var svg = DG.dotsToSVG(DG.generateDots(params, width, height, t), {
      width: width,
      height: height,
      background: style.background,
      solid: style.solid,
      useGradient: style.useGradient,
      alpha: style.alpha,
      mesh: style.mesh,
      meshBlend: style.meshBlend,
      highlight: style.highlight,
      labelFill: style.labelFill,
      labelText: style.labelText,
      labels: DG.generateLabels(params, width, height, t)
    });
    download(new Blob([svg], { type: 'image/svg+xml' }), filename);
  };

  DG.exportPNG = function (params, style, t, height, filename) {
    var width = Math.round(height * DG.frameRatio(params.frame));
    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    DG.renderDots(canvas.getContext('2d'), DG.generateDots(params, width, height, t), {
      width: width,
      height: height,
      background: style.background,
      solid: style.solid,
      useGradient: style.useGradient,
      alpha: style.alpha,
      mesh: style.mesh,
      meshBlend: style.meshBlend,
      highlight: style.highlight,
      labelFill: style.labelFill,
      labelText: style.labelText,
      labels: DG.generateLabels(params, width, height, t)
    });
    canvas.toBlob(function (blob) { if (blob) download(blob, filename); });
  };

  /* ---- footage ---------------------------------------------------------- */

  /* Whole cycles, and the clock stretched so the length comes out as asked. */
  /*
   * How long a clip actually runs, and how many cycles it holds.
   *
   * Footage has to close where it opened, so it has to hold a whole number of
   * cycles. It used to get there by keeping the length you asked for and
   * fitting whole cycles into it, which quietly changed the speed: a globe set
   * to twenty-four seconds a turn, asked for ten seconds, was given one whole
   * turn in ten — two and a half times faster than the thing on screen. The
   * duration buttons are a target now, and the speed is not negotiable. The
   * clip runs at the speed you set and its length is rounded to the nearest
   * whole number of cycles, which is reported back so nothing about it is a
   * surprise.
   */
  DG.clipPlan = function (seconds, speed) {
    var s = speed > 0 ? speed : 1;
    var cycles = Math.max(1, Math.round(seconds * s));
    return { cycles: cycles, duration: cycles / s };
  };

  /* A clip's length, short enough for a button and safe in a filename. */
  DG.clipLabel = function (seconds) {
    var whole = Math.round(seconds);
    if (whole < 60) return whole + 's';
    var minutes = Math.floor(whole / 60);
    var rest = whole % 60;
    return rest ? minutes + 'm' + rest + 's' : minutes + 'm';
  };

  /*
   * GIF is drawn frame by frame rather than recorded, so it does not depend on
   * the machine keeping up — every frame lands exactly where it should.
   */
  DG.exportGIF = function (params, style, seconds, opts, onProgress) {
    var fps = opts.fps || 12.5;
    var height = opts.height || 540;
    var width = Math.round(height * DG.frameRatio(params.frame));
    var plan = DG.clipPlan(seconds, params.speed);
    var cycles = plan.cycles;
    // The frame count follows the clip's real length, so the delay written
    // into every frame plays the cycles back at the speed they were made at.
    var total = Math.max(2, Math.round(plan.duration * fps));

    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext('2d', { willReadFrequently: true });

    function paint(i) {
      var t = (i / total) * cycles;
      DG.renderDots(ctx, DG.generateDots(params, width, height, t), {
        width: width,
        height: height,
        background: style.background,
        solid: style.solid,
        useGradient: style.useGradient,
        alpha: style.alpha,
        mesh: style.mesh,
      meshBlend: style.meshBlend,
        highlight: style.highlight,
        labelFill: style.labelFill,
        labelText: style.labelText,
        labels: DG.generateLabels(params, width, height, t)
      });
      return ctx.getImageData(0, 0, width, height).data;
    }

    /*
     * Two passes, and neither of them keeps the footage. The first renders a
     * dozen frames spread across the run to choose a palette that suits all of
     * it; the second renders every frame, hands it straight to the writer and
     * lets it go.
     *
     * Holding every frame until the end — which is what this used to do — costs
     * frames x pixels x 4 bytes, so a minute at 1080 would have needed six
     * gigabytes and the size had to be capped to keep the tab alive. Encoding
     * as it goes, the peak is one frame and the compressed output.
     */
    return new Promise(function (resolve, reject) {
      var sample = [];
      var sampleStep = Math.max(1, Math.floor(total / 12));
      for (var k = 0; k < total; k += sampleStep) sample.push(paint(k));

      var writer;
      try {
        writer = new DG.GifWriter(width, height, 1000 / fps, DG.gifPalette(sample, !style.background && !style.mesh));
      } catch (e) { return reject(e); }
      sample.length = 0;

      var i = 0;
      function step() {
        try {
          var until = Date.now() + 40;                 // stay responsive
          while (i < total && Date.now() < until) {
            writer.addFrame(paint(i));
            i++;
          }
        } catch (e) { return reject(e); }
        if (onProgress) onProgress(i / total);
        if (i < total) return setTimeout(step, 0);
        setTimeout(function () {
          try {
            resolve(new Blob([writer.finish()], { type: 'image/gif' }));
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
   * Video is written frame by frame, like the GIF, rather than scraped off a
   * canvas while it plays.
   *
   * This used to draw as fast as the animation frame came round and leave
   * captureStream(fps) to sample whatever happened to be on the canvas. Two
   * things go wrong with that at 1080. It draws far more frames than the file
   * can hold — nearly sixty a second for a thirty a second recording — and
   * what reaches the file is only what the browser managed to sample and the
   * encoder managed to swallow before the recorder was stopped. Ten seconds
   * asked for came back as 3.79, with all ten seconds of motion inside it,
   * which is the same clip played two and a half times fast.
   *
   * captureStream(0) takes the sampling away from the browser: nothing is
   * captured until requestFrame is called, so the file holds exactly the frames
   * that were drawn for it, one apiece, in order. The recorder stamps them by
   * the time they arrive — measured, and it is not the nominal frame rate — so
   * the loop waits for each frame's turn on the wall clock. What it will not do
   * is drop one to catch up: a frame that takes too long makes the recording
   * take longer, not the clip come out short and fast.
   */
  DG.exportVideo = function (params, style, seconds, opts, onProgress) {
    var type = DG.videoType();
    if (!type) return Promise.reject(new Error('This browser cannot record video.'));

    var height = opts.height || 1080;
    var width = Math.round(height * DG.frameRatio(params.frame));
    var fps = opts.fps || 30;
    var plan = DG.clipPlan(seconds, params.speed);
    var cycles = plan.cycles;
    var frameCount = Math.max(2, Math.round(plan.duration * fps));

    var canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    var ctx = canvas.getContext('2d');

    var stream = canvas.captureStream(0);
    var track = stream.getVideoTracks()[0];
    var manual = !!(track && typeof track.requestFrame === 'function');
    if (!manual) {
      // Nothing would ever reach a stream at zero without requestFrame. Back
      // to the browser's own sampling, which is worse but is a recording.
      stream.getTracks().forEach(function (tr) { tr.stop(); });
      stream = canvas.captureStream(fps);
    }

    var chunks = [];
    /*
     * Scaled to the frame, and generously. What comes out of here is a field of
     * small hard-edged dots over a smooth gradient, which is the worst case for
     * an encoder: high-frequency detail everywhere, and banding in the ground
     * the moment it runs short. A 1080-high frame at thirty asks for around
     * twenty-two megabits, which is roughly what a camera would give it.
     */
    var bitrate = opts.bitrate ||
      Math.max(8e6, Math.min(48e6, Math.round(width * height * fps * 0.35)));
    var rec = new MediaRecorder(stream, { mimeType: type.mime, videoBitsPerSecond: bitrate });
    rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };

    return new Promise(function (resolve, reject) {
      rec.onerror = function (e) { reject(e.error || new Error('Recording failed.')); };
      rec.onstop = function () { resolve({ blob: new Blob(chunks, { type: type.mime }), ext: type.ext }); };

      var interval = 1000 / fps;
      var start = 0;
      var i = 0;

      function paint(index) {
        var t = (index / frameCount) * cycles;
        DG.renderDots(ctx, DG.generateDots(params, width, height, t), {
          width: width,
          height: height,
          background: style.background || '#000000',
          solid: style.solid,
          useGradient: style.useGradient,
          alpha: style.alpha,
          mesh: style.mesh,
          meshBlend: style.meshBlend,
          highlight: style.highlight,
          labelFill: style.labelFill,
          labelText: style.labelText,
          labels: DG.generateLabels(params, width, height, t)
        });
      }

      function step(now) {
        if (!start) start = now;
        // Frame i's turn, by the clock. Early, and it waits; late, and it goes
        // straight through — the frame is never given up on.
        if (now - start + 0.5 < i * interval) return requestAnimationFrame(step);

        try {
          paint(i);
        } catch (e) {
          try { rec.stop(); } catch (ignored) {}
          return reject(e);
        }
        if (manual) track.requestFrame();
        i += 1;
        if (onProgress) onProgress(i / frameCount);
        if (i < frameCount) return requestAnimationFrame(step);

        /*
         * And then it waits before stopping. The encoder runs behind the
         * submissions — around four tenths of a second behind at 1080 — and
         * whatever is still in its queue when stop() is called is lost, which
         * took a ten second clip down to 9.63. Stopping late costs a moment of
         * wall clock and nothing else: the file ends at the last frame either
         * way, so the wait only has to be longer than the queue. Measured at
         * 1080/30, 500ms was enough and 1000ms was no different.
         */
        setTimeout(function () { rec.stop(); }, 800);
      }

      rec.start();
      requestAnimationFrame(step);
    });
  };
})(DG);
