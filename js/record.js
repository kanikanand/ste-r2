/* ============================================================================
 * record.js — stills and footage.
 *
 * A clip is the length on the button, at the speed on screen. Those are the
 * two things the interface says out loud, so they are the two that are kept,
 * and how much of a cycle that comes to is whatever it comes to.
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

  /*
   * How long a clip runs, and how much of the motion it holds.
   *
   * Both of the things a button can promise are kept: press ten seconds and
   * the file is ten seconds, running at the speed set on screen. The cycles
   * follow from those two and are whatever they come to — ten at a cycle a
   * second, five twelfths of a turn for a globe at twenty-four seconds a turn.
   *
   * What is given up is the seamless join, and only when the arithmetic does
   * not hand one over. This used to hold whole cycles above everything else,
   * and both ways of paying for it were worse than the join: fitting a whole
   * turn into the ten seconds asked for changed the speed, and running the
   * whole turn at the right speed made a twenty-four second file out of a ten
   * second button. A clip that says what it is beats a clip that loops.
   */
  DG.clipPlan = function (seconds, speed) {
    var s = speed > 0 ? speed : 1;
    return { cycles: seconds * s, duration: seconds };
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
    // The delay written into every frame is 1/fps, so a file of this many
    // frames runs for exactly as long as was asked for, and the motion inside
    // it goes by at the speed it was set to.
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
    var flowing = false;
    rec.ondataavailable = function (e) {
      if (e.data && e.data.size) { flowing = true; chunks.push(e.data); }
    };

    /*
     * Letting go of the capture when the clip is finished. Leaving the track
     * live is not free: a second export in the same session then starts while
     * the last one is still being torn down, and the frames handed over before
     * the new encoder is really running are dropped on the floor. Measured
     * three exports in a row — the first came out at 9.99s and the two after
     * it at 9.02 and 9.37, each missing about a second off the front.
     */
    function release() {
      stream.getTracks().forEach(function (tr) { tr.stop(); });
    }

    return new Promise(function (resolve, reject) {
      rec.onerror = function (e) { release(); reject(e.error || new Error('Recording failed.')); };
      rec.onstop = function () {
        release();
        resolve({ blob: new Blob(chunks, { type: type.mime }), ext: type.ext });
      };

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
          release();
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

      /*
       * Before any of that, the first frame is offered until the encoder
       * proves it is taking them.
       *
       * start() returns long before the pipeline is up, and everything handed
       * over in between is dropped without a word — which costs the front of
       * the clip, not the back. It only shows on the second export in a
       * session, where the last recording is still being torn down: measured
       * three in a row, the first came out at 9.99s and the two after it at
       * 9.05 and 9.36, each missing about a second off its opening. Releasing
       * the capture afterwards, which this now does, was not enough on its
       * own.
       *
       * The recorder's own start event cannot be waited for: with the capture
       * handing frames over only on request, nothing reaches the encoder
       * until the first request, and Chromium does not fire start until a
       * frame has reached it — waiting for it deadlocks. So the first frame
       * is offered over and over, and requestData asks the recorder to flush
       * what it has; the first flush that comes back with anything in it is
       * the proof.
       *
       * It is not free. The encoder holds a few frames before it emits
       * anything, so the copies offered in the meantime are all in the file:
       * the clip opens on its first frame held for about a sixth of a second
       * at 540 and four tenths at 1080, and runs that much over the length on
       * the button. That is the whole of the error now, it is the same every
       * time, and it buys back a second of the opening that used to be gone
       * on every export after the first.
       */
      var primeUntil = performance.now() + 3000;
      function prime(now) {
        if (flowing || now > primeUntil) {
          requestAnimationFrame(step);
          return;
        }
        paint(0);
        if (manual) track.requestFrame();
        try { rec.requestData(); } catch (ignored) {}
        requestAnimationFrame(prime);
      }

      rec.start();
      requestAnimationFrame(prime);
    });
  };
})(DG);
