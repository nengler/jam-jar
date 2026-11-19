import { Entity, Shape } from "@tsengine/runtime/jsx";

import { HUD, HUD_EDGE } from "./theme.ts";

interface HudBoxProps {
  x: number;
  y: number;
  width: number;
  height: number;
  color?: string;
  edge?: string;
}

/**
 * A HUD block: a filled box with a 2-pixel edge and its corners cut by one art pixel, so it reads as pixel art. Drawn from
 * shapes in the palette, not a picture, so it takes any size and colour.
 */
export function HudBox({ x, y, width, height, color = HUD, edge = HUD_EDGE }: HudBoxProps) {
  return (
    <Entity x={x} y={y}>
      <Shape kind="rect" x={2} y={0} width={width - 4} height={height} color={edge} />
      <Shape kind="rect" x={0} y={2} width={width} height={height - 4} color={edge} />
      <Shape kind="rect" x={4} y={2} width={width - 8} height={height - 4} color={color} />
      <Shape kind="rect" x={2} y={4} width={width - 4} height={height - 8} color={color} />
    </Entity>
  );
}
