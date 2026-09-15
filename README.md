# Ingenuity Unleashed — morph

Orbiting dotted particles held in a form that runs from a sphere to an
eight-pointed star, and every shape in between. The camera can be pushed
through the surface and out the other side, so the inside is a place you can
stand and frame as a texture.

Open `index.html`. No build, no server, no network.

## The form

Every direction has a radius: one for the sphere, which is 1 everywhere, and
one for the star. The Morph control mixes the two **radii**, not two sets of
positions, which is what makes every setting between them a shape in its own
right — a point on the half-morphed form is on the surface of a real solid
rather than halfway along a line between two of them.

The star's radius comes from `|cos|` of four turns of longitude: a cosine of
four gives eight extremes, and the absolute value turns the troughs into points
as well. A latitude term falls away towards the poles — without it the points
run pole to pole as ridges and the form reads as a fluted column; with it they
ring the waist, and it is their silhouette that makes the star.

Which means the star reads as a star from the **pole**, and as a spiked disc
from the side, so the view opens looking most of the way down the axis. The
form turns about that same axis, which from there is the star rotating in the
plane of the picture rather than tipping away. Drag the tilt off and the third
dimension is right there.

**Fluidity** adds two octaves of looping noise to the radius — the coarse one
swelling whole regions, the fine one rippling across them. **Breathe** swings
the morph on its own over the cycle.

## The particles

Placed by the golden angle rather than in rings of latitude. Rings would put
them in rows, and rows are what this should not have: the form is meant to read
as a cloud held in a shape, so the placement has to be even without being
regular, and the golden angle is the one arrangement that is both.

They are not pinned to the surface. Each turns about its own axis at its own
whole number of turns per cycle, so they slide across the form at different
rates and in different directions instead of drifting as one sheet. **Orbit**
sets how far they travel.

## The camera

Perspective, not orthographic — an orthographic camera has no position to
speak of and cannot go anywhere. **Distance** is in form radii, so below 1 the
camera is through the surface and the form wraps around the view. Drag to turn
the form and lean it; inside, that turn is what pans across the field.

Depth is measured against what is actually in the frame rather than a fixed
window. Three radii back and half a radius inside are completely different
ranges of distance, and a fixed window reads the whole of one of them as far
away — which is why the inside view came out uniformly dim before. Taking the
near and far of the frame itself means the nearest particle is always full size
wherever the camera is standing.

## Loop, and downloads

Every animated term — the turn, the orbits, the breathing, the noise —
completes a whole number of turns across the cycle, so footage of any length
closes where it opened.

**Size** S, M or L, labelled with the pixels they produce. **SVG** and **PNG**
take the form as it stands; **GIF** and **MP4** record whole turns at 10
seconds, 30 seconds or a minute. **No bg** drops the background from all three
still formats, saving as `-clear`; video always carries one, since MP4 has no
alpha.
