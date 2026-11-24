/**
 * The fruit table: size, look, points and how each scores. Effects are written in `jar.ts`; this file is data only.
 *
 * Scoring types (see the design doc, "Scoring types"):
 * - fresh:   scores its points once, when it first lands, or when a merge makes it.
 * - simmer:  scores at every Resolve while it stays in the jar.
 * - booster: scores nothing itself; doubles what scores while touching it (Lemon), and blocks merges next to it.
 */
import { FRUIT_ART } from "./sizes.ts";

export type FruitKind =
  | "cherry"
  | "grape"
  | "orange"
  | "melon"
  | "watermelon"
  | "apple"
  | "banana"
  | "chili"
  | "durian"
  | "pomegranate"
  | "blueberry"
  | "lemon"
  | "seed"
  | "prune"
  | "fig"
  | "fruitfly"
  | "kiwi"
  | "peach"
  | "honeydew"
  | "pitaya"
  | "coconut"
  | "lime"
  | "dragonfruit"
  | "snowpear"
  | "slice"
  | "pumpkin"
  | "gourd"
  | "giantpumpkin"
  | "pumpkinseed"
  | "goldenapple"
  | "quince";

export type Scoring = "fresh" | "simmer" | "booster";

export interface FruitDef {
  name: string;
  /** Pixels. */
  radius: number;
  /** Fresh: points when it lands or is made. Simmer: base points each Resolve. */
  points: number;
  scoring: Scoring;
  /** Starters merge with their own kind into this. */
  mergesInto?: FruitKind;
  /** How many fruits it counts as for "touching N fruits" checks (Blueberry counts as 3). */
  touchWeight: number;
  /** How many times heavier than its size it is against other fruit: a heavy one shoulders its way down. Default 1. */
  heavy?: number;
  /** How many places it takes on the shelf, and lanes over the jar. Default 1; a Pumpkin takes 2. */
  slots?: number;
  /** A Legendary fruit: offered rarely, and its chip says so. */
  legendary?: boolean;
  /** The card: a row of the game's keywords (rules/terms.ts), each with a capital and often a number, how it scores first. */
  text: string;
}

/**
 * The numbers of the fruit that score by a rule of their own (rules/jar.ts), kept here so their cards say the same.
 * An Apple scores its base, and `edge` more while it touches the jar's floor or a wall. A Banana scores its base and `ripen` more each turn, and
 * rots after `rots` turns. A honeyed fruit scores `HONEY` each turn.
 */
export const APPLE = { base: 4, edge: 5 };
export const BANANA = { base: 4, ripen: 2, rots: 3 };
export const HONEY = 4;
/**
 * The Ladder set (design doc, "Next fruit set: Ladder"): merge up, smash down. A Grape, Orange or Melon that is Smashed breaks
 * into 2 of the next size down, and a Watermelon into `SLICES` Slices, which score more together than it did. A Pumpkin Plunges:
 * it drives to the floor, Smashing what it can and throwing the rest aside, and pays for its Smashes in one burst (rules/jar.ts,
 * `plungeStep`); it scores nothing for landing, and is many times heavier than its size, so it drives through. A Gourd takes in fruit no
 * bigger than itself, a size at a time along `GOURD_SIZES` (Cherry, Grape, Orange), and at Melon size Bursts into `GOURD_BURST`
 * Cherries. Two Watermelons make a Giant Pumpkin, which scores, throws the pile aside and is gone.
 */
export const SLICES = 4;
/**
 * The Pumpkin Seed (design doc, "Proposed: fruit roles and changes"): Ladder's late scaler. Exploded, a fruit grows where it was
 * and scores as it is made: a Cherry at first, and a size bigger after every `every` that have grown in the run (Grape, Orange,
 * then Melon, the cap). Seed is points for bomb decks; the Pumpkin Seed puts bigger fruit in the jar to merge and to Plunge into.
 */
export const PUMPKIN_SEED: { every: number; sizes: readonly FruitKind[] } = { every: 3, sizes: ["cherry", "grape", "orange", "melon"] };

/** What a Pumpkin Seed grows when `grown` have grown from Pumpkin Seeds this run. */
export function pumpkinSprout(grown: number): FruitKind {
  const sizes = PUMPKIN_SEED.sizes;
  return sizes[Math.min(Math.floor(grown / PUMPKIN_SEED.every), sizes.length - 1)] as FruitKind;
}

/**
 * A Pumpkin Seed's card, which changes as the run goes: the fruit it grows now, and how many more must grow before it grows the
 * next size ("Exploded: grows a Cherry. After 3 more grow, it grows a Grape.", short enough for a shop label).
 */
