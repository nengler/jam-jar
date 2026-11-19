import { Entity, Flex, Shape, Text } from "@tsengine/runtime/jsx";

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
      {title !== undefined && <Heading x={width / 2} y={-16} width={width - 8} text={title} />}
      {heading !== undefined && (
        <Text x={width / 2} y={8} align="center" font={DISPLAY} size={DISPLAY_SIZE} color={INK}>
          {heading}
        </Text>
      )}
    </Entity>
  );
}

/** A heading: light lettering with a dark shadow, straight on what is behind it, centred on `x`, its top at `y`. */
export function Heading({ x, y, text }: { x: number; y: number; width: number; text: string }) {
  return (
    <Text x={x} y={y} align="center" font={DISPLAY} size={DISPLAY_SIZE} color={LIGHT} shadow={INK} shadowX={2} shadowY={2}>
      {text}
    </Text>
  );
}
