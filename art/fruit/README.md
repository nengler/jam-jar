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

A fruit can be drawn **flat, with its light painted on its own layer**. The visible layer is the fruit in its base colours, with
its markings (stripes, a stem, a leaf) and an outline in `#241527` (kept for outlines; inner lines in it too, wherever one part
stands in front of another, as between two cherries). A hidden layer named **shading** is the same fruit painted lit, as the
placeholders were: lit from the top left. The game draws the flat fruit turning as it rolls, and lays the painted light over it
so the light stays where it was painted on the screen: the fruit turns under its own highlights and lowlights.

`tools/make-assets.py` reads the shading layer as steps of the light table (`art/palette/light.aseprite`): each painted pixel
is a step lighter or darker than its flat colour (an outline pixel than the fruit beside it). It writes the fruit's picture
as two frames side by side, the flat fruit and that step map, and marks the fruit `shaded` in `src/rules/sizes.ts`; that is
what makes the game light it (`FLAT_FRUIT`). The shader (`assets/fruit-light.glsl`) turns each part's painting back about
the part's own middle, so a cherry's or a berry's light stays on it as a bunch turns. Two things are not taken from the
painting, because they belong to the fruit's markings and would stay behind when the markings turn: the painted outline, the
shading round a stem and round each marking (a leaf, the other colour of a stripe), and single specks. The map fills those from
the part's broad light round them; so paint the light in the shading layer, and the detail in the fruit itself. The outline at
the turned fruit's edge is made again on the screen in a dark step of the fruit beside it, and an inner line kept whole.

Shaded now: Apple, Banana, Blueberry, Cherry, Chili, Lemon, Orange and Watermelon, flattened from the placeholders, their old
pictures as the shading layers. To change how a fruit is lit, repaint its shading layer (in the palette, the same shape as the
flat fruit) and start the game. The painting is right for a fruit that is round, or a bunch of round parts. For a long one
(the Banana, the Chili) the turned painting no longer lines up with the fruit at some turns: where it reaches past what was
painted of a part, the shader shades from the fruit's shape instead.

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
