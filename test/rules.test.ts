import assert from "node:assert/strict";
import { test } from "node:test";

import { poolRows } from "../src/layout.ts";
import { FRUITS } from "../src/rules/fruits.ts";
import {
  advance,
  BLAST_BONUS,
  bossCycle,
  FRUIT_PRICE,
  JAR,
  JUICER_BONUS,
  newRun,
  NO_KEYS,
  POINTS_PER_COIN,
  REMOVAL_PRICE,
  RENT,
  resolve,
  rollPool,
  RIM,
  SHOP_ITEM,
  SHOP_LEAVE,
  SHOP_REMOVE,
  SHOP_REROLL,
  simulate,
  type Fruit,
  type Keys,
  type Run,
} from "../src/rules/jar.ts";
import { ITEMS } from "../src/rules/items.ts";
import { Rng } from "../src/rules/rng.ts";

const DT = 1 / 60;

function press(run: Run, keys: Partial<Keys>): Run {
  return advance(run, DT, { ...NO_KEYS, ...keys });
}

/** A landed fruit at rest at (x, y), touching the fruit with these ids (what its component would report). */
function fruit(id: number, kind: Fruit["kind"], x: number, y: number, touching: number[] = []): Fruit {
  return {
    id,
    kind,
    x0: x,
    y0: y,
    x,
    y,
    r: FRUITS[kind].radius,
    speed: 0,
    touching,
    kicks: 0,
    kickX: 0,
    kickY: 0,
    landed: true,
    age: 0,
    rotten: kind === "prune",
    honeyed: kind === "honeydew",
    lit: false,
    fuse: 0,
  };
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

test("a dropped fruit lands when it reports touching the floor, and a Fresh fruit scores then", () => {
  let run = newRun(5);
  run = press(run, { drop: true });
  run = press(run, {});
  const dropped = run.fruits[0]!;
  assert.equal(dropped.landed, false);
  run = advance(run, DT, NO_KEYS, [{ id: dropped.id, x: dropped.x, y: JAR.floor - dropped.r, speed: 0, touching: [] }]);
  assert.equal(run.fruits[0]!.landed, true);
  const def = FRUITS[dropped.kind];
  assert.equal(run.cycleScore, def.scoring === "fresh" ? def.points : 0);
});

test("the jar settles once every fruit reports being slow", () => {
  let run = jarWith([fruit(1, "cherry", 150, JAR.floor - 5)]);
  run.fruits[0]!.speed = 50;
  for (let i = 0; i < 60; i++) run = press(run, {});
  assert.equal(run.phase, "settle", "still moving");
  for (let i = 0; i < 60; i++) run = advance(run, DT, NO_KEYS, [{ id: 1, x: 150, y: JAR.floor - 5, speed: 1, touching: [] }]);
  assert.equal(run.phase, "pick");
});

test("two touching Cherries merge into a Grape and score its points", () => {
  const run = jarWith([fruit(1, "cherry", 150, JAR.floor - 5, [2]), fruit(2, "cherry", 160, JAR.floor - 5, [1])]);
  simulate(run, DT);
  assert.deepEqual(run.fruits.map((f) => f.kind), ["grape"]);
  assert.deepEqual([run.fruits[0]!.x0, run.fruits[0]!.y0], [155, JAR.floor - 5], "made between them");
  assert.equal(run.cycleScore, FRUITS.grape.points);
});

test("a Lemon blocks merges next to it", () => {
  const run = jarWith([
    fruit(1, "cherry", 150, JAR.floor - 5, [2, 3]),
    fruit(2, "cherry", 160, JAR.floor - 5, [1, 3]),
    fruit(3, "lemon", 155, JAR.floor - 16, [1, 2]),
  ]);
  for (let i = 0; i < 5; i++) simulate(run, DT);
  assert.equal(run.fruits.filter((f) => f.kind === "cherry").length, 2);
});

test("a Chili touching 4 fruit explodes and scores what it destroys, with the blast's bonus for each", () => {
  // A Blueberry counts as 3 fruit, so Blueberry + Apple make 4.
  const y = JAR.floor;
  const run = jarWith([fruit(1, "chili", 160, y - 6, [2, 3]), fruit(2, "blueberry", 170, y - 4, [1]), fruit(3, "apple", 147, y - 7, [1])]);
  simulate(run, DT);
  assert.equal(run.fruits[0]!.lit, true, "lit");
  for (let i = 0; i < 30; i++) simulate(run, DT);
  assert.equal(run.fruits.length, 0, "the chili and both neighbours are gone");
  assert.equal(run.cycleScore, FRUITS.blueberry.points + FRUITS.apple.points + 2 * BLAST_BONUS.chili!);
});

test("a Pomegranate caught in a blast bursts into 5 Cherries", () => {
  const y = JAR.floor - 8;
  const run = jarWith([fruit(1, "pomegranate", 160, y)]);
  run.fruits.push({ ...fruit(2, "chili", 172, y), lit: true, fuse: 0 });
  simulate(run, DT);
  assert.equal(run.fruits.filter((f) => f.kind === "cherry").length, 5);
});

test("two Pomegranates that merge burst into 5 Cherries between them", () => {
  const y = JAR.floor - 18;
  const run = jarWith([fruit(1, "pomegranate", 300, y, [2]), fruit(2, "pomegranate", 336, y, [1])]);
  simulate(run, DT);
  assert.deepEqual(
    run.fruits.map((f) => f.kind),
    Array(5).fill("cherry")
  );
});

test("a blast kicks what it does not destroy away from it", () => {
  const y = JAR.floor - 8;
  // Outside the Chili's blast (52 px) but inside the reach of its push (104 px).
  const run = jarWith([fruit(1, "melon", 250, y - 4)]);
  run.fruits.push({ ...fruit(2, "chili", 165, y), lit: true, fuse: 0 });
  simulate(run, DT);
  const melon = run.fruits.find((f) => f.id === 1)!;
  assert.equal(melon.kicks, 1);
  assert.ok(melon.kickX > 0, "pushed right, away from the blast");
});

test("Resolve: fruit over the rim spill and cost points; an Apple deeper scores more", () => {
  const run = jarWith([fruit(1, "apple", 250, JAR.floor - 18), fruit(2, "apple", 300, RIM + 20), fruit(3, "cherry", 350, RIM - 2)]);
  run.cycleScore = 10;
  resolve(run);
  assert.equal(run.fruits.length, 2, "the cherry spilled");
  // -5 for the spill, then 5 (deep apple) + 2 (shallow apple).
  assert.equal(run.cycleScore, 10 - 5 + 5 + 2);
});

test("a Banana scores more each turn and rots after 3", () => {
  const run = jarWith([fruit(1, "banana", 160, JAR.floor - 7)]);
  // Alone in the jar, its rot has nothing to spread to.
  const scores: number[] = [];
  for (let t = 0; t < 4; t++) {
    const before = run.cycleScore;
    run.turn = 1;
    resolve(run);
    scores.push(run.cycleScore - before);
  }
  assert.deepEqual(scores, [2, 3, 4, 0]);
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
  rich.cycleScore = RENT[0]! + 3 * POINTS_PER_COIN + 4;
  resolve(rich);
  assert.equal(rich.phase, "rent");
  assert.equal(rich.coins, 3, "a coin for every 10 points over the rent");
  rich = press(rich, { confirm: true });
  assert.equal(rich.phase, "shop");
  rich = press(rich, { drop: true });
  assert.equal(rich.phase, "order");
  assert.equal(rich.shop, null);
  assert.equal(rich.cycle, 2);
  assert.equal(rich.fruits.length, 0);
  assert.equal(rich.hand.length, 4);
});

test("poolRows groups the pool by kind, in the fruit table's order", () => {
  assert.deepEqual(poolRows(["grape", "cherry", "apple", "cherry", "grape", "cherry"]), [
    { kind: "cherry", count: 3 },
    { kind: "grape", count: 2 },
    { kind: "apple", count: 1 },
  ]);
});

/** A run in the shop after its first rent, with this many coins. */
function inShop(coins: number): Run {
  const run = jarWith([]);
  run.turn = 5;
  run.cycleScore = RENT[0]!;
  resolve(run);
  run.coins = coins;
  return press(run, { confirm: true });
}

test("the shop: a fruit costs coins, joins the pool and leaves a gap on the shelf", () => {
  let run = inShop(10);
  const kind = run.shop!.fruits[1]!;
  const before = run.pool.length;
  run = press(run, { right: true });
  run = press(run, { confirm: true });
  assert.equal(run.coins, 10 - FRUIT_PRICE);
  assert.equal(run.pool.length, before + 1);
  assert.equal(run.pool[before], kind);
  assert.equal(run.shop!.fruits[1], null);
  run = press(run, { confirm: true });
  assert.equal(run.coins, 10 - FRUIT_PRICE, "a gap sells nothing");
});

test("the shop: without the coins nothing is bought", () => {
  let run = inShop(FRUIT_PRICE - 1);
  const before = run.pool.length;
  run = press(run, { confirm: true });
  assert.equal(run.pool.length, before);
  assert.equal(run.coins, FRUIT_PRICE - 1);
  assert.notEqual(run.shop!.fruits[0], null);
});

test("the shop: a reroll costs one more each time and restocks the shelf", () => {
  let run = inShop(10);
  run.shop!.cursor = SHOP_REROLL;
  run = press(run, { confirm: true });
  assert.equal(run.coins, 9);
  run = press(run, { confirm: true });
  assert.equal(run.coins, 7);
  assert.equal(run.shop!.fruits.filter((f) => f !== null).length, 3);
});

test("the shop: removal takes one of the chosen kind out of the pool, and Space backs out of choosing", () => {
  let run = inShop(10);
  run.pool = ["cherry", "cherry", "grape", "grape", "apple"];
  run.shop!.cursor = SHOP_REMOVE;
  run = press(run, { confirm: true });
  assert.equal(run.shop!.removing, true);
  run = press(run, { drop: true });
  assert.equal(run.shop!.removing, false);
  assert.equal(run.phase, "shop", "Space left the choosing, not the shop");
  run = press(run, { confirm: true });
  run = press(run, { right: true });
  run = press(run, { confirm: true });
  assert.deepEqual(run.pool, ["cherry", "cherry", "grape", "apple"]);
  assert.equal(run.coins, 10 - REMOVAL_PRICE);
  assert.equal(run.shop!.removing, false);

  run.pool = ["cherry", "cherry", "grape", "apple"];
  run = press(run, { confirm: true });
  assert.equal(run.shop!.removing, false, "a pool of 4 cannot shrink: it is one hand");
});

test("the shop: up and down change rows, and the last action leaves for the next cycle", () => {
  let run = inShop(0);
  run = press(run, { down: true });
  assert.equal(run.shop!.cursor, SHOP_REMOVE);
  run = press(run, { right: true });
  run = press(run, { right: true });
  assert.equal(run.shop!.cursor, SHOP_LEAVE);
  run = press(run, { up: true });
  assert.equal(run.shop!.cursor, SHOP_ITEM);
  run = press(run, { down: true });
  run = press(run, { confirm: true });
  assert.equal(run.phase, "order");
  assert.equal(run.cycle, 2);
});

test("the Lid: bought in the shop, it holds one overflow in and is used up", () => {
  let run = inShop(ITEMS.lid.price);
  run.shop!.item = "lid";
  run.shop!.cursor = SHOP_ITEM;
  run = press(run, { confirm: true });
  assert.deepEqual(run.items, ["lid"]);
  assert.equal(run.coins, 0);
  assert.equal(run.shop!.item, null);

  run.phase = "settle";
  run.fruits = [fruit(1, "cherry", 300, RIM - 20), fruit(2, "cherry", 340, JAR.floor - 14)];
  const score = run.cycleScore;
  resolve(run);
  assert.equal(run.fruits.length, 2, "nothing spilled");
  assert.equal(run.cycleScore, score, "and nothing was lost");
  assert.deepEqual(run.items, []);
  run.phase = "settle";
  resolve(run);
  assert.equal(run.fruits.length, 1, "the next overflow spills");
});

test("paying the last rent wins the run without a shop", () => {
  let run = jarWith([]);
  run.cycle = 5;
  run.turn = 5;
  run.cycleScore = RENT[4]!;
  resolve(run);
  run = press(run, { confirm: true });
  assert.equal(run.phase, "won");
});

test("a Prune is rotten from the start, does not spread, and scores for each other rotten fruit it touches", () => {
  const y = JAR.floor - 14;
  const banana = { ...fruit(2, "banana", 330, y, [1]), rotten: true };
  const run = jarWith([fruit(1, "prune", 300, y, [2, 3]), banana, fruit(3, "cherry", 270, y, [1])]);
  assert.equal(run.fruits[0]!.rotten, true);
  resolve(run);
  assert.equal(run.cycleScore, FRUITS.prune.points, "one rotten neighbour");
  assert.equal(run.fruits.find((f) => f.id === 3)!.rotten, false, "the Prune rotted nothing");
});

test("a Fruit Fly eats a rotten fruit it touches and another hatches; it never eats a Prune", () => {
  const y = JAR.floor - 10;
  const banana = { ...fruit(2, "banana", 330, y, [1]), rotten: true };
  const run = jarWith([fruit(1, "fruitfly", 300, y, [2, 3]), banana, fruit(3, "prune", 270, y, [1])]);
  resolve(run);
  assert.deepEqual(run.fruits.map((f) => f.kind).sort(), ["fruitfly", "fruitfly", "prune"]);
  assert.equal(run.cycleScore, FRUITS.fruitfly.points);
});

test("a rotten Fig blown up makes every Banana score +1 for the rest of the run", () => {
  const y = JAR.floor - 8;
  const run = jarWith([{ ...fruit(1, "fig", 300, y), rotten: true }, fruit(3, "fig", 340, y)]);
  run.fruits.push({ ...fruit(2, "chili", 320, y), lit: true, fuse: 0 });
  simulate(run, DT);
  assert.equal(run.bananaBonus, 1, "only the rotten one counts");
  run.fruits = [fruit(4, "banana", 300, JAR.floor - 18)];
  const before = run.cycleScore;
  resolve(run);
  assert.equal(run.cycleScore - before, 3);
});

test("a Kiwi becomes a copy of the landed fruit it touches, and stays a Kiwi on the bare floor", () => {
  const y = JAR.floor - 18;
  const run = jarWith([{ ...fruit(1, "kiwi", 300, y, [2]), landed: false }, fruit(2, "orange", 340, y, [1]), { ...fruit(3, "kiwi", 380, y), landed: false }]);
  simulate(run, DT);
  assert.deepEqual(run.fruits.map((f) => f.kind).sort(), ["kiwi", "orange", "orange"]);
  assert.equal(run.cycleScore, FRUITS.kiwi.points + FRUITS.orange.points, "the one on the floor landed as a Kiwi, the copy as an Orange");
});

test("a Peach bounces when it lands and shoves what it landed on aside", () => {
  const y = JAR.floor - 18;
  const run = jarWith([{ ...fruit(1, "peach", 300, y - 30, [2, 3]), landed: false }, fruit(2, "grape", 282, y, [1]), fruit(3, "grape", 318, y, [1])]);
  simulate(run, DT);
  const [peach, left, right] = run.fruits as [Fruit, Fruit, Fruit];
  assert.ok(peach.kicks === 1 && peach.kickY < 0, "up");
  assert.ok(left.kickX < 0 && right.kickX > 0, "apart");
});

test("a Honeydew scores 2 a turn and honeys one fruit it touches each turn, which then scores 2 as well", () => {
  const y = JAR.floor - 22;
  const run = jarWith([fruit(1, "honeydew", 300, y, [2, 3]), fruit(2, "orange", 344, y, [1]), fruit(3, "orange", 256, y, [1])]);
  run.turn = 1;
  resolve(run);
  assert.equal(run.cycleScore, 2);
  assert.equal(run.fruits.filter((f) => f.honeyed).length, 2);
  run.turn = 1;
  run.phase = "settle";
  resolve(run);
  assert.equal(run.cycleScore, 2 + 4);
  assert.equal(run.fruits.filter((f) => f.honeyed).length, 3);
});

test("the Juicer crushes what stands on the floor at Resolve, for its points and a bonus", () => {
  const run = jarWith([fruit(1, "orange", 300, JAR.floor - 22, [2]), fruit(2, "grape", 310, JAR.floor - 70, [1])]);
  run.items = ["juicer"];
  run.turn = 1;
  resolve(run);
  assert.deepEqual(run.fruits.map((f) => f.kind), ["grape"]);
  assert.equal(run.cycleScore, FRUITS.orange.points + JUICER_BONUS);
});

test("the Shaker throws every fruit once the hand has dropped", () => {
  let run = newRun(5);
  run.items = ["shaker"];
  run.fruits = [fruit(1, "orange", 300, JAR.floor - 22)];
  run = press(run, { drop: true });
  for (let i = 0; i < 200 && run.phase === "drop"; i++) run = press(run, {});
  assert.equal(run.phase, "settle");
  assert.ok(run.fruits.every((f) => f.kicks === 1 && f.kickY < 0), "each thrown up");
});

test("the Preserves Jar: after the shop, the fruit kept stay in the jar for the next cycle", () => {
  let run = inShop(0);
  run.items = ["preserves"];
  run.fruits = [fruit(1, "apple", 380, JAR.floor - 18), fruit(2, "cherry", 250, JAR.floor - 14), fruit(3, "grape", 300, JAR.floor - 18), fruit(4, "lemon", 340, JAR.floor - 14)];
  run = press(run, { drop: true });
  assert.equal(run.phase, "preserve");
  // Left to right: cherry, grape, lemon, apple. Keep the cherry and the apple; a third is refused.
  run = press(run, { confirm: true });
  run = press(run, { right: true });
  run = press(run, { right: true });
  run = press(run, { right: true });
  run = press(run, { confirm: true });
  run = press(run, { left: true });
  run = press(run, { confirm: true });
  assert.deepEqual(run.kept, [2, 1]);
  run = press(run, { drop: true });
  assert.equal(run.phase, "order");
  assert.equal(run.cycle, 2);
  assert.deepEqual(run.fruits.map((f) => f.kind).sort(), ["apple", "cherry"]);
});

test("without fruit in the jar, the Preserves Jar asks nothing", () => {
  let run = inShop(0);
  run.items = ["preserves"];
  run = press(run, { drop: true });
  assert.equal(run.phase, "order");
});

test("every third cycle is the Peg jar, and the shop before it says so", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(bossCycle), [false, false, true, false, false]);
  const run = jarWith([]);
  run.cycle = 2;
  run.turn = 5;
  run.cycleScore = RENT[1]!;
  resolve(run);
  const shop = press(run, { confirm: true });
  assert.match(shop.message, /Peg jar/);
  assert.match(press(shop, { drop: true }).message, /Peg jar/);
});
