import { Entity, Shape } from "@tsengine/runtime/jsx";

import type { Glaze } from "./rules/glazes.ts";
import { GLAZE_COLOR, INK, LIGHT } from "./theme.ts";

/** How big a glaze's badge is across, in pixels, and its ring of ink. */
const BADGE = 14;
const RING = 2;

/**
 * The badge a glazed fruit wears (rules/glazes.ts): a drop of its glaze's colour in a ring of ink, with a glint, its middle at
 * (x, y). Draw it at a fruit's top right, after the fruit. It does not turn with the fruit, so it stays where it can be read.
 */
export function GlazeMark({ glaze, x, y }: { glaze: Glaze; x: number; y: number }) {
  return (
    <Entity>
      <Shape kind="circle" x={x - BADGE / 2} y={y - BADGE / 2} width={BADGE} height={BADGE} color={INK} />
      <Shape kind="circle" x={x - BADGE / 2 + RING} y={y - BADGE / 2 + RING} width={BADGE - RING * 2} height={BADGE - RING * 2} color={GLAZE_COLOR[glaze]} />
      <Shape kind="rect" x={x - 2} y={y - 3} width={2} height={2} color={LIGHT} />
    </Entity>
  );
}
