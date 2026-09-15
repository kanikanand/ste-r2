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
 *   There is only one shape here, not two. Four axes through a common centre
 *   carry a spoke out to a point at either end — eight points, spread evenly
 *   through space rather than ringing one waist, so the star reads as a star
 *   from wherever you stand. Morph is how wide those spokes are: wide enough
 *   and they swallow one another and the form is a globe; narrow and it is a
 *   star. The tips do not move between the two, which is what stops the
 *   morph reading as the thing inflating and deflating.
 *
 *   Fluidity distorts the spokes rather than the particles. Each of the eight
 *   leans, lengthens and thickens on its own schedule, so the form pulses
 *   unevenly, the way something alive does.
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
  var WIDE = 1;         // the spoke width at which the eight swallow each other
  var SPOKES = 4;       // four axes, two ends each: an eight-pointed star

  DG.DEFAULTS = {
    frame: '16:9',

    count: 4200,          // particles
    dotScale: 0.7,        // dot size against the spacing the count implies
    sizeVariation: 0.7,   // how much nearer particles outgrow farther ones
    dotAlpha: 1,
    contrast: 1,
    scatter: 0,
    seed: 1,

    morph: 0,             // 0 the globe, 1 the star: how wide the spokes are
    breathe: 0,           // how far the morph swings on its own over the loop
    spike: 0.85,          // how narrow the spokes get, so how far the points stand out
    body: 0.3,            // how much round body is left between the points
    fluid: 0.2,           // how hard the spokes lean, stretch and pulse

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
   * The form, as a set of spokes and the ball they stand on.
   *
   * A spoke is a cone, solved rather than shaped by a falloff. A ray leaving
   * the centre at angle θ to its axis meets a cone of height h and base
   * half-width w where r·sinθ = w(1 − r·cosθ/h), which is
   * r = w / (sinθ + w·cosθ/h) — straight sides, and a point at the end. Every
   * smooth falloff tried instead (a cosine raised to a power, a smoothstep of
   * the same, an ellipse, a spheroid) is widest somewhere along its length and
   * rounds off into a petal rather than a point.
   *
   * Morph is the base width, and nothing else. Every spoke stands on the same
   * ball, and the width runs from as wide as the spoke is long — where the
   * ball has swollen to the full reach and the eight of them are one globe —
   * down to a narrow point. Whatever the width, a cone of height h still ends
   * at h, so the tips sit at the radius the globe had and the morph is the
   * body drawing back between points that were always there. Mixing two radii
   * instead — a sphere's and a star's — moves everything at once, and reads as
   * the whole thing inflating and deflating.
   *
   * Fluidity distorts the spokes, not the particles. Each of the eight leans
   * off its axis, stretches and thickens on its own schedule, and the ball
   * breathes under them, so the form is never symmetrical and never still in
   * the same way twice.
   * ---------------------------------------------------------------------- */
  DG.buildForm = function (p, morph, t) {
    var axes = spokeAxes(SPOKES);
    var frames = spokeFrames(SPOKES);
    var fluid = clamp01(p.fluid);

    // The narrow end of the morph: how thin the spokes get, and how much
    // round body is left between them once they have.
    var tight = 0.95 - 0.70 * clamp01(p.spike);
    var rest = 0.10 + 0.75 * clamp01(p.body);

    var w = WIDE + (tight - WIDE) * morph;
    var ball = 1 + (rest - 1) * morph;
    ball *= 1 + fluid * 0.13 * loopWave(99, 53, t);

    var ends = new Float64Array(SPOKES * 2 * 5);
    for (var k = 0; k < SPOKES; k++) {
      for (var sgn = 0; sgn < 2; sgn++) {
        var e = k * 2 + sgn;
        var s = sgn ? -1 : 1;
        var lean = fluid * 0.30;
        var a = lean * loopWave(e, 3, t);
        var b = lean * loopWave(e, 17, t);
        var lx = s * axes[k * 3] + a * frames[k * 6] + b * frames[k * 6 + 3];
        var ly = s * axes[k * 3 + 1] + a * frames[k * 6 + 1] + b * frames[k * 6 + 4];
        var lz = s * axes[k * 3 + 2] + a * frames[k * 6 + 2] + b * frames[k * 6 + 5];
        var ll = Math.sqrt(lx * lx + ly * ly + lz * lz) || 1;
        ends[e * 5] = lx / ll;
        ends[e * 5 + 1] = ly / ll;
        ends[e * 5 + 2] = lz / ll;
        var eh = 1 + fluid * 0.20 * loopWave(e, 29, t);
        var ew = w * (1 + fluid * 0.38 * loopWave(e, 41, t));
        ends[e * 5 + 3] = eh;                                  // height
        // Never wider than it is tall. A cone whose base is broader than its
        // height reaches furthest at the rim of that base rather than at its
        // point, and eight of those bulge sideways into a lumpy solid half
        // again the size of the globe they are supposed to be making.
        ends[e * 5 + 4] = ew < eh ? ew : eh;                   // width
      }
    }
    return { ends: ends, ball: ball, n: SPOKES * 2 };
  };

  /* The surface in one direction: the ball, or whichever spoke beats it. */
  DG.formRadius = function (nx, ny, nz, form) {
    var ends = form.ends;
    var best = form.ball;
    for (var e = 0; e < form.n; e++) {
      var c = nx * ends[e * 5] + ny * ends[e * 5 + 1] + nz * ends[e * 5 + 2];
      if (c <= 0) continue;                       // the cone only runs one way
      var ew = ends[e * 5 + 4];
      var r = ew / (Math.sqrt(1 - c * c) + ew * c / ends[e * 5 + 3]);
      if (r > best) best = r;
    }
    return best;
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

      var r = DG.formRadius(dx, dy, dz, form);
      var px = dx * r, py = dy * r, pz = dz * r;
      var lift = 0;

      if (fluid > 0) {
        /*
         * A last grain on top of the spokes' own movement, so the surface
         * reads as a scatter of particles a shell thick rather than as a skin
         * drawn on a solid. Small, and fixed per particle: the life in the
         * form comes from the spokes, and this only stops the shell looking
         * machined.
         *
         * It is a distance, not a percentage of the radius. Scaling the
         * radius stretches a spike in proportion to how long it already is,
         * so the points grow sparse dotted tails and the star reads far
         * sharper than it is drawn.
         */
        var grain = (hash(i, 63) - 0.5) + 0.7 * (hash(i, 87) - 0.5);
        var nudge = fluid * 0.12 * grain * Math.pow(r, 0.35);
        px += dx * nudge; py += dy * nudge; pz += dz * nudge;

        var side = fluid * 0.07 * r;
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
