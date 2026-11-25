# Jam Jar

A roguelike where you build a pool of fruit and the jar plays it. Each turn you're dealt 5 fruits from your pool, and you arrange
four of them on a tray over the jar; the fifth, the one you leave in the basket at the end of the shelf, sits the turn out. They all drop together, each straight down from its slot with a small wobble, physics settles the pile, merges and blasts score, and then Simmer fruit score at
Resolve. A run opens with two picks of 1 of 3 new fruits, and after every turn but a cycle's last you pick again, or skip for a coin (four picks a cycle). Five turns make a rent cycle; miss rent and the run ends.
Between cycles the shop sells fruit, an item, a removal and rerolls for the coins the rent left over.

Built on the [tse engine](https://github.com/nengler/tse). The design doc is the "Jam Jar: Game Design Outline" artifact.

## Running it

The engine isn't on npm yet, so `package.json` points at the packs attached to a tse GitHub release (v0.24.0), with
`overrides` so the packs' own dependencies on each other resolve to the same release:

```sh
npm install
npm run check            # compile, type-check, tests, parity with the Rust host
npm run install-engine   # optional: try an unreleased engine from ../tse (or TSE_DIR) without changing package.json
npm run dev              # play in a window, with hot reload (needs tse's native build with a window: npm run native:build in tse)
npx tse screenshot . --script "_*2, Enter, _*10, Space, _*150" --at 160 --out shots   # a screenshot without a window
```

`.github/workflows/ci.yml` runs `npm run check` on every pull request and every push to `main`.

## Controls

Everything can also be done with the mouse or a finger, with no keyboard: drag a fruit along the shelf to where it should stand, tap the jar to drop the hand into it, and tap the buttons for what Space, Esc and Enter do elsewhere (Skip,
Done, Back, and Pause on the counter in the bottom right corner). A tap on a card in the pick chooses it and shows what its keywords mean; the Take button under it (or Enter) takes it. The shop's stall shows each thing with its name and price only: what it does opens beside it while the mouse is over it or it is chosen (a tap, or the arrows), and the Buy button beside its price (or Enter) buys it.
No card is chosen until you choose one. The shop's actions, a kind in the take-out dialog and a fruit the Preserves Jar can
keep act on one tap. The basket at the end of the shelf shows how much is still to be dealt; a tap on it (or D) opens a board
of every fruit in the pool, where a tap on a kind shows all it does beside the board. A fruit's tooltip, on the shelf and on that board, says what
each of its keywords means, as a pick's card does.

The first game has a tutorial (`src/rules/tutorial.ts`, `src/Coach.tsx`). It is not a game of its own: a card beside the jar
says one thing at a time about the run being played (the shelf, the order, dropping, scoring, the pick, the rent, the pool, the
shop), frames what it is about, and moves on when the player has done it (a lesson that only tells them something, the rent, the pool or the shop, has a "Got it"; nothing in the shop has to be bought to get past it). The two that come up while the jar plays,
the scoring and the chain, hold the jar still until their "Got it" (or Enter), so the card is not gone before it has been read. The scoring lesson waits until the
first hand has landed, scored and come to rest, so the first drop is seen through. A lesson waits for its moment,
so the card is away in between. "No tips" ends it, and the settings' Tips row turns it off or starts it again.

`npx tse package . --engine web` builds the game as a web page in `dist/jam-jar-web`, and `.github/workflows/pages.yml`
publishes it to GitHub Pages on every push to `main`, with the fruit book beside it as `fruits.html` (once Settings -> Pages -> Source is set to "GitHub Actions"). The
screen fills the window at any size, a phone's included. The game is laid out on its side: while the window is taller than it is wide (a phone held upright), a card asks
for it to be turned and the game waits under it (`src/Rotate.tsx`, from the engine's `useWindowSize`).

The fruit book (`node tools/fruit-book.ts [out file]`, `dist/fruit-book.html` by default) is one page of every fruit, written
from the game's own tables: each card as the game words it, what its keywords mean, how it scores, its sprite. What the code
doesn't know, each fruit's build family and roles, what it works with and what the balance bots measured, is in
`tools/fruit-book/book.ts`; a test fails if a fruit in the game has no entry there. Update the bot numbers there when a run
changes them.

| Phase | Keys |
| --- | --- |
| Order your hand | Up/Down choose, Enter pick up / put down (then Up/Down move it), Space drop |
| Pick | Left/Right or Up/Down choose, Enter take, Space skip (+1 coin), J put the cards aside to see the jar (and back) |
| Rent paid / run over | Enter |
| Shop | Arrows choose, Enter buy, Space next cycle (or back, while choosing a fruit to remove) |
| Preserves Jar | Left/Right choose a fruit in the jar, Enter keep it or let it go, Space next cycle |
| While the jar plays | Hold F to hurry it (three times as fast) |
| Any time | Esc pause, D the whole pool |

The screens word their prompts by what the player is using, whichever was pressed last: a keyboard is told its keys, a
mouse or a finger to tap and drag, and no key is named to a player who has not pressed one (the engine's `useInputDevice`).
The whole screen is drawn through a shader (`assets/screen.glsl`): the corners fall away into the dark, every pixel is put back on the palette (`assets/apollo.png`, written from `tools/palette/apollo.hex`) with a dither, the edges warm on a cycle's last turn, and the colour drains when the rent is missed. The settings' Screen row turns it off (Plain). Special fruit and blasts have shaders of their own (`assets/fruit.glsl`, `assets/blast.glsl`). `tse screenshot --gpu` shows them; the plain `tse screenshot` and the tests run none.

For a player at a keyboard, the keys for the pick and the shop are on screen the first time each comes up and not again;
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
| Merge | Touching one of its kind turns both into this. |
| Exploder | Explodes when touching this many fruit. |
| Buried | Explodes, big, under this many fruit. |
| Explode | Destroys nearby fruit: points +10 (big +14). |
| Exploded | When an explosion destroys it. |
| Burst | Breaks into this many Cherries. |
| Sprout | A Cherry, Grape or Orange grows here. |
| Rotten | Scores nothing. Each turn, rots one neighbour. |
| Rots | Turns Rotten after this many turns. |
| Ripen | Scores this much more each turn. |
| Honeyed / Honey | Scores +4 at the end of every turn, and sticks to what it touches / makes a fruit it touches Honeyed. |
| Eat / Hatch | Removes one fruit it touches / a new Fruit Fly appears where it ate. |
| Grow | That kind scores this much more, all run. |
| Heavy | Shoulders lighter fruit aside. |
| Double | Fruit and Merges touching it score x2. |
| Spoil | Each turn, turns one neighbour Rotten. |
| Dense | Counts as this many fruit, and lands as links. |
| Edge | Scores this more touching the floor or a wall. |
| Copy | Becomes the first fruit it lands on. |
| Bouncy | Shoves its neighbours: each one is 2 links. |
| Crack | After this many turns, or hit hard, it opens: |
| Juice / Milk | Pours juice in the jar: fruit in it float / pours milk in the jar: fruit in it score x2. |
| Skip | A Merge touching it skips a size. |
| Legendary | Rare, and never in the shop. |
| Crush, Shake, Preserve, Pickled, Once | The items' words: the Juicer, the Shaker, the jars and the Lid. |
| Smashed | Breaks into 2 of the next size down, scoring. |
| Slice | Breaks into this many Slices, Fresh 15 each. |
| Wide | Takes 2 places on the shelf: 2 lanes. |
| Absorb | Takes in a fruit no bigger and grows a size. |
| Shockwave | Throws the pile aside, Smashes what it hits. |
| Plunge | Sinks to the floor; Smashes pay 75% at once. |
| Frozen | Held, blast-proof, kept past rent. 3 turns. |
| Spill | Fruit over the rim are lost: -5 each. |

A new card is a row of these, how it scores first ("Fresh 8. Heavy. Crack 2: Milk."), with a trigger before a colon ("Exploded:
Sprout."). A new effect gets a keyword and a definition of at most 46 characters, not a sentence on one card. A card holds
at most four keywords, which is what a tooltip has room for. Tests hold the cards to this, and to the rules' own numbers.

## What's in this first slice

- Starting pool: 1 Apple and 5 starters, rolled from 2–3 Cherries, 1–3 Grapes and at most 1 Orange (`rollPool`). It was 1
  Apple and 8 starters, and for one release a basket of eight with a theme of its own (Ladder, Blast, Garden or Rot), which
  chose the run's build for the player: taken out again. The pool is dealt like a deck and reshuffles when empty.
- The opening picks: a run starts at two picks of 1 of 3 (`OPENING_PICKS`), "First fruit" and "Second fruit", before its
  first hand. The fruit taken are dealt in the first hand, and each can be skipped for a coin. So a third of the first pool is
  what the player chose. The first game's tutorial run has none: it teaches the shelf first, and the pick when it comes after
  the first turn. Its first rent is 150 (`LEARNING_RENT`), not 225: it is played with six fruit by someone who does not
  know them yet.
- A pick after every turn (`PICK_EVERY`). It was every second turn, when a pool that started at nine outgrew the 20 fruit
  a cycle deals; one that starts at six has the room, and a fruit not wanted is a coin.
- One removal a shop. Taking Cherries out in every shop was worth more than every pick put together (a bot that only did
  that made all five of the old rents in 54% of runs, against 3% without), so it was the same right answer every run.
- The opening, measured (96 seeds a bot, rent ignored, nothing bought; `tools/balance.ts`). On the old opening (nine plain
  fruit, picks after turns 2 and 4, rent 120 then 180) nobody missed the first rent, a bot that picks well scored no more in
  cycle 1 than one that never picks, and 73% of cycle 1's points came from the starters' ladder. With a pool of six and the
  two opening picks:

    | Player | Cycle 1 (10%, median, 90%) | Cycle 5 median | Misses rent 225 | Misses rent 250 | A run |
    | --- | --- | --- | --- | --- | --- |
    | Never picks (skips the opening picks too) | 195, 250, 372 | 260 | 33% | 34% | 1376 |
    | Never picks, hand ordered | 196, 310, 382 | 284 | 19% | 29% | 1481 |
    | Picks at random | 148, 227, 322 | 224 | 49% | 66% | 1269 |
    | Picks well | 219, 304, 452 | 422 | 11% | 17% | 1893 |
    | Picks well, hand ordered | 242, 318, 460 | 427 | 7% | 10% | 1989 |

  Rent went from 120, 180, 240, 320, 400 to 225, 250, 300, 350, 400 (`RENT`). What is picked and how a hand is ordered now
  decide the first cycle, and the cycles' medians rise through a run for a player who picks well, where they were flat. The
  bots buy nothing, and a shop's removals were worth 25 to 45% more points in cycles 2 to 5 in earlier runs, so a player
  does better than these late on. A cycle that scores 300 leaves 7 coins where it left 18: the first shop is tighter.
- The merge ladder: Cherry → Grape → Orange → Melon → Watermelon → Giant Pumpkin.
- Fresh fruit score when they land or are made by a merge. Simmer fruit (Apple, Banana) score at every Resolve. Lemon is a
  Booster: fruit touching it score double, and it blocks merges next to it.
- Chains (design doc, "Proposed: chains, glazes and bridge fruit"): each trigger in a turn adds one link, however many fruit
  it affects (a merge, a blast, a Plunge's burst, a Shockwave that Smashes, a Sprout, a Gourd's Absorb, the Juicer's crush),
  and so does each score at the tally. What a trigger scores is multiplied by the tier the chain has reached when it happens:
  x2 from the 5th link, x3 from the 10th, x4 from the 15th (`CHAIN_TIERS`). A landing adds no link and is never multiplied,
  nor is a spill. A Merge with a piece of a Smash adds no link (it is part of the Smash) but still scores at the tier, and a
  blast that another blast set off adds 2 (`SET_OFF_LINKS`).
- Glazes (`src/rules/glazes.ts`): an upgrade on one fruit in the pool, not on its kind. The shop sells one a visit, for 4
  coins, put on a plain fruit the player chooses of a kind the glaze fits; the fruit is dealt glazed for the rest of the
  run and wears a badge in its glaze's colour. A glazed fruit that merges or changes in the jar loses the glaze, and what it
  becomes is plain, but the fruit in the pool keeps it. A Kiwi copies the glaze with the fruit it copies. Taking a fruit out
  takes a plain one of its kind first.
  - Spicy (fruit that Merge): its Merge explodes (44 px, +12 a fruit), sparing what the Merge made.
  - Ripe (the Cherry and the Gourd): it lands one size bigger, as a plain fruit (a Grape; a Grape-sized Gourd).
  - Fizzy (fruit that score): each of its scores adds 1 more link to the chain, before it scores.
  - Seeded: blown up (its own blast included) or Crushed, a plain one of its kind grows back where it was at the end of
    the turn.
  - Anchored: a Plunge or a Shockwave neither Smashes nor throws it.

- The Quince, a bridge fruit (Garden to Ladder): Simmer, 2 at each Resolve for each size of the biggest fruit touching it, a
  Cherry's 1 to a Watermelon's 5 (any fruit counts by its size). A garden wants big fruit built beside it.

  The shop's stall has five places (three fruit, the item and the glaze); its glaze is drawn from a seed of its own, so the
  rest of what a seed decides is as it was. The badges are stand-ins until the fruit are redrawn with an overlay for each
  glaze. A run kept from before glazes loads with every fruit plain (`withGlazes`). The chain starts again with each hand dropped, and carries from the settle into the tally, so a garden
  reaches the tiers with its Simmer scores alone. It stacks with a Booster: a Lemon's x2 at x4 is x8.
- The Boom group: Chili (explodes touching 4+ fruit), Durian (big blast once 3 fruit sit on it), Pomegranate (bursts into 5
  Cherries when hit; two that merge burst into 5 between them), Blueberry (counts as 3 fruit for touch checks) and Seed (sprouts a starter when blown up; the Pumpkin Seed is under the Ladder set). Blasts
  chain into other Chilis and Durians, and score a bonus for each fruit destroyed (10 for a Chili's, 14 for a Durian's).
- Banana: 4, then +4 a turn, rots after 3 turns, and rot spreads to one touching fruit a turn. Rotten
  fruit score nothing but still merge, and what they merge into is rotten.
- The rest of the Rot group: Prune (not rotten itself: +8 for each rotten fruit touching it, and it rots one fruit it touches a turn), Fruit Fly (eats
  one rotten fruit it touches a turn for 24, and another Fly hatches there; never a Prune; and it rots one fruit it touches a
  turn, though it is not rotten itself) and Fig (scores 40 once as it turns Rotten).
- Flex fruit: Kiwi (becomes a copy of the first landed fruit it touches), Peach (bounces once when it lands and shoves what it
  landed on aside, each fruit shoved adding 2 links to the chain) and Honeydew (honeys one fruit it touches a turn; honeyed fruit, the Honeydew included, score 4 a turn, are
  tinted gold, and stick to every fruit that comes to touch them, so a honeyed lump moves as one).
- Snow Pear: at the end of each turn it and one fruit touching it turn Frozen (one a turn, as a Honeydew honeys). A Frozen fruit is held where it is (its
  ball is pinned, so it hangs there even if what was under it goes), an explosion does not destroy it, and it is tinted ice
  blue. Ice lasts 3 turns: a frozen fruit thaws at the end of the third turn after it froze, and a Snow Pear whose own ice is
  gone has melted. The rent takes no turn of it and clears nothing frozen, so what is frozen in a cycle's last turns stays
  in the jar for the next, and a pool that keeps Snow Pears coming keeps a corner of the jar from cycle to cycle.
- Legendary: the Dragonfruit (a Merge touching it skips a size: two Cherries make an Orange). A Legendary takes the last
  place of a pick about one time in twelve, and is never in the shop.
- Eat and grow: the Pitaya eats one Cherry it touches a turn, and every Pitaya scores 1 more for the rest of the run.
- Juice: liquid pools at the bottom of the jar, and what sits in it is changed by it.
  - A Lime that is Exploded or Crushed leaves lime juice 20 pixels deep. Fruit in lime juice float: they rise and come to
    rest half out of it (so they are off the floor and away from the Juicer, off the floor for an Apple's Edge, and nearer the rim).
  - A Coconut is Heavy, so it sinks and shoulders its way down. At its second Resolve it cracks open and is gone, leaving
    milk 20 deep; so it does at once when a Coconut lands on it, a Pumpkin Plunges into it or a blast catches it. Fruit that sit in milk score double.
  - The liquid is one pool: it gets deeper with each Lime and Coconut, up to 120 pixels, holds whatever went into it,
    and goes when the rent empties the jar.
- The Ladder set (big fruit; merge up, smash down):
  - Smashed: a Grape, Orange or Melon that is Smashed (by a Pumpkin's Plunge or a Shockwave) breaks into 2 of the next size
    down, which score as they are made. A Watermelon that is Smashed (by a Plunge, a Shockwave or an explosion) breaks into 4
    Slices, Fresh 15 each, so 60 in place of the Watermelon's 50; two Slices merge back into a Melon. Explosions destroy
    everything else, as before. The loop cap: a fruit made by merging two pieces cannot merge again until the turn is
    scored, so merge up, smash down cannot chain for ever in one settle.
  - Pumpkin: Heavy and Wide: it takes 2 of the shelf's 4 places, so a hand with one is 3 fruit, and it drops down the
    middle of its two lanes. A Wide fruit that would not fit in what is left of the shelf waits on top of the pool for the
    next hand, and the next fruit that fits takes its place, so the hand is still full. It scores nothing for landing. It Plunges: once it lands, its ball is driven straight down through the pile
    to the floor (the lid, in the Flip jar turned over), many times heavier than its size. Each Grape, Orange, Melon or
    Watermelon it hits is Smashed and its pieces thrown out; anything else is thrown aside and up; a frozen fruit stops it.
    Its Smashes pay 75% of what their pieces are worth, all at once when it reaches the floor, in one popup twice the size
    ("+45") with a blast, and what it threw lands on new neighbours and merges. Set up big fruit for a big burst.
  - Gourd: Fresh 4, Cherry-sized. It takes in a fruit it touches that is no bigger than itself, scoring that fruit's
    points, and grows a size (Cherry, Grape, Orange). Grown past an Orange it Bursts into 4 Cherries, rotten if it took
    in anything rotten.
  - Giant Pumpkin: two Watermelons merge into one for +75. Its Shockwave throws every fruit within 130 pixels aside and
    Smashes any Watermelon caught in it, and after 0.9 seconds it is gone, leaving room.
  - A Melon takes the middle place of a pick one time in ten (`MELON_CHANCE`), so a Ladder build can aim for
    Watermelons. It is never in the shop. Anything made bigger than what it replaces (a merge, a grown Gourd, a Giant
    Pumpkin) starts inside the jar's walls.
  - Balance bots, 24 seeds each, rent ignored (`node tools/balance.ts 24 <player> full`, which also counts the Ladder
    set's events). Points a run, and medians for cycles 1 to 5:

    | Player | A run | Medians | Giant Pumpkins | Ladder points a run |
    | --- | --- | --- | --- | --- |
    | Never picks | 1128 | 240, 226, 243, 234, 204 | 1 in 24 runs | — |
    | Never picks, hand ordered | 1202 | 254, 248, 252, 241, 248 | 3 in 24 runs (4 in all) | — |
    | Picks at random | 1078 | 207, 197, 217, 184, 198 | 0 | Pumpkin 48, Gourd 23, Crush 5 |
    | Pumpkin | 1053 | 240, 238, 207, 189, 184 | 0 | Pumpkin 169, Crush 15; 2 Smashes in 24 runs |
    | Pumpkin, hand ordered | 1054 | 231, 227, 185, 192, 196 | 0 | Pumpkin 166, Crush 19 |
    | Gourd | 1111 | 248, 193, 228, 226, 190 | 1 in 24 runs | Gourd 51 |
    | Pumpkin and Gourd | 1044 | 240, 189, 210, 196, 197 | 0 | Pumpkin 139, Gourd 46, Crush 15 |
    | Apple / Chili / Coconut / Lime | 1140 / 1127 / 1101 / 1031 | | | |

    No player spilled a fruit. A Pumpkin costs a bot about 75 points a run against never picking, as a Lime does. The
    big-fruit events are rare: a Giant Pumpkin formed in 1 run in 24 (the doc aims for one every 2 or 3), a Watermelon was
    Smashed about once in 12 runs, and a Crush is worth some 15 points a run. Bots that buy nothing in the shop and empty
    the jar every cycle seldom build two Watermelons. (These runs were before the Melon pick, with a Giant Pumpkin at 150.)
  - Variants tried with the bots (bot switches since removed; 24 seeds each):

    | Variant and player | A run | Giant Pumpkins | Last rent (400) made |
    | --- | --- | --- | --- |
    | Melon offered, taken whenever offered | 1458 | in 10/24 runs (0.79 a run) | 5/24 |
    | Melon offered, Pumpkin + Melon | 1382 | in 9/24 runs | 3/24 |
    | Melon offered, picks at random | 1157 | 0 | 1/24 |
    | Starting pool with 1–3 Oranges, never picks | 1384 | in 8/24 runs | 0/24 |
    | Starting pool with 1–3 Oranges, Pumpkin | 1195 | in 2/24 runs | — |
    | Crush reach 16 px, Pumpkin | 1052 (Crush +19) | 0 | — |
    | Crush anything Grape-sized or smaller, Pumpkin | 1027 (Crush +22) | 0 | — |

    Against never picking (1128 a run, a Giant Pumpkin in 1/24 runs, last rent 0/24). Offering the Melon reaches the doc's
    rate, but only for a player who builds for it, and it is the strongest pick the bots have found. More Oranges reach it
    for every run and lift every score about 23%. A wider or broader Crush changes nothing: a Pumpkin seldom lands on
    small fruit at all.
  - Tuning the Melon pick (Melon taken whenever offered, 24 seeds): offered in 10% of picks, 15% or every pick, with a
    Giant Pumpkin worth 50, 75 or 150. One Melon in a pool of 10 is enough (each fruit is dealt about twice a cycle), so
    10% still gave a Giant Pumpkin in 10 runs of 24, and what it scores moves a run by 0.7 points a point. The game now
    plays 10% and 75. On those defaults:

    | Player | A run | Giant Pumpkins | Last rent (400) made |
    | --- | --- | --- | --- |
    | Never picks | 1171 | in 3/24 runs | 0/24 |
    | Picks at random | 1036 | in 1/24 runs | 0/24 |
    | Melon whenever offered | 1318 | in 11/24 runs (0.75 a run) | 2/24 |
    | Durian whenever offered | 1307 | in 3/24 runs | 1/24 |
    | Pumpkin + Melon | 1207 | in 3/24 runs | 2/24 |
  - Pumpkins tried before the Plunge (their bot switches are gone): as first built it Crushed the Cherries, Grapes, Seeds
    and Limes under it, worth about 15 points a run, since small fruit settle low and a Pumpkin lands on top. Then a Pumpkin
    that Smashed the biggest ladder fruit under it, with Smashed a general rule (a Melon into 2 Oranges, and so on), gave a
    Pumpkin player about 3.7 Smashes a run (0.13 today) and Pumpkin + Melon about 4.4, for 25 to 40 more points a run.
    It costs a garden no more than today's Pumpkin (1018 against 1002; 1073 with no Pumpkin), and Giant Pumpkins stay at 3
    runs in 24 for Pumpkin + Melon. Blasts that Smash too lifted Chili + Durian from 1262 to 1480 a run, with the last rent
    made in 9 of 24 runs, so explosions still destroy what they hit (but a Watermelon).
  - The Plunge, tuned with the bots (24 seeds, rent ignored; points a run, and the last rent made in 24 runs):

    | Pumpkin | Pumpkin alone | Pumpkin + Melon |
    | --- | --- | --- |
    | Smashing the biggest ladder fruit under it, Fresh 24 | 1090, 0 | 1238, 2 |
    | Plunge, pieces scoring as made, Fresh 24 | 1333, 3 | 1521, 6 |
    | Plunge, Fresh 6 | 1225, 3 | 1423, 5 |
    | Plunge, Smashing at most 2 | 1160, 0 | 1337, 2 |
    | Plunge, pieces scoring nothing | 1194, 0 | 1360, 2 |
    | Plunge, Fresh 0, one burst paying 100% | 1189, 2 | 1390, 4 |
    | **Plunge, Fresh 0, one burst paying 75% (the game)** | **1162, 2** | **1357, 2** |
    | Plunge, Fresh 0, one burst paying 50% | 1119, 0 | 1310, 2 |

    About 20 Smashes a run, against 4. Durian scores about 1307 and a Melon build 1318, each making the last rent in 1 or
    2 runs of 24. A Plunge that only throws (no Smashing) scored 1089, the same as no Plunge. Gardens lose nothing to it
    (1079 a run with a Plunging Pumpkin, 1021 with the one before). Spills stay near none (about 2 fruit in 24 runs); the
    slowest tenth of turns settle in about 4 seconds, against 3.3, and up to 1 turn in 100 reaches the 8 second limit.
  - Pumpkin Seed (proposed in the design doc on 22 November): it scores nothing itself. Exploded, a fruit grows where it
    was and scores as it is made: a Cherry for the run's first 3, then a Grape, an Orange, and from the tenth on a Melon
    (`PUMPKIN_SEED`). Its card says what it grows now and how many more until the next size ("Exploded: grows a
    Cherry. After 3 more grow, it grows a Grape."; `cardText` in `src/layout.ts`), on the pick, in the shop and in its tooltips. The count is
    the run's, so it is Ladder's late scaler, and it needs a blast, which ties Boom to Ladder. First bots (24 seeds, rent ignored, nothing bought): never picking 1140 a run, Pumpkin Seed whenever offered
    1032, Chili + Durian + Pumpkin Seed 1132. It does nothing without a bomb, and the bots don't measure late scaling yet.
- Fruit that did little, given something to do (bots, 48 seeds, a player who takes that fruit whenever it is offered and
  nothing else, in points a run against never picking; about 30 either way is noise). A fruit that does not merge takes a
  place from what scores, the merges and the chain, and one of these needed about Fresh 22 to 25 to break even on points
  alone (Peach at Fresh 20: 87 less a run). So their points were left as they were, and their effects changed:

    | Fruit | What changed | Alone, before | Alone, now | With a partner, before and now |
    | --- | --- | --- | --- | --- |
    | Blueberry | Lands as 3 links of the chain; counts as 3 rotten neighbours to a Prune | -298 | -80 | Chili: -184, +65. Prune: +508 (Prune alone +439) |
    | Snow Pear | Ice lasts 3 turns (`FROZEN_TURNS`) and does not go at the rent: what is frozen then stays in the jar for the next cycle. It freezes one neighbour a turn, and melts when its own ice is gone | -371 | -124 | Apple: -169, +84 (Apple alone +182) |
    | Peach | Each fruit it shoves as it lands is 2 links (`PEACH_LINKS`; 1 link: -161, 3 links: +30) | -226 | -62 | |
    | Coconut | Cracks at its 2nd Resolve, not its 3rd, and at once when hit hard (a Coconut landing on it, a Plunge, a blast) | -242 | -106 | Apple: +13, +185 |
    | Banana | Ripen 4, was 2 (Ripen 5: -86) | -183 | -119 | |

  The Snow Pear was first tried keeping all it froze through the rent, thawed (+127 alone, +379 with an Apple: too strong)
  and then freezing one neighbour a turn (+80, +349). With ice that thaws, 4 turns of it scored no more than 3 (-131, +101)
  and 5 less (-152, +45): the jar fills with fruit that will not move, and 8.7 spill a run.

  The bots drop a hand in the order it was dealt, so a fruit that scores by what it lands on or beside (Peach, Coconut, Snow
  Pear) does better than this in a player's hands. Lemon, Fruit Fly and Fig lost points even beside the fruit they are made
  for, and were changed after these (below).
- Four more, the same way (same bots; "with" is the pair against the partner alone):

    | Fruit | What changed | Alone, before | Alone, now | With a partner, now |
    | --- | --- | --- | --- | --- |
    | Fruit Fly | Spoil: it rots one fruit it touches a turn, so it brings its own meal and eats it the next | -425 | +31 | Prune: +525 (Prune alone +439; was +289). Banana: +197 (was -251) |
    | Chili | Its blast is a link for each fruit it destroys, as well as its own | -114 | -29 | Blueberry: +134 (was -184). Seed: +84 (was -32) |
    | Lemon | Sour is gone: it no longer stops merges beside it, and a Merge touching it scores double | -419 | -129 | Apple: +79 (Apple alone +182; was -113). Prune: +281 (was +124) |
    | Fig | Scores 40 once as it turns Rotten (`FIG.rot`), whatever rotted it; no blast needed, and it no longer grows Bananas | -326 | -306 | Fruit Fly: +149 (Fly alone +31). Prune: +417 (Prune alone +439) |

  A Fig is still nothing alone, by design: it needs a rot beside it. At 20 for turning it was level with a Fruit Fly alone
  (+24) and cost a Prune build half its points (+222). A Lemon scores nothing itself and doubles what is beside it, which
  bots that drop a hand as dealt do not set up: it still costs them points beside an Apple or a Prune.
- The Prune, which was too strong for how little it asked. Rotten from the start and spreading like any rot, it made the
  neighbours it scores for, and two Prunes scored each other: +439 a run alone, the most of any fruit, and every partner
  measured made a Prune build worse than Prunes alone. It is no longer rotten: it Spoils a neighbour a turn as a Fruit Fly
  does and scores 8 for each rotten fruit beside it, but Prunes do not count each other and rot does not take them. Same
  bots, against never picking:

    | | Prune alone | With a Fruit Fly (alone +31) | With a Blueberry (alone -80) | With a Fig | With a Banana (alone -119) |
    | --- | --- | --- | --- | --- | --- |
    | Before | +439 | +525 | +508 | +417 | +165 |
    | Now | +61 | +226 | +271 | +227 | -8 |

  Two others were tried. A Prune that makes no rot at all scored nothing alone (-444) and cost a Fruit Fly build 179: a
  trap. The old Prune with rotten Merges scoring nothing (rot costs a merge pool nothing as it is) was still the best
  fruit alone (+310).
- Five dealt, four dropped (`DEAL_SIZE`, `HAND_SIZE`, `dropping`). The hand is five fruit; the tray over the jar has four
  places, and the last fruit of the hand, as the player leaves it, stands in the basket at the end of the shelf and goes back
  with the dealt fruit when the hand drops. So a turn has a fruit to leave out as well as an order to choose, and a pool is
  gone through a fifth faster: a fruit picked comes round sooner. A Wide fruit the tray has no room left for sits out too.
  Bots on the whole game as it then stood (96 seeds; rent 225, 250, 300, 350, 400 kept): a player who picks at random now
  scores more than one who never picks (1554 a run against 1405; it was 1318 against 1423 before the fruit were reworked).
  One who picks well and orders makes all five rents in 32% of runs (40% before), and with one removal a shop in 50% (66%).
  The bots do not choose which fruit sits out: it is whichever their ordering leaves last, and the ordering bot that never
  picks does worse for it (1283 a run, from 1491). A player who leaves out the weakest fruit does better than these.
- Countdowns: a fruit in the jar that is counting down wears the number of turns it has left, in a small dark disc at its
  lower left (`countdowns`, `TurnsMark.tsx`): a frozen fruit until it thaws (an ice-blue ring), a Coconut until it cracks
  (light), a Banana until it rots (brown). A frozen build is timed by that number, and it was nowhere on screen.
- Raspberry: Fresh 5, and Cluster 8: each one that lands makes every Raspberry score 8 more until the rent (`RASPBERRY`,
  `clusterBonus`), so a cycle's Raspberries score 5, 13, 21 and on. The fruit that is better the more of it a pool holds. It
  starts again each cycle, and nothing offers it more often to a player who has one, so the build is found and not chosen.
  A bot that takes every Raspberry offered and nothing else ends a run with 2.6 of them (48 seeds): at Fresh 3, Cluster 2 it
  scored 298 a run less than never picking, at 4 and 6, 129 less, and at 5 and 8 it breaks even (36 less, within the noise),
  with 390 points a run from Raspberries and 970 in its best run. Its picture is a placeholder drawn for the game.
- Golden Apple: Fresh 2, and Golden 2: it pays 2 coins when the rent is paid with it in the jar, or when an explosion or
  the Juicer destroys it (`GOLDEN`; nothing while it is rotten). An early economy pick that needs no other fruit. The
  balance bots buy nothing in the shop, so they can't value it yet: taken whenever offered it scores 1000 a run.
- The title has a jar filling up by itself: a run the rules play (`src/rules/demo.ts`: each hand dropped as dealt, every
  pick skipped, a new run a moment after the rent comes due).
- Big moments: a score of 20 or more showing, or the chain reaching a tier, knocks the jar and holds the game nearly still
  for a beat (longer from 50 points), and its popup is written bigger (`PUNCH_FROM`, `HIT_SPEED` in `src/Play.tsx`). Only
  drawn and paced: the rules step the same.
- Lanes (`src/Lanes.tsx`): while the tutorial's lessons about the shelf are up, a faint dashed line runs down the jar under
  each fruit of the hand. After that, only a fruit being moved (picked up or dragged) shows a band as wide as itself down
  its lane, so what it will come down on can be seen. Neither in the Blind, Tilted or Flip jar, where a fruit does not end
  up under its place.
- A shelf fruit's card stands under the rent board and its keywords under the basket, so neither hides the score, the rent
  or the coins (during a tutorial lesson, whose card is at the right, they are one column in the top left corner).
- The pick's cards can be put aside to look at the jar and the score ("See the jar", or J), and brought back.
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
  - In the Blind jar the hand is under cloths: it drops as it was dealt, and you cannot see or order it. (The whole-pool
    board still shows what is left of each kind, so the hand can be worked out.)
  - The Tilted jar leans 6 degrees to the right, and everything in it rolls to the low side. The fruit are moved in the
    jar's own frame, with a steady sideways pull, and the jar is drawn turned about its low corner.
  - The Flip jar has a lid on, and its gravity turns over after every second drop: the pile falls to the lid, then back to
    the floor, and each fruit starts inside the jar at the end it will fall away from. Nothing spills from it.
- Rent: 120, 180, 240, 320 and 400 over 5 cycles. Points over rent become coins (1 per 10).
- The shop, after each rent but the last: three fruit (3 coins each), one item, taking a fruit out of your pool (4 coins, one fruit a shop; the
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
and beside any fruit on the shelf that the mouse is over.

The fruit still to be dealt this shuffle wait in a basket on a ledge past the shelf's right end, and each hand rolls out of
it onto the shelf. Beside it is how many are left. The hand is on the
shelf, and the rest has been played. At 0 the basket refills with the whole pool before the next deal. By the end of a run a
pool holds a dozen kinds, one or two of each, so what they are is on the whole-pool board (a tap on the basket, or D): under
each kind, how many are left to deal of how many there are, and a kind with none left is faded.

## Reading a turn

The design doc's biggest risk is that a pile of fruit is harder to read than a grid, so the screen says why you scored:

- A hand drops a fruit at a time: the next waits until the last has landed and the pile it set moving has come to rest
  (its merges and Blasts too), so what each fruit scored is seen before the next adds to it. No more than 3 seconds, so a
  pile that will not rest cannot stall a hand.
- A popup names what earned its points when that has a name ("Merge +8", "Blast +14", "Spill -5", "Eat +8", "Crush +6", and a Plunge's burst, twice the size and with no name: "+45"), and
  ends "x2" when a Booster doubled them.
- Fruit light up when something happens because of them: the Lemon that doubled a score, what set a Chili or a Durian off,
  a fruit a Merge made, one that just rotted or was honeyed.
- A line joins two fruit while one does something to the other: a Booster to the fruit it doubled, rot or honey to the fruit
  it spread to, a Fruit Fly or a Pitaya to what it ate, rot to the Prune that scores for it.
- Two popups never sit on each other (a later one is a line higher) and none is cut by the jar's wall.
- The chain is counted over the jar's rim while the jar plays ("Chain 7 x2"): it goes up with each link, and turns gold and
  grows a little at each tier. Each link rings the tally's bell a note higher (the top note again past the eighth), and each
  tier rings a chord of its own (`tier.wav`). A popup shows the points after the chain's multiplier, so what it says is what
  the score went up by. A turn whose chain reached x2 ends with one line over the jar once the tally is done: "14 links,
  412 points". The first such chain brings the tutorial's last lesson, which holds the jar still until its "Got it".
- A Blast within 1.2 seconds of the last is a chain of Blasts. That, or one Blast that destroys 5 fruit or more, plays in
  slow motion (the game at 0.35 of its speed for a moment), so you can see what it threw and set off.
- The end of a turn is a tally: each Simmer fruit lights up and scores in turn, its link of the chain ringing a note higher than
  the last, and the score and the chain count up with them.
  A long tally is squeezed into about two seconds. The rules have already scored it all (`resolve`); the "tally" phase only
  shows it, then hands over to the pick or the rent.

## Balance

`node tools/balance.ts` plays whole runs on the engine's physics with no window and prints what each cycle scored, for players
that never order a hand: one that never picks, one that picks at random, one per fruit that takes only that fruit, and
`/thin` versions that spend their coins taking Cherries out of the pool. The rent curve is set against it:

| Player (24 runs) | Median score, cycles 1 to 5 | Makes the last rent |
| --- | --- | --- |
| Never picks | 260, 237, 225, 251, 258 | 0 in 24 |
| Picks at random | 233, 235, 202, 229, 247 | 0 in 24 |
| Never picks, thins the pool | 260, 257, 279, 316, 313 | 6 in 24 |
| Boom picks (Chili, Blueberry, Seed, Lime, Durian), thins | 243, 289, 328, 307, 304 | 3 in 24 |
| Rot picks (Banana, Prune, Fruit Fly, Fig, Chili) | 233, 238, 261, 255, 240 | 1 in 24 |
| Prune only, thins | 260, 257, 275, 297, 313 | 8 in 24 |
| Apple, Durian, Pomegranate, Pitaya, Kiwi, thins | 241, 270, 314, 363, 387 | 10 in 24 |

Cycle 3 is a boss jar, which is the dip in some rows. The Boom and Rot rows were measured with a pick after every turn; the
others with a pick after every second turn, as the game now plays.

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

### Chains, measured (23 November)

`BALANCE_CHAINS=off` plays the same runs with a chain that multiplies nothing, so the two can be set side by side. 24 seeds
each, rent ignored; points a run, the last rent (400) made, and how long the chains ran with them on:

| Player | A run, off / on | Last rent made, off / on | Links a turn | Turns at x2 / x3 / x4 | Longest |
| --- | --- | --- | --- | --- | --- |
| Never picks | 1162 / 1372 (+18%) | 0 / 0 | 3.5 | 31% / 0% / 0% | 11 |
| Picks at random | 1048 / 1183 (+13%) | 1 / 2 | 3.1 | 24% / 2% / 0% | 13 |
| Boom (Chili, Durian, Blueberry, Seed) | 1237 / 1394 (+13%) | 4 / 4 | 2.8 | 19% / 1% / 0% | 11 |
| Durian | 1302 / 1480 (+14%) | 1 / 4 | 3.2 | 26% / 0% / 0% | 10 |
| Melon | 1328 / 1581 (+19%) | 5 / 5 | 3.5 | 30% / 1% / 0% | 11 |
| Pumpkin + Melon (Ladder) | 1323 / 1473 (+11%) | 4 / 5 | 3.2 | 23% / 0% / 0% | 11 |
| Garden (Apple, Honeydew, Banana, Pitaya, Snow Pear) | 1060 / 1288 (+22%) | 0 / 1 | 4.4 | 44% / 5% / 1% | 17 |

Two changes came from the first measurement. With every Merge a link, Pumpkin + Melon scored 1728 a run (+31%), made the
last rent in 9 runs of 24 and ran a chain to 26 links: a Plunge throws its pieces into new merges, each a link. A Merge with
a piece of a Smash now adds none, which brings it to +11% and 5 runs, and changes no other build by more than 3%. And a blast
another set off now adds 2 links, for true chain reactions: Boom +27 a run, Durian +18, nothing else.

Every build scores 11% to 22% more. Gardens gain most and reach x2 most often (44% of turns), a steady boost from their
tally, as the design doc expected. Boom chains least: a blast is one link however many fruit it destroys, and the bots seldom
set one blast off with another. x3 and x4 are rare (5% of turns at most), so they are the "whoa" moments rather than the
usual turn. The rent curve has not been changed: medians rose by about 30 to 50 a cycle, and no build makes the last rent
in more than 5 runs of 24.

### Bots that shop (23 November)

`/shop` makes a bot buy the fruit it would pick from the shop's shelf while its coins last ("random/shop" buys whatever is
there). 24 seeds each, chains on, rent ignored; against the same player buying nothing:

| Player | A run, no shop / shop | Last rent made, no shop / shop | Fruit bought a run | Pool at the end |
| --- | --- | --- | --- | --- |
| Picks at random | 1183 / 1241 | 2 / 3 | 6.6 | 25.6 |
| Picks at random, shop and thin | 1183 / 1300 | 2 / 4 | 3.3 | 19.6 |
| Boom (Chili, Durian, Blueberry, Seed) | 1394 / 1473 | 4 / 2 | 2.0 | 15.9 |
| Durian | 1480 / 1521 | 4 / 2 | 0.6 | 10.6 |
| Durian, shop and thin | 1480 / 1836 | 4 / 6 | 0.6 | 7.1 |
| Durian + Golden Apple | — / 1293 | — / 0 | 1.0 | 12.7 |
| Garden (Apple, Honeydew, Banana, Pitaya, Snow Pear) | 1288 / 1296 | 1 / 1 | 2.7 | 16.4 |
| Garden + Golden Apple | — / 1233 | — / 2 | 2.9 | 17.3 |
| Pumpkin + Melon | 1473 / 1456 | 5 / 6 | 0.8 | 11.9 |
| Melon (never in the shop) | 1581 / 1581 | 5 / 5 | 0 | 10.0 |

Buying adds little: 3% to 6% a run, because a build's few fruit are seldom among the shelf's 3 of some 25. Thinning is what
the shop is for: Durian that also takes Cherries out scores 1836 and makes the last rent in 6 of 24, the most of any bot. The
Golden Apple costs a build points (Durian 1521 alone, 1293 with it; Garden 1296 and 1233): its coins buy little more, since
the shelf seldom has what the build wants. No bot reaches the old count of 10 last rents in 24 even shopping, so that count
did not come from shopping.

### Glazes, measured (23 November)

`/glaze` makes a bot buy the shop's glaze whenever it can and put it on the fruit it is for; `BALANCE_GLAZE=fizzy` makes every
shop sell that one. 24 seeds each, chains on, rent ignored; a bot ends a run with about 4 glazed fruit:

| Glaze | Player | A run, no glaze / glaze | Last rent made |
| --- | --- | --- | --- |
| Ripe | Never picks | 1372 / 1624 (+18%) | 0 / 6 |
| Ripe | Pumpkin + Melon | 1473 / 1676 (+14%) | 5 / 10 |
| Fizzy | Never picks | 1372 / 1516 (+10%) | 0 / 7 |
| Fizzy | Garden | 1288 / 1425 (+11%) | 1 / 3 |
| Seeded | Boom | 1394 / 1504 (+8%) | 4 / 8 |
| Spicy | Never picks | 1372 / 1444 (+5%) | 0 / 0 |
| Spicy | Boom | 1394 / 1455 (+4%) | 4 / 3 |
| Anchored | Never picks, Garden, Pumpkin + Melon | +0% to +1% | no change |

Four were tuned down from the first try, which was far stronger: Ripe ripened any ladder fruit (a Ripe Orange landing as a
Melon: +30% and +33%, the last rent in 11 and 15 runs of 24), then Cherries and Grapes (+25%, +31%), and now only Cherries and
the Gourd. Fizzy added 2 links (+21%, Garden at x2 in 67% of turns), now 1. Seeded grew back at once, so a Seeded Chili went
off again in the same settle (Boom +28%); now it grows back at the end of the turn. Spicy's blast scored +6 a fruit and cost
its build points (it destroys starters that would have merged), now +12. Ripe is still the strongest, and the one to watch
in playtests. Anchored does nothing for these bots: it is for a garden sharing a jar with Pumpkins, which none of them plays.

### Bridge fruit, measured (23 November)

24 seeds each, chains on, rent ignored; each against the same player without it, on the same code (adding fruit to the offers
moves every seed's luck, so these are not set against the tables above):

| Fruit | Player | A run, without / with | What it scored itself |
| --- | --- | --- | --- |
| Quince | alone (against never picking) | 1321 / 1319 | 108 |
| Quince | Garden | 1218 / 1216 | 60 |
| Quince | Pumpkin + Melon | 1410 / 1422 | 138 |
| Quince | Melon | 1488 / 1394 | 134 |
| Medlar | alone (against never picking) | 1321 / 1138 | 17 |
| Medlar | Rot (Banana, Prune, Fruit Fly, Fig) | 1162 / 1101 | 13 |

The Quince is about neutral: a pick that costs nothing, with a placement to read (beside the biggest fruit). The Medlar was
built as the design doc has it (two Rotten fruit merging beside it come out fresh, +3), then tried as any Merge with a Rotten
fruit in it, then as freshening a Rotten neighbour each turn. Each scored the same 13 to 19 points a run, all of it its own
landing: in a five-turn cycle rot comes late, and seldom sits beside the Medlar. It is held back from the game until it is
redesigned; its picture is in `art/fruit/medlar.aseprite`.

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
    run. It never moves a fruit: it reads where each one reported being. What happens at the end of a turn is a list of steps
    run in order (`END_OF_TURN`: the spill, the Juicer, Simmer scores, the Fruit Flies and so on); a new end-of-turn fruit is one more.
  - `fruits.ts` is the fruit table, `items.ts` the item table and `terms.ts` the keywords their text is written in. `rng.ts` is a seeded generator, so a seed plus the inputs replay a run exactly.
- `src/Fruit.tsx` is one fruit: a ball (the engine's `useBall`) that falls, piles up and is stopped by the jar's solid colliders.
  Each step it reports where it is, its speed and which fruit it touches; a blast reaches it as a kick through its props.
- `src/Play.tsx` holds the run: it collects the reports, calls `advance` once a step, plays the sounds, hears the taps and drags,
  and lays out the play screen from its parts, each in its own file: `JarMarks.tsx` (what is drawn over the jar's fruit: blasts,
  the lines between fruit, the Preserves Jar's frames), `Shelf.tsx` (the hand and what each fruit does), `PoolBasket.tsx` (the
  pool's basket and the coins), `RentBoard.tsx`, `PickBoard.tsx` (the pick cards), `PoolBoard.tsx` (the whole pool),
  `PreserveBoard.tsx`, `CycleEnd.tsx` (rent paid, or the run over) and `LastTurn.tsx` (the banner). `places.ts` says where the
  shelf, the basket and the boards stand. `Shop.tsx` draws the shop (a market stall: an awning, jam-jar labels on a counter, wooden signs; its pieces are in `art/shop/`) and `Peg.tsx` is the boss jar's peg (a ball too heavy to move). `Jar.tsx` is the jar and its
  fruit, which the play screen and the title's `DemoJar.tsx` both draw.
  `FruitBall.tsx` draws a fruit's sprite, tinted when rotten and flashing when about to blow. `RuleText.tsx` draws card text with its keywords in colour. `Board.tsx` is `Panel`, a parchment board
  with its heading that lays out what is on it and is as tall as that (the rent board, the pool, the note slate and every
  dialog; the screens pin them to an edge or the middle with the engine's `left` / `right` / `top` / `bottom`), `KeyHint.tsx` a key cap and what it does, `Backdrop.tsx` the kitchen behind every screen. `theme.ts`
  names the colours, the fonts and the Kenney frames every screen is made of. `settings.ts` is the player's settings, which the
  engine keeps between launches (the game has an id, `<Game id="jam-jar">`, which is what turns that on).
- `tools/install-engine.ts` packs `../tse` and installs it without saving. `tools/balance.ts` is the balance run above.
- `art/` holds every picture as it is drawn, as an Aseprite file: at its art size (half its size on the screen), in the Apollo
  palette (`art/README.md`). `tools/make-assets.py` (Python with Pillow) flattens each (`tools/aseprite.py` reads the files, so
  Aseprite need not be installed), checks it and doubles it into `assets/` as a PNG, writes each fruit's ball size to
  `src/rules/sizes.ts`, copies the sounds and makes the tally's notes. npm runs it before `dev`, `build`, `check`, `test` and
  `package`, so a saved picture is in the game the next time it starts. `assets/` stays in git: the Pages build packages it
  as it is, without Python.

## Credits

- Fruit art: one picture per fruit in `art/fruit/`, for now cut from a 16 x 16 pixel fruit sheet (`tools/fruit/`; its source
  and licence are still to be added there) and to be replaced one by one. Stand-ins:
  the Durian is the Pineapple, the Seed the brown Kiwi, the Melon the round green one, the Prune the Blackberry, the Fig the
  Aubergine and the Honeydew the golden Apple. The Pitaya is the sheet's Dragon Fruit and the Dragonfruit its
  white-fleshed one. The Fruit Fly was drawn for the game.
- There is no music for now: the tracks on hand are loops of 10 to 48 seconds (the one that played, Farm Frolics, is 10.7),
  which wear thin at once. `src/Main.tsx` says where a `<Music>` goes back, and the settings screen's music row is out with it.
- [Kenney](https://kenney.nl) pixel art, CC0: the boards, cards, buttons and the slate (UI Pack - Pixel Adventure),
  the wallpaper's trellis (Pattern Pack Pixel), the coin (Pixel Platformer), blasts (Explosion Pack's pixel explosion), the
  sounds and the music (Farm Frolics, from Music Loops). The pictures were recoloured onto Apollo and are in `art/`; the
  frames and the explosion have finer detail than the art's pixel, so they are in `art/screen/` at screen size. The full bundle
  is on this repo's `Assets` release; `tools/kenney/README.md` says which file each came from.
- The backdrop moves a little: the wallpaper drifts slowly, and a few motes of dust rise through the air (`src/Backdrop.tsx`).
  No shader: the engine's software renderer, which the tests and `tse screenshot` use, runs none, and a shader would blend
  colours off the palette.
- Drawn for the game, in Apollo colours at the same 2x pixel: the kitchen (wallpaper over a wooden counter), the jar's glass,
  the shelf, the key caps, the items and the shop's stall. The jar is two pictures, one behind the fruit and one (its near rim,
  shine and fill line) in front of them.
- Text: the engine's built-in pixel fonts, m5x7 for reading and Jersey 10 for headings and numbers, both at 2x.
- Colours: the [Apollo palette](https://lospec.com/palette-list/apollo) by AdamCYounis (`tools/palette/apollo.hex`). Every
  picture in `art/` is drawn in it, every pixel solid or clear (`tools/make-assets.py` stops on any other), and `src/theme.ts` names
  the UI's colours. Nothing is drawn see-through except the shade behind a menu or the pick.
- Every picture is pixel art at 2x, the fruit included: each is drawn at its own size (16 to 48 art pixels, the merge ladder
  going 16, 20, 24, 28, 32) and shown at that size everywhere; each ball's radius is measured from it (`src/rules/sizes.ts`).

## Engine notes

What the engine did and didn't cover for this game:

- **Physics.** tse had none (colliders only report touching), so the game first had its own solver. It moved into the engine as
  `useBall` (tse#205, released in v0.9.0), and each fruit is now a component with a ball.
- **The rules stay outside components.** Scoring, merges and blasts need every fruit at once, so the run is one plain object in
  `Play`'s state, fed by the fruit's reports a step behind. `advance` returns a copy each step, because render compares by `===`.
- **Not on npm.** Hence `install-engine`, the same loop the engine's own Bramble game uses.
- **Free assets.** Kenney has no pixel fruit, so the fruit come from a separate pixel sheet; the rest is Kenney pixel art or
  drawn for the game.
