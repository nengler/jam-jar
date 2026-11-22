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
import { APPLE, BANANA, FRUITS, GOURD_BURST, GOURD_SIZES, HONEY, LEGENDARY, LEGENDARY_CHANCE, MELON_CHANCE, OFFERABLE, SLICES, SPROUTS, type FruitKind } from "./fruits.ts";
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
 * A new fruit is offered after every `PICK_EVERY`th turn of a cycle (after turns 2 and 4), not after each one: a cycle deals 20
 * fruit, and a pool that grew by four a cycle soon held more than that, so fruit the player had chosen never came up.
 */
export const PICK_EVERY = 2;
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

export const RENT: readonly number[] = [120, 180, 240, 320, 400];
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
const COCONUT_TURNS = 3;
/** Juice: how deep the liquid a Lime or a Coconut leaves is, in pixels, and the deepest the jar's liquid gets. */
export const LIME_JUICE = 20;
export const COCONUT_MILK = 20;
export const JUICE_MOST = 120;
/** What a honeyed fruit scores at each Resolve. */
const HONEY_POINTS = HONEY;
const POPUP_LIFE = 0.9;
/** About how wide a popup's character is on screen, and a popup's line, in pixels. */
const POPUP_CHAR = 13;
const POPUP_LINE = 22;
/** How fast a popup rises once it shows, in pixels a second. */
const POPUP_RISE = 36;
/** A chain: a Blast within this many seconds of the last one. And a big Blast: one that destroys at least this many fruit. */
const CHAIN_WINDOW = 1.2;
export const BIG_BLAST = 5;
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
/** The shop's shelf: three fruit and an item, then its three actions. `Shop.cursor` counts across all of them. */
export const SHOP_FRUITS = 3;
export const SHOP_ITEM = SHOP_FRUITS;
export const SHOP_REMOVE = SHOP_ITEM + 1;
export const SHOP_REROLL = SHOP_ITEM + 2;
export const SHOP_LEAVE = SHOP_ITEM + 3;

/** The shop between two cycles. */
export interface Shop {
  /** The fruit for sale; a bought one leaves a gap (null) so the others stay where they are. */
  fruits: (FruitKind | null)[];
  /** The item for sale: null once bought, or when every item is owned. */
  item: ItemKind | null;
  cursor: number;
  /** Choosing which fruit to take out of the pool: `removeCursor` is a row of `poolKinds`. */
  removing: boolean;
  removeCursor: number;
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
  /** Coated in honey (a Honeydew, or a fruit one has honeyed): it scores at every Resolve. */
  honeyed: boolean;
  /** A Chili or Durian about to go off, and the seconds left. */
  lit: boolean;
  fuse: number;
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
  /** Every fruit you own. */
  pool: FruitKind[];
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
  /** One line about what just happened. */
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

/** The starting pool: 1 Apple plus 8 starters, 3–5 Cherries, 2–4 Grapes and 0–2 Oranges (see the design doc). */
export function rollPool(rng: Rng): FruitKind[] {
  for (;;) {
    const cherries = rng.int(3, 5);
    const grapes = rng.int(2, 4);
    const oranges = 8 - cherries - grapes;
    if (oranges < 0 || oranges > 2) continue;
    return [
      ...Array<FruitKind>(cherries).fill("cherry"),
      ...Array<FruitKind>(grapes).fill("grape"),
      ...Array<FruitKind>(oranges).fill("orange"),
      "apple",
    ];
  }
}

export function newRun(seed: number): Run {
  const rng = new Rng(seed);
  const pool = rollPool(rng);
  const run: Run = {
    seed: rng.seed,
    nextId: 1,
    boss: bossFor(seed),
    pool,
    draw: rng.shuffle(pool),
    discard: [],
    hand: [],
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
    message: "Order your hand, then drop it in the jar",
    sounds: [],
  };
  deal(run);
  return run;
}

export function rentFor(cycle: number): number {
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
    fruits: run.fruits.map((f) => ({ ...f })),
    items: run.items.slice(),
    kept: run.kept.slice(),
    shop: run.shop === null ? null : { ...run.shop, fruits: run.shop.fruits.slice() },
    offers: run.offers.slice(),
    popups: run.popups.map((p) => ({ ...p })),
    links: run.links.map((l) => ({ ...l })),
    effects: run.effects.map((e) => ({ ...e })),
    sounds: [],
  };
}

