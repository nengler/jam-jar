/**
 * Plays whole runs on the engine's physics with no window and prints what each cycle scored, to tune the rent curve against.
 * The players are not clever: "skip" drops each hand as dealt and never picks; "random" takes a random offer; and one player for
 * each fruit takes that fruit whenever it is offered and nothing else, which shows what the fruit is worth next to "skip"
 * ("chili+blueberry+seed" takes any of those). They drop each hand as dealt, unless the player says how to arrange it:
 *
 * - "/order" ("random/order") arranges it greedily first (`trayHand`, or `orderHand` with "/spots"), which shows what a
 *   sensible arrangement is worth.
 * - "/best" plays the turn once for every arrangement of the hand (the physics is seeded, so each is played exactly as it would
 *   be), then plays the one that scored most that turn; "/worst" the one that scored least. They see what a player cannot, so
 *   the gap between them is the most arranging the hand could be worth. 24 tries a turn: about 25 times slower.
 * - "/fair" is "/best" without the luck: it plays each arrangement 3 times (BALANCE_TRIES), each with other landing spots or
 *   another wobble (`SPOTS` in jar.ts), takes the one with the best average, and plays it with luck none of the tries saw. What
 *   it gains is what a player who reads the jar perfectly could gain; "/best" minus "/fair" is what seeing the luck was worth.
 * - "/spots" plays the drop the game had before the tray (`TRAY` in jar.ts): a fruit at a time, each at a random spot. "/tray",
 *   the game's drop, is accepted and changes nothing, so older result files still read.
 * - "/melon", "/melonchance20" (a Melon in 20% of picks), "/giant50" (what a Giant Pumpkin scores), "/oranges", "/reach16" and "/smallcrush" try variants of the Ladder set (`LADDER` in jar.ts).
 *   "/wobble8" sets how far a fruit may wander in its lane (default 4 px; "/wobble0" lands every fruit mid-lane).
 *
 * A player ending "/thin" ("skip/thin") spends its coins in the shop taking Cherries out of its pool; the others buy nothing.
 * The flags combine ("random/tray/best/thin"). A player with "@" owns those items from the start ("skip@juicer",
 * "random@shaker+lid"). The rent is ignored (set to 0), so every run plays all its cycles.
 *
 *     node tools/balance.ts [runs per player, default 20] [players, e.g. skip,random,chili] [full] [first seed, default 1]
 *     BALANCE_BOSS=flip node tools/balance.ts 18 skip     (every run meets that boss jar)
 *     BALANCE_JSON=out.json node tools/balance.ts ...      (also writes every run's cycle scores, for tools/compare.ts)
 */
import { writeFileSync } from "node:fs";

import { createPlayer, parseInputScript, RecordingBackend, type Player } from "@tsengine/player";
import { captureHotState, type HotState } from "@tsengine/runtime";
import { findComponent } from "@tsengine/testing";

import { bindings, gameConfig } from "../game.ts";
import { useGame } from "../src/GameState.ts";
import { FRUITS, MELON_CHANCE, OFFERABLE, type FruitKind } from "../src/rules/fruits.ts";
import type { ItemKind } from "../src/rules/items.ts";
import { bossNow, LADDER, POINTS_PER_COIN, removalPrice, RENT, SETTLE_LIMIT, SHOP_REMOVE, SPOTS, TRAY, type Boss, type Run } from "../src/rules/jar.ts";
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

/** Every different arrangement of a hand (fewer than 24 when it holds two of a kind). */
function arrangements(hand: readonly FruitKind[]): FruitKind[][] {
  if (hand.length <= 1) return [hand.slice()];
  const out = new Map<string, FruitKind[]>();
  hand.forEach((kind, i) => {
    for (const rest of arrangements([...hand.slice(0, i), ...hand.slice(i + 1)])) out.set([kind, ...rest].join(), [kind, ...rest]);
  });
  return [...out.values()];
}

/**
 * A greedy arrangement for the tray drop, index 0 in the leftmost lane. Lanes side by side land touching, so it scores each
 * arrangement by its neighbours and lanes and takes the best: two of a kind that merge side by side, a Kiwi or a Lemon beside
 * the fruit worth most, the Apple in an outer lane (Edge: it scores more against a wall), the Chili in a middle one (it explodes
 * once it touches 4), Blueberries (Dense) beside the Chili.
 */
