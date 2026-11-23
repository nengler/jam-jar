/**
 * What the fruit book (tools/fruit-book.ts) says that the game's code does not: each fruit's build family and roles, the fruit
 * it works with or clashes with, and what the balance bots have measured. Everything else in the book (name, card, keywords,
 * scoring, tray slots, sprite) is read from src/rules, so it cannot drift from the game. A test checks that every fruit in the
 * game has an entry here.
 */
import type { FruitKind } from "../../src/rules/fruits.ts";

export type Family = "Starters" | "Boom" | "Juice and grow" | "Rot" | "Flex" | "Ladder" | "Economy" | "Legendary";
export type Role = "Early" | "Late scaler" | "Standalone" | "Build-around" | "Situational" | "Starter" | "Merge result";

export const FAMILIES: Readonly<Record<Family, { colour: string; about: string }>> = {
  Starters: { colour: "#6b3fa0", about: "The merge ladder" },
  Boom: { colour: "#c81d2a", about: "Chain reactions" },
  "Juice and grow": { colour: "#3f8a17", about: "Juice and long-term scaling" },
  Rot: { colour: "#7a4b2a", about: "Downsides that become fuel" },
  Flex: { colour: "#12766c", about: "Glue for any build" },
  Ladder: { colour: "#d0600c", about: "Merge up, smash down" },
  Economy: { colour: "#a8791a", about: "Coins for the shop" },
  Legendary: { colour: "#b3165f", about: "Rare pick" },
};

export const ROLES: Readonly<Record<Role, { colour: string; about: string }>> = {
  Early: { colour: "#e4251b", about: "Strong from turn 1, fades as the run goes on" },
  "Late scaler": { colour: "#3f8a17", about: "Grows across the run; best taken early, pays late" },
  Standalone: { colour: "#2f5fb3", about: "Good with no synergy needed" },
  "Build-around": { colour: "#7a3fa0", about: "Weak alone, strong in the right deck" },
  Situational: { colour: "#b07a10", about: "Shines with one item, boss or setup" },
  Starter: { colour: "#77707a", about: "Merge ladder filler" },
  "Merge result": { colour: "#77707a", about: "Made in the jar, never picked" },
};

/** A fruit (or item) it goes with, and why. */
export type Pair = readonly [fruit: string, why: string];

export interface BookEntry {
  family: Family;
  roles: readonly Role[];
  works: readonly Pair[];
  clashes?: readonly Pair[];
  /** A problem the design has not solved yet. */
  gap?: string;
}

