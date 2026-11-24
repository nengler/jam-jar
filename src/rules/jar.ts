/**
 * One run of Jam Jar, as plain data and functions: the pool (dealt like a deck), the hand you order, the jar's fruit, scoring,
 * rent and the 1-of-3 pick. `advance` takes the run, the frame's time and the keys pressed, and returns the next run (a copy, so
 * the component's state changes by assignment and renders). Nothing here knows about the engine, so it is tested with node:test.
 *
 * A turn: order (arrange the 4 dealt fruits on the tray) → drop (all 4 fall together, each down its slot's lane) → settle (physics; merges and blasts
 * score as they happen) → resolve (overflow, then Simmer fruit score; shown one fruit after another, the tally) → pick (1 of 3, or skip). Five turns make a rent cycle,
 * and between cycles the shop sells fruit, an item, a removal and rerolls for the coins the rent left over.
 *
 * The physics is the engine's (`useBall`): each fruit is a component with a ball, and each step it reports where it is, how fast it
 * moves and which fruit it touches (`FruitReport`). The run reads those reports; it never moves a fruit itself, except to give one
 * a kick (a blast), which the fruit's component applies.
 */
import { APPLE, BANANA, FIG, FRUITS, GOLDEN, GOURD_BURST, GOURD_SIZES, HONEY, LEGENDARY, LEGENDARY_CHANCE, MELON_CHANCE, OFFERABLE, pumpkinSprout, QUINCE, RASPBERRY, SLICES, SPROUTS, type FruitKind } from "./fruits.ts";
import { FIZZY_LINKS, GLAZE_KINDS, GLAZE_PRICE, GLAZES, glazeFits, ripened, SPICY, type Glaze } from "./glazes.ts";
import { ITEMS, keepingJar, offerable, type ItemKind } from "./items.ts";
import { Rng } from "./rng.ts";

export interface JarBounds {
  left: number;
  right: number;
  floor: number;
}

export const JAR: JarBounds = { left: 224, right: 416, floor: 344 };
export const GRAVITY = 1200;
/** A fruit this close to the floor (beyond touching) is on it: a settled pile jitters by a fraction of a pixel. */
const FLOOR_TOLERANCE = 1.5;
/** The rim: a fruit whose top is above it once the jar settles spills out. */
export const RIM = 112;
/** Where dropped fruit appear. */
export const DROP_Y = 80;
/**
 * The tray drop. The shelf is a tray over the jar with a slot per lane, and the whole hand is released together, hand index 0 in
 * the leftmost lane, so where a fruit stands on the shelf decides where it lands. Each fruit wobbles up to `wobble` px within its
 * lane, so a setup is never pixel-perfect. Chosen on 20 November over dropping one at a time at random spots, where arranging the
 * hand did nothing measurable. `wobble` is a dial the balance bots turn ("/wobble0" in `tools/balance.ts`).
 */
export const TRAY = { wobble: 4 };
/**
 * For the balance bots: where dropped fruit land (the tray's wobble) is drawn from another stream when
 * `salt` is not 0. The run's own stream still moves on exactly as with 0, so the rest of the run is unchanged: a bot can try a
 * turn with other luck, and then play it for real with luck it has not seen. 0 in the game.
 */
export const SPOTS = { salt: 0 };

/** Every fruit a pick or the shop can ever offer, whatever the run: what the pick's cards and the shop's baskets make room for. */
export const OFFERED: readonly FruitKind[] = [...OFFERABLE, "melon", ...LEGENDARY];

/** Where in its lane the next fruit lands: from the run's stream, or (`SPOTS.salt`) from another one, the run's stream moving on the same. */
function spot(rng: Rng, low: number, high: number): number {
  const own = rng.range(low, high);
  if (SPOTS.salt === 0) return own;
  return new Rng((rng.seed ^ Math.imul(SPOTS.salt, 0x9e3779b1)) >>> 0).range(low, high);
}
export const HAND_SIZE = 4;
export const TURNS_PER_CYCLE = 5;
/**
 * A new fruit is offered after every `PICK_EVERY`th turn of a cycle but its last (which goes to the rent): after each of the
 * first four. It was every second turn, when the pool started at nine and four picks a cycle outgrew the 20 fruit a cycle
 * deals. A pool that starts at six has the room, and a fruit not wanted is skipped for a coin.
 */
export const PICK_EVERY = 1;
/** The boss jar's peg: a round post in the middle of the jar that splits the pile, on every third cycle. */
export const PEG = { x: 320, y: 244, r: 22 };
export const BOSS_EVERY = 3;

/** Whether a cycle is played in a boss jar. */
export function bossCycle(cycle: number): boolean {
  return cycle % BOSS_EVERY === 0;
}

/**
 * The boss jars. The Peg jar has a round post in the middle that splits the pile. In the Blind jar the hand is covered: you
 * cannot see or arrange it, and the tray is shuffled before it drops. The Tilted jar leans, and everything in it rolls to the low
 * side. The Flip jar has a lid on, and its gravity turns over before every turn's drop but the cycle's first: the pile falls to
 * the lid, then back to the floor.
 */
export type Boss = "peg" | "blind" | "tilt" | "flip";
export const BOSS_NAME: Readonly<Record<Boss, string>> = { peg: "Peg jar", blind: "Blind jar", tilt: "Tilted jar", flip: "Flip jar" };
const BOSS_RULE: Readonly<Record<Boss, string>> = { peg: "A post splits the pile.", blind: "The hand is covered.", tilt: "Everything rolls right.", flip: "Gravity flips every turn." };
const BOSSES: readonly Boss[] = ["blind", "peg", "tilt", "flip"];

/** The boss jar a run meets: one of them, by its seed. */
export function bossFor(seed: number): Boss {
  return BOSSES[Math.abs(seed) % BOSSES.length] as Boss;
}

/** How far the Tilted jar is drawn leaning to the right, in degrees, and how hard its fruit are pulled sideways, in pixels per
 * second per second. The fruit are moved in the jar's own frame, where its walls stand straight, and the whole jar is drawn
 * leaning. The pull is gravity's share along a floor leaning `TILT_FELT`, three times the drawn lean: at 6 degrees the pile
 * hardly moved (63% of the fruit in the right half after 3 turns, against 53% level), and drawing it leaning further would push
 * the jar's raised rim up through the shelf. A pull of 10 degrees put 76% on the right, 14 degrees 81%, 18 degrees 88%; at 18 a
 * fruit dropped in the left lane reaches the pile in about half a second. (The fruit also slide easily there: `TILT_FRICTION`.) */
export const TILT = 6;
const TILT_FELT = 18;
export const TILT_PULL = Math.round(GRAVITY * Math.sin((TILT_FELT * Math.PI) / 180));

/** How far the jar leans now, in radians: nothing but in the Tilted jar. */
export function lean(run: Run): number {
  return bossNow(run) === "tilt" ? (TILT * Math.PI) / 180 : 0;
}

/** The boss jar this cycle of the run is played in, or null for a plain one. */
export function bossNow(run: Run, cycle = run.cycle): Boss | null {
  return bossCycle(cycle) ? run.boss : null;
}

/**
 * The rent of each cycle. The first two were 120 and 180, which no bot ever missed. At 225 and 250, on a pool of six and two
 * opening picks, a player who never picks and never orders a hand misses each in 1 run of 3, and one who picks well and
 * orders in 1 of 14 and 1 of 10 (the README's bots, "The opening").
 */
export const RENT: readonly number[] = [225, 250, 300, 350, 400];
/** Points over the rent that make one coin. */
export const POINTS_PER_COIN = 10;
/** Seconds between releases of the tray, at the least. In the Flip jar a release also waits for the pile to have been calm for
 * `DROP_CALM` seconds, but no longer than `DROP_LIMIT` since the last (a pile that will not rest cannot stall a hand). */
const DROP_GAP = 0.35;
const DROP_CALM = 0.2;
const DROP_LIMIT = 3;
/** A fruit slower than this (px/s) is calm: it has landed, and (in the Flip jar) gravity may turn over. */
const CALM_SPEED = 20;
/**
 * The turn is scored once the jar has settled: every fruit slower than `SETTLE_SPEED` (px/s; slow enough to look still) for
 * `CALM_TIME` seconds. What a fruit scores depends on what it touches, so nothing should still be rolling when it is counted.
 */
const SETTLE_SPEED = 5;
const CALM_TIME = 0.6;
/** Settling gives up after this long, so a jittering pile cannot stall a turn. */
export const SETTLE_LIMIT = 8;
const OVERFLOW_PENALTY = 5;
/** How many Resolves a Coconut sits through before it cracks. */
export const COCONUT_TURNS = 2;
/** Juice: how deep the liquid a Lime or a Coconut leaves is, in pixels, and the deepest the jar's liquid gets. */
export const LIME_JUICE = 20;
export const COCONUT_MILK = 20;
export const JUICE_MOST = 120;
/** What a honeyed fruit scores at each Resolve. */
const HONEY_POINTS = HONEY;
const POPUP_LIFE = 0.9;
/** About how wide a popup's character is on screen, and a popup's line, in pixels. */
const POPUP_CHAR = 15;
const POPUP_LINE = 22;
/** How fast a popup rises once it shows, in pixels a second. */
const POPUP_RISE = 36;
/** A chain: a Blast within this many seconds of the last one. And a big Blast: one that destroys at least this many fruit. */
const CHAIN_WINDOW = 1.2;
export const BIG_BLAST = 5;
/**
 * The chain (design doc, "Proposed: chains, glazes and bridge fruit"): each trigger in a turn adds one link, however many fruit it
 * affects (a merge, a blast, a Plunge's burst, a Shockwave, a sprout, a Gourd's Absorb, the Juicer's crush), and so does each
 * Simmer score at the tally. What a trigger scores is multiplied by the tier the chain has reached when it happens: x1 for links
 * 1 to 4, x2 from the 5th, x3 from the 10th, x4 from the 15th. Landings add no link: every turn has four, so they would reach x2
 * on their own. A Merge with a piece of a Smash adds none either (it still scores at the tier): a Plunge throws its pieces into
 * new merges, and counting them made Ladder run away. A blast that another set off adds `SET_OFF_LINKS`. A spill is never
 * multiplied. The chain starts again with each hand.
 */
export const CHAIN_TIERS: readonly number[] = [5, 10, 15];
/** How many links a blast that another blast set off adds: a true chain reaction (Chili into Durian into Chili) counts double. */
export const SET_OFF_LINKS = 2;

/** What a chain of this many links multiplies by: 1, then one more at each of `CHAIN_TIERS`. */
export function chainTier(links: number): number {
  return 1 + CHAIN_TIERS.filter((at) => links >= at).length;
}
/** How long a fruit stays lit up after something happens to it, in seconds. */
export const PULSE = 0.35;
/** The tally: seconds between one fruit's score and the next, the most the whole of it takes, and the pause after its last. */
const TALLY_STEP = 0.22;
const TALLY_MOST = 2.2;
const TALLY_HOLD = 0.5;
/** How long a blast's explosion (9 frames) shows, in seconds. */
export const BOOM_LIFE = 0.54;

export type Phase = "order" | "drop" | "settle" | "tally" | "pick" | "rent" | "shop" | "preserve" | "clear" | "over" | "won";

/**
 * Whether the jar's fruit are held where they are: in every phase but the drop and the settle. Once a turn is scored (the pile
 * came to rest, or `SETTLE_LIMIT` ran out) nothing in the jar moves through the tally, the pick, the rent, the shop, the
 * clear-out or the ordering of the next hand, so the pile the player looks at is the pile that was scored, and the one the next
 * hand falls on. The next drop lets it go, from rest.
 */
export function jarHeld(run: Run): boolean {
  return run.phase !== "drop" && run.phase !== "settle";
}

/** What the Juicer adds for each fruit it crushes, on top of the fruit's points. */
export const JUICER_BONUS = 3;
/** How hard the Shaker throws each fruit, at most, sideways and up (px/s). */
const SHAKE = 260;
/** How many fruit the run's keeping jar (the Preserves Jar or its upgrade) holds; 0 without one. */
export function keeps(run: Run): number {
  const jar = keepingJar(run.items);
  return jar === undefined ? 0 : (ITEMS[jar].keeps ?? 0);
}

/**
 * What the shop charges, in coins: a fruit; and, to begin with, taking a fruit out of the pool and a new shelf. Each time one is bought it
 * costs more (a new shelf by 1, a removal by `REMOVAL_STEP`), and stays at what it has reached for the rest of the run (`removalPrice`, `rerollPrice`).
 */
export const FRUIT_PRICE = 3;
export const REMOVAL_PRICE = 4;
export const REROLL_PRICE = 1;
/** How much more each removal costs than the last: thinning the pool is the strongest buy, so it climbs faster than a new shelf. */
export const REMOVAL_STEP = 2;
/** The shop's shelf: three fruit, an item and a glaze, then its three actions. `Shop.cursor` counts across all of them. */
export const SHOP_FRUITS = 3;
export const SHOP_ITEM = SHOP_FRUITS;
export const SHOP_GLAZE = SHOP_ITEM + 1;
export const SHOP_REMOVE = SHOP_GLAZE + 1;
export const SHOP_REROLL = SHOP_GLAZE + 2;
export const SHOP_LEAVE = SHOP_GLAZE + 3;

/** The shop between two cycles. */
export interface Shop {
  /** The fruit for sale; a bought one leaves a gap (null) so the others stay where they are. */
  fruits: (FruitKind | null)[];
  /** The item for sale: null once bought, or when every item is owned. */
  item: ItemKind | null;
  /** The glaze for sale: null once bought. */
  glaze: Glaze | null;
  /** Choosing which fruit the glaze bought goes on: `removeCursor` is a row of `glazeKinds`. */
  glazing: boolean;
  cursor: number;
  /** Choosing which fruit to take out of the pool: `removeCursor` is a row of `poolKinds`. */
  removing: boolean;
  removeCursor: number;
  /** A fruit has been taken out in this shop: one a shop, so thinning the pool is a choice each cycle and not all there is to buy. */
  removed: boolean;
}

