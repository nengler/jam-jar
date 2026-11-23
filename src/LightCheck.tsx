import { Entity, Shape, Text } from "@tsengine/runtime/jsx";

import { FruitBall } from "./FruitBall.tsx";
import { LIGHT_CHECK_TURNS, lightCheckRows } from "./layout.ts";
import { FLAT_FRUIT, LIGHT } from "./theme.ts";

/**
 * Not a screen a player reaches: every flat fruit (FLAT_FRUIT) at each of eight turns, so the light can be checked by eye. It
 * should stay on the top right of each one however it is turned. `test/light.test.ts` checks that each is drawn through the
 * light, and `npm run check:light` draws this on the GPU and compares it with test/light/step-2.png.
 */
export function LightCheck() {
  const rows = lightCheckRows([...FLAT_FRUIT], LIGHT_CHECK_TURNS);
  return (
    <Entity>
      <Shape kind="rect" width={640} height={360} color="#394a50" />
      {rows.map((row) => (
        <Entity key={row.kind}>
          <Text x={4} y={row.y - 8} color={LIGHT}>
            {row.kind}
          </Text>
          {row.turns.map((at) => (
            <FruitBall key={at.turn} kind={row.kind} x={at.x} y={row.y} turn={at.radians} />
          ))}
        </Entity>
      ))}
    </Entity>
  );
}