export function pumpkinSeedText(grown: number): string {
  const sizes = PUMPKIN_SEED.sizes;
  const now = pumpkinSprout(grown);
  const step = Math.floor(grown / PUMPKIN_SEED.every);
  const here = `Exploded: grows ${aFruit(now)}.`;
  if (step >= sizes.length - 1) return here;
  const left = PUMPKIN_SEED.every - (grown % PUMPKIN_SEED.every);
  return `${here} After ${left} more ${left === 1 ? "grows" : "grow"}, it grows ${aFruit(sizes[step + 1] as FruitKind)}.`;
}
/**
 * The Golden Apple: an early economy pick that needs no synergy. It pays `GOLDEN` coins when the rent is paid with it in the jar,
 * or when an explosion or a Crush destroys it (nothing while it is rotten), so the shop matters sooner; coins count for less late in a run.
 */
export const GOLDEN = 2;
/**
 * A bridge fruit (design doc, "Chains, glazes and bridge fruit"), linking two build families. The Quince (Garden to Ladder)
 * scores `perSize` at each Resolve for each size of the biggest fruit touching it, from a Cherry's 1 to a Watermelon's 5 (any
 * fruit counts by its size), so a garden wants big fruit built beside it. The Medlar (Rot to Ladder) was built and measured, and
 * held back: rot comes late in a five-turn cycle, so it almost never worked (see the README).
 */
export const QUINCE = { perSize: 2 };
export const GOURD_BURST = 4;
export const GOURD_SIZES: readonly number[] = [FRUIT_ART.cherry.radius, FRUIT_ART.grape.radius, FRUIT_ART.orange.radius];

/** The names of the fruit a Pumpkin Seed can grow, for its card (which is written before the table). */
const FRUITS_NAMES: Readonly<Partial<Record<FruitKind, string>>> = { cherry: "Cherry", grape: "Grape", orange: "Orange", melon: "Melon" };

/** "a Cherry", "an Orange". */
function aFruit(kind: FruitKind): string {
  const name = FRUITS_NAMES[kind] ?? kind;
  return `${/^[AEIOU]/.test(name) ? "an" : "a"} ${name}`;
}

