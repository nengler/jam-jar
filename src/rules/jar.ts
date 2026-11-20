/**
 * One run of Jam Jar, as plain data and functions: the pool (dealt like a deck), the hand you order, the jar's fruit, scoring,
 * rent and the 1-of-3 pick. `advance` takes the run, the frame's time and the keys pressed, and returns the next run (a copy, so
 * the component's state changes by assignment and renders). Nothing here knows about the engine, so it is tested with node:test.
 *
 * A turn: order (arrange the 4 dealt fruits) → drop (they fall one by one at random spots, each once the last has come to rest) → settle (physics; merges and blasts
 * score as they happen) → resolve (overflow, then Simmer fruit score; shown one fruit after another, the tally) → pick (1 of 3, or skip). Five turns make a rent cycle,
 * and between cycles the shop sells fruit, an item, a removal and rerolls for the coins the rent left over.
 *
 * The physics is the engine's (`useBall`): each fruit is a component with a ball, and each step it reports where it is, how fast it
 * moves and which fruit it touches (`FruitReport`). The run reads those reports; it never moves a fruit itself, except to give one
 * a kick (a blast), which the fruit's component applies.
 */
import { APPLE, BANANA, FRUITS, HONEY, LEGENDARY, LEGENDARY_CHANCE, OFFERABLE, SPROUTS, type FruitKind } from "./fruits.ts";
import { ITEMS, keepingJar, offerable, type ItemKind } from "./items.ts";
import { Rng } from "./rng.ts";

export interface JarBounds {
  left: number;
  right: number;
  floor: number;
}

export const JAR: JarBounds = { left: 224, right: 416, floor: 336 };
export const GRAVITY = 1200;
/** A fruit this close to the floor (beyond touching) is on it: a settled pile jitters by a fraction of a pixel. */
const FLOOR_TOLERANCE = 1.5;
/** The rim: a fruit whose top is above it once the jar settles spills out. */
export const RIM = 104;
/** Where dropped fruit appear. */
export const DROP_Y = 72;
/**
 * An experiment, off in the game: the tray drop. The shelf is a tray over the jar with a slot per lane, and the whole hand is
 * released together, hand index 0 in the leftmost lane, so where a fruit stands on the shelf decides where it lands (today the
 * order decides only when it falls, and each lands at a random spot). Each fruit wobbles up to `wobble` px within its lane, so a
 * setup is never pixel-perfect. Only the balance bots turn it on (`tools/balance.ts`, "/tray"), to see whether arranging the hand
 * matters more this way.
 */
export const TRAY = { on: false, wobble: 4 };
export const HAND_SIZE = 4;
export const TURNS_PER_CYCLE = 5;
/**
 * A new fruit is offered after every `PICK_EVERY`th turn of a cycle (after turns 2 and 4), not after each one: a cycle deals 20
 * fruit, and a pool that grew by four a cycle soon held more than that, so fruit the player had chosen never came up.
 */
export const PICK_EVERY = 2;
/** The boss jar's peg: a round post in the middle of the jar that splits the pile, on every third cycle. */
export const PEG = { x: 320, y: 236, r: 22 };
export const BOSS_EVERY = 3;

/** Whether a cycle is played in a boss jar. */
export function bossCycle(cycle: number): boolean {
  return cycle % BOSS_EVERY === 0;
}

/**
 * The boss jars. The Peg jar has a round post in the middle that splits the pile. In the Blind jar the hand is covered: it
 * drops as it was dealt, and you cannot see or order it. The Tilted jar leans, and everything in it rolls to the low side. The
 * Flip jar has a lid on, and its gravity turns over after every second drop: the pile falls to the lid, then back to the floor.
 */
export type Boss = "peg" | "blind" | "tilt" | "flip";
export const BOSS_NAME: Readonly<Record<Boss, string>> = { peg: "Peg jar", blind: "Blind jar", tilt: "Tilted jar", flip: "Flip jar" };
const BOSS_RULE: Readonly<Record<Boss, string>> = { peg: "A post splits the pile.", blind: "The hand is covered.", tilt: "Everything rolls right.", flip: "Gravity flips every 2 drops." };
const BOSSES: readonly Boss[] = ["blind", "peg", "tilt", "flip"];
/** In the Flip jar, how many fruit drop between one turn of its gravity and the next. */
export const FLIP_EVERY = 2;

