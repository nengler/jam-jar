import { Entity, Layer, Shape, Sprite, useTime } from "@tsengine/runtime/jsx";

import { motes, TITLE_SWIRL } from "./layout.ts";
import { MOTE } from "./theme.ts";

/** The wallpaper's tile, in pixels, and how fast it drifts, in pixels a second: slow enough to be felt more than seen. */
const TILE = 32;
const DRIFT = 5;

/**
 * The backdrop behind every screen: a kitchen. Trellis wallpaper (Kenney's Pattern Pack Pixel) in two navy blues, drifting slowly
 * down and to the right, soft bands of light moving over it (a shader), with a few motes of dust rising through the air in front of it, and a wooden counter along the bottom
 * that the jar stands on. With `swirl` (the title) the wall is a slow swirl of paint in its blues. The wall's picture is a tile bigger than the screen each way, so moving it by less than a tile and
 * wrapping shows no seam. All of it moves by whole pixels.
 */
export function Backdrop({ swirl = false }: { swirl?: boolean }) {
  const time = useTime();
  const shift = Math.floor((time * DRIFT) % TILE);
  return (
    <Entity>
      {/* The wall, with light moving slowly over it (assets/wall.glsl). Where shaders do not run (tests, screenshots) it is the
          plain wall. */}
      {!swirl && (
        <Layer shader="wall.glsl" params={[0.22]}>
          <Sprite image="wall.png" x={shift - TILE} y={shift - TILE} />
        </Layer>
      )}
      {/* The title's wall is a slow swirl of the same blues (assets/swirl.glsl). Where shaders do not run it is the plain wall. */}
      {swirl && (
        <Layer shader="swirl.glsl" params={TITLE_SWIRL}>
          <Sprite image="wall.png" x={shift - TILE} y={shift - TILE} />
        </Layer>
      )}
      {motes(time).map((m) => (
        <Shape key={m.id} kind="rect" x={m.x} y={m.y} width={2} height={2} color={MOTE[m.shade]} />
      ))}
      <Sprite image="counter.png" />
    </Entity>
  );
}
