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
  | "honeydew";

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
  /** One line for the pick screen. */
  text: string;
}

export const FRUITS: Readonly<Record<FruitKind, FruitDef>> = {
  cherry: { name: "Cherry", radius: FRUIT_ART.cherry.radius, points: 1, scoring: "fresh", mergesInto: "grape", touchWeight: 1, text: "Merges into Grape" },
  grape: { name: "Grape", radius: FRUIT_ART.grape.radius, points: 3, scoring: "fresh", mergesInto: "orange", touchWeight: 1, text: "Merges into Orange" },
  orange: { name: "Orange", radius: FRUIT_ART.orange.radius, points: 8, scoring: "fresh", mergesInto: "melon", touchWeight: 1, text: "Merges into Melon" },
  melon: { name: "Melon", radius: FRUIT_ART.melon.radius, points: 20, scoring: "fresh", mergesInto: "watermelon", touchWeight: 1, text: "Merges into Watermelon" },
  watermelon: { name: "Watermelon", radius: FRUIT_ART.watermelon.radius, points: 50, scoring: "fresh", touchWeight: 1, text: "Two vanish for +100" },
  apple: { name: "Apple", radius: FRUIT_ART.apple.radius, points: 1, scoring: "simmer", touchWeight: 1, text: "Simmer: scores more the deeper it sits" },
  banana: { name: "Banana", radius: FRUIT_ART.banana.radius, points: 1, scoring: "simmer", touchWeight: 1, text: "Simmer: 2, then +1 a turn; rots after 3 turns" },
  chili: { name: "Chili", radius: FRUIT_ART.chili.radius, points: 2, scoring: "fresh", touchWeight: 1, text: "Explodes touching 4+ fruit" },
  durian: { name: "Durian", radius: FRUIT_ART.durian.radius, points: 4, scoring: "fresh", touchWeight: 1, text: "Big blast once 3 fruit sit on it" },
  pomegranate: { name: "Pomegranate", radius: FRUIT_ART.pomegranate.radius, points: 3, scoring: "fresh", touchWeight: 1, text: "Bursts into 5 Cherries when hit or merged" },
  blueberry: { name: "Blueberry", radius: FRUIT_ART.blueberry.radius, points: 1, scoring: "fresh", touchWeight: 3, text: "Counts as 3 fruit for touch checks" },
  lemon: { name: "Lemon", radius: FRUIT_ART.lemon.radius, points: 0, scoring: "booster", touchWeight: 1, text: "Booster: touching fruit score x2, can't merge" },
  prune: { name: "Prune", radius: FRUIT_ART.prune.radius, points: 5, scoring: "simmer", touchWeight: 1, text: "Simmer: rotten. +5 for each rotten fruit touching it" },
  fig: { name: "Fig", radius: FRUIT_ART.fig.radius, points: 2, scoring: "fresh", touchWeight: 1, text: "If blown up rotten, Bananas gain +1" },
  fruitfly: { name: "Fruit Fly", radius: FRUIT_ART.fruitfly.radius, points: 8, scoring: "simmer", touchWeight: 1, text: "Simmer: eats a rotten fruit for 8, then doubles" },
  kiwi: { name: "Kiwi", radius: FRUIT_ART.kiwi.radius, points: 2, scoring: "fresh", touchWeight: 1, text: "Becomes a copy of the first fruit it lands on" },
  peach: { name: "Peach", radius: FRUIT_ART.peach.radius, points: 4, scoring: "fresh", touchWeight: 1, text: "Bounces, shoving its neighbours apart" },
  honeydew: { name: "Honeydew", radius: FRUIT_ART.honeydew.radius, points: 2, scoring: "simmer", touchWeight: 1, text: "Simmer: honeys a neighbour a turn; honey scores 2" },
  seed: { name: "Seed", radius: FRUIT_ART.seed.radius, points: 1, scoring: "fresh", touchWeight: 1, text: "Sprouts a fruit when blown up" },
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
];

/** What a Seed can sprout. */
export const SPROUTS: readonly FruitKind[] = ["cherry", "grape", "orange"];
