/**
 * The item table: relics bought in the shop that change the jar's rules. Their effects are written in `jar.ts`; this file is
 * data only.
 */
export type ItemKind = "lid" | "juicer" | "shaker" | "preserves";

export interface ItemDef {
  name: string;
  /** Coins, in the shop. */
  price: number;
  /** What it does, in the game's terms (rules/terms.ts). */
  text: string;
}

export const ITEMS: Readonly<Record<ItemKind, ItemDef>> = {
  lid: { name: "Lid", price: 6, text: "Stops the next Spill, then is used up." },
  juicer: { name: "Juicer", price: 8, text: "Each turn, Crush the fruit on the floor." },
  shaker: { name: "Shaker", price: 5, text: "After each drop, shakes the jar." },
  preserves: { name: "Preserves", price: 8, text: "Keep 2 fruit when the rent empties the jar." },
};

export const ITEM_KINDS = Object.keys(ITEMS) as ItemKind[];
