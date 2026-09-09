/* ============================================================================
 * patterns.js — six behaviours of one dot system.
 *
 * The circles are the base geometry. Everything else — a cluster, a route, a
 * front, a rhythm — comes from radius alone. No connecting lines, no gradients
 * inside a dot, no shadows.
 *
 * All six run on the same irregular cluster graph (network.js): centres
 * scattered without a lattice, joined to a few near neighbours by bent routes.
 * What separates them is what they animate on it —
 *
 *   Expansion     how much ground is occupied
 *   Convergence   where activation is heading
 *   Diffusion     which clusters are speaking, and when
 *   Intelligence  a sequence passing along the routes
 *   Adaptation    which routes exist at all, and how sharply they bend
 *   Synchronise   whether the local rhythms agree
 *
 * — rather than a shape sliding across the frame. None of them is an axis-wide
 * band or an evenly spaced row of peaks, and no two clusters share a schedule.
 *
 * Each behaviour resolves, once per frame, to a short list of discs in
 * `prepare`: the clusters currently carrying weight and the short lengths of
 * route currently carrying a pulse. `at` then only measures each dot against
 * that list. Discs are packed flat as x, y, radius, amplitude.
 *
 * Every behaviour is periodic with a period of exactly one cycle, so any
 * length of footage loops. That constrains every animated term: each must
 * complete a whole number of turns per cycle.
 * ==========================================================================*/
var DG = window.DG || (window.DG = {});