export const BOOK: Readonly<Record<FruitKind, BookEntry>> = {
  cherry: {
    family: "Starters",
    roles: ["Starter"],
    works: [
      ["Pitaya", "eats one a turn and grows"],
      ["Pomegranate", "bursts into 5 more"],
      ["Gourd", "bursts back into 4"],
      ["Chili", "small fruit pack the jar around it"],
    ],
  },
  grape: {
    family: "Starters",
    roles: ["Starter"],
    works: [
      ["Pumpkin", "its Plunge Smashes Grapes"],
      ["Peach", "shoves pairs together to merge"],
      ["Dragonfruit", "merges beside it skip a size"],
    ],
  },
  orange: {
    family: "Starters",
    roles: ["Starter"],
    works: [
      ["Pumpkin", "Smashed into pieces that merge back up"],
      ["Peach", "forces merges"],
      ["Dragonfruit", "skips to Watermelon"],
    ],
  },
  melon: {
    family: "Starters",
    roles: ["Standalone"],
    works: [
      ["Pumpkin", "together 1,357 a run, the best Ladder pair"],
      ["Giant Pumpkin", "a Melon player sees one in 11 runs of 24"],
      ["Dragonfruit", "merges beside it skip a size"],
    ],
    clashes: [["Pumpkin", "a Smashed Melon becomes 2 Oranges, off the road to a Watermelon"]],
  },
  watermelon: {
    family: "Starters",
    roles: ["Merge result"],
    works: [
      ["Chili", "blasts slice it instead of destroying it"],
      ["Durian", "same"],
      ["Pumpkin", "a Watermelon alone pays about +45 at the floor"],
      ["Giant Pumpkin", "two of them merge into one"],
    ],
  },
  chili: {
    family: "Boom",
    roles: ["Early"],
    works: [
      ["Blueberry", "counts as 3 for the touch check"],
      ["Pomegranate", "its Cherries pack the jar"],
      ["Lemon", "blasted fruit touching a Lemon score double"],
      ["Seed", "sprouts when blasted"],
      ["Pumpkin Seed", "a blast makes it grow a fruit"],
      ["Golden Apple", "a blast pays its coins"],
      ["Durian", "chains into its blast"],
      ["Fig", "destroys it while rotten"],
    ],
    clashes: [["Apple", "blasts destroy Simmer fruit; freeze or honey protects them"]],
  },
  durian: {
    family: "Boom",
    roles: ["Early", "Standalone"],
    works: [
      ["Kiwi", "copies it: the core of the strongest bot build"],
      ["Seed", "sprouts when blasted"],
      ["Pumpkin Seed", "grows a fruit when blasted"],
      ["Chili", "each blast can set off the other"],
      ["Watermelon", "blast slices it"],
    ],
  },
  pomegranate: {
    family: "Boom",
    roles: ["Early"],
    works: [
      ["Chili", "the Cherries pack the jar for the next blast"],
      ["Pitaya", "feeds it Cherries"],
      ["Durian", "a blast bursts it"],
    ],
  },
  blueberry: {
    family: "Boom",
    roles: ["Early", "Build-around"],
    works: [
      ["Chili", "gets it to 4 touches fast"],
      ["Lemon", "fills gaps beside it in a crowd"],
    ],
  },
  seed: {
    family: "Boom",
    roles: ["Build-around"],
    works: [
      ["Chili", "blast trigger"],
      ["Durian", "blast trigger"],
    ],
  },
  lemon: {
    family: "Boom",
    roles: ["Early", "Build-around"],
    works: [
      ["Apple", "doubles a Simmer fruit every turn"],
      ["Chili", "clutter that can't merge packs the jar; blasted neighbours score double"],
      ["Honeydew", "another Simmer fruit to double"],
    ],
    clashes: [["Grape", "neighbours can't merge, which stalls the ladder"]],
  },
  lime: {
    family: "Juice and grow",
    roles: ["Situational"],
    works: [["Juicer", "crushes the bottom row each turn"]],
    gap: "No clear role yet: floating doesn't score. Adopted 23 November, not built: fruit in lime juice count as touching each other.",
  },
  coconut: {
    family: "Juice and grow",
    roles: ["Situational"],
    works: [
      ["Apple", "milk doubles a Simmer fruit"],
      ["Honeydew", "same"],
      ["Preserves Jar", "keep one that's about to crack"],
    ],
  },
  pitaya: {
    family: "Juice and grow",
    roles: ["Late scaler"],
    works: [
      ["Cherry", "its food"],
      ["Pomegranate", "5 Cherries at once"],
      ["Gourd", "bursts into 4 Cherries"],
      ["Lemon", "doubles it every turn"],
    ],
  },
  apple: {
    family: "Juice and grow",
    roles: ["Standalone"],
    works: [
      ["Lemon", "doubles it every turn"],
      ["Coconut", "milk doubles it"],
      ["Snow Pear", "freezing keeps it on the wall"],
      ["Preserves Jar", "kept fruit score from turn 1"],
    ],
  },
  banana: {
    family: "Rot",
    roles: ["Build-around"],
    works: [
      ["Fruit Fly", "eats the rot for points"],
      ["Prune", "+8 for each rotten fruit it touches"],
      ["Fig", "its payoff makes every Banana gain"],
      ["Pickling Jar", "freezes its age so it never rots"],
    ],
  },
  fruitfly: {
    family: "Rot",
    roles: ["Late scaler", "Build-around"],
    works: [
      ["Banana", "a steady supply of rot"],
      ["Fig", "rots, then gets eaten"],
    ],
  },
  fig: {
    family: "Rot",
    roles: ["Late scaler", "Build-around"],
    works: [
      ["Banana", "rots it, and gains from it"],
      ["Chili", "destroys it"],
      ["Durian", "destroys it"],
    ],
  },
  prune: {
    family: "Rot",
    roles: ["Build-around"],
    works: [
      ["Banana", "makes the rot it feeds on"],
      ["Gourd", "absorbing rot makes rotten Cherries"],
    ],
  },
  kiwi: {
    family: "Flex",
    roles: ["Build-around"],
    works: [
      ["Durian", "the bots' best target"],
      ["Chili", "a second bomb"],
    ],
  },
  peach: {
    family: "Flex",
    roles: ["Standalone"],
    works: [
      ["Grape", "forces ladder merges"],
      ["Melon", "pushes toward Watermelons"],
    ],
  },
  honeydew: {
    family: "Flex",
    roles: ["Standalone"],
    works: [
      ["Apple", "glues a garden in place"],
      ["Pitaya", "same"],
      ["Snow Pear", "the garden bot's pairing"],
    ],
  },
  snowpear: {
    family: "Flex",
    roles: ["Situational"],
    works: [
      ["Apple", "garden builds' main defence"],
      ["Honeydew", "same"],
    ],
    clashes: [["Pumpkin", "a frozen fruit stops the Plunge"]],
  },
  dragonfruit: {
    family: "Legendary",
    roles: ["Standalone"],
    works: [
      ["Melon", "bigger merges jump further up the ladder"],
      ["Peach", "forces the merges it boosts"],
    ],
  },
  slice: {
    family: "Ladder",
    roles: ["Merge result"],
    works: [["Watermelon", "a Smashed one breaks into 4"]],
  },
  pumpkin: {
    family: "Ladder",
    roles: ["Build-around"],
    works: [
      ["Melon", "grow big fruit for the burst"],
      ["Watermelon", "about +45 on its own"],
      ["Orange", "Smashed pieces merge back up"],
      ["Pumpkin Seed", "its grown fruit are more to Smash"],
    ],
    clashes: [
      ["Snow Pear", "a frozen fruit stops it"],
      ["Apple", "costs a garden about 60 a run"],
    ],
  },
  gourd: {
    family: "Ladder",
    roles: ["Standalone"],
    works: [
      ["Pitaya", "feeds it the burst Cherries"],
      ["Banana", "absorbing rot makes rotten Cherries"],
      ["Prune", "more rot to touch"],
    ],
  },
  giantpumpkin: {
    family: "Ladder",
    roles: ["Merge result"],
    works: [
      ["Melon", "the reliable route: one in 11 runs of 24"],
      ["Dragonfruit", "skips sizes toward it"],
    ],
  },
  pumpkinseed: {
    family: "Ladder",
    roles: ["Late scaler", "Build-around"],
    works: [
      ["Chili", "the blast that makes it grow"],
      ["Durian", "same, bigger"],
      ["Pumpkin", "the grown fruit are more to Smash"],
    ],
    gap: "Needs a bomb in the deck, which ties Ladder to Boom. A Pumpkin's Plunge setting it off too is the other option.",
  },
  goldenapple: {
    family: "Economy",
    roles: ["Early", "Standalone"],
    works: [
      ["Preserves Jar", "kept, it pays again at the next rent"],
      ["Chili", "a blast pays its coins at once"],
      ["Juicer", "a Crush pays its coins"],
    ],
    gap: "The bots buy nothing in the shop, so they can't value coins yet.",
  },
};

