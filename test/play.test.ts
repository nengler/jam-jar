import assert from "node:assert/strict";
import { test } from "node:test";

import { parseInputScript, playGame, runScript, type GamePlay, type Player } from "@tsengine/player";
import { getInputDevice } from "@tsengine/runtime";
import { findComponent } from "@tsengine/testing";

import { bindings, gameConfig } from "../game.ts";
import { useGame } from "../src/GameState.ts";
import { settings } from "../src/settings.ts";
import { JAR, RIM, type Run } from "../src/rules/jar.ts";
import { fruit, litChili } from "./helpers.ts";

/** What the Play screen keeps that the tests look at: the run, whether a fruit's tooltip shows, and how long since the last turn's banner began. */
type PlayState = { run: Run; tip: boolean; last: number };

/** The Play screen's state, or null when it is not up. */
function playOf(player: Player): PlayState | null {
  const play = findComponent("Play", player.world.root) as unknown as { s: PlayState } | null;
  return play === null ? null : play.s;
}

/** The run of a game in play. */
function runOf(game: GamePlay): Run {
  return playOf(game.player)!.run;
}

/** Change the run of a game in play. */
function patch(game: GamePlay, changes: Partial<Run>): void {
  const play = playOf(game.player)!;
  play.run = { ...play.run, ...changes };
}

/** Which screen shows, whether play is paused, and the run's phase and jar when a run is on. */
function seen(player: Player): { screen: string; paused: boolean; phase?: string; fruits?: number; hand?: number; dealt?: number } {
  const { screen, paused } = useGame.getState();
  const play = playOf(player);
  if (play === null) return { screen, paused };
  const run = play.run;
  return { screen, paused, phase: run.phase, fruits: run.fruits.length, hand: run.hand.length, dealt: run.discard.length };
}

/** The game launched, at its title, on the files a launch before left (none by default). */
function boot(storage?: Record<string, string>): GamePlay {
  return playGame(gameConfig, { bindings, ...(storage === undefined ? {} : { storage }) });
}

/** A game started from the title: a new run, its first hand on the shelf. */
function startRun(): GamePlay {
  return boot().input("_*2, Enter, _*5");
}

/** Wait for a hand that was dropped to be played out: the run is at rest where the player acts next (a hand, a pick, the rent, the end). */
function playedOut(game: GamePlay): Run {
  game.stepUntil(() => !["drop", "settle", "tally"].includes(runOf(game).phase));
  return runOf(game);
}

