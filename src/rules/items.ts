/**
 * The item table: relics bought in the shop that change the jar's rules. Their effects are written in `jar.ts`; this file is
 * data only.
 */
export type ItemKind = "lid";

export interface ItemDef {
  name: string;
  /** Coins, in the shop. */
  price: number;
  /** One line for the shop. */
  text: string;
}

export const ITEMS: Readonly<Record<ItemKind, ItemDef>> = {
  lid: { name: "Lid", price: 6, text: "Stops one overflow: nothing spills" },
};

export const ITEM_KINDS = Object.keys(ITEMS) as ItemKind[];