/**
 * What the balance bots measured for a fruit on its own: points a run for a bot that takes it whenever offered, and for one that
 * never picks in the same test (24 seeds, rent ignored). Copied from the runs in the README; update both together.
 */
export interface Measure {
  kind: FruitKind;
  points: number;
  base: number;
  note?: string;
}

export const MEASURED: readonly Measure[] = [
  { kind: "melon", points: 1318, base: 1171, note: "Last rent 2 in 24" },
  { kind: "durian", points: 1307, base: 1171, note: "Last rent 1 in 24" },
  { kind: "pumpkin", points: 1162, base: 1171, note: "About 20 Smashes a run; last rent 2 in 24. Its Plunge test had no never-pick row" },
  { kind: "apple", points: 1140, base: 1128 },
  { kind: "chili", points: 1127, base: 1128, note: "Chili and Durian together: 1,262, last rent 1 in 24" },
  { kind: "gourd", points: 1111, base: 1128 },
  { kind: "coconut", points: 1101, base: 1128 },
  { kind: "pumpkinseed", points: 1032, base: 1140, note: "Does nothing without a bomb; Chili + Durian + Pumpkin Seed: 1,132" },
  { kind: "lime", points: 1031, base: 1128, note: "The weakest pick measured" },
  { kind: "goldenapple", points: 1000, base: 1140, note: "Coins unspent: the bots don't shop" },
];

/** Whole decks the bots have played: name, fruit, points a run, last rent made, what it shows. */
export const BUILDS: readonly (readonly [string, string, string, string, string])[] = [
  ["Kiwi, Durian and Chili", "Kiwi, Durian, Chili", "1,312", "9 in 100", "Strongest bomb build; reading the tray adds about +295 a run"],
  ["Boom", "Chili, Durian, Pomegranate, Blueberry, Seed, Lemon", "1,216", "11 in 100", "Reading the tray adds about +237 a run"],
  ["Chili and Durian", "Chili, Durian", "1,262", "1 in 24", "Making blasts Smash would lift it to 1,480: kept off"],
  ["Pumpkin and Melon", "Pumpkin, Melon", "1,357", "2 in 24", "Best Ladder pair since the Plunge"],
  ["Garden", "Apple, Honeydew, Pitaya, Snow Pear", "1,073", "0 in 24", "With the Plunge a Pumpkin costs it nothing (1,079)"],
];
