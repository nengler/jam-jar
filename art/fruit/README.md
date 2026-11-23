# Pixel fruit

One picture per fruit, `<kind>.aseprite` (one frame), drawn at its **art size**: half its size on the screen, like all the game's art.
`tools/make-assets.py` doubles each one with no smoothing to `assets/fruit-<kind>.png`, the only picture of it the game has:
the jar, the shelf, the pick cards, the shop and the boards all show it at that size.

To replace a fruit, draw over its file at the same size and start the game (`tools/make-assets.py` runs first). The size is fixed by the fruit
(`FRUIT_SIZES` in the script), because the merge ladder and each ball's radius depend on it: a file of another size stops the
script with an error. Draw in the Apollo palette (`tools/palette/apollo.hex`, also on
[Lospec](https://lospec.com/palette-list/apollo)), every pixel fully solid or fully clear: the file is used exactly as it is,
and a pixel of any other colour, or half see-through, stops the script with where the first one is.

| Size | Fruit |
| --- | --- |
| 16 x 16 | cherry, apple, blueberry, chili, lemon, prune, seed, gourd, fruitfly |
| 20 x 20 | grape, banana, fig, kiwi, lime, peach, pitaya, pomegranate, slice, snowpear |
| 24 x 24 | orange, coconut, dragonfruit, durian, honeydew |
| 28 x 28 | melon |
| 32 x 32 | watermelon |
| 36 x 36 | pumpkin (Wide: two places on the shelf) |
| 48 x 48 | giantpumpkin (only made by merging two Watermelons) |

A fruit's ball is a little smaller than its square (45% of the side as a radius, the Fruit Fly's 30%), so leave the corners
mostly clear. The Gourd is drawn at its smallest size and grows in the jar by being scaled up. On the shelf a Pumpkin's top is
cut off by the top of the screen, and a Melon's by 2 pixels.

## Flat fruit and their light

A fruit can be drawn **flat** and lit by the game. Its visible layer is the fruit in its base colours, with its markings (stripes,
a stem, a leaf) and an outline in `#241527` (kept for outlines; inner lines in it too, wherever one part stands in front of
another, as between two cherries or two bananas). A flat fruit keeps its old lit picture as a hidden layer named **shading**,
for reference; that layer is what marks it flat.

The game lights it by **which way each pixel faces**: its normal map. `tools/make-assets.py` works one out from the fruit's
shape: each part (as the outline and inner lines divide it; a stem's dip and a stalk are not parts) rises from its edge like a
dome, so a round part is a ball and a long one a tube. A hidden layer named **normals**, painted as a normal map (red: facing
right, green: facing down, blue: facing the eye, 128 128 255 facing straight out), is used instead where a fruit has one: the
way to give a fruit a shape of its own (a pumpkin's ridges, a dent). The picture in `assets/` is the flat fruit and its normal
map side by side, and the fruit is marked `shaded` in `src/rules/sizes.ts`, which is what the game lights (`FLAT_FRUIT`).

The shader (`assets/fruit-light.glsl`) turns the normals with the fruit and lights them from the top left of the screen, so the
light falls right at every turn, on any shape: the side toward the light a step up, the far side down to the darkest step,
each colour by the steps of its row in the light table (`art/palette/light.aseprite`), and a speck of shine where a part faces
halfway between the light and the eye. How much falls in each step was matched to the old Apple (about a quarter lit, a quarter
plain, the rest in shadow). The outline is a dark step of the colour beside it, crimson toward the light and violet away from it
on a red fruit; an inner line is the darkest; a stalk is in two tones and a stem dark.

Flat now: Apple, Banana, Blueberry, Cherry, Chili, Lemon, Orange and Watermelon, flattened from the placeholders.

A turned fruit is drawn in whole art pixels on the screen's grid, as if the game were drawn at 320 x 180, so a fruit part way
round has clean steps at its edge. For that, each fruit's picture has a clear margin of 2 art pixels round it in `assets/`
(`FRUIT_PAD`): a picture is drawn only inside its rectangle, which would otherwise cut its turned edge.

To see the light at every turn, `npm run check:light` draws the light check (`src/LightCheck.tsx`) on the GPU into
`shots/light/` and compares it with `test/light/`; after changing a fruit or the table, look at the new picture and take it
with `npm run check:light -- --update`.

## Where the pictures came from

The pictures here now are placeholders, cut from the fruit sheet in `tools/fruit/` (its README says what is known of where it
came from): each sprite was snapped to Apollo and scaled to its fruit's art size with no smoothing. No sprite exists for a
Durian (the Pineapple stands in), a Seed (the brown Kiwi), a Melon (the round green one), a Prune (the Blackberry), a Fig (the
Aubergine) or a Honeydew (the golden Apple). The Fruit Fly was drawn for the game.
