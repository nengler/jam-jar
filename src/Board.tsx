import { Entity, Flex, Shape, Text } from "@tsengine/runtime/jsx";

import { DISPLAY, DISPLAY_SIZE, INK, LIGHT, PANEL, PANEL_SLICE, RIBBON, WALL_SHADOW } from "./theme.ts";

interface BoardProps {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Its heading, on a red ribbon over its top edge. */
  title?: string;
  /** Another frame than the parchment one. */
  image?: string;
}

/**
 * A board on the kitchen wall: Kenney's parchment in a wooden frame (UI Pack - Pixel Adventure, recoloured to Apollo), the
 * shadow it casts, and a heading on a ribbon across its top. What is on it is drawn over it by whoever places it.
 */
export function Board({ x, y, width, height, title, image = PANEL }: BoardProps) {
  return (
    <Entity x={x} y={y}>
      <Shape kind="rect" x={4} y={4} width={width} height={height} color={WALL_SHADOW} />
      <Flex width={width} height={height} backgroundImage={image} slice={PANEL_SLICE} />
      {title !== undefined && <Heading x={width / 2} y={-14} width={width - 8} text={title} />}
    </Entity>
  );
}

/** A heading on the red ribbon, centred on `x`, its top at `y`. */
export function Heading({ x, y, width, text }: { x: number; y: number; width: number; text: string }) {
  return (
    <Entity x={x - width / 2} y={y}>
      <Flex width={width} height={32} backgroundImage={RIBBON} slice={16} />
      <Text x={width / 2} y={0} align="center" font={DISPLAY} size={DISPLAY_SIZE} color={LIGHT} shadow={INK} shadowX={2} shadowY={2}>
        {text}
      </Text>
    </Entity>
  );
}
