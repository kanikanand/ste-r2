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
 *   The surface is a radius, not a constant. Every direction has a distance
 *   from the centre, one for the sphere and one for the star, and the Morph
 *   control mixes them. Every value in between is a real shape rather than a
 *   cross-fade between two pictures.
 *
 *   The particles are not fixed to it. Each one slides along its own orbit,
 *   so the surface is a place they pass through rather than a grid they are
 *   pinned to.
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
    points: 8,            // points on the star
    spike: 0.85,          // how far the points reach
    sharp: 3.2,           // how drawn-out they are
    fluid: 0.35,          // the surface's own drift

    dist: 3.2,            // camera distance, in form radii; under 1 is inside
    lens: 1,              // how wide the lens is
    heading: 0,           // where the drag has turned the form to
    /*
     * Looking down the axis, near enough. The star's points ring the waist, so
     * its silhouette is a star from the pole and a spiked disc from the side —
     * and the form turns about that same axis, which from here is the star
     * rotating in the plane of the picture rather than tipping away. Drag the
     * tilt off and the third dimension is right there; this is only where it
     * opens.
     */
    tilt: 78,
    speed: 1 / 24,        // turns a second
    orbit: 0.5,           // how far particles slide along the surface

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

  /* Value noise on the sphere's own coordinates, cross-faded so it loops. */
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
  function fluidNoise(x, y, z, t, seed) {
    var a = noise3(x + t * 1.6, y - t * 1.1, z + t * 0.7, seed);
    var b = noise3(x - (1 - t) * 1.6, y + (1 - t) * 1.1, z - (1 - t) * 0.7, seed);
    return a * (1 - t) + b * t;
  }

  /*
   * The star's radius in a given direction. Eight points around the equator by
   * default, from |cos| of four turns of longitude: a cosine of four gives
   * eight extremes, and the absolute value turns the troughs into points too.
   *
   * The latitude term is what keeps it a solid rather than a cookie cutter.
   * Without it the points run from pole to pole as ridges and the form reads as
   * a fluted column; falling away towards the poles leaves the points around
   * the waist, and it is their silhouette that makes the star.
   */
  function starRadius(nx, ny, nz, p) {
    var lon = Math.atan2(nz, nx);
    var lat = Math.asin(Math.max(-1, Math.min(1, ny)));
    var lobe = Math.abs(Math.cos(lon * p.points / 2));
    var waist = Math.pow(Math.cos(lat), 1.6);
    return 1 + p.spike * Math.pow(lobe, p.sharp) * waist;
  }

  /*
   * Where the surface sits in a direction, for a given morph and moment.
   *
   * The two shapes are mixed as radii rather than as positions, which is what
   * keeps every setting in between a shape in its own right: a point on the
   * half-morphed form is on the surface of a real solid, not halfway along a
   * line between two of them.
   */
  DG.surfaceAt = function (nx, ny, nz, morph, t, p) {
    var r = 1 + (starRadius(nx, ny, nz, p) - 1) * morph;
    if (p.fluid > 0) {
      // Two octaves, the coarse one swelling whole regions and the fine one
      // rippling across them.
      var f = fluidNoise(nx * 1.7, ny * 1.7, nz * 1.7, t, 11) - 0.5;
      var g = fluidNoise(nx * 4.1 + 3, ny * 4.1 - 2, nz * 4.1 + 5, t, 29) - 0.5;
      r *= 1 + p.fluid * (0.42 * f + 0.18 * g);
    }
    return r;
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
       * The orbit. Each particle turns about its own axis at its own whole
       * number of turns per cycle, so they slide across the form at different
       * rates and in different directions instead of drifting as one sheet.
       * Whole numbers, or the loop will not close.
       */
      if (p.orbit > 0) {
        var turns = 1 + Math.floor(hash(i, 91) * 3);
        var ang = TAU * turns * phase * p.orbit;
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

      var r = DG.surfaceAt(dx, dy, dz, morph, phase, p);

      orient(dx * r, dy * r, dz * r, cosH, sinH, cosT, sinT, v3);

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
       * reads as distance.
       */
      var d = {
        x: sx, y: sy, r: baseR * scale, z: -zc, zc: zc,
        nx: (sx - cx) / (Math.min(width, height) * 0.5),
        ny: (sy - cy) / (Math.min(width, height) * 0.5)
      };
      dots.push(d);
      if (zc < zNear) zNear = zc;
      if (zc > zFar) zFar = zc;
    }

    /*
     * Depth is measured against what is actually in view, not against a fixed
     * window. The camera can sit three radii back or half a radius inside, and
     * those are completely different ranges of distance — a fixed window reads
     * the whole of one of them as "far", which is why the inside view came out
     * uniformly dim. Taking the near and far of the frame itself means the
     * nearest particle is always full size and the farthest always smallest,
     * wherever the camera is standing.
     */
    var zSpan = Math.max(0.001, zFar - zNear);
    for (var k = 0; k < dots.length; k++) {
      var dk = dots[k];
      var near01 = clamp01(1 - (dk.zc - zNear) / zSpan);
      var depth = Math.pow(near01, p.contrast);
      var v = clamp01(1 - p.sizeVariation + p.sizeVariation * depth);
      dk.v = v;
      dk.depth = near01;
      dk.r *= v;
      if (useGradient) {
        var gv = p.gradientMap === 'depth' ? near01 : DG.gradientCoord(p.gradientMap, dk);
        if (p.gradientReverse) gv = 1 - gv;
        dk.color = ramp[Math.min(ramp.length - 1, Math.max(0, Math.round(gv * (ramp.length - 1))))];
      }
    }
    dots = dots.filter(function (x) { return x.r >= 0.09; });

    // Farthest first, so a near particle covers a far one rather than the other
    // way about.
    dots.sort(function (a, b) { return a.z - b.z; });
    return dots;
  };

  /* No labels on this one; the renderers ask, so the answer is none. */
  DG.generateLabels = function () { return []; };
})(DG);
