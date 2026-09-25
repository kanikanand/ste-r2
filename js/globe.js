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
    axisTilt: 23.4,       // degrees the axis it turns about leans across the frame
    heading: 0,           // where the drag has turned the globe to, in degrees
    speed: 1 / 24,        // revolutions per second; the Spin control reads its reciprocal
    seaDots: 0,           // how large the sea's dots are drawn, 0 for none

    highlights: [],       // country indices to pick out
    labels: true,
    hotSize: 1.35,        // how much larger a picked country's dots are drawn
    hotDensity: 1.9,      // how much finer its lattice is

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
   * it, the drag's lean tips the whole thing towards the viewer, the axis tilt
   * rolls it across the frame, and the result is projected straight down the z
   * axis — an orthographic view, so the globe reads as a globe rather than as
   * a fisheye.
   *
   * The two leans are not the same thing, which is why there are two of them.
   * The drag's tips the axis towards the camera or away from it, and from
   * head-on that is invisible in the axis itself — the pole still points
   * straight up the frame, it is only the land that slides. The axis tilt is a
   * roll about the line of sight, applied last, and it is the one that leans
   * the axis over in the picture: the poles move off the vertical and the
   * globe is seen to be turning about a slanted line, the way the Earth
   * actually does. Doing it last is what makes it a roll rather than another
   * lean — anything applied before the projection in the other order would
   * mix back into depth.
   *
   * Returns z alongside: positive is the hemisphere facing us, and everything
   * behind is dropped rather than drawn on top of what is in front of it.
   */
  function project(lat, lon, rot, cosT, sinT, cosA, sinA, cx, cy, R, out) {
    var la = lat * RAD;
    var lo = (lon + rot) * RAD;
    var cl = Math.cos(la);
    var x = cl * Math.sin(lo);
    var y = Math.sin(la);
    var z = cl * Math.cos(lo);

    var y2 = y * cosT - z * sinT;
    var z2 = y * sinT + z * cosT;

    // The roll. Depth is untouched by it, so what was facing us still is.
    var x3 = x * cosA - y2 * sinA;
    var y3 = x * sinA + y2 * cosA;

    out[0] = cx + x3 * R;
    out[1] = cy - y3 * R;
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
    var rot = (t - Math.floor(t)) * 360 + p.heading;
    var tilt = p.tilt * RAD;
    var cosT = Math.cos(tilt);
    var sinT = Math.sin(tilt);
    var axis = (p.axisTilt || 0) * RAD;
    var cosA = Math.cos(axis);
    var sinA = Math.sin(axis);

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

      project(lat, lon, rot, cosT, sinT, cosA, sinA, cx, cy, R, out);
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

      // A picked country's own dots are left to the finer pass below, or it
      // would be drawn twice: once at the base spacing and once at the fine.
      var hot = anyPicked && picked[country];
      if (hot && p.hotDensity > 1.01) continue;

      var r = maxR * v * (isLand ? 1 : p.seaDots) * (hot ? p.hotSize : 1);
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

    /*
     * The picked countries again, on a lattice as much finer as the Density
     * control asks for. Density and size are the two things that separate a
     * picked country from the rest here, with colour: more dots in the same
     * area, and each of them larger.
     *
     * The finer lattice is walked only across each country's own extent rather
     * than over the whole sphere. At twice the rings there are four times the
     * points, and all but a handful of them would be thrown away — Singapore
     * would cost forty thousand lookups to find its one dot.
     */
    if (anyPicked && p.hotDensity > 1.01) {
      var fineRings = Math.round(rings * p.hotDensity);
      var fineGap = (Math.PI * R) / fineRings;
      var fineMax = (fineGap / 2) * p.dotScale;

      for (var hk = 0; hk < p.highlights.length; hk++) {
        var hc = p.highlights[hk];
        if (hc < 0) continue;
        var bb = DG.countryBounds(hc);
        var r0 = Math.max(0, Math.floor((90 - bb.north) / 180 * fineRings) - 1);
        var r1 = Math.min(fineRings - 1, Math.ceil((90 - bb.south) / 180 * fineRings));

        for (var fr = r0; fr <= r1; fr++) {
          var flat = 90 - (fr + 0.5) / fineRings * 180;
          var fcount = Math.max(1, Math.round(fineRings * 2 * Math.cos(flat * RAD)));
          // The same span in longitude, as a run of this ring's own steps.
          var c0 = Math.max(0, Math.floor((bb.west + 180) / 360 * fcount) - 1);
          var c1 = Math.min(fcount - 1, Math.ceil((bb.east + 180) / 360 * fcount));

          for (var fi = c0; fi <= c1; fi++) {
            var flon = (fi + 0.5) / fcount * 360 - 180;
            if (DG.countryAt(flon, flat) !== hc) continue;

            project(flat, flon, rot, cosT, sinT, cosA, sinA, cx, cy, R, out);
            if (out[2] <= 0) continue;
            if (p.scatter > 0 && hash2(fr * 7919 + fi, hc + 2, p.seed) < p.scatter) continue;

            var fd = Math.pow(out[2], p.contrast);
            var fv = clamp01(1 - p.sizeVariation + p.sizeVariation * fd);
            var fR = fineMax * fv * p.hotSize;
            if (fR < 0.12) continue;

            dots.push({
              x: out[0], y: out[1], r: fR, v: fv, z: out[2],
              nx: (out[0] - cx) / R, ny: (out[1] - cy) / R,
              country: hc, hot: true, sea: false
            });
          }
        }
      }
    }

    /*
     * A picked country smaller than the gap between dots can easily have no dot
     * standing on it — Singapore is about one twentieth of the spacing at this
     * density — and it would then be picked, named by its label, and show
     * nothing at all. So any picked country that came up empty takes the
     * nearest dot to where its label points, which is the dot a reader would
     * take to be it anyway.
     */
    if (anyPicked) {
      for (var hi = 0; hi < p.highlights.length; hi++) {
        var ci = p.highlights[hi];
        if (ci < 0) continue;
        var found = false;
        for (var d2 = 0; d2 < dots.length; d2++) {
          if (dots[d2].country === ci) { found = true; break; }
        }
        if (found) continue;
        var a2 = DG.countryAnchor(ci);
        project(a2.lat, a2.lon, rot, cosT, sinT, cosA, sinA, cx, cy, R, out);
        if (out[2] <= 0) continue;                  // on the far side; nothing to show
        var near = -1;
        var bestD = Infinity;
        for (d2 = 0; d2 < dots.length; d2++) {
          var ddx = dots[d2].x - out[0];
          var ddy = dots[d2].y - out[1];
          var dd = ddx * ddx + ddy * ddy;
          if (dd < bestD) { bestD = dd; near = d2; }
        }
        if (near >= 0) { dots[near].hot = true; dots[near].r *= p.hotSize; }
      }
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
    var rot = (t - Math.floor(t)) * 360 + p.heading;
    var tilt = p.tilt * RAD;
    var cosT = Math.cos(tilt);
    var sinT = Math.sin(tilt);
    var axis = (p.axisTilt || 0) * RAD;
    var cosA = Math.cos(axis);
    var sinA = Math.sin(axis);
    var out = [0, 0, 0];
    var labels = [];

    for (var i = 0; i < p.highlights.length; i++) {
      var ci = p.highlights[i];
      if (ci < 0 || ci >= names.length) continue;
      var a = DG.countryAnchor(ci);
      project(a.lat, a.lon, rot, cosT, sinT, cosA, sinA, cx, cy, R, out);
      // A shade past the horizon rather than exactly at it, so a label does not
      // flicker on and off while its anchor grazes the edge.
      if (out[2] <= 0.12) continue;
      labels.push({ x: out[0], y: out[1], z: out[2], text: names[ci],
        fade: clamp01((out[2] - 0.12) / 0.18) });
    }
    labels.sort(function (a, b) { return a.z - b.z; });
    return labels;
  };

  /* Handed over by name; see modes.js for why. */
  DG.register('globe');
})(DG);
