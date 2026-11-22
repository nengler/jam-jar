import assert from "node:assert/strict";
import { test } from "node:test";

import { createPlayer, parseInputScript, playGame, RecordingBackend, runScript, type GamePlay, type Player } from "@tsengine/player";
import { getInputDevice } from "@tsengine/runtime";
import { findComponent } from "@tsengine/testing";

import { bindings, gameConfig } from "../game.ts";
import { useGame } from "../src/GameState.ts";
import { settings } from "../src/settings.ts";
import { FRUIT_PRICE, JAR, RIM, type Fruit, type Run } from "../src/rules/jar.ts";

/** Which screen shows, whether play is paused, and the run's phase and jar when a run is on. */
function seen(player: Player): { screen: string; paused: boolean; phase?: string; fruits?: number; hand?: number; dealt?: number } {
  const { screen, paused } = useGame.getState();
  const play = findComponent("Play", player.world.root) as { s: { run: Run } } | null;
  if (play === null) return { screen, paused };
  const run = play.s.run;
  return { screen, paused, phase: run.phase, fruits: run.fruits.length, hand: run.hand.length, dealt: run.discard.length };
}

/** The run of a game in play. */
function runOf(game: GamePlay): Run {
  return (findComponent("Play", game.player.world.root) as unknown as { s: { run: Run } }).s.run;
}

/** A game started from the title: a new run, its first hand on the shelf. */
function startRun(): GamePlay {
  return playGame(gameConfig, { bindings }).input("_*2, Enter, _*5");
}

/** Wait for a hand that was dropped to be played out: the run is at rest where the player acts next (a hand, a pick, the rent, the end). */
function playedOut(game: GamePlay): Run {
  game.stepUntil(() => !["drop", "settle", "tally"].includes(runOf(game).phase));
  return runOf(game);
}

test("Play starts a run with a hand of 4; Space drops it into the jar", () => {
  const game = startRun();
  const first = seen(game.player);
  assert.equal(first.screen, "play");
  assert.equal(first.phase, "order");
  assert.equal(first.hand, 4);
  // A fruit drops once the last has landed and come to rest, so a hand of 4 takes a few seconds.
  game.input("Space, _*2");
  playedOut(game);
  const last = seen(game.player);
  game.close();
  assert.equal(last.phase, "order", "no pick after the first turn: the next hand is dealt");
  assert.equal(last.hand, 4);
  assert.equal(last.dealt, 4, "all four dropped");
  assert.ok(last.fruits! >= 1 && last.fruits! <= 4, "in the jar (some may have merged)");
});

