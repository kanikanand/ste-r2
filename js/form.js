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
 *   The star is built the way the diagram builds it: from long spokes laid
 *   over one another through a common centre. Four axes, turned so they are
 *   spread evenly through space, make eight points — and because they point
 *   in eight genuinely different directions rather than ringing one waist,
 *   the star reads as a star from wherever you stand.
 *
 *   The particles are not fixed to it. Each one slides along its own orbit,
 *   so the surface is a place they pass through rather than a grid they are
 *   pinned to, and Fluidity lifts a share of them off it altogether.
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
  var CORE = 0.24;      // the ball the spokes run out of
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

    morph: 0,             // 0 a sphere, 1 the star
    breathe: 0,           // how far the morph swings on its own over the loop
    spike: 0.85,          // how far past the sphere the points reach
    sharp: 2.2,           // how sharply the spokes taper to their points
    fluid: 0.2,           // how much of the cloud is carried off in the flow

    dist: 3.2,            // camera distance, in form radii; under 1 is inside
    lens: 1,              // how wide the lens is
    heading: 0,           // where the drag has turned the form to
    tilt: 12,             // the lean drag has given it

    speed: 1 / 24,        // turns a second
    orbit: 2,             // whole turns a particle makes along its orbit per cycle

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

  /* Value noise on the form's own coordinates, cross-faded so it loops. */
  function noise3(x, y, z, seed) {
    var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    var xf = x - xi, yf = y - yi, zf = z - zi;
    var u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
    function g(a, b, c) { return hash(Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(c, 83492791), seed); }
    var c000 = g(xi, yi, zi), c100 = g(xi + 1, yi, zi);
    var c010 = g(xi, yi + 1, zi), c110 = g(xi + 1, yi + 1, zi);
    var c001 = g(xi, yi, zi + 1), c101 = g(xi + 1, yi, zi + 1);
    var c011 = g(xi, yi + 1, zi + 1), c111 = g(xi + 1, yi + 1, zi + 1);
    var x00 = c000 + (c100 - c000) * u, x10 = c010 + (c110 - c010) * u;
    var x01 = c001 + (c101 - c001) * u, x11 = c011 + (c111 - c011) * u;
    var y0 = x00 + (x10 - x00) * v, y1 = x01 + (x11 - x01) * v;
    return y0 + (y1 - y0) * w;
  }

  /*
   * Noise that returns to where it started. One layer drifts away across the
   * cycle while a second drifts in to meet it, cross-faded straight across —
   * easing the fade would send it back to the layer it left rather than the one
   * it is heading for, and the loop would jump.
   */
  function flowNoise(x, y, z, t, seed) {
    var a = noise3(x + t * 1.6, y - t * 1.1, z + t * 0.7, seed);
    var b = noise3(x - (1 - t) * 1.6, y + (1 - t) * 1.1, z - (1 - t) * 0.7, seed);
    return a * (1 - t) + b * t;
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
   * How far the form reaches along a spoke: a cone, solved rather than shaped
   * by a falloff. A ray leaving the centre at angle θ to the axis meets a cone
   * of height h and base half-width w where r·sinθ = w(1 − r·cosθ/h), which is
   * r = w / (sinθ + w·cosθ/h) — a straight-sided spike that comes to a point.
   * Every smooth falloff tried before this (a cosine raised to a power, an
   * ellipse, a spheroid) is widest somewhere along its length and rounds off
   * into a petal, which is what made the star read as a flower. A star point
   * is a cone, so this draws a cone.
   *
   * Sharpness is the base width: low and the spokes are stubby wedges, high
   * and they are needles. Where the cone is narrower than the core ball the
   * ball shows through, which is the join at the centre.
   */
  function spokeRadius(c, p) {
    var h = 1 + 0.55 * clamp01(p.spike);
    var w = 0.9 / (1 + 0.6 * Math.max(0.5, p.sharp));
    var sn = Math.sqrt(Math.max(0, 1 - c * c));
    var r = w / (sn + w * c / h);
    return r > CORE ? r : CORE;
  }

  /*
   * A point on the form, from the direction a particle is looking out along.
   *
   * The radius is mixed from the sphere's 1 and the nearest spoke's cone as
   * radii rather than as positions, which is what keeps every setting in
   * between a shape in its own right: a point on the half-morphed form is on
   * the surface of a real solid, not halfway along a line between two of them.
   * The direction itself is left alone. Crowding particles towards the spoke
   * axes to fill the points out was tried and is a trap — the pull has to send
   * particles on either side of the line between two spokes towards different
   * axes, which tears a bare wedge along every one of those lines and empties
   * the core as well. The spokes are populated by being wide enough, and by
   * the dot size below.
   *
   * Nothing here moves on its own. The scatter that Fluidity drives is a thing
   * that happens to the particles, not to the shape they are sitting on.
   */
  DG.formPoint = function (nx, ny, nz, morph, p, out) {
    var r = 1;
    if (morph > 0) {
      var axes = spokeAxes(SPOKES);
      var bc = 0;
      for (var k = 0; k < SPOKES; k++) {
        var d = nx * axes[k * 3] + ny * axes[k * 3 + 1] + nz * axes[k * 3 + 2];
        var c = d < 0 ? -d : d;
        if (c > bc) bc = c;
      }
      r = 1 + (spokeRadius(bc, p) - 1) * morph;
    }
    out[0] = nx * r; out[1] = ny * r; out[2] = nz * r; out[3] = r;
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

    /*
     * The flow. Fluidity is not something the surface does; it is how much of
     * the cloud has let go of it. A share of the particles equal to the
     * setting is released and carried along a drifting field.
     *
     * Two things make that read as flow rather than as the form going grainy.
     * Which particles go is decided mostly by a drifting field rather than
     * one by one, so whole patches of surface peel away together; and the
     * field that carries them is coarse, so the patch stays a patch as it
     * travels. What leaves is a stream with a head and a tail, because the
     * particles at the edge of the share are only just released and trail the
     * ones fully in it.
     */
    var fluid = clamp01(p.fluid);

    var ramp = DG.buildRamp(96, p.stops);
    var useGradient = p.colorMode === 'gradient';
    var fp = [0, 0, 0, 1];
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

      DG.formPoint(dx, dy, dz, morph, p, fp);
      var px = fp[0], py = fp[1], pz = fp[2], r = fp[3];
      var lift = 0;

      if (fluid > 0) {
        /*
         * Scatter. The form stays where it is — this does not lift particles
         * off it and blow them away, it makes its edges irregular and its
         * surface a scattered shell rather than a drawn one.
         *
         * Two things at once, and the difference between them is the point.
         * A drifting field, coarse enough to take in a whole spoke, moves the
         * surface in and out: spikes come out at different lengths and
         * thicknesses from one another and from themselves a moment later, so
         * the sharpness of the form reads as irregular rather than machined.
         * On top of that each particle has its own fixed offset, in and out
         * and sideways, so what sits on that surface is a scatter of
         * particles a shell thick instead of a skin.
         *
         * Everything here is a fraction of the radius the particle is already
         * at, so a spike is roughened along its length rather than snapped
         * off, and the star is still a star at the top of the range.
         */
        var w1 = flowNoise(dx * 1.15, dy * 1.15, dz * 1.15, phase, 11) - 0.5;
        var w2 = flowNoise(dx * 3.1 + 5, dy * 3.1 - 2, dz * 3.1 + 7, phase, 23) - 0.5;
        var grain = hash(i, 63) - 0.5;
        var swell = 1 + fluid * (0.52 * w1 + 0.26 * w2 + 0.34 * grain);
        px *= swell; py *= swell; pz *= swell;

        // Sideways as well, or the scatter is only ever a thickness and the
        // rows the particles were placed in stay legible through it.
        var side = fluid * 0.13 * r;
        px += (hash(i, 111) - 0.5) * side;
        py += (hash(i, 127) - 0.5) * side;
        pz += (hash(i, 149) - 0.5) * side;

        // Far enough out on the swell, the dot thins — a particle standing off
        // the surface carries less of it.
        lift = clamp01((swell - 1) * 1.6);
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
