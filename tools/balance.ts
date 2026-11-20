/**
 * Plays whole runs on the engine's physics with no window and prints what each cycle scored, to tune the rent curve against.
 * The players are not clever: "skip" drops each hand as dealt and never picks; "random" takes a random offer; and one player for
 * each fruit takes that fruit whenever it is offered and nothing else, which shows what the fruit is worth next to "skip"
 * ("chili+blueberry+seed" takes any of those). They drop each hand as dealt, unless the player ends "/order" ("random/order"):
 * then it orders the hand greedily first (see `orderHand`), which shows what ordering is worth. A player ending "/thin"
 * ("skip/thin") spends its coins in the shop taking Cherries out of its pool; the others buy nothing. "/order/thin" does both. A player with "@" owns those items from the start
 * ("skip@juicer", "random@shaker+lid"). The rent is ignored (set to 0), so every run plays all its cycles.
 *
 *     node tools/balance.ts [runs per player, default 20] [players, e.g. skip,random,chili]
 *     BALANCE_BOSS=flip node tools/balance.ts 18 skip     (every run meets that boss jar)
 */
import { createPlayer, parseInputScript, RecordingBackend } from "@tsengine/player";
import { findComponent } from "@tsengine/testing";

import { bindings, gameConfig } from "../game.ts";
import { useGame } from "../src/GameState.ts";
import { FRUITS, OFFERABLE, type FruitKind } from "../src/rules/fruits.ts";
import type { ItemKind } from "../src/rules/items.ts";
import { bossNow, POINTS_PER_COIN, removalPrice, RENT, SETTLE_LIMIT, SHOP_REMOVE, type Boss, type Run } from "../src/rules/jar.ts";
import { Rng } from "../src/rules/rng.ts";

type Strategy = string;

const frame = (script: string) => parseInputScript(script, { bindings })[0]!;
const NONE = frame("_");
const ENTER = frame("Enter");
const SPACE = frame("Space");
const RIGHT = frame("right");
const DOWN = frame("down");

/** BALANCE_BOSS=flip plays every run's boss cycle in that jar, to compare the boss jars with each other. */
const forcedBoss = process.env["BALANCE_BOSS"] as Boss | undefined;

/**
 * A greedy order for a hand, index 0 dropping first. Fruit dropped first end up lower and get buried, so: the heavy fruit and
 * the Durian (which explodes under 3 fruit) first, the Apple next (it scores while it touches the floor or a wall), the small fruit
 * that pack the pile (Cherries, Blueberries, Seeds) before the Chili, the Chili last so it lands in a packed pile, and a Kiwi
 * straight after the fruit worth most to copy.
 */
function orderHand(hand: readonly FruitKind[]): FruitKind[] {
  const rank = (kind: FruitKind): number =>
    kind === "durian" || kind === "coconut" ? 0 : kind === "apple" ? 1 : kind === "chili" ? 4 : ["cherry", "blueberry", "seed", "pomegranate"].includes(kind) ? 3 : 2;
  const order: FruitKind[] = hand.filter((kind) => kind !== "kiwi").sort((a, b) => rank(a) - rank(b));
  for (const _ of hand.filter((kind) => kind === "kiwi")) {
    let best = -1;
    order.forEach((kind, i) => {
      if (kind !== "kiwi" && (best < 0 || FRUITS[kind].points > FRUITS[order[best] as FruitKind].points)) best = i;
    });
    order.splice(best + 1, 0, "kiwi");
  }
  return order;
}

const rent = RENT.slice();
(RENT as number[]).fill(0);

