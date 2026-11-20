/** What the rules' tests and the game's tests both build runs and fruit with. */
import { FRUITS } from "../src/rules/fruits.ts";
import { advance, newRun, NO_KEYS, RENT, resolve, type Fruit, type Keys, type Run } from "../src/rules/jar.ts";

/** One step at 60 a second. */
export const DT = 1 / 60;

/** One step of the run with these keys down. */
export function press(run: Run, keys: Partial<Keys>): Run {
  return advance(run, DT, { ...NO_KEYS, ...keys });
}

/** A landed fruit at rest at (x, y), touching the fruit with these ids (what its component would report). */
export function fruit(id: number, kind: Fruit["kind"], x: number, y: number, touching: number[] = []): Fruit {
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

/** A lit Chili at (x, y) that goes off once its fuse has burnt (at once, by default). */
export function litChili(id: number, x: number, y: number, fuse = 0): Fruit {
  return { ...fruit(id, "chili", x, y), lit: true, fuse };
}

/** A run whose jar holds exactly these fruit, settling. */
export function jarWith(fruits: Fruit[]): Run {
  const run = newRun(7);
  run.fruits = fruits;
  run.nextId = 100;
  run.phase = "settle";
  return run;
}

/** A run with an empty jar at the pick after its second turn, its offers rolled from this seed when one is given. */
export function inPick(seed?: number): Run {
  const run = jarWith([]);
  if (seed !== undefined) run.seed = seed;
  run.turn = 2;
  resolve(run);
  return run;
}

/** A run in the shop after its first rent, with this many coins. */
export function inShop(coins: number): Run {
  const run = jarWith([]);
  run.turn = 5;
  run.cycleScore = RENT[0]!;
  resolve(run);
  run.coins = coins;
  return press(run, { confirm: true });
}
