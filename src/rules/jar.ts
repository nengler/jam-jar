/**
 * One run of Jam Jar, as plain data and functions: the pool (dealt like a deck), the hand you order, the jar's fruit, scoring,
 * rent and the 1-of-3 pick. `advance` takes the run, the frame's time and the keys pressed, and returns the next run (a copy, so
 * the component's state changes by assignment and renders). Nothing here knows about the engine, so it is tested with node:test.
 *
 * A turn: order (arrange the 4 dealt fruits) → drop (they fall one by one at random spots) → settle (physics; merges and blasts
 * score as they happen) → resolve (overflow, then Simmer fruit score) → pick (1 of 3, or skip). Five turns make a rent cycle.
 *
 * The physics is the engine's (`useBall`): each fruit is a component with a ball, and each step it reports where it is, how fast it
 * moves and which fruit it touches (`FruitReport`). The run reads those reports; it never moves a fruit itself, except to give one
 * a kick (a blast), which the fruit's component applies.
 */
import { FRUITS, OFFERABLE, SPROUTS, type FruitKind } from "./fruits.ts";
import { Rng } from "./rng.ts";

export interface JarBounds {
  left: number;
  right: number;
  floor: number;
}

export const JAR: JarBounds = { left: 224, right: 416, floor: 336 };
export const GRAVITY = 1200;
/** A fruit this close to the floor (beyond touching) is on it: a settled pile jitters by a fraction of a pixel. */
const FLOOR_TOLERANCE = 1.5;
/** The rim: a fruit whose top is above it once the jar settles spills out. */
export const RIM = 104;
/** Where dropped fruit appear. */
export const DROP_Y = 72;
export const HAND_SIZE = 4;
export const TURNS_PER_CYCLE = 5;
export const RENT: readonly number[] = [25, 50, 100, 175, 300];
/** Seconds between drops in a hand. */
const DROP_GAP = 0.35;
/** The jar has settled when every fruit is slower than this (px/s) for `CALM_TIME` seconds. */
const CALM_SPEED = 20;
const CALM_TIME = 0.4;
/** Settling gives up after this long, so a jittering pile cannot stall a turn. */
const SETTLE_LIMIT = 8;
const OVERFLOW_PENALTY = 5;
const POPUP_LIFE = 0.9;
/** How long a blast's explosion (9 frames) shows, in seconds. */
export const BOOM_LIFE = 0.54;

export type Phase = "order" | "drop" | "settle" | "pick" | "rent" | "over" | "won";

export interface Fruit {
  id: number;
  kind: FruitKind;
  /** Where its component's ball starts. */
  x0: number;
  y0: number;
  /** Where it is and how fast it moves (px/s), as its component last reported. */
  x: number;
  y: number;
  r: number;
  speed: number;
  /** The ids of the fruit it touches, as last reported. */
  touching: number[];
  /** A push to give it: each time `kicks` goes up, its component adds (`kickX`, `kickY`) px/s to its velocity. */
  kicks: number;
  kickX: number;
  kickY: number;
  /** Has touched the floor or another fruit (a Fresh fruit scores then). */
  landed: boolean;
  /** Resolves survived in the jar. */
  age: number;
  rotten: boolean;
  /** A Chili or Durian about to go off, and the seconds left. */
  lit: boolean;
  fuse: number;
}

export interface Popup {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
}

/** Something drawn for a moment: a blast's explosion. */
export interface Effect {
  id: number;
  kind: "boom";
  x: number;
  y: number;
  /** Seconds since it started. */
  age: number;
  /** Across, in pixels. */
  size: number;
}

