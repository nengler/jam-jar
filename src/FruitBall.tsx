import { Sprite } from "@tsengine/runtime/jsx";

import { FRUITS, type FruitKind } from "./rules/fruits.ts";

/** The icons' size in pixels (tools/make-assets.py). */
const ICON = 14;

interface FruitBallProps {
  kind: FruitKind;
  /** Where its centre is, in the parent's space. */
  x: number;
  y: number;
  rotten?: boolean;
  /** About to explode: drawn flashing white. */
  lit?: boolean;
  /** The small picture for the hand and pick lists, instead of the fruit at its size in the jar. */
  icon?: boolean;
}

/**
 * A fruit, centred on (x, y): its Fluent Emoji picture (tools/fluent), scaled to its size by tools/make-assets.py. A rotten fruit
 * is tinted brown; a lit one flashes white.
 */
export function FruitBall({ kind, x, y, rotten = false, lit = false, icon = false }: FruitBallProps) {
  const half = icon ? ICON / 2 : FRUITS[kind].radius + 1;
  return (
    <Sprite
      image={icon ? `icon-${kind}.png` : `fruit-${kind}.png`}
      x={x}
      y={y}
      originX={half}
      originY={half}
      tint={rotten ? "#8a6a50" : undefined}
      flash={lit ? 0.85 : 0}
      flashColor="white"
    />
  );
}
