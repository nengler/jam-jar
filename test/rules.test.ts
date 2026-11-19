import assert from "node:assert/strict";
import { test } from "node:test";

import { FRUITS } from "../src/rules/fruits.ts";
import { advance, JAR, newRun, NO_KEYS, resolve, rollPool, RIM, simulate, type Fruit, type Keys, type Run } from "../src/rules/jar.ts";
import { Rng } from "../src/rules/rng.ts";

const DT = 1 / 60;

function press(run: Run, keys: Partial<Keys>): Run {
  return advance(run, DT, { ...NO_KEYS, ...keys });
}

function fruit(id: number, kind: Fruit["kind"], x: number, y: number): Fruit {
  return { id, kind, x, y, px: x, py: y, r: FRUITS[kind].radius, landed: true, age: 0, rotten: false, lit: false, fuse: 0 };
}

/** A run whose jar holds exactly these fruit, settling. */
function jarWith(fruits: Fruit[]): Run {
  const run = newRun(7);
  run.fruits = fruits;
  run.nextId = 100;
  run.phase = "settle";
  return run;
}

test("the starting pool is 9: one Apple and 8 starters within their ranges", () => {
  for (let seed = 1; seed < 200; seed++) {
    const pool = rollPool(new Rng(seed));
    const count = (k: string) => pool.filter((p) => p === k).length;
    assert.equal(pool.length, 9);
    assert.equal(count("apple"), 1);
    assert.ok(count("cherry") >= 3 && count("cherry") <= 5);
    assert.ok(count("grape") >= 2 && count("grape") <= 4);
    assert.ok(count("orange") <= 2);
  }
});

test("the same seed and keys play the same run", () => {
  let a = newRun(42);
  let b = newRun(42);
  for (let i = 0; i < 400; i++) {
    const keys = i === 3 ? { drop: true } : {};
    a = press(a, keys);
    b = press(b, keys);
  }
  assert.deepEqual(a, b);
});

test("ordering: pick up the first fruit, move it down, and it drops second", () => {
  let run = newRun(3);
  const [first, second] = run.hand;
  run = press(run, { confirm: true });
  run = press(run, { down: true });
  assert.equal(run.hand[0], second);
  assert.equal(run.hand[1], first);
  assert.equal(run.cursor, 1);
});

test("dropped fruit stay inside the jar and come to rest", () => {
  let run = newRun(5);
  run = press(run, { drop: true });
  for (let i = 0; i < 600 && run.phase !== "pick"; i++) run = press(run, {});
  assert.equal(run.phase, "pick");
  for (const f of run.fruits) {
    assert.ok(f.x - f.r >= JAR.left - 0.5 && f.x + f.r <= JAR.right + 0.5, "inside the walls");
    assert.ok(f.y + f.r <= JAR.floor + 0.5, "above the floor");
  }
});

test("two touching Cherries merge into a Grape and score its points", () => {
  const run = jarWith([fruit(1, "cherry", 150, JAR.floor - 5), fruit(2, "cherry", 160, JAR.floor - 5)]);
  simulate(run, DT);
  assert.deepEqual(run.fruits.map((f) => f.kind), ["grape"]);
  assert.equal(run.cycleScore, FRUITS.grape.points);
});

test("a Lemon blocks merges next to it", () => {
  const run = jarWith([fruit(1, "cherry", 150, JAR.floor - 5), fruit(2, "cherry", 160, JAR.floor - 5), fruit(3, "lemon", 155, JAR.floor - 16)]);
  for (let i = 0; i < 5; i++) simulate(run, DT);
  assert.equal(run.fruits.filter((f) => f.kind === "cherry").length, 2);
});

test("a Chili touching 4 fruit explodes and scores what it destroys", () => {
  // A Blueberry counts as 3 fruit, so Blueberry + Apple make 4.
  const y = JAR.floor;
  const run = jarWith([fruit(1, "chili", 160, y - 6), fruit(2, "blueberry", 170, y - 4), fruit(3, "apple", 147, y - 7)]);
  for (let i = 0; i < 60; i++) simulate(run, DT);
  assert.equal(run.fruits.length, 0, "the chili and both neighbours are gone");
  assert.equal(run.cycleScore, FRUITS.blueberry.points + FRUITS.apple.points);
});

test("a Pomegranate caught in a blast bursts into 5 Cherries", () => {
  const y = JAR.floor - 8;
  const run = jarWith([fruit(1, "pomegranate", 160, y)]);
  run.fruits.push({ ...fruit(2, "chili", 172, y), lit: true, fuse: 0 });
  simulate(run, DT);
  assert.equal(run.fruits.filter((f) => f.kind === "cherry").length, 5);
});

test("Resolve: fruit over the rim spill and cost points; an Apple deeper scores more", () => {
  const run = jarWith([fruit(1, "apple", 130, JAR.floor - 7), fruit(2, "apple", 180, RIM + 8), fruit(3, "cherry", 160, RIM - 2)]);
  run.cycleScore = 10;
  resolve(run);
  assert.equal(run.fruits.length, 2, "the cherry spilled");
  // -5 for the spill, then 3 (deep apple) + 1 (shallow apple).
  assert.equal(run.cycleScore, 10 - 5 + 3 + 1);
});

test("a Banana scores more each turn and rots after 3", () => {
  const run = jarWith([fruit(1, "banana", 160, JAR.floor - 7)]);
  const scores: number[] = [];
  for (let t = 0; t < 4; t++) {
    const before = run.cycleScore;
    run.turn = 1;
    resolve(run);
    scores.push(run.cycleScore - before);
  }
  assert.deepEqual(scores, [1, 2, 3, 0]);
  assert.equal(run.fruits[0]!.rotten, true);
});

test("missing rent ends the run; paying it moves to the next cycle with an empty jar", () => {
  const poor = jarWith([]);
  poor.turn = 5;
  poor.cycleScore = 3;
  resolve(poor);
  assert.equal(poor.phase, "over");

  let rich = jarWith([fruit(1, "cherry", 160, JAR.floor - 5)]);
  rich.turn = 5;
  rich.cycleScore = 40;
  resolve(rich);
  assert.equal(rich.phase, "rent");
  assert.equal(rich.coins, 3);
  rich = press(rich, { confirm: true });
  assert.equal(rich.phase, "order");
  assert.equal(rich.cycle, 2);
  assert.equal(rich.fruits.length, 0);
  assert.equal(rich.hand.length, 4);
});
