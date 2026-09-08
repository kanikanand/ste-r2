# Dotted Grid Studio

A React tool for making dotted textures. Twelve presets, each a description of
how the dots gather; the pattern sets each dot's size and thins them out where
it is dark. Download the result as an SVG with a transparent background and lay
it over a photograph.

![the twelve patterns](docs/presets.png)

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

## How a pattern is built

The dots sit on a plain square lattice that never moves, so the texture stays
regular and tiles cleanly. Each preset is one function over the pattern's own
coordinates (`js/fields.js`):

```
density(x, y) -> 0..1     how much light is at this point
```

`js/generate.js` reads that value at each dot and turns it into a radius —
bright means big, dark means small — and optionally drops the dot altogether
where the pattern is dark. So one number carries both size and density, which is
what reads as depth.

The lattice is fixed to the frame; the *pattern* rotates underneath it, which is
why turning the angle never disturbs the grid. Pattern coordinates are folded
back into their own square when tiling, so a small pattern repeats seamlessly
across the frame.

## The twelve patterns

| Preset | Form | Pattern |
|---|---|---|
| Emergence | Emerging core | A concentrated circular field. |
| Ingenuity | Soft star | A rounded central mass stretches into five soft points. |
| Progress | Directional plume | A right-moving diffused plume. |
| Convergence | Gathering field | Soft concentrations draw inward to one shared centre through subtle channels. |
| Expansion | Expanding halo | A broad ring of larger dots surrounds a small, deep central point. |
| Adaptation | Flowing saddle | A continuous undulating form rises on one side and dips, diffused, on the other. |
| Connection | Connecting bridge | Two rounded masses joined by a narrow dotted neck. |
| Collaboration | Interference bloom | Two overlapping fields make a third, denser formation where they meet. |
| Precision | Focused lens | A flattened ellipse concentrating into a tight central band. |
| Transformation | Twisted column | A vertical form narrows and turns at its midpoint into differently oriented lobes. |
| Synergy | Balanced lobes | Rounded volumes gather around a shared centre, distinct but coherent. |
| Momentum | Continuous wave | A stretched, oscillating ribbon carrying alternating concentrations. |

## Controls

**Dots** — grid density (8–140 dots across the frame), dot size, **size
variation** (how much bigger the brightest dot is than the darkest; at 0 every
dot is the same size), contrast, and scatter, which randomly drops dots out
where the pattern is dark.

**Pattern** — pattern size, repeat (tile it across the frame, or one copy
centred), angle, and the frame shape: 16:9, 1:1, 4:5 or 9:16.

**Colour** — solid dots in `#de2027`, `#687099`, `#c5eef9`, white or black, or
the three-stop gradient `#de2027 → #687099 → #c5eef9`, mapped to dot size,
horizontal, vertical, radial or angular position, and reversible. The background
is transparent by default; black, ink, paper and white are also there.

**Image mode** — optional. Upload an image and its luminance drives dot size
instead of the pattern, either on its own or confined inside the pattern.

**Export** — SVG (or PNG) at 1200, 2000 or 3200 px wide. With a transparent
background the SVG has no backing rectangle, so it drops straight over a
photograph. Geometry is generated fresh at the export size, so output is
resolution independent and the SVG is true vector circles.

## Layout

```
index.html            loads the vendored libraries, then js/ in order
css/style.css
js/fields.js          the twelve patterns
js/color.js           palette, three-stop ramp, gradient mapping
js/generate.js        lattice -> dot list, and the canvas and SVG renderers
js/image.js           luminance sampler for image mode
js/exporters.js       SVG / PNG / JSON download
js/ui.js              canvas, pattern thumbnails, control widgets
js/app.js             state, layout and mount
vendor/               react, react-dom, htm
```

Everything hangs off a single global `DG` namespace, one file per concern.
