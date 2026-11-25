import { Entity, Layer, Shape, Sprite, useTime } from "@tsengine/runtime/jsx";

import { motes, WALL_SWIRL } from "./layout.ts";
import { MOTE } from "./theme.ts";

/** The wallpaper's tile, in pixels, and how fast it drifts, in pixels a second: slow enough to be felt more than seen. */
const TILE = 32;
const DRIFT = 5;

/**
 * The backdrop behind every screen: a kitchen. Its wall is a slow swirl of paint in two navy blues and their neighbours (a
 * shader, over trellis wallpaper from Kenney's Pattern Pack Pixel, which is what shows where shaders do not run), with a few
 * motes of dust rising through the air in front of it, and a wooden counter along the bottom that the jar stands on. The
 * wallpaper's picture is a tile bigger than the screen each way, so moving it by less than a tile and wrapping shows no seam.
 */
export function Backdrop() {
  const time = useTime();
  const shift = Math.floor((time * DRIFT) % TILE);
  return (
    <Entity>
      {/* The wall: a slow swirl of paint in its navy blues (assets/swirl.glsl). Where shaders do not run (tests, screenshots) it
          is the plain wallpaper it is painted over. */}
      <Layer shader="swirl.glsl" params={WALL_SWIRL}>
        <Sprite image="wall.png" x={shift - TILE} y={shift - TILE} />
      </Layer>
      {motes(time).map((m) => (
        <Shape key={m.id} kind="rect" x={m.x} y={m.y} width={2} height={2} color={MOTE[m.shade]} />
      ))}
      <Sprite image="counter.png" />
    </Entity>
  );
}
