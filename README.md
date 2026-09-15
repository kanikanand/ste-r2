# Ingenuity Unleashed — morph

Orbiting dotted particles held in a form that runs from a globe to an
eight-pointed star, and every shape in between. The camera can be pushed
through the surface and out the other side, so the inside is a place you can
stand and frame as a texture.

Open `index.html`. No build, no server, no network.

## The form

There is one shape here, not two. Four axes through a common centre carry a
spoke out to a point at either end — eight points — and every spoke stands on
the same ball.

**Morph** is how wide the spokes are, and nothing else. At the wide end the ball
has swollen to the full reach of the points and the eight of them are one globe;
at the narrow end they draw back into a star. A spoke is a cone, solved rather
than shaped by a falloff: a ray leaving the centre at angle θ to its axis meets
a cone of height h and base half-width w where `r·sinθ = w(1 − r·cosθ/h)`, so
`r = w / (sinθ + w·cosθ/h)` — straight sides, and a point at the end. Whatever
the width, a cone of height h still ends at h, so **the tips do not move between
the globe and the star**. What the morph does is draw the body back between
points that were always there. Mixing two radii instead — a sphere's and a
star's — moves everything at once, and reads as the whole thing inflating and
deflating.

The cone is never allowed to be wider than it is tall. One that is reaches
furthest at the rim of its base rather than at its point, and eight of those
bulge sideways into a lumpy solid half again the size of the globe they are
supposed to be making. With the cap in place the wide end is a globe of radius
exactly 1, measured over twenty thousand directions.

Every smooth falloff tried in place of the cone — a cosine raised to a power, a
smoothstep of the same, an ellipse, a spheroid — is widest somewhere along its
length and rounds off into a petal rather than a point. **Reach** is how thin the
spokes get at full morph, **Body** how much round body is left between them once
they have.

The axes matter more than anything else here. An earlier build made the points
out of longitude, so they ringed one waist and the silhouette was a star from
the pole and a spiked disc from the side — one good angle and no others. Here
the four are spread through space instead of around a circle: they are made to
repel one another, both ends of each counted, from a handful of starting
arrangements, and the arrangement that settles lowest is kept. For four axes the
answer is the diagonals of a cube, which is as far apart as eight points can
get. Five or six of them show in the silhouette from any angle, the rest
pointing at the camera or away from it — which is what a star that is genuinely
three-dimensional does, and the reason there is no longer a front to face.

Crowding particles towards the spoke axes to fill the points out was tried and
is a trap: the pull has to send particles on either side of the line between two
spokes towards different axes, which tears a bare wedge along every one of those
lines and empties the core as well. Instead the dot grows with the radius it
sits at. A particle out at a spike stands for more surface than one in the body
— the same slice of directions covers area going as the square of the radius —
which is this project's own rule, density carried by dot size, applied to a
solid rather than to a flat field.

**Fluidity** distorts the spokes, not the particles. Each of the eight leans off
its axis, stretches and thickens on its own schedule — three cosines at one, two
and three turns a cycle, each given its own starting place, so what it traces is
uneven and never quite repeats inside the loop but closes exactly at the end of
it — and the ball breathes under them. The form is never symmetrical and never
still in the same way twice: at 0.6 the surface itself travels 0.14 of the form's
radius over a cycle on average and half of it at the extreme, while the star
holds five or six points in the silhouette at every setting. A last small grain,
fixed per particle, stops the shell looking like a skin drawn on a solid; it is
a distance rather than a percentage of the radius, because scaling the radius
stretches a spike in proportion to how long it already is and the points grow
sparse dotted tails.

**Breathe** swings the morph on its own over the cycle.

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
