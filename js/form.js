/* ============================================================================
 * form.js — particles in orbit around a shape that is part globe, part star.
 *
 * It offers DG.generateDots(params, width, height, t), the same call the globe
 * and the flat patterns offered, returning the same list of screen-space dots.
 * The renderer, the SVG writer, the GIF encoder and the video recorder are
 * unchanged.
 *
 * Three things make this different from the globe:
 *
 *   There is only one shape here, and the globe and the star are two settings
 *   of it. The diagram draws a sphere as circles and an eight-pointed star as
 *   four long ellipses crossing at one centre — and an ellipse is a circle
 *   that has been flattened. So the form is four rings through a common
 *   centre, and Morph is how flat they are: round, and the four of them are
 *   the same sphere; flattened, they separate into eight points. Their long
 *   axes never change length, so the tips stay where they are and the morph
 *   is the body drawing in rather than the whole thing inflating.
 *
 *   Fluidity distorts the rings rather than the particles. Each leans,
 *   lengthens and flattens on its own schedule, and its section wanders as it
 *   goes round, so the form pulses unevenly, the way something alive does.
 *
 *   The camera has a position. The globe was orthographic, which cannot go
 *   anywhere; this is a perspective view with a distance, so it can be pushed
 *   through the surface and end up inside the form looking out.
 *
 * t is the position in the loop, 0..1, and every animated term completes a
 * whole number of turns across it, so footage of any length closes where it
 * opened.
 * ==========================================================================*/
var DG = window.DG || (window.DG = {});

