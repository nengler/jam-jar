import assert from "node:assert/strict";
import { test } from "node:test";

import { parseInputScript, runScript, type Player } from "@tsengine/player";
import { findComponent } from "@tsengine/testing";

import { bindings, gameConfig } from "../game.ts";
import { useGame } from "../src/GameState.ts";
import { JAR, type Run } from "../src/rules/jar.ts";

/** Which screen shows, whether play is paused, and the run's phase and jar when a run is on. */
function seen(player: Player): { screen: string; paused: boolean; phase?: string; fruits?: number; hand?: number; dealt?: number } {
  const { screen, paused } = useGame.getState();
  const play = findComponent("Play", player.world.root) as { s: { run: Run } } | null;
  if (play === null) return { screen, paused };
  const run = play.s.run;
  return { screen, paused, phase: run.phase, fruits: run.fruits.length, hand: run.hand.length, dealt: run.discard.length };
}

test("Play starts a run with a hand of 4; Space drops it into the jar", () => {
  const frames = parseInputScript("_*2, Enter, _*5, Space, _*120", { bindings });
  const { states } = runScript(gameConfig, frames, seen);
  assert.equal(states[7]!.screen, "play");
  assert.equal(states[7]!.phase, "order");
  assert.equal(states[7]!.hand, 4);
  const last = states[states.length - 1]!;
  assert.equal(last.hand, 0);
  assert.equal(last.dealt, 4, "all four dropped");
  assert.ok(last.fruits! >= 1 && last.fruits! <= 4, "in the jar (some may have merged)");
});

test("on the engine's physics, a turn's fruit fall into the jar, settle and the pick comes up", () => {
  const frames = parseInputScript("_*2, Enter, _*5, Space, _*300", { bindings });
  const runs: Run[] = [];
  runScript(gameConfig, frames, (player) => {
    const play = findComponent("Play", player.world.root) as { s: { run: Run } } | null;
    if (play !== null) runs.push(play.s.run);
    return null;
  });
  const last = runs[runs.length - 1]!;
  assert.equal(last.phase, "pick");
  assert.ok(last.fruits.length >= 1);
  for (const f of last.fruits) {
    assert.ok(f.landed, `${f.kind} landed`);
    assert.ok(f.x - f.r >= JAR.left - 0.5 && f.x + f.r <= JAR.right + 0.5, `${f.kind} inside the walls (x = ${f.x})`);
    assert.ok(f.y + f.r <= JAR.floor + 0.5, `${f.kind} above the floor (y = ${f.y})`);
  }
});

test("Escape pauses the run, and the pause menu's Resume plays on", () => {
  const frames = parseInputScript("_*2, Enter, _*5, Escape, _*5, Enter, _*5", { bindings });
  const { states } = runScript(gameConfig, frames, seen);
  assert.equal(states[13]!.paused, true);
  assert.equal(states[19]!.paused, false);
});

test("Settings: right turns the volume up and Escape goes back", () => {
  const frames = parseInputScript("_*2, down, _*2, Enter, _*3, right, _*2, right, _*2, Escape, _*3", { bindings });
  const { states } = runScript(gameConfig, frames, () => useGame.getState());
  const last = states[states.length - 1]!;
  assert.equal(last.volume, 10);
  assert.equal(last.screen, "title");
});

test("a moment's keys are learned once it has been played through: the title, then ordering, then the pick", () => {
  const frames = parseInputScript("_*2, Enter, _*5, Space, _*330, Space, _*10", { bindings });
  const { states } = runScript(gameConfig, frames, () => useGame.getState().learned);
  assert.deepEqual(states[1], [], "nothing yet: every hint shows");
  assert.deepEqual(states[5], ["title"], "Play was pressed");
  assert.deepEqual(states[12], ["title", "order"], "the first hand was dropped");
  assert.deepEqual(states[states.length - 1], ["title", "order", "pick"], "the first pick was skipped");
});
