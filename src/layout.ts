import { FRUITS, type FruitKind } from "./rules/fruits.ts";
import { BOSS_NAME, bossNow, newRun, RENT, type Run } from "./rules/jar.ts";
import { KEYWORDS, keywordsIn } from "./rules/terms.ts";

/** One kind of fruit in the pool, and how many of it the pool holds. */
export interface PoolRow {
  kind: FruitKind;
  count: number;
}

/** The pool by kind, in the fruit table's order (Cherry, Grape, …): only the kinds it holds. */
export function poolRows(pool: readonly FruitKind[]): PoolRow[] {
  const rows: PoolRow[] = [];
  for (const kind of Object.keys(FRUITS) as FruitKind[]) {
    const count = pool.filter((k) => k === kind).length;
    if (count > 0) rows.push({ kind, count });
  }
  return rows;
}

/** How many of a kind a list of fruit holds: on the whole-pool board, how many of it are still to be dealt this shuffle. */
export function countOf(fruit: readonly FruitKind[], kind: FruitKind): number {
  let count = 0;
  for (const k of fruit) if (k === kind) count++;
  return count;
}

/** A keyword and what it means, for a card's tooltip. */
export interface Term {
  id: string;
  name: string;
  text: string;
}

/** Every keyword in a card's text, in the order it appears, with what it means: the boxes of the tooltip beside the card. */
export function termsOf(text: string): Term[] {
  return keywordsIn(text).map((keyword) => ({ id: keyword, name: KEYWORDS[keyword].name, text: KEYWORDS[keyword].text }));
}


/** Whether a run is at rest at a point the player acts from: where it is kept for "Continue" (GameState.ts, `save`). */
export function atRest(run: Run): boolean {
  return run.phase === "order" || run.phase === "pick" || run.phase === "rent" || run.phase === "shop" || run.phase === "preserve";
}

/** The moment of a run whose keys a hint row shows, for `learned` in the game's state: "" when there are none to show. */
export function moment(run: Run): string {
  if (run.phase === "order" || run.phase === "pick" || run.phase === "preserve") return run.phase;
  if (run.phase === "shop") return run.shop?.removing === true ? "remove" : "shop";
  return "";
}

/** The run the play screen starts with: the one read from the player's files (a copy: the game state's is not to be changed), or a new one. */
export function startingRun(saved: unknown, seed: number): Run {
  return saved === null || saved === undefined ? newRun(seed) : (JSON.parse(JSON.stringify(saved)) as Run);
}


/** A mote of dust in the kitchen's air: where it is, and which of the two shades it is drawn in. */
export interface Mote {
  id: number;
  x: number;
  y: number;
  shade: 0 | 1;
}

/** How many motes, and the height of the wall they rise through before starting again at the bottom. */
const MOTES = 14;
const MOTE_FIELD = 316;

/**
 * The motes at a time, in seconds: each rises at its own slow speed, swaying a little, and wraps to the bottom of the wall. They
 * are worked out from the time alone (no state, nothing random), so a replay shows the same air.
 */
export function motes(time: number): Mote[] {
  const out: Mote[] = [];
  for (let id = 0; id < MOTES; id++) {
    const speed = 5 + ((id * 7) % 6);
    const start = (id * 97) % MOTE_FIELD;
    const sway = Math.sin(time * (0.3 + (id % 5) * 0.07) + id * 1.7) * 6;
    const rise = (start + time * speed) % MOTE_FIELD;
    out.push({ id, x: Math.round(((id * 151 + 23) % 640) + sway), y: Math.round(MOTE_FIELD - rise), shade: id % 3 === 0 ? 1 : 0 });
  }
  return out;
}

/** A card in a row: what is on it, and its place in the row (a mouse handler reads the place from the card, not from the list). */
export interface Placed<T> {
  at: number;
  card: T;
}

export function placed<T>(cards: readonly T[]): Placed<T>[] {
  return cards.map((card, at) => ({ at, card }));
}

/** The rent board's heading: which cycle of the run this is, named for its boss jar if it is one ("Blind jar 3 of 5"). */
export function cycleTitle(run: Run): string {
  const boss = bossNow(run);
  return `${boss === null ? "Cycle" : BOSS_NAME[boss]} ${run.cycle} of ${RENT.length}`;
}

