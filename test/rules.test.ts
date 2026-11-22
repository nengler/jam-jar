import assert from "node:assert/strict";
import { test } from "node:test";

import { blastBits, blastFlash, blastJolt, fruitResults, keywordResults, motes, poolRows, termsOf } from "../src/layout.ts";
import { DEMO_HOLD, demoKeys, demoOver, demoStep } from "../src/rules/demo.ts";
import { lessonAt, lessonDone, lessonNow, lessonShows, LESSONS } from "../src/rules/tutorial.ts";
import { APPLE, BANANA, FRUITS, GOLDEN, GOURD_BURST, GOURD_SIZES, HONEY, OFFERABLE, PUMPKIN_SEED, SLICES, type FruitKind } from "../src/rules/fruits.ts";
import {
  advance,
  BLAST_BONUS,
  BOSS_NAME,
  bossCycle,
  climbKind,
  bossFor,
  bossNow,
  CLEAR_TIME,
  COCONUT_MILK,
  dramatic,
  GIANT_LIFE,
  handSlots,
  PLUNGE_PAY,
  FRUIT_PRICE,
  JAR,
  JUICER_BONUS,
  JUICE_MOST,
  LIME_JUICE,
  keeps,
  newRun,
  NO_KEYS,
  onEdge,
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
  TRAY,
  type Run,
} from "../src/rules/jar.ts";
import { ITEMS, offerable } from "../src/rules/items.ts";
import { Rng } from "../src/rules/rng.ts";
import { keywordOf, KEYWORDS, keywordsIn, ruleWords } from "../src/rules/terms.ts";

const DT = 1 / 60;

function press(run: Run, keys: Partial<Keys>): Run {
  return advance(run, DT, { ...NO_KEYS, ...keys });
}

