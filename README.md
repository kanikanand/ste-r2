# Ingenuity Unleashed — globe

A dotted globe of the real world. The dots sit on a sphere, only where there is
land, and countries you pick lift out of the surface in the highlight colour
with their names beside them. It turns, and it exports as SVG, PNG, GIF or
video at the size you choose.

Open `index.html`. No build, no server, no network — the country outlines are
vendored, so it runs from the filesystem and offline like the rest of this
repository.

## Where the geography comes from

`vendor/world-50m.js` is Natural Earth's 50m country outlines, by way of the
`world-atlas` package (ISC), decoded out of TopoJSON into plain `[lon, lat]`
rings at two decimals and simplified to 0.05° — under what the lookup mask
itself can resolve, so nothing visible is lost and the file is a third of its
raw size. 241 countries, 1,629 rings, 415KB.

The 110m set this started on is a third of the size again, and omits 64
territories: Singapore, Malta, Bahrain, Monaco, Hong Kong, most of the Pacific
island states. A picker that cannot find Singapore is not a picker of
countries, so the larger file is the right trade.

Every dot needs to know which country it stands on, several thousand times a
frame, so `js/geo.js` rasterises those outlines once into an equirectangular
mask of country indices and every later lookup is a single array read.

Two things about that mask are worth knowing, because both were wrong first:

- It is drawn **one country at a time as a stencil**, not all of them at once
  with the index as a colour. A filled path is antialiased, so with the colour
  approach every pixel along a coast comes back as a blend of one country's
  index and another's — a perfectly ordinary number that names the wrong
  country. It put Sydney in El Salvador and New York in Tanzania while inland
  cities were fine, which is the shape of that bug: only coasts are affected,
  and almost everywhere anyone looks on a world map is a coast.
- Four rings cross the antimeridian — Russia twice, Fiji, Antarctica. Their
  longitudes are made continuous first and then drawn three times a turn apart,
  so the part that belongs on the other side of the map arrives there instead
  of doubling back across the middle of the world.

Two more things follow from the small states. The mask is 2048x1024 — about
20km a cell — because Singapore, Malta and Monaco are each a cell or two wide
and the coarser grid could not hold them at all. And 47 of the smallest are a
fraction of a cell across, so the stencil threshold rejects them outright: each
of those is granted the single cell its outline sits in, stepping aside if
another has taken it, which is what keeps Saint Martin and Sint Maarten — two
halves of one small island — from erasing each other.

It checks out against the world: all 241 countries own at least one cell, every
one of them highlights and labels when picked, and land covers 28.5% of the
sphere against a real figure of about 29%.

## The globe

Dots are laid in rings of latitude with the count in each ring falling away as
the cosine of its latitude, so the spacing stays about even instead of piling
into a smear at the poles. Longitude turns the sphere, the tilt leans it, and
the result is projected straight down — orthographic, so it reads as a globe
rather than a fisheye. The far hemisphere is dropped rather than drawn over.

Nothing is shaded. What carries the roundness is that a dot shrinks as it turns
away and the rings crowd together towards the limb, which is the surface
falling away from you.

The globe turns **exactly once per loop**, so a ten second GIF and a one minute
video both close where they opened — the same rule the pattern branch worked
under. Drag it to turn it: dragging moves the Spin and Tilt controls rather
than holding an angle of its own, so what you drag to is what the sliders read
and what an export draws.

## Controls

**Countries** — all 241, type to add, click a chip to drop it, and the picked
ones take the highlight colour and a named pill. A country smaller than the gap
between dots takes the nearest dot to its label, so picking Singapore shows
something rather than nothing. **Frame** — 16:9, 1:1, 4:5 or 9:16.
**Background** — transparent, a solid, or the brand gradient. **Dot colour**
and **Highlight** — a solid or the three-stop gradient, with sliders for where
its colours sit. **Dots** — grid density in rings, dot size, size variation
(how far the limb's dots shrink), opacity, contrast, scatter. **Globe** — size,
tilt, spin, seconds a revolution, how large the sea's dots are drawn, and
whether to name what you picked.

## Downloads

**Size** — S, M or L, labelled with the pixels they produce in the frame you
are in: at 16:9 that is 960x540, 1440x810 and 1920x1080. The height is fixed
per size and the width follows the frame.

**SVG** and **PNG** take the globe as it stands; **GIF** and **MP4** record a
whole revolution at 10 seconds, 30 seconds or a minute. Everything carries the
background unless **No bg** is pressed, and then all three still formats drop
it and save as `-clear`. Video always carries one, since MP4 has no alpha.

Labels go into the SVG as real text rather than outlines, so a name can still
be corrected or restyled wherever the file is opened.
