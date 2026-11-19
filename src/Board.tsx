import { Entity, Flex, Shape, Text, useTime, type Child } from "@tsengine/runtime/jsx";

import { ripple } from "./layout.ts";

import { DISPLAY, DISPLAY_SIZE, INK, LIGHT, PANEL, PANEL_SLICE, WALL_SHADOW } from "./theme.ts";

interface BoardProps {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Its heading, lettered on the wall just above it. */
  title?: string;
  /** A dialog's heading, in ink at the top of the board itself: over a busy screen a heading above the board would not read. */
  heading?: string;
  /** Another frame than the parchment one. */
  image?: string;
}

/** How far a titled board's frame starts below its `y`: the heading takes the top of the space the board is given. */
const TITLE_ROOM = 12;

/**
 * A board on the kitchen wall: Kenney's parchment in a wooden frame (UI Pack - Pixel Adventure, recoloured to Apollo), the
 * shadow it casts, and a heading above it. What is on it is drawn over it by whoever places it.
 */
export function Board({ x, y, width, height, title, heading, image = PANEL }: BoardProps) {
  const top = title === undefined ? 0 : TITLE_ROOM;
  return (
    <Entity x={x} y={y}>
      <Shape kind="rect" x={4} y={top + 4} width={width} height={height - top} color={WALL_SHADOW} />
      <Flex y={top} width={width} height={height - top} backgroundImage={image} slice={PANEL_SLICE} />
      {title !== undefined && <Heading x={width / 2} y={-18} width={width - 8} text={title} />}
      {heading !== undefined && (
        <Text x={width / 2} y={8} align="center" font={DISPLAY} size={DISPLAY_SIZE} color={INK}>
          {heading}
        </Text>
      )}
    </Entity>
  );
}

/**
 * A board whose size comes from what is on it: the same parchment, shadow and heading as `Board`, as a box that lays its
 * children out in a column. It takes the width it is given by the box it is in and is as tall as its contents, so nothing on it
 * is placed by counting pixels from the screen's corner, and it cannot be too short for them.
 */
export function Panel({ title, image = PANEL, gap = 0, children }: { title?: string; image?: string; gap?: number; children: Child }) {
  return (
    <Flex direction="column" alignItems="stretch" paddingTop={title === undefined ? 0 : TITLE_ROOM}>
      {/* The shadow, pinned a little down and right of the frame; then the frame over it. */}
      <Flex left={4} right={-4} top={(title === undefined ? 0 : TITLE_ROOM) + 4} bottom={-4} background={WALL_SHADOW} />
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

/** The room a heading's line takes, and the width of a space in it. */
const HEADING_H = 32;
const HEADING_SPACE = 8;

/**
 * A heading: light lettering with a dark shadow, straight on what is behind it, centred on `x`, its top at `y`. Every few seconds
 * a ripple runs through it, a letter at a time hopping up an art pixel: something small that moves, so the wall is not all still.
 */
export function Heading({ x, y, width, text }: { x: number; y: number; width: number; text: string }) {
  return (
    <Flex x={x - width / 2} y={y} width={width} height={HEADING_H} direction="row" justifyContent="center">
      <Letters text={text} seed={x + y} />
    </Flex>
  );
}

/** A heading's letters in a row as wide as they are, rippling (see `Heading`); `seed` staggers one heading's ripple from another's. */
export function Letters({ text, seed }: { text: string; seed: number }) {
  const time = useTime();
  return (
    <Flex height={HEADING_H} direction="row">
      {ripple(text, time, seed).map((l) => (
        <Flex key={l.at} height={HEADING_H} minWidth={l.letter === " " ? HEADING_SPACE : 0}>
          {l.letter !== " " && (
            <Entity y={-l.lift}>
              <Text font={DISPLAY} size={DISPLAY_SIZE} color={LIGHT} shadow={INK} shadowX={2} shadowY={2}>
                {l.letter}
              </Text>
            </Entity>
          )}
        </Flex>
      ))}
    </Flex>
  );
}
