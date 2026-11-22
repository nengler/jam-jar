# Art

Every picture in the game, as it is drawn: at its **art size**, half its size on the 640 x 360 screen (an art pixel is 2 x 2
screen pixels, the game's canvas is 320 x 180 of them), in the [Apollo palette](https://lospec.com/palette-list/apollo)
(`tools/palette/apollo.hex`), every pixel fully solid or fully clear.

`python3 tools/make-assets.py` checks each file and doubles it with no smoothing into `assets/` under the same name (a fruit's
becomes `fruit-<kind>.png`). Nothing recolours or redraws a picture: what is here is what the game shows. A pixel off the
palette, or half see-through, stops the script with where the first one is. The folders only sort the files; a name must be
unique across all of them.

To replace a picture, draw over its file at the same size and rerun the script. A few have a size or a shape the game counts
on, noted below.

## fruit/

One per fruit, each at a size fixed by the fruit (the merge ladder and its ball's radius depend on it): see `fruit/README.md`.

## kitchen/

| File | Size | What it is |
| --- | --- | --- |
| `wall.png` | 336 x 196 | The wallpaper: one tile (16) bigger than the canvas each way, so it can drift and wrap; it must tile every 16. |
| `counter.png` | 320 x 180 | The counter, over the wall: clear above its shadow. Its top starts at y 166, its front at 177; the jar's foot stands at 175. |
| `jar-back.png`, `jar-front.png` | 108 x 144 | The jar, behind the fruit and over them. The inside walls are 6 in from each side, the glass's top 6 down; the physics walls, floor and fill line (`JAR`, `RIM` in `src/rules/jar.ts`) are where these show them. |
| `shelf.png` | 104 x 6 | The plank the hand stands on (also the Flip jar's lid). |
| `ledge.png` | 30 x 6 | The ledge the pool's basket stands on, at the shelf's end. |
| `basket-back.png`, `basket.png` | 28 x 19 | The pool's basket, behind and in front of a fruit (also in the shop). |
| `peg.png` | 22 x 22 | The boss jar's peg: a circle of radius 11 (`PEG.r`, 22 on the screen). |
| `covered.png` | 16 x 16 | A fruit under a cloth in the Blind jar. |

## shop/

| File | Size | What it is |
| --- | --- | --- |
| `awning.png` | 320 x 22 | The striped awning across the top. |
| `stall.png` | 320 x 10 | The stall's counter the labels stand on. |
| `label.png`, `label-chosen.png` | 16 x 16 | A fruit's label, and the chosen one. 9-sliced: 4 at each edge stays, the middle stretches. |
| `label-item.png`, `label-item-chosen.png` | 16 x 16 | The item's label (a gingham band in its top 4 rows). 9-sliced the same. |
| `sign.png`, `sign-chosen.png`, `sign-go.png` | 16 x 18 | The wooden signs: an action, the chosen one, the way out. 9-sliced the same. |
| `tag.png` | 16 x 12 | The price tag, stretched across only. 9-sliced the same. |
| `sold.png` | 29 x 13 | The SOLD stamp. |
| `cloth.png` | 30 x 6 | The cloth an item stands on. |
| `coin-jar.png` | 14 x 16 | The purse. |

## items/

The six items, each 24 x 20, standing on its bottom edge: `item-lid`, `item-juicer`, `item-shaker`, `item-preserves`,
`item-bigpreserves`, `item-pickling`.

## ui/

| File | Size | What it is |
| --- | --- | --- |
| `key.png` | 8 x 13 | A key cap the game writes a key's name on. 9-sliced: 2 at the top and sides, 4 at the bottom (its lip) stay. |
| `key-arrows.png`, `key-updown.png` | 27 x 13 | Two arrow keys side by side. |
| `pause.png`, `pause-hover.png` | 16 x 15 | The pause button, and with the pointer over it. |
| `pointer.png` | 9 x 7 | The arrow over the fruit the Preserves Jar's cursor is on. |
| `coin.png` | 12 x 12 | A coin, beside a price. |

## screen/

Pictures with detail finer than an art pixel, so they cannot be halved: they are copied **at screen size, as they are**. When
one is redrawn at art size, move it to another folder (`ui/` for the frames, a new `fx/` for the explosion).

| File | Size now | At art size | What it is |
| --- | --- | --- | --- |
| `frame.png`, `frame-chosen.png` | 32 x 32 | 16 x 16 | Parchment in a wooden frame (boards, cards, buttons), and the chosen one. 9-sliced, 8 screen pixels (4 art) at each edge. |
| `select.png` | 32 x 32 | 16 x 16 | The empty amber frame round the chosen fruit. 9-sliced the same. |
| `plaque.png` | 32 x 32 | 16 x 16 | The dark slate of the note of what just happened. 9-sliced the same. |
| `boom-0.png` ... `boom-8.png` | 96 x 96 | 48 x 48 | The blast, frame by frame, each centred on its square. |

## Where they came from

The fruit are placeholders cut from a pixel fruit sheet (`tools/fruit/`). The frames, the wallpaper's trellis, the coin and the
explosion are [Kenney](https://kenney.nl)'s (CC0), recoloured onto Apollo once (`tools/kenney/` has the originals). The rest
was drawn for the game.
