import { Entity, Flex, Shape, Text, useTime } from "@tsengine/runtime/jsx";

import { Panel } from "./Board.tsx";
import { TapButton } from "./KeyHint.tsx";
import type { Lesson } from "./rules/tutorial.ts";
import { CARD_SLICE, DIM, GOLD, LIGHT, PLAQUE, SELECT } from "./theme.ts";

/**
 * The tutorial's card, in the first game: one lesson on a dark slate, its title in gold. It does not count the lessons, and it
 * has no button to go on with: it is a helper that speaks up when there is something to say and goes when the player has
 * done it. "No tips" ends the tutorial. It is `width` wide. `wide` lays it out along the foot of the screen, the words beside
 * the button, for where there is no room for a tall card.
 */
export function Coach({ lesson, keys, width, wide = false, onSkip }: { lesson: Lesson; keys: boolean; width: number; wide?: boolean; onSkip: () => void }) {
  return (
    <Flex width={width} direction="column" alignItems="stretch">
      <Panel image={PLAQUE} gap={2}>
        <Flex direction={wide ? "row" : "column"} alignItems={wide ? "center" : "stretch"} gap={wide ? 12 : 2}>
          <Flex direction="column" gap={0}>
            {/* Along the foot of the screen there is room for the words only. */}
            {!wide && (
              <Text color={GOLD}>{lesson.title}</Text>
            )}
            <Text width={wide ? width - 32 - WIDE_BUTTONS : width - 32} maxWidth={wide ? width - 32 - WIDE_BUTTONS : width - 32} color={LIGHT}>
              {keys ? lesson.keysText : lesson.text}
            </Text>
          </Flex>
          {/* The one button ends the tutorial. There is none to go on with: a lesson goes when the player does what it says. */}
          <Flex direction="row" justifyContent="end" paddingTop={wide ? 0 : 6}>
            <TapButton label="No tips" onPress={onSkip} />
          </Flex>
        </Flex>
      </Panel>
    </Flex>
  );
}

/** The room the buttons take beside the words of a `wide` card, with the gap between them. */
const WIDE_BUTTONS = 92;

/**
 * What a lesson is about (the shelf, the jar, a board), picked out: the rest of the screen is dimmed, in four dark pieces
 * around it, and it stands in an amber frame that breathes, so the eye goes there. The dark is only drawn: a tap goes through
 * it to whatever is under. The lesson's card is drawn after this, so it stays lit too.
 */
export function Spotlight({ x, y, width, height }: { x: number; y: number; width: number; height: number }) {
  const time = useTime();
  return (
    <Entity>
      <Shape kind="rect" x={0} y={0} width={640} height={Math.max(0, y)} color={DIM} />
      <Shape kind="rect" x={0} y={y + height} width={640} height={Math.max(0, 360 - y - height)} color={DIM} />
      <Shape kind="rect" x={0} y={y} width={Math.max(0, x)} height={height} color={DIM} />
      <Shape kind="rect" x={x + width} y={y} width={Math.max(0, 640 - x - width)} height={height} color={DIM} />
      <Flex x={x} y={y} width={width} height={height} backgroundImage={SELECT} slice={CARD_SLICE} opacity={0.55 + 0.45 * Math.sin(time * 5)} />
    </Entity>
  );
}