export interface Run {
  seed: number;
  nextId: number;
  /** Every fruit you own. */
  pool: FruitKind[];
  /** Still to be dealt this shuffle, top first. */
  draw: FruitKind[];
  /** Dealt this shuffle. */
  discard: FruitKind[];
  /** Dealt and waiting to drop; index 0 drops first. */
  hand: FruitKind[];
  cursor: number;
  /** Whether the fruit under the cursor is picked up (up and down then move it). */
  holding: boolean;
  /** Left to drop this turn. */
  queue: FruitKind[];
  dropTimer: number;
  fruits: Fruit[];
  phase: Phase;
  cycle: number;
  turn: number;
  cycleScore: number;
  total: number;
  coins: number;
  settleTime: number;
  calmTime: number;
  offers: FruitKind[];
  offerCursor: number;
  popups: Popup[];
  effects: Effect[];
  /** One line about what just happened. */
  message: string;
  /** Sounds to play this frame (cleared each `advance`). */
  sounds: Sound[];
}

export type Sound = "land" | "merge" | "boom" | "pick" | "rent" | "lose" | "tick";

declare global {
  /** What each ball and collider tag carries, so a fruit's `contacts("fruit")` has typed `data` (the engine's `ColliderData`). */
  interface ColliderData {
    fruit: { id: number };
  }
}

/** What a fruit's component reports each step. */
export interface FruitReport {
  id: number;
  x: number;
  y: number;
  speed: number;
  touching: number[];
}

/** What the run reads from the keyboard this frame. */
export interface Keys {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  /** Enter: pick up / put down in the hand, take an offer, continue. */
  confirm: boolean;
  /** Space: drop the hand, skip the pick. */
  drop: boolean;
}

export const NO_KEYS: Keys = { up: false, down: false, left: false, right: false, confirm: false, drop: false };

/** The starting pool: 1 Apple plus 8 starters, 3–5 Cherries, 2–4 Grapes and 0–2 Oranges (see the design doc). */
export function rollPool(rng: Rng): FruitKind[] {
  for (;;) {
    const cherries = rng.int(3, 5);
    const grapes = rng.int(2, 4);
    const oranges = 8 - cherries - grapes;
    if (oranges < 0 || oranges > 2) continue;
    return [
      ...Array<FruitKind>(cherries).fill("cherry"),
      ...Array<FruitKind>(grapes).fill("grape"),
      ...Array<FruitKind>(oranges).fill("orange"),
      "apple",
    ];
  }
}

export function newRun(seed: number): Run {
  const rng = new Rng(seed);
  const pool = rollPool(rng);
  const run: Run = {
    seed: rng.seed,
    nextId: 1,
    pool,
    draw: rng.shuffle(pool),
    discard: [],
    hand: [],
    cursor: 0,
    holding: false,
    queue: [],
    dropTimer: 0,
    fruits: [],
    phase: "order",
    cycle: 1,
    turn: 1,
    cycleScore: 0,
    total: 0,
    coins: 0,
    settleTime: 0,
    calmTime: 0,
    offers: [],
    offerCursor: 0,
    popups: [],
    effects: [],
    message: "Order your hand, then Space to drop",
    sounds: [],
  };
  deal(run);
  return run;
}

/** The hand row the cursor is on while ordering, or -1 when the hand is not being ordered. */
export function chosenRow(run: Run): number {
  return run.phase === "order" ? run.cursor : -1;
}

export function rentFor(cycle: number): number {
  return RENT[Math.min(cycle, RENT.length) - 1] as number;
}

/** A copy deep enough that `advance` can change it without touching the run it was given. */
function copy(run: Run): Run {
  return {
    ...run,
    pool: run.pool.slice(),
    draw: run.draw.slice(),
    discard: run.discard.slice(),
    hand: run.hand.slice(),
    queue: run.queue.slice(),
    fruits: run.fruits.map((f) => ({ ...f })),
    offers: run.offers.slice(),
    popups: run.popups.map((p) => ({ ...p })),
    effects: run.effects.map((e) => ({ ...e })),
    sounds: [],
  };
}

function deal(run: Run): void {
  const rng = new Rng(run.seed);
  run.hand = [];
  for (let i = 0; i < HAND_SIZE; i++) {
    if (run.draw.length === 0) {
      run.draw = rng.shuffle(run.discard);
      run.discard = [];
    }
    const next = run.draw.shift();
    if (next === undefined) break;
    run.hand.push(next);
  }
  run.seed = rng.seed;
  run.cursor = 0;
  run.holding = false;
}

