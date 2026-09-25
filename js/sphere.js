/* ============================================================================
 * sphere.js — Sphere mode: an orbiting particle sphere under a distortion
 * field.
 *
 * The arithmetic here is the attached prototype's, carried across as it was
 * written: the golden-angle placement, the five distortion patterns, the
 * twist, the vertical stretch, the perspective divide, the depth fade and the
 * far-to-near sort are all the original lines. What changed is only what has
 * to, for three modes to share one page:
 *
 *   The prototype held its state in module variables and drew straight to a
 *   canvas on every animation frame. Here a frame is a pure function of the
 *   position in the loop, because that is what the shared exporters need — a
 *   GIF or an SVG is rendered at a stated t rather than captured as it plays.
 *
 *   Its two loop terms already had whole-cycle counts worked out for export
 *   (the orbit, and the distortion's 40π repeat). Those are what t drives, so
 *   what plays on screen and what is written to a file are the same thing.
 *
 *   The particle table is built once and kept, exactly as the prototype built
 *   it once at startup — including the random per-particle size offset, which
 *   has to be the same list from frame to frame or the loop would fizz.
 * ==========================================================================*/
var DG = window.DG || (window.DG = {});

(function (DG) {
  'use strict';

  var TAU = Math.PI * 2;

  /*
   * The distortion field contains several rational temporal multipliers,
   * including 1.25, 0.8, 0.55, 1.75, 1.4, 0.65, 1.8, 0.45, 1.9, and 2.5. 40π
   * is their shared repeat period, so the distortion returns exactly to its
   * starting state.
   */
  var DISTORTION_LOOP_PERIOD = Math.PI * 40;

  DG.SPHERE_PATTERNS = [
    { id: 'organic', label: 'Organic waves' },
    { id: 'ripple', label: 'Concentric ripple' },
    { id: 'bands', label: 'Latitude bands' },
    { id: 'turbulence', label: 'Turbulent noise' },
    { id: 'pulse', label: 'Global pulse' }
  ];

  var DEFAULTS = {
    frame: '16:9',

    count: 2000,             // particle count
    particleSize: 2.5,       // particle size in pixels, before perspective
    orbitSpeed: 1,           // orbit speed, ×
    farFade: 0.75,           // how much opacity the farthest particles lose

    distortionMode: 'organic',
    wave: 0.15,              // distortion amount
    frequency: 4,            // pattern frequency
    distortionSpeed: 1,      // distortion motion, ×
    detail: 0.35,            // detail mix
    twist: 0,                // surface twist
    stretch: 0,              // vertical stretch

    rotX: 0.3,               // the lean the drag has given it
    rotY: 0,                 // where the drag has turned it to
    cameraZ: 500,            // the wheel's zoom

    speed: 1 / 24,           // turns of the loop a second
    dotAlpha: 1,
    colorMode: 'ink',
    mesh: null,
    highlightMode: 'flame',
    background: 'paper',
    size: 'L'
  };

  /* ---- the prototype's own arithmetic, unchanged ------------------------ */

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  var cache = { count: 0, particles: null };

  function createSphereParticles(count) {
    var particles = [];
    var phi = Math.PI * (3 - Math.sqrt(5));

    for (var i = 0; i < count; i += 1) {
      var y = count === 1 ? 0 : 1 - (i / (count - 1)) * 2;
      var radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
      var theta = phi * i;

      particles.push({
        baseX: Math.cos(theta) * radiusAtY,
        baseY: y,
        baseZ: Math.sin(theta) * radiusAtY,
        x: 0,
        y: 0,
        z: 0,
        sizeOffset: Math.random() * 0.4 + 0.8
      });
    }
    return particles;
  }

  function particlesFor(count) {
    if (cache.count !== count) {
      cache.count = count;
      cache.particles = createSphereParticles(count);
    }
    return cache.particles;
  }

  function rotateX(point, angle) {
    var cos = Math.cos(angle);
    var sin = Math.sin(angle);
    return { x: point.x, y: point.y * cos - point.z * sin, z: point.y * sin + point.z * cos };
  }

  function rotateY(point, angle) {
    var cos = Math.cos(angle);
    var sin = Math.sin(angle);
    return { x: point.x * cos + point.z * sin, y: point.y, z: -point.x * sin + point.z * cos };
  }

  function getDistortionValue(particle, frequency, phase, detail, mode, twist) {
    var x = particle.baseX;
    var y = particle.baseY;
    var z = particle.baseZ;

    var longitude = Math.atan2(z, x);
    var latitude = Math.asin(clamp(y, -1, 1));
    var twistedLongitude = longitude + twist * Math.PI * y;

    var primary = 0;
    var secondary = 0;
    var micro = 0;

    switch (mode) {
      case 'ripple':
        primary = Math.sin(latitude * frequency * 2.6 + phase * 1.4 + Math.sin(twistedLongitude * 2) * detail);
        secondary = Math.cos(twistedLongitude * frequency * 0.75 - phase * 0.65);
        micro = Math.sin(latitude * frequency * 5.5 + phase * 1.8);
        break;

      case 'bands':
        primary = Math.sin(y * frequency * 4 + phase * 1.1);
        secondary = Math.sin(twistedLongitude * frequency * 1.6 + y * frequency * 2 + phase * 0.45);
        micro = Math.cos(y * frequency * 8 - phase * 0.8);
        break;

      case 'turbulence':
        primary = Math.sin(x * frequency + phase) * Math.cos(z * frequency * 1.17 - phase * 0.8);
        secondary = Math.sin((x + y + z) * frequency * 1.8 + phase * 1.25) *
                    Math.cos((x - z) * frequency * 2.3 - phase * 0.55);
        micro = Math.sin((x * 1.7 - y * 1.3 + z * 2.1) * frequency * 2.5 + phase * 1.9);
        break;

      case 'pulse':
        primary = Math.sin(phase * 1.5 + y * frequency * 0.75);
        secondary = Math.cos(phase * 0.9 + twistedLongitude * frequency * 1.2);
        micro = Math.sin(phase * 2.2 + latitude * frequency * 3);
        break;

      case 'organic':
      default:
        primary = Math.sin(x * frequency * 1.15 + y * frequency * 0.85 + phase * 1.25) *
                  Math.cos(z * frequency * 0.95 - phase * 0.8);
        secondary = Math.sin((x - z) * frequency * 1.9 + y * frequency * 0.45 + phase * 0.55);
        micro = Math.cos((x + y - z) * frequency * 3.2 + phase * 1.75);
        break;
    }

    var layeredValue = primary * (1 - detail) + (secondary * 0.7 + micro * 0.3) * detail;
    return clamp(layeredValue, -1, 1);
  }

  function updateParticlePositions(particles, p, baseRadius, orbitAngle, distortionPhase) {
    var phase = Number.isFinite(distortionPhase) ? distortionPhase : 0;
    var verticalScale = 1 + p.stretch * 0.65;

    for (var i = 0; i < particles.length; i += 1) {
      var particle = particles[i];

      var waveValue = getDistortionValue(particle, p.frequency, phase, p.detail, p.distortionMode, p.twist);
      var currentRadius = baseRadius * (1 + p.wave * waveValue);

      var twistAngle = p.twist * Math.PI * particle.baseY;
      var twistCos = Math.cos(twistAngle);
      var twistSin = Math.sin(twistAngle);

      var twistedX = particle.baseX * twistCos - particle.baseZ * twistSin;
      var twistedZ = particle.baseX * twistSin + particle.baseZ * twistCos;

      var originalPoint = {
        x: twistedX * currentRadius,
        y: particle.baseY * currentRadius * verticalScale,
        z: twistedZ * currentRadius
      };

      var rotated = rotateY(originalPoint, orbitAngle);
      rotated = rotateX(rotated, p.rotX);

      particle.x = rotated.x;
      particle.y = rotated.y;
      particle.z = rotated.z;
    }

    particles.sort(function (a, b) { return b.z - a.z; });
  }

  /* ---- what the suite asks for ------------------------------------------ */

  /*
   * How many whole turns each term takes over one loop. The prototype worked
   * these out for its own export so the last frame would meet the first; the
   * same numbers drive the live view here, which is why what is on screen and
   * what is written to a file are the same motion rather than two takes of it.
   */
  function wholeCycles(rate) {
    var magnitude = Math.abs(Number(rate));
    if (!Number.isFinite(magnitude) || magnitude <= 0) return 0;
    return Math.max(1, Math.round(magnitude));
  }

  function dots(p, width, height, t) {
    var particles = particlesFor(Math.max(50, Math.round(p.count)));
    var phase = t - Math.floor(t);

    /*
     * The prototype sized the sphere at a fixed 180px against an 800×600
     * stage; against the short side that is a little under a third, which is
     * what keeps it the same fraction of the frame at every download size and
     * in every aspect ratio.
     */
    var shortSide = Math.min(width, height);
    var baseRadius = shortSide * 0.3;
    var cameraZ = p.cameraZ * (shortSide / 600);

    var orbitAngle = p.rotY + TAU * wholeCycles(p.orbitSpeed) * phase;
    var distortionPhase = DISTORTION_LOOP_PERIOD *
      wholeCycles(1.2 * p.orbitSpeed * p.distortionSpeed) * phase;

    updateParticlePositions(particles, p, baseRadius, orbitAngle, distortionPhase);

    var centerX = width / 2;
    var centerY = height / 2;

    var farDepth = 0;
    var nearDepth = 0;
    if (particles.length > 0) {
      // Positive z values are farther from the camera, and the sort above runs
      // from farthest to nearest.
      farDepth = particles[0].z;
      nearDepth = particles[particles.length - 1].z;
    }
    var depthRange = Math.max(0.000001, farDepth - nearDepth);
    var fadeAmount = clamp(Number(p.farFade), 0, 1);

    var particleBaseSize = p.particleSize * (shortSide / 600);
    var tint = DG.meshHexSampler(p.mesh, p.meshBlend);
    var useGradient = p.colorMode === 'gradient';
    var out = [];

    for (var i = 0; i < particles.length; i += 1) {
      var particle = particles[i];

      var farFactor = clamp((particle.z - nearDepth) / depthRange, 0, 1);
      var particleOpacity = clamp(1 - fadeAmount * farFactor, 0, 1);
      if (particleOpacity <= 0.001) continue;

      var denominator = Math.max(60, cameraZ + particle.z);
      var perspectiveScale = cameraZ / denominator;

      var d = {
        x: particle.x * perspectiveScale + centerX,
        y: particle.y * perspectiveScale + centerY,
        r: Math.max(0.35, particleBaseSize * perspectiveScale * particle.sizeOffset),
        a: particleOpacity,
        v: particleOpacity,
        nx: (particle.x * perspectiveScale) / (shortSide * 0.5),
        ny: (particle.y * perspectiveScale) / (shortSide * 0.5),
        depth: 1 - farFactor
      };
      if (useGradient) d.color = tint(d.x / width, d.y / height);
      out.push(d);
    }
    return out;
  }

  /*
   * Registered directly rather than through DG.register: this one was written
   * for the suite from the start and never claimed DG.DEFAULTS, so there is
   * nothing to take back off it.
   */
  DG.ENGINES.sphere = { id: 'sphere', defaults: DEFAULTS, dots: dots, labels: null };
})(DG);