function trayHand(hand: readonly FruitKind[]): FruitKind[] {
  const worth = (kind: FruitKind) => (kind === "kiwi" || kind === "lemon" ? 0 : FRUITS[kind].points);
  const pair = (a: FruitKind, b: FruitKind): number => {
    if (a === b && (FRUITS[a].mergesInto !== undefined || a === "watermelon" || a === "pomegranate")) return 20;
    if (a === "kiwi" || a === "lemon") return worth(b);
    if (b === "kiwi" || b === "lemon") return worth(a);
    if ((a === "chili" && b === "blueberry") || (a === "blueberry" && b === "chili")) return 4;
    return 0;
  };
  const value = (lanes: FruitKind[]): number => {
    let total = 0;
    lanes.forEach((kind, i) => {
      const outer = i === 0 || i === lanes.length - 1;
      if (kind === "apple" && outer) total += 6;
      if (kind === "chili" && !outer) total += 5;
      if (i > 0) total += pair(lanes[i - 1] as FruitKind, kind);
    });
    return total;
  };
  let best = hand.slice();
  for (const lanes of arrangements(hand)) if (value(lanes) > value(best)) best = lanes;
  return best;
}

/** Everything that decides the next frame: the game state, the tree's state and the player's clock (as rewind keeps them). */
interface Snapshot {
  game: Record<string, unknown>;
  hot: HotState;
  clock: ReturnType<Player["snapshotClock"]>;
}

