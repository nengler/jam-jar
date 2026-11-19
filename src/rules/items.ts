/**
 * The item table: relics bought in the shop that change the jar's rules. Their effects are written in `jar.ts`; this file is
 * data only.
 */
export type ItemKind = "lid" | "juicer" | "shaker" | "preserves";

export interface ItemDef {
  name: string;
  /** Coins, in the shop. */
  price: number;
  /** One line for the shop. */
  text: string;
}

export const ITEMS: Readonly<Record<ItemKind, ItemDef>> = {
  lid: { name: "Lid", price: 6, text: "Stops one overflow: nothing spills" },
  juicer: { name: "Juicer", price: 8, text: "Crushes the fruit on the floor each turn" },
  shaker: { name: "Shaker", price: 5, text: "Shakes the jar after each hand drops" },
  preserves: { name: "Preserves", price: 8, text: "Keeps 2 fruit in the jar past the rent" },
};

export const ITEM_KINDS = Object.keys(ITEMS) as ItemKind[];
