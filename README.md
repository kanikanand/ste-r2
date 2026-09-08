# Dotted Grid Studio

A React tool for generating dotted patterns. Twelve presets describe *forms*,
and the dots are placed by the form itself — strung along its flowing contour
lines, or on grid rows the form pushes into waves. Depth comes from dot size
and density being mapped to light.

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
a fixed lattice, and places dots one of two ways.

**Along flow lines** (the default). `js/streamlines.js` traces curves that
follow the contours of the height surface — perpendicular to its gradient — and
keeps them an even distance apart (Jobard & Lefebvre): integrate a curve until
it leaves the frame, closes on itself, or comes within `dTest` of a curve
already drawn, then seed the next one a separation away from the one just
accepted. The curves loop around the form's peaks and part at its saddles, and
dots are strung along them at even arc length. Turning the angle rotates the
contour direction, which opens the closed loops into spirals; *detail* folds
turbulence into the height so the lines wrinkle rather than running smooth.

**On grid rows.** Rows of points run across the frame along the angle, and each
point is pushed perpendicular to its row by the height of the form beneath it,
so the rows ripple into the shape the preset describes. Walking the rows front
to back with a per-column horizon hides what the surface covers, which keeps
steep parts of a form from crowding rows into smears.

Either way the same height drives dot size and the keep/drop decision, so light
carries the depth. Geometry is generated across the frame's rotated bounding box
and clipped, so turning the angle lets the pattern bleed off every edge instead
of being contained by it.

A preset that does not define `flow` falls back to the tangent of its own
density contours, so its dots trace the shape's iso-lines.

## The twelve fields

| Preset | Form | Field |
|---|---|---|
| Emergence | Emerging core | A concentrated circular field. |
| Ingenuity | Soft star | A rounded central mass stretches into five soft points. |
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

**Form** — dot placement (along flow lines, or on grid rows); **pattern scale**,
the size of one copy of the form, which doubles as a zoom; **repeat**, tiling
that copy across the frame or in both directions; **detail**, turbulence folded
into the height; and the **angle of flow** dial. The pattern is drawn past the
frame's edges and clipped, so at any angle it bleeds off all four sides rather
than sitting inside them.

**Flow lines** — line density (12–140 lines across the frame) and dot spacing
along a line, as a fraction of the distance between lines. Well under 1 and the
dots read as a dotted stroke; above 1 they scatter along the contours.

**Grid rows** — point density; wave height, how far the form displaces its rows;
displacement mode, either *ridge* (rows ride over the form, reading as a surface)
or *bulge* (rows open away from it); whether to hide what the surface covers; and
field drift, which carries points along the preset's own field lines.

**Dots** — dot size, **dot size variation** (the extent of the difference between
the smallest and largest dot; at 0 every dot is the same size and only density
carries the form), depth contrast (gamma on the height before it becomes size),
density falloff (how much the form thins the dots out), jitter and seed.

**Colour** — solid dots in `#de2027`, `#687099`, `#c5eef9`, white or black, or
the three-stop gradient `#de2027 → #687099 → #c5eef9`. The gradient can be
mapped to light, horizontal, vertical, radial or angular position, and reversed.
Four backgrounds.

**Image mode** — upload an image and its luminance drives dot size and density.
It can replace the preset field, multiply with it (the preset then acts as a
mask), or average with it, with an amount slider and an invert toggle. The
preset gallery keeps showing the underlying fields so it still works as a
picker.

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
js/streamlines.js     evenly spaced field lines through the height surface
js/generate.js        height surface -> dot list (lines or rows), and the renderers
js/image.js           luminance sampler for image mode
js/exporters.js       PNG / SVG / JSON download
js/ui.js              canvas stage, preset thumbnails, control widgets
js/app.js             state, layout and mount
vendor/               react, react-dom, htm
```

Everything hangs off a single global `DG` namespace, one file per concern.