/** The boss jar a run meets: one of them, by its seed. */
export function bossFor(seed: number): Boss {
  return BOSSES[Math.abs(seed) % BOSSES.length] as Boss;
}

/** How far the Tilted jar leans to the right, in degrees, and how hard that pulls its fruit sideways, in pixels per second per
 * second: gravity's share along the jar's floor. The fruit are moved in the jar's own frame, where its walls stand straight,
 * and the whole jar is drawn leaning. */
export const TILT = 6;
export const TILT_PULL = Math.round(GRAVITY * Math.sin((TILT * Math.PI) / 180));

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
/** Seconds between drops in a hand, at the least: the next fruit also waits for the pile to have been calm for `DROP_CALM`
 * seconds, but no longer than `DROP_LIMIT` since the last drop (a pile that will not rest cannot stall a hand). */
const DROP_GAP = 0.35;
const DROP_CALM = 0.2;
const DROP_LIMIT = 3;
/** A fruit slower than this (px/s) is calm: it has landed, and the next of the hand may drop. */
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

export type Phase = "order" | "drop" | "settle" | "tally" | "pick" | "rent" | "shop" | "preserve" | "over" | "won";

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
  kind: "boom";
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
  for (let i = 0; i < HAND_SIZE; i++) {
    if (run.draw.length === 0) {
      run.draw = rng.shuffle(run.discard);
      run.discard = [];
    }
    const next = run.draw.shift();
    if (next === undefined) break;
    run.hand.push(next);
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
  return say(run, x, y, text, points);
}

