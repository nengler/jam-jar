import { FRUITS, type FruitKind } from "./rules/fruits.ts";

export interface Placed {
  kind: FruitKind;
  /** From the start of the line, in pixels. */
  x: number;
}

/**
 * The pool on one line: grouped by kind (in the fruit table's order), each kind a little stack (copies 10 pixels apart) and
 * kinds 36 apart, all squeezed to fit `width` when there are many.
 */
export function poolLine(pool: readonly FruitKind[], width: number): Placed[] {
  const order = Object.keys(FRUITS) as FruitKind[];
  const sorted = [...pool].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  const steps: number[] = sorted.map((kind, i) => (i === 0 ? 0 : kind === sorted[i - 1] ? 10 : 36));
  const total = steps.reduce((sum: number, step: number) => sum + step, 0);
  const squeeze = total > width ? width / total : 1;
  let x = 0;
  return sorted.map((kind, i) => {
    x += (steps[i] as number) * squeeze;
    return { kind, x };
  });
}