function sound(run: Run, name: Sound): void {
  if (!run.sounds.includes(name)) run.sounds.push(name);
}

function effect(run: Run, kind: Effect["kind"], x: number, y: number, size: number): void {
  run.effects.push({ id: run.nextId++, kind, x, y, age: 0, size });
}

function popup(run: Run, x: number, y: number, text: string, color = "#ffd166"): void {
  run.popups.push({ id: run.nextId++, x, y, text, color, life: POPUP_LIFE });
}

function score(run: Run, points: number, x: number, y: number): void {
  if (points === 0) return;
  run.cycleScore += points;
  run.total += points;
  popup(run, x, y, points > 0 ? `+${points}` : `${points}`, points > 0 ? "#ffd166" : "#ff6b6b");
}

function makeFruit(run: Run, kind: FruitKind, x: number, y: number): Fruit {
  return {
    id: run.nextId++,
    kind,
    x0: x,
    y0: y,
    x,
    y,
    r: FRUITS[kind].radius,
    speed: 0,
    touching: [],
    kicks: 0,
    kickX: 0,
    kickY: 0,
    landed: false,
    age: 0,
    rotten: false,
    lit: false,
    fuse: 0,
  };
}

/** For each fruit (by index), the indexes of the fruit it touches, from the reports. */
function links(fruits: readonly Fruit[]): number[][] {
  const at = new Map(fruits.map((f, i) => [f.id, i]));
  return fruits.map((f) => f.touching.map((id) => at.get(id)).filter((i): i is number => i !== undefined));
}

function onFloor(f: Fruit): boolean {
  return f.y + f.r >= JAR.floor - FLOOR_TOLERANCE;
}

function kick(f: Fruit, vx: number, vy: number): void {
  f.kicks += 1;
  f.kickX = vx;
  f.kickY = vy;
}

/** Whether a fruit (by index) touches a Lemon. */
function nearLemon(fruits: readonly Fruit[], links: readonly number[][], i: number): boolean {
  return (links[i] ?? []).some((j) => fruits[j]?.kind === "lemon");
}

/** Where each fruit is, as its component reported: what the rest of the step reads. */
export function applyReports(run: Run, reports: readonly FruitReport[]): void {
  if (reports.length === 0) return;
  const byId = new Map(reports.map((r) => [r.id, r]));
  run.fruits = run.fruits.map((f) => {
    const r = byId.get(f.id);
    return r === undefined ? f : { ...f, x: r.x, y: r.y, speed: r.speed, touching: r.touching };
  });
}

export function advance(previous: Run, dt: number, keys: Keys, reports: readonly FruitReport[] = []): Run {
  const run = copy(previous);
  applyReports(run, reports);
  for (const p of run.popups) {
    p.life -= dt;
    p.y -= 36 * dt;
  }
  run.popups = run.popups.filter((p) => p.life > 0);
  for (const e of run.effects) e.age += dt;
  run.effects = run.effects.filter((e) => e.age < BOOM_LIFE);

  switch (run.phase) {
    case "order":
      order(run, keys);
      break;
    case "drop":
      dropStep(run, dt);
      break;
    case "settle":
      settleStep(run, dt);
      break;
    case "pick":
      pickStep(run, keys);
      break;
    case "rent":
      if (keys.confirm || keys.drop) nextCycle(run);
      break;
    case "over":
    case "won":
      break;
  }
  return run;
}

