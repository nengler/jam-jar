import { FRUITS, type FruitKind } from "./rules/fruits.ts";
import { ITEMS, type ItemKind } from "./rules/items.ts";
import { glossary, keywordsIn } from "./rules/terms.ts";

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
