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
  | "cracked"
  | "dragonfruit";

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
  /** A Legendary fruit: offered rarely, and its chip says so. */
  legendary?: boolean;
  /** What it does, in the game's terms (rules/terms.ts): keywords with a capital, and no scoring word, which its chip says. */
  text: string;
}

export const FRUITS: Readonly<Record<FruitKind, FruitDef>> = {
  cherry: { name: "Cherry", radius: FRUIT_ART.cherry.radius, points: 1, scoring: "fresh", mergesInto: "grape", touchWeight: 1, text: "Merge into Grape." },
  grape: { name: "Grape", radius: FRUIT_ART.grape.radius, points: 3, scoring: "fresh", mergesInto: "orange", touchWeight: 1, text: "Merge into Orange." },
  orange: { name: "Orange", radius: FRUIT_ART.orange.radius, points: 8, scoring: "fresh", mergesInto: "melon", touchWeight: 1, text: "Merge into Melon." },
  melon: { name: "Melon", radius: FRUIT_ART.melon.radius, points: 20, scoring: "fresh", mergesInto: "watermelon", touchWeight: 1, text: "Merge into Watermelon." },
  watermelon: { name: "Watermelon", radius: FRUIT_ART.watermelon.radius, points: 50, scoring: "fresh", touchWeight: 1, text: "Merge: both vanish for +100." },
  apple: { name: "Apple", radius: FRUIT_ART.apple.radius, points: 1, scoring: "simmer", touchWeight: 1, text: "Scores 2 to 6: more the deeper it sits." },
  banana: { name: "Banana", radius: FRUIT_ART.banana.radius, points: 1, scoring: "simmer", touchWeight: 1, text: "Scores 2, +1 each turn. Rots after 3 turns." },
  chili: { name: "Chili", radius: FRUIT_ART.chili.radius, points: 2, scoring: "fresh", touchWeight: 1, text: "Touching 4 fruit: Blast." },
  durian: { name: "Durian", radius: FRUIT_ART.durian.radius, points: 4, scoring: "fresh", touchWeight: 1, text: "3 fruit on top: big Blast." },
  pomegranate: { name: "Pomegranate", radius: FRUIT_ART.pomegranate.radius, points: 3, scoring: "fresh", touchWeight: 1, text: "Blasted or Merged: Burst into 5 Cherries." },
  blueberry: { name: "Blueberry", radius: FRUIT_ART.blueberry.radius, points: 1, scoring: "fresh", touchWeight: 3, text: "Counts as 3 fruit to what it touches." },
  lemon: { name: "Lemon", radius: FRUIT_ART.lemon.radius, points: 0, scoring: "booster", touchWeight: 1, text: "Touching fruit score x2 but can't Merge." },
  prune: { name: "Prune", radius: FRUIT_ART.prune.radius, points: 5, scoring: "simmer", touchWeight: 1, text: "Rotten, can't spread. 5 per Rotten neighbour." },
  fig: { name: "Fig", radius: FRUIT_ART.fig.radius, points: 2, scoring: "fresh", touchWeight: 1, text: "Blasted while Rotten: Bananas gain +1." },
  fruitfly: { name: "Fruit Fly", radius: FRUIT_ART.fruitfly.radius, points: 8, scoring: "simmer", touchWeight: 1, text: "Each turn, Eat a Rotten fruit: +8 and a new Fly." },
  kiwi: { name: "Kiwi", radius: FRUIT_ART.kiwi.radius, points: 2, scoring: "fresh", touchWeight: 1, text: "Becomes a copy of the first fruit it lands on." },
  peach: { name: "Peach", radius: FRUIT_ART.peach.radius, points: 4, scoring: "fresh", touchWeight: 1, text: "On landing, bounces and shoves its neighbours." },
  honeydew: { name: "Honeydew", radius: FRUIT_ART.honeydew.radius, points: 2, scoring: "simmer", touchWeight: 1, text: "Honeyed. Each turn, Honey a neighbour." },
  pitaya: { name: "Pitaya", radius: FRUIT_ART.pitaya.radius, points: 2, scoring: "simmer", touchWeight: 1, text: "Scores 2. Eat a Cherry a turn: all gain +1." },
  coconut: { name: "Coconut", radius: FRUIT_ART.coconut.radius, points: 3, scoring: "fresh", touchWeight: 1, heavy: 5, text: "Heavy. After 3 turns, cracks into a Booster." },
  cracked: { name: "Cracked Coconut", radius: FRUIT_ART.cracked.radius, points: 0, scoring: "booster", touchWeight: 1, heavy: 5, text: "Touching fruit score x2." },
  dragonfruit: { name: "Dragonfruit", radius: FRUIT_ART.dragonfruit.radius, points: 0, scoring: "booster", touchWeight: 1, legendary: true, text: "A Merge touching it skips a size." },
  seed: { name: "Seed", radius: FRUIT_ART.seed.radius, points: 1, scoring: "fresh", touchWeight: 1, text: "Blasted: Sprout a starter." },
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
];

/** What a Seed can sprout. */
export const SPROUTS: readonly FruitKind[] = ["cherry", "grape", "orange"];

/** The Legendary fruit, and the chance that one takes the last place among a pick's three offers. */
export const LEGENDARY: readonly FruitKind[] = ["dragonfruit"];
export const LEGENDARY_CHANCE = 0.08;
