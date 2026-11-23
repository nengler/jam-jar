import assert from "node:assert/strict";
import { test } from "node:test";

import { motes, rayLight } from "../src/layout.ts";

// The god rays (assets/god-rays.glsl) are a shader, which the software renderer the tests use does not run. `rayLight` is the
// same shafts worked out in TypeScript, for the motes of dust that drift through them: these check it.

test("the god rays' light, as the motes of dust catch it, comes in four steps, bright where a shaft comes in and gone by the floor", () => {
  const seen = new Set<number>();
  for (let x = 0; x < 640; x += 8) for (let y = 0; y < 360; y += 8) seen.add(rayLight(x, y, 3));
  for (const v of seen) assert.ok([0, 0.25, 0.5, 0.75, 1].includes(v), `a step: ${v}`);
  assert.ok([...seen].some((v) => v >= 0.5), "some of the room is in a shaft");
  assert.equal(rayLight(2, 356, 3), 0, "none reaches the bottom left corner, the far side from where they come in");
  // The motes in the brighter part of a shaft are drawn lit.
  for (const m of motes(3)) assert.equal(m.lit, rayLight(m.x, m.y, 3) >= 0.5);
});
