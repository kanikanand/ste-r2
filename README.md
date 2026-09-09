# Dotted Grid Studio

A React tool for generating dotted grid patterns. Twelve presets describe
*forms* — waves the grid is pushed into, which is what decides where each dot
sits — and depth comes from dot size and density being mapped to light.

![the twelve presets](docs/presets.png)

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

Markup is written with [htm](https://github.com/developit/htm), which reads like
JSX but is parsed at runtime, so the components stay React components without
needing a compiler.

## How a pattern is built

Each preset is two functions over the form's own coordinates (`js/fields.js`):

| | |
|---|---|
| `density(x, y) → 0..1` | the *height* of the form, and how much light is on it |
| `flow(x, y) → angle` | the direction the field lines run |

`js/generate.js` reads that density as a **height surface**, not as a mask over
a fixed lattice. Rows of points run across the frame along the flow angle, and
each point is pushed perpendicular to its row by the height of the form beneath
it — so the rows ripple into the shape the preset describes and the dots sit on
those waves. The same height also drives dot size and the keep/drop decision,
so light still carries the depth.

Rows are generated across the frame's rotated bounding box and clipped to the
frame, so turning the angle lets the pattern bleed off every edge instead of
being contained by it.

Two details keep the wave reading as a rhythm rather than a relief:

- Each preset finishes with a **soft ceiling** rather than a hard clamp. A clamp
  pins the top of a form at exactly 1 across a broad area, and a flat top
  displaces every row it covers by the same amount — the rows keep their spacing
  and read as a solid slab with a hard edge where the plateau stops. The soft
  ceiling is the identity below 0.6 and eases onto 1 above it, so the crest
  keeps enough slope for the rows to go on separating.
- Where the form is steeper than the row spacing, the row behind is **held back
  to keep a gap** rather than dropped. Dropping it cut a hard silhouette and
  left the crest a dense cap; holding it back rounds the crest over and every
  point stays on the page. The displacement is eased too, so the wave rolls over
  its crest instead of driving into it.

A preset that does not define `flow` falls back to the tangent of its own
density contours, so its dots trace the shape's iso-lines.

## The twelve fields

| Preset | Form | Field |
|---|---|---|
| Emergence | Emerging core | A concentrated circular field. |
| Ingenuity | Burst | A tight core throws five long rays, far enough apart to read as a burst. |
| Progress | Directional plume | A right-moving diffused plume, as if zooming in on one of the points. |
| Convergence | Gathering field | Soft concentrations draw inward to one shared centre through subtle channels. |
| Expansion | Expanding halo | A broad ring of larger dots surrounds a small, deep central point. |
| Adaptation | Flowing saddle | A continuous undulating form rises on one side and dips, diffused, on the other. |
| Connection | Connecting bridge | Two rounded masses joined by a narrow dotted neck. |
| Collaboration | Interference bloom | Two overlapping fields make a third, denser formation where they meet. |
| Precision | Focused lens | A flattened ellipse concentrating into a tight central band with graduated edges. |
| Transformation | Twisted column | A vertical form narrows and turns at its midpoint into differently oriented lobes. |
| Synergy | Balanced lobes | Rounded volumes gather around a shared centre, distinct but coherent. |
| Momentum | Continuous wave | A stretched, oscillating ribbon carrying alternating concentrations across the frame. |

## Controls

The frame is 16:9.

**Grid** — point density (6–120 points across the frame, independent of how big
the form is), dot size, **dot size variation** (the extent of the difference
between the smallest and largest dot; at 0 every dot is the same size and only
density carries the form), depth contrast (gamma on the height before it becomes
size), density falloff (how much the form thins the points out), jitter and seed.

**Wave** — wave height, how far the form displaces its rows; displacement mode,
either *ridge* (rows ride over the form, reading as a surface) or *bulge* (rows
open away from it); whether to keep crowded rows apart; **angularity**;
**pattern scale**, the size of one copy of the form; and **repeat**.

Angularity straightens a form's curves into a given number of sides. Scaling a
point's radius by the cosine of its angle off the nearest facet centre turns the
circle `r = R` into a regular n-gon, so it works on any preset without each one
needing an angular version of itself — at 1 with four sides a dome becomes a
stepped ziggurat, at 3 a peak. It is a coordinate warp applied before the preset
is read, so the wave, the tone and the repeat copies all follow it.

Repeating does not tile. Folding the coordinates would stamp out identical
copies with a seam between them, which reads as a grid rather than a texture.
Instead each copy gets its own place, turn and size, and they are combined by
taking whichever reads strongest at that point — so copies overlap and fall out
of step. *Scattered* spreads them loosely over the frame; *radiating* sets them
around a centre, each turned to face outward. Shrink the pattern scale and raise
the copy count to fit more in.

**Angle of flow** is a dial setting the direction the rows run. The pattern is
drawn past the frame's edges and clipped, so at any angle it bleeds off all four
sides rather than sitting inside them. **Field drift** additionally carries
points along the preset's own field lines.

**Colour** — solid dots in `#de2027`, `#687099`, `#c5eef9`, white or black, or
the three-stop gradient `#de2027 → #687099 → #c5eef9`. The gradient can be
mapped to light, horizontal, vertical, radial or angular position, and reversed.
Four backgrounds.

The angular mapping runs the ramp out and back rather than round the full
circle, so both ends land on the same colour instead of meeting as a hard seam.

**Image mode** — upload an image and its luminance drives dot size and density.

The image supplies the **tone** only; the **wave stays the preset's own**. Those
are two different jobs and folding them into one number let the picture swamp
the form, so every preset came out looking much the same once an image was
loaded. Kept apart, the photograph sets how big each dot is while each of the
twelve bends the rows its own way. How much of the tone the image takes is a
choice — all of it, half mixed with the pattern, or only inside the pattern —
with an amount slider and an invert toggle. The preset gallery keeps showing the
underlying fields so it still works as a picker.

**Export** — PNG or SVG at 1600×900, 2560×1440 or 3840×2160, or the settings as
JSON.
Geometry is generated fresh at the export size, so output is resolution
independent and the SVG is true vector circles.

## Layout

```
index.html            loads the vendored libraries, then js/ in order
css/style.css
js/fields.js          the twelve density + flow fields
js/color.js           palette, three-stop ramp, gradient mapping
js/generate.js        height surface -> displaced rows -> dot list, and the renderers
js/image.js           luminance sampler for image mode
js/exporters.js       PNG / SVG / JSON download
js/ui.js              canvas stage, preset thumbnails, control widgets
js/app.js             state, layout and mount
vendor/               react, react-dom, htm
```

Everything hangs off a single global `DG` namespace, one file per concern.
