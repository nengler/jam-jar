# Jam Jar

A roguelike where you build a pool of fruit and the jar plays it. Each turn you're dealt 4 fruits from your pool and you set the
order they drop in. They fall at random spots, physics settles the pile, merges and blasts score, and then Simmer fruit score at
Resolve. After that you pick 1 of 3 new fruits, or skip for a coin. Five turns make a rent cycle; miss rent and the run ends.
Between cycles the shop sells fruit, an item, a removal and rerolls for the coins the rent left over.

Built on the [tse engine](https://github.com/nengler/tse). The design doc is the "Jam Jar: Game Design Outline" artifact.

## Running it

The engine isn't on npm yet, so `package.json` points at the packs attached to a tse GitHub release (v0.13.0), with
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
| While the jar plays | Hold F to hurry it (three times as fast) |
| Any time | Esc pause |

The keys for each moment are on screen the first time it comes up (ordering a hand, the pick, the shop, …) and not again;
the pause menu always lists them. That, and the two volumes on the settings screen (music and sounds, 0 to 10), are the
player's settings (`src/settings.ts`), which the engine keeps between launches.

## Terms

Cards are written the way Slay the Spire's are: a row of keywords, each with one meaning everywhere and often a number, like
"Block 5". The Chili is "**Fresh 2**. **Exploder 4**." A keyword and its number are drawn in colour, and what each keyword
means is in a tooltip beside the card, which shows for the card chosen with the keys and for one the mouse is over
(the mouse over a card also chooses it; a click takes or buys it). The keywords are in `src/rules/terms.ts`.

| Keyword | Meaning ("this" is the number after it) |
| --- | --- |
| Fresh | Scores this once, when it lands or is made. |
| Simmer | Scores this at the end of every turn. |
| Booster | Scores nothing itself. |
| Merge | Two that touch become the fruit named. |
| Exploder | Explodes when touching this many fruit. |
| Buried | Explodes, big, under this many fruit. |
| Explode | Destroys nearby fruit: points +10 (big +14). |
| Exploded | When an explosion destroys it. |
| Burst | Breaks into this many Cherries. |
| Sprout | A Cherry, Grape or Orange grows here. |
| Rotten | Scores nothing and spreads. Still Merges. |
| Rots | Turns Rotten after this many turns. |
| Ripen | Scores this much more each turn. |
| Honeyed / Honey | Scores +4 at the end of every turn, and sticks to what it touches / makes a fruit it touches Honeyed. |
| Eat / Hatch | Removes one fruit it touches / a new Fruit Fly appears where it ate. |
| Grow | That kind scores this much more, all run. |
| Heavy | Shoulders lighter fruit aside. |
| Double / Sour | Fruit touching it score x2 / can't Merge. |
| Dense | Counts as this many fruit when touched. |
| Deep | Up to this much more the deeper it sits. |
| Copy | Becomes the first fruit it lands on. |
| Bouncy | Bounces, shoving its neighbours. |
| Crack | Breaks open after this many turns. |
| Juice / Milk | Lime juice this deep: fruit in it float / milk this deep: fruit in it score x2. |
| Skip | A Merge touching it skips a size. |
| Legendary | Rare, and never in the shop. |
| Crush, Shake, Preserve, Pickled, Once | The items' words: the Juicer, the Shaker, the jars and the Lid. |
| Frozen | Held in place. Explosions can't destroy it. |
| Spill | Fruit over the rim are lost: -5 each. |

A new card is a row of these, how it scores first ("Fresh 3. Heavy. Crack 3: Milk 20."), with a trigger before a colon ("Exploded:
Sprout."). A new effect gets a keyword and a definition of at most 46 characters, not a sentence on one card. A card holds
at most four keywords, which is what a tooltip has room for. Tests hold the cards to this, and to the rules' own numbers.

## What's in this first slice

- Starting pool: 1 Apple and 8 starters rolled from 3–5 Cherries, 2–4 Grapes and 0–2 Oranges. It's dealt like a deck and
  reshuffles when empty.
- The merge ladder: Cherry → Grape → Orange → Melon → Watermelon. Two Watermelons vanish for +100.
- Fresh fruit score when they land or are made by a merge. Simmer fruit (Apple, Banana) score at every Resolve. Lemon is a
  Booster: fruit touching it score double, and it blocks merges next to it.
- The Boom group: Chili (explodes touching 4+ fruit), Durian (big blast once 3 fruit sit on it), Pomegranate (bursts into 5
  Cherries when hit; two that merge burst into 5 between them), Blueberry (counts as 3 fruit for touch checks) and Seed (sprouts a starter when blown up). Blasts
  chain into other Chilis and Durians, and score a bonus for each fruit destroyed (10 for a Chili's, 14 for a Durian's).
- Banana: 4, then +2 a turn, rots after 3 turns, and rot spreads to one touching fruit a turn. Rotten
  fruit score nothing but still merge, and what they merge into is rotten.
- The rest of the Rot group: Prune (rotten from the start and spreading like any rot, +8 for each rotten fruit touching it), Fruit Fly (eats
  one rotten fruit it touches a turn for 24, and another Fly hatches there; never a Prune) and Fig (blown up while rotten, it
  gives every Banana +1 for the rest of the run).
- Flex fruit: Kiwi (becomes a copy of the first landed fruit it touches), Peach (bounces once when it lands and shoves what it
  landed on aside) and Honeydew (honeys one fruit it touches a turn; honeyed fruit, the Honeydew included, score 4 a turn, are
  tinted gold, and stick to every fruit that comes to touch them, so a honeyed lump moves as one).
- Snow Pear: at the end of each turn it and every fruit touching it turn Frozen. A Frozen fruit is held where it is (its
  ball is pinned, so it hangs there even if what was under it goes), an explosion does not destroy it, and it is tinted ice
  blue. It thaws when the rent empties the jar.
- Legendary: the Dragonfruit (a Merge touching it skips a size: two Cherries make an Orange). A Legendary takes the last
  place of a pick about one time in twelve, and is never in the shop.
- Eat and grow: the Pitaya eats one Cherry it touches a turn, and every Pitaya scores 1 more for the rest of the run.
- Juice: liquid pools at the bottom of the jar, and what sits in it is changed by it.
  - A Lime that is Exploded or Crushed leaves lime juice 20 pixels deep. Fruit in lime juice float: they rise and come to
    rest half out of it (so they are off the floor and away from the Juicer, less Deep, and nearer the rim).
  - A Coconut is Heavy, so it sinks and shoulders its way down. At its third Resolve it cracks open and is gone, leaving
    milk 20 deep. Fruit that sit in milk score double.
  - The liquid is one pool: it gets deeper with each Lime and Coconut, up to 120 pixels, holds whatever went into it,
    and goes when the rent empties the jar.
- The title has a jar filling up by itself: a run the rules play (`src/rules/demo.ts`: each hand dropped as dealt, every
  pick skipped, a new run a moment after the rent comes due).
- Fruit roll: the physics has no angle, so each fruit's turning is drawn from how far it moves along what it touches.
- Music on every screen, with a volume each for the music and the sounds in Settings, kept between launches.
- Pace: the game steps 60 times a second whatever the display does, so the jar's own business (dropping, settling, the
  tally) can run faster as the very same steps: twice as fast with Settings' Speed on Fast, three times while F is held.
  Ordering, the pick and the shop are never hurried.
- A run in progress is kept: quit or close the game, and the title offers Continue, back to the same jar. It is written each
  time the run comes to rest where you act (a hand to order, the pick, the rent, the shop, the Preserves Jar) and thrown
  away when the run ends. "New run" starts over.
- Overflow: fruit whose top is above the rim at Resolve spill and cost 5 points each.
- Boss jars: every third cycle (so cycle 3) is played in one, and the shop before it says which. A run meets one of
  four, by its seed.
  - The Peg jar has a round post in the middle that splits the pile.
  - In the Blind jar the hand is under cloths: it drops as it was dealt, and you cannot see or order it. (The Pool board
    still shows what is left, so the hand can be worked out.)
  - The Tilted jar leans 6 degrees to the right, and everything in it rolls to the low side. The fruit are moved in the
    jar's own frame, with a steady sideways pull, and the jar is drawn turned about its low corner.
  - The Flip jar has a lid on, and its gravity turns over after every second drop: the pile falls to the lid, then back to
    the floor, and each fruit starts inside the jar at the end it will fall away from. Nothing spills from it.
- Rent: 120, 180, 240, 320 and 400 over 5 cycles. Points over rent become coins (1 per 10).
- The shop, after each rent but the last: three fruit (3 coins each), one item, taking a fruit out of your pool (4 coins; the
  pool keeps at least one hand of 4) and a new shelf (1 coin). Each costs more every time you buy it (a removal by 2 coins,
  a new shelf by 1), and the price stays where it has got to for the rest of the run.
- Items, which stand on the counter once you own them:
  - Lid (6 coins): stops one overflow, then is used up.
  - Juicer (8): at each Resolve it crushes the fruit standing on the floor, each for its points plus 3.
  - Shaker (5): throws every fruit about once a hand has dropped, so the pile lands differently.
  - Big Jar and Pickling Jar (8 each): upgrades, offered only once you own the Preserves Jar, and each takes its place. The
    Big Jar keeps 3. The Pickling Jar keeps 1, Pickled: it never ages or rots again (a Banana stays at its best), and rot
    it had is gone. Pickled fruit are tinted green.
  - Preserves (8), the Preserves Jar: after the shop, choose up to 2 fruit to stay in the jar when the rent empties it.


The screen is 640 x 360 (16:9), scaled up by whole multiples.

What a fruit does can be read in play as well: its card shows under the fruit the cursor is on while you order a hand,
and beside any fruit on the shelf or in the Pool that the mouse is over.

The Pool board shows what is still to be dealt this shuffle, by kind: the hand is on the shelf above the jar, and the rest
has been played. When nothing is left it says the pool shuffles next.

## Reading a turn

The design doc's biggest risk is that a pile of fruit is harder to read than a grid, so the screen says why you scored:

- A hand drops a fruit at a time: the next waits until the last has landed and the pile it set moving has come to rest
  (its merges and Blasts too), so what each fruit scored is seen before the next adds to it. No more than 3 seconds, so a
  pile that will not rest cannot stall a hand.
- A popup names what earned its points when that has a name ("Merge +8", "Blast +14", "Spill -5", "Eat +8", "Crush +6"), and
  ends "x2" when a Booster doubled them.
- Fruit light up when something happens because of them: the Lemon that doubled a score, what set a Chili or a Durian off,
  a fruit a Merge made, one that just rotted or was honeyed.
- A line joins two fruit while one does something to the other: a Booster to the fruit it doubled, rot or honey to the fruit
  it spread to, a Fruit Fly or a Pitaya to what it ate, rot to the Prune that scores for it.
- Two popups never sit on each other (a later one is a line higher) and none is cut by the jar's wall.
- A Blast within 1.2 seconds of the last is a chain, and says so ("Chain x2"). A chain, or one Blast that destroys 5 fruit or
  more, plays in slow motion (the game at 0.35 of its speed for a moment), so you can see what it threw and set off.
- The end of a turn is a tally: each Simmer fruit lights up and scores in turn, with a tick, and the score counts up with them.
  A long tally is squeezed into about two seconds. The rules have already scored it all (`resolve`); the "tally" phase only
  shows it, then hands over to the pick or the rent.

## Balance

`node tools/balance.ts` plays whole runs on the engine's physics with no window and prints what each cycle scored, for players
that never order a hand: one that never picks, one that picks at random, one per fruit that takes only that fruit, and
`/thin` versions that spend their coins taking Cherries out of the pool. The rent curve is set against it:

| Player (24 runs) | Median score, cycles 1 to 5 | Makes the last rent |
| --- | --- | --- |
| Never picks | 260, 257, 252, 265, 256 | 0 in 24 |
| Picks at random | 216, 224, 210, 237, 257 | 4 in 24 |
| Never picks, thins the pool | 260, 281, 302, 291, 307 | 4 in 24 |
| Boom picks (Chili, Blueberry, Seed, Lime, Durian), thins | 243, 289, 328, 307, 304 | 3 in 24 |
| Rot picks (Banana, Prune, Fruit Fly, Fig, Chili) | 233, 238, 261, 255, 240 | 1 in 24 |
| Prune only, thins | 238, 242, 304, 363, 390 | 8 in 24 |
| Apple, Durian, Pomegranate, Pitaya, Kiwi, thins | 274, 314, 333, 366, 376 | 9 in 24 |

Cycle 3 is a boss jar, which is the dip in some rows.

What it showed, and what was done about it. A never-pick cycle's points come mostly from the starters merging up (about 54
from merges into Melon and 33 into Watermelon, of some 212), and those top merges are the first thing lost when other fruit
take a share of the drops. So a pick had to be worth about twice an average starter drop to break even, and at first every
fruit but the Kiwi cost 5 to 19 points for each time it was dropped. The synergy fruit's own numbers were raised until the
ones that stand alone (Apple, Durian, Pomegranate, Pitaya, Honeydew) are about neutral taken alone, picking at random is no
longer a trap, and a build of good picks beats never picking. The combo pieces (Seed, Fig, Fruit Fly, Lime, Blueberry, Lemon)
still cost points alone, on purpose. The Rot group used to lose badly taken together (about 200 a cycle). Rot blocking merges was not the reason: in a
five-turn cycle a Banana's rot barely got started, so Prunes and Fruit Flies had nothing to work with. Now a Prune spreads
its rot from the turn it lands and rotten fruit still merge, which makes the Prune a pick that stands alone and brings the
whole group to about level with never picking. The Fruit Fly and the Fig are still combo pieces. Nothing here measures an ordered hand. Rerun it after changing a fruit.

