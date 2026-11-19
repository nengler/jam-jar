/**
 * The item table: relics bought in the shop that change the jar's rules. Their effects are written in `jar.ts`; this file is
 * data only.
 */
export type ItemKind = "lid" | "juicer" | "shaker" | "preserves" | "bigpreserves" | "pickling";

export interface ItemDef {
  name: string;
  /** Coins, in the shop. */
  price: number;
  /** What it does, in the game's terms (rules/terms.ts). */
  text: string;
  /** The item it is an upgrade of: only offered to a player who owns that one, and it takes its place. */
  upgrades?: ItemKind;
  /** How many fruit it keeps in the jar when the rent empties it. */
  keeps?: number;
}

export const ITEMS: Readonly<Record<ItemKind, ItemDef>> = {
  lid: { name: "Lid", price: 6, text: "Stops the next Spill. Once." },
  juicer: { name: "Juicer", price: 8, text: "Each turn, Crush the fruit on the floor." },
  shaker: { name: "Shaker", price: 5, text: "After each drop, Shake." },
  preserves: { name: "Preserves", price: 8, text: "Preserve 2.", keeps: 2 },
  bigpreserves: { name: "Big Jar", price: 8, text: "Preserve 3.", upgrades: "preserves", keeps: 3 },
  pickling: { name: "Pickling Jar", price: 8, text: "Preserve 1, Pickled.", upgrades: "preserves", keeps: 1 },
};

export const ITEM_KINDS = Object.keys(ITEMS) as ItemKind[];

/** The jar a player keeps fruit in, if they own one: the Preserves Jar or what it was upgraded to. */
export function keepingJar(items: readonly ItemKind[]): ItemKind | undefined {
  return items.find((item) => ITEMS[item].keeps !== undefined);
}

/** What the shop can offer a player who owns these: nothing they own, an upgrade only of what they own, and not what they upgraded. */
export function offerable(items: readonly ItemKind[]): ItemKind[] {
  const upgraded = items.map((item) => ITEMS[item].upgrades);
  return ITEM_KINDS.filter((item) => {
    const from = ITEMS[item].upgrades;
    return !items.includes(item) && !upgraded.includes(item) && (from === undefined || items.includes(from));
  });
}
