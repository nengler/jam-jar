import { Entity, Shape, Text } from "@tsengine/runtime/jsx";

import type { Countdown } from "./layout.ts";
import { FROZEN, INK, LIGHT, ROTTEN } from "./theme.ts";

/** How big the badge is across, in pixels, and its ring. */
const BADGE = 18;
const RING = 2;
/** What colours the ring: ice blue for a thaw, the rot's brown for a Banana, light for a Coconut's crack. */
const RING_COLOR: Readonly<Record<Countdown["what"], string>> = { ice: FROZEN, crack: LIGHT, rot: ROTTEN };

/**
 * How many turns a fruit in the jar has left before something happens to it (`countdowns`): a number in a dark disc with a
 * ring of what it counts down to, at the fruit's lower left, clear of a glaze's badge at its upper right. It does not turn with
 * the fruit, so it can be read.
 */
export function TurnsMark({ mark }: { mark: Countdown }) {
  return (
    <Entity>
      <Shape kind="circle" x={mark.x - BADGE / 2} y={mark.y - BADGE / 2} width={BADGE} height={BADGE} color={RING_COLOR[mark.what]} />
      <Shape kind="circle" x={mark.x - BADGE / 2 + RING} y={mark.y - BADGE / 2 + RING} width={BADGE - RING * 2} height={BADGE - RING * 2} color={INK} />
      <Text x={mark.x - BADGE / 2} y={mark.y - BADGE / 2 - 1} width={BADGE} align="center" color={LIGHT}>{`${mark.turns}`}</Text>
    </Entity>
  );
}
