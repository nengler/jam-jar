import assert from "node:assert/strict";
import { test } from "node:test";

import { fruitGlossary, motes, poolRows, scoringLabel } from "../src/layout.ts";
import { DEMO_HOLD, demoKeys, demoOver, demoStep } from "../src/rules/demo.ts";
import { FRUITS } from "../src/rules/fruits.ts";
import {
  advance,
  BLAST_BONUS,
  bossCycle,
  dramatic,
  FRUIT_PRICE,
  JAR,
  JUICER_BONUS,
  keeps,
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
  shownScore,
  simulate,
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

test("a Pitaya eats a Cherry it touches each turn, and every Pitaya scores 1 more from then on", () => {
  const y = JAR.floor - 18;
  const run = jarWith([fruit(1, "pitaya", 300, y, [2, 3]), fruit(2, "cherry", 332, y, [1]), fruit(3, "cherry", 268, y, [1])]);
  run.turn = 1;
  resolve(run);
  assert.equal(run.cycleScore, FRUITS.pitaya.points);
  assert.equal(run.fruits.filter((f) => f.kind === "cherry").length, 1, "one Cherry a turn");
  assert.equal(run.pitayaBonus, 1);
  run.turn = 1;
  run.phase = "settle";
  resolve(run);
  assert.equal(run.cycleScore, FRUITS.pitaya.points * 2 + 1);
});

test("a Coconut cracks at its third Resolve, and what touches the Cracked Coconut scores double but still merges", () => {
  const y = JAR.floor - 22;
  const run = jarWith([fruit(1, "coconut", 300, y)]);
  for (let turn = 0; turn < 3; turn++) {
    assert.equal(run.fruits[0]!.kind, "coconut");
    run.turn = 1;
    run.phase = "settle";
    resolve(run);
  }
  const shell = run.fruits[0]!;
  assert.equal(shell.kind, "cracked");
  run.fruits.push({ ...fruit(50, "cherry", 340, y, [shell.id, 51]), landed: false }, { ...fruit(51, "cherry", 370, y, [50]), landed: false });
  run.phase = "settle";
  const before = run.cycleScore;
  simulate(run, DT);
  // The Cherry beside the shell lands for 2, the other for 1, and they merge into a Grape (3): a Lemon would have stopped that.
  assert.equal(run.cycleScore - before, 2 + 1 + FRUITS.grape.points);
});

test("terms: a keyword is found in any of its forms, whatever punctuation follows it", () => {
  assert.equal(keywordOf("Blast."), "blast");
  assert.equal(keywordOf("Blasted:"), "blast");
  assert.equal(keywordOf("Rots"), "rotten");
  assert.equal(keywordOf("fruit"), undefined);
  assert.equal(keywordOf("blast"), undefined, "only with its capital");
  assert.deepEqual(
    ruleWords("Touching 4 fruit: Blast.").map((w) => w.keyword),
    [false, false, false, true]
  );
});

test("terms: a card's glossary is its scoring type, then the keywords in its text in order", () => {
  assert.deepEqual(keywordsIn(FRUITS.pomegranate.text, ["fresh"]), ["fresh", "blast", "merge", "burst"]);
  assert.deepEqual(fruitGlossary("chili", 2), [`Fresh: ${KEYWORDS.fresh.text}`, `Blast: ${KEYWORDS.blast.text}`]);
  assert.deepEqual(fruitGlossary(null, 2), []);
  assert.equal(scoringLabel("orange"), "Fresh 8");
  assert.equal(scoringLabel("lemon"), "Booster");
});

test("terms: card text keeps to the vocabulary: no scoring word, no other word for a keyword, and definitions that fit a line", () => {
  const banned = /\b(explode|explodes|blow|blown|blows|overflow|rots? spreads|Simmer:|Booster:|Fresh:)\b/i;
  for (const def of [...Object.values(FRUITS), ...Object.values(ITEMS)]) {
    assert.ok(!banned.test(def.text), `${def.name}: "${def.text}"`);
    assert.ok(def.text.endsWith("."), `${def.name} ends with a full stop`);
  }
  for (const def of Object.values(KEYWORDS)) assert.ok(def.text.length <= 60, `${def.name}: ${def.text.length} characters`);
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
  run.phase = "settle";
  run.calmTime = 10;
  run = press(run, {});
  assert.equal(run.phase, "tally");
  assert.equal(run.cycleScore, 15, "Resolve has scored all three (5 each, on the floor)");
  assert.equal(shownScore(run), 0, "none has shown yet");
  const delays = run.popups.map((p) => p.delay);
  assert.ok(delays[0]! < delays[1]! && delays[1]! < delays[2]!, "each later than the last");
  assert.ok(run.fruits.every((f) => f.pulseDelay > 0), "each lights up when its turn comes");

  const seen = new Set<number>();
  for (let i = 0; i < 300 && run.phase === "tally"; i++) {
    run = press(run, {});
    seen.add(shownScore(run));
  }
  assert.deepEqual([...seen], [0, 5, 10, 15], "counted up a fruit at a time");
  assert.equal(run.phase, "pick");
});

test("the tally: a jar with nothing to tally goes straight on, and a long one is squeezed into about two seconds", () => {
  let run = newRun(7);
  run.fruits = [fruit(1, "cherry", 250, JAR.floor - 14)];
  run.phase = "settle";
  run.calmTime = 10;
  run = press(run, {});
  assert.equal(run.phase, "pick");

  const many = jarWith(Array.from({ length: 30 }, (_, i) => fruit(i + 1, "apple", 230 + i * 6, JAR.floor - 18)));
  many.turn = 1;
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
  run.turn = 1;
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
  run.turn = 1;
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
    run.turn = 1;
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

  // Three more turns beside a rotten fruit: still a Banana of age 2, scoring 4 a turn.
  run.fruits.push({ ...fruit(9, "fig", 336, JAR.floor - 18, [1]), rotten: true });
  run.fruits[0]!.touching = [9];
  for (let turn = 0; turn < 3; turn++) {
    const before = run.cycleScore;
    run.turn = 1;
    run.phase = "settle";
    resolve(run);
    assert.equal(run.cycleScore - before, 4);
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
