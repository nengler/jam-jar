import { Entity, Flex, Text, useTime, type Child } from "@tsengine/runtime/jsx";

import { popIn, ripple } from "./layout.ts";

import { DISPLAY, DISPLAY_SIZE, GOLD, INK, LIGHT, PANEL, PANEL_SLICE, SIGN, SIGN_SLICE, BOARD_SHADOW, WELL } from "./theme.ts";

/** How far a titled board's frame starts below its top: the heading takes the top of the space the board is given. */
const TITLE_ROOM = 12;

/**
 * A board on the kitchen wall: Kenney's parchment in a wooden frame (UI Pack - Pixel Adventure, recoloured to Apollo) and the
 * shadow it casts, as a box that lays its children out in a column. It takes the width of the box it is in and is as tall as
 * what is on it, so nothing on it is placed by counting pixels from the screen's corner, and it cannot be too short for them.
 * `title` is a heading lettered on the wall just above it. A dialog over the game is a `Dialog`, whose heading is on a sign.
 */
export function Panel({ title, image = PANEL, gap = 0, children }: { title?: string; image?: string; gap?: number; children: Child }) {
  return (
    <Flex direction="column" alignItems="stretch" paddingTop={title === undefined ? 0 : TITLE_ROOM}>
      {/* The shadow, pinned a little down and right of the frame; then the frame over it. */}
      <Flex left={4} right={-4} top={(title === undefined ? 0 : TITLE_ROOM) + 4} bottom={-4} background={BOARD_SHADOW} />
      <Flex direction="column" alignItems="stretch" gap={gap} paddingX={16} paddingTop={6} paddingBottom={10} backgroundImage={image} slice={PANEL_SLICE}>
        {children}
      </Flex>
      {title !== undefined && (
        <Flex left={0} right={0} top={-18} height={HEADING_H} direction="row" justifyContent="center">
          <Letters text={title} seed={title.length * 7} />
        </Flex>
      )}
    </Flex>
  );
}

/** A dialog's sign: how tall it is, how much of it stands above the board, and the room left round its lettering. */
const SIGN_H = 36;
const SIGN_ABOVE = 18;
const SIGN_PAD = 18;
/** As a dialog opens its sign drops into place from this far up, overshooting a little, over this long. */
const SIGN_DROP = 26;
const SIGN_DROP_TIME = 0.45;

/**
 * A dialog over the game (the pool, taking a fruit out, the rent, the pause menu, the end of a run): the parchment board, with
 * room round what is on it, and its name lettered on a wooden sign nailed across its top edge, as the shop's heading is. The
 * sign drops into place as the dialog opens, and a wave runs along its letters now and then, as along every heading's. It takes
 * the width of the box it is in and is as tall as what is on it. `still`: the sign is in place from the start, for a dialog shown
 * while the game is paused (the pause menu), whose time does not run.
 */
export function Dialog({ title, gap = 6, still = false, children }: { title: string; gap?: number; still?: boolean; children: Child }) {
  const time = useTime();
  return (
    <Flex direction="column" alignItems="stretch" paddingTop={SIGN_ABOVE}>
      <Flex left={4} right={-4} top={SIGN_ABOVE + 4} bottom={-4} background={BOARD_SHADOW} />
      <Flex direction="column" alignItems="stretch" gap={gap} paddingX={20} paddingTop={SIGN_H - SIGN_ABOVE + 10} paddingBottom={16} backgroundImage={PANEL} slice={PANEL_SLICE}>
        {children}
      </Flex>
      <Flex left={0} right={0} top={0} height={SIGN_H} direction="row" justifyContent="center" y={still ? 0 : -SIGN_DROP * (1 - popIn(time, 0, SIGN_DROP_TIME))}>
        <Flex height={SIGN_H} paddingX={SIGN_PAD} direction="row" alignItems="center" backgroundImage={SIGN} slice={SIGN_SLICE}>
          <Letters text={title} seed={title.length * 5} />
        </Flex>
      </Flex>
    </Flex>
  );
}

/** A thin rule across a dialog, between what is on it. */
export function Rule() {
  return <Flex height={2} background={WELL} />;
}

/** The room a heading's line takes, and the width of a space in it. */
const HEADING_H = 32;
const HEADING_SPACE = 8;

/**
 * A heading's letters: light lettering with a dark shadow, straight on what is behind it, in a row as wide as they are. Every
 * few seconds a soft wave runs along it, each letter rising a pixel or two as it passes, with a glint of gold on the crest:
 * something small that moves, so the wall is not all still. `seed` staggers one heading's wave from another's.
 */
export function Letters({ text, seed }: { text: string; seed: number }) {
  const time = useTime();
  return (
    <Flex height={HEADING_H} direction="row">
      {ripple(text, time, seed).map((l) => (
        <Flex key={l.at} height={HEADING_H} minWidth={l.letter === " " ? HEADING_SPACE : 0}>
          {l.letter !== " " && (
            <Entity y={-l.lift}>
              <Text font={DISPLAY} size={DISPLAY_SIZE} color={l.lit ? GOLD : LIGHT} shadow={INK} shadowX={2} shadowY={2}>
                {l.letter}
              </Text>
            </Entity>
          )}
        </Flex>
      ))}
    </Flex>
  );
}
