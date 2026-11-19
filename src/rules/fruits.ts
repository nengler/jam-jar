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
  | "seed";

export type Scoring = "fresh" | "simmer" | "booster";

export interface FruitDef {
  name: string;
  /** Pixels. */
  radius: number;
  color: string;
  /** Darker rim colour. */
  rim: string;
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
  cherry: { name: "Cherry", radius: FRUIT_ART.cherry.radius, color: "#e8475f", rim: "#8c1f33", points: 1, scoring: "fresh", mergesInto: "grape", touchWeight: 1, text: "Merges into Grape" },
  grape: { name: "Grape", radius: FRUIT_ART.grape.radius, color: "#9b5de5", rim: "#56307f", points: 3, scoring: "fresh", mergesInto: "orange", touchWeight: 1, text: "Merges into Orange" },
  orange: { name: "Orange", radius: FRUIT_ART.orange.radius, color: "#ff9f1c", rim: "#9c5a00", points: 8, scoring: "fresh", mergesInto: "melon", touchWeight: 1, text: "Merges into Melon" },
  melon: { name: "Melon", radius: FRUIT_ART.melon.radius, color: "#b5e48c", rim: "#5d8a3a", points: 20, scoring: "fresh", mergesInto: "watermelon", touchWeight: 1, text: "Merges into Watermelon" },
  watermelon: { name: "Watermelon", radius: FRUIT_ART.watermelon.radius, color: "#2a9d5c", rim: "#145232", points: 50, scoring: "fresh", touchWeight: 1, text: "Two vanish for +100" },
  apple: { name: "Apple", radius: FRUIT_ART.apple.radius, color: "#d62839", rim: "#6e101b", points: 1, scoring: "simmer", touchWeight: 1, text: "Simmer: scores more the deeper it sits" },
  banana: { name: "Banana", radius: FRUIT_ART.banana.radius, color: "#ffe066", rim: "#a68a1c", points: 1, scoring: "simmer", touchWeight: 1, text: "Simmer: 2, then +1 a turn; rots after 3 turns" },
  chili: { name: "Chili", radius: FRUIT_ART.chili.radius, color: "#ff3d00", rim: "#8a1f00", points: 2, scoring: "fresh", touchWeight: 1, text: "Explodes touching 4+ fruit" },
  durian: { name: "Durian", radius: FRUIT_ART.durian.radius, color: "#c9b458", rim: "#6b5f22", points: 4, scoring: "fresh", touchWeight: 1, text: "Big blast once 3 fruit sit on it" },
  pomegranate: { name: "Pomegranate", radius: FRUIT_ART.pomegranate.radius, color: "#b5179e", rim: "#5e0b52", points: 3, scoring: "fresh", touchWeight: 1, text: "Bursts into 5 Cherries when hit or merged" },
  blueberry: { name: "Blueberry", radius: FRUIT_ART.blueberry.radius, color: "#4361ee", rim: "#1d2f8a", points: 1, scoring: "fresh", touchWeight: 3, text: "Counts as 3 fruit for touch checks" },
  lemon: { name: "Lemon", radius: FRUIT_ART.lemon.radius, color: "#fff176", rim: "#b0a420", points: 0, scoring: "booster", touchWeight: 1, text: "Booster: touching fruit score x2, can't merge" },
  seed: { name: "Seed", radius: FRUIT_ART.seed.radius, color: "#8d6e63", rim: "#4e342e", points: 1, scoring: "fresh", touchWeight: 1, text: "Sprouts a fruit when blown up" },
};

/** What the 1-of-3 pick offers. */
export const OFFERABLE: readonly FruitKind[] = ["apple", "banana", "chili", "durian", "pomegranate", "blueberry", "lemon", "seed"];

/** What a Seed can sprout. */
export const SPROUTS: readonly FruitKind[] = ["cherry", "grape", "orange"];
