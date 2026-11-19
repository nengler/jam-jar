import { Flex, Shape } from "@tsengine/runtime/jsx";

import { HUD_FRAME } from "./theme.ts";

interface HudBoxProps {
  x: number;
  y: number;
  width: number;
  height: number;
  /** A flat inset in this colour instead of the framed block: a value's well inside a block. */
  inset?: string;
}

/** A HUD block: Kenney's dark slate frame (UI Pack - Pixel Adventure, recoloured to Apollo), or a flat inset inside one. */
export function HudBox({ x, y, width, height, inset }: HudBoxProps) {
  return inset === undefined ? (
    <Flex x={x} y={y} width={width} height={height} backgroundImage={HUD_FRAME} slice={8} />
  ) : (
    <Shape kind="rect" x={x} y={y} width={width} height={height} color={inset} />
  );
}
