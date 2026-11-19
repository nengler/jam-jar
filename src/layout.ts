import { FRUITS, type FruitKind } from "./rules/fruits.ts";
import { ITEMS, type ItemKind } from "./rules/items.ts";
import { newRun, type Run } from "./rules/jar.ts";
import { glossary, KEYWORDS, keywordsIn } from "./rules/terms.ts";

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

/** What a fruit's keywords mean, for under its card: the first `most` of those in its text. Nothing for no fruit. */
export function fruitGlossary(kind: FruitKind | null | undefined, most: number): string[] {
  return kind == null ? [] : glossary(keywordsIn(FRUITS[kind].text), most);
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

/** What an item's keywords mean, for under its card. Nothing for no item. */
export function itemGlossary(item: ItemKind | null, most: number): string[] {
  return item === null ? [] : glossary(keywordsIn(ITEMS[item].text), most);
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
