# Jam Jar

A roguelike where you build a pool of fruit and the jar plays it. Each turn you're dealt 4 fruits from your pool and you arrange
them on a tray over the jar. They all drop together, each straight down from its slot with a small wobble, physics settles the pile, merges and blasts score, and then Simmer fruit score at
Resolve. After every second turn you pick 1 of 3 new fruits, or skip for a coin (two picks a cycle, so the pool stays small enough
that every fruit in it comes up). Five turns make a rent cycle; miss rent and the run ends.
Between cycles the shop sells fruit, an item, a removal and rerolls for the coins the rent left over.

Built on the [tse engine](https://github.com/nengler/tse). The design doc is the "Jam Jar: Game Design Outline" artifact.

## Running it

The engine isn't on npm yet, so `package.json` points at the packs attached to a tse GitHub release (v0.21.0), with
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
Done, Back, and Pause on the counter in the bottom right corner). A tap on a card (in the pick or the shop) chooses it and shows what its keywords mean; the Take or Buy button under it (or Enter) takes or buys it.
No card is chosen until you choose one. The shop's actions, a kind in the take-out dialog and a fruit the Preserves Jar can
keep act on one tap. The basket at the end of the shelf shows how much is still to be dealt; a tap on it (or D) opens a board
of every fruit in the pool, where a tap on a kind shows all it does beside the board. A fruit's tooltip, on the shelf and on that board, says what
each of its keywords means, as a pick's card does.

The first game has a tutorial (`src/rules/tutorial.ts`, `src/Coach.tsx`). It is not a game of its own: a card beside the jar
says one thing at a time about the run being played (the shelf, the order, dropping, scoring, the rent, the pick, the pool, the
shop), frames what it is about, and moves on when the player has done it (a lesson that only tells them something, the rent or the pool, has a "Got it"). A lesson waits for its moment,
so the card is away in between. "No tips" ends it, and the settings' Tips row turns it off or starts it again.

`npx tse package . --engine web` builds the game as a web page in `dist/jam-jar-web`, and `.github/workflows/pages.yml`
publishes it to GitHub Pages on every push to `main` (once Settings -> Pages -> Source is set to "GitHub Actions"). The
screen fills the window at any size, a phone's included. The game is laid out on its side: while the window is taller than it is wide (a phone held upright), a card asks
for it to be turned and the game waits under it (`src/Rotate.tsx`, from the engine's `useWindowSize`).

| Phase | Keys |
| --- | --- |
| Order your hand | Up/Down choose, Enter pick up / put down (then Up/Down move it), Space drop |
| Pick | Left/Right or Up/Down choose, Enter take, Space skip (+1 coin) |
| Rent paid / run over | Enter |
| Shop | Arrows choose, Enter buy, Space next cycle (or back, while choosing a fruit to remove) |
| Preserves Jar | Left/Right choose a fruit in the jar, Enter keep it or let it go, Space next cycle |
| While the jar plays | Hold F to hurry it (three times as fast) |
| Any time | Esc pause, D the whole pool |

The screens word their prompts by what the player is using, whichever was pressed last: a keyboard is told its keys, a
mouse or a finger to tap and drag, and no key is named to a player who has not pressed one (the engine's `useInputDevice`).
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
| Double / Sour | Fruit touching it score x2 / can't Merge. |
| Dense | Counts as this many fruit when touched. |
| Edge | Scores this more touching the floor or a wall. |
| Copy | Becomes the first fruit it lands on. |
| Bouncy | Bounces, shoving its neighbours. |
| Crack | After this many turns it breaks open, then: |
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
| Frozen | Held in place. Explosions can't destroy it. |
| Spill | Fruit over the rim are lost: -5 each. |

A new card is a row of these, how it scores first ("Fresh 8. Heavy. Crack 3: Milk."), with a trigger before a colon ("Exploded:
Sprout."). A new effect gets a keyword and a definition of at most 46 characters, not a sentence on one card. A card holds
at most four keywords, which is what a tooltip has room for. Tests hold the cards to this, and to the rules' own numbers.

## What's in this first slice

- Starting pool: 1 Apple and 8 starters rolled from 3–5 Cherries, 2–4 Grapes and 0–2 Oranges. It's dealt like a deck and
  reshuffles when empty.
- The merge ladder: Cherry → Grape → Orange → Melon → Watermelon → Giant Pumpkin.
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
    rest half out of it (so they are off the floor and away from the Juicer, off the floor for an Apple's Edge, and nearer the rim).
  - A Coconut is Heavy, so it sinks and shoulders its way down. At its third Resolve it cracks open and is gone, leaving
    milk 20 deep. Fruit that sit in milk score double.
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
    next hand. It scores nothing for landing. It Plunges: once it lands, its ball is driven straight down through the pile
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
  - In the Blind jar the hand is under cloths: it drops as it was dealt, and you cannot see or order it. (The whole-pool
    board still shows what is left of each kind, so the hand can be worked out.)
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
and beside any fruit on the shelf that the mouse is over.

The fruit still to be dealt this shuffle wait in a basket on a ledge past the shelf's right end, and each hand rolls out of
it onto the shelf. Beside it is how many are left; the mouse over it says of how many the pool holds. The hand is on the
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
- `art/` holds every picture as it is drawn: at its art size (half its size on the screen), in the Apollo palette
  (`art/README.md`). `tools/make-assets.py` (Python with Pillow) checks each and doubles it into `assets/`, writes each fruit's
  ball size to `src/rules/sizes.ts`, copies the sounds and makes the tally's notes. Rerun it after changing a picture.

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