function deal(run: Run): void {
  const rng = new Rng(run.seed);
  run.hand = [];
  // The hand fills the shelf's places: a Wide fruit takes two, and one that would not fit waits on top for the next hand.
  let used = 0;
  while (used < HAND_SIZE) {
    if (run.draw.length === 0) {
      run.draw = rng.shuffle(run.discard);
      run.discard = [];
    }
    const next = run.draw[0];
    if (next === undefined || used + slotsOf(next) > HAND_SIZE) break;
    run.draw.shift();
    run.hand.push(next);
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
}

/** Add points to the cycle, with a popup where it happened. Returns the popup (null for no points), so the tally can time it. */
function score(run: Run, points: number, x: number, y: number, why: Why = {}): Popup | null {
  if (points === 0) return null;
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
    rotten: kind === "prune",
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

/** Score what a fruit (by index) earns, doubled if it touches a Booster: the popup then says "x2" and the Boosters light up too. */
function earn(run: Run, links: readonly number[][], i: number, points: number, label?: string): Earned | null {
  const f = run.fruits[i];
  if (f === undefined) return null;
  // Doubled by a Lemon it touches, or by Coconut milk it sits in (once, not twice over).
  const doubled = boosted(run.fruits, links, i) || (run.milk && soaked(run, f));
  const popup = score(run, points * (doubled ? 2 : 1), f.x, f.y - f.r, { label, doubled, earner: FRUITS[f.kind].name });
  if (popup === null) return null;
  const boosters = doubled ? neighbours(run.fruits, links, i).filter((o) => o.kind === "lemon") : [];
  const fruits = [f, ...boosters];
  for (const o of fruits) pulse(o);
  return { popup, doubled, fruits, links: boosters.map((booster) => link(run, "boost", booster, f)) };
}

/** Whether a fruit (by index) touches a Lemon: it cannot merge. */
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
      if (p.delay <= 0) {
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
    run.hand = [];
    run.holding = false;
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
    run.queue = shuffler.shuffle(run.queue);
    run.seed = shuffler.seed;
  }
  const lanes = Math.max(HAND_SIZE, handSlots(run.queue));
  const width = (JAR.right - JAR.left) / lanes;
  const places = shelfPlaces(run.queue);
  const rng = new Rng(run.seed);
  run.queue.forEach((kind, at) => {
    const r = FRUITS[kind].radius;
    // A Wide fruit drops down the middle of its two lanes.
    const place = places[at] as { start: number; span: number };
    const middle = JAR.left + width * (place.start + place.span / 2);
    const x = Math.max(JAR.left + r, Math.min(JAR.right - r, middle + spot(rng, -TRAY.wobble, TRAY.wobble)));
    const y = !flip ? DROP_Y : run.flipped ? JAR.floor - r - 2 : RIM + r + 2;
    run.fruits.push(makeFruit(run, kind, x, y));
    run.drops += 1;
    run.discard.push(kind);
  });
  run.seed = rng.seed;
  run.queue = [];
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
      const earned = earn(run, near, i, def.points);
      // Landing is the commonest score: only a doubled one lights anything up.
      if (earned !== null && !earned.doubled) f.pulse = 0;
    }
    if (lying && f.kind !== "peach") {
      // A fruit that lands on the floor (the lid, turned over) hops once, a little, so it does not just stop dead.
      kick(f, 0, run.flipped ? FLOOR_BOUNCE : -FLOOR_BOUNCE);
    }
    if (f.kind === "peach") {
      // It bounces once, and shoves what it landed on away to each side.
      kick(f, 0, -PEACH_BOUNCE);
      for (const o of neighbours(run.fruits, near, i)) {
        kick(o, (o.x < f.x ? -1 : 1) * PEACH_SHOVE, -PEACH_SHOVE / 3);
      }
    }
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
      if (o.kind === "giantpumpkin" || o.kind === "pumpkin") continue;
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
        if (o === p || o.frozen) continue;
        const dx = o.x - p.x;
        const dy = o.y - p.y;
        const d = Math.max(1, Math.hypot(dx, dy));
        if (d > p.r + o.r + PLUNGE_SHOVE.reach) continue;
        kick(o, (dx / d) * PLUNGE_SHOVE.push, -Math.abs(dy / d) * PLUNGE_SHOVE.push - 80);
      }
      pulse(p);
      sound(run, "land");
      if ((p.burst ?? 0) > 0) {
        // The burst: all its Smashes' points at once, where it came down, big and with no name (it would not fit the jar).
        score(run, p.burst ?? 0, p.x, p.y - p.r, { earner: "Plunge", big: true });
        p.burst = 0;
        effect(run, "boom", p.x, p.y, p.r * 3);
        sound(run, "boom");
      }
    }
  }
}

