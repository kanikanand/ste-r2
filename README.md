# Dotted Grid Studio

A React tool for generating dotted grid patterns. Twelve presets describe
*fields* — the shapes the dots gather into and the directions their lines flow —
and depth comes from dot size and density being mapped to light.

![Twelve presets](docs/presets.png)

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static bundle in dist/
```

## How a pattern is built

Each preset is two functions over a normalised square (`src/lib/fields.js`):

| | |
|---|---|
| `density(x, y) → 0..1` | how much *light* is at this point |
| `flow(x, y) → angle` | the direction the field lines run |

`src/lib/generate.js` lays a square lattice over the frame, carries each dot
along the flow field, reads the density at where it lands, and turns that value
into a radius and a keep/drop decision. So one number — light — drives both dot
size and dot density, which is what reads as depth.

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

**Grid** — grid density (6–90 dots across), dot size, **dot size variation**
(the extent of the difference between the smallest and largest dot; at 0 every
dot is the same size and only density carries the field), depth contrast (gamma
on the field before it becomes size), density falloff (how much the field thins
the lattice out), jitter and seed.

**Flow** — **angle of flow**, a dial that rotates every field line, and flow
strength, which is how far dots are carried along them. At zero the dots sit on
a straight lattice; raise it and they stream, bunching along the form's edges.
Dots that run off the frame wrap round, so the square stays full.

**Colour** — solid dots in `#de2027`, `#687099`, `#c5eef9`, white or black, or
the three-stop gradient `#de2027 → #687099 → #c5eef9`. The gradient can be
mapped to light, horizontal, vertical, radial or angular position, and reversed.
Four backgrounds.

**Image mode** — upload an image and its luminance drives dot size and density.
It can replace the preset field, multiply with it (the preset then acts as a
mask), or average with it, with an amount slider and an invert toggle. The
preset gallery keeps showing the underlying fields so it still works as a
picker.

**Export** — PNG or SVG at 1000/2000/4000 px, or the settings as JSON.
Geometry is generated fresh at the export size, so output is resolution
independent and the SVG is true vector circles.

## Layout

```
src/
  lib/fields.js      the twelve density + flow fields
  lib/generate.js    lattice → advection → dot list, canvas and SVG renderers
  lib/color.js       palette, three-stop ramp, gradient mapping
  lib/image.js       luminance sampler for image mode
  lib/exporters.js   PNG / SVG / JSON download
  components/        canvas stage, preset thumbnails, control widgets
  App.jsx            state and layout
```
