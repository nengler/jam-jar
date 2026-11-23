import assert from "node:assert/strict";
import { test } from "node:test";

import { createPlayer, playGame, RecordingBackend, type DecodedRecord } from "@tsengine/player";

import { bindings, gameConfig } from "../game.ts";
import { useGame } from "../src/GameState.ts";
import { LIGHT_CHECK_TURNS } from "../src/layout.ts";
import { FLAT_FRUIT, FRUIT_LIGHT_PARAMS } from "../src/theme.ts";
import type { FruitKind } from "../src/rules/fruits.ts";

// The fruit's light (assets/fruit-light.glsl) is a shader, which the software renderer the tests use does not run: these check that
// every flat fruit is drawn through it, with the light table, at every turn, and that the others are not. How it looks is checked on
// the GPU by `npm run check:light`, against test/light/.

type Shaded = Extract<DecodedRecord, { op: "spriteShaded" }>;

/** What the light check (src/LightCheck.tsx) draws, a frame after it is shown. */
function lightCheck(): readonly DecodedRecord[] {
  const backend = new RecordingBackend();
  const player = createPlayer(backend, { ...gameConfig, warn: () => {} });
  player.step();
  useGame.actions().showLightCheck();
  player.step();
  player.step();
  const records = backend.lastFrame.records;
  player.close();
  return records;
}

test("the light check draws every flat fruit through the fruit's light, with the light table, at each of its turns", () => {
  const shaded = lightCheck().filter((r): r is Shaded => r.op === "spriteShaded");
  assert.equal(shaded.length, FLAT_FRUIT.size * LIGHT_CHECK_TURNS.length);
  for (const kind of FLAT_FRUIT) {
    const mine = shaded.filter((r) => r.texture === `assets/fruit-${kind}.png`);
    assert.deepEqual(
      mine.map((r) => Math.round((r.rotation * 180) / Math.PI)),
      LIGHT_CHECK_TURNS,
      `${kind} at each turn`
    );
    for (const r of mine) {
      assert.equal(r.shader, "assets/fruit-light.glsl");
      assert.equal(r.lookup, "assets/light.png");
      assert.deepEqual(r.params.slice(0, FRUIT_LIGHT_PARAMS.length), FRUIT_LIGHT_PARAMS);
    }
  }
});

test("in a run, a fruit is drawn through the light when it is flat, and as it is when its light is drawn in", () => {
  const game = playGame(gameConfig, { bindings }).input("_*2, Enter, _*240");
  const fruit = game.backend.lastFrame.records.filter(
    (r): r is Shaded | Extract<DecodedRecord, { op: "spriteRegion" }> =>
      (r.op === "spriteShaded" || (r.op === "spriteRegion" && r.silhouette !== true)) && r.texture.startsWith("assets/fruit-")
  );
  // The first run's hand (its seed is fixed): two Cherries and an Orange, drawn flat, and a Grape with its light drawn in.
  assert.ok(fruit.some((r) => r.op === "spriteShaded") && fruit.some((r) => r.op === "spriteRegion"), "the hand has both kinds of fruit");
  for (const r of fruit) {
    const kind = r.texture.slice("assets/fruit-".length, -".png".length) as FruitKind;
    assert.equal(r.op === "spriteShaded", FLAT_FRUIT.has(kind), `${kind} is ${FLAT_FRUIT.has(kind) ? "flat" : "drawn in"}`);
  }
});

test("the light table has a row for every palette colour, the fruit's outline among them", async () => {
  const { readFileSync } = await import("node:fs");
  const png = readFileSync(new URL("../assets/light.png", import.meta.url));
  // The width and height are the first two numbers of a PNG's header chunk.
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [5, 46]);
});

test("the god rays' light, as the motes of dust catch it, comes in four steps, bright where a shaft comes in and gone at the far side", async () => {
  const { rayLight, motes } = await import("../src/layout.ts");
  const seen = new Set<number>();
  for (let x = 0; x < 640; x += 8) for (let y = 0; y < 360; y += 8) seen.add(rayLight(x, y, 3));
  for (const v of seen) assert.ok([0, 0.25, 0.5, 0.75, 1].includes(v), `a step: ${v}`);
  assert.ok([...seen].some((v) => v >= 0.5), "some of the room is in a shaft");
  assert.equal(rayLight(636, 356, 3), 0, "none reaches the bottom right corner");
  // The motes in the brighter part of a shaft are drawn lit.
  for (const m of motes(3)) assert.equal(m.lit, rayLight(m.x, m.y, 3) >= 0.5);
});
