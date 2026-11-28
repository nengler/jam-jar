# plinkfx sounds

Three sounds from plinkfx (https://github.com/maximilianfeix/plinkfx), version 0.3.0. Its sounds, and every file rendered from
them, are released under Creative Commons Zero (CC0 1.0): free for any use, no attribution required. They are copied into
`assets/` by `tools/make-assets.py`, as the Kenney sounds are.

plinkfx has no recordings: each sound is a few numbers its synth plays. These are the first take of each, rendered to
22.05 kHz mono WAV, which is what the Kenney sounds here are. Each is named after its category and its name there
(`pickup-ka-ching.wav` is `ka-ching` of Pickups). To make one again, or another:

```sh
npx plinkfx@0.3.0 render ka-ching --rate 22050 -o tools/plinkfx/pickup-ka-ching.wav
```

- `pickup-ka-ching.wav`: something bought in the shop.
- `ui-deny.wav`: the shop saying no (not enough coins, nothing to glaze, a second fruit out).
- `world-splash.wav`: lime juice or Coconut milk poured into the jar.
