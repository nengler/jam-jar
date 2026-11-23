import { Layer, Shape } from "@tsengine/runtime/jsx";

import { GOD_RAYS } from "./theme.ts";

/**
 * God rays: a few shafts of warm light from the top left (assets/god-rays.glsl), added over the jar and what stands on the counter,
 * under the shelf and the boards. The layer holds only a clear rectangle the size of the screen for the shader to run over, so
 * where shaders do not run (tests, screenshots) it adds nothing.
 */
export function GodRays() {
  return (
    <Layer blend="add" shader="god-rays.glsl" params={[GOD_RAYS]}>
      <Shape kind="rect" width={640} height={360} color="#00000000" />
    </Layer>
  );
}
