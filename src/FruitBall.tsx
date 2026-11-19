import { Entity, Shape } from "@tsengine/runtime/jsx";

import { FRUITS, type FruitKind } from "./rules/fruits.ts";

interface FruitBallProps {
  kind: FruitKind;
  /** Where its centre is, in the parent's space. */
  x: number;
  y: number;
  rotten?: boolean;
  /** About to explode: drawn flashing white. */
  lit?: boolean;
  /** Draw at this radius instead of the fruit's own (the hand and pick lists). */
  radius?: number;
}

/** A fruit drawn as a rimmed circle with a highlight, centred on (x, y). Placeholder art until real sprites exist. */
export function FruitBall({ kind, x, y, rotten = false, lit = false, radius }: FruitBallProps) {
  const def = FRUITS[kind];
  const r = radius ?? def.radius;
  const body = lit ? "#ffffff" : rotten ? "#6d4c41" : def.color;
  const rim = rotten ? "#3e2723" : def.rim;
  const shine = Math.max(1, Math.floor(r / 3));
  return (
    <Entity x={x} y={y}>
      <Shape kind="circle" x={-r} y={-r} width={r * 2} height={r * 2} color={rim} />
      <Shape kind="circle" x={-r + 1} y={-r + 1} width={r * 2 - 2} height={r * 2 - 2} color={body} />
      <Shape kind="circle" x={-r / 2} y={-r / 2} width={shine} height={shine} color="#ffffff90" />
    </Entity>
  );
}
