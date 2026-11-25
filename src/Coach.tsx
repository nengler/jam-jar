import { Entity, Flex, Shape, Text, useContext, useTime } from "@tsengine/runtime/jsx";

import { Panel } from "./Board.tsx";
import { TapButton } from "./KeyHint.tsx";
import { Lit } from "./lit.ts";
import type { Box } from "./places.ts";
import type { Lesson, LessonTarget } from "./rules/tutorial.ts";
import { CARD_SLICE, DIM, GOLD, LIGHT, PLAQUE, SELECT } from "./theme.ts";

/**
 * The tutorial's card, in the first game: one lesson on a dark slate, its title in gold. It does not count the lessons, and
 * it goes when the player has done what it says: only a lesson that just tells them something (the rent, the pool, the shop) has a
 * "Got it". "No tips" ends the tutorial. It is `width` wide. `wide` lays it out in a strip across the screen, the words beside
 * the buttons, for where there is no room for a tall card (the shop, over its awning).
 */
export function Coach({ lesson, keys, width, wide = false, onNext, onSkip }: { lesson: Lesson; keys: boolean; width: number; wide?: boolean; onNext: () => void; onSkip: () => void }) {
  return (
    <Flex width={width} direction="column" alignItems="stretch">
      <Panel image={PLAQUE} gap={2}>
        <Flex direction={wide ? "row" : "column"} alignItems={wide ? "center" : "stretch"} gap={wide ? 12 : 2}>
          <Flex direction="column" gap={0}>
            {/* In a strip across the screen there is room for the words only. */}
            {!wide && (
              <Text color={GOLD}>{lesson.title}</Text>
            )}
            <Text width={wide ? width - 32 - wideButtons(lesson) : width - 32} maxWidth={wide ? width - 32 - wideButtons(lesson) : width - 32} color={LIGHT}>
              {keys ? lesson.keysText : lesson.text}
            </Text>
          </Flex>
          {/* "No tips" ends the tutorial. Only a lesson that asks for nothing has a "Got it": the others go when the player does what they say. */}
          <Flex direction="row" justifyContent={lesson.told === true ? "space-between" : "end"} gap={wide ? 4 : 0} paddingTop={wide ? 0 : 6}>
            {/* One that holds the jar still is put away with Enter too: the run hears no keys while it stands still. */}
            {lesson.told === true && <TapButton label="Got it" pressKey={lesson.holds === true ? "Enter" : undefined} onPress={onNext} />}
            <TapButton label="No tips" onPress={onSkip} />
          </Flex>
        </Flex>
      </Panel>
    </Flex>
  );
}

/** The room the buttons take beside the words of a `wide` card, with the gap between them: "No tips", and a "Got it" before it if the lesson has one. */
function wideButtons(lesson: Lesson): number {
  return lesson.told === true ? 92 + 86 : 92;
}

/*
 * What a lesson is about (the shelf, the jar, a board), picked out (`Lit`, provided by the play screen): the rest of the screen is
 * dimmed and it stands in an amber frame that breathes, so the eye goes there. The frame hangs off the part's own box (`Frame`);
 * the dark leaves a hole where the part is (`Dim`).
 */

/**
 * The amber frame, round the box of the `<Flex>` it is put in, `pad` pixels out from it on each side (`padTop` and `padBottom` at the
 * head and the foot, where they differ), while `id` is what is picked out. It takes no room and no taps.
 */
export function Frame({ id, pad, padTop, padBottom }: { id: LessonTarget; pad: number; padTop?: number; padBottom?: number }) {
  const lit = useContext(Lit);
  const time = useTime();
  // Always there, and clear while `id` is not picked out: as the component's own box, it is a child of the `<Flex>` it is put in,
  // which is what its edges are measured from.
  return (
    <Flex left={-pad} right={-pad} top={-(padTop ?? pad)} bottom={-(padBottom ?? pad)} backgroundImage={SELECT} slice={CARD_SLICE} opacity={lit !== null && lit === id ? 0.55 + 0.45 * Math.sin(time * 5) : 0} />
  );
}

/**
 * The dark over the game's area while something is picked out, with a hole where that is (`hole`, from `litBox`): four pieces,
 * above, below and either side of it. It is only drawn: a tap goes through it to whatever is under. Put it after what it dims:
 * what comes after it (the lesson's card, the pause button, a fruit's tooltip) stays lit. Nothing here is raised over the dark
 * by its draw order: the whole screen is one layer (Main.tsx), and inside a layer things are drawn in the order they are written.
 */
export function Dim({ hole }: { hole: Box }) {
  const lit = useContext(Lit);
  return (
    <Entity opacity={lit !== null ? 1 : 0}>
      <Shape kind="rect" x={0} y={0} width={640} height={hole.y} color={DIM} />
      <Shape kind="rect" x={0} y={hole.y + hole.height} width={640} height={Math.max(0, 360 - hole.y - hole.height)} color={DIM} />
      <Shape kind="rect" x={0} y={hole.y} width={hole.x} height={hole.height} color={DIM} />
      <Shape kind="rect" x={hole.x + hole.width} y={hole.y} width={Math.max(0, 640 - hole.x - hole.width)} height={hole.height} color={DIM} />
    </Entity>
  );
}
