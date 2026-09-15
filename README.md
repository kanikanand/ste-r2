# Ingenuity Unleashed — morph

Orbiting dotted particles held in a form that runs from a globe to an
eight-pointed star, and every shape in between. The camera can be pushed
through the surface and out the other side, so the inside is a place you can
stand and frame as a texture.

Open `index.html`. No build, no server, no network.

## The form

The diagram draws a sphere as circles and an eight-pointed star as four long
ellipses crossing at one centre. An ellipse is a circle that has been
flattened, so both pictures are the same construction at two settings of one
control, and that is how this is built. There is no globe shape and no star
shape to mix between.

A ring is everything at some angle round one axis. Flattening it means
squashing across that axis by a factor *b* while the axis itself keeps its
length: a particle placed in direction **d** on the ring of axis **L** goes to
`L(d·L) + b(d − L(d·L))`. At *b* = 1 nothing moves at all — checked to the last
bit of a double, so the globe is exactly the even placement the particles were
given. Below it, each ring becomes a long ellipse, the four cross at the
centre, and their eight ends are the points of the star.

**Morph** is *b*, and **Reach** is how far down it goes. The long axes never
change length, so the tips of the star sit where the globe's surface was and the
morph is the body drawing in rather than the whole thing inflating and
deflating. The ends of the points are the ends of ellipses — rounded, the way
the diagram draws them — rather than the cones an earlier build welded on, which
were sharper than anything in the reference.

**Inflate** is how much of a ring is occupied. A ring is a family of ellipses
round one axis, and pulling every particle's angle round that axis in towards
the family's own plane leaves them all on a single ellipse — which is the
diagram exactly: four curves, and at full round four great circles, a wireframe
globe. Letting the angle back out fills the family in until the ring is a whole
shell. It tells on the points hardest, since that is where the ellipses are
furthest apart.

Each particle keeps one ring for its whole life, by index rather than by
whichever axis is nearest. Four complete rings crossing each other is the
picture; handing each particle to its nearest axis instead gives four
quarter-rings that meet at seams and never cross at all.

The axes matter more than anything else here. An earlier build made the points
out of longitude, so they ringed one waist and the silhouette was a star from
the pole and a spiked disc from the side — one good angle and no others. Here
the four are spread through space instead of around a circle: they are made to
repel one another, both ends of each counted, from a handful of starting
arrangements, and the arrangement that settles lowest is kept. For four axes the
answer is the diagonals of a cube, which is as far apart as eight points can
get.

The dot grows with the radius it sits at. A particle out at a point stands for
more surface than one at the waist — the same slice of directions covers area
going as the square of the radius — which is this project's own rule, density
carried by dot size, applied to a solid rather than to a flat field.

## Fluidity, and keeping it in the frame

**Fluidity** does two things, and the second only really arrives at the top of
the range. Each ring leans off its axis, stretches and flattens on its own
schedule — three cosines at one, two and three turns a cycle, each with its own
starting place, so the trace is uneven and never quite repeats inside the loop
but closes exactly at the end of it — and its section wanders as it goes round,
so no two ellipses in the same ring are alike. Then a field of seven long waves
takes hold of the whole cloud and kneads it: gently at first, and by the top of
the range far enough to lose the star altogether and leave an amoeba wandering a
field half again the size of the form it came from. A particle travels well over
a frame's width across a cycle at the top of the range.

Which is what makes framing a real problem rather than a detail, and worth
saying how it is solved. None of that distortion is symmetrical, so the cloud
both wanders off centre and grows, and a particle that has drifted towards the
lens arrives as a saucer, because the perspective divide runs away there.
Holding the distortion back to whatever keeps it in shot would mean no amoeba;
instead five hundred particles are put through the same arithmetic before the
frame is drawn, and what comes back is where the cloud's middle has got to and
how large the rest of it can be drawn.

That measurement is on the picture, not in space. A bound on the radius is not a
bound on the picture — two particles the same distance from the middle land in
quite different places if one is nearer the lens. For one particle it is exact:
at scale *s* it lands at `s·focal·X / (d − s·Z)`, so keeping that inside a target
*W* gives `s = W·d / (focal·|X| + W·Z)`. The third tightest of those is taken
rather than the tightest, because one particle should not decide how large the
whole cloud is drawn, and a couple spilling past the edge costs nothing.

Two things were wrong before this worked. Pinning the field's value at the
origin is not enough on its own: waves long enough to be coherent still agree
across the body of the cloud and carry all of it one way, which reads as the
form sliding out of frame rather than kneading, so the field's average over a
shell is taken out as well. And the sample walked the particle list in steps of
sixteen — a particle's ring is its index modulo four, so it only ever measured
one ring of the four, and came back confident about a cloud a quarter the size
of the one being drawn. The step is odd now.

## The particles

Placed by the golden angle rather than in rings of latitude. Rings would put
them in rows, and rows are what this should not have: the form is meant to read
as a cloud held in a shape, so the placement has to be even without being
regular, and the golden angle is the one arrangement that is both.

They need not be pinned to the surface. Each can turn about its own axis at its
own whole number of turns per cycle, so they slide across the form at different
rates and in different directions instead of drifting as one sheet. **Orbit** is
the number those turns are drawn from — whole ones only, because a fraction of a
turn would leave a particle somewhere other than where it started and the loop
would jump there.

It is held by default, and that is the more useful setting. A particle turning
about its own axis lands somewhere the golden angle did not put it, so the even
placement that gives the form its texture — the curving rows, the clean
gradient of sizes — is scrambled by the very first turn. Held, the whole cloud
turns as one body and the lattice survives; the movement comes from Spin
carrying the form round and from the field under Fluidity drifting across it.

## The camera

Perspective, not orthographic — an orthographic camera has no position to
speak of and cannot go anywhere. **Distance** is in form radii, so below 1 the
camera is through the surface and the form wraps around the view. Drag to turn
the form and lean it; inside, that turn is what pans across the field.

Inside is where the textures are. With **Orbit** held and **Fluidity** low the
particles are still on the lattice they were placed on, and from within, the
golden-angle spiral reads as long curving rows of dots sweeping across the
frame — dense where the surface is far and edge-on, thinning to nothing where
it passes closest. Dot size is capped, eased into the ceiling rather than
clipped at it, so a particle passing near the lens no longer becomes a disc the
width of a finger and the field keeps reading as a field.

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
