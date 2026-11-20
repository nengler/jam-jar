import assert from "node:assert/strict";
import { test } from "node:test";

import { motes, poolRows, termsOf } from "../src/layout.ts";
import { DEMO_HOLD, demoKeys, demoOver, demoStep } from "../src/rules/demo.ts";
import { APPLE, BANANA, FRUITS, HONEY } from "../src/rules/fruits.ts";
import {
  advance,
  BLAST_BONUS,
  BOSS_NAME,
  bossCycle,
  bossFor,
  bossNow,
  COCONUT_MILK,
  dramatic,
  FRUIT_PRICE,
  JAR,
  JUICER_BONUS,
  JUICE_MOST,
  LIME_JUICE,
  keeps,
  newRun,
  NO_KEYS,
  topEarners,
  POINTS_PER_COIN,
  REMOVAL_PRICE,
  REMOVAL_STEP,
  removalPrice,
  rerollPrice,
  RENT,
  resolve,
  rollPool,
  RIM,
  SHOP_ITEM,
  SHOP_LEAVE,
  SHOP_REMOVE,
  SHOP_REROLL,
  shownScore,
  simulate,
  surface,
  type Fruit,
  type Keys,
  type Run,
} from "../src/rules/jar.ts";
import { ITEMS, offerable } from "../src/rules/items.ts";
import { Rng } from "../src/rules/rng.ts";
import { keywordOf, KEYWORDS, keywordsIn, ruleWords } from "../src/rules/terms.ts";

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
    pulse: 0,
    pulseDelay: 0,
    honeyed: kind === "honeydew",
    pickled: false,
    frozen: false,
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

