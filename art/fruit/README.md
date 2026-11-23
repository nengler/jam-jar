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

A fruit can be drawn **flat**: its base colours, its markings (stripes, seeds, a stem, a leaf), and an outline in `#241527`
(kept for outlines only), with no light drawn in. The game lights a flat fruit itself as it is drawn, from the top right of the
screen however the fruit has rolled (`assets/fruit-light.glsl`), shading each colour by the steps of the light table
(`art/palette/light.aseprite`). A fruit is flat once it is in `FLAT_FRUIT` (`src/theme.ts`); the rest are drawn as they are,
their light drawn in.

Flat now: Apple, Banana, Blueberry, Cherry, Chili, Lemon, Orange and Watermelon. They were flattened from the placeholders: each
shade of the body made one colour, the stems and leaves one each, and the body's edge the outline. Each file keeps the old
picture as a hidden layer, "old shading", which the game leaves out. The light is shaded after the old pictures, the Apple
most of all: most of the side toward the light a step up, stopping a pixel short of the outline (a thin falloff on the sunny
side); the edge away from it and the far side darker (a wide one on the shadow side); a short streak of shine near the lit
edge; and the outline in a dark step of the colour beside it, crimson toward the light and violet away from it on a red fruit.
The falloff is thin on one side and wide on the other, never the same all round (pillow shading), so a fruit always reads as
lit from one side. Stems are drawn in `#4d2b32`, kept for stems: the light draws them as dark stalks with a lit tip, in a
hollow a step or two darker than the fruit round them.

Draw a flat fruit in a colour a step below how most of it should look lit (the Lemon in `#de9e41`, which lights to `#e8c170`),
with the outline in `#241527`; the light table decides what each colour becomes lit and in shadow. To see the light at every turn, `npm run check:light` draws the light check (`src/LightCheck.tsx`) on the GPU into
`shots/light/` and compares it with `test/light/`; after changing a flat fruit or the table, look at the new picture and take it
with `npm run check:light -- --update`.

## Where the pictures came from

The pictures here now are placeholders, cut from the fruit sheet in `tools/fruit/` (its README says what is known of where it
came from): each sprite was snapped to Apollo and scaled to its fruit's art size with no smoothing. No sprite exists for a
Durian (the Pineapple stands in), a Seed (the brown Kiwi), a Melon (the round green one), a Prune (the Blackberry), a Fig (the
Aubergine) or a Honeydew (the golden Apple). The Fruit Fly was drawn for the game.
