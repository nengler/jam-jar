import { Layer, Shape } from "@tsengine/runtime/jsx";

import { BACKDROP } from "./theme.ts";

/**
 * The backdrop behind every screen: a full-screen square run through assets/swirl.glsl, a slow swirl in four dark Apollo colours.
 * The software renderer (tests, `tse screenshot`) runs no shaders and shows the square's plain colour instead.
 */
export function Backdrop() {
  return (
    <Layer shader="swirl.glsl" params={[1]}>
      <Shape kind="rect" x={0} y={0} width={640} height={360} color={BACKDROP} />
    </Layer>
  );
}
