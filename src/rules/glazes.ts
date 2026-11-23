/**
 * Glazes (design doc, "Chains, glazes and bridge fruit"): an upgrade on one fruit in the pool, not on its kind. The shop sells one
 * glaze a visit, put on a fruit the player chooses; that fruit is dealt glazed for the rest of the run, and holds one glaze. In
 * the jar a glazed fruit that merges or changes (a Merge, a Gourd's growth, a Kiwi's copy of it aside) loses the glaze, and what
 * it becomes is plain, but the fruit in the pool keeps it. Effects are written in `jar.ts`; this file is data only.
 */
import { FRUITS, type FruitKind } from "./fruits.ts";

export type Glaze = "spicy" | "ripe" | "fizzy" | "seeded" | "anchored";

export const GLAZE_KINDS: readonly Glaze[] = ["spicy", "ripe", "fizzy", "seeded", "anchored"];

export interface GlazeDef {
  name: string;
  /** The shop's label: its keywords (rules/terms.ts), whose tooltip says what it does. */
  text: string;
}

export const GLAZES: Readonly<Record<Glaze, GlazeDef>> = {
  spicy: { name: "Spicy", text: "Glaze. Spicy." },
  ripe: { name: "Ripe", text: "Glaze. Ripe." },
  fizzy: { name: "Fizzy", text: "Glaze. Fizzy." },
  seeded: { name: "Seeded", text: "Glaze. Seeded." },
  anchored: { name: "Anchored", text: "Glaze. Anchored." },
};

/** What a glaze costs in the shop, in coins. */
export const GLAZE_PRICE = 4;

/** A Spicy fruit's blast when it merges: how far it reaches (px), what it adds for each fruit it destroys, and its fuse (s). */
export const SPICY = { radius: 44, bonus: 12, fuse: 0.2 };

/** How many links a Fizzy fruit's score adds to the chain, on top of any its trigger adds. */
export const FIZZY_LINKS = 1;

/**
 * What a Ripe fruit lands as: a Cherry as a Grape, and a Gourd Grape-sized (`jar.ts` sizes it). With the bots, a Ripe Orange
 * landing as a Melon made a starter build a third stronger, and a Ripe Grape landing as an Orange a quarter, so only the smallest
 * ripen.
 */
export function ripened(kind: FruitKind): FruitKind | undefined {
  return kind === "gourd" ? "gourd" : kind === "cherry" ? "grape" : undefined;
}

/** Whether a glaze does anything on this kind: Spicy needs a fruit that Merges, Ripe one with a size up, Fizzy one that scores. */
export function glazeFits(glaze: Glaze, kind: FruitKind): boolean {
  if (glaze === "spicy") return FRUITS[kind].mergesInto !== undefined && FRUITS[kind].mergesInto !== "giantpumpkin";
  if (glaze === "ripe") return ripened(kind) !== undefined;
  if (glaze === "fizzy") return FRUITS[kind].scoring !== "booster";
  return true;
}
