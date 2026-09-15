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
into a smear at the poles. Longitude turns the sphere, the drag's lean tips it,
the axis tilt rolls it across the frame, and the result is projected straight
down — orthographic, so it reads as a globe rather than a fisheye. The far
hemisphere is dropped rather than drawn over.

Nothing is shaded. What carries the roundness is that a dot shrinks as it turns
away and the rings crowd together towards the limb, which is the surface
falling away from you.

The globe turns **exactly once per loop**, so a ten second GIF and a one minute
video both close where they opened — the same rule the pattern branch worked
under. Footage always holds a whole number of turns, so it loops whatever the speed —
which does mean a clip shorter than one turn plays faster than the screen does.
A 60 second clip at 10 seconds a turn holds six turns and matches; the same
clip at 100 seconds a turn holds one and runs at 60.

Drag it to turn it, sideways and up and down both. Dragging moves the heading
and the lean rather than holding an angle of its own, so what you drag to is
what an export draws. Both signs follow the surface rather than the camera — drag right
and the land under the pointer goes right — and the lean has no slider at all,
since a drag says it in one gesture and a number does not.

**Axis tilt** is the other lean, and it is a slider because it is a setting
rather than a gesture: it is the line the globe turns about. The drag's lean
tips that line towards the camera or away from it, and from head-on that is
invisible in the line itself — the pole still points straight up the frame and
only the land slides. The axis tilt is a roll about the line of sight, applied
after everything else, and it is the one that leans the axis over in the
picture: the poles come off the vertical and the globe is seen to be turning
about a slanted line, the way the Earth does. It opens at 23.4°, which is the
tilt the Earth actually has.

Doing it last is what makes it a roll rather than another lean; in the other
order it would mix back into depth. It also means the drag has to be turned
back through it before it is read, or on a tilted globe the screen's right
stops being the globe's right and a sideways drag creeps up the frame as it
goes. Undone, the grab stays under the hand: measured at five tilts from −60°
to 90°, a 40-pixel drag right moves the land under the pointer 60 pixels across
and never more than 2 pixels up or down.

## Controls

**Countries** — all 241, type to add, click a chip to drop it, and the picked
ones take the highlight colour and a named pill. A country smaller than the gap
between dots takes the nearest dot to its label, so picking Singapore shows
something rather than nothing.

A picked country differs from the rest in three ways, and two of them are
yours: **Highlight size** scales its dots against their own spacing, and
**Highlight density** gives it a finer lattice of its own — the same ground
carrying more, smaller dots. They do different work. Size alone fattens the
dots until they nearly touch; density alone resolves the country's outline
properly, since twice the rings is four times the dots inside the same border.
Together they run from "the same dots in another colour" to a nearly solid
shape. The finer lattice is walked only across the country's own extent: at
three times the rings, sweeping the whole sphere would cost forty thousand
lookups to find Singapore's one dot. **Frame** — 16:9, 1:1, 4:5 or 9:16.
**Background** — transparent, a solid, or the brand gradient. **Dot colour**
and **Highlight** — a solid or the three-stop gradient, with sliders for where
its colours sit. **Dots** — grid density in rings, dot size, size variation
(how far the limb's dots shrink), opacity, contrast, scatter. **Globe** — size, spin in seconds a turn (10 to 100), **axis tilt** from −90°
to 90°, how large the sea's dots are drawn, and whether to name what you
picked. Which way the globe faces and how far it leans towards you are the
drag's, not a slider's.

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
