import { Entity, Sprite, useMutable, useUpdate } from "@tsengine/runtime/jsx";

/** The gingham's tile, in pixels (Pattern Pack Pixel at 2x), and how fast it drifts, in pixels per second. */
const TILE = 32;
const DRIFT = 6;

/**
 * The backdrop behind every screen: Kenney's pixel gingham (Pattern Pack Pixel) in three deep Apollo reds, like the cloth over a
 * jam jar's lid, drifting slowly down and to the right. The picture is a tile bigger than the screen each way, so moving it by
 * less than a tile and wrapping shows no seam.
 */
export function Backdrop() {
  const s = useMutable({ time: 0 });
  useUpdate((dt) => {
    s.time = (s.time + dt) % (TILE / DRIFT);
  });
  const shift = Math.floor(s.time * DRIFT);
  return (
    <Entity x={shift - TILE} y={shift - TILE}>
      <Sprite image="gingham.png" />
    </Entity>
  );
}