/** What a Smashed Grape, Orange or Melon breaks into two of (a Watermelon breaks into Slices). */
const SMASH_INTO: Readonly<Partial<Record<FruitKind, FruitKind>>> = { melon: "orange", orange: "grape", grape: "cherry" };

/** Whether a Smash breaks this fruit into pieces: a Grape, Orange, Melon or Watermelon. */
function smashable(f: Fruit): boolean {
  return f.kind === "watermelon" || SMASH_INTO[f.kind] !== undefined;
}

/** A Seed's Sprout: a Cherry, Grape or Orange where it was, already landed. */
function sprout(run: Run, seed: Fruit): Fruit {
  const rng = new Rng(run.seed);
  const grown = makeFruit(run, rng.pick(SPROUTS), seed.x, seed.y);
  run.seed = rng.seed;
  grown.landed = true;
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
 * they are made (`scores`; a Plunge keeps their worth for its burst instead). The caller takes the fruit out.
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
    if (!w.rotten && scores) score(run, 2 * FRUITS[into].points, w.x, w.y - w.r, { label: "Smash" });
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
  if (!w.rotten && scores) score(run, SLICES * FRUITS.slice.points, w.x, w.y - w.r, { label: "Slice", earner: FRUITS.slice.name });
  return out;
}

/** How hard a fruit hops when it lands on the floor (px/s): about 8 px up. Landing on another fruit, it does not. */
const FLOOR_BOUNCE = 140;
/** How hard a Peach bounces when it lands, and shoves each fruit it landed on sideways (px/s). */
const PEACH_BOUNCE = 380;
const PEACH_SHOVE = 180;

/** A Kiwi touching a landed fruit of another kind becomes a copy of it: a new fruit where it was, which lands and scores as one. */
function copyKiwis(run: Run): void {
  const near = links(run.fruits);
  run.fruits = run.fruits.map((f, i) => {
    if (f.kind !== "kiwi") return f;
    const on = neighbours(run.fruits, near, i).find((o) => o.landed && o.kind !== "kiwi" && o.kind !== "giantpumpkin");
    if (on === undefined) return f;
    return makeFruit(run, on.kind, f.x, f.y);
  });
}

function canMerge(f: Fruit): boolean {
  return f.landed && f.remerged !== true && (FRUITS[f.kind].mergesInto !== undefined || f.kind === "pomegranate");
}