export interface Fruit {
  id: number;
  kind: FruitKind;
  /** Where its component's ball starts. */
  x0: number;
  y0: number;
  /** Where it is and how fast it moves (px/s), as its component last reported. */
  x: number;
  y: number;
  r: number;
  speed: number;
  /** The ids of the fruit it touches, as last reported. */
  touching: number[];
  /** A push to give it: each time `kicks` goes up, its component adds (`kickX`, `kickY`) px/s to its velocity. */
  kicks: number;
  kickX: number;
  kickY: number;
  /** Has touched the floor or another fruit (a Fresh fruit scores then). */
  landed: boolean;
  /** Resolves survived in the jar. */
  age: number;
  rotten: boolean;
  /** Seconds left of being lit up, because something just happened to it or because of it; and seconds until that starts. */
  pulse: number;
  pulseDelay: number;
  /** Kept by a Pickling Jar: it does not age and cannot rot. */
  pickled: boolean;
  /** Frozen by a Snow Pear: its component pins its ball, so it is held where it is, and an explosion does not destroy it. */
  frozen: boolean;
  /** While it is frozen: how many turns of ice it has left (`FROZEN_TURNS` when it froze). */
  ice?: number;
  /** Coated in honey (a Honeydew, or a fruit one has honeyed): it scores at every Resolve. */
  honeyed: boolean;
  /** A Chili or Durian about to go off, and the seconds left. */
  lit: boolean;
  fuse: number;
  /** Lit by another blast (a chain of Blasts). */
  setOff?: boolean;
  /** Its glaze (glazes.ts), dealt with it from the pool. */
  glaze?: Glaze;
  /** A fruit a Spicy one's Merge made, lit: its blast spares it, and then it is a plain fruit again. */
  flare?: boolean;
  /** Made this turn by a Merge of pieces (two Slices): it cannot Merge again until the turn is scored, so merge up, smash down
   * cannot chain for ever in one settle (the design doc's loop cap). */
  remerged?: boolean;
  /** Made by a Smash: a Merge of it and another piece makes a fruit that cannot Merge again this turn (the loop cap). */
  piece?: boolean;
  /** A Pumpkin's Plunge: seconds it may still drive down (0 or absent: not plunging), and the fruit it has already hit on the way. */
  plunging?: number;
  hit?: number[];
  /** What its Plunge's Smashes have earned so far, paid at the floor in one burst. */
  burst?: number;
  /** A Gourd that has taken in a rotten fruit: the Cherries it Bursts into are rotten. */
  tainted?: boolean;
  /** A Gourd's seconds until it can take in another fruit, so each growth can be seen. */
  wait?: number;
}

export interface Popup {
  id: number;
  x: number;
  y: number;
  /** What it says: the points, after what earned them if that has a name ("Blast +14"), and "x2" if a Booster doubled them. */
  text: string;
  life: number;
  /** Seconds until it shows (the tally shows its scores one after another), and the points it stands for: until it shows, the
   * score on screen is that much behind the run's (`shownScore`). */
  delay: number;
  points: number;
  /** Drawn at twice the size: a Plunge's burst. */
  big?: boolean;
  /** A tally score's links of the chain (its own, and a Fizzy fruit's): the chain on screen counts them once it shows (`shownLinks`). */
  links?: number;
  /** Shows without a sound: the chain's line at the end of a turn. */
  quiet?: boolean;
}

/** A line drawn for a moment between two fruit, from the one that did something to the one it did it to. */
export interface Link {
  id: number;
  /** What it shows: a Booster doubling a score, rot, honey or frost spreading, a fruit being eaten, or rot a Prune scores for. */
  kind: "boost" | "rot" | "honey" | "eat" | "freeze";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Seconds left of it, and seconds until it shows (the tally shows its steps one after another). */
  life: number;
  delay: number;
}

/** Something drawn for a moment: a blast's explosion. */
export interface Effect {
  id: number;
  /** "boom": a Blast. "pop": a fruit cleared out of the jar between cycles (smaller, no flash or jolt). */
  kind: "boom" | "pop";
  x: number;
  y: number;
  /** Seconds since it started. */
  age: number;
  /** Across, in pixels. */
  size: number;
}

export interface Run {
  seed: number;
  nextId: number;
  /** The boss jar this run meets on its boss cycles. */
  boss: Boss;
  /** How many of the picks that open a run are still to be made (this one among them, while it is up): 0 once the first hand is dealt. */
  opening: number;
  /** The first game's run, played with the tutorial: its first rent is `LEARNING_RENT`. */
  learning: boolean;
  /** Every fruit you own. */
  pool: FruitKind[];
  /**
   * The glaze on each fruit of the pool (`pool`'s order), and on each still to be dealt, dealt, in the hand and dropping: the
   * same order as `draw`, `discard`, `hand` and `queue`. null for a plain fruit.
   */
  poolGlazes: (Glaze | null)[];
  drawGlazes: (Glaze | null)[];
  discardGlazes: (Glaze | null)[];
  handGlazes: (Glaze | null)[];
  queueGlazes: (Glaze | null)[];
  /** Still to be dealt this shuffle, top first. */
  draw: FruitKind[];
  /** Dealt this shuffle. */
  discard: FruitKind[];
  /** Dealt and waiting to drop; index 0 drops first. */
  hand: FruitKind[];
  cursor: number;
  /** Whether the fruit under the cursor is picked up (up and down then move it). */
  holding: boolean;
  /** Left to drop this turn. */
  queue: FruitKind[];
  dropTimer: number;
  /** Seconds since the last fruit dropped. */
  dropWait: number;
  /** The Flip jar: how many fruit have dropped this cycle, and whether its gravity is turned over now (the pile lies on the lid). */
  drops: number;
  flipped: boolean;
  fruits: Fruit[];
  phase: Phase;
  cycle: number;
  turn: number;
  cycleScore: number;
  total: number;
  /**
   * For the board at the end of the run: what this turn has scored so far, the most any turn scored, and the run's points by what
   * earned them: a fruit's name for what it scored itself ("Apple"), or the keyword for the rest ("Merge", "Explode", "Crush").
   */
  turnScore: number;
  /** How many of this tally's scores have shown so far: the first plays the lowest note, and each after it the next one up. */
  scoreNote: number;
  bestTurn: number;
  earned: Record<string, number>;
  coins: number;
  /** How many new shelves have been bought and how many fruit taken out of the pool, all run: each makes the next cost one more. */
  rerolls: number;
  removals: number;
  /** The liquid pooled at the bottom of the jar: how deep it is, in pixels, and what is in it. Lime juice floats the fruit in it;
   * Coconut milk doubles what they score. It goes when the rent empties the jar. */
  juice: number;
  lime: boolean;
  milk: boolean;
  /** What every Banana scores on top of its own points: +1 for each Fig blown up while rotten. */
  bananaBonus: number;
  /** What every Pitaya scores on top of its own points: +1 for each Cherry one has eaten. */
  pitayaBonus: number;
  /** What every Raspberry scores over its card, for those that have landed this cycle (`RASPBERRY.cluster` each): 0 again at the rent. */
  clusterBonus: number;
  /** How many fruit have grown from Pumpkin Seeds this run: every `PUMPKIN_SEED.every` of them, the next grows a size bigger. */
  pumpkinSprouts: number;
  /** The items owned, in the order they were bought. A used-up one (the Lid) is taken out. */
  items: ItemKind[];
  /** The shop, while the phase is "shop". */
  shop: Shop | null;
  /** With a Preserves Jar, after the shop: which of the jar's fruit the cursor is on (see `preservable`), and the ids kept so far. */
  preserveCursor: number;
  kept: number[];
  settleTime: number;
  /** Between cycles ("clear"): seconds since the clear-out began, how many fruit it had to pop, and the seconds between pops. */
  clearTime: number;
  clearFrom: number;
  clearGap: number;
  calmTime: number;
  /** Blasts so far in the chain going on (0 when none is), the seconds since the last, and how many fruit the last destroyed. */
  chain: number;
  /** This turn's chain (`CHAIN_TIERS`): how many links it has, the most any turn's chain has had this run, and each turn's, in order. */
  chainLinks: number;
  bestChain: number;
  chains: number[];
  /** Seeded fruit destroyed this turn: a plain one of each grows back where it was at the end of the turn (`regrowSeeded`). */
  regrowing: { kind: FruitKind; x: number; y: number }[];
  sinceBlast: number;
  blasted: number;
  /** While the tally plays: the seconds left of it, the phase that follows, and the sound that goes with that. */
  tallyTime: number;
  afterTally: Phase;
  afterSound: Sound | null;
  offers: FruitKind[];
  offerCursor: number;
  popups: Popup[];
  links: Link[];
  effects: Effect[];
  /** What the last rent paid out in coins (the points over it, and the Golden Apples), and how many of those the Golden Apples paid. */
  rentCoins: number;
  rentGolden: number;
  /**
   * One line about what just happened that the screen does not already show: a jar event, a boss's rule, why a tap did
   * nothing. What the player just did and can see done (a fruit taken, bought or taken out, a new shelf) says nothing.
   */
  message: string;
  /** Sounds to play this frame (cleared each `advance`). */
  sounds: Sound[];
}

/** "score" is one of the tally's scores showing (which one it is in the tally is `Run.scoreNote`). "tick" is the cursor going somewhere or a fruit picked up or put down; "move" a held fruit changing its place on the shelf. */
export type Sound = "land" | "merge" | "boom" | "pick" | "rent" | "lose" | "tick" | "move" | "score";

declare global {
  /** What each ball and collider tag carries, so a fruit's `contacts("fruit")` has typed `data` (the engine's `ColliderData`). */
  interface ColliderData {
    fruit: { id: number };
    peg: null;
  }
}

/** What a fruit's component reports each step. */
export interface FruitReport {
  id: number;
  x: number;
  y: number;
  speed: number;
  touching: number[];
}

/** What the run reads from the keyboard this frame. */
export interface Keys {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  /** Enter: pick up / put down in the hand, take an offer, continue. */
  confirm: boolean;
  /** Space: drop the hand, skip the pick. */
  drop: boolean;
  /**
   * The mouse came over this place, or a finger tapped it (with `confirm`): the cursor goes to it. A place is a fruit on the shelf
   * while ordering, a pick's offer, a place on the shop's shelf or one of its actions, a kind in the take-out dialog, or a fruit
   * the Preserves Jar can keep. -1 for none.
   */
  point: number;
  /** A tap or a click landed on none of those places: whatever was chosen (a pick's offer, a card in the shop) no longer is. */
  away?: boolean;
}

/** How many places on the shelf a fruit takes: 1, or 2 for a Wide one (a Pumpkin). */
export function slotsOf(kind: FruitKind): number {
  return FRUITS[kind].slots ?? 1;
}

/** Where each fruit of a hand stands on the shelf, in places from the left: the first place it takes and how many. */
export function shelfPlaces(hand: readonly FruitKind[]): { start: number; span: number }[] {
  let start = 0;
  return hand.map((kind) => {
    const place = { start, span: slotsOf(kind) };
    start += place.span;
    return place;
  });
}

/** How many places on the shelf a hand takes. */
export function handSlots(hand: readonly FruitKind[]): number {
  return hand.reduce((sum, kind) => sum + slotsOf(kind), 0);
}

export const NO_KEYS: Keys = { up: false, down: false, left: false, right: false, confirm: false, drop: false, point: -1 };

/** How many 1-of-3 picks open a run, before its first hand. */
export const OPENING_PICKS = 2;

/**
 * The starting pool: 1 Apple and 5 starters, 2–3 Cherries, 1–3 Grapes and at most 1 Orange. It was 1 Apple and 8 starters, and
 * every first cycle played alike: with nine plain fruit a pick was a small part of what was dealt, and how a hand was arranged
 * decided little. With six, and the two picks that open a run, a third of the first pool is the player's own choice (the
 * README's bots, "The opening").
 */
export function rollPool(rng: Rng): FruitKind[] {
  for (;;) {
    const cherries = rng.int(2, 3);
    const grapes = rng.int(1, 3);
    const oranges = 5 - cherries - grapes;
    if (oranges < 0 || oranges > 1) continue;
    return [
      ...Array<FruitKind>(cherries).fill("cherry"),
      ...Array<FruitKind>(grapes).fill("grape"),
      ...Array<FruitKind>(oranges).fill("orange"),
      "apple",
    ];
  }
}

/**
 * A new run. With `opening`, it starts at its opening picks, before the first hand is dealt: `OPENING_PICKS` times one fruit of
 * three, so the first hand is already partly the player's own. Without it the first hand is dealt at once (the first game's
 * tutorial, which teaches the shelf first and the pick when it comes; and the tests).
 */
export function newRun(seed: number, opening = false, learning = false): Run {
  const rng = new Rng(seed);
  const pool = rollPool(rng);
  const run: Run = {
    seed: rng.seed,
    nextId: 1,
    boss: bossFor(seed),
    opening: opening ? OPENING_PICKS : 0,
    learning,
    pool,
    draw: rng.shuffle(pool),
    discard: [],
    hand: [],
    poolGlazes: pool.map(() => null),
    drawGlazes: pool.map(() => null),
    discardGlazes: [],
    handGlazes: [],
    queueGlazes: [],
    cursor: 0,
    holding: false,
    queue: [],
    dropTimer: 0,
    dropWait: 0,
    drops: 0,
    flipped: false,
    fruits: [],
    phase: "order",
    cycle: 1,
    turn: 1,
    cycleScore: 0,
    total: 0,
    turnScore: 0,
    scoreNote: 0,
    bestTurn: 0,
    earned: {},
    coins: 0,
    rerolls: 0,
    removals: 0,
    juice: 0,
    lime: false,
    milk: false,
    bananaBonus: 0,
    pitayaBonus: 0,
    clusterBonus: 0,
    pumpkinSprouts: 0,
    items: [],
    shop: null,
    preserveCursor: 0,
    kept: [],
    settleTime: 0,
    clearTime: 0,
    clearFrom: 0,
    clearGap: 0,
    calmTime: 0,
    chain: 0,
    chainLinks: 0,
    bestChain: 0,
    chains: [],
    regrowing: [],
    sinceBlast: 0,
    blasted: 0,
    tallyTime: 0,
    afterTally: "pick",
    afterSound: null,
    offers: [],
    offerCursor: -1,
    popups: [],
    links: [],
    effects: [],
    rentCoins: 0,
    rentGolden: 0,
    message: "",
    sounds: [],
  };
  if (opening) offer(run);
  else deal(run);
  return run;
}

/** The first rent of the first game, played with the tutorial: no opening picks, and a player who does not know the fruit yet. */
export const LEARNING_RENT = 150;

/** The rent of a cycle of a run (this one, unless another is asked for). */
export function rentFor(run: Run, cycle = run.cycle): number {
  if (run.learning && cycle === 1) return LEARNING_RENT;
  return RENT[Math.min(cycle, RENT.length) - 1] as number;
}