function order(run: Run, keys: Keys): void {
  const last = run.hand.length - 1;
  const move = (keys.down || keys.right ? 1 : 0) - (keys.up || keys.left ? 1 : 0);
  if (move !== 0) {
    const to = Math.max(0, Math.min(last, run.cursor + move));
    if (run.holding && to !== run.cursor) {
      const a = run.hand[run.cursor] as FruitKind;
      run.hand[run.cursor] = run.hand[to] as FruitKind;
      run.hand[to] = a;
    }
    if (to !== run.cursor) sound(run, "tick");
    run.cursor = to;
  }
  if (keys.confirm) {
    run.holding = !run.holding;
    sound(run, "tick");
  }
  if (keys.drop && run.hand.length > 0) {
    run.queue = run.hand;
    run.hand = [];
    run.holding = false;
    run.dropTimer = 0;
    run.phase = "drop";
    run.message = "";
  }
}

function dropStep(run: Run, dt: number): void {
  run.dropTimer -= dt;
  if (run.dropTimer <= 0 && run.queue.length > 0) {
    const kind = run.queue.shift() as FruitKind;
    const r = FRUITS[kind].radius;
    const rng = new Rng(run.seed);
    const x = rng.range(JAR.left + r, JAR.right - r);
    run.seed = rng.seed;
    run.fruits.push(makeFruit(run, kind, x, DROP_Y));
    run.discard.push(kind);
    run.dropTimer = DROP_GAP;
  }
  simulate(run, dt);
  if (run.queue.length === 0 && run.dropTimer <= 0) {
    run.phase = "settle";
    run.settleTime = 0;
    run.calmTime = 0;
  }
}

function settleStep(run: Run, dt: number): void {
  simulate(run, dt);
  run.settleTime += dt;
  const calm = run.fruits.every((f) => f.speed < CALM_SPEED) && run.fruits.every((f) => !f.lit);
  run.calmTime = calm ? run.calmTime + dt : 0;
  if (run.calmTime >= CALM_TIME || run.settleTime >= SETTLE_LIMIT) resolve(run);
}

/** One frame of the jar, after the fruit reported where they are: landings, merges and blasts. */
export function simulate(run: Run, dt: number): void {
  land(run);
  merge(run);
  light(run);
  burn(run, dt);
}

function land(run: Run): void {
  const near = links(run.fruits);
  run.fruits.forEach((f, i) => {
    if (f.landed) return;
    const settledOn = onFloor(f) || (near[i] ?? []).some((j) => run.fruits[j]?.landed === true);
    if (!settledOn) return;
    f.landed = true;
    sound(run, "land");
    const def = FRUITS[f.kind];
    if (def.scoring === "fresh") score(run, def.points * (nearLemon(run.fruits, near, i) ? 2 : 1), f.x, f.y - f.r);
  });
}

function canMerge(f: Fruit): boolean {
  return f.landed && !f.rotten && (FRUITS[f.kind].mergesInto !== undefined || f.kind === "watermelon" || f.kind === "pomegranate");
}

function merge(run: Run): void {
  const near = links(run.fruits);
  const gone = new Set<number>();
  const born: Fruit[] = [];
  for (let i = 0; i < run.fruits.length; i++) {
    const a = run.fruits[i] as Fruit;
    if (gone.has(a.id) || !canMerge(a) || nearLemon(run.fruits, near, i)) continue;
    for (const j of near[i] ?? []) {
      const b = run.fruits[j] as Fruit;
      if (j <= i || gone.has(b.id) || b.kind !== a.kind || !canMerge(b) || nearLemon(run.fruits, near, j)) continue;
      gone.add(a.id);
      gone.add(b.id);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      if (a.kind === "watermelon") {
        score(run, 100, mx, my);
        run.message = "Two Watermelons: +100!";
      } else if (a.kind === "pomegranate") {
        born.push(...burst(run, a.x, a.y), ...burst(run, b.x, b.y));
        run.message = "Pomegranates burst!";
      } else {
        const into = FRUITS[a.kind].mergesInto as FruitKind;
        const f = makeFruit(run, into, mx, my);
        f.landed = true;
        born.push(f);
        score(run, FRUITS[into].points, mx, my - f.r);
      }
      break;
    }
  }
  if (gone.size > 0) {
    run.fruits = [...run.fruits.filter((f) => !gone.has(f.id)), ...born];
    sound(run, "merge");
  }
}

