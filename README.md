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

The star is built the way the diagram builds it: from long ellipses laid over
one another through a common centre. Spun into three dimensions an ellipse
becomes a prolate spheroid, and the star is the volume they all share the
outside of — in any direction, the surface is whichever spheroid reaches
furthest that way. Four spheroids, eight ends, eight points. **Points** sets
how many, two to an ellipse; **Reach** how far past the sphere the tips go,
and **Sharpness** how narrow the ellipses are between them.

The long axes matter more than anything else here. An earlier build made the
points out of longitude, so they ringed one waist and the silhouette was a
star from the pole and a spiked disc from the side — one good angle and no
others. Here the axes are spread through space instead of around a circle:
they are made to repel one another, both ends of each counted, from a handful
of starting arrangements, and the arrangement that settles lowest is kept. For
four ellipses the answer is the diagonals of a cube, which is as far apart as
eight points can get. Five or six of them show in the silhouette from any
angle, the rest pointing at the camera or away from it — which is what a star
that is genuinely three-dimensional does, and the reason there is no longer a
front to face.

**Fluidity** does nothing to the shape. It is how much of the cloud has let go
of it: a drifting field raises and lowers a waterline across the form, each
particle has its own height, and what goes under is lifted off and carried on
a coarse flow. Patches leave together and travel together, the particles that
only just went trailing the ones that went deepest, so the cloud scatters as
streams with a head and a tail rather than as a shell going grainy.
**Breathe** swings the morph on its own over the cycle.

## The particles

Placed by the golden angle rather than in rings of latitude. Rings would put
them in rows, and rows are what this should not have: the form is meant to read
as a cloud held in a shape, so the placement has to be even without being
regular, and the golden angle is the one arrangement that is both.

They are not pinned to the surface. Each turns about its own axis at its own
whole number of turns per cycle, so they slide across the form at different
rates and in different directions instead of drifting as one sheet. **Orbit**
is the number those turns are drawn from — whole ones only, because a fraction
of a turn would leave a particle somewhere other than where it started and the
loop would jump there.

## The camera

Perspective, not orthographic — an orthographic camera has no position to
speak of and cannot go anywhere. **Distance** is in form radii, so below 1 the
camera is through the surface and the form wraps around the view. Drag to turn
the form and lean it; inside, that turn is what pans across the field.

Depth is measured against what is actually in the frame rather than a fixed
window. Three radii back and half a radius inside are completely different
ranges of distance, and a fixed window reads the whole of one of them as far
away — which is why the inside view came out uniformly dim before. Taking the
range from the frame itself means the nearest particle is always full size
wherever the camera is standing. The range stops a few per cent in from each
end: one particle carried right up to the lens by the flow would otherwise set
the near end single-handed and push the whole form into the far half of the
scale.

## Loop, and downloads

Every animated term — the turn, the orbits, the breathing, the noise —
completes a whole number of turns across the cycle, so footage of any length
closes where it opened.

**Size** S, M or L, labelled with the pixels they produce. **SVG** and **PNG**
take the form as it stands; **GIF** and **MP4** record whole turns at 10
seconds, 30 seconds or a minute. **No bg** drops the background from all three
still formats, saving as `-clear`; video always carries one, since MP4 has no
alpha.
