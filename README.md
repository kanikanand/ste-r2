# STE Visual Suite

Three dotted modes in one tool, sharing a palette, a frame, a download size and
a set of exports. Open `index.html`. No build, no server, and — with the two
typefaces vendored alongside everything else — no network: checked with the
browser switched offline, which makes no outside request at all.

The interface is set in **Momo Trust**: the Display cut for the tool's name,
the Sans for everything else. Both are served out of `vendor/fonts` rather than
from Google's CDN, latin and latin-extended only. Display has a single weight
and no axis, so the title takes its emphasis from size and letterfit rather
than from a heavier cut; Sans is variable from 400 to 700, so every weight the
interface asks for comes out of one file.

**Patterns** — a flat lattice that never moves, with five motions running
underneath it. **Globe** — a dotted globe of the real world, 241 countries,
pick any of them out. **Sphere** — a sphere of orbiting particles under one of
five distortion fields.

## What is shared and what is not

Shared is what a mode has no opinion about, and it follows you between them:
the **frame** (16:9, 1:1, 4:5, 9:16), the **download size** (S, M, L — the
height is the fixed thing and the width follows the frame), the **dot colour**,
the **background**, the opacity, and the four export buttons. Everything that
makes a mode itself is its own, and is kept while you are elsewhere: leaving
Globe and coming back finds the globe where you left it rather than reset.
Reset only resets the mode you are in.

## The palette

Black, white, and four more — lilac `#EBBFFF`, apricot `#FFD091`, periwinkle
`#BABEFF` and red `#FF0000`. Each is available flat for the dots and for the
ground. The last four also make the gradient, and the gradient is a **mesh**.

A ramp has one direction and every colour in a fixed order along it. A mesh has
each colour standing at a place in the frame, and what any point takes is the
blend of whichever nodes are near it — so the same four colours can be a wash
from one corner, a pocket of red in the middle of a cool field, or anything
else, with no direction control at all. Where a colour *is* is the control.

The editor is the mesh itself: a small frame of the gradient with a ring on
every node, dragged to where that colour should be. Pick a ring and the palette
below sets its colour; up to eight nodes, never fewer than two, since one node
is a flat fill. There is one mesh, shared by the dots and the ground, so the
editor appears once — under **Mesh gradient** — as soon as either is using it.

The blend is inverse distance weighting: each node pulls the colour towards
itself by one over its distance raised to a power, and the pulls are
normalised. Two things follow, and both are what a mesh wants. A node's own
colour comes out exactly at the node, because its weight runs away as the
distance closes. And every point in the frame is defined however the nodes are
arranged, so there is no outside the mesh and no seam at its edge. **Blend** is
that power, read backwards so the control runs the way it reads: at zero the
nodes are pockets with hard ground between them, at one they are a single wash.

A dot takes the mesh at its own place in the frame, which is the same place the
ground is painted from, so a mesh ground under mesh dots is one field rather
than two that happen to share a palette.

Three practical notes. The ground is drawn from a 160-wide raster stretched with
smoothing — the field is smooth, so a few hundred samples upscaled cannot be
told from one sample per pixel and costs a thousandth as much, which matters at
eighteen hundred frames a minute. In **SVG** that raster goes in as a raster:
SVG has no mesh primitive, the one the spec describes was never implemented by
any shipping renderer, and the alternatives were a stack of blurred ellipses
that only approximates what is on screen or a thousand rectangles that band. The
dots stay what they were, one editable circle each. And a **GIF** over a mesh
ground is much larger than over a flat one — around 48MB for ten seconds at L
against 16MB — because a full-frame gradient is simply a far richer image. That
is the picture, not the dithering: measured at S, turning the dither off
entirely only takes 14.7MB down to 10.4MB, and turning it down is what puts
banding back into the smooth field the mesh exists for.

## How the three fit together

Each mode arrived as a whole application, with `DG.DEFAULTS` and
`DG.generateDots` to itself. Rather than pick one and bend the other two into
it, each registers under its own name through `DG.register` and `modes.js`
decides which one the renderer, the recorder and the four exporters are talking
to. None of those had to change to take three engines instead of one: they were
already written against a list of dots in screen pixels and know nothing about
what made it.

So **none of the pattern, motion or formation code was touched**, and that is
checked rather than asserted:

- **Patterns** and **Globe** are compared dot for dot against the branches they
  came from. The same parameters at the same four points in the loop, over six
  pattern cases and three globe cases — 82,736 marks, every one identical,
  labels included.
- **Sphere** is compared against the prototype's own functions, lifted out of
  the attached HTML and run beside the port: five distortion patterns × four
  times × varied twist, stretch, frequency, detail, lean and count. 38,000
  particles, worst disagreement 0.00px.

Two things had to change, and neither is a formation:

*The renderer learned per-dot opacity.* The sphere's depth cue is a fade rather
than a size, so a dot may carry its own alpha, multiplied with the group's
rather than replacing it — which keeps the Opacity control meaning the same
thing in all three modes. Canvas and SVG do it the same way.

*The sphere became a function of the loop rather than of the clock.* The
prototype held its state in module variables and drew on every animation frame;
the shared exporters need a frame at a stated `t`, because a GIF or an SVG is
rendered rather than captured. Its two loop terms already had whole-cycle counts
worked out for its own export — the orbit, and the distortion's 40π repeat — and
those are what `t` drives now, so what plays on screen and what is written to a
file are the same motion rather than two takes of it. The particle table is
still built once and kept, random size offsets and all, because a table rebuilt
per frame would fizz.

Its framing is the one adaptation with a visible effect: the prototype was a
fixed 180px sphere on an 800×600 stage, which is a little under a third of the
short side, so that is what it is measured against here. It comes out the same
fraction of the frame at every download size and in every aspect ratio.

## Exports

**SVG** and **PNG** take the frame as it stands. **GIF** and **MP4** record 10
seconds, 30 seconds or a minute, always holding a whole number of cycles so
they loop. **No bg** drops the background from SVG, PNG and GIF, saving as
`-clear`; video always carries one, since MP4 has no alpha. All four work in
all three modes, at the selected size.

## The files

| | |
|---|---|
| `js/modes.js` | the three engines, the shared settings, the dispatcher |
| `js/color.js` | the palette, and the mesh — sampling, raster, CSS stand-in |
| `js/render.js` | frames, download sizes, canvas and SVG output |
| `js/gifenc.js` | the GIF encoder — median cut, ordered dither, one transparent index |
| `js/record.js` | the four exporters |
| `js/patterns.js`, `js/field.js` | Patterns: the five fields, and the lattice |
| `vendor/world-50m.js`, `js/geo.js`, `js/globe.js` | Globe: the coastlines, the lookup, the projection |
| `js/sphere.js` | Sphere: placement, distortion, perspective |
| `js/ui.js` | the stage, the galleries, the widgets |
| `js/app.js` | state, layout, mount |
| `css/fonts.css`, `vendor/fonts/` | Momo Trust Display and Sans, vendored |
