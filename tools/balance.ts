/**
 * Plays whole runs on the engine's physics with no window and prints what each cycle scored, to tune the rent curve against.
 * The players are not clever: "skip" drops each hand as dealt and never picks; "random" takes a random offer; and one player for
 * each fruit takes that fruit whenever it is offered and nothing else, which shows what the fruit is worth next to "skip"
 * ("chili+blueberry+seed" takes any of those). None of them orders a hand. A player ending "/thin" ("skip/thin") spends its coins
 * in the shop taking Cherries out of its pool; the others buy nothing. A player with "@" owns those items from the start
 * ("skip@juicer", "random@shaker+lid"). The rent is ignored (set to 0), so every run plays all its cycles.
 *
 *     node tools/balance.ts [runs per player, default 20] [players, e.g. skip,random,chili]
 *     BALANCE_BOSS=flip node tools/balance.ts 18 skip     (every run meets that boss jar)
 */
import { createPlayer, parseInputScript, RecordingBackend } from "@tsengine/player";
import { findComponent } from "@tsengine/testing";

import { bindings, gameConfig } from "../game.ts";
import { useGame } from "../src/GameState.ts";
import { OFFERABLE } from "../src/rules/fruits.ts";
import type { ItemKind } from "../src/rules/items.ts";
import { POINTS_PER_COIN, REMOVAL_PRICE, RENT, SHOP_REMOVE, type Boss, type Run } from "../src/rules/jar.ts";
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

const rent = RENT.slice();
(RENT as number[]).fill(0);

/** One run: each cycle's score, how many fruit spilled, and the pool's size at the end. */
function play(seed: number, strategy: Strategy): { scores: number[]; pool: number } {
  const backend = new RecordingBackend();
  const player = createPlayer(backend, { ...gameConfig, warn: () => {} });
  // After the player is made (making it resets the game's state): Play adds one to the seed when a run starts.
  useGame.setState({ screen: "title", paused: false, seed });
  const rng = new Rng(seed * 7919);
  const scores: number[] = [];
  let pool = 0;
  let wait = 0;
  let coins = 0;
  const [plan = "", owned = ""] = strategy.split("@");
  const thin = plan.endsWith("/thin");
  const picks = plan.replace("/thin", "");
  const items = owned === "" ? [] : (owned.split("+") as ItemKind[]);
  let queued: (typeof NONE)[] = [NONE, NONE, ENTER];
  for (let step = 0; step < 60000; step++) {
    backend.queueInput(queued.shift() ?? NONE);
    player.step();
    const found = findComponent("Play", player.world.root) as { s: { run: Run } } | null;
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
    if (run.phase === "order") queued = [SPACE];
    else if (run.phase === "pick") {
      const wanted = picks.split("+");
      const at = picks === "random" ? rng.int(0, 2) : run.offers.findIndex((kind) => wanted.includes(kind));
      queued = at < 0 ? [SPACE] : [...Array<typeof NONE>(at).fill(RIGHT).flatMap((f) => [f, NONE]), ENTER];
    } else if (run.phase === "rent") {
      // The coins the real rent would have left (the run itself was paid for a rent of 0).
      const due = rent[scores.length] as number;
      found.s.run = { ...run, coins: coins + Math.max(0, Math.floor((run.cycleScore - due) / POINTS_PER_COIN)) };
      scores.push(run.cycleScore);
      queued = [ENTER];
    } else if (run.phase === "shop") {
      const shop = run.shop!;
      const canThin = thin && run.coins >= REMOVAL_PRICE && run.pool.length > 4 && run.pool.includes("cherry");
      // Thinning: down to the actions (Remove is the first), Enter to open it, Enter on the first kind (Cherry).
      if (!canThin) queued = [SPACE];
      else if (shop.removing) queued = [ENTER];
      else if (shop.cursor !== SHOP_REMOVE) queued = [DOWN];
      else queued = [ENTER];
      coins = run.coins;
    }
    else if (run.phase === "preserve") queued = [SPACE];
    else if (run.phase === "won" || run.phase === "over") break;
    else wait = 0;
  }
  player.close();
  return { scores, pool };
}

const runs = Number(process.argv[2] ?? 20);
console.log(`rent now: ${rent.join(", ")}\n`);
const players = (process.argv[3]?.split(",") ?? ["skip", "random", ...OFFERABLE]) as Strategy[];
for (const strategy of players) {
  const all: number[][] = [];
  let pool = 0;
  for (let seed = 1; seed <= runs; seed++) {
    const result = play(seed, strategy);
    all.push(result.scores);
    pool += result.pool;
  }
  const median = (cycle: number) => all.map((s) => s[cycle] ?? 0).sort((a, b) => a - b)[Math.floor(runs / 2)];
  console.log(`${strategy.padEnd(34)} pool ${(pool / runs).toFixed(1).padStart(4)}  medians ${rent.map((_, c) => String(median(c)).padStart(4)).join(" ")}`);
  if (process.argv[4] !== "full") continue;
  console.log(`${strategy} (${runs} runs, pool ends at ${(pool / runs).toFixed(1)} fruit)`);
  for (let cycle = 0; cycle < rent.length; cycle++) {
    const scores = all.map((s) => s[cycle] ?? 0).sort((a, b) => a - b);
    const at = (share: number) => scores[Math.min(scores.length - 1, Math.floor(share * scores.length))];
    const made = scores.filter((s) => s >= (rent[cycle] as number)).length;
    console.log(`  cycle ${cycle + 1}: min ${at(0)}  10% ${at(0.1)}  25% ${at(0.25)}  median ${at(0.5)}  75% ${at(0.75)}  max ${at(1)}   makes rent ${rent[cycle]}: ${made}/${runs}`);
  }
}
