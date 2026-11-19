# Jam Jar

A roguelike where you build a pool of fruit and the jar plays it. Each turn you're dealt 4 fruits from your pool and you set the
order they drop in. They fall at random spots, physics settles the pile, merges and blasts score, and then Simmer fruit score at
Resolve. After that you pick 1 of 3 new fruits, or skip for a coin. Five turns make a rent cycle; miss rent and the run ends.
Between cycles the shop sells fruit, an item, a removal and rerolls for the coins the rent left over.

Built on the [tse engine](https://github.com/nengler/tse). The design doc is the "Jam Jar: Game Design Outline" artifact.

## Running it

The engine isn't on npm yet, so `package.json` points at the packs attached to a tse GitHub release (v0.9.1), with
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
| Shop | Arrows choose, Enter buy, Space next cycle (or back, while choosing a fruit to remove) |
| Preserves Jar | Left/Right choose a fruit in the jar, Enter keep it or let it go, Space next cycle |
| Any time | Esc pause |

## Terms

Cards are written in a fixed set of keywords, each with one meaning everywhere (`src/rules/terms.ts`), the way Slay the Spire's
are: "Touching 4 fruit: **Blast**." A keyword is drawn in colour on the card, and the pick and the shop show what the chosen
card's keywords mean under it. A fruit's chip says how it scores, so its text does not.

| Keyword | Meaning |
| --- | --- |
| Fresh | Scores once, when it lands or a Merge makes it. The chip says how much: "Fresh 3". |
| Simmer | Scores at the end of every turn it is in the jar. |
| Booster | Scores nothing itself. It changes what others score. |
| Merge | Two of a kind that touch become the next fruit up. |
| Blast | Destroys nearby fruit. Each scores its points +6 (a big Blast, the Durian's, +8). |
| Burst | Breaks apart into smaller fruit. |
| Rotten | Scores nothing, can't Merge, and spreads by touch (one fruit a turn). |
| Honeyed | Scores +2 at the end of every turn. |
| Eat | Removes one fruit it touches from the jar. |
| Heavy | Shoulders lighter fruit aside on its way down. |
| Sprout | A Cherry, Grape or Orange grows in its place. |
| Crush | Destroys a fruit for its points +3 (the Juicer). |
| Spill | Fruit over the rim when a turn ends are lost: -5 each. |

A new card should use these words and no others for the same thing ("Blast", never "explodes"), start an effect with its
condition ("Blasted: Sprout a starter."), and fit four lines of a shop card. A test holds the texts to that.

## What's in this first slice

- Starting pool: 1 Apple and 8 starters rolled from 3–5 Cherries, 2–4 Grapes and 0–2 Oranges. It's dealt like a deck and
  reshuffles when empty.
- The merge ladder: Cherry → Grape → Orange → Melon → Watermelon. Two Watermelons vanish for +100.
- Fresh fruit score when they land or are made by a merge. Simmer fruit (Apple, Banana) score at every Resolve. Lemon is a
  Booster: fruit touching it score double, and it blocks merges next to it.
- The Boom group: Chili (explodes touching 4+ fruit), Durian (big blast once 3 fruit sit on it), Pomegranate (bursts into 5
  Cherries when hit; two that merge burst into 5 between them), Blueberry (counts as 3 fruit for touch checks) and Seed (sprouts a starter when blown up). Blasts
  chain into other Chilis and Durians, and score a bonus for each fruit destroyed (6 for a Chili's, 8 for a Durian's).
- Banana: 2, then +1 a turn, rots after 3 turns, and rot spreads to one touching fruit a turn.
- The rest of the Rot group: Prune (rotten from the start, never spreads, +5 for each rotten fruit touching it), Fruit Fly (eats
  one rotten fruit it touches a turn for 8, and another Fly hatches there; never a Prune) and Fig (blown up while rotten, it
  gives every Banana +1 for the rest of the run).
- Flex fruit: Kiwi (becomes a copy of the first landed fruit it touches), Peach (bounces once when it lands and shoves what it
  landed on aside) and Honeydew (honeys one fruit it touches a turn; honeyed fruit, the Honeydew included, score 2 a turn and
  are tinted gold).
- Eat and grow: Pitaya (eats one Cherry it touches a turn, and every Pitaya scores 1 more for the rest of the run) and Coconut
  (five times as heavy, so it shoulders its way down; at its third Resolve it cracks into a Cracked Coconut, a Booster that
  doubles its neighbours like a Lemon but lets them merge).
- Music on every screen, and the Settings' volume and music switch work.
- Overflow: fruit whose top is above the rim at Resolve spill and cost 5 points each.
- The boss jar: every third cycle (so cycle 3) is the Peg jar, with a round post in the middle that splits the pile. The shop
  before it says it is coming.
- Rent: 100, 150, 200, 260 and 320 over 5 cycles. Points over rent become coins (1 per 10).
- The shop, after each rent but the last: three fruit (3 coins each), one item, taking a fruit out of your pool (4 coins; the
  pool keeps at least one hand of 4) and a new shelf (1 coin, then 2, 3, … that visit).
- Items, which stand on the counter once you own them:
  - Lid (6 coins): stops one overflow, then is used up.
  - Juicer (8): at each Resolve it crushes the fruit standing on the floor, each for its points plus 3.
  - Shaker (5): throws every fruit about once a hand has dropped, so the pile lands differently.
  - Preserves (8), the Preserves Jar: after the shop, choose up to 2 fruit to stay in the jar when the rent empties it.

Not built yet: the upgraded jars (Big Preserves Jar, Pickling Jar), the other boss jars (tilted, blind, gravity-flip), Juice (the
Lime, and juice pooling in the jar; the Coconut's milk is a cracked shell for now) and Snow Pear (freezing needs a ball the engine can pin in place). The Honeydew's honey is not sticky yet, for the same
reason.

The screen is 640 x 360 (16:9), scaled up by whole multiples.

## Balance

`node tools/balance.ts` plays whole runs on the engine's physics with no window and prints what each cycle scored, for players
that never order a hand: one that never picks, one that picks at random, one per fruit that takes only that fruit, and
`/thin` versions that spend their coins taking Cherries out of the pool. The rent curve is set against it:

| Player (60 runs) | Median score, cycles 1 to 5 | Makes the last rent |
| --- | --- | --- |
| Never picks | 213, 211, 189, 231, 232 | 1 in 60 |
| Picks at random | 157, 141, 127, 133, 144 | 1 in 60 |
| Never picks, thins the pool | 213, 243, 261, 294, 285 | 16 in 60 |
| Takes Pomegranates, thins the pool | 177, 237, 240, 261, 282 | 13 in 60 |

Cycle 3 is the Peg jar, which is the dip in each row.

What it showed: the starters' merge ladder is worth about 11 points a drop, so a fruit that scores less than that when it is
dealt makes the pool worse. Most picks still do on their own (a lone Lemon, Seed or Blueberry costs the most, and the Rot
group taken together sits near 110 a cycle); they are meant to pay in combination, and nothing here measures an ordered hand. Rerun it after changing a fruit.

## How it is built

- `src/rules/` holds the whole game as plain TypeScript with no engine imports, so it is tested directly with `node:test`:
  - `jar.ts` is the run: deal, order, drop, settle, resolve, pick, rent and the shop. `advance(run, dt, keys, reports)` returns the next
    run. It never moves a fruit: it reads where each one reported being.
  - `fruits.ts` is the fruit table, `items.ts` the item table and `terms.ts` the keywords their text is written in. `rng.ts` is a seeded generator, so a seed plus the inputs replay a run exactly.
- `src/Fruit.tsx` is one fruit: a ball (the engine's `useBall`) that falls, piles up and is stopped by the jar's solid colliders.
  Each step it reports where it is, its speed and which fruit it touches; a blast reaches it as a kick through its props.
- `src/Play.tsx` collects the reports, calls `advance` once a step and draws the result: the jar (walls are `<Collider solid>`),
  the fruit, the hand on its shelf, the rent board and the keys on the left, the pool by kind and a note of what just happened
  on the right, and the pick cards. `Shop.tsx` draws the shop and `Peg.tsx` is the boss jar's peg (a ball too heavy to move).
  `FruitBall.tsx` draws a fruit's sprite, tinted when rotten and flashing when about to blow. `RuleText.tsx` draws card text with its keywords in colour. `Board.tsx` is a parchment board
  with a ribbon heading, `KeyHint.tsx` a key cap and what it does, `Backdrop.tsx` the kitchen behind every screen. `theme.ts`
  names the colours, the fonts and the Kenney frames every screen is made of.
- `tools/install-engine.ts` packs `../tse` and installs it without saving. `tools/balance.ts` is the balance run above.
- `tools/make-assets.py` (Python with Pillow) builds `assets/` from the free art in `tools/`, sizing each fruit to its radius in
  `src/rules/fruits.ts`. Rerun it after changing a radius.

## Credits

- Fruit art: a 16 x 16 pixel fruit sheet (`tools/fruit/`; its source and licence are still to be added there). Stand-ins:
  the Durian is the Pineapple, the Seed the brown Kiwi, the Melon the round green one, the Prune the Blackberry, the Fig the
  Aubergine and the Honeydew the golden Apple. The Pitaya is the sheet's Dragon Fruit. The Fruit Fly is drawn by `tools/make-assets.py`.
- [Kenney](https://kenney.nl) pixel art, CC0: the boards, cards, buttons, the slate and the ribbon (UI Pack - Pixel Adventure),
  the wallpaper's trellis (Pattern Pack Pixel), the coin (Pixel Platformer), blasts (Explosion Pack's pixel explosion), the
  sounds and the music (Farm Frolics, from Music Loops). It is all drawn at exactly 2x on the 640 x 360 screen. The full bundle is on this repo's `Assets` release;
  `tools/kenney/README.md` says which file each came from.
- Drawn by `tools/make-assets.py`, in Apollo colours at the same 2x pixel: the kitchen (wallpaper over a wooden counter), the
  jar's glass, the shelf and the key caps. The jar is two pictures, one behind the fruit and one (its near rim, shine and
  fill line) in front of them.
- Text: the engine's built-in pixel fonts, m5x7 for reading and Jersey 10 for headings and numbers, both at 2x.
- Colours: the [Apollo palette](https://lospec.com/palette-list/apollo) by AdamCYounis (`tools/palette/apollo.hex`). Every
  picture is snapped to it or drawn in it, the Kenney UI pieces are recoloured onto Apollo ramps, and `src/theme.ts` names
  the UI's colours. Nothing is drawn see-through except the shade behind a menu or the pick.
- Every picture is pixel art. Fruit sizes come from scaling their 16-pixel sprites: 2x to 4x, with Grape and Melon at 2.5x and
  3.5x so the merge ladder has five sizes; each ball's radius is measured from its sprite (`src/rules/sizes.ts`).

## Engine notes

What the engine did and didn't cover for this game:

- **Physics.** tse had none (colliders only report touching), so the game first had its own solver. It moved into the engine as
  `useBall` (tse#205, released in v0.9.0), and each fruit is now a component with a ball.
- **The rules stay outside components.** Scoring, merges and blasts need every fruit at once, so the run is one plain object in
  `Play`'s state, fed by the fruit's reports a step behind. `advance` returns a copy each step, because render compares by `===`.
- **Not on npm.** Hence `install-engine`, the same loop the engine's own Bramble game uses.
- **Free assets.** Kenney has no pixel fruit, so the fruit come from a separate pixel sheet; the rest is Kenney pixel art or
  drawn by `tools/make-assets.py`.
