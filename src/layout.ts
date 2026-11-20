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

/** How many letters a heading's ripple passes a second, and the longest it waits before the next one starts, in seconds. */
const RIPPLE_SPEED = 4;
const RIPPLE_WAIT = 2.5;

/** A number from 0 up to 1 that looks random, the same each time for the same `n`: which ripple of a heading waits how long. */
function chance(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * A heading's letters, each with how far it is lifted now, in pixels: a ripple runs slowly through the heading, one letter
 * hopping up an art pixel as it passes, then after a short wait, a different length each time, it runs again. `seed` sets
 * one heading's waits apart from another's. A space is a letter too, so the ripple crosses it in step.
 */
export function ripple(text: string, time: number, seed: number): { at: number; letter: string; lift: number }[] {
  const letters = [...text];
  // Time is cut into turns, each long enough for one pass and the longest wait; the pass starts a random way into its turn.
  const turn = letters.length / RIPPLE_SPEED + RIPPLE_WAIT;
  const which = Math.floor(time / turn);
  const since = time - which * turn - chance(which + seed * 13) * RIPPLE_WAIT;
  const front = since < 0 ? -1 : Math.floor(since * RIPPLE_SPEED);
  return letters.map((letter, at) => ({ at, letter, lift: at === front ? 2 : 0 }));
}

/**
 * How much more every fruit of a kind scores each turn than its card says, for what the run has grown: Bananas (a rotten Fig
 * blown up) and Pitayas (a Cherry eaten). Growth is the kind's, not one fruit's: every Banana or Pitaya has it, in the jar now
 * and dropped later.
 */
export function grownOf(run: Run, kind: FruitKind): number {
  return kind === "banana" ? run.bananaBonus : kind === "pitaya" ? run.pitayaBonus : 0;
}

/** Which place on the shelf a point across is nearest: the shelf's fruit stand `slot` apart from `left`, `count` of them. -1 for an empty shelf. */
export function shelfSlot(x: number, left: number, slot: number, count: number): number {
  return count === 0 ? -1 : Math.max(0, Math.min(count - 1, Math.floor((x - left) / slot)));
}

/** Where a fruit on the shelf is drawn across: in its place, or under the pointer (kept over the shelf) while it is dragged. */
export function shelfX(at: number, left: number, slot: number, count: number, dragged: boolean, pointerX: number): number {
  const home = left + at * slot + slot / 2;
  return dragged ? Math.max(left + slot / 2, Math.min(left + count * slot - slot / 2, pointerX)) : home;
}

/** The pick's prompt, the same way: before a card is chosen, and once one is. */
export function pickNote(keys: boolean, chosen: boolean): string {
  if (keys) return chosen ? "Enter takes it" : "Left / Right chooses a card";
  return chosen ? "Tap it again to take it" : "Tap a card to see what it does";
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
export const INTRO = { left: 0, right: 0.1, shelf: 0.2, jar: 0.3, fall: 0.6, hand: 0.95, end: 1.7, pop: 0.35 } as const;

/** 0 to 1 over `seconds` from `at`, overshooting a little before it settles: how a board pops into place. */
export function popIn(time: number, at: number, seconds: number): number {
  const t = Math.max(0, Math.min(1, (time - at) / seconds));
  const back = 1.70158;
  return 1 + (back + 1) * (t - 1) ** 3 + back * (t - 1) ** 2;
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
const ROLL_TIME = 0.45;
const ROLL_GAP = 0.07;

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
