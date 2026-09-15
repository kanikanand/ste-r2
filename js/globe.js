/* ============================================================================
 * globe.js — the dots, placed on a sphere and turned.
 *
 * It exposes DG.generateDots(params, width, height, t), the same call the flat
 * patterns used, returning the same list of { x, y, r, v, colour } in screen
 * pixels. Everything downstream — the canvas renderer, the SVG writer, the GIF
 * encoder, the video recorder — is unchanged and unaware that the field it is
 * drawing is now a globe.
 *
 * t is the position in the loop, 0..1, and the globe turns exactly once across
 * it. That is what lets a ten second GIF and a one minute video both close
 * without a jump, the same rule the patterns worked under.
 * ==========================================================================*/
var DG = window.DG || (window.DG = {});

(function (DG) {
  'use strict';

  var TAU = Math.PI * 2;
  var RAD = Math.PI / 180;
  var clamp01 = (DG.clamp01 = function (v) { return v < 0 ? 0 : v > 1 ? 1 : v; });

  DG.DEFAULTS = {
    frame: '16:9',
    grid: 74,             // rings of dots from pole to pole
    dotScale: 0.78,       // largest dot, against the spacing between dots
    sizeVariation: 0.55,  // how much the limb's dots shrink against the centre
    dotAlpha: 1,
    contrast: 1,
    scatter: 0,
    seed: 1,

    globeSize: 0.86,      // the globe's diameter against the short side
    tilt: 16,             // degrees, positive leans the north pole towards us
    spin: 0,              // degrees of extra rotation, for framing a still
    speed: 0.08,          // revolutions per second
    seaDots: 0,           // how large the sea's dots are drawn, 0 for none

    highlights: [],       // country indices to pick out
    labels: true,

    colorMode: 'slate',
    highlightMode: 'red',
    gradientMap: 'y',
    gradientReverse: false,
    stops: [0, 0.5, 1],
    background: 'black',
    size: 'L'
  };

  function hash2(i, j, seed) {
    var h = Math.imul(i, 0x27d4eb2d) + Math.imul(j, 0x165667b1) + Math.imul(seed, 0x9e3779b1);
    h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
    h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
    h ^= h >>> 15;
    return (h >>> 0) / 4294967296;
  }

  /*
   * Rings of latitude, with the count in each ring falling away as the cosine
   * of its latitude. A plain lat/lon grid puts as many dots across a ring at
   * the pole as at the equator, and they pile into a bright smear at the top
   * and bottom of the globe; scaling by the cosine keeps the spacing between
   * dots about the same everywhere, which is what makes the surface read as a
   * surface rather than as a wireframe.
   */
  function lattice(rings) {
    var pts = [];
    for (var r = 0; r < rings; r++) {
      var lat = 90 - (r + 0.5) / rings * 180;
      var count = Math.max(1, Math.round(rings * 2 * Math.cos(lat * RAD)));
      for (var i = 0; i < count; i++) {
        pts.push(lat, (i + 0.5) / count * 360 - 180);
      }
    }
    return pts;
  }

  var cache = { rings: 0, pts: null };

  function latticeFor(rings) {
    if (cache.rings !== rings) { cache.rings = rings; cache.pts = lattice(rings); }
    return cache.pts;
  }

  /*
   * Where a place ends up on screen. Longitude turns the globe, latitude lifts
   * it, the tilt leans the whole thing towards the viewer, and the result is
   * projected straight down the z axis — an orthographic view, so the globe
   * reads as a globe rather than as a fisheye.
   *
   * Returns z alongside: positive is the hemisphere facing us, and everything
   * behind is dropped rather than drawn on top of what is in front of it.
   */
  function project(lat, lon, rot, cosT, sinT, cx, cy, R, out) {
    var la = lat * RAD;
    var lo = (lon + rot) * RAD;
    var cl = Math.cos(la);
    var x = cl * Math.sin(lo);
    var y = Math.sin(la);
    var z = cl * Math.cos(lo);

    var y2 = y * cosT - z * sinT;
    var z2 = y * sinT + z * cosT;

    out[0] = cx + x * R;
    out[1] = cy - y2 * R;
    out[2] = z2;
    return out;
  }
  DG.projectLatLon = project;

  DG.generateDots = function (params, width, height, t) {
    var p = Object.assign({}, DG.DEFAULTS, params);
    DG.geoReady();

    var rings = Math.max(8, Math.round(p.grid));
    var pts = latticeFor(rings);
    var R = Math.min(width, height) * 0.5 * p.globeSize;
    var cx = width / 2;
    var cy = height / 2;

    // One turn across the loop, plus whatever the Spin control has added.
    var rot = (t - Math.floor(t)) * 360 + p.spin;
    var tilt = p.tilt * RAD;
    var cosT = Math.cos(tilt);
    var sinT = Math.sin(tilt);

    // The spacing between neighbouring dots at the equator, which is what the
    // dot size is measured against.
    var gap = (Math.PI * R) / rings;
    var maxR = (gap / 2) * p.dotScale;

    var picked = {};
    for (var h = 0; h < p.highlights.length; h++) picked[p.highlights[h]] = 1;
    var anyPicked = p.highlights.length > 0;

    var ramp = DG.buildRamp(96, p.stops);
    var useGradient = p.colorMode === 'gradient';
    var out = [0, 0, 0];
    var dots = [];

    for (var i = 0; i < pts.length; i += 2) {
      var lat = pts[i];
      var lon = pts[i + 1];

      project(lat, lon, rot, cosT, sinT, cx, cy, R, out);
      if (out[2] <= 0) continue;                    // the far side

      var country = DG.countryAt(lon, lat);
      var isLand = country >= 0;
      if (!isLand && !p.seaDots) continue;

      if (p.scatter > 0 && hash2(i, country + 2, p.seed) < p.scatter) continue;

      /*
       * The one cue that carries the roundness. Everything else here is flat —
       * no shading, no perspective — so what tells you this is a sphere is that
       * a dot shrinks as it turns away, and the rows crowd together towards the
       * limb because the surface is falling away from you. z is the cosine of
       * the angle from the centre, which is exactly that foreshortening.
       */
      var depth = Math.pow(out[2], p.contrast);
      var v = clamp01(1 - p.sizeVariation + p.sizeVariation * depth);

      var hot = anyPicked && picked[country];
      var r = maxR * v * (isLand ? 1 : p.seaDots) * (hot ? 1.18 : 1);
      if (r < 0.12) continue;

      var dot = {
        x: out[0], y: out[1], r: r, v: v, z: out[2],
        nx: (out[0] - cx) / R, ny: (out[1] - cy) / R,
        country: country, hot: !!hot, sea: !isLand
      };
      if (useGradient && !hot) {
        var g = DG.gradientCoord(p.gradientMap, dot);
        if (p.gradientReverse) g = 1 - g;
        dot.color = ramp[Math.min(ramp.length - 1, Math.max(0, Math.round(g * (ramp.length - 1))))];
      }
      dots.push(dot);
    }

    // Far side first, so a near dot is drawn over a far one where they meet.
    dots.sort(function (a, b) { return a.z - b.z; });
    return dots;
  };

  /*
   * A label for each picked country, at the anchor geo.js found for it, and
   * only while that anchor is on the side of the globe facing us. Returned
   * separately from the dots because a label is type rather than a mark, and
   * both the canvas and the SVG writer draw it as such.
   */
  DG.generateLabels = function (params, width, height, t) {
    var p = Object.assign({}, DG.DEFAULTS, params);
    if (!p.labels || !p.highlights.length) return [];
    DG.geoReady();

    var names = DG.countryNames();
    var R = Math.min(width, height) * 0.5 * p.globeSize;
    var cx = width / 2;
    var cy = height / 2;
    var rot = (t - Math.floor(t)) * 360 + p.spin;
    var tilt = p.tilt * RAD;
    var cosT = Math.cos(tilt);
    var sinT = Math.sin(tilt);
    var out = [0, 0, 0];
    var labels = [];

    for (var i = 0; i < p.highlights.length; i++) {
      var ci = p.highlights[i];
      if (ci < 0 || ci >= names.length) continue;
      var a = DG.countryAnchor(ci);
      project(a.lat, a.lon, rot, cosT, sinT, cx, cy, R, out);
      // A shade past the horizon rather than exactly at it, so a label does not
      // flicker on and off while its anchor grazes the edge.
      if (out[2] <= 0.12) continue;
      labels.push({ x: out[0], y: out[1], z: out[2], text: names[ci],
        fade: clamp01((out[2] - 0.12) / 0.18) });
    }
    labels.sort(function (a, b) { return a.z - b.z; });
    return labels;
  };
})(DG);
