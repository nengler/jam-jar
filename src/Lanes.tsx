import { Entity, Shape } from "@tsengine/runtime/jsx";

import { dashes, lanesOf } from "./layout.ts";
import { HAND_SIZE, handSlots, JAR, RIM, slotsOf, type Run } from "./rules/jar.ts";
import { GOLD, LIGHT } from "./theme.ts";

/** How strongly a lane's line is drawn, and the band of the chosen fruit's lane (as wide as the fruit). */
const LINE = 0.14;
const BAND = 0.1;
/** The line is dashed: this much drawn, this much not. */
const DASH = 4;
const GAP = 6;
const DASHES = dashes(RIM + 4, JAR.floor, DASH, GAP);

/**
 * Where the hand will fall, while it is being ordered. With `lines` (the tutorial's lessons about the shelf), a faint dashed
 * line down the jar under each fruit, at the middle of its lane: that is the one thing to learn, and after it they are only in
 * the way. With `held` (a fruit is picked up or dragged), a band as wide as that fruit down its lane, so moving it along the
 * shelf shows what it will come down on: a Wide Pumpkin's two lanes, a Melon's reach. Only drawn.
 */
export function Lanes({ run, lines, held }: { run: Run; lines: boolean; held: boolean }) {
  const lanes = lanesOf(run.hand, JAR.left, JAR.right, Math.max(HAND_SIZE, handSlots(run.hand)), run.hand.map((kind) => slotsOf(kind)));
  return (
    <Entity>
      {lanes.map((lane) => (
        <Entity key={`lane${lane.at}`}>
          {held && lane.at === run.cursor && <Shape kind="rect" x={lane.left} y={RIM} width={lane.right - lane.left} height={JAR.floor - RIM} color={GOLD} opacity={BAND} />}
          {(lines || (held && lane.at === run.cursor)) && DASHES.map((y) => (
            <Shape key={y} kind="rect" x={lane.x - 1} y={y} width={2} height={DASH} color={held && lane.at === run.cursor ? GOLD : LIGHT} opacity={held && lane.at === run.cursor ? LINE * 3 : LINE} />
          ))}
        </Entity>
      ))}
    </Entity>
  );
}
