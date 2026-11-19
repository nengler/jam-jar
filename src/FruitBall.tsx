import { Sprite } from "@tsengine/runtime/jsx";

import type { FruitKind } from "./rules/fruits.ts";
import { fruitImage, fruitImageSize, LIGHT, ROTTEN, type FruitLook } from "./theme.ts";

interface FruitBallProps {
  kind: FruitKind;
  /** Where its centre is, in the parent's space. */
  x: number;
  y: number;
  rotten?: boolean;
  /** About to explode: drawn flashing. */
  lit?: boolean;
  /** "jar": its size in the jar (the default); "icon": 32 px, for the shelf and the pool; "big": 64 px, for the pick cards. */
  look?: FruitLook;
}

/**
 * A fruit, centred on (x, y): its pixel sprite (tools/fruit), scaled up with no smoothing by tools/make-assets.py. A rotten
 * fruit is tinted brown; a lit one flashes.
 */
export function FruitBall({ kind, x, y, rotten = false, lit = false, look = "jar" }: FruitBallProps) {
  const half = fruitImageSize(kind, look) / 2;
  return (
    <Sprite
      image={fruitImage(kind, look)}
      x={x}
      y={y}
      originX={half}
      originY={half}
      tint={rotten ? ROTTEN : undefined}
      flash={lit ? 0.85 : 0}
      flashColor={LIGHT}
    />
  );
}
