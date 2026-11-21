import { Entity, Flex, Text, useTime, type Child } from "@tsengine/runtime/jsx";

import { ripple } from "./layout.ts";

import { DISPLAY, DISPLAY_SIZE, GOLD, INK, LIGHT, PANEL, PANEL_SLICE, WALL_SHADOW } from "./theme.ts";

/** How far a titled board's frame starts below its top: the heading takes the top of the space the board is given. */
const TITLE_ROOM = 12;

/**
 * A board on the kitchen wall: Kenney's parchment in a wooden frame (UI Pack - Pixel Adventure, recoloured to Apollo) and the
 * shadow it casts, as a box that lays its children out in a column. It takes the width of the box it is in and is as tall as
 * what is on it, so nothing on it is placed by counting pixels from the screen's corner, and it cannot be too short for them.
 * `title` is a heading lettered on the wall just above it; `heading` a dialog's, in ink at the top of the board itself, since
 * over a busy screen a heading above the board would not read.
 */
export function Panel({ title, heading, image = PANEL, gap = 0, children }: { title?: string; heading?: string; image?: string; gap?: number; children: Child }) {
  return (
    <Flex direction="column" alignItems="stretch" paddingTop={title === undefined ? 0 : TITLE_ROOM}>
      {/* The shadow, pinned a little down and right of the frame; then the frame over it. */}
      <Flex left={4} right={-4} top={(title === undefined ? 0 : TITLE_ROOM) + 4} bottom={-4} background={WALL_SHADOW} />
      <Flex direction="column" alignItems="stretch" gap={gap} paddingX={16} paddingTop={6} paddingBottom={10} backgroundImage={image} slice={PANEL_SLICE}>
        {heading !== undefined && <PanelHeading text={heading} />}
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

/** A dialog's heading, in ink at the top of its board. */
function PanelHeading({ text }: { text: string }) {
  return (
    <Flex direction="row" justifyContent="center" height={30}>
      <Text font={DISPLAY} size={DISPLAY_SIZE} color={INK}>
        {text}
      </Text>
    </Flex>
  );
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
