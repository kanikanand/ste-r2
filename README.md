# Dotted Grid Motion

Six dotted patterns in constant flow, with footage export. A companion to the
still branch (`claude/dotted-grid-patterns-wn0ltz`), built motion first.

![the six patterns](docs/patterns.png)

## Run it

```
open index.html
```

That is the whole setup. There is no build step and no package manager — React
and htm are vendored in `vendor/`, so the page works offline and straight off
the filesystem. To serve it instead:

```
npx http-server -p 8080 .
```

## The six patterns

| Pattern | Motion |
|---|---|
| Expansion | Rings travel outward, the dots swelling as each one passes. |
| Convergence | The same rings drawn inward, gathering on the centre. |
| Diffusion | Loose clusters break up and reform as they drift. |
| Intelligence | Rows break into runs that slide past each other. |
| Adaptation | A diagonal grade sweeps across, one corner filling as the other empties. |
| Synchronise | An S-shaped band travels through, the rows falling into step behind it. |

## How the motion works

Each pattern is a function of place *and time* returning 0..1, and each is
periodic in time with a period of exactly **one cycle** (`js/patterns.js`). The
lattice never moves; the pattern beneath it does, so the motion is carried by
dots swelling and shrinking in turn rather than by anything sliding about.

Periodicity is the whole trick: footage is recorded over a whole number of
cycles, so a ten second file and a one minute file both loop without a jump at
the join. Three of the six needed care to get there, and each was caught by
testing `f(t=0) === f(t=1)` before any of it reached a file:

- The drifting noise cross-faded between two layers on an eased curve, which
  returned to the wrong layer at the end of a cycle. Fading straight across
  lands back on the layer the cycle began on.
- *Intelligence* slid its runs along by an arbitrary shift, so a cycle ended on
  different runs than it started. Wrapping the run index on its own period fixes
  it.
- *Synchronise* modulated its band at half rate, which takes two cycles to come
  back. At twice the rate it closes on one.

## Downloads

**SVG** and **PNG** take the frame showing at the moment you press them — SVG
**with** the background, PNG **without**, so the still drops straight onto
something else.

**GIF** and **MP4** at 10 seconds, 30 seconds or a minute.

GIF is encoded here rather than pulled in (`js/gifenc.js`), so the page keeps
working offline with no worker and nothing to download. A GIF carries at most
256 colours, so frames are quantised: a palette is chosen by median cut over a
sample of the whole run — not just the first frame — and a coarse lookup cube is
filled in once so mapping each pixel afterwards is a single read rather than a
search. Frames are drawn one at a time rather than recorded, so the result does
not depend on the machine keeping up.

Video goes through `MediaRecorder`, which records a live canvas, so **a minute
of footage takes a minute to make**. Feeding frames faster would only produce a
clip that played too fast, since a recorder stamps its frames by the wall clock.
Where the browser can write MP4 it does; where it cannot it writes WebM and the
button says so.

## Controls

**Motion** — speed in cycles per second, pattern scale, and the angle the
pattern runs at. **Dots** — circle or square, grid density, dot size, size
variation, contrast, and scatter. **Colour** — solid dots or the three-stop
brand gradient, and a background that can be transparent, black, ink, red,
slate, ice, paper or white. **Frame** — 16:9, 1:1, 4:5 or 9:16.

## Layout

```
index.html            loads the vendored libraries, then js/ in order
css/style.css
js/patterns.js        the six patterns, as fields that move
js/color.js           palette, three-stop ramp, gradient mapping
js/generate.js        the dots for one moment, and the renderers
js/gifenc.js          the GIF89a encoder
js/record.js          stills, GIF and video
js/ui.js              the animated stage, gallery and control widgets
js/app.js             state, layout and mount
vendor/               react, react-dom, htm
```

Everything hangs off a single global `DG` namespace, one file per concern.
