import { Sprite } from "@tsengine/runtime/jsx";

import type { FruitKind } from "./rules/fruits.ts";
import { FLAT_FRUIT, FRUIT_LIGHT, FRUIT_LIGHT_PARAMS, fruitImage, fruitImageMiddle, FROZEN, HONEYED, LIGHT, LIGHT_TABLE, PICKLED, ROTTEN } from "./theme.ts";

interface FruitBallProps {
  kind: FruitKind;
  /** Where its centre is, in the parent's space. */
  x: number;
  y: number;
  rotten?: boolean;
  /** Coated in honey: tinted gold. */
  honeyed?: boolean;
  /** Kept by a Pickling Jar: tinted green. */
  pickled?: boolean;
  /** Frozen by a Snow Pear: tinted ice blue. */
  frozen?: boolean;
  /** About to explode: drawn flashing. */
  lit?: boolean;
  /** How far it has rolled, in degrees. */
  turn?: number;
  /** Lit up, 0 to 1: a softer flash than `lit`, fading as what caused it passes. */
  glow?: number;
}

/**
 * A fruit, centred on (x, y): its pixel sprite (art/fruit), doubled with no smoothing by tools/make-assets.py. A rotten
 * fruit is tinted brown, a honeyed one gold; a lit one flashes. A fruit drawn flat (FLAT_FRUIT) is lit from the top right of the
 * screen as it is drawn, whichever way it has turned.
 */
export function FruitBall({ kind, x, y, rotten = false, honeyed = false, pickled = false, frozen = false, lit = false, glow = 0, turn = 0 }: FruitBallProps) {
  const half = fruitImageMiddle(kind);
  return (
    <Sprite
      image={fruitImage(kind)}
      x={x}
      y={y}
      originX={half}
      originY={half}
      rotation={turn}
      tint={frozen ? FROZEN : rotten ? ROTTEN : pickled ? PICKLED : honeyed ? HONEYED : undefined}
      flash={lit ? 0.85 : glow * 0.7}
      flashColor={LIGHT}
      shader={FLAT_FRUIT.has(kind) ? FRUIT_LIGHT : ""}
      lookup={LIGHT_TABLE}
      params={FRUIT_LIGHT_PARAMS}
    />
  );
}