/** A popup at (x, y): kept inside the jar's walls and under its rim, and moved clear of any popup already there, so two never sit on each other. */
function say(run: Run, x: number, y: number, text: string, points = 0): Popup {
  const half = Math.min((JAR.right - JAR.left) / 2, text.length * POPUP_CHAR) / 2 + 4;
  const px = Math.max(JAR.left + half, Math.min(JAR.right - half, x));
  // It rises while it shows, and should still be inside the jar when it fades: one that would start too near the rim (a pile up to
  // the top, or the Flip jar's pile lying on its lid) starts lower, over the fruit, and makes room downwards.
  const top = RIM + POPUP_RISE * POPUP_LIFE + 4;
  const step = y < top ? POPUP_LINE : -POPUP_LINE;
  let py = Math.max(y, top);
  for (let tries = 0; tries < 6 && run.popups.some((p) => Math.abs(p.x - px) < besides(p.text, text) && Math.abs(p.y - py) < POPUP_LINE); tries++) py += step;
  const popup: Popup = { id: run.nextId++, x: px, y: py, text, life: POPUP_LIFE, delay: 0, points };
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
  const f = run.fruits[i] as Fruit;
  // Doubled by a Lemon it touches, or by Coconut milk it sits in (once, not twice over).
  const doubled = boosted(run.fruits, links, i) || (run.milk && soaked(run, f));
  const popup = score(run, points * (doubled ? 2 : 1), f.x, f.y - f.r, { label, doubled, earner: FRUITS[f.kind].name });
  if (popup === null) return null;
  const boosters = doubled ? (links[i] ?? []).map((j) => run.fruits[j] as Fruit).filter((o) => o.kind === "lemon") : [];
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
 * The hand drops a fruit at a time: the next one waits until the last has landed and the pile it set moving (its merges and
 * blasts too) has come to rest, so what each fruit scored can be seen before the next adds to it.
 */
function dropStep(run: Run, dt: number): void {
  run.dropTimer -= dt;
  run.dropWait += dt;
  const calm = run.fruits.every((f) => f.landed && f.speed < CALM_SPEED && !f.lit);
  run.calmTime = calm ? run.calmTime + dt : 0;
  const ready = run.fruits.length === 0 || run.calmTime >= DROP_CALM || run.dropWait >= DROP_LIMIT;
  const flip = bossNow(run) === "flip";
  if (run.dropTimer <= 0 && ready && run.queue.length > 0 && flip && run.drops > 0 && run.drops % FLIP_EVERY === 0 && run.flipped === (Math.floor(run.drops / FLIP_EVERY) % 2 === 0)) {
    // The Flip jar: every second drop its gravity turns over, and the pile is left to fall and come to rest before the next.
    run.flipped = !run.flipped;
    run.message = run.flipped ? "Gravity flips: everything falls to the lid" : "Gravity flips back";
    run.dropTimer = DROP_GAP;
    run.dropWait = 0;
    run.calmTime = 0;
  } else if (TRAY.on && run.dropTimer <= 0 && run.queue.length > 0) {
    trayRelease(run, flip);
  } else if (run.dropTimer <= 0 && ready && run.queue.length > 0) {
    const kind = run.queue.shift() as FruitKind;
    const r = FRUITS[kind].radius;
    const rng = new Rng(run.seed);
    const x = rng.range(JAR.left + r, JAR.right - r);
    run.seed = rng.seed;
    // Under its lid, a fruit starts inside the jar, at the end it will fall away from.
    const y = !flip ? DROP_Y : run.flipped ? JAR.floor - r - 2 : RIM + r + 2;
    run.fruits.push(makeFruit(run, kind, x, y));
    run.drops += 1;
    run.discard.push(kind);
    run.dropTimer = DROP_GAP;
    run.dropWait = 0;
    run.calmTime = 0;
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

/** The tray drop (`TRAY`): every fruit left in the queue appears at once, one per lane, left to right. */
function trayRelease(run: Run, flip: boolean): void {
  const lanes = Math.max(HAND_SIZE, run.queue.length);
  const width = (JAR.right - JAR.left) / lanes;
  const rng = new Rng(run.seed);
  run.queue.forEach((kind, lane) => {
    const r = FRUITS[kind].radius;
    const middle = JAR.left + width * (lane + 0.5);
    const x = Math.max(JAR.left + r, Math.min(JAR.right - r, middle + rng.range(-TRAY.wobble, TRAY.wobble)));
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
  merge(run);
  light(run);
  burn(run, dt);
}

function land(run: Run): void {
  const near = links(run.fruits);
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
    if (f.kind === "peach") {
      // It bounces once, and shoves what it landed on away to each side.
      kick(f, 0, -PEACH_BOUNCE);
      for (const j of near[i] ?? []) {
        const o = run.fruits[j] as Fruit;
        kick(o, (o.x < f.x ? -1 : 1) * PEACH_SHOVE, -PEACH_SHOVE / 3);
      }
    }
  });
}

/** How hard a Peach bounces when it lands, and shoves each fruit it landed on sideways (px/s). */
const PEACH_BOUNCE = 380;
const PEACH_SHOVE = 180;

/** A Kiwi touching a landed fruit of another kind becomes a copy of it: a new fruit where it was, which lands and scores as one. */
function copyKiwis(run: Run): void {
  const near = links(run.fruits);
  run.fruits = run.fruits.map((f, i) => {
    if (f.kind !== "kiwi") return f;
    const on = (near[i] ?? []).map((j) => run.fruits[j] as Fruit).find((o) => o.landed && o.kind !== "kiwi");
    if (on === undefined) return f;
    return makeFruit(run, on.kind, f.x, f.y);
  });
}

function canMerge(f: Fruit): boolean {
  return f.landed && (FRUITS[f.kind].mergesInto !== undefined || f.kind === "watermelon" || f.kind === "pomegranate");
}

function merge(run: Run): void {
  const near = links(run.fruits);
  const gone = new Set<number>();
  const born: Fruit[] = [];
  for (let i = 0; i < run.fruits.length; i++) {
    const a = run.fruits[i] as Fruit;
    if (gone.has(a.id) || !canMerge(a) || nearLemon(run.fruits, near, i)) continue;
    for (const j of near[i] ?? []) {
      const b = run.fruits[j] as Fruit;
      if (j <= i || gone.has(b.id) || b.kind !== a.kind || !canMerge(b) || nearLemon(run.fruits, near, j)) continue;
      gone.add(a.id);
      gone.add(b.id);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      if (a.kind === "watermelon") {
        score(run, 100, mx, my, { label: "Merge" });
        run.message = "Two Watermelons: +100!";
      } else if (a.kind === "pomegranate") {
        born.push(...burst(run, mx, my));
        run.message = "Pomegranates Burst!";
      } else {
        // A Merge that touches a Dragonfruit skips a size, when there is one to skip to.
        const next = FRUITS[a.kind].mergesInto as FruitKind;
        const dragon = [...(near[i] ?? []), ...(near[j] ?? [])].map((k) => run.fruits[k] as Fruit).find((o) => o.kind === "dragonfruit");
        const into = dragon === undefined ? next : (FRUITS[next].mergesInto ?? next);
        if (dragon !== undefined) pulse(dragon);
        const f = makeFruit(run, into, mx, my);
        f.landed = true;
        // Rot does not stop a Merge, and a Merge does not cut it out.
        f.rotten = f.rotten || a.rotten || b.rotten;
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
}

/** Five cherries where a Pomegranate was, already landed (they were in the pile). */
function burst(run: Run, x: number, y: number): Fruit[] {
  const out: Fruit[] = [];
  for (let k = 0; k < 5; k++) {
    const angle = (k / 5) * Math.PI * 2;
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
      const weight = (near[i] ?? []).reduce((sum, j) => sum + FRUITS[(run.fruits[j] as Fruit).kind].touchWeight, 0);
      if (weight >= 4) {
        ignite(f, 0.3);
        // What set it off lights up.
        for (const j of near[i] ?? []) pulse(run.fruits[j] as Fruit);
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
  for (const bomb of ready) if (run.fruits.includes(bomb)) explode(run, bomb);
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
    if (f.kind === "chili" || f.kind === "durian") {
      // Caught in the blast: it goes off a moment later (a chain).
      if (!f.lit) ignite(f, 0.15);
      kept.push(f);
      continue;
    }
    victims.push(f);
    const value = FRUITS[f.kind].scoring === "booster" || f.rotten ? 0 : FRUITS[f.kind].points;
    points += (value + (BLAST_BONUS[bomb.kind] ?? 0)) * (doubled.has(f.id) ? 2 : 1);
    if (f.kind === "pomegranate") born.push(...burst(run, f.x, f.y));
    if (f.kind === "fig" && f.rotten) figs += 1;
    if (f.kind === "lime") limes += 1;
    if (f.kind === "seed") {
      const rng = new Rng(run.seed);
      const sprout = makeFruit(run, rng.pick(SPROUTS), f.x, f.y);
      run.seed = rng.seed;
      sprout.landed = true;
      born.push(sprout);
    }
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

/** The jar has settled: spill what is over the rim, Simmer fruit score, age and rot, then the pick (or rent after turn 5). */
export function resolve(run: Run): void {
  // What the tally shows one after another: each popup and each fruit to light up, with its place in the order.
  const staged: { popup: Popup | null; fruits: Fruit[]; links: Link[]; slot: number }[] = [];
  let slot = 0;
  const popupsBefore = run.popups.length;
  // The Flip jar has its lid on: nothing spills from it.
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

  // The Juicer crushes what stands on the floor: each scores its points (nothing if rotten) and a bonus, and is gone.
  if (run.items.includes("juicer")) {
    const crushed = run.fruits.filter((f) => f.landed && onFloor(f));
    for (const f of crushed) score(run, (f.rotten ? 0 : FRUITS[f.kind].points) + JUICER_BONUS, f.x, f.y - f.r, { label: "Crush" });
    if (crushed.length > 0) {
      run.fruits = run.fruits.filter((f) => !crushed.includes(f));
      run.message = `Juicer: ${crushed.length} fruit Crushed`;
      const limes = crushed.filter((f) => f.kind === "lime").length;
      if (limes > 0) {
        pour(run, "lime", limes * LIME_JUICE);
        run.message = `Juicer: ${crushed.length} fruit Crushed. Lime juice rises`;
      }
    }
  }

  const near = links(run.fruits);
  run.fruits.forEach((f, i) => {
    const touched = (near[i] ?? []).map((j) => run.fruits[j] as Fruit);
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
    slot += 1;
    // A Prune's score is for the rot round it: a line from each rotten neighbour.
    const rot = f.kind === "prune" ? touched.filter((o) => o.rotten).map((o) => link(run, "rot", o, f)) : [];
    staged.push({ popup: earned.popup, fruits: earned.fruits, links: [...earned.links, ...rot], slot });
  });

  // Each Fruit Fly eats one rotten fruit it touches (never a Prune) and a new Fly hatches where it was.
  const eaten = new Set<number>();
  const hatched: Fruit[] = [];
  run.fruits.forEach((f, i) => {
    if (f.kind !== "fruitfly") return;
    const meal = (near[i] ?? []).map((j) => run.fruits[j] as Fruit).find((o) => o.rotten && o.kind !== "prune" && !eaten.has(o.id));
    if (meal === undefined) return;
    eaten.add(meal.id);
    const earned = earn(run, near, i, FRUITS.fruitfly.points, "Eat");
    slot += 1;
    staged.push({ popup: earned?.popup ?? null, fruits: earned?.fruits ?? [f], links: [link(run, "eat", f, meal), ...(earned?.links ?? [])], slot });
    const fly = makeFruit(run, "fruitfly", meal.x, meal.y);
    fly.landed = true;
    hatched.push(fly);
  });
  if (eaten.size > 0) {
    run.fruits = [...run.fruits.filter((f) => !eaten.has(f.id)), ...hatched];
    run.message = `Fruit Flies Eat ${eaten.size} Rotten fruit`;
  }

  // Each Pitaya eats one Cherry it touches, and every Pitaya scores 1 more from then on.
  const swallowed = new Set<number>();
  for (const f of run.fruits) {
    if (f.kind !== "pitaya" || f.rotten) continue;
    const cherry = run.fruits.find((o) => o.kind === "cherry" && !swallowed.has(o.id) && f.touching.includes(o.id));
    if (cherry === undefined) continue;
    swallowed.add(cherry.id);
    run.pitayaBonus += 1;
    slot += 1;
    staged.push({ popup: null, fruits: [f], links: [link(run, "eat", f, cherry)], slot });
  }
  if (swallowed.size > 0) {
    run.fruits = run.fruits.filter((f) => !swallowed.has(f.id));
    run.message = `Pitayas Eat ${swallowed.size}: each scores +${run.pitayaBonus}`;
  }

  // A Coconut that has sat 3 turns cracks open and is gone, leaving its milk in the jar.
  const cracked = run.fruits.filter((f) => f.kind === "coconut" && f.age >= COCONUT_TURNS - 1);
  if (cracked.length > 0) {
    run.fruits = run.fruits.filter((f) => !cracked.includes(f));
    pour(run, "milk", cracked.length * COCONUT_MILK);
    run.message = "A Coconut cracked: milk in the jar";
  }

  // Each Snow Pear freezes itself and every fruit it touches, where they are.
  for (const f of run.fruits) {
    if (f.kind !== "snowpear") continue;
    const fresh = [f, ...run.fruits.filter((o) => f.touching.includes(o.id))].filter((o) => !o.frozen);
    if (fresh.length === 0) continue;
    for (const o of fresh) o.frozen = true;
    slot += 1;
    staged.push({ popup: null, fruits: fresh, links: fresh.filter((o) => o !== f).map((o) => link(run, "freeze", f, o)), slot });
  }

  // Each Honeydew honeys one fruit it touches.
  for (const f of run.fruits) {
    if (f.kind !== "honeydew" || f.rotten) continue;
    const next = run.fruits.find((o) => !o.honeyed && !o.rotten && f.touching.includes(o.id));
    if (next) {
      next.honeyed = true;
      slot += 1;
      staged.push({ popup: null, fruits: [f, next], links: [link(run, "honey", f, next)], slot });
    }
  }

  // Age; Bananas rot after 3 turns, and each rotten fruit, Prunes too, rots one fruit it touches (never a Lemon or a Fruit Fly).
  for (const f of run.fruits) {
    if (f.pickled) continue;
    f.age += 1;
    if (f.kind === "banana" && f.age >= BANANA.rots && !f.rotten) f.rotten = true;
  }
  const rotten = run.fruits.filter((f) => f.rotten);
  for (const r of rotten) {
    const next = run.fruits.find((o) => !o.rotten && !o.pickled && o.kind !== "lemon" && o.kind !== "fruitfly" && r.touching.includes(o.id));
    if (next) {
      next.rotten = true;
      slot += 1;
      staged.push({ popup: null, fruits: [next], links: [link(run, "rot", r, next)], slot });
    }
  }

  // Time the tally: a step between each thing, shorter when there are many, and how long the whole takes.
  const step = Math.min(TALLY_STEP, TALLY_MOST / Math.max(1, slot));
  const shown: Popup[] = run.popups.slice(popupsBefore).filter((p) => !staged.some((s) => s.popup === p));
  for (const s of staged) {
    const delay = s.slot * step;
    if (s.popup !== null) {
      s.popup.delay = delay;
      clearOf(s.popup, shown);
      shown.push(s.popup);
    }
    for (const f of s.fruits) pulse(f, delay);
    for (const l of s.links) l.delay = delay;
  }
  run.tallyTime = run.popups.length > popupsBefore || slot > 0 ? slot * step + TALLY_HOLD : 0;
  run.scoreNote = 0;

  run.bestTurn = Math.max(run.bestTurn, run.turnScore);
  run.turnScore = 0;

  if (run.turn >= TURNS_PER_CYCLE) {
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
  run.seed = rng.seed;
  run.offerCursor = -1;
  run.phase = "pick";
}

function pickStep(run: Run, keys: Keys): void {
  const move = (keys.right || keys.down ? 1 : 0) - (keys.left || keys.up ? 1 : 0);
  // No card is chosen until the player chooses one (the cursor is -1): an arrow goes to the first, the pointer to the one it is on.
  const pointed = keys.point >= 0 && keys.point < run.offers.length;
  // A tap on a card that was not the chosen one only chooses it, so what it does can be read; a second tap takes it. With a
  // mouse the card is chosen as the pointer comes over it, so one click takes it.
  const fresh = pointed && keys.point !== run.offerCursor;
  // A tap anywhere else puts the chosen card back: nothing is chosen, and its tooltip goes.
  if (keys.away === true) run.offerCursor = -1;
  const to = pointed ? keys.point : move === 0 ? run.offerCursor : Math.max(0, Math.min(run.offers.length - 1, run.offerCursor + move));
  if (to !== run.offerCursor) {
    run.offerCursor = to;
    sound(run, "tick");
  }
  if (keys.confirm && !fresh && run.offerCursor >= 0) {
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

/** What earned the run's points, the most first: the fruit and keywords that scored, at most `count` of them, none that lost points. */
export function topEarners(run: Run, count: number): { label: string; points: number }[] {
  return Object.entries(run.earned)
    .map(([label, points]) => ({ label, points }))
    .filter((e) => e.points > 0)
    .sort((a, b) => b.points - a.points || a.label.localeCompare(b.label))
    .slice(0, count);
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
  run.message = next === null ? "The shop is open" : `Next cycle: the ${BOSS_NAME[next]}`;
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
  // As in the pick: nothing is chosen at first (-1), an arrow goes to the first card, and a tap on a card that was not the
  // chosen one only chooses it, so it can be read before it is bought. The three actions say all they do, and act on one tap.
  const pointed = keys.point >= 0 && keys.point <= SHOP_LEAVE;
  const fresh = pointed && keys.point !== shop.cursor && keys.point <= SHOP_ITEM;
  // As in the pick, a tap anywhere else leaves nothing chosen.
  if (keys.away === true) shop.cursor = -1;
  let to = pointed ? keys.point : shop.cursor < 0 ? (across !== 0 || down !== 0 ? 0 : -1) : Math.max(0, Math.min(SHOP_LEAVE, shop.cursor + across));
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
  if (!keys.confirm || fresh || shop.cursor < 0) return;
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

/** Out of the shop: with a Preserves Jar and fruit in the jar, choose what to keep; otherwise the next cycle. */
function leaveShop(run: Run): void {
  run.shop = null;
  run.kept = [];
  if (keeps(run) === 0 || run.fruits.length === 0) {
    nextCycle(run);
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
  if (keys.confirm) {
    const id = (fruits[run.preserveCursor] as Fruit).id;
    if (run.kept.includes(id)) run.kept = run.kept.filter((k) => k !== id);
    else if (run.kept.length < keeps(run)) run.kept.push(id);
    else run.message = `It holds ${keeps(run)}: let one go first`;
    sound(run, "tick");
  } else if (keys.drop) {
    nextCycle(run);
  }
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
