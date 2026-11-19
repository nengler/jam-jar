import { FRUITS, type FruitKind } from "./rules/fruits.ts";

/** The pool in the fruit table's order (all the Cherries, then the Grapes, …), so the same fruit sit next to each other. */
export function sortedPool(pool: readonly FruitKind[]): FruitKind[] {
  const order = Object.keys(FRUITS) as FruitKind[];
  return [...pool].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}