## Looking at it without playing

`tse screenshot` plays a script of keys with no window and writes frames, or a contact sheet of them to see motion
(`--every 10 --sheet name`). Three setup scripts in `tools/shots/` put the run where a shot needs it:

    SHOT_BOSS=flip npx tse screenshot . --setup tools/shots/boss.ts --script "_*30,Enter,_*20,Space,_*600" --every 20 --sheet flip
    SHOT_POOL=honeydew,cherry,cherry,grape,orange npx tse screenshot . --setup tools/shots/pool.ts --script "_*30,Enter,_*20,Space,_*430"
    SHOT_RUN='{"phase":"over","cycleScore":80}' npx tse screenshot . --setup tools/shots/run.ts --script "_*30,Enter,_*30"

`boss.ts` plays in a boss jar, `pool.ts` starts with a chosen pool, and `run.ts` sets any fields of the run. A shot keeps no
saved data and reads none.

## How it is built

- `src/rules/` holds the whole game as plain TypeScript with no engine imports, so it is tested directly with `node:test`:
  - `jar.ts` is the run: deal, order, drop, settle, resolve, pick, rent and the shop. `advance(run, dt, keys, reports)` returns the next
    run. It never moves a fruit: it reads where each one reported being.
  - `fruits.ts` is the fruit table, `items.ts` the item table and `terms.ts` the keywords their text is written in. `rng.ts` is a seeded generator, so a seed plus the inputs replay a run exactly.
