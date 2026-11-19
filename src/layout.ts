import { FRUITS, type FruitKind } from "./rules/fruits.ts";
import { ITEMS, type ItemKind } from "./rules/items.ts";
import { newRun, type Run } from "./rules/jar.ts";
import { glossary, keywordsIn } from "./rules/terms.ts";
import { LEGENDARY_CHIP, SCORING } from "./theme.ts";

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

/** A fruit's chip: how it scores, and for a Fresh fruit how much ("Fresh 3"). */
export function scoringLabel(kind: FruitKind): string {
  const def = FRUITS[kind];
  if (def.legendary === true) return "Legendary";
  return def.scoring === "fresh" ? `Fresh ${def.points}` : def.scoring === "simmer" ? "Simmer" : "Booster";
}

/** What a fruit's keywords mean, for under its card: its scoring type first, then those in its text. Nothing for no fruit. */
export function fruitGlossary(kind: FruitKind | null | undefined, most: number): string[] {
  if (kind == null) return [];
  return glossary(keywordsIn(FRUITS[kind].text, [FRUITS[kind].scoring]), most);
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

/** The colour of a fruit's chip: its scoring type's, or a Legendary's own. */
export function chipColor(kind: FruitKind): string {
  return FRUITS[kind].legendary === true ? LEGENDARY_CHIP : SCORING[FRUITS[kind].scoring].color;
}