/** A copy deep enough that `advance` can change it without touching the run it was given. */
function copy(run: Run): Run {
  return {
    ...run,
    pool: run.pool.slice(),
    draw: run.draw.slice(),
    discard: run.discard.slice(),
    hand: run.hand.slice(),
    queue: run.queue.slice(),
    poolGlazes: run.poolGlazes.slice(),
    drawGlazes: run.drawGlazes.slice(),
    discardGlazes: run.discardGlazes.slice(),
    handGlazes: run.handGlazes.slice(),
    queueGlazes: run.queueGlazes.slice(),
    fruits: run.fruits.map((f) => ({ ...f })),
    items: run.items.slice(),
    kept: run.kept.slice(),
    shop: run.shop === null ? null : { ...run.shop, fruits: run.shop.fruits.slice() },
    offers: run.offers.slice(),
    popups: run.popups.map((p) => ({ ...p })),
    links: run.links.map((l) => ({ ...l })),
    effects: run.effects.map((e) => ({ ...e })),
    chains: run.chains.slice(),
    regrowing: run.regrowing.map((r) => ({ ...r })),
    sounds: [],
  };
}

/** Shuffle fruit and their glazes together: the glazes in the same order as the fruit. */
function shuffleGlazed(rng: Rng, kinds: readonly FruitKind[], glazes: readonly (Glaze | null)[]): { kinds: FruitKind[]; glazes: (Glaze | null)[] } {
  const cards = rng.shuffle(kinds.map((kind, at) => ({ kind, glaze: glazes[at] ?? null })));
  return { kinds: cards.map((c) => c.kind), glazes: cards.map((c) => c.glaze) };
}

/**
 * A run saved before glazes had none: every fruit of it is plain. (A run is kept between launches as it was, so one from before
 * a rule was added lacks its fields.)
 */
export function withGlazes(run: Run): Run {
  const plain = (kinds: readonly FruitKind[], glazes: readonly (Glaze | null)[] | undefined) => (glazes !== undefined && glazes.length === kinds.length ? glazes.slice() : kinds.map(() => null));
  return {
    ...run,
    poolGlazes: plain(run.pool, run.poolGlazes),
    drawGlazes: plain(run.draw, run.drawGlazes),
    discardGlazes: plain(run.discard, run.discardGlazes),
    handGlazes: plain(run.hand, run.handGlazes),
    queueGlazes: plain(run.queue, run.queueGlazes),
    regrowing: run.regrowing ?? [],
    opening: run.opening ?? 0,
    learning: run.learning ?? false,
    clusterBonus: run.clusterBonus ?? 0,
    shop: run.shop === null ? null : { ...run.shop, glaze: run.shop.glaze ?? null, glazing: run.shop.glazing ?? false, removed: run.shop.removed ?? false },
  };
}

/**
 * The hand in another order (the balance bots arrange it so): each fruit keeps its glaze, a glazed one of a kind going where the
 * first of that kind goes.
 */
export function arrangeHand(run: Run, hand: readonly FruitKind[]): void {
  const left = run.hand.map((kind, at) => ({ kind, glaze: run.handGlazes[at] ?? null }));
  run.handGlazes = hand.map((kind) => {
    const at = left.findIndex((c) => c.kind === kind);
    return at < 0 ? null : (left.splice(at, 1)[0] as { glaze: Glaze | null }).glaze;
  });
  run.hand = hand.slice();
}

function deal(run: Run): void {
  const rng = new Rng(run.seed);
  run.hand = [];
  run.handGlazes = [];
  // The hand fills the shelf's places: a Wide fruit takes two. One that would not fit in the places left stays on top for the
  // next hand, and the first fruit under it that does fit is dealt instead, so the hand is short only when none left would fit.
  let used = 0;
  while (used < HAND_SIZE) {
    if (run.draw.length === 0) {
      const shuffled = shuffleGlazed(rng, run.discard, run.discardGlazes);
      run.draw = shuffled.kinds;
      run.drawGlazes = shuffled.glazes;
      run.discard = [];
      run.discardGlazes = [];
    }
    const at = run.draw.findIndex((kind) => used + slotsOf(kind) <= HAND_SIZE);
    if (at < 0) break;
    const [next] = run.draw.splice(at, 1) as [FruitKind];
    const [glaze] = run.drawGlazes.splice(at, 1);
    run.hand.push(next);
    run.handGlazes.push(glaze ?? null);
    used += slotsOf(next);
  }
  run.seed = rng.seed;
  run.cursor = 0;
  run.holding = false;
}

function sound(run: Run, name: Sound): void {
  if (!run.sounds.includes(name)) run.sounds.push(name);
}

function effect(run: Run, kind: Effect["kind"], x: number, y: number, size: number): void {
  run.effects.push({ id: run.nextId++, kind, x, y, age: 0, size });
}

/** What a score is for, when that is worth saying: the keyword that earned it, and whether a Booster doubled it. */
interface Why {
  label?: string;
  doubled?: boolean;
  /** Who the points are counted for on the end board, when not the keyword: the fruit that earned them, by name. */
  earner?: string;
  /** Its popup is drawn big (a Plunge's burst). */
  big?: boolean;
  /** Scored by a trigger of the chain: multiplied by the tier the chain is at (`chainTier`). The trigger adds its link first (`addLink`). */
  chained?: boolean;
}

/** Add points to the cycle, with a popup where it happened. Returns the popup (null for no points), so the tally can time it. */
function score(run: Run, scored: number, x: number, y: number, why: Why = {}): Popup | null {
  if (scored === 0) return null;
  // The popup shows the multiplied points: what it says is what the score went up by.
  const points = why.chained === true && scored > 0 ? scored * chainTier(run.chainLinks) : scored;
  run.cycleScore += points;
  run.total += points;
  run.turnScore += points;
  const earner = why.earner ?? why.label ?? "Other";
  run.earned[earner] = (run.earned[earner] ?? 0) + points;
  const text = `${why.label === undefined ? "" : `${why.label} `}${points > 0 ? "+" : ""}${points}${why.doubled === true ? " x2" : ""}`;
  return say(run, x, y, text, points, why.big === true);
}

/** A popup at (x, y): kept inside the jar's walls and under its rim, and moved clear of any popup already there, so two never sit on each other. */
function say(run: Run, x: number, y: number, text: string, points = 0, big = false): Popup {
  const half = Math.min((JAR.right - JAR.left) / 2, text.length * POPUP_CHAR * (big ? 2 : 1)) / 2 + 4;
  const px = Math.max(JAR.left + half, Math.min(JAR.right - half, x));
  // It rises while it shows, and should still be inside the jar when it fades: one that would start too near the rim (a pile up to
  // the top, or the Flip jar's pile lying on its lid) starts lower, over the fruit, and makes room downwards.
  const top = RIM + POPUP_RISE * POPUP_LIFE + 4;
  const step = y < top ? POPUP_LINE : -POPUP_LINE;
  let py = Math.max(y, top);
  for (let tries = 0; tries < 6 && run.popups.some((p) => Math.abs(p.x - px) < besides(p.text, text) && Math.abs(p.y - py) < POPUP_LINE); tries++) py += step;
  const popup: Popup = { id: run.nextId++, x: px, y: py, text, life: POPUP_LIFE, delay: 0, points, ...(big ? { big } : {}) };
  run.popups.push(popup);
  return popup;
}

/** How far apart two popups' middles must be to sit side by side: half of each one's width, about. */
function besides(a: string, b: string): number {
  return ((a.length + b.length) * POPUP_CHAR) / 2;
}

/** Where a popup will be, `after` seconds from now: it waits out its delay, then rises. */
function popupY(p: Popup, after: number): number {
  return p.y - POPUP_RISE * Math.max(0, after - p.delay);
}

/** Move a tally popup up until, when it shows, it is clear of those that show before it: they have been rising since they did. */
function clearOf(popup: Popup, earlier: readonly Popup[]): void {
  for (let tries = 0; tries < 8; tries++) {
    const inTheWay = earlier.find(
      (p) => popup.delay - p.delay < POPUP_LIFE && Math.abs(p.x - popup.x) < besides(p.text, popup.text) && Math.abs(popupY(p, popup.delay) - popup.y) < POPUP_LINE
    );
    if (inTheWay === undefined) return;
    popup.y = popupY(inTheWay, popup.delay) - POPUP_LINE;
  }
}

/** Whether the Blast that just went off (this step's "boom") is worth slowing down for: part of a chain, or a big one. */
export function dramatic(run: Run): boolean {
  return run.sounds.includes("boom") && (run.chain >= 2 || run.blasted >= BIG_BLAST);
}

/** The cycle's score as the screen shows it: without the points of the tally's popups still to come. */
export function shownScore(run: Run): number {
  return run.cycleScore - run.popups.reduce((sum, p) => sum + (p.delay > 0 ? p.points : 0), 0);
}

/** A trigger of the chain: one more link this turn. */
function addLink(run: Run): void {
  run.chainLinks += 1;
  run.bestChain = Math.max(run.bestChain, run.chainLinks);
}

/** The chain as the screen shows it: without the links of the tally's popups still to come. */
export function shownLinks(run: Run): number {
  return run.chainLinks - run.popups.reduce((sum, p) => sum + (p.delay > 0 ? (p.links ?? 0) : 0), 0);
}

/** Draw a line from one fruit to another for a moment. Returns it, so the tally can time it. */
function link(run: Run, kind: Link["kind"], from: Fruit, to: Fruit): Link {
  const made: Link = { id: run.nextId++, kind, x1: from.x, y1: from.y, x2: to.x, y2: to.y, life: PULSE, delay: 0 };
  run.links.push(made);
  return made;
}

/** Light a fruit up for a moment: something just happened to it, or because of it. */
function pulse(f: Fruit, delay = 0): void {
  f.pulse = PULSE;
  f.pulseDelay = delay;
}

/** Where a fruit `r` across from its middle can be made at `x`: inside the jar's walls, so one bigger than what it replaces (a
 * merge, a Gourd grown, a Giant Pumpkin) does not start in a wall. */
function inside(x: number, r: number): number {
  return Math.max(JAR.left + r, Math.min(JAR.right - r, x));
}

function makeFruit(run: Run, kind: FruitKind, x: number, y: number): Fruit {
  return {
    id: run.nextId++,
    kind,
    x0: x,
    y0: y,
    x,
    y,
    r: FRUITS[kind].radius,
    speed: 0,
    touching: [],
    kicks: 0,
    kickX: 0,
    kickY: 0,
    landed: false,
    age: 0,
    rotten: false,
    pulse: 0,
    pulseDelay: 0,
    honeyed: kind === "honeydew",
    pickled: false,
    frozen: false,
    lit: false,
    fuse: 0,
  };
}

/** For each fruit (by index), the indexes of the fruit it touches, from the reports. */
function links(fruits: readonly Fruit[]): number[][] {
  const at = new Map(fruits.map((f, i) => [f.id, i]));
  return fruits.map((f) => f.touching.map((id) => at.get(id)).filter((i): i is number => i !== undefined));
}

/** The fruit that the fruit at index `i` touches, by `links` of the same list. */
function neighbours(fruits: readonly Fruit[], links: readonly number[][], i: number): Fruit[] {
  return (links[i] ?? []).map((j) => fruits[j]).filter((o): o is Fruit => o !== undefined);
}

function onFloor(f: Fruit): boolean {
  return f.y + f.r >= JAR.floor - FLOOR_TOLERANCE;
}

/**
 * Touching the jar itself: its floor (the lid, while the Flip jar is turned over) or either wall. What an Apple's Edge asks
 * for: something the player can see, and can still get after the floor is covered.
 */
export function onEdge(run: Run, f: Fruit): boolean {
  const lying = run.flipped ? onLid(f) : onFloor(f);
  return lying || f.x - f.r <= JAR.left + FLOOR_TOLERANCE || f.x + f.r >= JAR.right - FLOOR_TOLERANCE;
}

/** Against the Flip jar's lid, which is at the rim. */
function onLid(f: Fruit): boolean {
  return f.y - f.r <= RIM + FLOOR_TOLERANCE;
}

function kick(f: Fruit, vx: number, vy: number): void {
  f.kicks += 1;
  f.kickX = vx;
  f.kickY = vy;
}

/** Whether a fruit (by index) touches a Booster, a Lemon or a Cracked Coconut: what it scores is doubled. */
function boosted(fruits: readonly Fruit[], links: readonly number[][], i: number): boolean {
  return (links[i] ?? []).some((j) => fruits[j]?.kind === "lemon");
}

/** Where the surface of the jar's liquid is, as a y on the screen: the floor when there is none. */
export function surface(run: Run): number {
  return JAR.floor - run.juice;
}

/** Whether a fruit sits in the jar's liquid: its middle is under the surface. */
export function soaked(run: Run, f: Fruit): boolean {
  return run.juice > 0 && f.y > surface(run);
}

/** Pour liquid into the jar: lime juice or Coconut milk, this deep, up to the most the jar's liquid gets. */
function pour(run: Run, what: "lime" | "milk", depth: number): void {
  run.juice = Math.min(JUICE_MOST, run.juice + depth);
  run[what] = true;
}

/** A score a fruit earned: its popup, whether a Booster doubled it, and the fruit it lit up (itself and those Boosters). */
interface Earned {
  popup: Popup;
  doubled: boolean;
  fruits: Fruit[];
  /** A line from each Booster to the fruit. */
  links: Link[];
}

/**
 * Score what a fruit (by index) earns, doubled if it touches a Booster: the popup then says "x2" and the Boosters light up too.
 * `chained`: a trigger of the chain scored it (its link added already), so the chain's tier multiplies it as well.
 */
function earn(run: Run, links: readonly number[][], i: number, points: number, label?: string, chained = false): Earned | null {
  const f = run.fruits[i];
  if (f === undefined) return null;
  // Doubled by a Lemon it touches, or by Coconut milk it sits in (once, not twice over).
  const doubled = boosted(run.fruits, links, i) || (run.milk && soaked(run, f));
  // A Fizzy fruit's score adds links of its own first, so it can lift itself to the next tier.
  const fizzy = f.glaze === "fizzy" && points > 0;
  if (fizzy) for (let k = 0; k < FIZZY_LINKS; k++) addLink(run);
  const popup = score(run, points * (doubled ? 2 : 1), f.x, f.y - f.r, { label, doubled, earner: FRUITS[f.kind].name, chained: chained || fizzy });
  if (popup === null) return null;
  if (fizzy) popup.links = (popup.links ?? 0) + FIZZY_LINKS;
  const boosters = doubled ? neighbours(run.fruits, links, i).filter((o) => o.kind === "lemon") : [];
  const fruits = [f, ...boosters];
  for (const o of fruits) pulse(o);
  return { popup, doubled, fruits, links: boosters.map((booster) => link(run, "boost", booster, f)) };
}

