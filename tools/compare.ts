/**
 * Reads what `tools/balance.ts` wrote with BALANCE_JSON (any number of files, merged) and compares the ways of arranging a hand.
 * For each player: how many runs, the median score of the last cycle, how many runs score its rent, and what the whole run
 * scored next to the same player dropping each hand as dealt ("kiwi/tray/best" against "kiwi/tray"), seed by seed. The seeds
 * are the same, so the difference is paired: its 95% interval says whether arranging the hand did anything beyond noise.
 *
 *     node tools/compare.ts out/*.json
 */
import { readFileSync } from "node:fs";

import { RENT } from "../src/rules/jar.ts";

type Runs = Record<string, { seed: number; scores: number[] }[]>;

const all = new Map<string, Map<number, number[]>>();
for (const file of process.argv.slice(2)) {
  for (const [strategy, runs] of Object.entries(JSON.parse(readFileSync(file, "utf8")) as Runs)) {
    const bySeed = all.get(strategy) ?? new Map<number, number[]>();
    for (const run of runs) bySeed.set(run.seed, run.scores);
    all.set(strategy, bySeed);
  }
}

const last = RENT.length - 1;
const due = RENT[last] as number;
const sum = (scores: number[]) => scores.reduce((a, b) => a + b, 0);
const median = (values: number[]) => values.slice().sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 0;
/** The arrangement flags taken off: the same player dropping each hand as dealt. */
const asDealt = (strategy: string) => strategy.replace(/\/(order|best|worst)/g, "");

console.log(`${"player".padEnd(60)} runs  cycle ${last + 1} median  scores ${due}  run total vs as dealt (95%)`);
for (const strategy of [...all.keys()].sort()) {
  const runs = all.get(strategy)!;
  const scores = [...runs.values()];
  const lastCycle = scores.map((s) => s[last] ?? 0);
  const made = lastCycle.filter((s) => s >= due).length;
  let versus = "";
  const base = all.get(asDealt(strategy));
  if (base !== undefined && asDealt(strategy) !== strategy) {
    const diffs = [...runs].filter(([seed]) => base.has(seed)).map(([seed, s]) => sum(s) - sum(base.get(seed)!));
    const mean = sum(diffs) / diffs.length;
    const sd = Math.sqrt(sum(diffs.map((d) => (d - mean) ** 2)) / Math.max(1, diffs.length - 1));
    const half = (1.96 * sd) / Math.sqrt(diffs.length);
    const sign = (n: number) => (n >= 0 ? "+" : "") + n.toFixed(0);
    versus = `${sign(mean)} (${sign(mean - half)} to ${sign(mean + half)}) over ${diffs.length} seeds`;
  }
  console.log(`${strategy.padEnd(60)} ${String(runs.size).padStart(4)}  ${String(median(lastCycle)).padStart(14)}  ${String(made).padStart(9)}  ${versus}`);
}