/** Where a point in the jar is on screen when the jar leans by `angle` radians about its low right corner (`cx`, `cy`). */
export function leanX(x: number, y: number, angle: number, cx: number, cy: number): number {
  return angle === 0 ? x : cx + (x - cx) * Math.cos(angle) - (y - cy) * Math.sin(angle);
}
export function leanY(x: number, y: number, angle: number, cx: number, cy: number): number {
  return angle === 0 ? y : cy + (x - cx) * Math.sin(angle) + (y - cy) * Math.cos(angle);
}

/**
 * Where things in the jar are on screen when the jar leans by `angle` radians about its low right corner (`cx`, `cy`): the same
 * things, moved. For what is drawn over a leaning jar but stays upright itself, like the score popups.
 */
export function leaned<T extends { x: number; y: number }>(things: readonly T[], angle: number, cx: number, cy: number): T[] {
  if (angle === 0) return things.slice();
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return things.map((t) => ({ ...t, x: cx + (t.x - cx) * cos - (t.y - cy) * sin, y: cy + (t.x - cx) * sin + (t.y - cy) * cos }));
}

/** How many letters a heading's wave passes a second, and the longest it waits before the next one starts, in seconds. */
const RIPPLE_SPEED = 7;
const RIPPLE_WAIT = 3.5;
/** How high the wave lifts a letter at its crest, in pixels, and how many letters the wave is across. */
const WAVE_HEIGHT = 2;
const WAVE_WIDTH = 4;