/** Whether a fruit (by index) touches a Lemon: a Merge it is in scores double. (It could not merge at all, once: Sour.) */
function nearLemon(fruits: readonly Fruit[], links: readonly number[][], i: number): boolean {
  return (links[i] ?? []).some((j) => fruits[j]?.kind === "lemon");
}

/** Where each fruit is, as its component reported: what the rest of the step reads. */
export function applyReports(run: Run, reports: readonly FruitReport[]): void {
  if (reports.length === 0) return;
  const byId = new Map(reports.map((r) => [r.id, r]));
  run.fruits = run.fruits.map((f) => {
    const r = byId.get(f.id);
    return r === undefined ? f : { ...f, x: r.x, y: r.y, speed: r.speed, touching: r.touching };
  });
}

export function advance(previous: Run, dt: number, keys: Keys, reports: readonly FruitReport[] = []): Run {
  const run = copy(previous);
  applyReports(run, reports);
  for (const p of run.popups) {
    if (p.delay > 0) {
      p.delay -= dt;
      // The tally's next score shows: a note for each, one step up the scale from the last (`scoreNote`), so a long tally
      // climbs. Points lost (a spill) only tick.
      if (p.delay <= 0 && p.quiet !== true) {
        if (p.points > 0) {
          run.scoreNote += 1;
          sound(run, "score");
        } else sound(run, "tick");
      }
      continue;
    }
    p.life -= dt;
    p.y -= POPUP_RISE * dt;
  }
  for (const l of run.links) {
    if (l.delay > 0) l.delay -= dt;
    else l.life -= dt;
  }
  run.links = run.links.filter((l) => l.life > 0);
  for (const f of run.fruits) {
    if (f.pulseDelay > 0) f.pulseDelay -= dt;
    else if (f.pulse > 0) f.pulse = Math.max(0, f.pulse - dt);
  }
  run.popups = run.popups.filter((p) => p.life > 0);
  run.sinceBlast += dt;
  if (run.sinceBlast > CHAIN_WINDOW) run.chain = 0;
  for (const e of run.effects) e.age += dt;
  run.effects = run.effects.filter((e) => e.age < BOOM_LIFE);

  switch (run.phase) {
    case "order":
      order(run, keys);
      break;
    case "drop":
      dropStep(run, dt);
      break;
    case "settle":
      settleStep(run, dt);
      break;
    case "tally":
      run.tallyTime -= dt;
      if (run.tallyTime <= 0) {
        run.phase = run.afterTally;
        if (run.afterSound !== null) sound(run, run.afterSound);
        run.afterSound = null;
      }
      break;
    case "pick":
      pickStep(run, keys);
      break;
    case "rent":
      // Enter only: Space also leaves the shop, so a second press of it would skip the shop unseen.
      if (keys.confirm) leaveRent(run);
      break;
    case "shop":
      shopStep(run, keys);
      break;
    case "preserve":
      preserveStep(run, keys);
      break;
    case "clear":
      clearStep(run, dt);
      break;
    case "over":
    case "won":
      break;
  }
  return run;
}

function order(run: Run, keys: Keys): void {
  const last = run.hand.length - 1;
  // In the Blind jar the hand is covered: there is nothing to choose or move, only to drop.
  const blind = bossNow(run) === "blind";
  const move = blind ? 0 : (keys.down || keys.right ? 1 : 0) - (keys.up || keys.left ? 1 : 0);
  // The cursor goes a step with the arrows, or straight to the fruit the mouse is over or a finger tapped. A held fruit goes
  // with it, past each fruit on the way, so the others keep their order: tap one fruit, then where it should stand.
  const pointed = !blind && keys.point >= 0 && keys.point <= last;
  const to = pointed ? keys.point : Math.max(0, Math.min(last, run.cursor + move));
  if (to !== run.cursor) {
    if (run.holding) {
      const held = run.hand.splice(run.cursor, 1)[0] as FruitKind;
      run.hand.splice(to, 0, held);
      const heldGlaze = run.handGlazes.splice(run.cursor, 1)[0] ?? null;
      run.handGlazes.splice(to, 0, heldGlaze);
      sound(run, "move");
    } else sound(run, "tick");
    run.cursor = to;
  }
  if (keys.confirm && !blind) {
    run.holding = !run.holding;
    sound(run, "tick");
  }
  if (keys.drop && run.hand.length > 0) {
    run.queue = run.hand;
    run.queueGlazes = run.handGlazes;
    run.hand = [];
    run.handGlazes = [];
    run.holding = false;
    run.chainLinks = 0;
    run.dropTimer = 0;
    run.dropWait = 0;
    run.calmTime = 0;
    run.phase = "drop";
    run.message = "";
  }
}

/**
 * The hand drops: the tray releases it all at once. In the Flip jar it is released in parts, and gravity turns over between them
 * once the pile has come to rest.
 */
function dropStep(run: Run, dt: number): void {
  run.dropTimer -= dt;
  run.dropWait += dt;
  const calm = run.fruits.every((f) => f.landed && f.speed < CALM_SPEED && !f.lit);
  run.calmTime = calm ? run.calmTime + dt : 0;
  const ready = run.fruits.length === 0 || run.calmTime >= DROP_CALM || run.dropWait >= DROP_LIMIT;
  const flip = bossNow(run) === "flip";
  if (run.dropTimer <= 0 && ready && run.queue.length > 0 && flip && run.drops > 0 && flipDue(run)) {
    // The Flip jar: its gravity turns over (see `flipDue`), and the pile is left to fall and come to rest before the next drop.
    run.flipped = !run.flipped;
    run.message = run.flipped ? "Gravity flips: everything falls to the lid" : "Gravity flips back";
    run.dropTimer = DROP_GAP;
    run.dropWait = 0;
    run.calmTime = 0;
  } else if (run.dropTimer <= 0 && run.queue.length > 0 && !(flip && (!ready || (run.drops > 0 && flipDue(run))))) {
    // In the Flip jar the tray waits for its gravity to turn over (above), and for the pile to come to rest after it.
    trayRelease(run, flip);
  }
  simulate(run, dt);
  // The last fruit's landing is the settle phase's to wait for.
  if (run.queue.length === 0 && run.dropTimer <= 0) {
    if (run.items.includes("shaker")) shake(run);
    run.phase = "settle";
    run.settleTime = 0;
    run.calmTime = 0;
  }
}

/**
 * Whether the Flip jar's gravity turns over before the next release of the tray: before every release but the cycle's first, so
 * the pile lies on the floor, then the lid, then the floor.
 */
function flipDue(run: Run): boolean {
  return run.flipped !== (Math.ceil(run.drops / HAND_SIZE) % 2 === 1);
}

/**
 * The tray drop (`TRAY`): every fruit left in the queue appears at once, one per lane, left to right. In the Blind jar the tray is
 * shuffled first, so the covered hand is not simply dropped as dealt.
 */
function trayRelease(run: Run, flip: boolean): void {
  if (bossNow(run) === "blind") {
    const shuffler = new Rng(run.seed);
    const shuffled = shuffleGlazed(shuffler, run.queue, run.queueGlazes);
    run.queue = shuffled.kinds;
    run.queueGlazes = shuffled.glazes;
    run.seed = shuffler.seed;
  }
  const lanes = Math.max(HAND_SIZE, handSlots(run.queue));
  const width = (JAR.right - JAR.left) / lanes;
  const places = shelfPlaces(run.queue);
  const rng = new Rng(run.seed);
  run.queue.forEach((dealt, at) => {
    const glaze = run.queueGlazes[at] ?? null;
    // A Ripe fruit lands one size bigger, as a plain fruit of that size: it has changed, so the glaze stays in the pool.
    const kind = glaze === "ripe" ? (ripened(dealt) ?? dealt) : dealt;
    const r = dealt === "gourd" && glaze === "ripe" ? (GOURD_SIZES[1] as number) : FRUITS[kind].radius;
    // A Wide fruit drops down the middle of its two lanes.
    const place = places[at] as { start: number; span: number };
    const middle = JAR.left + width * (place.start + place.span / 2);
    const x = Math.max(JAR.left + r, Math.min(JAR.right - r, middle + spot(rng, -TRAY.wobble, TRAY.wobble)));
    const y = !flip ? DROP_Y : run.flipped ? JAR.floor - r - 2 : RIM + r + 2;
    const made = makeFruit(run, kind, x, y);
    if (kind === "gourd") made.r = r;
    if (glaze !== null && glaze !== "ripe") made.glaze = glaze;
    run.fruits.push(made);
    run.drops += 1;
    run.discard.push(dealt);
    run.discardGlazes.push(glaze);
  });
  run.seed = rng.seed;
  run.queue = [];
  run.queueGlazes = [];
  run.dropTimer = DROP_GAP;
  run.dropWait = 0;
  run.calmTime = 0;
}

function settleStep(run: Run, dt: number): void {
  simulate(run, dt);
  run.settleTime += dt;
  const calm = run.fruits.every((f) => f.speed < SETTLE_SPEED) && run.fruits.every((f) => !f.lit);
  run.calmTime = calm ? run.calmTime + dt : 0;
  if (run.calmTime < CALM_TIME && run.settleTime < SETTLE_LIMIT) return;
  resolve(run);
  // Resolve has scored everything and moved on; the tally shows it happening, then hands over to where Resolve went.
  if (run.tallyTime > 0) {
    run.afterTally = run.phase;
    run.afterSound = run.sounds.includes("rent") ? "rent" : run.sounds.includes("lose") ? "lose" : null;
    run.sounds = run.sounds.filter((name) => name !== "rent" && name !== "lose");
    run.phase = "tally";
  }
}

/** The Shaker: every fruit is thrown a random way, so the pile lands differently and touches something new. */
function shake(run: Run): void {
  const rng = new Rng(run.seed);
  for (const f of run.fruits) kick(f, rng.range(-SHAKE, SHAKE), -rng.range(SHAKE / 2, SHAKE));
  run.seed = rng.seed;
  run.message = "The Shaker shakes the jar";
}

/** One frame of the jar, after the fruit reported where they are: landings, merges and blasts. */
export function simulate(run: Run, dt: number): void {
  copyKiwis(run);
  land(run);
  plungeStep(run, dt);
  merge(run);
  absorb(run, dt);
  light(run);
  burn(run, dt);
}

function land(run: Run): void {
  const near = links(run.fruits);
  const pumpkins: Fruit[] = [];
  run.fruits.forEach((f, i) => {
    if (f.landed) return;
    // On the floor, on a fruit that has landed, or come to rest afloat in lime juice.
    const afloat = run.lime && f.speed < CALM_SPEED && f.y + f.r > surface(run);
    const lying = run.flipped ? onLid(f) : onFloor(f);
    const settledOn = lying || afloat || (near[i] ?? []).some((j) => run.fruits[j]?.landed === true);
    if (!settledOn) return;
    f.landed = true;
    sound(run, "land");
    const def = FRUITS[f.kind];
    if (def.scoring === "fresh") {
      // A Raspberry scores what those before it this cycle have added, and adds its own for those after it (not a rotten one).
      const earned = earn(run, near, i, def.points + (f.kind === "raspberry" ? run.clusterBonus : 0));
      if (f.kind === "raspberry" && !f.rotten) run.clusterBonus += RASPBERRY.cluster;
      // Landing is the commonest score: only a doubled one lights anything up.
      if (earned !== null && !earned.doubled) f.pulse = 0;
    }
    if (lying && f.kind !== "peach") {
      // A fruit that lands on the floor (the lid, turned over) hops once, a little, so it does not just stop dead.
      kick(f, 0, run.flipped ? FLOOR_BOUNCE : -FLOOR_BOUNCE);
    }
    if (f.kind === "peach") {
      // It bounces once, and shoves what it landed on away to each side: each fruit shoved is a link of the chain, so a Peach
      // dropped into a crowd lifts the chain before the merges it shakes loose are scored.
      kick(f, 0, -PEACH_BOUNCE);
      for (const o of neighbours(run.fruits, near, i)) {
        kick(o, (o.x < f.x ? -1 : 1) * PEACH_SHOVE, -PEACH_SHOVE / 3);
        if (!f.rotten) for (let k = 0; k < PEACH_LINKS; k++) addLink(run);
      }
    }
    // A Dense fruit lands as that many links: a Blueberry is three.
    if (FRUITS[f.kind].touchWeight > 1 && !f.rotten) for (let k = 0; k < FRUITS[f.kind].touchWeight; k++) addLink(run);
    // A Coconut landing on a Coconut cracks the one under it.
    if (f.kind === "coconut") crack(run, neighbours(run.fruits, near, i).filter((o) => o.kind === "coconut" && o.landed && o !== f && o.y > f.y), "A Coconut cracked a Coconut");
    if (f.kind === "pumpkin") pumpkins.push(f);
  });
  for (const p of pumpkins) if (run.fruits.includes(p)) plunge(run, p);
}

/** A Pumpkin has landed: it does not stop there, but drives down through the pile (`plungeStep`). */
function plunge(run: Run, pumpkin: Fruit): void {
  pumpkin.plunging = PLUNGE_LIMIT;
  pumpkin.hit = [];
  pumpkin.burst = 0;
  pulse(pumpkin);
  run.message = "A Pumpkin Plunges";
}

/**
 * The Plunge: the most seconds it drives down; the share of its Smashes' points it pays, all at once at the floor (tuned with the
 * balance bots: at 75% a Pumpkin and Melon build scores a little above a Durian or a Melon one, and clears the last rent no more
 * often); how hard it throws what it hits (sideways and up, px/s); and how far round it the floor's shove reaches (px past
 * touching) and how hard. Its ball's drive speed and weight are the component's (`PLUNGE_SPEED` in Fruit.tsx).
 */
export const PLUNGE_LIMIT = 1.2;
export const PLUNGE_PAY = 0.75;
export const PLUNGE_THROW = { side: 300, up: 260 };
export const PLUNGE_SHOVE = { reach: 36, push: 280 };