export const FRUITS: Readonly<Record<FruitKind, FruitDef>> = {
  cherry: { name: "Cherry", radius: FRUIT_ART.cherry.radius, points: 1, scoring: "fresh", mergesInto: "grape", touchWeight: 1, text: "Fresh 1. Merge: Grape." },
  grape: { name: "Grape", radius: FRUIT_ART.grape.radius, points: 3, scoring: "fresh", mergesInto: "orange", touchWeight: 1, text: "Fresh 3. Merge: Orange." },
  orange: { name: "Orange", radius: FRUIT_ART.orange.radius, points: 8, scoring: "fresh", mergesInto: "melon", touchWeight: 1, text: "Fresh 8. Merge: Melon." },
  melon: { name: "Melon", radius: FRUIT_ART.melon.radius, points: 20, scoring: "fresh", mergesInto: "watermelon", touchWeight: 1, text: "Fresh 20. Merge: Watermelon." },
  watermelon: { name: "Watermelon", radius: FRUIT_ART.watermelon.radius, points: 50, scoring: "fresh", mergesInto: "giantpumpkin", touchWeight: 1, text: "Fresh 50. Smashed: Slice 4. Merge: Giant Pumpkin." },
  apple: { name: "Apple", radius: FRUIT_ART.apple.radius, points: 4, scoring: "simmer", touchWeight: 1, text: `Simmer ${APPLE.base}. Edge ${APPLE.edge}.` },
  banana: { name: "Banana", radius: FRUIT_ART.banana.radius, points: 4, scoring: "simmer", touchWeight: 1, text: `Simmer ${BANANA.base}. Ripen ${BANANA.ripen}. Rots ${BANANA.rots}.` },
  chili: { name: "Chili", radius: FRUIT_ART.chili.radius, points: 6, scoring: "fresh", touchWeight: 1, text: "Fresh 6. Exploder 4." },
  durian: { name: "Durian", radius: FRUIT_ART.durian.radius, points: 8, scoring: "fresh", touchWeight: 1, text: "Fresh 8. Buried 3." },
  pomegranate: { name: "Pomegranate", radius: FRUIT_ART.pomegranate.radius, points: 6, scoring: "fresh", touchWeight: 1, text: "Fresh 6. Exploded or Merged: Burst 5." },
  blueberry: { name: "Blueberry", radius: FRUIT_ART.blueberry.radius, points: 6, scoring: "fresh", touchWeight: 3, text: "Fresh 6. Dense 3." },
  lemon: { name: "Lemon", radius: FRUIT_ART.lemon.radius, points: 0, scoring: "booster", touchWeight: 1, text: "Booster. Double. Sour." },
  prune: { name: "Prune", radius: FRUIT_ART.prune.radius, points: 8, scoring: "simmer", touchWeight: 1, text: "Rotten. Simmer 8 per Rotten neighbour." },
  fig: { name: "Fig", radius: FRUIT_ART.fig.radius, points: 8, scoring: "fresh", touchWeight: 1, text: "Fresh 8. Exploded while Rotten: Bananas Grow 1." },
  fruitfly: { name: "Fruit Fly", radius: FRUIT_ART.fruitfly.radius, points: 24, scoring: "simmer", touchWeight: 1, text: "Each turn, Eat a Rotten fruit: +24 and Hatch." },
  kiwi: { name: "Kiwi", radius: FRUIT_ART.kiwi.radius, points: 2, scoring: "fresh", touchWeight: 1, text: "Fresh 2. Copy." },
  peach: { name: "Peach", radius: FRUIT_ART.peach.radius, points: 12, scoring: "fresh", touchWeight: 1, text: "Fresh 12. Bouncy." },
  honeydew: { name: "Honeydew", radius: FRUIT_ART.honeydew.radius, points: 2, scoring: "simmer", touchWeight: 1, text: "Honeyed. Each turn, Honey a neighbour." },
  pitaya: { name: "Pitaya", radius: FRUIT_ART.pitaya.radius, points: 4, scoring: "simmer", touchWeight: 1, text: "Simmer 4. Each turn, Eat a Cherry: Grow 1." },
  coconut: { name: "Coconut", radius: FRUIT_ART.coconut.radius, points: 8, scoring: "fresh", touchWeight: 1, heavy: 5, text: "Fresh 8. Heavy. Crack 3: Milk." },
  lime: { name: "Lime", radius: FRUIT_ART.lime.radius, points: 8, scoring: "fresh", touchWeight: 1, text: "Fresh 8. Exploded or Crushed: Juice." },
  dragonfruit: { name: "Dragonfruit", radius: FRUIT_ART.dragonfruit.radius, points: 0, scoring: "booster", touchWeight: 1, legendary: true, text: "Legendary. Booster. Skip." },
  snowpear: { name: "Snow Pear", radius: FRUIT_ART.snowpear.radius, points: 8, scoring: "fresh", touchWeight: 1, text: "Fresh 8. Each turn, it and its neighbours turn Frozen." },
  seed: { name: "Seed", radius: FRUIT_ART.seed.radius, points: 6, scoring: "fresh", touchWeight: 1, text: "Fresh 6. Exploded: Sprout." },
  slice: { name: "Slice", radius: FRUIT_ART.slice.radius, points: 15, scoring: "fresh", mergesInto: "melon", touchWeight: 1, text: "Fresh 15. Merge: Melon." },
  pumpkin: { name: "Pumpkin", radius: FRUIT_ART.pumpkin.radius, points: 0, scoring: "fresh", touchWeight: 1, heavy: 48, slots: 2, text: "Wide. Heavy. Plunge: Smashes what it hits." },
  gourd: { name: "Gourd", radius: FRUIT_ART.gourd.radius, points: 4, scoring: "fresh", touchWeight: 1, text: "Fresh 4. Absorb. At Melon size, Burst 4." },
  pumpkinseed: { name: "Pumpkin Seed", radius: FRUIT_ART.pumpkinseed.radius, points: 0, scoring: "fresh", touchWeight: 1, text: pumpkinSeedText(0) },
  goldenapple: { name: "Golden Apple", radius: FRUIT_ART.goldenapple.radius, points: 2, scoring: "fresh", touchWeight: 1, text: `Fresh 2. Golden ${GOLDEN}.` },
  quince: { name: "Quince", radius: FRUIT_ART.quince.radius, points: QUINCE.perSize, scoring: "simmer", touchWeight: 1, text: `Simmer ${QUINCE.perSize} per size of its biggest neighbour.` },
  giantpumpkin: { name: "Giant Pumpkin", radius: FRUIT_ART.giantpumpkin.radius, points: 75, scoring: "fresh", heavy: 4, touchWeight: 1, text: "Fresh 75. Shockwave, then it vanishes." },
};

/** What the 1-of-3 pick offers. */
export const OFFERABLE: readonly FruitKind[] = [
  "apple",
  "banana",
  "chili",
  "durian",
  "pomegranate",
  "blueberry",
  "lemon",
  "seed",
  "prune",
  "fig",
  "fruitfly",
  "kiwi",
  "peach",
  "honeydew",
  "pitaya",
  "coconut",
  "snowpear",
  "lime",
  "pumpkin",
  "gourd",
  "pumpkinseed",
  "goldenapple",
  "quince",
];

/** What a Seed can sprout. */
export const SPROUTS: readonly FruitKind[] = ["cherry", "grape", "orange"];

/** The Legendary fruit, and the chance that one takes the last place among a pick's three offers. */
export const LEGENDARY: readonly FruitKind[] = ["dragonfruit"];
export const LEGENDARY_CHANCE = 0.08;

/**
 * The chance that a Melon takes the middle place among a pick's three offers. A starter, otherwise only made by merging, offered
 * now and then so a Ladder build can aim for Watermelons and a Giant Pumpkin. Tuned with the balance bots: at 10% a player who
 * takes every Melon sees a Giant Pumpkin in about 10 runs of 24 and scores about what a Durian player does; offered as often as
 * any other fruit (in about 15% of picks, and in the shop), it made the strongest pick the bots had found.
 */
export const MELON_CHANCE = 0.1;