/** Five cherries where a Pomegranate was, already landed (they were in the pile). */
function burst(run: Run, x: number, y: number): Fruit[] {
  const out: Fruit[] = [];
  for (let k = 0; k < 5; k++) {
    const angle = (k / 5) * Math.PI * 2;
    const f = makeFruit(run, "cherry", x + Math.cos(angle) * 8, y + Math.sin(angle) * 8);
    f.landed = true;
    out.push(f);
  }
  return out;
}

/** Light the fuse of a Chili touching 4+ fruit, or a Durian with 3+ fruit stacked on it. */
function light(run: Run): void {
  const near = links(run.fruits);
  run.fruits.forEach((f, i) => {
    if (f.lit || !f.landed) return;
    if (f.kind === "chili") {
      const weight = (near[i] ?? []).reduce((sum, j) => sum + FRUITS[(run.fruits[j] as Fruit).kind].touchWeight, 0);
      if (weight >= 4) ignite(f, 0.3);
    } else if (f.kind === "durian") {
      const above = run.fruits.filter((o) => o !== f && o.landed && o.y < f.y - f.r * 0.5 && Math.abs(o.x - f.x) < f.r + o.r).length;
      if (above >= 3) ignite(f, 0.3);
    }
  });
}

function ignite(f: Fruit, seconds: number): void {
  f.lit = true;
  f.fuse = seconds;
  f.landed = true;
}

function burn(run: Run, dt: number): void {
  for (const f of run.fruits) if (f.lit) f.fuse -= dt;
  const ready = run.fruits.filter((f) => f.lit && f.fuse <= 0);
  for (const bomb of ready) if (run.fruits.includes(bomb)) explode(run, bomb);
}

export const BLAST_RADIUS: Readonly<Partial<Record<FruitKind, number>>> = { chili: 52, durian: 80 };

function explode(run: Run, bomb: Fruit): void {
  const radius = BLAST_RADIUS[bomb.kind] ?? 48;
  const near = links(run.fruits);
  const doubled = new Set(run.fruits.filter((_, i) => nearLemon(run.fruits, near, i)).map((f) => f.id));
  const victims: Fruit[] = [];
  const kept: Fruit[] = [];
  const born: Fruit[] = [];
  let points = 0;
  for (const f of run.fruits) {
    if (f === bomb) continue;
    const dx = f.x - bomb.x;
    const dy = f.y - bomb.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > radius + f.r * 0.5) {
      kept.push(f);
      continue;
    }
    if (f.kind === "chili" || f.kind === "durian") {
      // Caught in the blast: it goes off a moment later (a chain).
      if (!f.lit) ignite(f, 0.15);
      kept.push(f);
      continue;
    }
    victims.push(f);
    const value = FRUITS[f.kind].scoring === "booster" || f.rotten ? 0 : FRUITS[f.kind].points;
    points += value * (doubled.has(f.id) ? 2 : 1);
    if (f.kind === "pomegranate") born.push(...burst(run, f.x, f.y));
    if (f.kind === "seed") {
      const rng = new Rng(run.seed);
      const sprout = makeFruit(run, rng.pick(SPROUTS), f.x, f.y);
      run.seed = rng.seed;
      sprout.landed = true;
      born.push(sprout);
    }
  }
  // The blast pushes what is left away from it.
  for (const f of kept) {
    const dx = f.x - bomb.x;
    const dy = f.y - bomb.y;
    const d = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    if (d > radius * 2) continue;
    const push = 320 * (1 - d / (radius * 2));
    kick(f, (dx / d) * push, (dy / d) * push - 80);
  }
  run.fruits = [...kept, ...born];
  score(run, points, bomb.x, bomb.y - radius / 2);
  effect(run, "boom", bomb.x, bomb.y, radius * 2);
  sound(run, "boom");
  run.message = `${FRUITS[bomb.kind].name} blew up ${victims.length} fruit`;
}