/** Let the clear-out between cycles play out: the next cycle's first hand is dealt after it. */
function cleared(run: Run): Run {
  for (let i = 0; i < 600 && run.phase === "clear"; i++) run = press(run, {});
  return run;
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

test("the tray drop: the whole hand appears at once, a fruit per lane, left to right", () => {
  let run = newRun(3);
  run.hand = ["apple", "cherry", "chili", "grape"];
  run = press(run, { drop: true });
  run = press(run, {});
  assert.deepEqual(run.fruits.map((f) => f.kind), ["apple", "cherry", "chili", "grape"]);
  assert.equal(run.queue.length, 0);
  const lane = (JAR.right - JAR.left) / 4;
  run.fruits.forEach((f, i) => {
    assert.ok(Math.abs(f.x - (JAR.left + lane * (i + 0.5))) <= TRAY.wobble, `${f.kind} stays in lane ${i}`);
  });
});

test("in the Blind jar the tray is shuffled before it drops: the same fruit, not always in the order dealt", () => {
  const hand: FruitKind[] = ["apple", "cherry", "chili", "grape"];
  let reordered = 0;
  for (let seed = 1; seed <= 8; seed++) {
    let run: Run = { ...newRun(seed), boss: "blind", cycle: 3 };
    run.hand = [...hand];
    run = press(run, { drop: true });
    run = press(run, {});
    const kinds = run.fruits.map((f) => f.kind);
    assert.deepEqual([...kinds].sort(), [...hand].sort(), "the whole hand drops");
    if (kinds.join() !== hand.join()) reordered += 1;
  }
  assert.ok(reordered >= 4, `shuffled in ${reordered} of 8 runs`);
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
  const run = jarWith([fruit(1, "cherry", 300, JAR.floor - 5, [2]), fruit(2, "cherry", 310, JAR.floor - 5, [1])]);
  simulate(run, DT);
  assert.deepEqual(run.fruits.map((f) => f.kind), ["grape"]);
  assert.deepEqual([run.fruits[0]!.x0, run.fruits[0]!.y0], [305, JAR.floor - 5], "made between them");
  // Against a wall, a bigger fruit made there starts inside the jar, not in the wall.
  const r = FRUITS.cherry.radius;
  const wall = jarWith([fruit(1, "cherry", JAR.right - r, JAR.floor - r, [2]), fruit(2, "cherry", JAR.right - r, JAR.floor - 3 * r, [1])]);
  simulate(wall, DT);
  assert.equal(wall.fruits[0]!.x0, JAR.right - FRUITS.grape.radius);
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

test("a Pumpkin Seed caught in a blast Climbs: a fruit grows where it was and scores, a size bigger every 3 Climbs, up to a Melon", () => {
  assert.deepEqual(
    Array.from({ length: 13 }, (_, n) => climbKind(n)),
    ["cherry", "cherry", "cherry", "grape", "grape", "grape", "orange", "orange", "orange", "melon", "melon", "melon", "melon"]
  );
  assert.equal(PUMPKIN_SEED.every, 3);
  const y = JAR.floor - 8;
  const run = jarWith([fruit(1, "pumpkinseed", 300, y)]);
  run.climbs = 3;
  run.fruits.push({ ...fruit(2, "chili", 312, y), lit: true, fuse: 0 });
  simulate(run, DT);
  const grown = run.fruits.filter((f) => f.kind === "grape");
  assert.equal(grown.length, 1, "the fourth Climb grows a Grape");
  assert.equal(grown[0]!.landed, true);
  assert.equal(run.climbs, 4, "the count is the run's");
  assert.equal(run.earned["Pumpkin Seed"], FRUITS.grape.points, "the Grape scores as it is made");
});

test("a Pumpkin Seed's Melon grows inside the jar's walls", () => {
  const y = JAR.floor - 8;
  const run = jarWith([fruit(1, "pumpkinseed", JAR.left + 7, y)]);
  run.climbs = 99;
  run.fruits.push({ ...fruit(2, "chili", JAR.left + 20, y), lit: true, fuse: 0 });
  simulate(run, DT);
  const melon = run.fruits.find((f) => f.kind === "melon");
  assert.ok(melon !== undefined && melon.x >= JAR.left + melon.r, "clear of the wall");
});

test("a Golden Apple pays its coins when a blast destroys it, but not while rotten", () => {
  const y = JAR.floor - 8;
  const run = jarWith([fruit(1, "goldenapple", 300, y), { ...fruit(2, "goldenapple", 290, y - 20), rotten: true }]);
  run.fruits.push({ ...fruit(3, "chili", 312, y), lit: true, fuse: 0 });
  simulate(run, DT);
  assert.equal(run.fruits.some((f) => f.kind === "goldenapple"), false, "both destroyed");
  assert.equal(run.coins, GOLDEN);
});

test("a Golden Apple pays its coins when the Juicer Crushes it", () => {
  const run = jarWith([fruit(1, "goldenapple", 300, JAR.floor - 18)]);
  run.items = ["juicer"];
  run.turn = 2;
  resolve(run);
  assert.equal(run.fruits.length, 0);
  assert.equal(run.coins, GOLDEN);
});

test("each Golden Apple in the jar when the rent is paid pays its coins on top of the rent's", () => {
  const run = jarWith([fruit(1, "goldenapple", 260, JAR.floor - 18), fruit(2, "goldenapple", 340, JAR.floor - 18)]);
  run.turn = 5;
  run.cycleScore = RENT[0]! + 3 * POINTS_PER_COIN;
  resolve(run);
  assert.equal(run.phase, "rent");
  assert.equal(run.coins, 3 + 2 * GOLDEN);
  assert.match(run.message, /from Golden Apples/);
  const missed = jarWith([fruit(1, "goldenapple", 260, JAR.floor - 18)]);
  missed.turn = 5;
  missed.cycleScore = 0;
  resolve(missed);
  assert.equal(missed.coins, 0, "a missed rent pays nothing");
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

test("Resolve: fruit over the rim spill and cost points; an Apple touching the jar's floor scores more", () => {
  const run = jarWith([fruit(1, "apple", 250, JAR.floor - 18), fruit(2, "apple", 300, RIM + 20), fruit(3, "cherry", 350, RIM - 2)]);
  run.cycleScore = 10;
  resolve(run);
  assert.equal(run.fruits.length, 2, "the cherry spilled");
  // -5 for the spill, then the Apple on the floor (its base and its Edge) and the one in mid air (its base alone).
  assert.equal(run.cycleScore, 10 - 5 + (APPLE.base + APPLE.edge) + APPLE.base);
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
  rich = cleared(press(rich, { drop: true }));
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

test("the shop by touch: a tap on a kind in the take-out dialog only chooses it, and a confirm then takes one of it out", () => {
  let run = inShop(10);
  run.pool = ["cherry", "cherry", "grape", "grape", "apple"];
  run.shop!.cursor = SHOP_REMOVE;
  run = press(run, { confirm: true });
  assert.equal(run.shop!.removeCursor, -1, "none is chosen at first");
  run = press(run, { confirm: true });
  assert.equal(run.pool.length, 5, "a confirm with none chosen takes nothing");
  run = press(run, { point: 1, confirm: true });
  assert.deepEqual([run.shop!.removeCursor, run.pool.length, run.shop!.removing], [1, 5, true], "tapped: chosen, still there");
  run = press(run, { point: 0, confirm: true });
  assert.deepEqual([run.shop!.removeCursor, run.pool.length], [0, 5], "another tap chooses another");
  run = press(run, { point: 1, confirm: true });
  run = press(run, { confirm: true });
  assert.deepEqual(run.pool, ["cherry", "cherry", "grape", "apple"], "the button (a confirm with no place) took it out");
  assert.equal(run.shop!.removing, false);
});

test("the shop: taking a fruit out costs two more each time, all run", () => {
  let run = inShop(20);
  run.pool = ["cherry", "cherry", "cherry", "grape", "grape", "apple"];
  run.shop!.cursor = SHOP_REMOVE;
  assert.equal(removalPrice(run), REMOVAL_PRICE);
  run = press(run, { confirm: true });
  run = press(run, { right: true });
  run = press(run, { confirm: true });
  assert.equal(run.coins, 20 - REMOVAL_PRICE);
  assert.equal(removalPrice(run), REMOVAL_PRICE + REMOVAL_STEP);
  run = press(run, { confirm: true });
  run = press(run, { right: true });
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
  run = cleared(press(run, { confirm: true }));
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
  run = cleared(press(run, { drop: true }));
  assert.equal(run.phase, "order");
  assert.equal(run.cycle, 2);
  assert.deepEqual(run.fruits.map((f) => f.kind).sort(), ["apple", "cherry"]);
});

test("without fruit in the jar, the Preserves Jar asks nothing", () => {
  let run = inShop(0);
  run.items = ["preserves"];
  run = press(run, { drop: true });
  assert.equal(run.phase, "clear", "only the clear-out");
  assert.equal(cleared(run).phase, "order");
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
    const next = cleared(press(shop, { drop: true }));
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
  // Each Apple scores 9, one on the floor and one against the right wall; from the turn after the Coconut cracks, the low one sits in milk: 18.
  assert.deepEqual(scores, [18, 18, 18, 27]);
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
  run = cleared(press(run, { drop: true }));
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
    [false, false, true, false, true, false, true, false, true],
    "a number with its sign is picked out wherever it is"
  );
  assert.deepEqual(
    ruleWords("Keeps this many 3 fruit, never Rotten. Still Merges.").map((w) => w.keyword),
    [false, false, false, false, false, false, true, false, true],
    "a bare number that follows no keyword is not, and a keyword's other forms are"
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
    // A Fresh fruit says what it scores first; the Pumpkin scores nothing for landing (it pays in its Plunge), and says nothing.
    if (def.scoring === "fresh" && def.points > 0) assert.ok(def.text.startsWith(`Fresh ${def.points}.`), `${kind}: "${def.text}"`);
    if (def.scoring === "fresh" && def.points === 0) assert.ok(!def.text.includes("Fresh"), `${kind}: "${def.text}"`);
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

test("a click or a tap on a card only chooses it, and a second puts it back, in the pick and in the shop; Enter or the Take/Buy button (a confirm on no place) takes it", () => {
  let run = jarWith([]);
  run.turn = 2;
  resolve(run);
  assert.equal(run.phase, "pick");
  assert.equal(run.offerCursor, -1, "no card is chosen at first");
  run = press(run, { confirm: true });
  assert.equal(run.phase, "pick", "and Enter on nothing takes nothing");
  const before = run.pool.length;
  run = press(run, { point: 0, confirm: true });
  assert.deepEqual([run.phase, run.offerCursor, run.pool.length], ["pick", 0, before], "chosen, not taken");
  run = press(run, { point: 2, confirm: true });
  run = press(run, { point: 2, confirm: true });
  assert.deepEqual([run.phase, run.offerCursor, run.pool.length], ["pick", -1, before], "the same card again: put back, not taken");
  run = press(run, { point: 2, confirm: true });
  assert.equal(run.offerCursor, 2, "and a third time: chosen again");
  const kind = run.offers[2]!;
  run = press(run, { confirm: true });
  assert.equal(run.pool.at(-1), kind, "the button: taken");

  let shop = inShop(10);
  shop = press(shop, { point: 1, confirm: true });
  shop = press(shop, { point: 1, confirm: true });
  assert.deepEqual([shop.shop!.cursor, shop.coins], [-1, 10], "tapped twice: put back, not bought");
  shop = press(shop, { confirm: true });
  assert.equal(shop.coins, 10, "and the button buys nothing while nothing is chosen");
  shop = press(shop, { point: 1, confirm: true });
  assert.equal(shop.shop!.cursor, 1, "chosen again");
  shop = press(shop, { confirm: true });
  assert.equal(shop.coins, 10 - FRUIT_PRICE, "the button: bought");
  shop = press(shop, { point: SHOP_REROLL });
  assert.equal(shop.shop!.cursor, SHOP_REROLL);
  shop = press(shop, { point: SHOP_LEAVE, confirm: true });
  assert.equal(shop.phase, "clear", "an action acts on one tap");
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
  const notes: number[] = [];
  for (let i = 0; i < 300 && run.phase === "tally"; i++) {
    run = press(run, {});
    seen.add(shownScore(run));
    if (run.sounds.includes("score")) notes.push(run.scoreNote);
  }
  assert.deepEqual(notes, [1, 2, 3], "a note for each score as it shows, one step up each time");
  assert.deepEqual([...seen], [0, 9, 18, 27], "counted up a fruit at a time");
  assert.equal(run.scoreNote, 3, "and each score rang the next note up");
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
  assert.equal(merge.text, `Merge +${FRUITS.giantpumpkin.points}`);
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

test("a Melon is offered now and then, in the middle place of a pick, and never in the shop", () => {
  let seen = 0;
  for (let seed = 1; seed <= 400; seed++) {
    const run = jarWith([]);
    run.seed = seed * 7919;
    run.turn = 2;
    resolve(run);
    assert.ok(run.offers[0] !== "melon" && run.offers[2] !== "melon");
    if (run.offers[1] === "melon") seen += 1;
  }
  // 10% of 400.
  assert.ok(seen > 20 && seen < 65, `${seen} in 400 picks`);
  assert.ok(!OFFERABLE.includes("melon"), "the shop sells only what a pick offers by default");
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
  run = cleared(press(run, { drop: true }));
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

test("leaving the shop clears the jar: its fruit pop one by one, left to right, then the next cycle's first hand is dealt", () => {
  let run = inShop(0);
  run.fruits = [fruit(1, "cherry", 380, JAR.floor - 14), fruit(2, "grape", 260, JAR.floor - 16), fruit(3, "apple", 320, JAR.floor - 18)];
  const cycle = run.cycle;
  run = press(run, { drop: true });
  assert.equal(run.phase, "clear");
  assert.deepEqual(run.fruits.map((f) => f.id), [1, 3], "the leftmost pops first");
  assert.equal(run.effects.at(-1)?.kind, "pop");
  const popped: number[][] = [];
  let frames = 0;
  for (; frames < 600 && run.phase === "clear"; frames++) {
    run = press(run, {});
    popped.push(run.fruits.map((f) => f.id));
  }
  assert.ok(popped.some((ids) => ids.join() === "1"), "then the middle one");
  assert.deepEqual([run.phase, run.cycle, run.cycleScore, run.fruits.length, run.hand.length], ["order", cycle + 1, 0, 0, 4]);
  assert.ok(Math.abs(frames * DT - CLEAR_TIME) < 0.05, `it takes ${CLEAR_TIME} s (${frames} frames)`);
});

test("a Preserves Jar's fruit stay through the clear-out; the rest pop", () => {
  let run = inShop(0);
  run.items = ["preserves"];
  run.fruits = [fruit(1, "cherry", 260, JAR.floor - 14), fruit(2, "grape", 320, JAR.floor - 16), fruit(3, "apple", 380, JAR.floor - 18)];
  run = press(run, { drop: true });
  run = press(run, { right: true });
  run = press(run, { confirm: true });
  assert.deepEqual(run.kept, [2]);
  run = cleared(press(run, { drop: true }));
  assert.deepEqual([run.phase, run.fruits.map((f) => f.id)], ["order", [2]]);
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
  assert.equal(FRUITS.apple.text, `Simmer ${APPLE.base}. Edge ${APPLE.edge}.`);
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
  assert.deepEqual(run.earned, { Apple: 27 });
  run.fruits = [fruit(4, "cherry", 250, JAR.floor - 14)];
  run.phase = "settle";
  resolve(run);
  assert.equal(run.bestTurn, 27, "a smaller turn leaves the best one");
  run.pool = ["cherry", "cherry", "grape", "apple", "banana"];
  run.earned = { Merge: 40, Apple: 90, Spill: -10, Cherry: 5, Crush: 12, Watermelon: 30 };
  assert.deepEqual(
    fruitResults(run),
    [
      { kind: "apple", points: 90 },
      { kind: "watermelon", points: 30 },
      { kind: "cherry", points: 5 },
    ],
    "every fruit that scored (a merge's Watermelon too), best first; the Grape and the Banana in the pool scored nothing"
  );
  assert.deepEqual(
    keywordResults(run),
    [
      { label: "Merge", points: 40 },
      { label: "Crush", points: 12 },
      { label: "Spill", points: -10 },
    ],
    "what scored that was no fruit's own, what lost points included"
  );
});

test("the tutorial's lessons: each waits for its moment, and is done when the player has done it or the moment has passed", () => {
  const none = { looked: false, moved: false, acted: false };
  const at = (phase: Run["phase"]): Run => ({ ...newRun(7), phase });
  const lesson = (id: string) => LESSONS.find((l) => l.id === id)!;
  assert.equal(lessonAt(0)!.id, "shelf");
  assert.equal(lessonAt(LESSONS.length), null, "past the last: the tutorial is over");

  // The shelf's lesson shows while ordering, and is done once a fruit has been looked at, or the hand dropped.
  assert.equal(lessonNow(0, at("order"))!.id, "shelf");
  assert.equal(lessonNow(0, at("drop")), null);
  assert.equal(lessonDone(lesson("shelf"), at("order"), none), false);
  assert.equal(lessonDone(lesson("shelf"), at("order"), { ...none, looked: true }), true);
  assert.equal(lessonDone(lesson("shelf"), at("drop"), none), true, "its moment passed");
  assert.equal(lessonDone(lesson("order"), at("order"), { ...none, looked: true }), false, "looking is not reordering");
  assert.equal(lessonDone(lesson("order"), at("order"), { ...none, moved: true }), true);
  assert.equal(lessonDone(lesson("drop"), at("order"), { looked: true, moved: true, acted: true }), false, "only dropping ends it");
  assert.deepEqual(LESSONS.filter((l) => l.told === true).map((l) => l.id), ["rent", "pool"], "the two that only tell have a Got it");

  // The pick's and the shop's wait for the first pick and the first shop.
  assert.equal(lessonShows(lesson("pick"), at("order")), false);
  assert.equal(lessonShows(lesson("pick"), at("pick")), true);
  assert.equal(lessonShows(lesson("score"), at("settle")), true);
  assert.equal(lessonShows(lesson("shop"), at("shop")), true);
  assert.equal(lessonDone(lesson("shop"), at("shop"), { ...none, acted: true }), true, "it lies over the shop's words, so it goes when there is something to read");
  const shopping = inShop(10);
  assert.equal(lessonDone(lesson("shop"), shopping, none), false, "nothing chosen yet");
  assert.equal(lessonDone(lesson("shop"), press(shopping, { point: 1, confirm: true }), none), true, "a card chosen: the Buy button stands where it lies");
  // Every lesson fits its card: a title, and words for the pointer and for the keyboard.
  for (const l of LESSONS) assert.ok(l.title.length <= 14 && l.text.length <= 90 && l.keysText.length <= 90, l.id);
});

test("an Apple's Edge: it scores more touching the jar's floor or either wall, and not in the middle of the pile", () => {
  const mid = (JAR.left + JAR.right) / 2;
  const r = FRUITS.apple.radius;
  const score = (x: number, y: number): number => {
    const run = jarWith([fruit(1, "apple", x, y)]);
    run.turn = 1;
    resolve(run);
    return run.cycleScore;
  };
  assert.equal(score(mid, JAR.floor - r), APPLE.base + APPLE.edge, "on the floor");
  assert.equal(score(JAR.left + r, 200), APPLE.base + APPLE.edge, "against the left wall, off the floor");
  assert.equal(score(JAR.right - r, 200), APPLE.base + APPLE.edge, "against the right wall");
  assert.equal(score(mid, 200), APPLE.base, "in the middle, touching neither");
  const flipped = jarWith([fruit(1, "apple", mid, RIM + r)]);
  flipped.flipped = true;
  assert.equal(onEdge(flipped, flipped.fruits[0]!), true, "the Flip jar's lid is its floor while it is turned over");
});

test("a blast's sparks and ring: the same every time for the same blast, flying out, and gone by its end", () => {
  const at = (age: number) => blastBits([{ id: 7, x: 300, y: 200, age }], 0.54);
  assert.deepEqual(at(0.1), at(0.1), "nothing random: a replay shows the same blast");
  assert.ok(at(0.05).some((b) => b.id.includes("r")), "the ring runs out at first");
  assert.ok(!at(0.4).some((b) => b.id.includes("r")), "and is gone before the sparks");
  const spread = (age: number) => Math.max(...at(age).map((b) => Math.hypot(b.x - 300, b.y - 200)));
  assert.ok(spread(0.3) > spread(0.05) + 30, "the sparks fly outwards");
  assert.equal(at(0.54).length, 0, "nothing is left when the blast is over");
  assert.ok(blastFlash([{ age: 0 }]) === 1 && blastFlash([{ age: 0.2 }]) === 0, "the jar is lit for an instant");
  assert.ok(Math.abs(blastJolt([{ age: 0 }])) > 2 && blastJolt([{ age: 0.3 }]) === 0, "and jolted, briefly");
});

test("the shelf's sounds: the cursor ticks, and a held fruit changing place is a move, which the screen plays more softly", () => {
  let run = newRun(7);
  run.hand = ["cherry", "grape", "orange", "apple"];
  run = press(run, { right: true });
  assert.deepEqual(run.sounds, ["tick"], "the cursor went to the next fruit");
  run = press(run, { confirm: true });
  assert.deepEqual(run.sounds, ["tick"], "picked up");
  run = press(run, { right: true });
  assert.deepEqual(run.sounds, ["move"], "carried past a neighbour");
  assert.deepEqual(run.hand, ["cherry", "orange", "grape", "apple"]);
});

// The Ladder set: merge up, smash down.

test("a Wide Pumpkin takes two places on the shelf: a hand fills four places, and one that would not fit waits for the next hand", () => {
  const run = newRun(3);
  run.draw = ["cherry", "pumpkin", "grape", "pumpkin", "apple", "cherry"];
  run.hand = [];
  run.phase = "rent";
  // Deal by hand, as the next turn would: draw until the shelf's four places are full.
  const dealt = advance({ ...run, phase: "pick", offers: ["apple", "apple", "apple"], offerCursor: -1 }, DT, { ...NO_KEYS, drop: true });
  assert.deepEqual(dealt.hand, ["cherry", "pumpkin", "grape"]);
  assert.equal(handSlots(dealt.hand), 4);
  // The next Pumpkin is on top, and with it only two more places are left: an Apple, then the Cherry.
  const next = advance({ ...dealt, phase: "pick", offers: ["apple", "apple", "apple"], offerCursor: -1 }, DT, { ...NO_KEYS, drop: true });
  assert.deepEqual(next.hand, ["pumpkin", "apple", "cherry"]);
});

test("the tray drops a Wide Pumpkin down the middle of its two lanes", () => {
  let run = newRun(3);
  run.hand = ["cherry", "pumpkin", "grape"];
  run = advance(run, DT, { ...NO_KEYS, drop: true });
  run = advance(run, DT, NO_KEYS);
  const lane = (JAR.right - JAR.left) / 4;
  const [cherry, pumpkin, grape] = run.fruits as [Fruit, Fruit, Fruit];
  assert.ok(Math.abs(cherry.x - (JAR.left + lane * 0.5)) <= TRAY.wobble + 1e-9, `${cherry.x}`);
  assert.ok(Math.abs(pumpkin.x - (JAR.left + lane * 2)) <= TRAY.wobble + 1e-9, `${pumpkin.x}`);
  assert.ok(Math.abs(grape.x - (JAR.left + lane * 3.5)) <= TRAY.wobble + 1e-9, `${grape.x}`);
});

test("a Pumpkin Plunges: it Smashes the ladder fruit it hits, throws the rest, and pays for its Smashes in one burst at the floor", () => {
  const m = FRUITS.melon.radius;
  const p = FRUITS.pumpkin.radius;
  const run = jarWith([fruit(1, "melon", 320, JAR.floor - 120), fruit(2, "apple", 360, JAR.floor - 110)]);
  run.fruits.push({ ...fruit(3, "pumpkin", 330, JAR.floor - 120 - m - p, [1, 2]), landed: false });
  simulate(run, DT);
  const pumpkin = run.fruits.find((f) => f.id === 3)!;
  assert.ok((pumpkin.plunging ?? 0) > 0, "it Plunges as it lands");
  assert.equal(run.cycleScore, 0, "and scores nothing for landing");
  assert.deepEqual(run.fruits.map((f) => f.kind).sort(), ["apple", "orange", "orange", "pumpkin"], "the Melon is Smashed into 2 Oranges");
  assert.ok(run.fruits.filter((f) => f.kind === "orange").every((f) => f.kicks > 0), "its pieces are thrown");
  assert.ok(run.fruits.find((f) => f.id === 2)!.kicks > 0, "the Apple is thrown aside");
  assert.equal(run.popups.length, 0, "nothing is paid on the way down");

  // At the floor: the burst, in one big popup.
  pumpkin.y = JAR.floor - p;
  pumpkin.touching = [];
  simulate(run, DT);
  const worth = Math.round(2 * FRUITS.orange.points * PLUNGE_PAY);
  const burst = run.popups.find((pop) => pop.text === `+${worth}`);
  assert.ok(burst !== undefined && burst.big === true, run.popups.map((pop) => pop.text).join());
  assert.equal(run.cycleScore, worth);
  assert.equal(pumpkin.plunging, 0);
});

test("a frozen fruit stops a Pumpkin's Plunge, and is not thrown", () => {
  const p = FRUITS.pumpkin.radius;
  const run = jarWith([{ ...fruit(1, "orange", 320, JAR.floor - 120), frozen: true }]);
  run.fruits.push({ ...fruit(2, "pumpkin", 320, JAR.floor - 120 - 22 - p, [1]), landed: false });
  simulate(run, DT);
  assert.equal(run.fruits.find((f) => f.id === 2)!.plunging, 0);
  assert.ok(run.fruits.some((f) => f.id === 1 && f.kind === "orange" && f.kicks === 0));
});

test("a Watermelon Smashed breaks into Slices worth more than it; two Slices make a Melon that cannot Merge again this turn", () => {
  const w = FRUITS.watermelon.radius;
  const p = FRUITS.pumpkin.radius;
  const run = jarWith([fruit(1, "watermelon", 320, JAR.floor - w)]);
  run.fruits.push({ ...fruit(2, "pumpkin", 320, JAR.floor - 2 * w - p, [1]), landed: false });
  simulate(run, DT);
  assert.equal(run.fruits.filter((f) => f.kind === "slice").length, SLICES);
  assert.ok(SLICES * FRUITS.slice.points > FRUITS.watermelon.points);

  // Blasted, too: the Slices score in its place, as they are made.
  const blasted = jarWith([fruit(1, "watermelon", 320, JAR.floor - w)]);
  blasted.fruits.push({ ...fruit(2, "chili", 360, JAR.floor - 14), lit: true, fuse: 0 });
  simulate(blasted, DT);
  assert.equal(blasted.fruits.filter((f) => f.kind === "slice").length, SLICES);
  assert.ok(blasted.popups.some((pop) => pop.text === `Slice +${SLICES * FRUITS.slice.points}`));

  // The loop cap: a Melon made of Slices waits for the next turn to Merge again.
  const s = FRUITS.slice.radius;
  const capped = jarWith([{ ...fruit(1, "slice", 300, JAR.floor - s, [2]), piece: true }, { ...fruit(2, "slice", 300 + 2 * s, JAR.floor - s, [1]), piece: true }, fruit(3, "melon", 360, JAR.floor - 25)]);
  simulate(capped, DT);
  const made = capped.fruits.find((f) => f.kind === "melon" && f.id !== 3)!;
  assert.equal(made.remerged, true);
  made.touching = [3];
  (capped.fruits.find((f) => f.id === 3) as Fruit).touching = [made.id];
  simulate(capped, DT);
  assert.equal(capped.fruits.filter((f) => f.kind === "melon").length, 2, "the new Melon waits");
  resolve(capped);
  assert.ok(capped.fruits.every((f) => f.remerged !== true), "and may Merge next turn");
});

test("a Gourd Absorbs a fruit no bigger than itself, grows a size each time, and at Melon size Bursts into Cherries", () => {
  const y = JAR.floor - 14;
  let run = jarWith([fruit(1, "gourd", 300, y, [2, 3]), fruit(2, "cherry", 328, y, [1]), fruit(3, "orange", 270, JAR.floor - 22, [1])]);
  simulate(run, DT);
  const grown = run.fruits.find((f) => f.kind === "gourd")!;
  assert.equal(grown.r, GOURD_SIZES[1]);
  assert.ok(run.fruits.some((f) => f.kind === "orange"), "an Orange is too big for it");
  assert.ok(!run.fruits.some((f) => f.kind === "cherry"));
  assert.equal(run.cycleScore, FRUITS.cherry.points);

  // At an Orange's size, a rotten Grape is its last: it Bursts into rotten Cherries.
  run = jarWith([{ ...fruit(1, "gourd", 300, y, [2]), r: GOURD_SIZES[2] as number }, { ...fruit(2, "grape", 335, y, [1]), rotten: true }]);
  simulate(run, DT);
  assert.equal(run.fruits.length, GOURD_BURST);
  assert.ok(run.fruits.every((f) => f.kind === "cherry" && f.rotten));
});

test("two Watermelons make a Giant Pumpkin: it scores, its Shockwave throws the pile and Smashes a Watermelon, then it vanishes", () => {
  const w = FRUITS.watermelon.radius;
  const run = jarWith([
    fruit(1, "watermelon", 260, JAR.floor - w, [2]),
    fruit(2, "watermelon", 260 + 2 * w, JAR.floor - w, [1]),
    fruit(3, "watermelon", 380, JAR.floor - w),
    fruit(4, "cherry", 300, JAR.floor - 2 * w - 14),
  ]);
  simulate(run, DT);
  assert.ok(run.fruits.some((f) => f.kind === "giantpumpkin"));
  assert.equal(run.fruits.filter((f) => f.kind === "slice").length, SLICES, "the third Watermelon is Smashed");
  assert.ok((run.fruits.find((f) => f.id === 4) as Fruit).kicks > 0, "the Cherry is thrown");
  assert.equal(run.cycleScore, FRUITS.giantpumpkin.points + SLICES * FRUITS.slice.points);
  for (let t = 0; t <= GIANT_LIFE + DT; t += DT) simulate(run, DT);
  assert.ok(!run.fruits.some((f) => f.kind === "giantpumpkin"), "it is gone");
});
