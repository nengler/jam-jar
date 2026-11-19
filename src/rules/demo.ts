/**
 * A run that plays itself, for the title screen: it drops each hand as it is dealt, skips every pick, and starts again when the
 * rent comes due. Nothing is ordered, bought or kept; it is there to show a jar filling up.
 */
import { advance, newRun, NO_KEYS, type FruitReport, type Keys, type Run } from "./jar.ts";

/** How long the full jar is left on show before the next run starts, in seconds. */
export const DEMO_HOLD = 2.5;

/** The keys the demo presses for the run as it is: Space to drop a hand and to skip a pick. */
export function demoKeys(run: Run): Keys {
  return run.phase === "order" || run.phase === "pick" ? { ...NO_KEYS, drop: true } : NO_KEYS;
}

/** Whether the demo's run has come to its end: its cycle's rent is due (paid or not), and there is nothing more to drop. */
export function demoOver(run: Run): boolean {
  return run.phase === "rent" || run.phase === "over" || run.phase === "won" || run.phase === "shop";
}

/** The demo's next step. Once the run is over, `held` (the seconds it has been) decides when a new one starts. */
export function demoStep(run: Run, dt: number, reports: readonly FruitReport[], held: number): Run {
  if (demoOver(run)) return held >= DEMO_HOLD ? newRun(run.seed) : advance(run, dt, NO_KEYS, reports);
  return advance(run, dt, demoKeys(run), reports);
}
