import { Entity, Flex, Text, useContext, useTime, type Child } from "@tsengine/runtime/jsx";

import { Panel } from "./Board.tsx";
import { TapButton } from "./KeyHint.tsx";
import { Lit } from "./lit.ts";
import type { Lesson, LessonTarget } from "./rules/tutorial.ts";
import { CARD_SLICE, DIM, GOLD, LIGHT, PLAQUE, SELECT } from "./theme.ts";

/**
 * The tutorial's card, in the first game: one lesson on a dark slate, its title in gold. It does not count the lessons, and
 * it goes when the player has done what it says: only a lesson that just tells them something (the rent, the pool) has a
 * "Got it". "No tips" ends the tutorial. It is `width` wide. `wide` lays it out along the foot of the screen, the words beside
 * the button, for where there is no room for a tall card.
 */
export function Coach({ lesson, keys, width, wide = false, onNext, onSkip }: { lesson: Lesson; keys: boolean; width: number; wide?: boolean; onNext: () => void; onSkip: () => void }) {
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
          {/* "No tips" ends the tutorial. Only a lesson that asks for nothing has a "Got it": the others go when the player does what they say. */}
          <Flex direction="row" justifyContent={lesson.told === true ? "space-between" : "end"} paddingTop={wide ? 0 : 6}>
            {/* One that holds the jar still is put away with Enter too: the run hears no keys while it stands still. */}
            {lesson.told === true && <TapButton label="Got it" pressKey={lesson.holds === true ? "Enter" : undefined} onPress={onNext} />}
            <TapButton label="No tips" onPress={onSkip} />
          </Flex>
        </Flex>
      </Panel>
    </Flex>
  );
}

/** The room the buttons take beside the words of a `wide` card, with the gap between them. */
const WIDE_BUTTONS = 92;

/*
 * What a lesson is about (the shelf, the jar, a board), picked out (`Lit`, provided by the play screen): the rest of the screen is
 * dimmed and it stands in an amber frame that breathes, so the eye goes there. Nothing here is placed by hand: the part picked out
 * is drawn above the dark (`Raise`), and its frame hangs off its own box (`Frame`), so both follow it wherever it is laid out.
 */

/** Draw order of a part that is picked out: above the dark, which is drawn at the default, 0, and so after everything else at 0. */
const RAISED = 1;

/** Its children, drawn above the dark while `id` is what is picked out. */
export function Raise({ id, children }: { id: LessonTarget; children: Child }) {
  const lit = useContext(Lit);
  return <Entity z={lit !== null && lit === id ? RAISED : 0}>{children}</Entity>;
}

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
 * The dark over the whole game's area while something is picked out. It is only drawn: a tap goes through it to whatever is
 * under. Put it after what it dims: what comes after it (the lesson's card, the pause button) stays lit, as does what is raised.
 */
export function Dim() {
  const lit = useContext(Lit);
  return <Flex left={0} right={0} top={0} bottom={0} background={DIM} opacity={lit !== null ? 1 : 0} />;
}