(function (DG) {
  'use strict';

  var TAU = Math.PI * 2;
  var RAD = Math.PI / 180;
  var clamp01 = (DG.clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; });
  var RINGS = 4;        // four rings, two ends each: an eight-pointed star

  DG.DEFAULTS = {
    frame: '16:9',

    count: 7000,          // particles
    dotScale: 0.7,        // dot size against the spacing the count implies
    sizeVariation: 0.7,   // how much nearer particles outgrow farther ones
    dotAlpha: 1,
    contrast: 1,
    scatter: 0,
    seed: 1,

    morph: 0,             // 0 the globe, 1 the star: how flat the rings are
    breathe: 0,           // how far the morph swings on its own over the loop
    spike: 0.85,          // how flat the rings get at full morph
    fluid: 0.2,           // how hard the rings lean, stretch and wander

    dist: 3.2,            // camera distance, in form radii; under 1 is inside
    lens: 1,              // how wide the lens is
    heading: 0,           // where the drag has turned the form to
    tilt: 12,             // the lean drag has given it

    speed: 1 / 24,        // turns a second
    orbit: 0,             // whole turns a particle makes along its orbit per cycle

    colorMode: 'gradient',
    gradientMap: 'depth',
    gradientReverse: false,
    stops: [0, 0.5, 1],
    highlightMode: 'red',
    background: 'black',
    size: 'L'
  };

  function hash(i, j) {
    var h = Math.imul(i, 0x27d4eb2d) + Math.imul(j, 0x9e3779b1);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }

  /* ------------------------------------------------------------------------
   * The star, built from crossing spokes.
   *
   * The diagram draws an eight-pointed star as four long shapes crossing at
   * one centre, each turned a little further round. Here that is four axes
   * through a small core, each carrying a spoke out to a point at either end:
   * four axes, eight ends, eight points.
   *
   * The earlier build made the points out of longitude, so they ringed the
   * equator and the silhouette was only a star from the pole. Here the axes
   * are spread evenly through space instead of around one circle, so there is
   * no privileged angle to view it from.
   * ---------------------------------------------------------------------- */
  var axisCache = {};   // by point count: the search is slow, and there are few

  /*
   * Spreading the axes. They want to be as far from one another as axes can
   * get, and an axis has two ends, so what is really being spread is twice as
   * many points: four axes are eight star points, and they should end up on
   * the diagonals of a cube.
   *
   * A spiral is even over a whole sphere but not over half of one, and with
   * only four to place, the difference is the whole point — a spiral leaves
   * two of them leaning together, and that projects as a five-pointed star
   * however you turn it. So the axes are made to repel each other, both
   * ends of each counted, from a handful of starting arrangements, and the
   * arrangement that settles lowest is the one kept. It runs once per point
   * count and is cached; the answer for four is the cube.
   */
  function relax(a, count) {
    var k, j;
    var passes = 700;
    for (var pass = 0; pass < passes; pass++) {
      // The step shrinks as it goes, so the axes travel freely at first and
      // settle precisely at the end instead of jittering around the answer.
      var step = 0.008 * (1 - 0.94 * pass / passes);
      var f = new Float64Array(count * 3);
      for (k = 0; k < count; k++) {
        for (j = 0; j < count; j++) {
          if (j === k) continue;
          for (var e = -1; e <= 1; e += 2) {
            var dx = a[k * 3] - e * a[j * 3];
            var dy = a[k * 3 + 1] - e * a[j * 3 + 1];
            var dz = a[k * 3 + 2] - e * a[j * 3 + 2];
            var l2 = Math.max(1e-9, dx * dx + dy * dy + dz * dz);
            var w = 1 / (l2 * Math.sqrt(l2));
            f[k * 3] += dx * w; f[k * 3 + 1] += dy * w; f[k * 3 + 2] += dz * w;
          }
        }
      }
      for (k = 0; k < count; k++) {
        var nx = a[k * 3] + f[k * 3] * step;
        var ny = a[k * 3 + 1] + f[k * 3 + 1] * step;
        var nz = a[k * 3 + 2] + f[k * 3 + 2] * step;
        var ln = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
        a[k * 3] = nx / ln; a[k * 3 + 1] = ny / ln; a[k * 3 + 2] = nz / ln;
      }
    }
    return a;
  }

  function energy(a, count) {
    var e = 0;
    for (var k = 0; k < count; k++) {
      for (var j = 0; j < count; j++) {
        if (j === k) continue;
        for (var s = -1; s <= 1; s += 2) {
          var dx = a[k * 3] - s * a[j * 3];
          var dy = a[k * 3 + 1] - s * a[j * 3 + 1];
          var dz = a[k * 3 + 2] - s * a[j * 3 + 2];
          e += 1 / Math.max(1e-6, Math.sqrt(dx * dx + dy * dy + dz * dz));
        }
      }
    }
    return e;
  }

  function spokeAxes(count) {
    if (axisCache[count]) return axisCache[count];
    var best = null, bestE = Infinity;
    for (var attempt = 0; attempt < 6; attempt++) {
      var a = new Float64Array(count * 3);
      for (var k = 0; k < count; k++) {
        // Deterministic starts, so the form is the same every time it is drawn.
        var z = hash(k + attempt * 97, 5) * 2 - 1;
        var th = hash(k + attempt * 97, 11) * TAU;
        var rad = Math.sqrt(Math.max(0, 1 - z * z));
        a[k * 3] = Math.cos(th) * rad;
        a[k * 3 + 1] = z;
        a[k * 3 + 2] = Math.sin(th) * rad;
      }
      relax(a, count);
      var e = energy(a, count);
      if (e < bestE - 1e-9) { bestE = e; best = a; }
    }
    axisCache[count] = best;
    return best;
  }

  /*
   * A perpendicular pair for every axis, so a spoke has two directions it can
   * lean in. Fixed with the axes, not chosen per frame, or the lean would jump
   * about as the axes are recomputed.
   */
  var frameCache = {};

  function spokeFrames(count) {
    if (frameCache[count]) return frameCache[count];
    var axes = spokeAxes(count);
    var f = new Float64Array(count * 6);
    for (var k = 0; k < count; k++) {
      var lx = axes[k * 3], ly = axes[k * 3 + 1], lz = axes[k * 3 + 2];
      // Cross with whichever world axis the spoke leans on least.
      var ux = 0, uy = 1, uz = 0;
      if (Math.abs(ly) > 0.9) { ux = 1; uy = 0; }
      var px = ly * uz - lz * uy, py = lz * ux - lx * uz, pz = lx * uy - ly * ux;
      var pl = Math.sqrt(px * px + py * py + pz * pz) || 1;
      px /= pl; py /= pl; pz /= pl;
      f[k * 6] = px; f[k * 6 + 1] = py; f[k * 6 + 2] = pz;
      f[k * 6 + 3] = ly * pz - lz * py;
      f[k * 6 + 4] = lz * px - lx * pz;
      f[k * 6 + 5] = lx * py - ly * px;
    }
    frameCache[count] = f;
    return f;
  }

  /*
   * A wave that comes back. Three cosines at one, two and three turns a cycle,
   * each given its own starting place, so what it traces is uneven and never
   * quite repeats inside the loop but closes exactly at the end of it. Whole
   * turns, or it would not.
   */
  function loopWave(e, seed, t) {
    var a = TAU * (t + hash(e, seed));
    return (0.58 * Math.cos(a) +
            0.30 * Math.cos(2 * a + TAU * hash(e, seed + 1)) +
            0.18 * Math.cos(3 * a + TAU * hash(e, seed + 2))) / 1.06;
  }

  /* ------------------------------------------------------------------------
   * The form, as four rings.
   *
   * The diagram draws a sphere as circles and an eight-pointed star as four
   * long ellipses crossing at one centre. An ellipse is a circle that has been
   * flattened, so both pictures are the same construction at two settings of
   * one control, and that is how this is built.
   *
   * A ring is the set of points at some angle round one axis. Flattening it
   * means squashing everything perpendicular to that axis by a factor b while
   * the axis itself keeps its length: a particle at direction d on the ring of
   * axis L goes to L(d·L) + b(d − L(d·L)). At b = 1 nothing moves and the four
   * rings are the same sphere. Below it each ring becomes a long ellipse, the
   * four of them cross at the centre, and their eight ends are the points of
   * the star.
   *
   * Two things follow from writing it that way. The long axes never change
   * length, so the tips of the star sit exactly where the globe's surface was
   * and the morph is the body drawing in rather than the whole thing inflating
   * and deflating. And the globe is not a separate shape that has to be mixed
   * in: it is what this is when the flattening is switched off.
   *
   * Fluidity distorts the rings. Each leans off its axis, stretches and
   * flattens on its own schedule, and — because a ring is a family of ellipses
   * round one axis rather than a single one — its section wanders as it goes
   * round, so no two ellipses in the same ring are quite alike. The form is
   * never symmetrical and never still in the same way twice.
   * ---------------------------------------------------------------------- */
  var RING_STRIDE = 17;

  DG.buildForm = function (p, morph, t) {
    var axes = spokeAxes(RINGS);
    var frames = spokeFrames(RINGS);
    var fluid = clamp01(p.fluid);

    // The flat end of the morph: how thin an ellipse gets once it is one.
    var flat = 0.42 - 0.26 * clamp01(p.spike);
    var b = 1 + (flat - 1) * morph;

    var f = new Float64Array(RINGS * RING_STRIDE);
    for (var k = 0; k < RINGS; k++) {
      var o = k * RING_STRIDE;
      var lean = fluid * 0.26;
      var la = lean * loopWave(k, 3, t);
      var lb = lean * loopWave(k, 17, t);
      var lx = axes[k * 3] + la * frames[k * 6] + lb * frames[k * 6 + 3];
      var ly = axes[k * 3 + 1] + la * frames[k * 6 + 1] + lb * frames[k * 6 + 4];
      var lz = axes[k * 3 + 2] + la * frames[k * 6 + 2] + lb * frames[k * 6 + 5];
      var ll = Math.sqrt(lx * lx + ly * ly + lz * lz) || 1;
      lx /= ll; ly /= ll; lz /= ll;
      f[o] = lx; f[o + 1] = ly; f[o + 2] = lz;

      /*
       * The two directions across the ring. They have to be rebuilt against
       * the leaned axis rather than reused from the upright one, or they stop
       * being perpendicular to it and the ellipse shears.
       */
      var px = frames[k * 6], py = frames[k * 6 + 1], pz = frames[k * 6 + 2];
      var d = px * lx + py * ly + pz * lz;
      px -= lx * d; py -= ly * d; pz -= lz * d;
      var pl = Math.sqrt(px * px + py * py + pz * pz) || 1;
      px /= pl; py /= pl; pz /= pl;
      f[o + 3] = px; f[o + 4] = py; f[o + 5] = pz;
      f[o + 6] = ly * pz - lz * py;
      f[o + 7] = lz * px - lx * pz;
      f[o + 8] = lx * py - ly * px;

      f[o + 9] = 1 + fluid * 0.16 * loopWave(k, 29, t);            // length
      f[o + 10] = Math.max(0.03, b * (1 + fluid * 0.34 * loopWave(k, 41, t)));

      /*
       * How the section wanders round the ring: one, two and three swells a
       * turn, each drifting at its own whole number of turns a cycle so the
       * loop still closes. Written as sine and cosine weights, so the particle
       * loop never needs an angle — only the cosine and sine it already has.
       */
      var amp = fluid * 0.30;
      for (var h = 1; h <= 3; h++) {
        var ang = TAU * (h * t + hash(k, 60 + h));
        var w = amp * (0.62 / h) * (0.6 + 0.4 * hash(k, 70 + h));
        f[o + 9 + h * 2] = w * Math.cos(ang);
        f[o + 10 + h * 2] = w * Math.sin(ang);
      }
    }
    return f;
  };

  /*
   * Where one particle sits: on its own ring, flattened. The particle keeps
   * the direction it was placed in and only its distance across the axis
   * changes, so at full round the cloud is exactly the even sphere it started
   * as — no drift, no seams, nothing to fix.
   */
  DG.ringPoint = function (dx, dy, dz, form, k, out) {
    var o = k * RING_STRIDE;
    var lx = form[o], ly = form[o + 1], lz = form[o + 2];
    var ct = dx * lx + dy * ly + dz * lz;
    var ex = dx - lx * ct, ey = dy - ly * ct, ez = dz - lz * ct;
    var el = Math.sqrt(ex * ex + ey * ey + ez * ez);
    var b = form[o + 10];

    if (el > 1e-9 && form[o + 11] !== 0) {
      var c1 = (ex * form[o + 3] + ey * form[o + 4] + ez * form[o + 5]) / el;
      var s1 = (ex * form[o + 6] + ey * form[o + 7] + ez * form[o + 8]) / el;
      var c2 = c1 * c1 - s1 * s1, s2 = 2 * c1 * s1;
      var c3 = c1 * c2 - s1 * s2, s3 = s1 * c2 + c1 * s2;
      b *= 1 + form[o + 11] * c1 + form[o + 12] * s1
             + form[o + 13] * c2 + form[o + 14] * s2
             + form[o + 15] * c3 + form[o + 16] * s3;
      if (b < 0.03) b = 0.03;
    }

    var a = form[o + 9];
    out[0] = lx * ct * a + ex * b;
    out[1] = ly * ct * a + ey * b;
    out[2] = lz * ct * a + ez * b;
    return out;
  };

  /*
   * Particle directions, by the golden angle. Rings of latitude would put the
   * particles in rows, and rows are exactly what this should not have — the
   * form is meant to read as a cloud held in a shape, so the placement has to
   * be even without being regular. The golden angle is the one arrangement
   * that is both.
   */
  var cache = { n: 0, dirs: null };

  function directions(n) {
    if (cache.n === n) return cache.dirs;
    var d = new Float64Array(n * 3);
    var ga = Math.PI * (3 - Math.sqrt(5));
    for (var i = 0; i < n; i++) {
      var y = 1 - (i + 0.5) / n * 2;
      var rad = Math.sqrt(Math.max(0, 1 - y * y));
      var th = ga * i;
      d[i * 3] = Math.cos(th) * rad;
      d[i * 3 + 1] = y;
      d[i * 3 + 2] = Math.sin(th) * rad;
    }
    cache.n = n;
    cache.dirs = d;
    return d;
  }

  /* Turn a vector about the y axis, then lean it about x. */
  function orient(x, y, z, cosH, sinH, cosT, sinT, out) {
    var x1 = x * cosH + z * sinH;
    var z1 = -x * sinH + z * cosH;
    out[0] = x1;
    out[1] = y * cosT - z1 * sinT;
    out[2] = y * sinT + z1 * cosT;
  }

  DG.generateDots = function (params, width, height, t) {
    var p = Object.assign({}, DG.DEFAULTS, params);
    var n = Math.max(200, Math.round(p.count));
    var dirs = directions(n);
    var phase = t - Math.floor(t);

    // The morph the slider asks for, plus whatever swing Breathe adds. One
    // whole turn, so it arrives back where it began.
    var morph = clamp01(p.morph + p.breathe * (0.5 - 0.5 * Math.cos(TAU * phase)) * (1 - p.morph));

    var head = (phase * 360 + p.heading) * RAD;
    var tilt = p.tilt * RAD;
    var cosH = Math.cos(head), sinH = Math.sin(head);
    var cosT = Math.cos(tilt), sinT = Math.sin(tilt);

    var cx = width / 2;
    var cy = height / 2;
    // The lens. Focal length is tied to the distance so that pulling back
    // frames the form rather than shrinking it to nothing.
    var focal = Math.min(width, height) * 0.5 * p.lens * Math.max(0.35, p.dist) * 0.62;
    var near = 0.06;

    // What one particle's share of the surface is worth, so the dots stay the
    // same weight whether there are two thousand of them or twenty.
    var spacing = Math.sqrt(4 * Math.PI / n);
    var baseR = spacing * 0.5 * p.dotScale;

    /*
     * A ceiling on how big one dot gets. Size is the depth cue here and it
     * follows the perspective divide, which runs away to infinity at the lens
     * — so a particle passing close to the camera becomes a disc the width of
     * a finger and the field stops reading as a field. The dot is eased into
     * the ceiling rather than clipped at it, so nothing changes at ordinary
     * distances and there is no size at which the grading visibly stops.
     */
    var capR = Math.min(width, height) * 0.024;

    // Turns per cycle to draw from — whole ones only, see the orbit below.
    var spin = Math.max(0, Math.round(p.orbit));

    var fluid = clamp01(p.fluid);

    // The spokes for this instant: leaned, stretched and thickened, each on
    // its own schedule. Built once a frame, not once a particle — it is the
    // shape that is moving, and every particle is on the same one.
    var form = DG.buildForm(p, morph, phase);

    var ramp = DG.buildRamp(96, p.stops);
    var useGradient = p.colorMode === 'gradient';
    var v3 = [0, 0, 0];
    var fp = [0, 0, 0];
    var dots = [];
    var zNear = Infinity;
    var zFar = -Infinity;

    for (var i = 0; i < n; i++) {
      var dx = dirs[i * 3], dy = dirs[i * 3 + 1], dz = dirs[i * 3 + 2];

      if (p.scatter > 0 && hash(i, p.seed) < p.scatter) continue;

      /*
       * The orbit. Each particle turns about its own axis, from its own
       * starting point, so they slide across the form at different rates and
       * in different directions instead of drifting as one sheet. The turn
       * count is a whole number
       * and the setting is what it is drawn from, because a fraction of a
       * turn would leave the particle somewhere other than where it started
       * and the loop would jump there.
       */
      if (spin > 0) {
        var turns = 1 + Math.floor(hash(i, 91) * spin);
        // Each particle starts somewhere different along its orbit. Without
        // that they all leave from the lattice they were placed on and arrive
        // back at it together, and the loop has one frame a cycle where the
        // whole cloud snaps into focus.
        var ang = TAU * turns * (phase + hash(i, 73));
        var ax = hash(i, 17) * 2 - 1, ay = hash(i, 31) * 2 - 1, az = hash(i, 47) * 2 - 1;
        var al = Math.sqrt(ax * ax + ay * ay + az * az) || 1;
        ax /= al; ay /= al; az /= al;
        // Rodrigues, about that axis.
        var ca = Math.cos(ang), sa = Math.sin(ang);
        var dot = ax * dx + ay * dy + az * dz;
        var rx = dx * ca + (ay * dz - az * dy) * sa + ax * dot * (1 - ca);
        var ry = dy * ca + (az * dx - ax * dz) * sa + ay * dot * (1 - ca);
        var rz = dz * ca + (ax * dy - ay * dx) * sa + az * dot * (1 - ca);
        dx = rx; dy = ry; dz = rz;
      }

      /*
       * Which ring the particle belongs to, by index rather than by which one
       * is nearest. Four complete rings crossing each other is the picture;
       * handing each particle to its nearest axis instead would give four
       * quarter-rings that meet at seams and never cross at all.
       */
      DG.ringPoint(dx, dy, dz, form, i & 3, fp);
      var px = fp[0], py = fp[1], pz = fp[2];
      var r = Math.sqrt(px * px + py * py + pz * pz);
      var lift = 0;

      if (fluid > 0) {
        /*
         * A last grain on top of the rings' own movement, so the surface reads
         * as a scatter of particles a shell thick rather than as a skin drawn
         * on a solid. Small, and fixed per particle: the life in the form
         * comes from the rings, and this only stops the shell looking
         * machined.
         *
         * It is a distance, not a percentage of the radius. Scaling the radius
         * stretches a point in proportion to how far out it already is, so the
         * ends grow sparse dotted tails and the star reads far sharper than it
         * is drawn.
         */
        var grain = (hash(i, 63) - 0.5) + 0.7 * (hash(i, 87) - 0.5);
        var nudge = fluid * 0.10 * grain * Math.pow(r + 0.2, 0.35);
        var rl = r > 1e-6 ? nudge / r : 0;
        px += px * rl; py += py * rl; pz += pz * rl;

        var side = fluid * 0.06;
        px += (hash(i, 111) - 0.5) * side;
        py += (hash(i, 127) - 0.5) * side;
        pz += (hash(i, 149) - 0.5) * side;

        lift = clamp01(nudge * 4);
      }

      orient(px, py, pz, cosH, sinH, cosT, sinT, v3);

      // Perspective, from a camera sitting back along z. Everything closer than
      // the near plane is dropped — which is most of the form once the camera
      // is inside it, and the rest wraps around the view.
      var zc = p.dist - v3[2];
      if (zc <= near) continue;

      var scale = focal / zc;
      var sx = cx + v3[0] * scale;
      var sy = cy - v3[1] * scale;
      if (sx < -80 || sy < -80 || sx > width + 80 || sy > height + 80) continue;

      /*
       * Nearer is bigger, and it is the only depth cue here — no shading, no
       * fog. The size follows the same perspective divide as the position, so a
       * particle at half the distance is twice the size, which is what the eye
       * reads as distance. A particle well out in the flow is drawn a little
       * finer, so a stream reads as the cloud thinning rather than as a second
       * cloud of the same weight.
       */
      /*
       * A particle out at a spike stands for more of the surface than one in
       * the core: the same slice of directions covers area going as the square
       * of the radius. So the dot grows with the radius it sits at, which is
       * this whole project's rule — density is carried by dot size — applied
       * to a solid rather than to a flat field. It is what keeps a spike
       * reading as a spike rather than as a few stray dots, and it thins the
       * crowded core in the same move. Not the full square root of the area,
       * which strips the core bare; enough to even the spikes out.
       */
      var d = {
        i: i,                                  // which particle, so frames line up
        x: sx, y: sy, r: baseR * scale * Math.pow(r, 0.7) * (1 - 0.3 * lift), z: -zc, zc: zc,
        nx: (sx - cx) / (Math.min(width, height) * 0.5),
        ny: (sy - cy) / (Math.min(width, height) * 0.5)
      };
      dots.push(d);
      if (zc < zNear) zNear = zc;
      if (zc > zFar) zFar = zc;
    }

    // Farthest first, so a near particle covers a far one rather than the other
    // way about. It happens before the sizing because the sizing wants to know
    // the order too.
    dots.sort(function (a, b) { return a.z - b.z; });

    /*
     * Depth is measured against what is actually in view, not against a fixed
     * window. The camera can sit three radii back or half a radius inside, and
     * those are completely different ranges of distance — a fixed window reads
     * the whole of one of them as "far", which is why the inside view came out
     * uniformly dim. Taking the range from the frame itself means the nearest
     * particle is always full size and the farthest always smallest, wherever
     * the camera is standing.
     *
     * The range is taken a few per cent in from each end rather than at the
     * very edges. One particle carried right up to the lens by the flow would
     * otherwise set the near end single-handed and push the whole form into
     * the far half of the scale, which reads as the form dimming every time
     * something drifts past the camera.
     */
    var m = dots.length;
    if (m > 20) {
      zFar = dots[Math.floor((m - 1) * 0.03)].zc;
      zNear = dots[Math.floor((m - 1) * 0.97)].zc;
    }
    var zSpan = Math.max(0.001, zFar - zNear);
    for (var k = 0; k < dots.length; k++) {
      var dk = dots[k];
      var near01 = clamp01(1 - (dk.zc - zNear) / zSpan);
      var depth = Math.pow(near01, p.contrast);
      var v = clamp01(1 - p.sizeVariation + p.sizeVariation * depth);
      dk.v = v;
      dk.depth = near01;
      var rr = dk.r * v;
      dk.r = rr / Math.sqrt(1 + (rr / capR) * (rr / capR));
      if (useGradient) {
        var gv = p.gradientMap === 'depth' ? near01 : DG.gradientCoord(p.gradientMap, dk);
        if (p.gradientReverse) gv = 1 - gv;
        dk.color = ramp[Math.min(ramp.length - 1, Math.max(0, Math.round(gv * (ramp.length - 1))))];
      }
    }
    return dots.filter(function (x) { return x.r >= 0.09; });
  };

  /* No labels on this one; the renderers ask, so the answer is none. */
  DG.generateLabels = function () { return []; };
})(DG);
