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

A ring is everything at some angle round one axis, and it has two half-axes.
**Reach** is the long one, how far out the ends go; **Morph** is the short one,
how far the ring is squashed across. A particle placed in direction **d** on the
ring of axis **L** goes to `L(d·L)·a + (d − L(d·L))·b`, with *a* from Reach and
*b* from Morph. They answer to different controls on purpose: tying Reach to the
flat end of the morph, as it was, left it doing nothing at all on a round globe.
This way a round globe with Reach up is four fat crossing rings rather than one
sphere, a flat set with Reach down is a compact star, and every pairing of the
two is its own shape.

With both at rest the transform is the identity — checked to the last bit of a
double — so the globe is exactly the even placement the particles were given.

**Inflate** is how much of a ring is occupied. A ring is a family of ellipses
round one axis, and pulling every particle's angle round that axis in towards
the family's own plane gathers them onto one ellipse, which is the diagram. But
it never closes all the way: sent to the plane exactly, every particle lands on
one curve and the form comes out drawn in dotted lines. A floor under the spread
leaves a band of scattered dots along the curve instead — which is what the
wireframe is for. **The line is where the form is, not what it is made of.**

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

## Fields, not rows

The golden angle is even, but even has a grain: it is built of spirals, and any
stretch across them — flattening a ring, lengthening it, or gathering the
particles into a band — brings those spirals out as visible lines of dots. Dots
are meant to read as a field, so every particle is shaken off its placement, and
by more of it exactly where the stretching is: with how far from round the ring
has been drawn, and with how tightly Inflate has gathered it.

The amounts were read off a sweep rather than guessed. Below about one spacing
the spirals are still legible; above about two and a half the field starts to
clump and thin in patches, which is a different kind of wrong. A round sphere
clears at about one, a stretched ring wants nearer two, and a gathered band more
again — which is what the three terms are.

## Fluidity, and keeping it in the frame

**Fluidity** does two things, and the second only really arrives at the top of
the range. Each ring leans off its axis, stretches and flattens on its own
schedule — three cosines at one, two and three turns a cycle, each with its own
starting place, so the trace is uneven and never quite repeats inside the loop
but closes exactly at the end of it — and its section wanders as it goes round,
so no two ellipses in the same ring are alike. Then a field of seven long waves
takes hold of the whole cloud and kneads it: gently at first, and by the top of
the range far enough to lose the star and leave an amoeba wandering a larger
field.

Nearly all of the work at the top is the field rather than the ring settings,
and deliberately so. Driving the ring lengths and flattenings hard enough to
destroy the form destroys everything else with it — the bands, the points,
whatever Reach and Inflate had been set to — and what is left is the same blob
whatever those were. Two things keep the rest legible instead. The field bends
space smoothly rather than per-ring; and each of its waves pushes **across** its
own direction of travel rather than along it. A wave that pushes along itself
piles the cloud up at one end and thins it at the other, and seven of those
agree often enough to drag the whole thing into a smear — the same smear
whatever the rings underneath were set to. Pushing across shears the cloud
without squeezing it, so it kneads and stays a blob, and a band is still a band
and a point still a point, bent.

Which is what makes framing a real problem rather than a detail. None of the
distortion is symmetrical, so the cloud both wanders off centre and grows, and a
particle that has drifted towards the lens arrives as a saucer, because the
perspective divide runs away there. Holding the distortion back to whatever keeps
it in shot would mean no amoeba; instead five hundred particles are put through
the same arithmetic before the frame is drawn, and what comes back is where the
cloud's middle has got to and how large the rest of it can be drawn.

That measurement is on the picture, not in space. A bound on the radius is not a
bound on the picture — two particles the same distance from the middle land in
quite different places if one is nearer the lens. For one particle it is exact:
at scale *s* it lands at `s·focal·X / (d − s·Z)`, so keeping that inside a target
*W* gives `s = W·d / (focal·|X| + W·Z)`. The third tightest of those is taken
rather than the tightest, because one particle should not decide how large the
whole cloud is drawn, and a couple spilling past the edge costs nothing. The
target is a good deal more than the calm form's own width, so the amoeba gets a
larger field to wander — but never more than the frame itself has, since a small
form with plenty of room to grow into can otherwise be given more room than the
picture holds.

Two things were wrong before this worked. Pinning the field's value at the origin
is not enough on its own: waves long enough to be coherent still agree across the
body of the cloud, so the field's average over a shell is taken out as well. And
the sample walked the particle list in steps of sixteen — a particle's ring is
its index modulo four, so it only ever measured one ring of the four, and came
back confident about a cloud a quarter the size of the one being drawn. The step
is odd now.

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