/**
 * One step of each plunging Pumpkin: each fruit it touches that it has not hit yet is hit once. A Grape, Orange, Melon or
 * Watermelon is Smashed and its pieces thrown out, and what they are worth (`PLUNGE_PAY` of it) is kept for the burst; anything
 * else is thrown aside and up, away from its middle. A frozen fruit holds, and stops it. At the floor (the lid, turned over), or
 * once its time is up, it stops, shoves what is round it, and scores the burst in one popup.
 */
function plungeStep(run: Run, dt: number): void {
  const plungers = run.fruits.filter((f) => (f.plunging ?? 0) > 0);
  if (plungers.length === 0) return;
  for (const p of plungers) {
    if (!run.fruits.includes(p)) continue;
    p.plunging = (p.plunging ?? 0) - dt;
    const hit = p.hit ?? [];
    const touched = run.fruits.filter((o) => p.touching.includes(o.id) && !hit.includes(o.id));
    const born: Fruit[] = [];
    const gone: Fruit[] = [];
    for (const o of touched) {
      hit.push(o.id);
      if (o.frozen) {
        // Ice holds: the Plunge stops on it.
        p.plunging = 0;
        continue;
      }
      // An Anchored fruit is neither Smashed nor thrown: the Plunge goes on past it.
      if (o.kind === "giantpumpkin" || o.kind === "pumpkin" || o.glaze === "anchored") continue;
      // A Coconut it drives into cracks open at once.
      if (o.kind === "coconut") {
        crack(run, [o], "A Pumpkin cracked a Coconut");
        continue;
      }
      const side = o.x === p.x ? (o.id % 2 === 0 ? 1 : -1) : Math.sign(o.x - p.x);
      if (smashable(o)) {
        p.burst = (p.burst ?? 0) + Math.round(smashWorth(o) * PLUNGE_PAY);
        const pieces = smash(run, o, false);
        for (const piece of pieces) {
          hit.push(piece.id);
          const out = piece.x === o.x ? side : Math.sign(piece.x - o.x);
          kick(piece, (out * 0.6 + side * 0.4) * PLUNGE_THROW.side, -PLUNGE_THROW.up);
        }
        born.push(...pieces);
        gone.push(o);
      } else {
        kick(o, side * PLUNGE_THROW.side, -PLUNGE_THROW.up);
        pulse(o);
      }
    }
    p.hit = hit;
    if (gone.length > 0) {
      run.fruits = [...run.fruits.filter((f) => !gone.includes(f)), ...born];
      sound(run, "merge");
    }
    const down = run.flipped ? onLid(p) : onFloor(p);
    if (down || (p.plunging ?? 0) <= 0) {
      // Down: what is round it is shoved away.
      p.plunging = 0;
      for (const o of run.fruits) {
        if (o === p || o.frozen || o.glaze === "anchored") continue;
        const dx = o.x - p.x;
        const dy = o.y - p.y;
        const d = Math.max(1, Math.hypot(dx, dy));
        if (d > p.r + o.r + PLUNGE_SHOVE.reach) continue;
        kick(o, (dx / d) * PLUNGE_SHOVE.push, -Math.abs(dy / d) * PLUNGE_SHOVE.push - 80);
      }
      pulse(p);
      sound(run, "land");
      if ((p.burst ?? 0) > 0) {
        // The burst: all its Smashes' points at once, where it came down, big and with no name (it would not fit the jar). They are
        // the Pumpkin's own, so the end board shows it among the fruit that scored.
        addLink(run);
        score(run, p.burst ?? 0, p.x, p.y - p.r, { earner: FRUITS.pumpkin.name, big: true, chained: true });
        p.burst = 0;
        effect(run, "boom", p.x, p.y, p.r * 3);
        sound(run, "boom");
      }
    }
  }
}

/** An Exploded Pumpkin Seed's fruit (`pumpkinSprout`), where the Seed was, already landed, scoring its points as it is made (nothing if the Seed was rotten). */
function pumpkinGrow(run: Run, seed: Fruit): Fruit {
  const kind = pumpkinSprout(run.pumpkinSprouts);
  run.pumpkinSprouts += 1;
  const grown = makeFruit(run, kind, inside(seed.x, FRUITS[kind].radius), seed.y);
  grown.landed = true;
  // A Sprout is a trigger of its own, set off by the blast.
  addLink(run);
  if (!seed.rotten) score(run, FRUITS[kind].points, seed.x, seed.y - seed.r, { label: "Sprout", earner: FRUITS.pumpkinseed.name, chained: true });
  return grown;
}

/** A Golden Apple pays its coins (nothing while it is rotten), with a popup where it was. */
function payGolden(run: Run, f: Fruit): number {
  if (f.kind !== "goldenapple" || f.rotten) return 0;
  run.coins += GOLDEN;
  say(run, f.x, f.y - f.r, `+${GOLDEN} coins`);
  return GOLDEN;
}

/** What a Smashed Grape, Orange or Melon breaks into two of (a Watermelon breaks into Slices). */
const SMASH_INTO: Readonly<Partial<Record<FruitKind, FruitKind>>> = { melon: "orange", orange: "grape", grape: "cherry" };

/** Whether a Smash breaks this fruit into pieces: a Grape, Orange, Melon or Watermelon. */
function smashable(f: Fruit): boolean {
  return f.kind === "watermelon" || SMASH_INTO[f.kind] !== undefined;
}

/**
 * A Seeded fruit destroyed: a plain one of its kind grows back where it was at the end of the turn (`regrowSeeded`). Growing
 * back at once let a Seeded Chili go off again in the same settle, which made Boom a third stronger with the bots.
 */
function regrow(run: Run, f: Fruit): void {
  run.regrowing.push({ kind: f.kind, x: f.x, y: f.y });
}

/** The end of the turn: each Seeded fruit destroyed in it grows back, plain and landed. Each is a Sprout, so a link of the chain. */
function regrowSeeded(run: Run, tally: Tally): void {
  for (const r of run.regrowing) {
    const grown = makeFruit(run, r.kind, inside(r.x, FRUITS[r.kind].radius), r.y);
    grown.landed = true;
    addLink(run);
    stage(tally, null, [grown], []);
    run.fruits.push(grown);
  }
  if (run.regrowing.length > 0) run.message = `Seeded: ${run.regrowing.length === 1 ? "a fruit grows" : `${run.regrowing.length} fruit grow`} back`;
  run.regrowing = [];
}

/** A Seed's Sprout: a Cherry, Grape or Orange where it was, already landed. */
function sprout(run: Run, seed: Fruit): Fruit {
  const rng = new Rng(run.seed);
  const grown = makeFruit(run, rng.pick(SPROUTS), seed.x, seed.y);
  run.seed = rng.seed;
  grown.landed = true;
  // A Sprout is a trigger of its own, set off by the blast.
  addLink(run);
  return grown;
}

/** What a Smash of this fruit is worth, as its pieces are made: nothing if it is rotten. */
function smashWorth(w: Fruit): number {
  if (w.rotten) return 0;
  if (w.kind === "watermelon") return SLICES * FRUITS.slice.points;
  const into = SMASH_INTO[w.kind];
  return into === undefined ? 0 : 2 * FRUITS[into].points;
}

/**
 * A fruit Smashed (by a Pumpkin's Plunge or a Giant Pumpkin's Shockwave; a Watermelon by an explosion too): a Grape, Orange or
 * Melon breaks into 2 of the next size down, a Watermelon into `SLICES` Slices, where it was and already landed. They score as
 * they are made (`scores`; a Plunge keeps their worth for its burst instead), multiplied by the chain: a Smash is part of the
 * trigger that made it (a Shockwave, a blast), which has added its link. The caller takes the fruit out.
 */
function smash(run: Run, w: Fruit, scores = true): Fruit[] {
  const into = SMASH_INTO[w.kind];
  if (w.kind !== "watermelon" && into !== undefined) {
    // Two of the next size down, side by side where it was.
    const pieces = [-1, 1].map((side) => {
      const f = makeFruit(run, into, inside(w.x + side * w.r * 0.45, FRUITS[into].radius), w.y);
      Object.assign(f, { landed: true, rotten: w.rotten, piece: true });
      pulse(f);
      return f;
    });
    if (!w.rotten && scores) score(run, 2 * FRUITS[into].points, w.x, w.y - w.r, { label: "Smash", chained: true });
    return pieces;
  }
  const out: Fruit[] = [];
  for (let k = 0; k < SLICES; k++) {
    const angle = (k / SLICES) * Math.PI * 2 + Math.PI / 4;
    const f = makeFruit(run, "slice", w.x + Math.cos(angle) * w.r * 0.45, w.y + Math.sin(angle) * w.r * 0.45);
    f.landed = true;
    f.rotten = w.rotten;
    f.piece = true;
    pulse(f);
    out.push(f);
  }
  if (!w.rotten && scores) score(run, SLICES * FRUITS.slice.points, w.x, w.y - w.r, { label: "Slice", earner: FRUITS.slice.name, chained: true });
  return out;
}

/** How hard a fruit hops when it lands on the floor (px/s): about 8 px up. Landing on another fruit, it does not. */
const FLOOR_BOUNCE = 140;
/** How hard a Peach bounces when it lands, and shoves each fruit it landed on sideways (px/s). */
/** How many links of the chain each fruit a Peach shoves is worth. */
export const PEACH_LINKS = 2;
const PEACH_BOUNCE = 380;
const PEACH_SHOVE = 180;

/** A Kiwi touching a landed fruit of another kind becomes a copy of it: a new fruit where it was, which lands and scores as one. */
function copyKiwis(run: Run): void {
  const near = links(run.fruits);
  run.fruits = run.fruits.map((f, i) => {
    if (f.kind !== "kiwi") return f;
    const on = neighbours(run.fruits, near, i).find((o) => o.landed && o.kind !== "kiwi" && o.kind !== "giantpumpkin");
    if (on === undefined) return f;
    // It copies the glaze too; its own, if it had one, goes with what it was.
    const copied = makeFruit(run, on.kind, f.x, f.y);
    if (on.glaze !== undefined) copied.glaze = on.glaze;
    return copied;
  });
}

function canMerge(f: Fruit): boolean {
  return f.landed && f.remerged !== true && !f.lit && (FRUITS[f.kind].mergesInto !== undefined || f.kind === "pomegranate");
}

function merge(run: Run): void {
  const near = links(run.fruits);
  const gone = new Set<number>();
  const born: Fruit[] = [];
  const giants: Fruit[] = [];
  for (const [i, a] of run.fruits.entries()) {
    if (gone.has(a.id) || !canMerge(a)) continue;
    for (const j of near[i] ?? []) {
      const b = run.fruits[j];
      if (b === undefined || j <= i || gone.has(b.id) || b.kind !== a.kind || !canMerge(b)) continue;
      // A Merge touching a Lemon scores double, as what lands or simmers beside one does.
      const lemoned = nearLemon(run.fruits, near, i) || nearLemon(run.fruits, near, j);
      gone.add(a.id);
      gone.add(b.id);
      // A Smash's pieces merging are part of the Smash: no link of their own.
      if (a.piece !== true && b.piece !== true) addLink(run);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      if (a.kind === "watermelon") {
        // A Giant Pumpkin: it scores big, its Shockwave throws the pile aside (below, once the merges are done), and soon it is gone.
        const giant = makeFruit(run, "giantpumpkin", inside(mx, FRUITS.giantpumpkin.radius), my);
        giant.landed = true;
        giant.lit = true;
        giant.fuse = GIANT_LIFE;
        pulse(giant);
        born.push(giant);
        giants.push(giant);
        score(run, FRUITS.giantpumpkin.points * (lemoned ? 2 : 1), mx, my - giant.r, { label: "Merge", earner: FRUITS.giantpumpkin.name, chained: true, doubled: lemoned });
        run.message = `Two Watermelons: a Giant Pumpkin! +${FRUITS.giantpumpkin.points}`;
      } else if (a.kind === "pomegranate") {
        born.push(...burst(run, mx, my));
        run.message = "Pomegranates Burst!";
      } else {
        // A Merge that touches a Dragonfruit skips a size, when there is one to skip to.
        const next = FRUITS[a.kind].mergesInto as FruitKind;
        const dragon = [...neighbours(run.fruits, near, i), ...neighbours(run.fruits, near, j)].find((o) => o.kind === "dragonfruit");
        // A Giant Pumpkin is only ever made by two Watermelons: a Skip stops at the Watermelon.
        const skipped = FRUITS[next].mergesInto;
        const into = dragon === undefined || skipped === undefined || skipped === "giantpumpkin" ? next : skipped;
        if (dragon !== undefined) pulse(dragon);
        const f = makeFruit(run, into, inside(mx, FRUITS[into].radius), my);
        f.landed = true;
        // Rot does not stop a Merge, and a Merge does not cut it out.
        f.rotten = f.rotten || a.rotten || b.rotten;
        // Made from pieces of a Smashed Watermelon: it has re-merged once, and waits for the next turn to Merge again.
        f.remerged = a.piece === true || b.piece === true;
        // A Spicy fruit's Merge goes off: what it made is lit, and its blast spares it.
        if (a.glaze === "spicy" || b.glaze === "spicy") {
          f.lit = true;
          f.fuse = SPICY.fuse;
          f.flare = true;
        }
        pulse(f);
        born.push(f);
        score(run, FRUITS[into].points * (lemoned ? 2 : 1), mx, my - f.r, { label: "Merge", chained: true, doubled: lemoned });
      }
      break;
    }
  }
  if (gone.size > 0) {
    run.fruits = [...run.fruits.filter((f) => !gone.has(f.id)), ...born];
    sound(run, "merge");
  }
  for (const giant of giants) shockwave(run, giant);
}

/** How long a Giant Pumpkin stays before it vanishes, in seconds; how far its Shockwave reaches, and how hard it throws, in px/s. */
export const GIANT_LIFE = 0.9;
export const SHOCK_RADIUS = 130;
const SHOCK_PUSH = 520;

