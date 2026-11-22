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
| 16 x 16 | cherry, blueberry, chili, lemon, prune, seed, gourd, fruitfly |
| 20 x 20 | grape, apple, banana, fig, kiwi, lime, peach, pitaya, pomegranate, slice, snowpear |
| 24 x 24 | orange, coconut, dragonfruit, durian, honeydew |
| 28 x 28 | melon |
| 32 x 32 | watermelon |
| 36 x 36 | pumpkin (Wide: two places on the shelf) |
| 48 x 48 | giantpumpkin (only made by merging two Watermelons) |

A fruit's ball is a little smaller than its square (45% of the side as a radius, the Fruit Fly's 30%), so leave the corners
mostly clear. The Gourd is drawn at its smallest size and grows in the jar by being scaled up. On the shelf a Pumpkin's top is
cut off by the top of the screen, and a Melon's by 2 pixels.

## Where the pictures came from

The pictures here now are placeholders, cut from the fruit sheet in `tools/fruit/` (its README says what is known of where it
came from): each sprite was snapped to Apollo and scaled to its fruit's art size with no smoothing. No sprite exists for a
Durian (the Pineapple stands in), a Seed (the brown Kiwi), a Melon (the round green one), a Prune (the Blackberry), a Fig (the
Aubergine) or a Honeydew (the golden Apple). The Fruit Fly was drawn for the game.