function merge(run: Run): void {
  const near = links(run.fruits);
  const gone = new Set<number>();
  const born: Fruit[] = [];
  const giants: Fruit[] = [];
  for (const [i, a] of run.fruits.entries()) {
    if (gone.has(a.id) || !canMerge(a) || nearLemon(run.fruits, near, i)) continue;
    for (const j of near[i] ?? []) {
      const b = run.fruits[j];
      if (b === undefined || j <= i || gone.has(b.id) || b.kind !== a.kind || !canMerge(b) || nearLemon(run.fruits, near, j)) continue;
      gone.add(a.id);
      gone.add(b.id);
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
        score(run, FRUITS.giantpumpkin.points, mx, my - giant.r, { label: "Merge", earner: FRUITS.giantpumpkin.name });
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
        pulse(f);
        born.push(f);
        score(run, FRUITS[into].points, mx, my - f.r, { label: "Merge" });
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
  const smashed = caught.filter((f) => smashable(f) && !f.frozen);
  const born = smashed.flatMap((w) => smash(run, w));
  run.fruits = [...run.fruits.filter((f) => !smashed.includes(f)), ...born];
  for (const f of run.fruits) {
    if (f === giant || f.frozen) continue;
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
    earn(run, near, i, value, "Absorb");
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
  const radius = BLAST_RADIUS[bomb.kind] ?? 48;
  const near = links(run.fruits);
  const doubled = new Set(run.fruits.filter((_, i) => boosted(run.fruits, near, i)).map((f) => f.id));
  const victims: Fruit[] = [];
  const kept: Fruit[] = [];
  const born: Fruit[] = [];
  let points = 0;
  let figs = 0;
  let limes = 0;
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
      if (!f.lit) ignite(f, 0.15);
      kept.push(f);
      continue;
    }
    victims.push(f);
    // A Watermelon is Smashed: its Slices score in its place. (Blasts that Smashed every fruit that can be were tried, and made
    // Boom builds 17% stronger.)
    const smashing = f.kind === "watermelon";
    const value = FRUITS[f.kind].scoring === "booster" || f.rotten || smashing ? 0 : FRUITS[f.kind].points;
    if (smashing) born.push(...smash(run, f));
    points += (value + (BLAST_BONUS[bomb.kind] ?? 0)) * (doubled.has(f.id) ? 2 : 1);
    if (f.kind === "pomegranate") born.push(...burst(run, f.x, f.y));
    if (f.kind === "fig" && f.rotten) figs += 1;
    if (f.kind === "lime") limes += 1;
    if (f.kind === "seed") born.push(sprout(run, f));
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
  run.fruits = [...kept, ...born];
  score(run, points, bomb.x, bomb.y - radius / 2, { label: "Explode" });
  run.chain += 1;
  run.sinceBlast = 0;
  run.blasted = victims.length;
  if (run.chain >= 2) say(run, bomb.x, bomb.y - radius / 2 - POPUP_LINE, `Chain x${run.chain}`);
  effect(run, "boom", bomb.x, bomb.y, radius * 2);
  sound(run, "boom");
  run.message = `${FRUITS[bomb.kind].name} Exploded: ${victims.length} fruit destroyed`;
  if (limes > 0) {
    pour(run, "lime", limes * LIME_JUICE);
    run.message = `${FRUITS[bomb.kind].name} Exploded ${limes === 1 ? "a Lime" : `${limes} Limes`}: lime juice rises`;
  }
  if (figs > 0) {
    run.bananaBonus += figs;
    run.message = `A Rotten Fig Exploded: Bananas Grow to +${run.bananaBonus}`;
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
  for (const f of crushed) score(run, (f.rotten ? 0 : FRUITS[f.kind].points) + JUICER_BONUS, f.x, f.y - f.r, { label: "Crush" });
  if (crushed.length === 0) return;
  run.fruits = run.fruits.filter((f) => !crushed.includes(f));
  run.message = `Juicer: ${crushed.length} fruit Crushed`;
  const limes = crushed.filter((f) => f.kind === "lime").length;
  if (limes > 0) {
    pour(run, "lime", limes * LIME_JUICE);
    run.message = `Juicer: ${crushed.length} fruit Crushed. Lime juice rises`;
  }
}

/** Simmer fruit, Prunes and honeyed fruit score. */
function simmer(run: Run, tally: Tally): void {
  const near = links(run.fruits);
  run.fruits.forEach((f, i) => {
    const touched = neighbours(run.fruits, near, i);
    let points = 0;
    if (f.kind === "prune") {
      // Rotten from the start, and the one rotten fruit that scores: for the rot around it.
      points = FRUITS.prune.points * touched.filter((o) => o.rotten).length;
    } else if (f.rotten) {
      return;
    } else if (f.kind === "apple") {
      points = APPLE.base + (onEdge(run, f) ? APPLE.edge : 0);
    } else if (f.kind === "banana") {
      points = BANANA.base + f.age * BANANA.ripen + run.bananaBonus;
    } else if (f.kind === "pitaya") {
      points = FRUITS.pitaya.points + run.pitayaBonus;
    }
    if (f.honeyed) points += HONEY_POINTS;
    const earned = earn(run, near, i, points);
    if (earned === null) return;
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
    const earned = earn(run, near, i, FRUITS.fruitfly.points, "Eat");
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

/** A Coconut that has sat 3 turns cracks open and is gone, leaving its milk in the jar. */
function coconutsCrack(run: Run): void {
  const cracked = run.fruits.filter((f) => f.kind === "coconut" && f.age >= COCONUT_TURNS - 1);
  if (cracked.length === 0) return;
  run.fruits = run.fruits.filter((f) => !cracked.includes(f));
  pour(run, "milk", cracked.length * COCONUT_MILK);
  run.message = "A Coconut cracked: milk in the jar";
}

/** Each Snow Pear freezes itself and every fruit it touches, where they are. */
function snowPearsFreeze(run: Run, tally: Tally): void {
  for (const f of run.fruits) {
    if (f.kind !== "snowpear") continue;
    const fresh = [f, ...run.fruits.filter((o) => f.touching.includes(o.id))].filter((o) => !o.frozen);
    if (fresh.length === 0) continue;
    for (const o of fresh) o.frozen = true;
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
  const rotten = run.fruits.filter((f) => f.rotten);
  for (const r of rotten) {
    const next = run.fruits.find((o) => !o.rotten && !o.pickled && o.kind !== "lemon" && o.kind !== "fruitfly" && r.touching.includes(o.id));
    if (next === undefined) continue;
    next.rotten = true;
    stage(tally, null, [next], [link(run, "rot", r, next)]);
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
  simmer,
  fruitFliesEat,
  pitayasEat,
  coconutsCrack,
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
  const rent = rentFor(run.cycle);
  if (run.cycleScore >= rent) {
    const earned = Math.floor((run.cycleScore - rent) / POINTS_PER_COIN);
    run.coins += earned;
    run.message = `Rent paid! +${earned} coins`;
    sound(run, "rent");
  } else {
    run.phase = "over";
    run.message = `Rent was ${rent}; you scored ${run.cycleScore}. The jar is lost.`;
    sound(run, "lose");
  }
}

/** The jar has settled: the end of the turn (`END_OF_TURN`), its tally, then the pick, the next hand or the rent. */
export function resolve(run: Run): void {
  const tally: Tally = { steps: [], slot: 0 };
  const popupsBefore = run.popups.length;
  for (const step of END_OF_TURN) step(run, tally);
  timeTally(run, tally, popupsBefore);
  run.scoreNote = 0;

  run.bestTurn = Math.max(run.bestTurn, run.turnScore);
  run.turnScore = 0;

  if (run.turn >= TURNS_PER_CYCLE) {
    dueRent(run);
    return;
  }
  run.turn += 1;
  // The turn just played was `run.turn - 1`: a pick follows every second one, and otherwise the next hand is dealt.
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
    // Shuffled into what is still to be dealt, so a new fruit shows up soon.
    const rng = new Rng(run.seed);
    run.draw.splice(rng.int(0, run.draw.length), 0, kind);
    run.seed = rng.seed;
    run.message = `${FRUITS[kind].name} added to your pool`;
    sound(run, "pick");
    startTurn(run);
  } else if (keys.drop) {
    run.coins += 1;
    run.message = "Skipped: +1 coin";
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
    run.message = "You paid every rent. The jar is yours!";
    return;
  }
  run.shop = { fruits: [], item: null, cursor: -1, removing: false, removeCursor: -1 };
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
        run.pool.splice(run.pool.indexOf(kind), 1);
        run.message = `${FRUITS[kind].name} taken out of your pool`;
        sound(run, "pick");
        shop.removing = false;
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
  const onCard = pointed && keys.point <= SHOP_ITEM;
  // As in the pick, a tap anywhere else leaves nothing chosen, and so does a tap on the card already chosen.
  const again = onCard && keys.confirm && keys.point === shop.cursor;
  if (keys.away === true || again) shop.cursor = -1;
  let to = again ? -1 : pointed ? keys.point : shop.cursor < 0 ? (across !== 0 || down !== 0 ? 0 : -1) : Math.max(0, Math.min(SHOP_LEAVE, shop.cursor + across));
  if (shop.cursor >= 0 && !pointed) {
    if (down > 0 && to <= SHOP_ITEM) to = SHOP_REMOVE + Math.min(2, Math.floor((to * 3) / (SHOP_ITEM + 1)));
    else if (down < 0 && to > SHOP_ITEM) to = Math.round(((to - SHOP_REMOVE) * SHOP_ITEM) / 2);
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
    shop.fruits[shop.cursor] = null;
    run.message = `${FRUITS[kind].name} added to your pool`;
    sound(run, "pick");
  } else if (shop.cursor === SHOP_ITEM) {
    if (shop.item === null || !pay(run, ITEMS[shop.item].price)) return;
    // An upgrade takes the place of what it upgrades.
    const from = ITEMS[shop.item].upgrades;
    run.items = run.items.filter((item) => item !== from);
    run.items.push(shop.item);
    run.message = `You own the ${ITEMS[shop.item].name}`;
    shop.item = null;
    sound(run, "pick");
  } else if (shop.cursor === SHOP_REMOVE) {
    if (run.pool.length <= HAND_SIZE) {
      run.message = `Your pool needs at least ${HAND_SIZE} fruit`;
      sound(run, "lose");
    } else if (run.coins < removalPrice(run)) {
      pay(run, removalPrice(run));
    } else {
      shop.removing = true;
      shop.removeCursor = -1;
      run.message = "Take which fruit out of your pool?";
    }
  } else if (shop.cursor === SHOP_REROLL) {
    if (!pay(run, rerollPrice(run))) return;
    run.rerolls += 1;
    stock(run, shop);
    run.message = "A new shelf";
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
  run.message = `${ITEMS[keepingJar(run.items) as ItemKind].name}: choose up to ${keeps(run)} fruit to keep, then Done`;
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
  run.juice = 0;
  run.lime = false;
  run.milk = false;
  run.drops = 0;
  run.flipped = false;
  run.fruits = run.fruits.filter((f) => run.kept.includes(f.id));
  // What a Pickling Jar keeps is Pickled: it does not age, and rot it had is gone.
  if (run.items.includes("pickling")) for (const f of run.fruits) Object.assign(f, { pickled: true, rotten: f.kind === "prune" });
  run.kept = [];
  const rng = new Rng(run.seed);
  run.draw = rng.shuffle(run.pool);
  run.discard = [];
  run.seed = rng.seed;
  const boss = bossNow(run);
  run.message = boss === null ? `Cycle ${run.cycle}: rent is ${rentFor(run.cycle)}` : `The ${BOSS_NAME[boss]}! ${BOSS_RULE[boss]} Rent is ${rentFor(run.cycle)}`;
  deal(run);
  run.phase = "order";
}