test("Play starts a run with a hand of 4; Space drops it, and on the engine's physics the fruit fall into the jar, settle and the next hand comes up", () => {
  const game = startRun();
  const first = seen(game.player);
  assert.equal(first.screen, "play");
  assert.equal(first.phase, "order");
  assert.equal(first.hand, 4);
  // A fruit drops once the last has landed and come to rest, so a hand of 4 takes a few seconds.
  game.input("Space, _*2");
  const last = playedOut(game);
  game.close();
  assert.equal(last.phase, "order", "no pick after the first turn: the next hand is dealt");
  assert.equal(last.turn, 2);
  assert.equal(last.hand.length, 4);
  assert.equal(last.discard.length, 4, "all four dropped");
  assert.ok(last.fruits.length >= 1 && last.fruits.length <= 4, "in the jar (some may have merged)");
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
  const game = boot().input("_");
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

test("the settings are kept between launches: the volumes and the keys already shown come back", () => {
  // The first launch: into the settings, the sounds up a step, and back.
  const first = boot().input("_*2, down, _*2, Enter, _*3, right, _*2, Escape, _*3");
  first.close();
  assert.equal(first.backend.storageOpenedFor, "jam-jar");
  assert.ok(first.backend.stored.has("settings"), "written as they change");

  // The second, with the files the first left: the title is up before the settings are read, and must still follow them.
  const second = boot(Object.fromEntries(first.backend.stored));
  assert.equal(settings.get().effects, 0.9);
  assert.deepEqual(useGame.getState().learned, ["title", "settings"], "the title knows its keys were shown");
  assert.equal(useGame.getState().effects, 9);
  second.close();
});

test("a chain of Blasts plays in slow motion, then the game runs at full speed again", () => {
  const frames = parseInputScript("_*2, Enter, _*200", { bindings });
  const speeds: number[] = [];
  runScript(gameConfig, frames, (player) => {
    const play = playOf(player);
    if (play === null) return null;
    // Once the run is on, put two lit Chilis in the jar, far enough apart to go off one after the other.
    if (speeds.length === 0) {
      play.run = { ...play.run, phase: "settle", hand: [], nextId: 900, fruits: [litChili(801, 250, JAR.floor - 16, 0.05), litChili(802, 390, JAR.floor - 16, 0.5)] };
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
  const first = startRun().input("Space, _*2");
  const before = playedOut(first);
  first.close();
  assert.equal(before.phase, "order");
  assert.equal(before.turn, 2);
  assert.ok(first.backend.stored.has("run"));

  // The second, on the files the first left: the title offers Continue first, and Enter takes it.
  const again = boot(Object.fromEntries(first.backend.stored)).input("_*2, Enter, _*4");
  const after = runOf(again);
  assert.equal(useGame.getState().hasSave, true);
  assert.equal(after.phase, "order");
  assert.equal(after.cycleScore, before.cycleScore);
  assert.deepEqual(after.hand, before.hand);
  assert.deepEqual(after.pool, before.pool);
  assert.equal(after.fruits.length, before.fruits.length);
  for (const [i, f] of after.fruits.entries()) {
    const was = before.fruits[i]!;
    assert.equal(f.kind, was.kind);
    assert.ok(Math.abs(f.x - was.x) < 2 && Math.abs(f.y - was.y) < 2, `${f.kind} lies where it lay (${f.x}, ${f.y} against ${was.x}, ${was.y})`);
  }
  again.close();
});

test("a run is kept once a hand has been played, and one that ends leaves nothing to continue", () => {
  const game = startRun();
  assert.equal(useGame.getState().hasSave, false, "a run with nothing done yet is not worth keeping");
  game.input("Space, _*2");
  playedOut(game);
  assert.equal(useGame.getState().hasSave, true, "kept once its first hand has been played");
  // Lose it: the last turn of a cycle with no score.
  patch(game, { turn: 5, phase: "settle", hand: [], calmTime: 10 });
  game.input("_*5");
  assert.equal(runOf(game).phase, "over");
  assert.equal(useGame.getState().hasSave, false);
  assert.ok(!game.backend.stored.has("run"));
  game.close();
});

test("the title shows a jar filling up by itself, and it does not touch what is kept", () => {
  const game = boot();
  let most = 0;
  let turned = false;
  for (let i = 0; i < 600; i++) {
    game.input("_");
    const demo = findComponent("DemoJar", game.player.world.root) as unknown as { s: { run: Run } };
    most = Math.max(most, demo.s.run.fruits.length);
    for (const f of demo.s.run.fruits) assert.ok(f.x - f.r >= JAR.left - 0.5 && f.x + f.r <= JAR.right + 0.5, "inside its walls, wherever the jar is drawn");
    const ball = findComponent("Fruit", game.player.world.root) as unknown as { s: { turn: number } } | null;
    turned = turned || (ball !== null && ball.s.turn !== 0);
  }
  assert.ok(most >= 4, `fruit pile up (${most})`);
  assert.ok(turned, "and roll as they land on each other");
  assert.equal(useGame.getState().screen, "title");
  assert.equal(useGame.getState().hasSave, false);
  assert.ok(!game.backend.stored.has("run"), "the demo's run is not kept");
  assert.deepEqual(settings.get().learned, []);
  game.close();
});

test("a Frozen fruit is held where it is: what was under it can go, and it does not fall", () => {
  const game = startRun();
  // An Apple on the floor, and a frozen one and a loose one in mid air above it.
  const r = runOf(game);
  patch(game, { phase: "settle", hand: [], nextId: 900, fruits: [...r.fruits, fruit(801, "apple", 320, JAR.floor - 18), { ...fruit(802, "apple", 320, 200), frozen: true }, fruit(803, "apple", 320, 140)] });
  game.input("_*90");
  const at = (id: number) => runOf(game).fruits.find((f) => f.id === id)!;
  assert.ok(Math.abs(at(802).y - 200) < 0.01, `the frozen one hangs where it was (y = ${at(802).y})`);
  assert.ok(at(803).y > 150 && at(803).y < 200, `the loose one fell onto it and rests there (y = ${at(803).y})`);
  game.close();
});

test("in the Flip jar gravity turns over after every second drop: the hand ends on the lid, inside the jar, and still settles", () => {
  const game = startRun();
  patch(game, { boss: "flip", cycle: 3 });
  game.input("Space, _*30");
  assert.equal(runOf(game).flipped, false, "the first falls to the floor");
  const run = playedOut(game);
  assert.deepEqual([run.phase, run.turn], ["order", 2], "it came to rest");
  assert.equal(run.drops, 4);
  assert.equal(run.flipped, true, "turned over after the second drop");
  const mid = (RIM + JAR.floor) / 2;
  for (const f of run.fruits) {
    assert.ok(f.y < mid, `${f.kind} lies at the lid's end (y = ${f.y})`);
    assert.ok(f.y - f.r >= RIM - 0.5, `${f.kind} under the lid (y = ${f.y})`);
    assert.ok(f.x - f.r >= JAR.left - 0.5 && f.x + f.r <= JAR.right + 0.5, `${f.kind} inside the walls (x = ${f.x})`);
  }
  game.close();
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
  const game = startRun();
  const play = playOf(game.player)!;
  patch(game, { hand: ["cherry", "grape", "orange", "apple"] });
  // The four stand 48 apart, centred on 320: at 248, 296, 344 and 392, on the shelf at about y = 30. A step sees the frame
  // before it, so each stretch ends with one more frame of the same.
  // (One script for the whole drag: a new script would press the button again.)
  game.input("mouse@248,30, mouse@248,30+MouseLeft, mouse@300,30+MouseLeft, mouse@350,60+MouseLeft, mouse@392,30+MouseLeft, mouse@392,30+MouseLeft");
  assert.equal(play.run.holding, true, "a press picks the first one up, and it is held while the button is");
  assert.deepEqual(play.run.hand, ["grape", "orange", "apple", "cherry"], "it went along the shelf, past each of the others");
  game.input("mouse@392,30, mouse@392,30");
  assert.equal(play.run.holding, false, "and stays where it was let go");
  assert.equal(play.run.phase, "order");

  // A press and a release in one place is a tap: nothing is picked up or moved, and the fruit shows what it does.
  game.input("mouse@296,30+MouseLeft, mouse@296,30, mouse@296,30");
  assert.equal(play.run.holding, false);
  assert.equal(play.run.cursor, 1);
  assert.equal(play.tip, true, "its tooltip shows");
  assert.deepEqual(play.run.hand, ["grape", "orange", "apple", "cherry"]);
  // A second tap on the same fruit puts the tooltip away again; a tap on another shows that one's.
  game.input("mouse@296,30+MouseLeft, mouse@296,30, mouse@296,30");
  assert.equal(play.tip, false, "tapped again: deselected");
  game.input("mouse@296,30+MouseLeft, mouse@296,30, mouse@296,30");
  assert.equal(play.tip, true);
  game.input("mouse@344,30+MouseLeft, mouse@344,30, mouse@344,30");
  assert.deepEqual([play.tip, play.run.cursor], [true, 2], "another fruit: its tooltip, not none");
  // A tap anywhere else puts the tooltip away, and moves nothing.
  game.input("mouse@100,300+MouseLeft, mouse@100,300, mouse@100,300");
  assert.equal(play.tip, false);
  assert.equal(play.run.phase, "order");
  assert.deepEqual(play.run.hand, ["grape", "orange", "apple", "cherry"]);
  game.close();
});

test("honey is sticky: a fruit touching a Honeyed one hangs from it, where a plain one would let it fall", () => {
  const hangs = (honeyed: boolean): number => {
    const game = startRun();
    // One Apple held in mid air (frozen), and a loose one just under it, touching.
    patch(game, { phase: "settle", hand: [], nextId: 900, fruits: [{ ...fruit(801, "apple", 320, 150), frozen: true, honeyed }, fruit(802, "apple", 320, 186)] });
    game.input("_*60");
    const y = runOf(game).fruits.find((f) => f.id === 802)!.y;
    game.close();
    return y;
  };
  const sticky = hangs(true);
  const plain = hangs(false);
  assert.ok(sticky < 190, `it hangs from the Honeyed one (y = ${sticky})`);
  assert.ok(plain > 250, `and falls from a plain one (y = ${plain})`);
});

test("in the Tilted jar the fruit roll to the low side, stay inside the walls, and the jar still settles", () => {
  const game = startRun();
  patch(game, { boss: "tilt", cycle: 3 });
  game.input("Space, _*2");
  const run = playedOut(game);
  assert.deepEqual([run.phase, run.turn], ["order", 2], "it came to rest");
  const mid = (JAR.left + JAR.right) / 2;
  const mean = run.fruits.reduce((sum, f) => sum + f.x, 0) / run.fruits.length;
  assert.ok(mean > mid + 20, `the pile lies to the right (mean x = ${mean}, middle ${mid})`);
  for (const f of run.fruits) assert.ok(f.x - f.r >= JAR.left - 0.5 && f.x + f.r <= JAR.right + 0.5, `${f.kind} inside the walls (x = ${f.x})`);
  game.close();
});

/**
 * Play a new run's first hand to the next one, with these keys held from the drop on, and say how many frames it took, the
 * speeds it played at, how it ended, and the speed once the next hand was up.
 */
function firstHand(prepare: () => void, held: string): { frames: number; run: Run; speeds: Set<number>; after: number } {
  const game = startRun();
  prepare();
  const speeds = new Set<number>();
  let frames = 0;
  for (let i = 0; i < 900; i++) {
    game.input(i === 0 ? "Space" : held);
    const run = runOf(game);
    if (run.turn > 1 && run.phase === "order") break;
    if (run.phase !== "order") {
      frames += 1;
      speeds.add(useGame.getState().speed);
    }
  }
  const run = runOf(game);
  const after = useGame.getState().speed;
  game.close();
  return { frames, run, speeds, after };
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
  // Ordering the next hand is never hurried, with the setting on or F still held.
  assert.deepEqual([fast.after, hurried.after], [1, 1], "back to normal speed for the next hand");
});

test("in lime juice a fruit floats: it comes to rest half out of the juice, a Heavy one sinks, and the jar still settles", () => {
  const game = startRun();
  const falling = (id: number, kind: "orange" | "coconut", x: number) => ({ ...fruit(id, kind, x, 150), landed: false });
  patch(game, { phase: "settle", hand: [], nextId: 900, juice: 80, lime: true, fruits: [falling(801, "orange", 270), falling(802, "coconut", 370)] });
  game.input("_*400");
  const run = runOf(game);
  const orange = run.fruits.find((f) => f.id === 801)!;
  const coconut = run.fruits.find((f) => f.id === 802)!;
  const top = JAR.floor - 80;
  assert.ok(Math.abs(orange.y - top) < 6, `the Orange floats at the surface (y = ${orange.y}, surface ${top})`);
  assert.ok(coconut.y > JAR.floor - 24, `the Coconut is on the floor (y = ${coconut.y})`);
  assert.notEqual(run.phase, "settle", "and the jar came to rest");
  game.close();
});

test("a tap off the cards of a pick leaves nothing chosen", () => {
  const game = startRun();
  // Straight to a pick: the second turn of a cycle, already settled.
  patch(game, { turn: 2, phase: "settle", hand: [], calmTime: 10 });
  game.stepUntil(() => runOf(game).phase === "pick");
  assert.equal(runOf(game).offerCursor, -1);
  // The three cards stand in the middle of the screen; the first tap on one only chooses it.
  game.input("click@320,150, _*2");
  assert.equal(runOf(game).offerCursor, 1, "the middle card is chosen");
  assert.equal(runOf(game).phase, "pick");
  game.input("click@320,335, _*2");
  assert.equal(runOf(game).offerCursor, -1, "a tap under the cards, on nothing: none is chosen");
  assert.equal(runOf(game).phase, "pick");
  game.close();
});

test("the end of a run: Play again starts a new one from its board, and Escape goes to the title", () => {
  const game = startRun();
  const lose = () => {
    patch(game, { turn: 5, phase: "settle", hand: [], calmTime: 10 });
    game.stepUntil(() => runOf(game).phase === "over");
  };
  lose();
  assert.ok(findComponent("EndBoard", game.player.world.root) !== null, "the board is up");
  const seed = useGame.getState().seed;
  game.input("Enter, _*3");
  const run = runOf(game);
  assert.deepEqual([run.phase, run.cycle, run.turn, run.total], ["order", 1, 1, 0], "a new run, its first hand dealt");
  assert.equal(run.hand.length, 4);
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
  const play = playOf(game.player)!;
  game.input("_*5");
  assert.ok(play.last >= 99, "the first turn: no banner");
  patch(game, { turn: 5 });
  game.input("_*3");
  assert.ok(play.last < 0.2, "the fifth: it has just begun");
  game.stepUntil(() => play.last >= 1.28, { maxSteps: 200 });
  game.input("_*3");
  assert.ok(play.last >= 1.28, "and it is over in about a second and a quarter, once");
  game.close();
});

test("things arriving make a sound: the title's name and jar land and its buttons bloop; a run's boards bloop, its jar lands and its hand knocks onto the shelf", () => {
  const game = boot();
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