- `src/Fruit.tsx` is one fruit: a ball (the engine's `useBall`) that falls, piles up and is stopped by the jar's solid colliders.
  Each step it reports where it is, its speed and which fruit it touches; a blast reaches it as a kick through its props.
- `src/Play.tsx` collects the reports, calls `advance` once a step and draws the result: the jar (walls are `<Collider solid>`),
  the fruit, the hand on its shelf, the rent board and the keys on the left, the pool by kind and a note of what just happened
  on the right, and the pick cards. `Shop.tsx` draws the shop and `Peg.tsx` is the boss jar's peg (a ball too heavy to move). `Jar.tsx` is the jar and its
  fruit, which the play screen and the title's `DemoJar.tsx` both draw.
  `FruitBall.tsx` draws a fruit's sprite, tinted when rotten and flashing when about to blow. `RuleText.tsx` draws card text with its keywords in colour. `Board.tsx` is `Panel`, a parchment board
  with its heading that lays out what is on it and is as tall as that (the rent board, the pool, the note slate and every
  dialog; the screens pin them to an edge or the middle with the engine's `left` / `right` / `top` / `bottom`), `KeyHint.tsx` a key cap and what it does, `Backdrop.tsx` the kitchen behind every screen. `theme.ts`
  names the colours, the fonts and the Kenney frames every screen is made of. `settings.ts` is the player's settings, which the
  engine keeps between launches (the game has an id, `<Game id="jam-jar">`, which is what turns that on).
- `tools/install-engine.ts` packs `../tse` and installs it without saving. `tools/balance.ts` is the balance run above.
- `tools/make-assets.py` (Python with Pillow) builds `assets/` from the free art in `tools/`, sizing each fruit to its radius in
  `src/rules/fruits.ts`. Rerun it after changing a radius.

## Credits

- Fruit art: a 16 x 16 pixel fruit sheet (`tools/fruit/`; its source and licence are still to be added there). Stand-ins:
  the Durian is the Pineapple, the Seed the brown Kiwi, the Melon the round green one, the Prune the Blackberry, the Fig the
  Aubergine and the Honeydew the golden Apple. The Pitaya is the sheet's Dragon Fruit and the Dragonfruit its
  white-fleshed one. The Fruit Fly is drawn by `tools/make-assets.py`.
- [Kenney](https://kenney.nl) pixel art, CC0: the boards, cards, buttons and the slate (UI Pack - Pixel Adventure),
  the wallpaper's trellis (Pattern Pack Pixel), the coin (Pixel Platformer), blasts (Explosion Pack's pixel explosion), the
  sounds and the music (Farm Frolics, from Music Loops). It is all drawn at exactly 2x on the 640 x 360 screen. The full bundle is on this repo's `Assets` release;
  `tools/kenney/README.md` says which file each came from.
- The backdrop moves a little: the wallpaper drifts slowly, and a few motes of dust rise through the air (`src/Backdrop.tsx`).
  No shader: the engine's software renderer, which the tests and `tse screenshot` use, runs none, and a shader would blend
  colours off the palette.
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