test("ordering by touch: tap a fruit to pick it up, tap where it should stand, and the others keep their order", () => {
  let run = newRun(3);
  run.hand = ["cherry", "grape", "orange", "apple"];
  // The mouse over a fruit only moves the cursor.
  run = press(run, { point: 2 });
  assert.deepEqual([run.cursor, run.holding], [2, false]);
  // A tap on the first picks it up; a tap on the last puts it there, and the three between shuffle down.
  run = press(run, { point: 0, confirm: true });
  assert.deepEqual([run.cursor, run.holding], [0, true]);
  run = press(run, { point: 3, confirm: true });
  assert.deepEqual(run.hand, ["grape", "orange", "apple", "cherry"]);
  assert.deepEqual([run.cursor, run.holding], [3, false]);
  // In the Blind jar a tap does nothing.
  run.boss = "blind";
  run.cycle = 3;
  run = press(run, { point: 0, confirm: true });
  assert.deepEqual([run.cursor, run.holding], [3, false]);
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
  run.turn = 2;
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

test("a Chili touching 4 fruit explodes and scores what it destroys, with the explosion's bonus for each", () => {
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
  // -5 for the spill, then the deep Apple (its base and 5 of its Deep 6) and the shallow one (its base alone).
  assert.equal(run.cycleScore, 10 - 5 + (APPLE.base + 5) + APPLE.base);
});

test("a Banana scores more each turn and rots after 3", () => {
  const run = jarWith([fruit(1, "banana", 160, JAR.floor - 7)]);
  // Alone in the jar, its rot has nothing to spread to.
  const scores: number[] = [];
  for (let t = 0; t < 4; t++) {
    const before = run.cycleScore;
    run.turn = 2;
    resolve(run);
    scores.push(run.cycleScore - before);
  }
  assert.deepEqual(scores, [BANANA.base, BANANA.base + BANANA.ripen, BANANA.base + 2 * BANANA.ripen, 0]);
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
  assert.equal(run.shop!.cursor, -1, "nothing is chosen at first");
  run = press(run, { confirm: true });
  assert.equal(run.coins, 10, "and Enter on nothing buys nothing");
  run = press(run, { right: true });
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

test("the shop: a new shelf costs one more each time, all run, and restocks the shelf", () => {
  let run = inShop(10);
  run.shop!.cursor = SHOP_REROLL;
  run = press(run, { confirm: true });
  assert.equal(run.coins, 9);
  run = press(run, { confirm: true });
  assert.equal(run.coins, 7);
  assert.equal(run.shop!.fruits.filter((f) => f !== null).length, 3);
  assert.equal(rerollPrice(run), 3);
  // The next shop opens at the price this one reached.
  const next = inShop(10);
  next.rerolls = run.rerolls;
  assert.equal(rerollPrice(next), 3);
});

test("the shop by touch: a tap on a kind in the take-out dialog takes one of it out", () => {
  let run = inShop(10);
  run.pool = ["cherry", "cherry", "grape", "grape", "apple"];
  run.shop!.cursor = SHOP_REMOVE;
  run = press(run, { confirm: true });
  run = press(run, { point: 1, confirm: true });
  assert.deepEqual(run.pool, ["cherry", "cherry", "grape", "apple"]);
  assert.equal(run.shop!.removing, false);
});

test("the shop: taking a fruit out costs two more each time, all run", () => {
  let run = inShop(20);
  run.pool = ["cherry", "cherry", "cherry", "grape", "grape", "apple"];
  run.shop!.cursor = SHOP_REMOVE;
  assert.equal(removalPrice(run), REMOVAL_PRICE);
  run = press(run, { confirm: true });
  run = press(run, { confirm: true });
  assert.equal(run.coins, 20 - REMOVAL_PRICE);
  assert.equal(removalPrice(run), REMOVAL_PRICE + REMOVAL_STEP);
  run = press(run, { confirm: true });
  run = press(run, { confirm: true });
  assert.equal(run.coins, 20 - REMOVAL_PRICE - (REMOVAL_PRICE + REMOVAL_STEP));
  assert.equal(run.pool.length, 4);
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
  assert.equal(run.shop!.cursor, 0, "the first arrow goes to the first card");
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

test("a Prune is rotten from the start, scores for each other rotten fruit it touches, and spreads its rot", () => {
  const y = JAR.floor - 14;
  const banana = { ...fruit(2, "banana", 330, y, [1]), rotten: true };
  const run = jarWith([fruit(1, "prune", 300, y, [2, 3]), banana, fruit(3, "cherry", 270, y, [1])]);
  assert.equal(run.fruits[0]!.rotten, true);
  resolve(run);
  assert.equal(run.cycleScore, FRUITS.prune.points, "one rotten neighbour when it scored");
  assert.equal(run.fruits.find((f) => f.id === 3)!.rotten, true, "then the Prune rotted the Cherry");
});

test("rotten fruit still Merge, and what they make is rotten", () => {
  const y = JAR.floor - 10;
  let run = jarWith([{ ...fruit(1, "cherry", 300, y, [2]), rotten: true }, fruit(2, "cherry", 318, y, [1])]);
  run.phase = "settle";
  run = advance(run, 1 / 60, NO_KEYS, []);
  const grape = run.fruits.find((f) => f.kind === "grape");
  assert.ok(grape, "the two Cherries merged");
  assert.equal(grape.rotten, true);
  assert.equal(run.cycleScore, FRUITS.grape.points, "the Merge still scores");
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
  assert.equal(run.cycleScore - before, BANANA.base + 1);
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

test("a Honeydew scores its honey each turn and honeys one fruit it touches each turn, which then scores it as well", () => {
  const y = JAR.floor - 22;
  const run = jarWith([fruit(1, "honeydew", 300, y, [2, 3]), fruit(2, "orange", 344, y, [1]), fruit(3, "orange", 256, y, [1])]);
  run.turn = 2;
  resolve(run);
  assert.equal(run.cycleScore, HONEY);
  assert.equal(run.fruits.filter((f) => f.honeyed).length, 2);
  run.turn = 2;
  run.phase = "settle";
  resolve(run);
  assert.equal(run.cycleScore, HONEY + 2 * HONEY);
  assert.equal(run.fruits.filter((f) => f.honeyed).length, 3);
});

test("the Juicer crushes what stands on the floor at Resolve, for its points and a bonus", () => {
  const run = jarWith([fruit(1, "orange", 300, JAR.floor - 22, [2]), fruit(2, "grape", 310, JAR.floor - 70, [1])]);
  run.items = ["juicer"];
  run.turn = 2;
  resolve(run);
  assert.deepEqual(run.fruits.map((f) => f.kind), ["grape"]);
  assert.equal(run.cycleScore, FRUITS.orange.points + JUICER_BONUS);
});

test("the Shaker throws every fruit once the hand has dropped", () => {
  let run = newRun(5);
  run.items = ["shaker"];
  run.fruits = [fruit(1, "orange", 300, JAR.floor - 22)];
  run = press(run, { drop: true });
  // No fruit reports landing here, so each drop waits out its limit.
  for (let i = 0; i < 900 && run.phase === "drop"; i++) run = press(run, {});
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

test("every third cycle is a boss jar, one of four by the run's seed, and the shop before it says so", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map(bossCycle), [false, false, true, false, false]);
  assert.deepEqual([bossFor(8), bossFor(9), bossFor(10), bossFor(11)], ["blind", "peg", "tilt", "flip"]);
  for (const boss of ["peg", "blind", "tilt", "flip"] as const) {
    const run = jarWith([]);
    run.boss = boss;
    run.cycle = 2;
    run.turn = 5;
    run.cycleScore = RENT[1]!;
    assert.equal(bossNow(run), null, "not yet");
    resolve(run);
    const shop = press(run, { confirm: true });
    assert.match(shop.message, new RegExp(BOSS_NAME[boss]));
    const next = press(shop, { drop: true });
    assert.match(next.message, new RegExp(BOSS_NAME[boss]));
    assert.equal(bossNow(next), boss);
  }
});

test("the Blind jar: the hand cannot be chosen from or reordered, only dropped", () => {
  let run = newRun(3);
  run.boss = "blind";
  run.cycle = 3;
  const hand = run.hand.slice();
  run = press(run, { right: true });
  run = press(run, { confirm: true });
  run = press(run, { right: true });
  assert.equal(run.cursor, 0);
  assert.equal(run.holding, false);
  assert.deepEqual(run.hand, hand);
  run = press(run, { drop: true });
  assert.equal(run.phase, "drop");
  assert.deepEqual(run.queue.concat(run.fruits.map((f) => f.kind)).sort(), hand.slice().sort());
});

test("a Pitaya eats a Cherry it touches each turn, and every Pitaya scores 1 more from then on", () => {
  const y = JAR.floor - 18;
  const run = jarWith([fruit(1, "pitaya", 300, y, [2, 3]), fruit(2, "cherry", 332, y, [1]), fruit(3, "cherry", 268, y, [1])]);
  run.turn = 2;
  resolve(run);
  assert.equal(run.cycleScore, FRUITS.pitaya.points);
  assert.equal(run.fruits.filter((f) => f.kind === "cherry").length, 1, "one Cherry a turn");
  assert.equal(run.pitayaBonus, 1);
  run.turn = 2;
  run.phase = "settle";
  resolve(run);
  assert.equal(run.cycleScore, FRUITS.pitaya.points * 2 + 1);
});

test("a Coconut cracks at its third Resolve and is gone, leaving milk; fruit that sit in the milk score double", () => {
  const y = JAR.floor - 22;
  const run = jarWith([fruit(1, "coconut", 300, y), fruit(2, "apple", 360, JAR.floor - 18), fruit(3, "apple", 400, JAR.floor - 150)]);
  const scores: number[] = [];
  for (let turn = 0; turn < 4; turn++) {
    const before = run.cycleScore;
    run.turn = 2;
    run.phase = "settle";
    resolve(run);
    scores.push(run.cycleScore - before);
  }
  assert.ok(!run.fruits.some((f) => f.kind === "coconut"));
  assert.equal(run.juice, COCONUT_MILK);
  assert.equal(run.milk, true);
  assert.equal(run.lime, false);
  // The deep Apple scores 9 and the high one 6; from the turn after the Coconut cracks, the deep one sits in milk: 18.
  assert.deepEqual(scores, [15, 15, 15, 24]);
  assert.equal(run.popups.find((p) => p.points === 18)!.text, "+18 x2");
});

test("a Lime that is Exploded or Crushed leaves lime juice, which rises with each and is gone with the rent", () => {
  const y = JAR.floor - 18;
  let run = jarWith([fruit(1, "lime", 300, y), fruit(2, "lime", 330, y)]);
  run.fruits.push({ ...fruit(9, "chili", 316, y), lit: true, fuse: 0 });
  simulate(run, DT);
  assert.equal(run.juice, 2 * LIME_JUICE);
  assert.equal(run.lime, true);
  assert.equal(surface(run), JAR.floor - 2 * LIME_JUICE);

  run.items = ["juicer"];
  run.fruits = [fruit(3, "lime", 300, y)];
  run.turn = 2;
  resolve(run);
  assert.equal(run.juice, 3 * LIME_JUICE, "crushed by the Juicer");
  for (let i = 0; i < 20; i++) run.fruits.push(fruit(20 + i, "lime", 300, y));
  run.turn = 2;
  run.phase = "settle";
  resolve(run);
  assert.equal(run.juice, JUICE_MOST, "no deeper than the jar's liquid gets");

  run.turn = 5;
  run.cycleScore = RENT[0]!;
  run.phase = "settle";
  run.fruits = [];
  resolve(run);
  run = press(run, { confirm: true });
  run = press(run, { drop: true });
  assert.equal(run.cycle, 2);
  assert.deepEqual([run.juice, run.lime, run.milk], [0, false, false]);
});

test("a fruit that comes to rest afloat in lime juice has landed, and scores as one that reached the floor", () => {
  const run = jarWith([]);
  run.juice = 60;
  run.lime = true;
  run.fruits = [{ ...fruit(1, "orange", 300, JAR.floor - 60), landed: false, speed: 4 }];
  simulate(run, DT);
  assert.equal(run.fruits[0]!.landed, true);
  assert.equal(run.cycleScore, FRUITS.orange.points);
});

test("terms: a keyword is found by its capital, whatever punctuation follows it, and the number after it is coloured with it", () => {
  assert.equal(keywordOf("Exploder"), "exploder");
  assert.equal(keywordOf("Exploded:"), "exploded");
  assert.equal(keywordOf("Merged:"), "merge");
  assert.equal(keywordOf("fruit"), undefined);
  assert.equal(keywordOf("exploded"), undefined, "only with its capital");
  assert.deepEqual(
    ruleWords("Fresh 2. Exploder 4.").map((w) => w.keyword),
    [true, true, true, true]
  );
  assert.deepEqual(
    ruleWords("Each turn, Eat a Rotten fruit: +8 and Hatch.").map((w) => w.keyword),
    [false, false, true, false, true, false, false, false, true],
    "a number that does not follow a keyword is not"
  );
});

test("terms: a card's tooltip is every keyword in its text, in order, each with what it means", () => {
  assert.deepEqual(keywordsIn(FRUITS.pomegranate.text), ["fresh", "exploded", "merge", "burst"]);
  assert.deepEqual(
    termsOf(FRUITS.chili.text).map((t) => t.name),
    ["Fresh", "Exploder"]
  );
  assert.equal(termsOf(FRUITS.chili.text)[1]!.text, KEYWORDS.exploder.text);
});

test("terms: the numbers on the cards are the rules' numbers", () => {
  for (const [kind, def] of Object.entries(FRUITS)) {
    if (def.scoring === "fresh") assert.ok(def.text.startsWith(`Fresh ${def.points}.`), `${kind}: "${def.text}"`);
  }
  assert.match(FRUITS.blueberry.text, new RegExp(`Dense ${FRUITS.blueberry.touchWeight}\\.`));
  assert.match(ITEMS.preserves.text, new RegExp(`Preserve ${ITEMS.preserves.keeps}\\.`));
  assert.match(ITEMS.bigpreserves.text, new RegExp(`Preserve ${ITEMS.bigpreserves.keeps}\\.`));
});

test("terms: cards keep to the vocabulary, every keyword is used, and a definition fits its tooltip", () => {
  const banned = /\b(blast|blasted|blow|blown|blows|overflow|explosion)\b/i;
  const used = new Set<string>();
  for (const def of [...Object.values(FRUITS), ...Object.values(ITEMS)]) {
    assert.ok(!banned.test(def.text), `${def.name}: "${def.text}"`);
    assert.ok(def.text.endsWith("."), `${def.name} ends with a full stop`);
    assert.ok(keywordsIn(def.text).length <= 4, `${def.name}: a tooltip holds four keywords`);
    for (const keyword of keywordsIn(def.text)) used.add(keyword);
  }
  // Used in a definition or a message, not on a card of its own.
  for (const keyword of ["explode", "spill"]) used.add(keyword);
  for (const [keyword, def] of Object.entries(KEYWORDS)) {
    assert.ok(def.text.length <= 46, `${def.name}: ${def.text.length} characters`);
    assert.ok(used.has(keyword), `${def.name} is on no card`);
  }
});

test("the mouse: coming over a card chooses it, in the pick and in the shop, and a click on the chosen one is Enter on it", () => {
  let run = jarWith([]);
  run.turn = 2;
  resolve(run);
  assert.equal(run.phase, "pick");
  assert.equal(run.offerCursor, -1, "no card is chosen at first");
  run = press(run, { confirm: true });
  assert.equal(run.phase, "pick", "and Enter on nothing takes nothing");
  run = press(run, { point: 2 });
  assert.equal(run.offerCursor, 2);
  const kind = run.offers[1]!;
  run = press(run, { point: 1 });
  run = press(run, { point: 1, confirm: true });
  assert.equal(run.pool.at(-1), kind, "clicked: taken");

  let shop = inShop(10);
  shop = press(shop, { point: SHOP_REROLL });
  assert.equal(shop.shop!.cursor, SHOP_REROLL);
  shop = press(shop, { point: SHOP_LEAVE, confirm: true });
  assert.equal(shop.phase, "order", "an action acts on one tap");
});

test("a finger: the first tap on a card chooses it, so it can be read, and a second takes or buys it", () => {
  let run = jarWith([]);
  run.turn = 2;
  resolve(run);
  const before = run.pool.length;
  run = press(run, { point: 0, confirm: true });
  assert.deepEqual([run.phase, run.offerCursor, run.pool.length], ["pick", 0, before], "chosen, not taken");
  run = press(run, { point: 2, confirm: true });
  assert.deepEqual([run.phase, run.offerCursor, run.pool.length], ["pick", 2, before], "another card: chosen again");
  const kind = run.offers[2]!;
  run = press(run, { point: 2, confirm: true });
  assert.equal(run.pool.at(-1), kind, "the same card again: taken");

  let shop = inShop(10);
  shop = press(shop, { point: 1, confirm: true });
  assert.deepEqual([shop.shop!.cursor, shop.coins], [1, 10], "chosen, not bought");
  shop = press(shop, { point: 1, confirm: true });
  assert.equal(shop.coins, 10 - FRUIT_PRICE);
});

test("a tap that lands on no card leaves nothing chosen, in the pick and in the shop: the next tap on that card only chooses it again", () => {
  let run = jarWith([]);
  run.turn = 2;
  resolve(run);
  const before = run.pool.length;
  run = press(run, { point: 1, confirm: true });
  run = press(run, { away: true });
  assert.equal(run.offerCursor, -1, "tapped off: nothing is chosen");
  run = press(run, { point: 1, confirm: true });
  assert.deepEqual([run.phase, run.offerCursor, run.pool.length], ["pick", 1, before], "chosen again, not taken");

  let shop = inShop(10);
  shop = press(shop, { point: 1, confirm: true });
  shop = press(shop, { away: true });
  assert.equal(shop.shop!.cursor, -1);
  shop = press(shop, { point: 1, confirm: true });
  assert.deepEqual([shop.shop!.cursor, shop.coins], [1, 10], "chosen again, not bought");
});

test("readability: a popup names what earned it, and says x2 when a Booster doubled it", () => {
  const y = JAR.floor - 14;
  const merged = jarWith([fruit(1, "cherry", 300, y, [2]), fruit(2, "cherry", 326, y, [1])]);
  simulate(merged, DT);
  assert.equal(merged.popups.at(-1)!.text, "Merge +3");
  assert.ok(merged.fruits[0]!.pulse > 0, "the Grape it made lights up");

  const doubled = jarWith([{ ...fruit(1, "orange", 300, JAR.floor - 22, [2]), landed: false }, fruit(2, "lemon", 340, y, [1])]);
  simulate(doubled, DT);
  assert.equal(doubled.popups.at(-1)!.text, "+16 x2");
  assert.ok(doubled.fruits.every((f) => f.pulse > 0), "the Orange and the Lemon that doubled it light up");

  const plain = jarWith([{ ...fruit(1, "orange", 300, JAR.floor - 22), landed: false }]);
  simulate(plain, DT);
  assert.equal(plain.popups.at(-1)!.text, "+8");
  assert.equal(plain.fruits[0]!.pulse, 0, "a plain landing lights nothing up");

  const spill = jarWith([fruit(1, "cherry", 300, RIM - 20)]);
  resolve(spill);
  assert.equal(spill.popups.at(-1)!.text, "Spill -5");
});

test("readability: what sets a Chili off lights up", () => {
  const y = JAR.floor;
  const run = jarWith([fruit(1, "chili", 160, y - 6, [2, 3]), fruit(2, "blueberry", 170, y - 4, [1]), fruit(3, "apple", 147, y - 7, [1])]);
  simulate(run, DT);
  assert.ok(run.fruits[1]!.pulse > 0 && run.fruits[2]!.pulse > 0);
});

test("the tally: Simmer fruit score one after another, the score on screen catching up, before the pick comes up", () => {
  let run = newRun(7);
  run.fruits = [fruit(1, "apple", 250, JAR.floor - 18), fruit(2, "apple", 300, JAR.floor - 18), fruit(3, "apple", 350, JAR.floor - 18)];
  run.turn = 2;
  run.phase = "settle";
  run.calmTime = 10;
  run = press(run, {});
  assert.equal(run.phase, "tally");
  assert.equal(run.cycleScore, 27, "Resolve has scored all three (9 each, on the floor)");
  assert.equal(shownScore(run), 0, "none has shown yet");
  const delays = run.popups.map((p) => p.delay);
  assert.ok(delays[0]! < delays[1]! && delays[1]! < delays[2]!, "each later than the last");
  assert.ok(run.fruits.every((f) => f.pulseDelay > 0), "each lights up when its turn comes");

  const seen = new Set<number>();
  for (let i = 0; i < 300 && run.phase === "tally"; i++) {
    run = press(run, {});
    seen.add(shownScore(run));
  }
  assert.deepEqual([...seen], [0, 9, 18, 27], "counted up a fruit at a time");
  assert.equal(run.phase, "pick");
});

test("the tally: a jar with nothing to tally goes straight on, and a long one is squeezed into about two seconds", () => {
  let run = newRun(7);
  run.fruits = [fruit(1, "cherry", 250, JAR.floor - 14)];
  run.turn = 2;
  run.phase = "settle";
  run.calmTime = 10;
  run = press(run, {});
  assert.equal(run.phase, "pick");

  const many = jarWith(Array.from({ length: 30 }, (_, i) => fruit(i + 1, "apple", 230 + i * 6, JAR.floor - 18)));
  many.turn = 2;
  resolve(many);
  assert.ok(many.tallyTime > 2 && many.tallyTime < 3, `${many.tallyTime}`);
});

test("the tally: the rent's sound waits for it to end", () => {
  let run = newRun(7);
  run.fruits = [fruit(1, "apple", 250, JAR.floor - 18)];
  run.turn = 5;
  run.cycleScore = RENT[0]!;
  run.phase = "settle";
  run.calmTime = 10;
  run = press(run, {});
  assert.equal(run.phase, "tally");
  assert.ok(!run.sounds.includes("rent"));
  let heard = false;
  for (let i = 0; i < 300 && run.phase === "tally"; i++) {
    run = press(run, {});
    heard = heard || run.sounds.includes("rent");
  }
  assert.equal(run.phase, "rent");
  assert.ok(heard, "played as the rent panel came up");
});

test("readability: two popups in one place are stacked, not drawn on each other, and stay inside the jar", () => {
  const y = JAR.floor - 18;
  const run = jarWith([fruit(1, "apple", 300, y), fruit(2, "apple", 310, y)]);
  run.turn = 2;
  resolve(run);
  const [a, b] = run.popups as [Run["popups"][number], Run["popups"][number]];
  // The second shows a step of the tally after the first, which has risen by then: it is a line clear of where the first is then.
  const risen = a.y - 36 * (b.delay - a.delay);
  assert.ok(Math.abs(risen - b.y) >= 22 - 1e-9, `${risen} and ${b.y}`);

  // Two Watermelons against the left wall: "Merge +100" is moved in, so the wall does not cut it.
  const r = FRUITS.watermelon.radius;
  const wall = jarWith([fruit(1, "watermelon", JAR.left + r, JAR.floor - r, [2]), fruit(2, "watermelon", JAR.left + r, JAR.floor - 3 * r, [1])]);
  simulate(wall, DT);
  const merge = wall.popups.at(-1)!;
  assert.equal(merge.text, "Merge +100");
  assert.ok(merge.x > JAR.left + r + 20, `${merge.x}`);
});

test("a second Blast soon after the first is a chain: it says so, and both a chain and a big Blast are worth slowing down for", () => {
  const y = JAR.floor - 8;
  let run = jarWith([fruit(1, "cherry", 300, y)]);
  run.fruits.push({ ...fruit(2, "chili", 280, y), lit: true, fuse: 0 }, { ...fruit(3, "chili", 400, y), lit: true, fuse: 0.2 });
  run = press(run, {});
  assert.equal(run.chain, 1);
  assert.equal(dramatic(run), false, "one small Blast is not");
  let slowed = false;
  for (let i = 0; i < 30; i++) {
    run = press(run, {});
    slowed = slowed || dramatic(run);
  }
  assert.equal(run.chain, 2);
  assert.ok(slowed, "the second was");
  assert.ok(run.popups.some((p) => p.text === "Chain x2"));
  for (let i = 0; i < 120; i++) run = press(run, {});
  assert.equal(run.chain, 0, "the chain ends when no Blast follows");

  const big = jarWith([1, 2, 3, 4, 5].map((id) => fruit(id, "cherry", 290 + id * 4, y)));
  big.fruits.push({ ...fruit(9, "chili", 300, y), lit: true, fuse: 0 });
  assert.equal(dramatic(press(big, {})), true, "one Blast that destroys 5");
});

test("readability: a line joins a Booster to the fruit it doubled, and rot to the Prune that scores for it, at their turn in the tally", () => {
  const y = JAR.floor - 18;
  const run = jarWith([fruit(1, "apple", 300, y, [2]), fruit(2, "lemon", 334, y, [1]), fruit(3, "prune", 380, y, [4]), { ...fruit(4, "banana", 410, y, [3]), rotten: true }]);
  run.turn = 2;
  resolve(run);
  const boost = run.links.find((l) => l.kind === "boost")!;
  assert.deepEqual([boost.x1, boost.x2], [334, 300], "from the Lemon to the Apple");
  const rot = run.links.find((l) => l.kind === "rot")!;
  assert.deepEqual([rot.x1, rot.x2], [410, 380], "from the rotten Banana to the Prune");
  assert.ok(rot.delay > boost.delay && boost.delay > 0, "each with its own step of the tally");
  let later = run;
  for (let i = 0; i < 300; i++) later = press(later, {});
  assert.equal(later.links.length, 0, "and gone afterwards");
});

test("a hand drops a fruit at a time: the next waits for the last to land and the pile to rest, but not for ever", () => {
  let run = newRun(3);
  run = press(run, { drop: true });
  run = press(run, {});
  assert.equal(run.fruits.length, 1, "the first drops at once");
  for (let i = 0; i < 60; i++) run = press(run, {});
  assert.equal(run.fruits.length, 1, "the second waits: the first is still falling");

  // The first reports landing and lying still: the second follows.
  const first = run.fruits[0]!;
  const still = { id: first.id, x: first.x, y: JAR.floor - first.r, speed: 0, touching: [] };
  for (let i = 0; i < 20 && run.fruits.length === 1; i++) run = advance(run, DT, NO_KEYS, [still]);
  assert.equal(run.fruits.length, 2);

  // The second never reports anything: the third drops anyway after 3 seconds.
  let frames = 0;
  for (; frames < 400 && run.fruits.length === 2; frames++) run = press(run, {});
  assert.equal(run.fruits.length, 3);
  assert.ok(frames > 150 && frames < 200, `${frames} frames`);
});

test("a Merge that touches a Dragonfruit skips a size: two Cherries make an Orange, two Melons a Watermelon all the same", () => {
  const y = JAR.floor - 14;
  const run = jarWith([fruit(1, "cherry", 300, y, [2, 3]), fruit(2, "cherry", 326, y, [1]), fruit(3, "dragonfruit", 270, y, [1])]);
  simulate(run, DT);
  assert.deepEqual(run.fruits.map((f) => f.kind).sort(), ["dragonfruit", "orange"]);
  assert.equal(run.cycleScore, FRUITS.orange.points);

  const top = jarWith([fruit(1, "melon", 300, y, [2, 3]), fruit(2, "melon", 350, y, [1]), fruit(3, "dragonfruit", 260, y, [1])]);
  simulate(top, DT);
  assert.ok(top.fruits.some((f) => f.kind === "watermelon"), "there is no size past a Watermelon to skip to");
});

test("a Legendary is offered now and then, in the last place of a pick", () => {
  let seen = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const run = jarWith([]);
    run.seed = seed * 7919;
    run.turn = 2;
    resolve(run);
    assert.ok(!run.offers.slice(0, 2).includes("dragonfruit"));
    if (run.offers[2] === "dragonfruit") seen += 1;
  }
  assert.ok(seen > 10 && seen < 70, `${seen} in 400 picks`);
});

test("the Preserves Jar's upgrades: offered only to its owner, they take its place, and each keeps its own number", () => {
  assert.ok(!offerable([]).includes("bigpreserves") && !offerable([]).includes("pickling"));
  assert.ok(offerable(["preserves"]).includes("bigpreserves") && offerable(["preserves"]).includes("pickling"));
  assert.ok(!offerable(["bigpreserves"]).includes("preserves"), "not the jar it was upgraded from");
  assert.ok(!offerable(["bigpreserves"]).includes("pickling"), "nor the other upgrade: that needs the plain jar");

  let run = inShop(ITEMS.bigpreserves.price);
  run.items = ["lid", "preserves"];
  run.shop!.item = "bigpreserves";
  run.shop!.cursor = SHOP_ITEM;
  run = press(run, { confirm: true });
  assert.deepEqual(run.items, ["lid", "bigpreserves"]);
  assert.equal(keeps(run), 3);
});

test("the Pickling Jar keeps one fruit, Pickled: it does not age, rot it had is gone, and rot does not spread to it", () => {
  let run = inShop(0);
  run.items = ["pickling"];
  run.fruits = [{ ...fruit(1, "banana", 300, JAR.floor - 18), age: 2 }, fruit(2, "cherry", 340, JAR.floor - 14)];
  run = press(run, { drop: true });
  assert.equal(run.phase, "preserve");
  run = press(run, { confirm: true });
  run = press(run, { right: true });
  run = press(run, { confirm: true });
  assert.deepEqual(run.kept, [1], "it holds one");
  run = press(run, { drop: true });
  const banana = run.fruits[0]!;
  assert.equal(banana.pickled, true);

  // Three more turns beside a rotten fruit: still a Banana of age 2, scoring the same each turn.
  run.fruits.push({ ...fruit(9, "fig", 336, JAR.floor - 18, [1]), rotten: true });
  run.fruits[0]!.touching = [9];
  for (let turn = 0; turn < 3; turn++) {
    const before = run.cycleScore;
    run.turn = 2;
    run.phase = "settle";
    resolve(run);
    assert.equal(run.cycleScore - before, BANANA.base + 2 * BANANA.ripen);
  }
  assert.equal(run.fruits[0]!.age, 2);
  assert.equal(run.fruits[0]!.rotten, false);
});

test("the title's demo: it drops each hand, skips each pick, and starts a new run a while after the rent comes due", () => {
  let run = newRun(11);
  assert.equal(demoKeys(run).drop, true, "a hand to order: dropped as dealt");
  run = demoStep(run, DT, [], 0);
  assert.equal(run.phase, "drop");
  assert.equal(demoKeys(run).drop, false);
  run.phase = "pick";
  run.offers = ["apple", "lemon", "seed"];
  const pool = run.pool.length;
  run = demoStep(run, DT, [], 0);
  assert.equal(run.phase, "order");
  assert.equal(run.pool.length, pool, "skipped: nothing joined the pool");

  run.phase = "rent";
  assert.equal(demoOver(run), true);
  assert.equal(demoStep(run, DT, [], DEMO_HOLD - 0.1).phase, "rent", "the full jar is left on show");
  const next = demoStep(run, DT, [], DEMO_HOLD);
  assert.equal(next.phase, "order");
  assert.equal(next.cycle, 1);
  assert.equal(next.fruits.length, 0, "a new run, an empty jar");
});

test("the backdrop's motes are worked out from the time alone, stay on the wall, and move slowly", () => {
  assert.deepEqual(motes(12.5), motes(12.5));
  for (const time of [0, 3.7, 100, 4321]) for (const m of motes(time)) assert.ok(m.x >= -8 && m.x < 648 && m.y >= 0 && m.y <= 316, `${m.x}, ${m.y}`);
  const a = motes(10);
  const b = motes(10 + 1 / 60);
  assert.ok(a.every((m, i) => Math.abs(m.x - b[i]!.x) <= 1 && Math.abs(m.y - b[i]!.y) <= 1 || Math.abs(m.y - b[i]!.y) > 300), "a pixel a step at most, but for wrapping");
});

test("a Snow Pear freezes itself and what it touches at the end of a turn; Frozen fruit survive an explosion", () => {
  const y = JAR.floor - 18;
  const run = jarWith([fruit(1, "snowpear", 300, y, [2]), fruit(2, "cherry", 332, y, [1]), fruit(3, "cherry", 380, y)]);
  run.turn = 2;
  resolve(run);
  assert.deepEqual(
    run.fruits.map((f) => f.frozen),
    [true, true, false],
    "the pear and its neighbour, not the fruit apart"
  );
  assert.ok(run.links.some((l) => l.kind === "freeze"));

  run.phase = "settle";
  run.fruits.push({ ...fruit(9, "chili", 350, y), lit: true, fuse: 0 });
  simulate(run, DT);
  assert.deepEqual(run.fruits.map((f) => f.id).sort(), [1, 2], "the frozen two are left; the other Cherry is gone");
  assert.ok(run.fruits.every((f) => f.kicks === 0), "and not thrown");
});

test("the cards of the fruit with rules of their own say the rules' numbers", () => {
  assert.equal(FRUITS.apple.text, `Simmer ${APPLE.base}. Deep ${APPLE.deep}.`);
  assert.equal(FRUITS.banana.text, `Simmer ${BANANA.base}. Ripen ${BANANA.ripen}. Rots ${BANANA.rots}.`);
  assert.match(KEYWORDS.honeyed.text, new RegExp(`\\+${HONEY} `));
  assert.match(KEYWORDS.explode.text, new RegExp(`\\+${BLAST_BONUS.chili} \\(big \\+${BLAST_BONUS.durian}\\)`));
  assert.match(FRUITS.prune.text, new RegExp(`Simmer ${FRUITS.prune.points} per`));
  assert.match(FRUITS.fruitfly.text, new RegExp(`\\+${FRUITS.fruitfly.points} and Hatch`));
  assert.match(FRUITS.pitaya.text, new RegExp(`^Simmer ${FRUITS.pitaya.points}\\.`));
});

test("a pick comes after every second turn of a cycle, and the next hand is dealt straight away after the others", () => {
  const after = (turn: number): string => {
    const run = jarWith([]);
    run.turn = turn;
    run.hand = [];
    resolve(run);
    return `${run.phase} ${run.turn} ${run.hand.length}`;
  };
  assert.equal(after(1), "order 2 4", "no pick after the first: the next hand is on the shelf");
  assert.equal(after(2), "pick 3 0");
  assert.equal(after(3), "order 4 4");
  assert.equal(after(4), "pick 5 0");
  assert.equal(after(5).split(" ")[0], "over", "and the last turn goes to the rent (unpaid, with an empty jar)");
});

test("the run keeps what its end board shows: its best turn, and what earned its points, the most first", () => {
  const y = JAR.floor - 18;
  const run = jarWith([fruit(1, "apple", 250, y), fruit(2, "apple", 300, y), fruit(3, "apple", 350, y)]);
  run.turn = 1;
  resolve(run);
  assert.equal(run.bestTurn, 27, "three Apples simmering on the floor");
  assert.equal(run.turnScore, 0, "and the next turn starts from nothing");
  assert.deepEqual(topEarners(run, 3), [{ label: "Apple", points: 27 }]);
  run.fruits = [fruit(4, "cherry", 250, JAR.floor - 14)];
  run.phase = "settle";
  resolve(run);
  assert.equal(run.bestTurn, 27, "a smaller turn leaves the best one");
  run.earned = { Merge: 40, Apple: 90, Spill: -10, Cherry: 5, Crush: 12 };
  assert.deepEqual(
    topEarners(run, 3).map((e) => e.label),
    ["Apple", "Merge", "Crush"],
    "the three that scored most; what lost points is left out"
  );
});