(function (DG) {
  'use strict';

  var TAU = DG.TAU;
  var clamp01 = DG.clamp01;
  var smoothstep = DG.smoothstep;
  var tri = DG.tri;
  var hash3 = DG.hash3;
  var noise2 = DG.noise2;
  var loopNoise = DG.loopNoise;

  var pt = [0, 0];

  function frac(v) { return v - Math.floor(v); }

  /* A pulse's shape as it passes: quick to arrive, slower to leave. */
  function envelope(u) {
    if (u < 0 || u > 1) return 0;
    return smoothstep(0, 0.22, u) * (1 - smoothstep(0.45, 1, u));
  }

  function pushDisc(out, x, y, r, amp) {
    if (amp <= 0.004) return;
    out.push(x, y, r, amp);
  }

  /*
   * A run of route rendered as a few overlapping discs — the head of the pulse
   * and a short tail behind it. This is the only way a connection is ever
   * shown: the dots lying along it grow for as long as the pulse is over them.
   */
  function pushRun(out, net, e, s, amp, sharp, r) {
    for (var k = 0; k < 3; k++) {
      var ss = s - k * 0.075;
      if (ss < 0 || ss > 1) continue;
      DG.routePoint(net, e, ss, sharp, pt);
      pushDisc(out, pt[0], pt[1], r * (1 - 0.16 * k), amp * (1 - 0.28 * k));
    }
  }

  /* Timing spread: how far apart the clusters' own moments are allowed to sit. */
  function stagger(p) { return 0.12 + 0.88 * (p.timing === undefined ? 0.6 : p.timing); }

  DG.PATTERNS = [
    {
      id: 'expansion',
      name: 'Expansion',
      form: 'Occupied ground growing outward through a network, then letting go.',
      blurb: 'A front travels the routes from two corners of the field; area is taken, held, and released.',
      prepare: function (t, p) {
        var net = DG.buildNetwork(p);
        var discs = [];
        // One turn: the front advances over the first half and withdraws over
        // the second, so the cycle closes on the ground it started from.
        // Ground is already held at the start of the cycle; a loop that opens
        // and closes on an empty frame spends its ends showing nothing.
        var front = 0.14 + tri(t) * 1.12;
        var soft = 0.30;

        for (var i = 0; i < net.nodes.length; i++) {
          var n = net.nodes[i];
          var lit = 1 - smoothstep(front - soft * 0.4, front + soft, n.spread);
          pushDisc(discs, n.x, n.y, net.rad * (0.7 + 0.42 * n.w), lit * (0.55 + 0.5 * n.w));
        }
        // Routes fill in behind the front, which is what turns a scatter of
        // lit clusters into occupied area.
        for (var e = 0; e < net.edges.length; e++) {
          var ed = net.edges[e];
          var sa = net.nodes[ed.a].spread;
          var sb = net.nodes[ed.b].spread;
          for (var k = 0; k <= DG.EDGE_SAMPLES; k++) {
            var s = k / DG.EDGE_SAMPLES;
            var here = sa + (sb - sa) * s;
            var v = 1 - smoothstep(front - soft * 0.4, front + soft, here);
            if (v <= 0.02) continue;
            DG.routePoint(net, ed, s, 0, pt);
            pushDisc(discs, pt[0], pt[1], net.link, v * 0.85);
          }
        }
        return { discs: discs, floor: 0.19 };
      }
    },
    {
      id: 'convergence',
      name: 'Convergence',
      form: 'Activation arriving from every direction at one place in the field.',
      blurb: 'Pulses launch from the outer clusters and run inward down the routes, meeting at the centre.',
      prepare: function (t, p) {
        var net = DG.buildNetwork(p);
        var discs = [];
        var sp = stagger(p);
        var arrive = 0;

        for (var e = 0; e < net.edges.length; e++) {
          var ed = net.edges[e];
          var A = net.nodes[ed.a];
          var B = net.nodes[ed.b];
          // Always downhill: the pulse leaves whichever end is further from
          // the centre. Direction is the whole behaviour — the same figure
          // running outward is not convergence, it is a bloom.
          var out = A.inward > B.inward;
          var from = out ? A : B;
          // Launched so that the far reaches of the network set off first and
          // the arrivals stack up rather than land together.
          var launch = frac(1 - from.inward * 0.8 - ed.jitter * 0.1 * sp);
          var u = frac(t - launch) / 0.34;
          if (u > 1) continue;
          var s = out ? 1 - u : u;
          pushRun(discs, net, ed, s, envelope(u) * 1.15, 0, net.link);
        }

        for (var i = 0; i < net.nodes.length; i++) {
          var n = net.nodes[i];
          // A cluster brightens as the pulses that were sent towards it land.
          var land = frac(t - frac(1 - n.inward * 0.8) - 0.30);
          var hit = envelope(Math.min(1, land / 0.3));
          var base = i === net.sink ? 0.6 : 0.3;
          arrive = base + (0.85 - base * 0.4) * hit;
          pushDisc(discs, n.x, n.y, net.rad * (0.62 + 0.4 * n.w), arrive * (0.6 + 0.5 * n.w));
        }
        return { discs: discs, floor: 0.19 };
      }
    },
    {
      id: 'diffusion',
      name: 'Diffusion',
      form: 'Clusters speaking in turn, each spilling a little way into its neighbourhood.',
      blurb: 'Pockets of the field come forward and recede on their own schedules, never all at once.',
      prepare: function (t, p) {
        var net = DG.buildNetwork(p);
        var discs = [];
        var sp = stagger(p);

        for (var i = 0; i < net.nodes.length; i++) {
          var n = net.nodes[i];
          // Each cluster's own moment, its own dwell. Identical timing across
          // clusters is what makes a field of this kind read as one blinking
          // shape instead of as a population.
          var own = frac(n.beat * sp + i * 0.017);
          var dwell = 0.34 + 0.3 * hash3(i, 3, p.seed);
          var u = frac(t - own) / dwell;
          var v = envelope(u);
          // Never fully absent: the cluster subsides, it does not vanish, and
          // the lattice keeps its grain.
          pushDisc(discs, n.x, n.y, net.rad * (0.72 + 0.5 * n.w) * (0.8 + 0.3 * v), 0.22 + 0.85 * v);
        }

        for (var e = 0; e < net.edges.length; e++) {
          var ed = net.edges[e];
          var A = net.nodes[ed.a];
          var oa = frac(A.beat * sp + ed.a * 0.017);
          var u2 = frac(t - oa - 0.06) / 0.4;
          if (u2 > 1) continue;
          // A short way along the route only — enough to say the neighbours
          // are joined, not enough to draw the join.
          pushRun(discs, net, ed, u2 * 0.72, envelope(u2) * 0.8, 0, net.link * 0.92);
        }
        return { discs: discs, floor: 0.19 };
      }
    },
    {
      id: 'intelligence',
      name: 'Intelligence',
      form: 'A signal crossing a network, cluster to cluster, along bent routes.',
      blurb: 'One cluster fires, its neighbours answer a beat later, and the sequence travels the field.',
      prepare: function (t, p) {
        var net = DG.buildNetwork(p);
        var discs = [];
        var sp = stagger(p);

        function fireAt(i) {
          var n = net.nodes[i];
          // Position in the sequence comes from the graph, not from where the
          // cluster happens to sit, so the signal follows the connections —
          // including the ones that double back.
          return frac(n.spread * 0.72 + n.beat * 0.22 * sp);
        }

        for (var i = 0; i < net.nodes.length; i++) {
          var n = net.nodes[i];
          var u = frac(t - fireAt(i)) / 0.30;
          var v = envelope(u);
          // The network stays legible between firings; only the sequence
          // running over it comes and goes.
          pushDisc(discs, n.x, n.y, net.rad * (0.6 + 0.42 * n.w) * (0.85 + 0.28 * v), 0.3 + 0.85 * v);
        }

        for (var e = 0; e < net.edges.length; e++) {
          var ed = net.edges[e];
          var ta = fireAt(ed.a);
          var tb = fireAt(ed.b);
          // The pulse runs from whichever end fired first towards the other,
          // so the route carries the sequence rather than decorating it.
          var forward = frac(tb - ta) < 0.5;
          var start = forward ? ta : tb;
          var u2 = frac(t - start) / 0.26;
          if (u2 > 1) continue;
          pushRun(discs, net, ed, forward ? u2 : 1 - u2, envelope(u2) * 1.05, 0, net.link);
        }
        return { discs: discs, floor: 0.19 };
      }
    },
    {
      id: 'adaptation',
      name: 'Adaptation',
      form: 'A network rewiring: routes lapse, others take over, and the bends harden.',
      blurb: 'Connections come and go on their own schedules while every route travels from smooth curve to sharp angle.',
      prepare: function (t, p) {
        var net = DG.buildNetwork(p);
        var discs = [];
        var sp = stagger(p);
        // Smooth at the ends of the cycle, angular through the middle. The
        // change of character is itself the loop, so nothing has to be undone.
        var sharp = 0.5 - 0.5 * Math.cos(TAU * t);

        for (var i = 0; i < net.nodes.length; i++) {
          var n = net.nodes[i];
          pushDisc(discs, n.x, n.y, net.rad * (0.66 + 0.4 * n.w), 0.5 + 0.42 * n.w);
        }

        for (var e = 0; e < net.edges.length; e++) {
          var ed = net.edges[e];
          // Each route holds for its own stretch of the cycle and lapses for
          // the rest. Two hashed windows rather than one, so the wiring keeps
          // changing instead of pulsing on and off together.
          var open = frac(ed.jitter * sp);
          var span = 0.34 + 0.3 * hash3(ed.a, ed.b, p.seed + 5);
          var u = frac(t - open);
          var live = smoothstep(0, 0.1, u) * (1 - smoothstep(span, span + 0.14, u));
          if (live <= 0.02) continue;
          for (var k = 0; k <= DG.EDGE_SAMPLES; k++) {
            var s = k / DG.EDGE_SAMPLES;
            DG.routePoint(net, ed, s, sharp, pt);
            // Thinner towards the ends, so a route reads as growing out of its
            // clusters rather than being pinned between them.
            var taper = 0.55 + 0.45 * Math.sin(Math.PI * s);
            pushDisc(discs, pt[0], pt[1], net.link * taper, live * 0.95);
          }
        }
        return { discs: discs, floor: 0.19 };
      }
    },
    {
      id: 'synchronise',
      name: 'Synchronise',
      form: 'Local rhythms drifting apart, falling into step, and parting again.',
      blurb: 'Every cluster keeps the same beat at its own offset; the offsets close up, hold, and open out.',
      prepare: function (t, p) {
        var net = DG.buildNetwork(p);
        var discs = [];
        var sp = stagger(p);
        // Agreement rises and falls once across the cycle, so the field ends as
        // loose as it began.
        var sync = 0.5 - 0.5 * Math.cos(TAU * t);
        // A whole number of beats per cycle. Anything else and the rhythm
        // itself is what breaks the loop.
        var RATE = 3;

        for (var i = 0; i < net.nodes.length; i++) {
          var n = net.nodes[i];
          // The offsets are squeezed out as the field locks. Rates stay equal
          // throughout: clusters running at genuinely different rates can be
          // made to coincide, but never to keep step.
          // Squeezed towards a shared beat but never all the way onto it. At
          // a true unison every cluster is dark at the same instant and the
          // whole field blinks; a residual keeps them a population.
          var off = (n.beat - 0.5) * 0.9 * sp * (1 - 0.72 * sync);
          // Clusters also differ in how sharply they strike, so even at their
          // closest they are not the same event repeated.
          var bite = 1.05 + 1.5 * hash3(i, 19, p.seed);
          var beat = Math.pow(tri(RATE * t - off), bite);
          // A cluster is always present and the beat rides on top of it. Let
          // the beat carry the whole amplitude and the field goes dark every
          // time the clusters agree — the moment the behaviour exists to show
          // is the moment you would not be able to see.
          pushDisc(discs, n.x, n.y, net.rad * (0.62 + 0.4 * n.w) * (0.82 + 0.3 * beat), 0.38 + 0.8 * beat);
        }

        for (var e = 0; e < net.edges.length; e++) {
          var ed = net.edges[e];
          var A = net.nodes[ed.a];
          var B = net.nodes[ed.b];
          var oa = (A.beat - 0.5) * 0.9 * sp * (1 - 0.72 * sync);
          var ob = (B.beat - 0.5) * 0.9 * sp * (1 - 0.72 * sync);
          // A route only carries anything while its two clusters are close to
          // agreeing, so the network visibly knits together as they lock.
          var agree = 1 - smoothstep(0.06, 0.34, Math.abs(oa - ob));
          if (agree <= 0.02) continue;
          var u = frac(RATE * t - (oa + ob) * 0.5);
          pushRun(discs, net, ed, u, agree * envelope(Math.min(1, u / 0.55)) * 1.1, 0, net.link * 0.9);
        }
        return { discs: discs, floor: 0.19 };
      }
    }
  ];

  /*
   * One reader for all six. A dot takes the strongest disc covering it rather
   * than the sum of them: adding overlapping clusters together drives whole
   * neighbourhoods to full size and the local structure disappears into a slab.
   */
  function sample(x, y, t, p, c) {
    var fx = x / p.scale;
    var fy = y / p.scale;
    if (p.distort > 0) {
      // The same warp the clusters were placed through, so a dot and the
      // network agree about where it is.
      fx += p.distort * 0.42 * (noise2(fx * 0.7, fy * 0.7, p.seed + 61) - 0.5);
      fy += p.distort * 0.42 * (noise2(fx * 0.7 + 4, fy * 0.7 - 2, p.seed + 73) - 0.5);
    }
    var d = c.discs;
    var best = 0;
    for (var i = 0; i < d.length; i += 4) {
      var dx = fx - d[i];
      var dy = fy - d[i + 1];
      var r = d[i + 2];
      var q = (dx * dx + dy * dy) / (r * r);
      if (q >= 1) continue;
      var f = 1 - q;
      var v = d[i + 3] * f * f;
      if (v > best) best = v;
    }
    return clamp01(c.floor + best);
  }

  /*
   * Optional coherent displacement. Neighbouring dots move together and by a
   * fraction of the gap — the lattice must stay readable, because it is what
   * makes everything above legible as change rather than as noise.
   */
  function shift(x, y, t, p) {
    if (!p.drift) return null;
    // Returns a direction of roughly unit length and nothing more. The size of
    // the move belongs to the generator, which is where the cap lives; scaling
    // it here as well made the control quadratic, so its top setting reached
    // half of what it claimed.
    var a = (loopNoise(x * 0.8 + 3, y * 0.8 - 1, t, p.seed + 91) - 0.5) * 2.4;
    var b = (loopNoise(x * 0.8 - 6, y * 0.8 + 4, t, p.seed + 97) - 0.5) * 2.4;
    return [Math.max(-1, Math.min(1, a)), Math.max(-1, Math.min(1, b))];
  }

  DG.PATTERNS.forEach(function (pat) {
    pat.at = sample;
    pat.offset = shift;
  });

  DG.PATTERNS_BY_ID = {};
  DG.PATTERNS.forEach(function (p) { DG.PATTERNS_BY_ID[p.id] = p; });
  DG.getPattern = function (id) { return DG.PATTERNS_BY_ID[id] || DG.PATTERNS[0]; };
})(DG);
