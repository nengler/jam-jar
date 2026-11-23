# Art

Every picture in the game, as it is drawn, as an [Aseprite](https://www.aseprite.org) file (`.aseprite`): at its **art size**, half its size on the 640 x 360 screen (an art pixel is 2 x 2
screen pixels, the game's canvas is 320 x 180 of them), in the [Apollo palette](https://lospec.com/palette-list/apollo)
(`tools/palette/apollo.hex`), every pixel fully solid or fully clear.

`tools/make-assets.py` flattens each file's visible layers, checks the picture and doubles it with no smoothing into `assets/`
as a PNG under the same name (a fruit's becomes `fruit-<kind>.png`). It runs by itself before `npm run dev`, `build`, `check`,
`test` and `package` (or by hand: `npm run assets`), so save in Aseprite and start the game. Nothing recolours or redraws a
picture: what is here is what the game shows. A pixel off the palette, or half see-through, stops the script with where the
first one is. The folders only sort the files; a name must be unique across all of them.

Aseprite need not be installed to make the assets: `tools/aseprite.py` reads the files. Use as many layers and groups as you
like; hidden layers and reference layers are left out, as in an export from Aseprite. Every layer shown must be in Normal
blend mode, and a layer below full opacity makes its pixels half see-through, which the palette check stops. A file with
more than one frame gives a picture a frame, `<name>-0.png`, `<name>-1.png` and on (the blast, `screen/boom.aseprite`). Each
file has the Apollo palette in it, so it opens in Aseprite with the palette loaded. A `.png` dropped in `art/` is read too;
`python3 tools/aseprite.py to-aseprite <file.png>` turns one into an Aseprite file.

To replace a picture, draw over its file at the same size and start the game. A few have a size or a shape the game counts
on, noted below.

## fruit/

One per fruit, each at a size fixed by the fruit (the merge ladder and its ball's radius depend on it): see `fruit/README.md`.

## kitchen/

| File | Size | What it is |
| --- | --- | --- |
| `wall` | 336 x 196 | The wallpaper: one tile (16) bigger than the canvas each way, so it can drift and wrap; it must tile every 16. |
| `counter` | 320 x 180 | The counter, over the wall: clear above its shadow. Its top starts at y 166, its front at 177; the jar's foot stands at 175. |
| `jar-back`, `jar-front` | 108 x 144 | The jar, behind the fruit and over them. The inside walls are 6 in from each side, the glass's top 6 down; the physics walls, floor and fill line (`JAR`, `RIM` in `src/rules/jar.ts`) are where these show them. |
| `shelf` | 104 x 6 | The plank the hand stands on (also the Flip jar's lid). |
| `ledge` | 30 x 6 | The ledge the pool's basket stands on, at the shelf's end. |
| `basket-back`, `basket` | 28 x 19 | The pool's basket, behind and in front of a fruit (also in the shop). |
| `peg` | 22 x 22 | The boss jar's peg: a circle of radius 11 (`PEG.r`, 22 on the screen). |
| `covered` | 16 x 16 | A fruit under a cloth in the Blind jar. |

## shop/

| File | Size | What it is |
| --- | --- | --- |
| `awning` | 320 x 22 | The striped awning across the top. |
| `stall` | 320 x 10 | The stall's counter the labels stand on. |
| `label`, `label-chosen` | 16 x 16 | A fruit's label, and the chosen one. 9-sliced: 4 at each edge stays, the middle stretches. |
| `label-item`, `label-item-chosen` | 16 x 16 | The item's label (a gingham band in its top 4 rows). 9-sliced the same. |
| `sign`, `sign-chosen`, `sign-go` | 16 x 18 | The wooden signs: an action, the chosen one, the way out. 9-sliced the same. |
| `sold` | 29 x 13 | The SOLD stamp. |
| `cloth` | 30 x 6 | The cloth an item stands on. |
| `coin-jar` | 14 x 16 | The purse. |

## items/

The six items, each 24 x 20, standing on its bottom edge: `item-lid`, `item-juicer`, `item-shaker`, `item-preserves`,
`item-bigpreserves`, `item-pickling`.

## ui/

| File | Size | What it is |
| --- | --- | --- |
| `key` | 8 x 13 | A key cap the game writes a key's name on. 9-sliced: 2 at the top and sides, 4 at the bottom (its lip) stay. |
| `key-arrows`, `key-updown` | 27 x 13 | Two arrow keys side by side. |
| `button`, `button-lit`, `button-down` | 12 x 12 | Every button (`src/PushButton.tsx`, the pause button too): a key cap, the same lit amber (hovered or focused), and pushed in. 9-sliced: 4 at the top and bottom and 2 at the sides stay. Pushed in, its top 2 rows are clear and its lip is 1 deep, not 3, so the face sits 2 lower under the same slices. |
| `pointer` | 9 x 7 | The arrow over the fruit the Preserves Jar's cursor is on. |
| `coin` | 12 x 12 | A coin, beside a price. |

## palette/

| File | Size | What it is |
| --- | --- | --- |
| `light` | 5 x 46 | The light table the fruit are shaded with (`assets/fruit-light.glsl`). A row per Apollo colour, in the order of `tools/palette/apollo.hex`: the colour itself in the middle, two steps of shadow to its left (darker and cooler), two of light to its right (lighter and warmer). The shader only ever swaps a colour for another from its row. Copied as it is, not doubled, to `assets/light.png`. |

`tools/make-assets.py` worked out the first table (`light_table`: each step snapped to the nearest palette colour that keeps
the colour's strength and never turns back) and wrote it because the file was missing. It is yours to repaint: change any
step but the middle column, which must stay each row's own colour. Delete the file to have a fresh one worked out. The row
of the outline colour, `#241527`, is that colour all along, so outlines are not lit.

## screen/

Pictures with detail finer than an art pixel, so they cannot be halved: they are copied **at screen size, as they are**. When
one is redrawn at art size, move it to another folder (`ui/` for the frames, a new `fx/` for the explosion).

| File | Size now | At art size | What it is |
| --- | --- | --- | --- |
| `frame`, `frame-chosen` | 32 x 32 | 16 x 16 | Parchment in a wooden frame (boards, cards, buttons), and the chosen one. 9-sliced, 8 screen pixels (4 art) at each edge. |
| `select` | 32 x 32 | 16 x 16 | The empty amber frame round the chosen fruit. 9-sliced the same. |
| `plaque` | 32 x 32 | 16 x 16 | The dark slate of the note of what just happened. 9-sliced the same. |
| `boom` | 96 x 96 | 48 x 48 | The blast: 9 frames (60 ms each, as the game plays them), each centred on its square, written to `boom-0.png` ... `boom-8.png`. |

## Where they came from

The fruit are placeholders cut from a pixel fruit sheet (`tools/fruit/`); eight of them were flattened from those (see
`fruit/README.md`). The frames, the wallpaper's trellis, the coin and the
explosion are [Kenney](https://kenney.nl)'s (CC0), recoloured onto Apollo once (`tools/kenney/` has the originals). The rest
was drawn for the game.
