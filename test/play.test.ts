import assert from "node:assert/strict";
import { test } from "node:test";

import { createPlayer, parseInputScript, RecordingBackend, runScript, type Player } from "@tsengine/player";
import { findComponent } from "@tsengine/testing";

import { bindings, gameConfig } from "../game.ts";
import { useGame } from "../src/GameState.ts";
import { settings } from "../src/settings.ts";
import { JAR, type Fruit, type Run } from "../src/rules/jar.ts";

/** Which screen shows, whether play is paused, and the run's phase and jar when a run is on. */
function seen(player: Player): { screen: string; paused: boolean; phase?: string; fruits?: number; hand?: number; dealt?: number } {
  const { screen, paused } = useGame.getState();
  const play = findComponent("Play", player.world.root) as { s: { run: Run } } | null;
  if (play === null) return { screen, paused };
  const run = play.s.run;
  return { screen, paused, phase: run.phase, fruits: run.fruits.length, hand: run.hand.length, dealt: run.discard.length };
}

test("Play starts a run with a hand of 4; Space drops it into the jar", () => {
  // A fruit drops once the last has landed and come to rest, so a hand of 4 takes a few seconds.
  const frames = parseInputScript("_*2, Enter, _*5, Space, _*300", { bindings });
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

test("Settings: right turns the music up, the sounds' row turns them down, and Escape goes back", () => {
  const frames = parseInputScript("_*2, down, _*2, Enter, _*3, right, _*2, right, _*2, down, _*2, left, _*2, Escape, _*3", { bindings });
  const { states } = runScript(gameConfig, frames, () => useGame.getState());
  assert.equal(settings.get().music, 0.6, "two steps up from 0.4");
  assert.equal(settings.get().effects, 0.7, "one step down from 0.8");
  assert.equal(states[states.length - 1]!.screen, "title");
});

test("a moment's keys are learned once it has been played through: the title, then ordering, then the pick", () => {
  const frames = parseInputScript("_*2, Enter, _*5, Space, _*330, Space, _*10", { bindings });
  const { states } = runScript(gameConfig, frames, () => settings.get().learned);
  assert.deepEqual(states[1], [], "nothing yet: every hint shows");
  assert.deepEqual(states[5], ["title"], "Play was pressed");
  assert.deepEqual(states[12], ["title", "order"], "the first hand was dropped");
  assert.deepEqual(states[states.length - 1], ["title", "order", "pick"], "the first pick was skipped");
});

/** Launch the game on a backend, press these keys, and close it. */
function launch(backend: RecordingBackend, script: string): void {
  const player = createPlayer(backend, { ...gameConfig, warn: () => {} });
  for (const frame of parseInputScript(script, { bindings })) {
    backend.queueInput(frame);
    player.step();
  }
  player.close();
}

test("the settings are kept between launches: the volumes and the keys already shown come back", () => {
  // The first launch: into the settings, the music up a step, and back.
  const first = new RecordingBackend();
  launch(first, "_*2, down, _*2, Enter, _*3, right, _*2, Escape, _*3");
  assert.equal(first.storageOpenedFor, "jam-jar");
  assert.ok(first.stored.has("settings"), "written as they change");

  // The second, with the files the first left: the title is up before the settings are read, and must still follow them.
  const second = new RecordingBackend({ storage: Object.fromEntries(first.stored) });
  const player = createPlayer(second, { ...gameConfig, warn: () => {} });
  second.queueInput(parseInputScript("_", { bindings })[0]!);
  player.step();
  assert.equal(settings.get().music, 0.5);
  assert.deepEqual(useGame.getState().learned, ["title", "settings"], "the title knows its keys were shown");
  assert.equal(useGame.getState().music, 5);
  player.close();
});

test("a chain of Blasts plays in slow motion, then the game runs at full speed again", () => {
  const frames = parseInputScript("_*2, Enter, _*200", { bindings });
  const speeds: number[] = [];
  runScript(gameConfig, frames, (player) => {
    const play = findComponent("Play", player.world.root) as { s: { run: Run } } | null;
    if (play === null) return null;
    // Once the run is on, put two lit Chilis in the jar, far enough apart to go off one after the other.
    if (speeds.length === 0) {
      const chili = (id: number, x: number, fuse: number): Fruit => ({
        ...{ id, kind: "chili", x0: x, y0: JAR.floor - 16, x, y: JAR.floor - 16, r: 14, speed: 0, touching: [], kicks: 0, kickX: 0, kickY: 0 },
        ...{ landed: true, age: 0, rotten: false, pulse: 0, pulseDelay: 0, honeyed: false, pickled: false, frozen: false, lit: true, fuse },
      });
      play.s.run = { ...play.s.run, phase: "settle", hand: [], nextId: 900, fruits: [chili(801, 250, 0.05), chili(802, 390, 0.5)] };
    }
    speeds.push(useGame.getState().speed);
    return null;
  });
  const slowed = speeds.filter((speed) => speed < 1).length;
  assert.ok(slowed > 30, `slow for a while (${slowed} frames)`);
  assert.equal(speeds[0], 1);
  assert.equal(speeds[speeds.length - 1], 1, "and back to full speed");
});

test("a run is kept as it goes and continued from the title after a relaunch, the jar as it was", () => {
  // The first launch: a hand dropped, up to the pick, then closed without a word.
  const first = new RecordingBackend();
  const player = createPlayer(first, { ...gameConfig, warn: () => {} });
  let before: Run | null = null;
  for (const frame of parseInputScript("_*2, Enter, _*5, Space, _*330", { bindings })) {
    first.queueInput(frame);
    player.step();
    const play = findComponent("Play", player.world.root) as { s: { run: Run } } | null;
    if (play !== null) before = play.s.run;
  }
  player.close();
  assert.equal(before!.phase, "pick");
  assert.ok(first.stored.has("run"));

  // The second, on the files the first left: the title offers Continue first, and Enter takes it.
  const second = new RecordingBackend({ storage: Object.fromEntries(first.stored) });
  const again = createPlayer(second, { ...gameConfig, warn: () => {} });
  let after: Run | null = null;
  for (const frame of parseInputScript("_*2, Enter, _*4", { bindings })) {
    second.queueInput(frame);
    again.step();
    const play = findComponent("Play", again.world.root) as { s: { run: Run } } | null;
    if (play !== null) after = play.s.run;
  }
  assert.equal(useGame.getState().hasSave, true);
  assert.equal(after!.phase, "pick");
  assert.equal(after!.cycleScore, before!.cycleScore);
  assert.deepEqual(after!.offers, before!.offers);
  assert.deepEqual(after!.pool, before!.pool);
  assert.equal(after!.fruits.length, before!.fruits.length);
  for (const [i, f] of after!.fruits.entries()) {
    const was = before!.fruits[i]!;
    assert.equal(f.kind, was.kind);
    assert.ok(Math.abs(f.x - was.x) < 2 && Math.abs(f.y - was.y) < 2, `${f.kind} lies where it lay (${f.x}, ${f.y} against ${was.x}, ${was.y})`);
  }
  again.close();
});

test("a run is kept once a hand has been played, and one that ends leaves nothing to continue", () => {
  const backend = new RecordingBackend();
  const player = createPlayer(backend, { ...gameConfig, warn: () => {} });
  const step = (script: string) => {
    for (const frame of parseInputScript(script, { bindings })) {
      backend.queueInput(frame);
      player.step();
    }
  };
  step("_*2, Enter, _*5");
  assert.equal(useGame.getState().hasSave, false, "a run with nothing done yet is not worth keeping");
  step("Space, _*330");
  assert.equal(useGame.getState().hasSave, true, "kept once its first hand has been played");
  // Lose it: the last turn of a cycle with no score.
  const play = findComponent("Play", player.world.root) as unknown as { s: { run: Run } };
  play.s.run = { ...play.s.run, turn: 5, phase: "settle", hand: [], calmTime: 10 };
  step("_*5");
  assert.equal(play.s.run.phase, "over");
  assert.equal(useGame.getState().hasSave, false);
  assert.ok(!backend.stored.has("run"));
  player.close();
});

test("the title shows a jar filling up by itself, and it does not touch what is kept", () => {
  const backend = new RecordingBackend();
  const player = createPlayer(backend, { ...gameConfig, warn: () => {} });
  let most = 0;
  let turned = false;
  for (const frame of parseInputScript("_*600", { bindings })) {
    backend.queueInput(frame);
    player.step();
    const demo = findComponent("DemoJar", player.world.root) as unknown as { s: { run: Run } };
    most = Math.max(most, demo.s.run.fruits.length);
    for (const f of demo.s.run.fruits) assert.ok(f.x - f.r >= JAR.left - 0.5 && f.x + f.r <= JAR.right + 0.5, "inside its walls, wherever the jar is drawn");
    const fruit = findComponent("Fruit", player.world.root) as unknown as { s: { turn: number } } | null;
    turned = turned || (fruit !== null && fruit.s.turn !== 0);
  }
  assert.ok(most >= 4, `fruit pile up (${most})`);
  assert.ok(turned, "and roll as they land on each other");
  assert.equal(useGame.getState().screen, "title");
  assert.equal(useGame.getState().hasSave, false);
  assert.ok(!backend.stored.has("run"), "the demo's run is not kept");
  assert.deepEqual(settings.get().learned, []);
  player.close();
});

test("a Frozen fruit is held where it is: what was under it can go, and it does not fall", () => {
  const backend = new RecordingBackend();
  const player = createPlayer(backend, { ...gameConfig, warn: () => {} });
  const step = (script: string) => {
    for (const frame of parseInputScript(script, { bindings })) {
      backend.queueInput(frame);
      player.step();
    }
  };
  step("_*2, Enter, _*5");
  const play = findComponent("Play", player.world.root) as unknown as { s: { run: Run } };
  const base = play.s.run.fruits;
  const make = (id: number, kind: Fruit["kind"], y: number, frozen: boolean): Fruit => ({
    ...{ id, kind, x0: 320, y0: y, x: 320, y, r: 18, speed: 0, touching: [], kicks: 0, kickX: 0, kickY: 0 },
    ...{ landed: true, age: 0, rotten: false, pulse: 0, pulseDelay: 0, honeyed: false, pickled: false, frozen, lit: false, fuse: 0 },
  });
  // An Apple on the floor, and a frozen one and a loose one in mid air above it.
  play.s.run = { ...play.s.run, phase: "settle", hand: [], nextId: 900, fruits: [...base, make(801, "apple", JAR.floor - 18, false), make(802, "apple", 200, true), make(803, "apple", 140, false)] };
  step("_*90");
  const at = (id: number) => play.s.run.fruits.find((f) => f.id === id);
  assert.ok(Math.abs(at(802)!.y - 200) < 0.01, `the frozen one hangs where it was (y = ${at(802)!.y})`);
  assert.ok(at(803)!.y > 150 && at(803)!.y < 200, `the loose one fell onto it and rests there (y = ${at(803)!.y})`);
  player.close();
});
