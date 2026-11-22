# Pixel fruit

One picture per fruit, `<kind>.png`, drawn at its **art size**: half its size on the screen, like all the game's art.
`tools/make-assets.py` doubles each one with no smoothing to `assets/fruit-<kind>.png`, the only picture of it the game has:
the jar, the shelf, the pick cards, the shop and the boards all show it at that size.

To replace a fruit, draw over its file at the same size and run `python3 tools/make-assets.py`. The size is fixed by the fruit
(`FRUIT_SIZES` in the script), because the merge ladder and each ball's radius depend on it: a file of another size stops the
script with an error. Colours are snapped to the Apollo palette (`tools/palette/apollo.hex`), and the script says how many pixels
of a file were not already in it. A pixel less than half opaque is clear.

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

The pictures here now are placeholders, cut from `fruit-sheet.png`: a sheet of 16 x 16 pixel fruit (38 columns x 6 rows),
supplied by the project owner as a free pixel fruit set. **Source and licence: to be filled in** (who made it, where it came
from, and its licence, so the game can credit it while any of its fruit are still in use). Each sprite was scaled to its fruit's
art size with no smoothing. No sprite exists for a Durian (the Pineapple stands in), a Seed (the brown Kiwi), a Melon (the round
green one), a Prune (the Blackberry), a Fig (the Aubergine) or a Honeydew (the golden Apple). The Fruit Fly was drawn for the
game.