/** One run: each cycle's score, the pool's size at the end, and how long each turn's settle took. */
function play(seed: number, strategy: Strategy): { scores: number[]; pool: number; settles: number[] } {
  const backend = new RecordingBackend();
  const player = createPlayer(backend, { ...gameConfig, warn: () => {} });
  // After the player is made (making it resets the game's state): Play adds one to the seed when a run starts.
  useGame.setState({ screen: "title", paused: false, seed });
  const rng = new Rng(seed * 7919);
  const scores: number[] = [];
  let pool = 0;
  const settles: number[] = [];
  let settling = -1;
  let wait = 0;
  const [plan = "", owned = ""] = strategy.split("@");
  const thin = plan.includes("/thin");
  const order = plan.includes("/order");
  const picks = plan.replace("/thin", "").replace("/order", "");
  const items = owned === "" ? [] : (owned.split("+") as ItemKind[]);
  let queued: (typeof NONE)[] = [NONE, NONE, ENTER];
  for (let step = 0; step < 60000; step++) {
    backend.queueInput(queued.shift() ?? NONE);
    player.step();
    const found = findComponent("Play", player.world.root) as { s: { run: Run } } | null;
    // Every frame, not only the ones a key is chosen on: the settle's length is the last time seen before the phase moved on.
    if (found !== null && found.s.run.phase === "settle") settling = found.s.run.settleTime;
    else if (settling >= 0) {
      settles.push(settling);
      settling = -1;
    }
    if (found === null || queued.length > 0) continue;
    if (items.some((item) => !found.s.run.items.includes(item))) found.s.run = { ...found.s.run, items };
    if (forcedBoss !== undefined && found.s.run.boss !== forcedBoss) found.s.run = { ...found.s.run, boss: forcedBoss };
    const run = found.s.run;
    pool = run.pool.length;
    // A key, then a few idle frames, so a press is never read twice.
    if (wait > 0) {
      wait -= 1;
      continue;
    }
    wait = 3;
    if (run.phase === "order") {
      if (order && bossNow(run) !== "blind") found.s.run = { ...run, hand: orderHand(run.hand) };
      queued = [SPACE];
    }
    else if (run.phase === "pick") {
      const wanted = picks.split("+");
      const at = picks === "random" ? rng.int(0, 2) : run.offers.findIndex((kind) => wanted.includes(kind));
      // No card is chosen at first: one press of Right goes to the first, so the card at `at` is `at + 1` presses away.
      queued = at < 0 ? [SPACE] : [...Array<typeof NONE>(at + 1).fill(RIGHT).flatMap((f) => [f, NONE]), ENTER];
    } else if (run.phase === "rent") {
      // Once per cycle: the run was paid for a rent of 0, so swap that pay for what the real rent would have left.
      if (scores.length === run.cycle - 1) {
        const due = rent[scores.length] as number;
        const paid = Math.floor(run.cycleScore / POINTS_PER_COIN);
        found.s.run = { ...run, coins: run.coins - paid + Math.max(0, Math.floor((run.cycleScore - due) / POINTS_PER_COIN)) };
        scores.push(run.cycleScore);
      }
      queued = [ENTER];
    } else if (run.phase === "shop") {
      const shop = run.shop!;
      const canThin = thin && run.coins >= removalPrice(run) && run.pool.length > 4 && run.pool.includes("cherry");
      // Thinning: down to the actions (Remove is the first), Enter to open it, Right to the first kind (Cherry), Enter to take it out.
      if (!canThin) queued = [SPACE];
      else if (shop.removing) queued = shop.removeCursor < 0 ? [RIGHT] : [ENTER];
      else if (shop.cursor !== SHOP_REMOVE) queued = [DOWN];
      else queued = [ENTER];
    }
    else if (run.phase === "preserve") queued = [SPACE];
    else if (run.phase === "won" || run.phase === "over") break;
    else wait = 0;
  }
  player.close();
  return { scores, pool, settles };
}

const runs = Number(process.argv[2] ?? 20);
console.log(`rent now: ${rent.join(", ")}\n`);
const players = (process.argv[3]?.split(",") ?? ["skip", "random", ...OFFERABLE]) as Strategy[];
for (const strategy of players) {
  const all: number[][] = [];
  let pool = 0;
  const settles: number[] = [];
  for (let seed = 1; seed <= runs; seed++) {
    const result = play(seed, strategy);
    all.push(result.scores);
    pool += result.pool;
    settles.push(...result.settles);
  }
  settles.sort((a, b) => a - b);
  // A frame short of the limit counts: the settle gives up on the frame that reaches it.
  const stuck = settles.filter((t) => t >= SETTLE_LIMIT - 0.05).length;
  const settle = `settle ${(settles[Math.floor(settles.length / 2)] ?? 0).toFixed(1)}s, 90% ${(settles[Math.floor(settles.length * 0.9)] ?? 0).toFixed(1)}s, ${stuck}/${settles.length} hit ${SETTLE_LIMIT}s`;
  const median = (cycle: number) => all.map((s) => s[cycle] ?? 0).sort((a, b) => a - b)[Math.floor(runs / 2)];
  console.log(`${strategy.padEnd(34)} pool ${(pool / runs).toFixed(1).padStart(4)}  medians ${rent.map((_, c) => String(median(c)).padStart(4)).join(" ")}  ${settle}`);
  if (process.argv[4] !== "full") continue;
  console.log(`${strategy} (${runs} runs, pool ends at ${(pool / runs).toFixed(1)} fruit)`);
  for (let cycle = 0; cycle < rent.length; cycle++) {
    const scores = all.map((s) => s[cycle] ?? 0).sort((a, b) => a - b);
    const at = (share: number) => scores[Math.min(scores.length - 1, Math.floor(share * scores.length))];
    const made = scores.filter((s) => s >= (rent[cycle] as number)).length;
    console.log(`  cycle ${cycle + 1}: min ${at(0)}  10% ${at(0.1)}  25% ${at(0.25)}  median ${at(0.5)}  75% ${at(0.75)}  max ${at(1)}   makes rent ${rent[cycle]}: ${made}/${runs}`);
  }
}
