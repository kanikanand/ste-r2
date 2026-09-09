/* ============================================================================
 * network.js — the irregular cluster graph the six behaviours all draw on.
 *
 * Every behaviour here is a local event on a network, not a wave crossing an
 * axis. A field of cluster centres is scattered irregularly; each is joined to
 * a few near neighbours by a bent route; activation travels those routes with
 * its own delay. Nothing is ever drawn as a line — a route is only visible as
 * the dots along it briefly growing.
 *
 * The graph is deterministic in the parameters and does not depend on time, so
 * it is built once and cached. Behaviours animate what is happening ON it:
 * which routes are live, how much ground is occupied, what each cluster's
 * rhythm is. That is the difference between a pattern that develops and one
 * that merely slides past.
 *
 * Coordinates are field units: y runs -1..1 over the frame's height and x over
 * the same scale, so a wide frame sees more of the field rather than a
 * stretched copy of it. The field itself is built wider and taller than any
 * frame shows.
 * ==========================================================================*/
var DG = window.DG || (window.DG = {});

(function (DG) {
  'use strict';

  var hash3 = DG.hash3;
  var noise2 = DG.noise2;

  var FIELD_W = 4.0;
  var FIELD_H = 2.4;
  var AREA = FIELD_W * FIELD_H;
  var EDGE_SAMPLES = 7;

  /*
   * Irregular, but not clumped. Candidates are drawn from the hash and kept
   * only if they clear the ones already placed, which spaces them without
   * lining them up — a jittered lattice would still read as a lattice, and
   * pure rejection-free sampling leaves pairs sitting on top of each other.
   * The floor relaxes as tries run out so the count is always met.
   */
  function placeNodes(count, seed, distort) {
    var nodes = [];
    var target = 0.62 * Math.sqrt(AREA / count);
    var tries = count * 40;
    for (var i = 0; i < tries && nodes.length < count; i++) {
      var relax = 1 - 0.75 * (i / tries);
      var min2 = (target * relax) * (target * relax);
      var x = (hash3(i, 11, seed) - 0.5) * FIELD_W;
      var y = (hash3(i, 23, seed) - 0.5) * FIELD_H;

      // A gentle domain warp, so the layout has grain to it rather than
      // looking evenly stirred.
      if (distort > 0) {
        x += distort * 0.9 * (noise2(x * 0.75, y * 0.75, seed + 31) - 0.5);
        y += distort * 0.9 * (noise2(x * 0.75 + 5, y * 0.75 - 3, seed + 47) - 0.5);
      }

      var ok = true;
      for (var j = 0; j < nodes.length; j++) {
        var dx = nodes[j].x - x;
        var dy = nodes[j].y - y;
        if (dx * dx + dy * dy < min2) { ok = false; break; }
      }
      if (!ok) continue;

      nodes.push({
        x: x,
        y: y,
        // Clusters differ in weight, so no two read as the same stamp.
        w: 0.62 + 0.55 * hash3(i, 5, seed + 3),
        // Its own moment in the cycle, before any timing spread is applied.
        beat: hash3(i, 7, seed + 9),
        dist: 0,
        hops: 0,
        links: []
      });
    }
    return nodes;
  }

  /*
   * Each cluster joins two or three of its nearest neighbours. Nearest, so the
   * graph stays local; two or three, so the field has both chains and
   * junctions rather than one uniform mesh.
   */
  function linkNodes(nodes, seed) {
    var maxLen = 2.0 * Math.sqrt(AREA / Math.max(1, nodes.length));
    var edges = [];
    var seen = {};
    var order = [];

    for (var i = 0; i < nodes.length; i++) {
      order.length = 0;
      for (var j = 0; j < nodes.length; j++) {
        if (j === i) continue;
        var dx = nodes[j].x - nodes[i].x;
        var dy = nodes[j].y - nodes[i].y;
        order.push([Math.sqrt(dx * dx + dy * dy), j]);
      }
      order.sort(function (a, b) { return a[0] - b[0]; });

      var k = 2 + (hash3(i, 13, seed) < 0.45 ? 1 : 0);
      for (var n = 0; n < k && n < order.length; n++) {
        var len = order[n][0];
        var b = order[n][1];
        if (len > maxLen) break;
        var key = Math.min(i, b) + ':' + Math.max(i, b);
        if (seen[key]) continue;
        seen[key] = 1;

        // A route bows to one side. Straight segments between irregular points
        // still read as a wire diagram; a bent one reads as a path.
        var bend = (hash3(i, b, seed + 17) - 0.5) * 0.85;
        edges.push({ a: i, b: b, len: len, bend: bend, jitter: hash3(i, b, seed + 29) });
        nodes[i].links.push(edges.length - 1);
        nodes[b].links.push(edges.length - 1);
      }
    }
    return edges;
  }

  /*
   * Graph distance from a set of sources, by relaxing along edges until it
   * settles. Behaviours use it to order what happens where: a front that
   * spreads, arrivals that converge, a sequence that passes across the field.
   */
  function propagate(nodes, edges, sources) {
    for (var i = 0; i < nodes.length; i++) {
      nodes[i].dist = Infinity;
      nodes[i].hops = Infinity;
    }
    for (var s = 0; s < sources.length; s++) {
      nodes[sources[s]].dist = 0;
      nodes[sources[s]].hops = 0;
    }
    for (var pass = 0; pass < nodes.length; pass++) {
      var changed = false;
      for (var e = 0; e < edges.length; e++) {
        var A = nodes[edges[e].a];
        var B = nodes[edges[e].b];
        if (A.dist + edges[e].len < B.dist - 1e-9) {
          B.dist = A.dist + edges[e].len; B.hops = A.hops + 1; changed = true;
        }
        if (B.dist + edges[e].len < A.dist - 1e-9) {
          A.dist = B.dist + edges[e].len; A.hops = B.hops + 1; changed = true;
        }
      }
      if (!changed) break;
    }
    // An isolated cluster would otherwise sit at infinity and never take part.
    var far = 0;
    for (i = 0; i < nodes.length; i++) if (isFinite(nodes[i].dist) && nodes[i].dist > far) far = nodes[i].dist;
    for (i = 0; i < nodes.length; i++) {
      if (!isFinite(nodes[i].dist)) { nodes[i].dist = far * 0.7; nodes[i].hops = 3; }
    }
    return far || 1;
  }

  var cache = null;

  DG.buildNetwork = function (p) {
    var count = Math.max(3, Math.round(p.clusters));
    var key = count + '|' + p.seed + '|' + p.distort;
    if (cache && cache.key === key) return cache.net;

    var nodes = placeNodes(count, p.seed, p.distort);
    var edges = linkNodes(nodes, p.seed);

    // Two sources, taken from opposite ends of the field, so a front has
    // somewhere to travel and does not simply bloom from the middle.
    var left = 0;
    var right = 0;
    for (var i = 1; i < nodes.length; i++) {
      if (nodes[i].x < nodes[left].x) left = i;
      if (nodes[i].x > nodes[right].x) right = i;
    }
    var span = propagate(nodes, edges, [left, right]);
    for (i = 0; i < nodes.length; i++) nodes[i].spread = nodes[i].dist / span;

    // And again from the cluster nearest the middle, for the behaviours that
    // need somewhere to converge on.
    var mid = 0;
    for (i = 1; i < nodes.length; i++) {
      if (Math.hypot(nodes[i].x, nodes[i].y) < Math.hypot(nodes[mid].x, nodes[mid].y)) mid = i;
    }
    var reach = propagate(nodes, edges, [mid]);
    for (i = 0; i < nodes.length; i++) {
      nodes[i].inward = nodes[i].dist / reach;
      nodes[i].order = nodes[i].hops;
    }

    var net = {
      nodes: nodes,
      edges: edges,
      sink: mid,
      // Generous: a cluster has to cover enough dots to read as a cluster
      // rather than as one large dot with a couple of neighbours.
      rad: 0.70 * Math.sqrt(AREA / count),
      link: 0.32 * Math.sqrt(AREA / count)
    };
    cache = { key: key, net: net };
    return net;
  };

  /*
   * A point along a route, as a quadratic bow between its two clusters. `sharp`
   * pulls the bow towards its corner: at 0 the route is a smooth curve, at 1 it
   * is two straight runs meeting at an angle.
   */
  DG.routePoint = function (net, e, s, sharp, out) {
    var A = net.nodes[e.a];
    var B = net.nodes[e.b];
    var mx = (A.x + B.x) * 0.5;
    var my = (A.y + B.y) * 0.5;
    var nx = -(B.y - A.y) / (e.len || 1);
    var ny = (B.x - A.x) / (e.len || 1);
    var cx = mx + nx * e.bend * e.len * 0.5;
    var cy = my + ny * e.bend * e.len * 0.5;

    if (sharp > 0) {
      // Blending towards the corner point rather than raising an exponent:
      // the curve keeps its ends and only loses its rounding.
      var m = 1 - s;
      var qx = m * m * A.x + 2 * m * s * cx + s * s * B.x;
      var qy = m * m * A.y + 2 * m * s * cy + s * s * B.y;
      var lx = s < 0.5 ? A.x + (cx - A.x) * (s * 2) : cx + (B.x - cx) * (s * 2 - 1);
      var ly = s < 0.5 ? A.y + (cy - A.y) * (s * 2) : cy + (B.y - cy) * (s * 2 - 1);
      out[0] = qx + (lx - qx) * sharp;
      out[1] = qy + (ly - qy) * sharp;
      return out;
    }
    return DG.pointOnQuad(A.x, A.y, cx, cy, B.x, B.y, s, out);
  };

  DG.EDGE_SAMPLES = EDGE_SAMPLES;
})(DG);