test("on the engine's physics, a turn's fruit fall into the jar, settle and the next hand comes up", () => {
  const game = startRun().input("Space, _*2");
  const last = playedOut(game);
  game.close();
  assert.equal(last.phase, "order");
  assert.equal(last.turn, 2);
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

test("Settings: left turns the sounds down, the next row is the speed, and Escape goes back", () => {
  // The music's row is out while there is no music, so the sounds' is the first.
  const frames = parseInputScript("_*2, down, _*2, Enter, _*3, left, _*2, left, _*2, down, _*2, right, _*2, Escape, _*3", { bindings });
  const { states } = runScript(gameConfig, frames, () => useGame.getState());
  assert.equal(settings.get().effects, 0.6, "two steps down from 0.8");
  assert.equal(settings.get().music, 0.4, "the music's level is kept, untouched");
  assert.equal(settings.get().fast, true, "and the row under it is the speed");
  assert.equal(states[states.length - 1]!.screen, "title");
});

test("a moment's keys are learned once it has been played through: the title, then ordering, then the pick", () => {
  const game = playGame(gameConfig, { bindings }).input("_");
  assert.deepEqual(settings.get().learned, [], "nothing yet: every hint shows");
  game.input("_, Enter, _*5");
  assert.deepEqual(settings.get().learned, ["title"], "Play was pressed");
  game.input("Space, _*2");
  assert.deepEqual(settings.get().learned, ["title", "order"], "the first hand was dropped");
  playedOut(game);
  game.input("Space, _*2");
  assert.equal(playedOut(game).phase, "pick", "the pick comes after the second hand");
  game.input("Space, _*5");
  assert.deepEqual(settings.get().learned, ["title", "order", "pick"], "and it was skipped");
  game.close();
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
  // The first launch: into the settings, the sounds up a step, and back.
  const first = new RecordingBackend();
  launch(first, "_*2, down, _*2, Enter, _*3, right, _*2, Escape, _*3");
  assert.equal(first.storageOpenedFor, "jam-jar");
  assert.ok(first.stored.has("settings"), "written as they change");

  // The second, with the files the first left: the title is up before the settings are read, and must still follow them.
  const second = new RecordingBackend({ storage: Object.fromEntries(first.stored) });
  const player = createPlayer(second, { ...gameConfig, warn: () => {} });
  second.queueInput(parseInputScript("_", { bindings })[0]!);
  player.step();
  assert.equal(settings.get().effects, 0.9);
  assert.deepEqual(useGame.getState().learned, ["title", "settings"], "the title knows its keys were shown");
  assert.equal(useGame.getState().effects, 9);
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
  // The first launch: a hand dropped, up to the next one, then closed without a word.
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
  assert.equal(before!.phase, "order");
  assert.equal(before!.turn, 2);
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
  assert.equal(after!.phase, "order");
  assert.equal(after!.cycleScore, before!.cycleScore);
  assert.deepEqual(after!.hand, before!.hand);
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

test("in the Flip jar gravity turns over before every turn's drop but the first: the second hand ends on the lid, inside the jar, and still settles", () => {
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
  play.s.run = { ...play.s.run, boss: "flip", cycle: 3 };
  const playTurn = () => {
    step("Space, _*30");
    for (let i = 0; i < 1200 && ["drop", "settle", "tally", "pick"].includes(play.s.run.phase); i++) step(play.s.run.phase === "pick" ? "Escape" : "_");
  };
  playTurn();
  assert.deepEqual([play.s.run.phase, play.s.run.turn, play.s.run.drops, play.s.run.flipped], ["order", 2, 4, false], "the first hand falls to the floor");
  playTurn();
  const run = play.s.run;
  assert.equal(run.drops, 8, "it came to rest");
  assert.equal(run.flipped, true, "turned over before the second hand dropped");
  const mid = (RIM + JAR.floor) / 2;
  for (const f of run.fruits) {
    assert.ok(f.y < mid, `${f.kind} lies at the lid's end (y = ${f.y})`);
    assert.ok(f.y - f.r >= RIM - 0.5, `${f.kind} under the lid (y = ${f.y})`);
    assert.ok(f.x - f.r >= JAR.left - 0.5 && f.x + f.r <= JAR.right + 0.5, `${f.kind} inside the walls (x = ${f.x})`);
  }
  player.close();
});

test("the prompts follow what the player is using: keys once a key is pressed, the pointer once the mouse or a finger is", () => {
  const frames = parseInputScript("_*2, Enter, _*3, click@320,200, _*3, right, _*3", { bindings });
  const { states } = runScript(gameConfig, frames, () => getInputDevice() === "keyboard");
  assert.equal(states[1], false, "nothing pressed yet: no keys are named");
  assert.equal(states[5], true, "Enter was pressed");
  assert.equal(states[9], false, "a click or a tap");
  assert.equal(states[states.length - 1], true, "and a key again");
});

test("the hand is reordered by dragging: a fruit follows the pointer along the shelf and stays where it is let go; a tap only shows what a fruit does", () => {
  const backend = new RecordingBackend();
  const player = createPlayer(backend, { ...gameConfig, warn: () => {} });
  const step = (script: string) => {
    for (const frame of parseInputScript(script, { bindings })) {
      backend.queueInput(frame);
      player.step();
    }
  };
  step("_*2, Enter, _*5");
  const play = findComponent("Play", player.world.root) as unknown as { s: { run: Run; tip: boolean } };
  play.s.run = { ...play.s.run, hand: ["cherry", "grape", "orange", "apple"] };
  // The four stand 48 apart, centred on 320: at 248, 296, 344 and 392, on the shelf at about y = 30. A step sees the frame
  // before it, so each stretch ends with one more frame of the same.
  // (One script for the whole drag: a new script would press the button again.)
  step("mouse@248,30, mouse@248,30+MouseLeft, mouse@300,30+MouseLeft, mouse@350,60+MouseLeft, mouse@392,30+MouseLeft, mouse@392,30+MouseLeft");
  assert.equal(play.s.run.holding, true, "a press picks the first one up, and it is held while the button is");
  assert.deepEqual(play.s.run.hand, ["grape", "orange", "apple", "cherry"], "it went along the shelf, past each of the others");
  step("mouse@392,30, mouse@392,30");
  assert.equal(play.s.run.holding, false, "and stays where it was let go");
  assert.equal(play.s.run.phase, "order");

  // A press and a release in one place is a tap: nothing is picked up or moved, and the fruit shows what it does.
  step("mouse@296,30+MouseLeft, mouse@296,30, mouse@296,30");
  assert.equal(play.s.run.holding, false);
  assert.equal(play.s.run.cursor, 1);
  assert.equal(play.s.tip, true, "its tooltip shows");
  assert.deepEqual(play.s.run.hand, ["grape", "orange", "apple", "cherry"]);
  // A second tap on the same fruit puts the tooltip away again; a tap on another shows that one's.
  step("mouse@296,30+MouseLeft, mouse@296,30, mouse@296,30");
  assert.equal(play.s.tip, false, "tapped again: deselected");
  step("mouse@296,30+MouseLeft, mouse@296,30, mouse@296,30");
  assert.equal(play.s.tip, true);
  step("mouse@344,30+MouseLeft, mouse@344,30, mouse@344,30");
  assert.deepEqual([play.s.tip, play.s.run.cursor], [true, 2], "another fruit: its tooltip, not none");
  // A tap anywhere else puts the tooltip away, and moves nothing.
  step("mouse@100,300+MouseLeft, mouse@100,300, mouse@100,300");
  assert.equal(play.s.tip, false);
  assert.equal(play.s.run.phase, "order");
  assert.deepEqual(play.s.run.hand, ["grape", "orange", "apple", "cherry"]);
  player.close();
});

test("honey is sticky: a fruit touching a Honeyed one hangs from it, where a plain one would let it fall", () => {
  const hangs = (honeyed: boolean): number => {
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
    const make = (id: number, y: number, frozen: boolean, honey: boolean): Fruit => ({
      ...{ id, kind: "apple", x0: 320, y0: y, x: 320, y, r: 18, speed: 0, touching: [], kicks: 0, kickX: 0, kickY: 0 },
      ...{ landed: true, age: 0, rotten: false, pulse: 0, pulseDelay: 0, honeyed: honey, pickled: false, frozen, lit: false, fuse: 0 },
    });
    // One Apple held in mid air (frozen), and a loose one just under it, touching.
    play.s.run = { ...play.s.run, phase: "settle", hand: [], nextId: 900, fruits: [make(801, 150, true, honeyed), make(802, 186, false, false)] };
    step("_*60");
    const y = play.s.run.fruits.find((f) => f.id === 802)!.y;
    player.close();
    return y;
  };
  assert.ok(hangs(true) < 190, `it hangs from the Honeyed one (y = ${hangs(true)})`);
  assert.ok(hangs(false) > 250, `and falls from a plain one (y = ${hangs(false)})`);
});

test("in the Tilted jar the fruit roll to the low side, stay inside the walls, and the jar still settles", () => {
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
  play.s.run = { ...play.s.run, boss: "tilt", cycle: 3 };
  step("Space, _*2");
  for (let i = 0; i < 1200 && ["drop", "settle", "tally"].includes(play.s.run.phase); i++) step("_");
  const run = play.s.run;
  assert.deepEqual([run.phase, run.turn], ["order", 2], "it came to rest");
  const mid = (JAR.left + JAR.right) / 2;
  const mean = run.fruits.reduce((sum, f) => sum + f.x, 0) / run.fruits.length;
  assert.ok(mean > mid + 20, `the pile lies to the right (mean x = ${mean}, middle ${mid})`);
  for (const f of run.fruits) assert.ok(f.x - f.r >= JAR.left - 0.5 && f.x + f.r <= JAR.right + 0.5, `${f.kind} inside the walls (x = ${f.x})`);
  player.close();
});

/** Play a new run's first hand to the next one, with these keys held from the drop on, and say how many frames it took and how it ended. */
function firstHand(prepare: () => void, held: string): { frames: number; run: Run; speeds: Set<number> } {
  const backend = new RecordingBackend();
  const player = createPlayer(backend, { ...gameConfig, warn: () => {} });
  prepare();
  const speeds = new Set<number>();
  let run: Run | null = null;
  let frames = 0;
  const script = `_*2, Enter, _*5, Space, ${held}*900`;
  for (const frame of parseInputScript(script, { bindings })) {
    backend.queueInput(frame);
    player.step();
    const play = findComponent("Play", player.world.root) as unknown as { s: { run: Run } } | null;
    if (play === null) continue;
    run = play.s.run;
    if (run.turn > 1 && run.phase === "order") break;
    if (run.phase !== "order") {
      frames += 1;
      speeds.add(useGame.getState().speed);
    }
  }
  player.close();
  return { frames, run: run!, speeds };
}

test("pace: the Speed setting plays the jar twice as fast and F three times, and the hand ends exactly as it would have", () => {
  const normal = firstHand(() => {}, "_");
  const fast = firstHand(() => settings.set({ fast: true }), "_");
  const hurried = firstHand(() => {}, "F");
  assert.deepEqual([...normal.speeds], [1]);
  assert.deepEqual([...fast.speeds], [2]);
  assert.ok(hurried.speeds.has(3));
  assert.ok(fast.frames < normal.frames * 0.6, `${fast.frames} frames against ${normal.frames}`);
  assert.ok(hurried.frames < normal.frames * 0.45, `${hurried.frames} frames against ${normal.frames}`);
  // The same steps, run faster: the same fruit in the same places with the same score.
  const places = (run: Run) => run.fruits.map((f) => [f.kind, Math.round(f.x * 1000), Math.round(f.y * 1000)]);
  assert.deepEqual(places(fast.run), places(normal.run));
  assert.deepEqual(places(hurried.run), places(normal.run));
  assert.equal(fast.run.cycleScore, normal.run.cycleScore);
  assert.equal(useGame.getState().speed, 1, "back to normal speed for the pick");
});

test("in lime juice a fruit floats: it comes to rest half out of the juice, a Heavy one sinks, and the jar still settles", () => {
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
  const make = (id: number, kind: Fruit["kind"], x: number, r: number): Fruit => ({
    ...{ id, kind, x0: x, y0: 150, x, y: 150, r, speed: 0, touching: [], kicks: 0, kickX: 0, kickY: 0 },
    ...{ landed: false, age: 0, rotten: false, pulse: 0, pulseDelay: 0, honeyed: false, pickled: false, frozen: false, lit: false, fuse: 0 },
  });
  play.s.run = { ...play.s.run, phase: "settle", hand: [], nextId: 900, juice: 80, lime: true, fruits: [make(801, "orange", 270, 22), make(802, "coconut", 370, 22)] };
  step("_*400");
  const run = play.s.run;
  const orange = run.fruits.find((f) => f.id === 801)!;
  const coconut = run.fruits.find((f) => f.id === 802)!;
  const top = JAR.floor - 80;
  assert.ok(Math.abs(orange.y - top) < 6, `the Orange floats at the surface (y = ${orange.y}, surface ${top})`);
  assert.ok(coconut.y > JAR.floor - 24, `the Coconut is on the floor (y = ${coconut.y})`);
  assert.notEqual(run.phase, "settle", "and the jar came to rest");
  player.close();
});

test("a tap off the cards of a pick leaves nothing chosen", () => {
  const game = startRun();
  const play = findComponent("Play", game.player.world.root) as unknown as { s: { run: Run } };
  // Straight to a pick: the second turn of a cycle, already settled.
  play.s.run = { ...play.s.run, turn: 2, phase: "settle", hand: [], calmTime: 10 };
  game.stepUntil(() => play.s.run.phase === "pick");
  assert.equal(play.s.run.offerCursor, -1);
  // The three cards stand in the middle of the screen; the first tap on one only chooses it.
  game.input("click@320,150, _*2");
  assert.equal(play.s.run.offerCursor, 1, "the middle card is chosen");
  assert.equal(play.s.run.phase, "pick");
  game.input("click@320,335, _*2");
  assert.equal(play.s.run.offerCursor, -1, "a tap under the cards, on nothing: none is chosen");
  assert.equal(play.s.run.phase, "pick");
  game.close();
});

test("a pick by taps: a tap on a card only chooses it, again or not, and its Take button takes it", () => {
  const game = startRun();
  const play = findComponent("Play", game.player.world.root) as unknown as { s: { run: Run } };
  play.s.run = { ...play.s.run, turn: 2, phase: "settle", hand: [], calmTime: 10 };
  game.stepUntil(() => play.s.run.phase === "pick");
  const before = play.s.run.pool.length;
  game.input("click@320,150, _*2, click@320,150, _*2");
  assert.deepEqual([play.s.run.phase, play.s.run.offerCursor, play.s.run.pool.length], ["pick", 1, before], "tapped twice: chosen, not taken");
  const kind = play.s.run.offers[1];
  // The button stands on the chosen card's foot, in the middle of the screen. It is off the cards, but it does not put the
  // chosen one back before taking it.
  game.input("click@320,283, _*2");
  assert.notEqual(play.s.run.phase, "pick", "taken");
  assert.equal(play.s.run.pool.at(-1), kind);
  game.close();
});

test("the shop by taps: a tap on a label only chooses it, and the Buy button under it buys it", () => {
  const game = startRun();
  const play = findComponent("Play", game.player.world.root) as unknown as { s: { run: Run } };
  play.s.run = { ...play.s.run, phase: "shop", coins: 20, shop: { fruits: ["apple", "cherry", "grape"], item: null, cursor: -1, removing: false, removeCursor: -1 } };
  game.input("_*60");
  // The four labels stand across the stall, 148 wide with 6 between: the second's middle is at 243.
  game.input("click@243,150, _*2, click@243,150, _*2");
  assert.deepEqual([play.s.run.shop!.cursor, play.s.run.coins], [1, 20], "tapped twice: chosen, not bought");
  // The Buy button is under the actions, below the chosen label. It is off the shelf, but it does not put the label back first.
  game.input("click@243,339, _*2");
  assert.equal(play.s.run.coins, 20 - FRUIT_PRICE, "bought");
  assert.equal(play.s.run.shop!.fruits[1], null);
  game.close();
});

test("the end of a run: Play again starts a new one from its board, and Escape goes to the title", () => {
  const game = startRun();
  const play = findComponent("Play", game.player.world.root) as unknown as { s: { run: Run } };
  const lose = () => {
    play.s.run = { ...play.s.run, turn: 5, phase: "settle", hand: [], calmTime: 10 };
    game.stepUntil(() => play.s.run.phase === "over");
  };
  lose();
  assert.ok(findComponent("EndBoard", game.player.world.root) !== null, "the board is up");
  const seed = useGame.getState().seed;
  game.input("Enter, _*3");
  assert.deepEqual([play.s.run.phase, play.s.run.cycle, play.s.run.turn, play.s.run.total], ["order", 1, 1, 0], "a new run, its first hand dealt");
  assert.equal(play.s.run.hand.length, 4);
  assert.equal(useGame.getState().seed, seed + 1, "from a new seed");
  assert.equal(findComponent("EndBoard", game.player.world.root), null);
  lose();
  game.input("Escape, _*3");
  assert.equal(useGame.getState().screen, "title");
  game.close();
});

test("the first game's tutorial: a card says one thing at a time and moves on as the player does it; No tips ends it", () => {
  settings.set({ tutorial: 0 });
  const game = startRun();
  const step = () => useGame.getState().tutorial;
  const coach = () => findComponent("Coach", game.player.world.root);
  game.input("_*2");
  assert.equal(step(), 0, "the shelf's lesson");
  assert.equal(coach(), null, "not while the run's opening plays");
  game.stepUntil(() => coach() !== null, { maxSteps: 300 });
  // Tap a fruit on the shelf: that is what the first lesson asks.
  game.input("click@296,30, _*3");
  assert.equal(step(), 1, "on to how the order matters");
  // Drag the first fruit along the shelf: the second.
  game.input("mouse@248,30, mouse@248,30+MouseLeft, mouse@300,30+MouseLeft, mouse@350,30+MouseLeft, mouse@350,30, _*3");
  assert.equal(step(), 2, "on to dropping the hand");
  game.input("Space, _*3");
  assert.equal(step(), 3, "dropped: how it merges and scores, while it does");
  playedOut(game);
  game.input("_*3");
  assert.equal(step(), 4, "the next hand: the rent");
  // Dropping the hand ends it; the pick's lesson then waits for the first pick, its card away.
  game.input("Space, _*3");
  assert.equal(step(), 5);
  assert.equal(coach(), null, "nothing to say until the pick");
  assert.equal(playedOut(game).phase, "pick");
  game.input("_*3");
  assert.ok(coach() !== null, "the pick's lesson");
  (coach() as unknown as { props: { onSkip: () => void } }).props.onSkip();
  game.input("_*3");
  assert.equal(coach(), null);
  assert.equal(settings.get().tutorial, 8, "over, and kept that way between launches");
  game.close();
});

test("the last turn of a cycle is announced: a banner crosses the screen as its hand comes up, and not on the turns before", () => {
  const game = startRun();
  const play = findComponent("Play", game.player.world.root) as unknown as { s: { run: Run; last: number } };
  game.input("_*5");
  assert.ok(play.s.last >= 99, "the first turn: no banner");
  play.s.run = { ...play.s.run, turn: 5 };
  game.input("_*3");
  assert.ok(play.s.last < 0.2, "the fifth: it has just begun");
  game.stepUntil(() => play.s.last >= 1.28, { maxSteps: 200 });
  game.input("_*3");
  assert.ok(play.s.last >= 1.28, "and it is over in about a second and a quarter, once");
  game.close();
});

test("things arriving make a sound: the title's name and jar land and its buttons bloop; a run's boards bloop, its jar lands and its hand knocks onto the shelf", () => {
  const game = playGame(gameConfig, { bindings });
  const heard = () => game.backend.plays;
  const count = (name: string) => heard().filter((s) => s === `assets/${name}`).length;
  game.input("_*120");
  assert.equal(count("thud.wav"), 2, "the name, then the jar");
  assert.deepEqual([count("pop-0.wav"), count("pop-1.wav"), count("pop-2.wav")], [1, 1, 0], "one for Play, a higher one for Settings");
  game.input("Enter, _*300");
  assert.equal(count("thud.wav"), 3, "the run's jar lands");
  assert.deepEqual([count("pop-0.wav"), count("pop-1.wav"), count("pop-2.wav")], [2, 2, 1], "the two boards and the shelf");
  assert.equal(count("tock.wav"), 4, "and each of the four fruit knocks as it rolls to its place");
  game.close();
});

test("a phone held upright is asked to turn, and the run waits under the card until it does", () => {
  const game = startRun().input("Space, _*20");
  assert.equal(runOf(game).phase, "drop", "a hand is dropping");
  const upright = { width: 390, height: 844 };
  // The recording backend reports a frame's window as that frame ends, so the step after it is the first to see it.
  game.backend.queueInput(upright);
  game.player.step();
  game.backend.queueInput(upright);
  game.player.step();
  assert.notEqual(findComponent("Rotate", game.player.world.root), null, "the card is up");
  const before = JSON.stringify(runOf(game));
  for (let i = 0; i < 30; i++) {
    game.backend.queueInput(upright);
    game.player.step();
  }
  assert.equal(JSON.stringify(runOf(game)), before, "nothing moved while it was upright");
  // Turned back: the card goes (the next frames are the window the game opened, which is wide) and the hand plays on.
  game.input("_*2");
  assert.equal(findComponent("Rotate", game.player.world.root), null, "the card is gone");
  game.input("_*10");
  assert.notEqual(JSON.stringify(runOf(game)), before, "the hand plays on");
  game.close();
});

test("on the engine's physics: a hand with a Pumpkin drops it whole, down the middle of the jar", () => {
  const game = startRun();
  const play = findComponent("Play", game.player.world.root) as unknown as { s: { run: Run } };
  play.s.run = { ...play.s.run, hand: ["cherry", "pumpkin", "grape"] };
  game.input("Space, _*2");
  const run = playedOut(game);
  game.close();
  const pumpkin = run.fruits.find((f) => f.kind === "pumpkin");
  assert.ok(pumpkin !== undefined, "the Pumpkin is in the jar");
  assert.ok(Math.abs(pumpkin.x - (JAR.left + JAR.right) / 2) < 8, `in the middle (x = ${pumpkin.x})`);
  assert.ok(run.fruits.every((f) => f.y - f.r >= RIM), "nothing spilled");
});

test("on the engine's physics: two Watermelons make a Giant Pumpkin, which throws the pile and is gone before the turn is scored", () => {
  const game = startRun();
  const play = findComponent("Play", game.player.world.root) as unknown as { s: { run: Run } };
  const make = (id: number, kind: Fruit["kind"], x: number, y: number, r: number): Fruit => ({
    ...{ id, kind, x0: x, y0: y, x, y, r, speed: 0, touching: [], kicks: 0, kickX: 0, kickY: 0 },
    ...{ landed: false, age: 0, rotten: false, pulse: 0, pulseDelay: 0, honeyed: false, pickled: false, frozen: false, lit: false, fuse: 0 },
  });
  // A Watermelon falling onto another, with small fruit beside them.
  play.s.run = {
    ...play.s.run,
    phase: "settle",
    nextId: 900,
    fruits: [make(801, "watermelon", 300, JAR.floor - 29, 29), make(802, "watermelon", 302, 200, 29), make(803, "cherry", 380, JAR.floor - 14, 14), make(804, "grape", 240, JAR.floor - 18, 18)],
  };
  // What the test set takes effect on the next step.
  game.input("_");
  game.stepUntil(() => play.s.run.fruits.some((f) => f.kind === "giantpumpkin") || play.s.run.phase !== "settle");
  assert.ok(play.s.run.fruits.some((f) => f.kind === "giantpumpkin"), "a Giant Pumpkin formed");
  const run = playedOut(game);
  game.close();
  assert.ok(!run.fruits.some((f) => f.kind === "giantpumpkin"), "and vanished before the turn was scored");
  assert.ok(run.cycleScore >= 150, `it scored (${run.cycleScore})`);
  assert.ok(run.fruits.every((f) => f.x - f.r >= JAR.left - 2 && f.x + f.r <= JAR.right + 2), "every fruit is still in the jar");
});