/** A Giant Pumpkin's Shockwave: every fruit near it is thrown away from it (frozen ones hold), and each Watermelon caught is Smashed. */
function shockwave(run: Run, giant: Fruit): void {
  const caught = run.fruits.filter((f) => f !== giant && Math.hypot(f.x - giant.x, f.y - giant.y) < SHOCK_RADIUS + f.r);
  const smashed = caught.filter((f) => smashable(f) && !f.frozen && f.glaze !== "anchored");
  // The Shockwave is a trigger of its own, set off by the Merge, when it Smashes something.
  if (smashed.length > 0) addLink(run);
  const born = smashed.flatMap((w) => smash(run, w));
  run.fruits = [...run.fruits.filter((f) => !smashed.includes(f)), ...born];
  for (const f of run.fruits) {
    if (f === giant || f.frozen || f.glaze === "anchored") continue;
    const dx = f.x - giant.x;
    const dy = f.y - giant.y;
    const d = Math.max(1, Math.hypot(dx, dy));
    if (d > SHOCK_RADIUS + f.r) continue;
    const push = SHOCK_PUSH * (1 - d / (SHOCK_RADIUS * 1.5));
    kick(f, (dx / d) * push, (dy / d) * push - 160);
  }
  effect(run, "boom", giant.x, giant.y, SHOCK_RADIUS * 2);
  sound(run, "boom");
  if (smashed.length > 0) run.message = `A Giant Pumpkin! Its Shockwave Smashes ${smashed.length === 1 ? "a Watermelon" : `${smashed.length} Watermelons`}`;
}

/** How long a Gourd waits after taking in a fruit before it can take in another, in seconds. */
const GOURD_WAIT = 0.3;

/**
 * Each landed Gourd takes in one fruit it touches that is no bigger than it is, scoring that fruit's points (nothing if rotten),
 * and grows a size: Cherry, Grape, Orange. Grown past an Orange (Melon size) it Bursts into `GOURD_BURST` Cherries, rotten if it
 * took in anything rotten. A grown Gourd is a new fruit, as a merge makes one, so its ball is made at its new size.
 */
function absorb(run: Run, dt: number): void {
  if (!run.fruits.some((f) => f.kind === "gourd")) return;
  const near = links(run.fruits);
  const gone = new Set<number>();
  const born: Fruit[] = [];
  run.fruits.forEach((f, i) => {
    if (f.kind !== "gourd" || gone.has(f.id)) return;
    if ((f.wait ?? 0) > 0) {
      f.wait = (f.wait ?? 0) - dt;
      return;
    }
    if (!f.landed || f.frozen) return;
    const meal = neighbours(run.fruits, near, i).find((o) => !gone.has(o.id) && o.landed && o.kind !== "gourd" && o.kind !== "giantpumpkin" && !o.frozen && !o.lit && o.r <= f.r + 0.5);
    if (meal === undefined) return;
    gone.add(meal.id);
    gone.add(f.id);
    const value = meal.rotten || FRUITS[meal.kind].scoring === "booster" ? 0 : FRUITS[meal.kind].points;
    addLink(run);
    earn(run, near, i, value, "Absorb", true);
    link(run, "eat", f, meal);
    const tainted = f.tainted === true || meal.rotten;
    const next = GOURD_SIZES.find((size) => size > f.r + 0.5);
    if (next === undefined) {
      const cherries = burst(run, f.x, f.y, GOURD_BURST);
      for (const c of cherries) c.rotten = tainted;
      born.push(...cherries);
      run.message = `A Gourd reached Melon size: Burst ${GOURD_BURST}${tainted ? ", rotten" : ""}`;
      sound(run, "merge");
      return;
    }
    const grown = makeFruit(run, "gourd", inside(f.x, next), f.y);
    Object.assign(grown, { r: next, landed: true, wait: GOURD_WAIT, tainted, age: f.age, honeyed: f.honeyed, pickled: f.pickled });
    pulse(grown);
    born.push(grown);
    run.message = "A Gourd Absorbs a fruit and grows";
  });
  if (gone.size > 0) run.fruits = [...run.fruits.filter((f) => !gone.has(f.id)), ...born];
}

/** Cherries where a Pomegranate (five) or a Gourd was, already landed (they were in the pile). */
function burst(run: Run, x: number, y: number, count = 5): Fruit[] {
  const out: Fruit[] = [];
  for (let k = 0; k < count; k++) {
    const angle = (k / count) * Math.PI * 2;
    const f = makeFruit(run, "cherry", x + Math.cos(angle) * 8, y + Math.sin(angle) * 8);
    f.landed = true;
    out.push(f);
  }
  return out;
}

/** Light the fuse of a Chili touching 4+ fruit, or a Durian with 3+ fruit stacked on it. */
function light(run: Run): void {
  const near = links(run.fruits);
  run.fruits.forEach((f, i) => {
    if (f.lit || !f.landed) return;
    if (f.kind === "chili") {
      const touched = neighbours(run.fruits, near, i);
      const weight = touched.reduce((sum, o) => sum + FRUITS[o.kind].touchWeight, 0);
      if (weight >= 4) {
        ignite(f, 0.3);
        // What set it off lights up.
        for (const o of touched) pulse(o);
      }
    } else if (f.kind === "durian") {
      const above = run.fruits.filter((o) => o !== f && o.landed && o.y < f.y - f.r * 0.5 && Math.abs(o.x - f.x) < f.r + o.r);
      if (above.length >= 3) {
        ignite(f, 0.3);
        for (const o of above) pulse(o);
      }
    }
  });
}

function ignite(f: Fruit, seconds: number): void {
  f.lit = true;
  f.fuse = seconds;
  f.landed = true;
}

function burn(run: Run, dt: number): void {
  for (const f of run.fruits) if (f.lit) f.fuse -= dt;
  const ready = run.fruits.filter((f) => f.lit && f.fuse <= 0);
  for (const bomb of ready) {
    if (!run.fruits.includes(bomb)) continue;
    if (bomb.kind === "giantpumpkin") {
      // Its time is up: it is gone, and leaves room in the jar.
      run.fruits = run.fruits.filter((f) => f !== bomb);
      effect(run, "pop", bomb.x, bomb.y, bomb.r * 2);
      sound(run, "merge");
    } else explode(run, bomb);
  }
}

export const BLAST_RADIUS: Readonly<Partial<Record<FruitKind, number>>> = { chili: 52, durian: 80 };
/** What a blast scores for each fruit it destroys, on top of the fruit's own points: a blast ends what they would have merged into. */
export const BLAST_BONUS: Readonly<Partial<Record<FruitKind, number>>> = { chili: 10, durian: 14 };

function explode(run: Run, bomb: Fruit): void {
  const spicy = bomb.flare === true;
  const radius = spicy ? SPICY.radius : (BLAST_RADIUS[bomb.kind] ?? 48);
  const bonus = spicy ? SPICY.bonus : (BLAST_BONUS[bomb.kind] ?? 0);
  // One link for the blast, however many fruit it destroys; what it sets off (a Sprout, another blast) adds its own.
  // A blast another set off counts double.
  for (let k = 0; k < (bomb.setOff === true ? SET_OFF_LINKS : 1); k++) addLink(run);
  const near = links(run.fruits);
  const doubled = new Set(run.fruits.filter((_, i) => boosted(run.fruits, near, i)).map((f) => f.id));
  const victims: Fruit[] = [];
  const kept: Fruit[] = [];
  const born: Fruit[] = [];
  let points = 0;
  let limes = 0;
  let coconuts = 0;
  for (const f of run.fruits) {
    if (f === bomb) continue;
    const dx = f.x - bomb.x;
    const dy = f.y - bomb.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > radius + f.r * 0.5) {
      kept.push(f);
      continue;
    }
    if (f.frozen) {
      // Ice holds: it is not destroyed, and being pinned it is not thrown either.
      kept.push(f);
      continue;
    }
    if (f.kind === "giantpumpkin") {
      kept.push(f);
      continue;
    }
    if (f.kind === "chili" || f.kind === "durian") {
      // Caught in the blast: it goes off a moment later (a chain).
      if (!f.lit) {
        ignite(f, 0.15);
        f.setOff = true;
      }
      kept.push(f);
      continue;
    }
    victims.push(f);
    // A Watermelon is Smashed: its Slices score in its place. (Blasts that Smashed every fruit that can be were tried, and made
    // Boom builds 17% stronger.)
    const smashing = f.kind === "watermelon";
    const value = FRUITS[f.kind].scoring === "booster" || f.rotten || smashing ? 0 : FRUITS[f.kind].points;
    if (smashing) born.push(...smash(run, f));
    points += (value + bonus) * (doubled.has(f.id) ? 2 : 1);
    if (f.glaze === "seeded") regrow(run, f);
    if (f.kind === "pomegranate") born.push(...burst(run, f.x, f.y));
    if (f.kind === "lime") limes += 1;
    if (f.kind === "coconut") coconuts += 1;
    if (f.kind === "seed") born.push(sprout(run, f));
    if (f.kind === "pumpkinseed") born.push(pumpkinGrow(run, f));
    payGolden(run, f);
  }
  // The blast pushes what is left away from it.
  for (const f of kept) {
    if (f.frozen) continue;
    const dx = f.x - bomb.x;
    const dy = f.y - bomb.y;
    const d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    if (d > radius * 2) continue;
    const push = 320 * (1 - d / (radius * 2));
    kick(f, (dx / d) * push, (dy / d) * push - 80);
  }
  if (spicy) {
    // A Spicy Merge's blast: the fruit it made stays, a plain fruit now.
    bomb.lit = false;
    bomb.flare = false;
    kept.push(bomb);
  } else if (bomb.glaze === "seeded") regrow(run, bomb);
  run.fruits = [...kept, ...born];
  score(run, points, bomb.x, bomb.y - radius / 2, { label: "Explode", chained: true });
  run.chain += 1;
  run.sinceBlast = 0;
  run.blasted = victims.length;
  effect(run, "boom", bomb.x, bomb.y, radius * 2);
  sound(run, "boom");
  run.message = spicy ? `A Spicy Merge Exploded: ${victims.length} fruit destroyed` : `${FRUITS[bomb.kind].name} Exploded: ${victims.length} fruit destroyed`;
  // A Chili's blast is a link for each fruit it destroys, as well as its own: in a crowd it lifts the chain for the merges
  // that follow it, where a Durian's bigger blast scores more for each.
  if (bomb.kind === "chili" && !spicy) for (let k = 0; k < victims.length; k++) addLink(run);
  // A Coconut blown open leaves its milk, as one that cracked by itself does.
  if (coconuts > 0) {
    pour(run, "milk", coconuts * COCONUT_MILK);
    run.message = `${FRUITS[bomb.kind].name} cracked ${coconuts === 1 ? "a Coconut" : `${coconuts} Coconuts`}: milk in the jar`;
  }
  if (limes > 0) {
    pour(run, "lime", limes * LIME_JUICE);
    run.message = `${FRUITS[bomb.kind].name} Exploded ${limes === 1 ? "a Lime" : `${limes} Limes`}: lime juice rises`;
  }
}

/** What the tally shows one after another: each popup and each fruit to light up, with its place in the order. */
interface Tally {
  steps: { popup: Popup | null; fruits: Fruit[]; links: Link[]; slot: number }[];
  slot: number;
}

/** Add one thing to the tally, in the next place of its order. */
function stage(tally: Tally, popup: Popup | null, fruits: Fruit[], links: Link[]): void {
  tally.slot += 1;
  tally.steps.push({ popup, fruits, links, slot: tally.slot });
}

/** What is over the rim spills out, -5 each; the Flip jar has its lid on, and the Lid holds them in once. */
function spillOver(run: Run): void {
  const spilled = bossNow(run) === "flip" ? [] : run.fruits.filter((f) => f.y - f.r < RIM);
  if (spilled.length > 0 && run.items.includes("lid")) {
    // The Lid holds them in, once: nothing spills and nothing is lost, and the Lid is used up.
    run.items = run.items.filter((item) => item !== "lid");
    run.message = `The Lid stopped a Spill of ${spilled.length}. It is used up`;
  } else if (spilled.length > 0) {
    run.fruits = run.fruits.filter((f) => f.y - f.r >= RIM);
    for (const f of spilled) score(run, -OVERFLOW_PENALTY, f.x, RIM - 12, { label: "Spill" });
    run.message = `Spill: ${spilled.length} fruit lost, -${spilled.length * OVERFLOW_PENALTY}`;
  }
}

/** The Juicer crushes what stands on the floor: each scores its points (nothing if rotten) and a bonus, and is gone. */
function juicerCrush(run: Run): void {
  if (!run.items.includes("juicer")) return;
  const crushed = run.fruits.filter((f) => f.landed && onFloor(f));
  // One link for the Juicer's crush, however many fruit it takes.
  if (crushed.length > 0) addLink(run);
  for (const f of crushed) {
    score(run, (f.rotten ? 0 : FRUITS[f.kind].points) + JUICER_BONUS, f.x, f.y - f.r, { label: "Crush", chained: true });
    payGolden(run, f);
  }
  if (crushed.length === 0) return;
  for (const f of crushed) if (f.glaze === "seeded") regrow(run, f);
  run.fruits = run.fruits.filter((f) => !crushed.includes(f));
  run.message = `Juicer: ${crushed.length} fruit Crushed`;
  const limes = crushed.filter((f) => f.kind === "lime").length;
  if (limes > 0) {
    pour(run, "lime", limes * LIME_JUICE);
    run.message = `Juicer: ${crushed.length} fruit Crushed. Lime juice rises`;
  }
}

/** The merge ladder's sizes, smallest first: how big a fruit is, as the Quince counts it. */
const LADDER: readonly FruitKind[] = ["cherry", "grape", "orange", "melon", "watermelon"];

/** A fruit's size on the merge ladder, 1 (Cherry) to 5 (Watermelon): the biggest ladder fruit it is at least as big as, 0 if smaller than a Cherry. */
export function sizeStep(f: Fruit): number {
  return LADDER.filter((kind) => f.r + 0.5 >= FRUITS[kind].radius).length;
}

/** Simmer fruit, Prunes and honeyed fruit score. */
function simmer(run: Run, tally: Tally): void {
  const near = links(run.fruits);
  run.fruits.forEach((f, i) => {
    const touched = neighbours(run.fruits, near, i);
    let points = 0;
    if (f.kind === "prune") {
      // Dried, not rotten: it scores for the rot around it, and makes none.
      // (A Dense one counts as that many.)
      points = FRUITS.prune.points * touched.filter((o) => o.rotten).reduce((sum, o) => sum + FRUITS[o.kind].touchWeight, 0);
    } else if (f.rotten) {
      return;
    } else if (f.kind === "apple") {
      points = APPLE.base + (onEdge(run, f) ? APPLE.edge : 0);
    } else if (f.kind === "banana") {
      points = BANANA.base + f.age * BANANA.ripen + run.bananaBonus;
    } else if (f.kind === "pitaya") {
      points = FRUITS.pitaya.points + run.pitayaBonus;
    } else if (f.kind === "quince") {
      // By the size of the biggest fruit it touches: a Cherry 1, up to a Watermelon (or bigger) 5.
      points = QUINCE.perSize * Math.max(0, ...touched.map((o) => sizeStep(o)));
    }
    if (f.honeyed) points += HONEY_POINTS;
    // Each Simmer score is a link of the chain, so a garden reaches the tiers at its tally.
    if (points > 0) addLink(run);
    const earned = earn(run, near, i, points, undefined, true);
    if (earned === null) return;
    earned.popup.links = (earned.popup.links ?? 0) + 1;
    // A Prune's score is for the rot round it: a line from each rotten neighbour.
    const rot = f.kind === "prune" ? touched.filter((o) => o.rotten).map((o) => link(run, "rot", o, f)) : [];
    stage(tally, earned.popup, earned.fruits, [...earned.links, ...rot]);
  });
}

