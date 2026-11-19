# Jam Jar

A roguelike where you build a pool of fruit and the jar plays it. Each turn you're dealt 4 fruits from your pool and you set the
order they drop in. They fall at random spots, physics settles the pile, merges and blasts score, and then Simmer fruit score at
Resolve. After that you pick 1 of 3 new fruits, or skip for a coin. Five turns make a rent cycle; miss rent and the run ends.

Built on the [tse engine](https://github.com/nengler/tse). The design doc is the "Jam Jar: Game Design Outline" artifact.

## Running it

The engine isn't on npm yet, so `package.json` points at the packs attached to a tse GitHub release (v0.9.0), with
`overrides` so the packs' own dependencies on each other resolve to the same release:

```sh
npm install
npm run check            # compile, type-check, tests, parity with the Rust host
npm run install-engine   # optional: try an unreleased engine from ../tse (or TSE_DIR) without changing package.json
npm run dev              # play in a window, with hot reload (needs tse's native build with a window: npm run native:build in tse)
npx tse screenshot . --script "_*2, Enter, _*10, Space, _*150" --at 160 --out shots   # a screenshot without a window
```

## Controls

| Phase | Keys |
| --- | --- |
| Order your hand | Up/Down choose, Enter pick up / put down (then Up/Down move it), Space drop |
| Pick | Left/Right or Up/Down choose, Enter take, Space skip (+1 coin) |
| Rent paid / run over | Enter |
| Any time | Esc pause |

## What's in this first slice

- Starting pool: 1 Apple and 8 starters rolled from 3–5 Cherries, 2–4 Grapes and 0–2 Oranges. It's dealt like a deck and
  reshuffles when empty.
- The merge ladder: Cherry → Grape → Orange → Melon → Watermelon. Two Watermelons vanish for +100.
- Fresh fruit score when they land or are made by a merge. Simmer fruit (Apple, Banana) score at every Resolve. Lemon is a
  Booster: fruit touching it score double, and it blocks merges next to it.
- The Boom group: Chili (explodes touching 4+ fruit), Durian (big blast once 3 fruit sit on it), Pomegranate (bursts into 5
  Cherries when hit or merged), Blueberry (counts as 3 fruit for touch checks) and Seed (sprouts a starter when blown up). Blasts
  chain into other Chilis and Durians.
- Banana: +1 a turn, rots after 3 turns, and rot spreads to one touching fruit a turn.
- Overflow: fruit whose top is above the rim at Resolve spill and cost 5 points each.
- Rent: 25, 50, 100, 175 and 300 over 5 cycles. Points over rent become coins (1 per 5).

Not built yet: the shop (coins pile up but can't be spent), items (Preserves Jar, Juicer and the rest), boss jars, Juice and
grow, the rest of the Rot group (Fruit Fly, Fig, Prune), Kiwi, Peach, Honeydew and Snow Pear.

The screen is 640 x 360 (16:9), scaled up by whole multiples.

## How it is built

- `src/rules/` holds the whole game as plain TypeScript with no engine imports, so it is tested directly with `node:test`:
  - `jar.ts` is the run: deal, order, drop, settle, resolve, pick and rent. `advance(run, dt, keys, reports)` returns the next
    run. It never moves a fruit: it reads where each one reported being.
  - `fruits.ts` is the fruit table. `rng.ts` is a seeded generator, so a seed plus the inputs replay a run exactly.
- `src/Fruit.tsx` is one fruit: a ball (the engine's `useBall`) that falls, piles up and is stopped by the jar's solid colliders.
  Each step it reports where it is, its speed and which fruit it touches; a blast reaches it as a kick through its props.
- `src/Play.tsx` collects the reports, calls `advance` once a step and draws the result: the jar (walls are `<Collider solid>`),
  the fruit, the hand or pick list, and the rent panel.
  `FruitBall.tsx` draws a fruit's sprite, tinted when rotten and flashing when about to blow. `theme.ts` names the colours and
  the Kenney panels and buttons every screen is made of.
- `tools/install-engine.ts` packs `../tse` and installs it without saving.
- `tools/make-assets.py` (Python with Pillow) builds `assets/` from the free art in `tools/`, sizing each fruit to its radius in
  `src/rules/fruits.ts`. Rerun it after changing a radius.

## Credits

- Fruit art: [Fluent Emoji](https://github.com/microsoft/fluentui-emoji) by Microsoft, MIT licence (`tools/fluent/LICENSE`, which
  must ship with the game). There's no emoji for a Durian or a Pomegranate, so for now they use the Pineapple and a hue-shifted
  Red Apple.
- Everything else is [Kenney](https://kenney.nl), CC0: panels and buttons (UI Pack), the glass jar and the sky and hills
  (Physics Assets), blasts (Explosion Pack), merge splats (Splat Pack), the font (Kenney Mini Square Mono) and the sounds. The
  full bundle is on this repo's `Assets` release; `tools/kenney/README.md` says which file each came from.

## Engine notes

What the engine did and didn't cover for this game:

- **Physics.** tse had none (colliders only report touching), so the game first had its own solver. It moved into the engine as
  `useBall` (tse#205, released in v0.9.0), and each fruit is now a component with a ball.
- **The rules stay outside components.** Scoring, merges and blasts need every fruit at once, so the run is one plain object in
  `Play`'s state, fed by the fruit's reports a step behind. `advance` returns a copy each step, because render compares by `===`.
- **Not on npm.** Hence `install-engine`, the same loop the engine's own Bramble game uses.
- **Free assets.** Kenney's Food Kit has only small low-poly renders and no Melon, Pomegranate, Durian, Blueberry or Seed, so
  the fruit are Fluent Emoji; the panels, font and sounds are Kenney's.