function copyState(saved: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(saved)) {
    try {
      out[key] = structuredClone(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}

function takeSnapshot(player: Player): Snapshot {
  const hot = new Map<string, Record<string, unknown>>();
  const root = player.world.root.children[0];
  if (root !== undefined) for (const [path, saved] of captureHotState(root)) hot.set(path, copyState(saved));
  return { game: structuredClone(useGame.store.values()), hot, clock: player.snapshotClock() };
}

function restoreSnapshot(player: Player, snapshot: Snapshot): void {
  useGame.store.restore(structuredClone(snapshot.game));
  const hot = new Map<string, Record<string, unknown>>();
  for (const [path, saved] of snapshot.hot) hot.set(path, copyState(saved));
  if (!player.restoreTo(gameConfig, hot, snapshot.clock)) throw new Error("balance: could not restore a snapshot");
}

type Found = { s: { run: Run } };
const findPlay = (player: Player) => findComponent("Play", player.world.root) as Found | null;

/**
 * Drop `hand` and play until the turn is scored and over (the pick, the rent or the next hand): the points it added. Phases
 * the turn passes through are order (until the drop key is read), drop, settle and tally. A try stops at the tally, which only
 * shows points already counted.
 */
/**
 * One frame. The recording backend keeps every frame it draws and every sound it plays, which the bots never read: over the
 * thousands of trial turns a run plays, that grew a process past 3 GB, so it is dropped as it goes.
 */
function advance(player: Player, backend: RecordingBackend): void {
  player.step();
  backend.frames.length = 0;
  backend.textMeasures.length = 0;
  backend.plays.length = 0;
  backend.playVolumes.length = 0;
}

function playTurn(player: Player, backend: RecordingBackend, hand: FruitKind[], settles?: number[], trial = false): number {
  const start = findPlay(player)!;
  const before = start.s.run.total;
  start.s.run = { ...start.s.run, hand };
  backend.queueInput(SPACE);
  advance(player, backend);
  let left = false;
  let settled = -1;
  for (let step = 0; step < 6000; step++) {
    const run = findPlay(player)?.s.run;
    if (run === undefined) break;
    if (run.phase === "settle") settled = run.settleTime;
    if (trial && run.phase === "tally") return run.total - before;
    const playing = run.phase === "drop" || run.phase === "settle" || run.phase === "tally";
    if (playing) left = true;
    else if (left || run.phase !== "order") {
      if (settled >= 0) settles?.push(settled);
      return run.total - before;
    }
    backend.queueInput(NONE);
    advance(player, backend);
  }
  return (findPlay(player)?.s.run.total ?? before) - before;
}

/**
 * The arrangement of the hand that scores most this turn ("best") or least ("worst"), found by playing each from a snapshot, with
 * the turn's own luck. "fair" plays each `tries` times with other luck (`SPOTS.salt` 1, 2, ...) and takes the best average.
 */
function searchHand(player: Player, backend: RecordingBackend, hand: readonly FruitKind[], want: "best" | "worst" | "fair", tries: number): { hand: FruitKind[]; points: number } {
  const snapshot = takeSnapshot(player);
  let chosen = { hand: hand.slice(), points: want === "worst" ? Infinity : -Infinity };
  for (const tried of arrangements(hand)) {
    let points = 0;
    for (let k = 1; k <= (want === "fair" ? tries : 1); k++) {
      restoreSnapshot(player, snapshot);
      SPOTS.salt = want === "fair" ? k : 0;
      points += playTurn(player, backend, tried, undefined, true);
    }
    SPOTS.salt = 0;
    if (want === "fair") points /= tries;
    if (want === "worst" ? points < chosen.points : points > chosen.points) chosen = { hand: tried, points };
  }
  restoreSnapshot(player, snapshot);
  return chosen;
}

const rent = RENT.slice();
(RENT as number[]).fill(0);

/** One run: each cycle's score, the pool's size at the end, and how long each turn's settle took. */
/**
 * What happened in a run, for the Ladder set's checks (design doc, "Rules and checks"): its points by what earned them (the run's
 * own `earned`), and how many Giant Pumpkins formed (counted by id as they appear). With "/best", "/worst" or "/fair" the tries
 * are counted too, so read these from players that drop as dealt or "/order".
 */
interface Events {
  earned: Record<string, number>;
  giants: number;
  /** Smashes: counted from the pieces they leave (4 Slices, or 2 of the next size down); "/best" and "/fair" undercount them. */
  smashes: number;
}

function play(seed: number, strategy: Strategy): { scores: number[]; pool: number; settles: number[]; mismatches: number; events: Events } {
  const backend = new RecordingBackend();
  const player = createPlayer(backend, { ...gameConfig, warn: () => {} });
  // After the player is made (making it resets the game's state): Play adds one to the seed when a run starts.
  useGame.setState({ screen: "title", paused: false, seed });
  const rng = new Rng(seed * 7919);
  const scores: number[] = [];
  let pool = 0;
  const settles: number[] = [];
  let settling = -1;
  let mismatches = 0;
  const giants = new Set<number>();
  const slices = new Set<number>();
  const pieces = new Set<number>();
  let earned: Record<string, number> = {};
  let wait = 0;
  let coins = 0;
  const [plan = "", owned = ""] = strategy.split("@");
  const thin = plan.includes("/thin");
  const order = plan.includes("/order");
  const search = plan.includes("/best") ? "best" : plan.includes("/worst") ? "worst" : plan.includes("/fair") ? "fair" : null;
  TRAY.on = !plan.includes("/spots");
  // The Ladder set's variants (`LADDER` in jar.ts): "/melon", "/oranges", "/reach16" (any number), "/smallcrush".
  LADDER.melonPick = /\/melon(\/|$)/.test(plan);
  LADDER.oranges = plan.includes("/oranges");
  // The Smashed rework, which the game plays: "/oldpumpkin" goes back to the first-built Pumpkin (it Crushes small fruit),
  // "/psmash" has the Pumpkin Smash the biggest fruit of any kind (Crushing one off the ladder; "/psmashladder" is the game's
  // ladder fruit only), "/nosmashall" turns off Smashed as a general rule, "/smashblasts" has explosions Smash too.
  LADDER.pumpkinSmash = !plan.includes("/oldpumpkin");
  LADDER.smashOther = plan.includes("/psmash") && !plan.includes("/psmashladder") ? "destroy" : "none";
  LADDER.smashAll = !plan.includes("/nosmashall");
  LADDER.smashBlasts = plan.includes("/smashblasts");
  // The Plunge: "/plunge" (the Pumpkin drives to the floor, Smashing ladder fruit and throwing the rest), "/plungenosmash" (only throwing).
  LADDER.plunge = plan.includes("/plunge");
  LADDER.plungeSmash = !plan.includes("/plungenosmash");
  // Tuning it: "/nopiecescore" (a Plunge's pieces score nothing as they are made), "/cap2" (it Smashes only the first 2 fruit),
  // "/pfresh6" (what a Pumpkin scores when it lands).
  LADDER.plungeScores = !plan.includes("/nopiecescore");
  LADDER.plungeCap = Number(/\/cap(\d+)/.exec(plan)?.[1] ?? 0);
  LADDER.pumpkinPoints = Number(/\/pfresh(\d+)/.exec(plan)?.[1] ?? FRUITS.pumpkin.points);
  // "/burst" (a Plunge's Smashes score in one popup at the floor), "/pay75" (the share of the pieces' points a Plunge's Smash pays).
  LADDER.plungeBurst = plan.includes("/burst");
  LADDER.plungePay = Number(/\/pay(\d+)/.exec(plan)?.[1] ?? 100) / 100;
  LADDER.melonChance = Number(/\/melonchance(\d+)/.exec(plan)?.[1] ?? MELON_CHANCE * 100) / 100;
  LADDER.giantPoints = Number(/\/giant(\d+)/.exec(plan)?.[1] ?? FRUITS.giantpumpkin.points);
  LADDER.crushReach = Number(/\/reach(\d+)/.exec(plan)?.[1] ?? 8);
  LADDER.crushSmall = plan.includes("/smallcrush");
  TRAY.wobble = Number(/\/wobble(\d+)/.exec(plan)?.[1] ?? 4);
  // With no luck to average over (a tray with no wobble), one try is the whole story.
  const tries = TRAY.on && TRAY.wobble === 0 ? 1 : Number(process.env["BALANCE_TRIES"] ?? 3);
  const picks = plan.replace(/\/(thin|order|best|worst|fair|tray|wobble\d+|spots|melonchance\d+|melon|oranges|reach\d+|smallcrush|giant\d+|psmashladder|psmash|nosmashall|smashall|smashblasts|oldpumpkin|plungenosmash|plunge|nopiecescore|cap\d+|pfresh\d+|burst|pay\d+)/g, "");
  const items = owned === "" ? [] : (owned.split("+") as ItemKind[]);
  let queued: (typeof NONE)[] = [NONE, NONE, ENTER];
  for (let step = 0; step < 60000; step++) {
    backend.queueInput(queued.shift() ?? NONE);
    advance(player, backend);
    const found = findComponent("Play", player.world.root) as { s: { run: Run } } | null;
    // Every frame, not only the ones a key is chosen on: the settle's length is the last time seen before the phase moved on.
    if (found !== null) {
      for (const f of found.s.run.fruits) {
        if (f.kind === "giantpumpkin") giants.add(f.id);
        if (f.piece === true) (f.kind === "slice" ? slices : pieces).add(f.id);
      }
      earned = found.s.run.earned;
    }
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
      const blind = bossNow(run) === "blind";
      if (search !== null && !blind) {
        // The tries leave the player as they found it; the chosen hand is then played for real, which must score the same.
        const chosen = searchHand(player, backend, run.hand, search, tries);
        const points = playTurn(player, backend, chosen.hand, settles);
        // "fair" plays with luck its tries did not see, so only the others must match.
        if (search !== "fair" && points !== chosen.points) mismatches += 1;
        wait = 0;
        continue;
      }
      if (order && !blind) found.s.run = { ...run, hand: TRAY.on ? trayHand(run.hand) : orderHand(run.hand) };
      queued = [SPACE];
    }
    else if (run.phase === "pick") {
      const wanted = picks.split("+");
      const at = picks === "random" ? rng.int(0, 2) : run.offers.findIndex((kind) => wanted.includes(kind));
      // No card is chosen at first: one press of Right goes to the first, so the card at `at` is `at + 1` presses away.
      queued = at < 0 ? [SPACE] : [...Array<typeof NONE>(at + 1).fill(RIGHT).flatMap((f) => [f, NONE]), ENTER];
    } else if (run.phase === "rent") {
      // The coins the real rent would have left (the run itself was paid for a rent of 0).
      const due = rent[scores.length] as number;
      found.s.run = { ...run, coins: coins + Math.max(0, Math.floor((run.cycleScore - due) / POINTS_PER_COIN)) };
      scores.push(run.cycleScore);
      queued = [ENTER];
    } else if (run.phase === "shop") {
      const shop = run.shop!;
      const canThin = thin && run.coins >= removalPrice(run) && run.pool.length > 4 && run.pool.includes("cherry");
      // Thinning: down to the actions (Remove is the first), Enter to open it, Right to the first kind (Cherry), Enter to take it out.
      if (!canThin) queued = [SPACE];
      else if (shop.removing) queued = shop.removeCursor < 0 ? [RIGHT] : [ENTER];
      else if (shop.cursor !== SHOP_REMOVE) queued = [DOWN];
      else queued = [ENTER];
      coins = run.coins;
    }
    else if (run.phase === "preserve") queued = [SPACE];
    else if (run.phase === "won" || run.phase === "over") break;
    else wait = 0;
  }
  player.close();
  return { scores, pool, settles, mismatches, // Giant Pumpkins by the points they scored: "/best" and "/fair" play their turns out of this loop's sight, so ids miss them.
    events: { earned: { ...earned }, giants: Math.max(giants.size, Math.round((earned["Giant Pumpkin"] ?? 0) / LADDER.giantPoints)), smashes: slices.size / 4 + pieces.size / 2 } };
}

const runs = Number(process.argv[2] ?? 20);
const firstSeed = Number(process.argv[5] ?? 1);
const json = process.env["BALANCE_JSON"];
console.log(`rent now: ${rent.join(", ")}\n`);
const players = (process.argv[3]?.split(",") ?? ["skip", "random", ...OFFERABLE]) as Strategy[];
const written: Record<string, { seed: number; scores: number[] }[]> = {};
for (const strategy of players) {
  const all: number[][] = [];
  let pool = 0;
  let mismatches = 0;
  const settles: number[] = [];
  const events: Events[] = [];
  written[strategy] = [];
  for (let seed = firstSeed; seed < firstSeed + runs; seed++) {
    const result = play(seed, strategy);
    all.push(result.scores);
    pool += result.pool;
    mismatches += result.mismatches;
    settles.push(...result.settles);
    events.push(result.events);
    written[strategy]!.push({ seed, scores: result.scores });
    if (json !== undefined) writeFileSync(json, JSON.stringify(written));
  }
  // A searched turn played for real must score what its try did; if not, a snapshot missed something and "/best" is not exact.
  if (mismatches > 0) console.log(`${strategy}: ${mismatches} turns played differently from their tries`);
  settles.sort((a, b) => a - b);
  // A frame short of the limit counts: the settle gives up on the frame that reaches it.
  const stuck = settles.filter((t) => t >= SETTLE_LIMIT - 0.05).length;
  const settle = `settle ${(settles[Math.floor(settles.length / 2)] ?? 0).toFixed(1)}s, 90% ${(settles[Math.floor(settles.length * 0.9)] ?? 0).toFixed(1)}s, ${stuck}/${settles.length} hit ${SETTLE_LIMIT}s`;
  const median = (cycle: number) => all.map((s) => s[cycle] ?? 0).sort((a, b) => a - b)[Math.floor(runs / 2)];
  console.log(`${strategy.padEnd(34)} pool ${(pool / runs).toFixed(1).padStart(4)}  medians ${rent.map((_, c) => String(median(c)).padStart(4)).join(" ")}  ${settle}`);
  // The Ladder set's checks: how often its big-fruit events happen, their share of the points, and how much spills.
  const per = (label: string) => events.reduce((sum, e) => sum + (e.earned[label] ?? 0), 0) / runs;
  const total = events.reduce((sum, e) => sum + Object.values(e.earned).reduce((a, b) => a + Math.max(0, b), 0), 0) / runs;
  const ladder = per("Slice") + per("Smash") + per("Crush") + per("Gourd") + per("Giant Pumpkin") + per("Pumpkin");
  const giantRuns = events.filter((e) => e.giants > 0).length;
  console.log(
    `${"".padEnd(34)} a run: ${total.toFixed(0)} points; Giant Pumpkins ${(events.reduce((a, e) => a + e.giants, 0) / runs).toFixed(2)} (in ${giantRuns}/${runs} runs), ` +
      `Smashes ${(events.reduce((a, e) => a + e.smashes, 0) / runs).toFixed(2)} (+${(per("Slice") + per("Smash")).toFixed(0)}), Ladder events ${(events.reduce((a, e) => a + e.smashes + e.giants, 0) / runs).toFixed(2)}, Crush +${per("Crush").toFixed(0)}, Pumpkin +${per("Pumpkin").toFixed(0)}, Gourd +${per("Gourd").toFixed(0)}, ` +
      `Ladder share ${((100 * ladder) / Math.max(1, total)).toFixed(0)}%, spills ${(-per("Spill") / 5).toFixed(1)} (${(-per("Spill") / 5 / rent.length).toFixed(1)} a cycle)`
  );
  if (process.argv[4] !== "full") continue;
  // What earned the points, a run on average, the most first.
  const labels = [...new Set(events.flatMap((e) => Object.keys(e.earned)))].map((label) => ({ label, points: per(label) })).sort((a, b) => b.points - a.points);
  console.log(`  points a run by source: ${labels.map((l) => `${l.label} ${l.points.toFixed(0)}`).join(", ")}`);
  console.log(`${strategy} (${runs} runs, pool ends at ${(pool / runs).toFixed(1)} fruit)`);
  for (let cycle = 0; cycle < rent.length; cycle++) {
    const scores = all.map((s) => s[cycle] ?? 0).sort((a, b) => a - b);
    const at = (share: number) => scores[Math.min(scores.length - 1, Math.floor(share * scores.length))];
    const made = scores.filter((s) => s >= (rent[cycle] as number)).length;
    console.log(`  cycle ${cycle + 1}: min ${at(0)}  10% ${at(0.1)}  25% ${at(0.25)}  median ${at(0.5)}  75% ${at(0.75)}  max ${at(1)}   makes rent ${rent[cycle]}: ${made}/${runs}`);
  }
}