/** Each Fruit Fly eats one rotten fruit it touches (never a Prune) and a new Fly hatches where it was. */
function fruitFliesEat(run: Run, tally: Tally): void {
  const near = links(run.fruits);
  const eaten = new Set<number>();
  const hatched: Fruit[] = [];
  run.fruits.forEach((f, i) => {
    if (f.kind !== "fruitfly") return;
    const meal = neighbours(run.fruits, near, i).find((o) => o.rotten && o.kind !== "prune" && !eaten.has(o.id));
    if (meal === undefined) return;
    eaten.add(meal.id);
    addLink(run);
    const earned = earn(run, near, i, FRUITS.fruitfly.points, "Eat", true);
    if (earned !== null) earned.popup.links = (earned.popup.links ?? 0) + 1;
    stage(tally, earned?.popup ?? null, earned?.fruits ?? [f], [link(run, "eat", f, meal), ...(earned?.links ?? [])]);
    const fly = makeFruit(run, "fruitfly", meal.x, meal.y);
    fly.landed = true;
    hatched.push(fly);
  });
  if (eaten.size > 0) {
    run.fruits = [...run.fruits.filter((f) => !eaten.has(f.id)), ...hatched];
    run.message = `Fruit Flies Eat ${eaten.size} Rotten fruit`;
  }
}

/** Each Pitaya eats one Cherry it touches, and every Pitaya scores 1 more from then on. */
function pitayasEat(run: Run, tally: Tally): void {
  const swallowed = new Set<number>();
  for (const f of run.fruits) {
    if (f.kind !== "pitaya" || f.rotten) continue;
    const cherry = run.fruits.find((o) => o.kind === "cherry" && !swallowed.has(o.id) && f.touching.includes(o.id));
    if (cherry === undefined) continue;
    swallowed.add(cherry.id);
    run.pitayaBonus += 1;
    stage(tally, null, [f], [link(run, "eat", f, cherry)]);
  }
  if (swallowed.size > 0) {
    run.fruits = run.fruits.filter((f) => !swallowed.has(f.id));
    run.message = `Pitayas Eat ${swallowed.size}: each scores +${run.pitayaBonus}`;
  }
}

/** A Coconut that has sat `COCONUT_TURNS` turns cracks open and is gone, leaving its milk in the jar. */
function coconutsCrack(run: Run): void {
  crack(run, run.fruits.filter((f) => f.kind === "coconut" && f.age >= COCONUT_TURNS - 1), "A Coconut cracked");
}

/**
 * Coconuts crack open: they are gone, and their milk is in the jar. By itself after `COCONUT_TURNS`, which leaves three turns of a
 * cycle's five to score in it; or at once when one is hit hard (a Coconut landing on it, a Pumpkin's Plunge, a blast), so the
 * milk can be set up for the turns that matter and not waited for.
 */
function crack(run: Run, cracked: Fruit[], what: string): void {
  if (cracked.length === 0) return;
  run.fruits = run.fruits.filter((f) => !cracked.includes(f));
  for (const f of cracked) effect(run, "pop", f.x, f.y, f.r * 2);
  pour(run, "milk", cracked.length * COCONUT_MILK);
  run.message = `${what}: milk in the jar`;
}

/** How many turns ice lasts: a fruit frozen at the end of a turn thaws at the end of the `FROZEN_TURNS`th turn after it. */
export const FROZEN_TURNS = 3;

/**
 * Ice thaws: each frozen fruit has a turn less of it, and one with none left is a plain fruit again. A Snow Pear whose ice is
 * gone has melted, and is gone with it. Ice does not go at the rent: what is frozen then stays in the jar for the next cycle,
 * with the turns it has left, so a pool with Snow Pears coming round keeps a corner of the jar from cycle to cycle.
 */
function iceThaws(run: Run): void {
  const melted: Fruit[] = [];
  for (const f of run.fruits) {
    if (!f.frozen) continue;
    f.ice = (f.ice ?? FROZEN_TURNS) - 1;
    if (f.ice > 0) continue;
    f.frozen = false;
    if (f.kind === "snowpear") melted.push(f);
  }
  if (melted.length === 0) return;
  for (const f of melted) effect(run, "pop", f.x, f.y, f.r * 2);
  run.fruits = run.fruits.filter((f) => !melted.includes(f));
}

/**
 * Each Snow Pear freezes one fruit it touches, where it is, and itself as it lands: one a turn, as a Honeydew honeys. Its own
 * ice is not made again, so it melts after `FROZEN_TURNS` turns, having frozen that many fruit one after another.
 */
function snowPearsFreeze(run: Run, tally: Tally): void {
  for (const f of run.fruits) {
    if (f.kind !== "snowpear") continue;
    const next = run.fruits.find((o) => !o.frozen && o !== f && f.touching.includes(o.id));
    const fresh = [...(f.frozen ? [] : [f]), ...(next === undefined ? [] : [next])];
    if (fresh.length === 0) continue;
    for (const o of fresh) Object.assign(o, { frozen: true, ice: FROZEN_TURNS });
    stage(tally, null, fresh, fresh.filter((o) => o !== f).map((o) => link(run, "freeze", f, o)));
  }
}

/** Each Honeydew honeys one fruit it touches. */
function honeydewsHoney(run: Run, tally: Tally): void {
  for (const f of run.fruits) {
    if (f.kind !== "honeydew" || f.rotten) continue;
    const next = run.fruits.find((o) => !o.honeyed && !o.rotten && f.touching.includes(o.id));
    if (next === undefined) continue;
    next.honeyed = true;
    stage(tally, null, [f, next], [link(run, "honey", f, next)]);
  }
}

/** Age; Bananas rot after 3 turns, and each rotten fruit, Prunes too, rots one fruit it touches (never a Lemon or a Fruit Fly). */
function ageAndRot(run: Run, tally: Tally): void {
  for (const f of run.fruits) {
    if (f.pickled) continue;
    f.age += 1;
    if (f.kind === "banana" && f.age >= BANANA.rots && !f.rotten) f.rotten = true;
  }
  // A Fruit Fly rots a fruit it touches too, though it is not rotten itself: it brings its own meal, and eats it next turn.
  const rotten = run.fruits.filter((f) => f.rotten || f.kind === "fruitfly");
  for (const r of rotten) {
    // (Nor a Prune: it is dried, not rotten, and scores for the rot beside it without making any. It was rotten from the start
    // and spread like any rot, which made its own neighbours pay: the strongest fruit in the game, and it needed nothing.)
    const next = run.fruits.find((o) => !o.rotten && !o.pickled && o.kind !== "lemon" && o.kind !== "fruitfly" && o.kind !== "prune" && r.touching.includes(o.id));
    if (next === undefined) continue;
    next.rotten = true;
    // A Fig pays as it turns: once, for whatever rotted it.
    const popup = next.kind === "fig" ? score(run, FIG.rot, next.x, next.y - next.r, { label: "Rotten", earner: FRUITS.fig.name }) : null;
    stage(tally, popup, [next], [link(run, "rot", r, next)]);
  }
}

/** The loop cap lasts a turn: what Slices made may Merge again next turn. */
function uncap(run: Run): void {
  for (const f of run.fruits) f.remerged = false;
}

/**
 * What happens at the end of a turn, in this order. Each may change the jar's fruit, so a step sees what the ones before it left:
 * a fruit that spilled or was crushed does not score, a Fly's meal is gone before the rot spreads.
 */
const END_OF_TURN: readonly ((run: Run, tally: Tally) => void)[] = [
  spillOver,
  juicerCrush,
  regrowSeeded,
  simmer,
  fruitFliesEat,
  pitayasEat,
  coconutsCrack,
  iceThaws,
  snowPearsFreeze,
  honeydewsHoney,
  ageAndRot,
  uncap,
];

/**
 * Time the tally: a step between each thing, shorter when there are many, and how long the whole takes. Popups made before it
 * (a spill, the Juicer) show at once.
 */
function timeTally(run: Run, tally: Tally, popupsBefore: number): void {
  const step = Math.min(TALLY_STEP, TALLY_MOST / Math.max(1, tally.slot));
  const shown: Popup[] = run.popups.slice(popupsBefore).filter((p) => !tally.steps.some((s) => s.popup === p));
  for (const s of tally.steps) {
    const delay = s.slot * step;
    if (s.popup !== null) {
      s.popup.delay = delay;
      clearOf(s.popup, shown);
      shown.push(s.popup);
    }
    for (const f of s.fruits) pulse(f, delay);
    for (const l of s.links) l.delay = delay;
  }
  run.tallyTime = run.popups.length > popupsBefore || tally.slot > 0 ? tally.slot * step + TALLY_HOLD : 0;
}

/** After the cycle's last turn the rent is due: paid, what is over it becomes coins; missed, the run is over. */
function dueRent(run: Run): void {
  run.phase = "rent";
  const rent = rentFor(run);
  if (run.cycleScore >= rent) {
    const earned = Math.floor((run.cycleScore - rent) / POINTS_PER_COIN);
    run.coins += earned;
    // Each Golden Apple in the jar pays too.
    const golden = run.fruits.reduce((sum, f) => sum + payGolden(run, f), 0);
    // The rent board says so, and what it paid (CycleEnd.tsx).
    run.rentCoins = earned + golden;
    run.rentGolden = golden;
    run.message = "";
    sound(run, "rent");
  } else {
    run.phase = "over";
    // The end board says what the rent was and what was scored (EndBoard.tsx).
    run.message = "";
    sound(run, "lose");
  }
}

/** How long the chain's line at the end of a turn stays, in seconds. */
export const CHAIN_LINE_LIFE = 1.6;

/**
 * A turn whose chain reached a tier ends with one line over the middle of the jar, once the tally is done: "14 links, 412
 * points" (the turn's points). It is wider than the jar, so it is not kept inside its walls as the other popups are, and the
 * tally waits for it.
 */
function chainLine(run: Run): void {
  const delay = Math.max(0, run.tallyTime - TALLY_HOLD);
  const popup: Popup = {
    id: run.nextId++,
    x: (JAR.left + JAR.right) / 2,
    y: (RIM + JAR.floor) / 2,
    text: `${run.chainLinks} links, ${run.turnScore} points`,
    life: CHAIN_LINE_LIFE,
    delay,
    points: 0,
    quiet: true,
  };
  run.popups.push(popup);
  run.tallyTime = delay + CHAIN_LINE_LIFE;
}

/** The jar has settled: the end of the turn (`END_OF_TURN`), its tally, then the pick, the next hand or the rent. */
export function resolve(run: Run): void {
  const tally: Tally = { steps: [], slot: 0 };
  const popupsBefore = run.popups.length;
  for (const step of END_OF_TURN) step(run, tally);
  timeTally(run, tally, popupsBefore);
  run.scoreNote = 0;
  run.chains.push(run.chainLinks);
  if (run.chainLinks >= (CHAIN_TIERS[0] as number)) chainLine(run);

  run.bestTurn = Math.max(run.bestTurn, run.turnScore);
  run.turnScore = 0;

  if (run.turn >= TURNS_PER_CYCLE) {
    dueRent(run);
    return;
  }
  run.turn += 1;
  // The turn just played was `run.turn - 1`: a pick follows every `PICK_EVERY`th, and otherwise the next hand is dealt.
  if ((run.turn - 1) % PICK_EVERY === 0) offer(run);
  else startTurn(run);
}

function offer(run: Run): void {
  const rng = new Rng(run.seed);
  run.offers = rng.shuffle(OFFERABLE).slice(0, 3);
  // Now and then a Legendary takes the last place.
  if (rng.next() < LEGENDARY_CHANCE) run.offers[2] = rng.pick(LEGENDARY);
  // And now and then a Melon takes the middle one: the Ladder build's way to Watermelons.
  if (rng.next() < MELON_CHANCE) run.offers[1] = "melon";
  run.seed = rng.seed;
  run.offerCursor = -1;
  run.phase = "pick";
}

function pickStep(run: Run, keys: Keys): void {
  const move = (keys.right || keys.down ? 1 : 0) - (keys.left || keys.up ? 1 : 0);
  // No card is chosen until the player chooses one (the cursor is -1): an arrow goes to the first, the pointer to the one it is on.
  const pointed = keys.point >= 0 && keys.point < run.offers.length;
  // A tap or a click on a card only chooses it, so what it does can be read (and a finger can drag its text to scroll it). What
  // takes it is a confirm with no card pointed at: Enter, or the "Take" button under the cards, as in the take-out dialog.
  // A tap anywhere else puts the chosen card back: nothing is chosen, and its tooltip goes. So does a tap on the chosen card.
  const again = pointed && keys.confirm && keys.point === run.offerCursor;
  if (keys.away === true || again) run.offerCursor = -1;
  const to = again ? -1 : pointed ? keys.point : move === 0 ? run.offerCursor : Math.max(0, Math.min(run.offers.length - 1, run.offerCursor + move));
  if (to !== run.offerCursor) {
    run.offerCursor = to;
    sound(run, "tick");
  }
  if (keys.confirm && !pointed && run.offerCursor >= 0) {
    const kind = run.offers[run.offerCursor] as FruitKind;
    run.pool.push(kind);
    run.poolGlazes.push(null);
    // Shuffled into what is still to be dealt, so a new fruit shows up soon.
    const rng = new Rng(run.seed);
    // An opening pick, taken before the first hand is dealt, is dealt first, so it is in that hand.
    const at = run.opening > 0 ? 0 : rng.int(0, run.draw.length);
    run.draw.splice(at, 0, kind);
    run.drawGlazes.splice(at, 0, null);
    run.seed = rng.seed;
    run.message = "";
    sound(run, "pick");
    afterPick(run);
  } else if (keys.drop) {
    run.coins += 1;
    run.message = "";
    afterPick(run);
  }
}

