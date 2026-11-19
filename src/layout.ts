import { FRUITS, type FruitKind } from "./rules/fruits.ts";

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

/** A fruit's line on a card, without the scoring word ("Simmer: ") it starts with. */
export function offerText(text: string): string {
  const rest = text.replace(/^(Simmer|Booster): /, "");
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}