/** The jar has settled: spill what is over the rim, Simmer fruit score, age and rot, then the pick (or rent after turn 5). */
export function resolve(run: Run): void {
  const spilled = run.fruits.filter((f) => f.y - f.r < RIM);
  if (spilled.length > 0) {
    run.fruits = run.fruits.filter((f) => f.y - f.r >= RIM);
    for (const f of spilled) score(run, -OVERFLOW_PENALTY, f.x, RIM - 12);
    run.message = `${spilled.length} spilled over the rim`;
  }

  const near = links(run.fruits);
  run.fruits.forEach((f, i) => {
    if (FRUITS[f.kind].scoring !== "simmer" || f.rotten) return;
    let points = 0;
    if (f.kind === "apple") {
      const depth = (f.y - RIM) / (JAR.floor - RIM);
      points = 1 + Math.floor(Math.max(0, Math.min(1, depth)) * 3);
    } else if (f.kind === "banana") {
      points = 1 + f.age;
    }
    score(run, points * (nearLemon(run.fruits, near, i) ? 2 : 1), f.x, f.y - f.r);
  });

  // Age; Bananas rot after 3 turns, and each rotten fruit rots one fruit it touches.
  for (const f of run.fruits) {
    f.age += 1;
    if (f.kind === "banana" && f.age >= 3 && !f.rotten) f.rotten = true;
  }
  const rotten = run.fruits.filter((f) => f.rotten);
  for (const r of rotten) {
    const next = run.fruits.find((o) => !o.rotten && o.kind !== "lemon" && r.touching.includes(o.id));
    if (next) next.rotten = true;
  }

  if (run.turn >= TURNS_PER_CYCLE) {
    run.phase = "rent";
    const rent = rentFor(run.cycle);
    if (run.cycleScore >= rent) {
      const earned = Math.floor((run.cycleScore - rent) / 5);
      run.coins += earned;
      run.message = `Rent paid! +${earned} coins. Enter for the next cycle`;
      sound(run, "rent");
    } else {
      run.phase = "over";
      run.message = `Rent was ${rent}; you scored ${run.cycleScore}. The jar is lost.`;
      sound(run, "lose");
    }
    return;
  }
  run.turn += 1;
  offer(run);
}

function offer(run: Run): void {
  const rng = new Rng(run.seed);
  run.offers = rng.shuffle(OFFERABLE).slice(0, 3);
  run.seed = rng.seed;
  run.offerCursor = 0;
  run.phase = "pick";
}

function pickStep(run: Run, keys: Keys): void {
  const move = (keys.right || keys.down ? 1 : 0) - (keys.left || keys.up ? 1 : 0);
  if (move !== 0) {
    run.offerCursor = Math.max(0, Math.min(run.offers.length - 1, run.offerCursor + move));
    sound(run, "tick");
  }
  if (keys.confirm) {
    const kind = run.offers[run.offerCursor] as FruitKind;
    run.pool.push(kind);
    // Shuffled into what is still to be dealt, so a new fruit shows up soon.
    const rng = new Rng(run.seed);
    run.draw.splice(rng.int(0, run.draw.length), 0, kind);
    run.seed = rng.seed;
    run.message = `${FRUITS[kind].name} added to your pool`;
    sound(run, "pick");
    startTurn(run);
  } else if (keys.drop) {
    run.coins += 1;
    run.message = "Skipped: +1 coin";
    startTurn(run);
  }
}

function startTurn(run: Run): void {
  run.offers = [];
  deal(run);
  run.phase = "order";
}

function nextCycle(run: Run): void {
  if (run.cycle >= RENT.length) {
    run.phase = "won";
    run.message = "You paid every rent. The jar is yours!";
    return;
  }
  run.cycle += 1;
  run.turn = 1;
  run.cycleScore = 0;
  run.fruits = [];
  const rng = new Rng(run.seed);
  run.draw = rng.shuffle(run.pool);
  run.discard = [];
  run.seed = rng.seed;
  run.message = `Cycle ${run.cycle}: rent is ${rentFor(run.cycle)}`;
  deal(run);
  run.phase = "order";
}