/** After a pick is taken or skipped: the next of the picks that open a run, or the hand. */
function afterPick(run: Run): void {
  if (run.opening > 1) {
    run.opening -= 1;
    offer(run);
  } else {
    run.opening = 0;
    startTurn(run);
  }
}

function startTurn(run: Run): void {
  run.offers = [];
  deal(run);
  run.phase = "order";
}

/** The kinds of fruit in the pool, in the fruit table's order: what the shop's removal chooses from. */
export function poolKinds(pool: readonly FruitKind[]): FruitKind[] {
  return (Object.keys(FRUITS) as FruitKind[]).filter((kind) => pool.includes(kind));
}

/** What a new shelf costs now: one more for each bought this run. */
export function rerollPrice(run: Run): number {
  return REROLL_PRICE + run.rerolls;
}

/** What taking a fruit out of the pool costs now: `REMOVAL_STEP` more for each taken out this run. */
export function removalPrice(run: Run): number {
  return REMOVAL_PRICE + REMOVAL_STEP * run.removals;
}

/** After the rent is paid: the last cycle wins the run, any other opens the shop. */
function leaveRent(run: Run): void {
  if (run.cycle >= RENT.length) {
    run.phase = "won";
    run.message = "";
    return;
  }
  run.shop = { fruits: [], item: null, glaze: null, cursor: -1, removing: false, glazing: false, removeCursor: -1, removed: false };
  stock(run, run.shop);
  run.phase = "shop";
  const next = bossNow(run, run.cycle + 1);
  // Nothing to say on opening, unless the next cycle is a boss jar.
  run.message = next === null ? "" : `Next cycle: the ${BOSS_NAME[next]}`;
}

/** Fill the shop's shelf: three different fruit, and an item the player can use (none when there is none: `offerable`). */
function stock(run: Run, shop: Shop): void {
  const rng = new Rng(run.seed);
  shop.fruits = rng.shuffle(OFFERABLE).slice(0, SHOP_FRUITS);
  const choices = offerable(run.items);
  shop.item = choices.length === 0 ? null : rng.pick(choices);
  run.seed = rng.seed;
  // The glaze comes from a draw of its own, so adding it changed nothing else the run's seed decides.
  shop.glaze = new Rng(run.seed * 31 + run.cycle).pick(GLAZE_KINDS);
}

/** The kinds in the pool a glaze can go on, in the pool board's order: those it fits (`glazeFits`) with a plain fruit left. */
export function glazeKinds(run: Run, glaze: Glaze): FruitKind[] {
  return poolKinds(run.pool).filter((kind) => glazeFits(glaze, kind) && run.pool.some((k, at) => k === kind && run.poolGlazes[at] === null));
}

/** Put a glaze on a plain fruit of this kind in the pool (the first). Returns false if there is none. */
export function glazeOne(run: Run, kind: FruitKind, glaze: Glaze): boolean {
  const at = run.pool.findIndex((k, i) => k === kind && run.poolGlazes[i] === null);
  if (at < 0) return false;
  run.poolGlazes[at] = glaze;
  return true;
}

/** Pay `price` coins if the run has them; says so and returns false if not. */
function pay(run: Run, price: number): boolean {
  if (run.coins < price) {
    run.message = `Not enough coins: that costs ${price}`;
    sound(run, "lose");
    return false;
  }
  run.coins -= price;
  return true;
}

function shopStep(run: Run, keys: Keys): void {
  const shop = run.shop;
  if (shop === null) return;
  const across = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  const down = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
  if (shop.glazing && shop.glaze !== null) {
    // As taking a fruit out: a tap or an arrow chooses a kind, and Enter (or the dialog's button) puts the glaze on it.
    const glaze = shop.glaze;
    const kinds = glazeKinds(run, glaze);
    const pointed = keys.point >= 0 && keys.point < kinds.length;
    const step = across + down;
    const to = pointed ? keys.point : shop.removeCursor < 0 ? (step !== 0 ? 0 : -1) : Math.max(0, Math.min(kinds.length - 1, shop.removeCursor + step));
    if (to !== shop.removeCursor) sound(run, "tick");
    shop.removeCursor = to;
    if (keys.confirm && !pointed && shop.removeCursor >= 0) {
      const kind = kinds[shop.removeCursor] as FruitKind;
      if (pay(run, GLAZE_PRICE) && glazeOne(run, kind, glaze)) {
        run.message = "";
        sound(run, "pick");
        shop.glaze = null;
        shop.glazing = false;
      }
    } else if (keys.drop) {
      shop.glazing = false;
    }
    return;
  }
  if (shop.removing) {
    const kinds = poolKinds(run.pool);
    // Nothing is chosen at first (-1). A tap on a kind only chooses it, so the player sees which it is before it goes; what takes
    // it out is a confirm with no place: Enter, or the dialog's "Take out" button. An arrow goes to the first kind, then along.
    const pointed = keys.point >= 0 && keys.point < kinds.length;
    const step = across + down;
    const to = pointed ? keys.point : shop.removeCursor < 0 ? (step !== 0 ? 0 : -1) : Math.max(0, Math.min(kinds.length - 1, shop.removeCursor + step));
    if (to !== shop.removeCursor) sound(run, "tick");
    shop.removeCursor = to;
    if (keys.confirm && !pointed && shop.removeCursor >= 0) {
      const kind = kinds[shop.removeCursor] as FruitKind;
      if (pay(run, removalPrice(run))) {
        run.removals += 1;
        // A plain one goes, if there is one: a glaze was bought for the fruit it is on.
        const plain = run.pool.findIndex((k, at) => k === kind && run.poolGlazes[at] === null);
        const at = plain >= 0 ? plain : run.pool.indexOf(kind);
        run.pool.splice(at, 1);
        run.poolGlazes.splice(at, 1);
        run.message = "";
        sound(run, "pick");
        shop.removing = false;
        shop.removed = true;
      }
    } else if (keys.drop) {
      shop.removing = false;
    }
    return;
  }

  // The shelf (0 to SHOP_ITEM) is the top row and the three actions the bottom one: left and right walk along both, up and
  // down change rows, keeping roughly the same place across.
  // As in the pick: nothing is chosen at first (-1), an arrow goes to the first card, and a tap on a card only chooses it, so it
  // can be read before it is bought; Enter or the "Buy" button buys it. The three actions say all they do, and act on one tap.
  const pointed = keys.point >= 0 && keys.point <= SHOP_LEAVE;
  const onCard = pointed && keys.point <= SHOP_GLAZE;
  // As in the pick, a tap anywhere else leaves nothing chosen, and so does a tap on the card already chosen.
  const again = onCard && keys.confirm && keys.point === shop.cursor;
  if (keys.away === true || again) shop.cursor = -1;
  let to = again ? -1 : pointed ? keys.point : shop.cursor < 0 ? (across !== 0 || down !== 0 ? 0 : -1) : Math.max(0, Math.min(SHOP_LEAVE, shop.cursor + across));
  if (shop.cursor >= 0 && !pointed) {
    if (down > 0 && to <= SHOP_GLAZE) to = SHOP_REMOVE + Math.min(2, Math.floor((to * 3) / (SHOP_GLAZE + 1)));
    else if (down < 0 && to > SHOP_GLAZE) to = Math.round(((to - SHOP_REMOVE) * SHOP_GLAZE) / 2);
  }
  if (to !== shop.cursor) sound(run, "tick");
  shop.cursor = to;

  if (keys.drop) {
    leaveShop(run);
    return;
  }
  if (!keys.confirm || onCard || shop.cursor < 0) return;
  if (shop.cursor < SHOP_FRUITS) {
    const kind = shop.fruits[shop.cursor];
    if (kind == null || !pay(run, FRUIT_PRICE)) return;
    run.pool.push(kind);
    run.poolGlazes.push(null);
    shop.fruits[shop.cursor] = null;
    run.message = "";
    sound(run, "pick");
  } else if (shop.cursor === SHOP_ITEM) {
    if (shop.item === null || !pay(run, ITEMS[shop.item].price)) return;
    // An upgrade takes the place of what it upgrades.
    const from = ITEMS[shop.item].upgrades;
    run.items = run.items.filter((item) => item !== from);
    run.items.push(shop.item);
    run.message = "";
    shop.item = null;
    sound(run, "pick");
  } else if (shop.cursor === SHOP_GLAZE) {
    // The glaze is paid for once it is on a fruit, so backing out of choosing one costs nothing.
    if (shop.glaze === null) return;
    if (run.coins < GLAZE_PRICE) {
      pay(run, GLAZE_PRICE);
    } else if (glazeKinds(run, shop.glaze).length === 0) {
      run.message = `Nothing in your pool can take a ${GLAZES[shop.glaze].name} glaze`;
      sound(run, "lose");
    } else {
      shop.glazing = true;
      shop.removeCursor = -1;
      // The board that opens asks which (Shop.tsx).
      run.message = "";
    }
  } else if (shop.cursor === SHOP_REMOVE) {
    if (shop.removed) {
      run.message = "One fruit out a shop";
      sound(run, "lose");
    } else if (run.pool.length <= HAND_SIZE) {
      run.message = `Your pool needs at least ${HAND_SIZE} fruit`;
      sound(run, "lose");
    } else if (run.coins < removalPrice(run)) {
      pay(run, removalPrice(run));
    } else {
      shop.removing = true;
      shop.removeCursor = -1;
      run.message = "";
    }
  } else if (shop.cursor === SHOP_REROLL) {
    if (!pay(run, rerollPrice(run))) return;
    run.rerolls += 1;
    stock(run, shop);
    run.message = "";
    sound(run, "tick");
  } else {
    leaveShop(run);
  }
}

/** The jar's fruit in the order the Preserves Jar's cursor walks them: left to right. */
export function preservable(run: Run): Fruit[] {
  return run.fruits.slice().sort((a, b) => a.x - b.x || a.id - b.id);
}

/** Out of the shop: with a Preserves Jar and fruit in the jar, choose what to keep; otherwise the jar is cleared for the next cycle. */
function leaveShop(run: Run): void {
  run.shop = null;
  run.kept = [];
  if (keeps(run) === 0 || run.fruits.length === 0) {
    startClear(run);
    return;
  }
  run.preserveCursor = 0;
  run.phase = "preserve";
  // Its board says what to do (PreserveBoard.tsx), and shows what this says when one too many is chosen.
  run.message = "";
}

function preserveStep(run: Run, keys: Keys): void {
  const fruits = preservable(run);
  const move = (keys.right || keys.down ? 1 : 0) - (keys.left || keys.up ? 1 : 0);
  const to = keys.point >= 0 && keys.point < fruits.length ? keys.point : Math.max(0, Math.min(fruits.length - 1, run.preserveCursor + move));
  if (to !== run.preserveCursor) sound(run, "tick");
  run.preserveCursor = to;
  const chosen = fruits[run.preserveCursor];
  if (keys.confirm && chosen !== undefined) {
    const id = chosen.id;
    run.message = "";
    if (run.kept.includes(id)) run.kept = run.kept.filter((k) => k !== id);
    else if (run.kept.length < keeps(run)) run.kept.push(id);
    else run.message = `It holds ${keeps(run)}: let one go first`;
    sound(run, "tick");
  } else if (keys.drop) {
    startClear(run);
  }
}

/** Seconds the clear-out takes at the least (the board's score counts down to 0 and the rent up to the next one meanwhile), and at most between the first fruit's pop and the last. */
export const CLEAR_TIME = 1.2;
const CLEAR_POPS = 0.6;
/** Seconds between one fruit's pop and the next, at the most. */
const CLEAR_GAP = 0.08;

/**
 * Between cycles, before the next hand: the jar's fruit (but what a Preserves Jar keeps) pop one after another, left to right,
 * while the rent board counts the score down to 0 and the rent up to the next cycle's. Nothing scores.
 */
function startClear(run: Run): void {
  // What is frozen stays through the rent, as what a Preserves Jar keeps does: its ice thaws by the turn, not at the rent.
  for (const f of run.fruits) if (f.frozen && !run.kept.includes(f.id)) run.kept.push(f.id);
  const doomed = run.fruits.filter((f) => !run.kept.includes(f.id)).length;
  run.phase = "clear";
  run.message = "";
  run.clearTime = 0;
  run.clearFrom = doomed;
  run.clearGap = doomed <= 1 ? 0 : Math.min(CLEAR_GAP, CLEAR_POPS / (doomed - 1));
  // The first pops as the shop closes.
  clearStep(run, 0);
}

function clearStep(run: Run, dt: number): void {
  run.clearTime += dt;
  const doomed = run.fruits.filter((f) => !run.kept.includes(f.id)).sort((a, b) => a.x - b.x || a.id - b.id);
  const due = run.clearGap === 0 ? run.clearFrom : Math.min(run.clearFrom, Math.floor(run.clearTime / run.clearGap) + 1);
  const popping = doomed.slice(0, due - (run.clearFrom - doomed.length));
  for (const f of popping) effect(run, "pop", f.x, f.y, f.r * 2);
  if (popping.length > 0) {
    sound(run, "merge");
    run.fruits = run.fruits.filter((f) => !popping.includes(f));
  }
  if (run.clearTime >= CLEAR_TIME && run.fruits.every((f) => run.kept.includes(f.id))) nextCycle(run);
}

function nextCycle(run: Run): void {
  run.shop = null;
  run.cycle += 1;
  run.turn = 1;
  run.cycleScore = 0;
  run.clusterBonus = 0;
  run.juice = 0;
  run.lime = false;
  run.milk = false;
  run.drops = 0;
  run.flipped = false;
  run.fruits = run.fruits.filter((f) => run.kept.includes(f.id));
  // What a Pickling Jar keeps is Pickled: it does not age, and rot it had is gone.
  if (run.items.includes("pickling")) for (const f of run.fruits) Object.assign(f, { pickled: true, rotten: false });
  run.kept = [];
  const rng = new Rng(run.seed);
  const shuffled = shuffleGlazed(rng, run.pool, run.poolGlazes);
  run.draw = shuffled.kinds;
  run.drawGlazes = shuffled.glazes;
  run.discard = [];
  run.discardGlazes = [];
  run.seed = rng.seed;
  const boss = bossNow(run);
  // The rent board shows the cycle and its rent; only a boss jar's rule needs saying.
  run.message = boss === null ? "" : `The ${BOSS_NAME[boss]}! ${BOSS_RULE[boss]}`;
  deal(run);
  run.phase = "order";
}