/** A number from 0 up to 1 that looks random, the same each time for the same `n`: which wave of a heading waits how long. */
function chance(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** A heading's letter as it is drawn now: how far it is lifted, in whole pixels, and whether the glint is on it. */
export interface RippleLetter {
  at: number;
  letter: string;
  lift: number;
  lit: boolean;
}

/**
 * A heading's letters as they are drawn now. Every few seconds, a different wait each time, a soft wave runs along the
 * heading: each letter rises a pixel or two as it passes and settles again, and the one on the crest catches the light. The
 * letters move by whole pixels and are never stretched, so the pixel lettering stays crisp. `seed` sets one heading's waits
 * apart from another's. A space is a letter too, so the wave crosses it in step.
 */
export function ripple(text: string, time: number, seed: number): RippleLetter[] {
  const letters = [...text];
  // Time is cut into turns, each long enough for one pass and the longest wait; the pass starts a random way into its turn.
  const pass = (letters.length + WAVE_WIDTH) / RIPPLE_SPEED;
  const turn = pass + RIPPLE_WAIT;
  const which = Math.floor(time / turn);
  const since = time - which * turn - chance(which + seed * 13) * RIPPLE_WAIT;
  // Where the wave's crest is, in letters: from before the first to past the last.
  const crest = since < 0 || since > pass ? Number.NEGATIVE_INFINITY : since * RIPPLE_SPEED - WAVE_WIDTH / 2;
  return letters.map((letter, at) => {
    const away = Math.abs(at - crest);
    const lift = away < WAVE_WIDTH / 2 ? Math.round(WAVE_HEIGHT * Math.cos((away / (WAVE_WIDTH / 2)) * (Math.PI / 2))) : 0;
    return { at, letter, lift, lit: away < 0.6 };
  });
}

/**
 * How much more every fruit of a kind scores each turn than its card says, for what the run has grown: Bananas (a rotten Fig
 * blown up) and Pitayas (a Cherry eaten). Growth is the kind's, not one fruit's: every Banana or Pitaya has it, in the jar now
 * and dropped later.
 */
export function grownOf(run: Run, kind: FruitKind): number {
  return kind === "banana" ? run.bananaBonus : kind === "pitaya" ? run.pitayaBonus : 0;
}

/**
 * Which fruit on the shelf a point across is over: the shelf's places stand `slot` apart from `left`, and each fruit takes `spans`
 * of them in turn (a Wide one 2). -1 for an empty shelf.
 */
export function shelfSlot(x: number, left: number, slot: number, spans: readonly number[]): number {
  if (spans.length === 0) return -1;
  const place = Math.floor((x - left) / slot);
  let end = 0;
  for (let at = 0; at < spans.length; at++) {
    end += spans[at] as number;
    if (place < end) return at;
  }
  return spans.length - 1;
}

/** The middle of a fruit on the shelf, in places from the shelf's left end: half way along the places it takes. */
export function shelfMiddle(at: number, spans: readonly number[]): number {
  let start = 0;
  for (let i = 0; i < at; i++) start += spans[i] as number;
  return start + (spans[at] ?? 1) / 2;
}

/** Where a fruit on the shelf is drawn across: in its place, or under the pointer (kept over the shelf) while it is dragged. */
export function shelfX(at: number, left: number, slot: number, spans: readonly number[], dragged: boolean, pointerX: number): number {
  const home = left + shelfMiddle(at, spans) * slot;
  const half = ((spans[at] ?? 1) * slot) / 2;
  const width = spans.reduce((sum, span) => sum + span, 0) * slot;
  return dragged ? Math.max(left + half, Math.min(left + width - half, pointerX)) : home;
}

/** A number counting up to `total` over `seconds`, fast at first and slowing as it arrives: what the end board's total shows at `time`. */
export function countUp(total: number, time: number, seconds: number): number {
  const t = Math.max(0, Math.min(1, time / seconds));
  return Math.round(total * (1 - (1 - t) * (1 - t) * (1 - t)));
}

/** The fruit an end board's earner is, when it is one (earners are named: "Apple"), or null for a keyword ("Merge"). */
export function earnerKind(label: string): FruitKind | null {
  for (const kind of Object.keys(FRUITS) as FruitKind[]) if (FRUITS[kind].name === label) return kind;
  return null;
}

/** The kind at a place of the whole-pool board, or null when none is chosen there (-1) or the place is gone. */
export function kindAt(rows: readonly PoolRow[], at: number): FruitKind | null {
  return rows[at]?.kind ?? null;
}

/**
 * A run's opening, in seconds from its start: the boards pop in from the sides, the shelf comes down, the jar falls into its
 * place and bounces, and then the first hand rolls onto the shelf. It is only drawn: the run can be played from its first step.
 */
export const INTRO = { left: 0, right: 0.25, shelf: 0.5, jar: 0.8, fall: 1.1, hand: 2.0, end: 3.2, pop: 0.7 } as const;

/** 0 to 1 over `seconds` from `at`, overshooting a little before it settles: how a board pops into place. */
export function popIn(time: number, at: number, seconds: number): number {
  const t = Math.max(0, Math.min(1, (time - at) / seconds));
  const back = 1.70158;
  return 1 + (back + 1) * (t - 1) ** 3 + back * (t - 1) ** 2;
}

/** Seconds the jar takes to lean over as a Tilted jar's cycle begins, or to stand up again after it. */
export const TILT_TIME = 0.8;

/** How far the jar is drawn leaning, in radians, `time` after it set off from `from` towards `to`: it rocks a little past and settles back, as a board pops in. */
export function tilted(from: number, to: number, time: number): number {
  return from + (to - from) * popIn(time, 0, TILT_TIME);
}

/** How far above its place the jar is, in pixels, `time` into its fall from `from` above: it lands and bounces twice, less each time. */
export function jarDrop(time: number, from: number): number {
  const t = Math.max(0, Math.min(1, time / INTRO.fall));
  // The classic bounce: three arcs, each lower.
  const n = 7.5625;
  const d = 2.75;
  const eased = t < 1 / d ? n * t * t : t < 2 / d ? n * (t - 1.5 / d) ** 2 + 0.75 : t < 2.5 / d ? n * (t - 2.25 / d) ** 2 + 0.9375 : n * (t - 2.625 / d) ** 2 + 0.984375;
  return from * (1 - eased);
}

/** Seconds a fruit takes to roll along the shelf to its place, and how long after the one before it each sets off. */
const ROLL_TIME = 0.7;
const ROLL_GAP = 0.14;

/**
 * How far right of its place a fruit of a newly dealt hand still is, `time` after the deal: each rolls in from `from` pixels to the
 * right, the leftmost first, slowing as it arrives. 0 once it is there.
 */
export function rollIn(time: number, at: number, from: number): number {
  const t = Math.max(0, Math.min(1, (time - at * ROLL_GAP) / ROLL_TIME));
  return from * (1 - t) ** 3;
}

/** Whether a fruit of a newly dealt hand has set off along the shelf yet: it is not drawn before, so none waits in view. */
export function rollStarted(time: number, at: number): boolean {
  return time >= at * ROLL_GAP;
}

/** A piece of a blast drawn for a moment: a spark thrown out of it, or a dot of the ring that runs out from it. */
export interface BlastBit {
  id: string;
  x: number;
  y: number;
  size: number;
  /** Which of the blast's colours: 0 the lightest (the ring, and the hottest sparks), up to 3. */
  shade: number;
}

const SPARKS = 14;
const RING_DOTS = 20;
/** Seconds the ring takes to run out to its full size, in pixels, and how hard the sparks fall (px/s²). */
const RING_TIME = 0.28;
const RING_SIZE = 84;
const SPARK_FALL = 520;

/**
 * What a blast throws out, `age` seconds into it, besides its own picture: sparks flying off every way, slowing and falling
 * and going out one by one, and a ring of dots running out from the middle. Each spark's way and speed come from the blast's
 * `id`, so the same blast always looks the same (a replay, a test).
 */
export function blastBits(blasts: readonly { id: number; x: number; y: number; age: number }[], life: number): BlastBit[] {
  const bits: BlastBit[] = [];
  for (const b of blasts) {
    for (let i = 0; i < SPARKS; i++) {
      const lasts = life * (0.55 + 0.45 * chance(b.id * 31 + i));
      if (b.age >= lasts) continue;
      const angle = (i / SPARKS) * Math.PI * 2 + chance(b.id * 17 + i) * 0.6;
      const speed = 150 + 190 * chance(b.id * 7 + i * 3);
      // Thrown hard and slowing: most of the way is covered early.
      const t = b.age;
      const far = speed * t * (1 - (0.45 * t) / life);
      bits.push({
        id: `${b.id}s${i}`,
        x: Math.round(b.x + Math.cos(angle) * far),
        y: Math.round(b.y + Math.sin(angle) * far + (SPARK_FALL * t * t) / 2),
        size: t < lasts * 0.35 ? 6 : t < lasts * 0.7 ? 4 : 2,
        shade: Math.min(3, Math.floor((t / lasts) * 3) + (i % 2)),
      });
    }
    if (b.age < RING_TIME) {
      const out = b.age / RING_TIME;
      const radius = 12 + RING_SIZE * (1 - (1 - out) * (1 - out));
      for (let i = 0; i < RING_DOTS; i++) {
        const angle = (i / RING_DOTS) * Math.PI * 2;
        bits.push({ id: `${b.id}r${i}`, x: Math.round(b.x + Math.cos(angle) * radius), y: Math.round(b.y + Math.sin(angle) * radius), size: out < 0.6 ? 4 : 2, shade: 0 });
      }
    }
  }
  return bits;
}

/** Seconds a blast lights the whole jar for, and jolts it. */
const FLASH_TIME = 0.1;
const JOLT_TIME = 0.22;

/** How bright the jar is lit by its blasts now, 0 to 1: a flash at the instant of each. */
export function blastFlash(blasts: readonly { age: number }[]): number {
  return blasts.reduce((most, b) => Math.max(most, 1 - b.age / FLASH_TIME), 0);
}

/** How far the jar is knocked out of its place by its blasts now, in pixels: a jolt that rattles and dies away. */
export function blastJolt(blasts: readonly { age: number }[]): number {
  return blasts.reduce((sum, b) => sum + (b.age < JOLT_TIME ? 3 * (1 - b.age / JOLT_TIME) * Math.cos(b.age * 90) : 0), 0);
}

/**
 * A screen's entrance, in seconds from when it comes up: its parts come in one after another, as a run's opening does. `at(n)`
 * is when the nth part starts.
 */
export const ENTER = { pop: 0.6, gap: 0.12, jar: 0.5 } as const;

/** 1 once the nth part of a screen's entrance has come in, 0 before: its opacity, so the parts pop in one by one. */
export function entered(time: number, n: number, from = 0): number {
  return time >= from + n * ENTER.gap ? 1 : 0;
}

/** The name of the kind chosen in the take-out dialog (a row of the pool's kinds), or "" when none is. */
export function chosenName(rows: readonly PoolRow[], at: number): string {
  const kind = rows[at]?.kind;
  return kind === undefined ? "" : FRUITS[kind].name;
}

/** The banner that crosses the screen as a cycle's last turn begins: seconds to come in, to hold, and to go out. */
export const SWEEP = { in: 0.18, hold: 0.9, out: 0.2 } as const;
export const SWEEP_TIME = SWEEP.in + SWEEP.hold + SWEEP.out;

/**
 * Where the last turn's banner is, `time` seconds after the turn began: how far its words are from the middle of the screen
 * (they shoot in from the left, drift a little while they are read, and shoot out to the right) and how open its band is, 0
 * to 1 (it snaps open and shut). `shown` is false before and after.
 */
export function sweep(time: number): { shown: boolean; x: number; open: number } {
  if (time < 0 || time >= SWEEP_TIME) return { shown: false, x: 0, open: 0 };
  if (time < SWEEP.in) {
    const t = time / SWEEP.in;
    return { shown: true, x: -520 * (1 - t) * (1 - t) - 12, open: t };
  }
  if (time < SWEEP.in + SWEEP.hold) return { shown: true, x: -12 + (24 * (time - SWEEP.in)) / SWEEP.hold, open: 1 };
  const t = (time - SWEEP.in - SWEEP.hold) / SWEEP.out;
  return { shown: true, x: 12 + 520 * t * t, open: 1 - t };
}

/** Whether a clock passed `at` in a step that took it from `before` to `after`: when a sound of an entrance is played. */
export function crossed(before: number, after: number, at: number): boolean {
  return before < at && after >= at;
}

/**
 * Which of a row of things coming in one after another arrived in a step that took the clock from `before` to `after`: the first
 * at `start`, each next one `gap` later, `count` of them. -1 for none. Each plays the next bloop up.
 */
export function arrived(before: number, after: number, start: number, gap: number, count: number): number {
  for (let n = 0; n < count; n++) if (crossed(before, after, start + n * gap)) return n;
  return -1;
}

/** Whether a fruit of a newly dealt hand rolled to its place in a step that took the hand's clock from `before` to `after`. */
export function rolledIn(before: number, after: number, count: number): boolean {
  return arrived(before, after, ROLL_TIME * 0.75, ROLL_GAP, count) >= 0;
}

/** When the jar (or the title's name) first touches down, in seconds into its fall: the first of the bounce's three arcs. */
export const LANDS = INTRO.fall / 2.75;

/**
 * How each fruit did over a run, for the end board: every kind that scored itself (one made by a merge too), with what it scored,
 * best first (in the fruit table's order when level). A kind that scored nothing, or was never played, is left out.
 */
export function fruitResults(run: Run): { kind: FruitKind; points: number }[] {
  const kinds = (Object.keys(FRUITS) as FruitKind[]).filter((kind) => (run.earned[FRUITS[kind].name] ?? 0) !== 0);
  const order = Object.keys(FRUITS);
  return kinds
    .map((kind) => ({ kind, points: run.earned[FRUITS[kind].name] ?? 0 }))
    .sort((a, b) => b.points - a.points || order.indexOf(a.kind) - order.indexOf(b.kind));
}

/** What scored over a run that is not a fruit's own: the keywords (Merge, Explode, Spill …), with what each came to, biggest first. */
export function keywordResults(run: Run): { label: string; points: number }[] {
  return Object.entries(run.earned)
    .filter(([label, points]) => earnerKind(label) === null && points !== 0)
    .map(([label, points]) => ({ label, points }))
    .sort((a, b) => b.points - a.points || a.label.localeCompare(b.label));
}
