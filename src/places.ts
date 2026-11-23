import type { FruitKind } from "./rules/fruits.ts";
import type { Glaze } from "./rules/glazes.ts";
import { handSlots, JAR, slotsOf, type Run } from "./rules/jar.ts";

/** Where things stand on the play screen, for Play.tsx and the parts of it in their own files. */

/** The boards either side of the jar: 192 wide, 12 from the screen's edges, each under its heading. */
export const BOARD_W = 192;
export const HUD_X = 12;
export const BOARD_Y = 28;

/** The shelf above the jar: its plank's top, and how far apart the hand's fruit stand on it, left to right, a slot over each of the jar's lanes. */
export const SHELF_Y = 56;
export const SLOT = 48;
/** Where a fruit on the shelf stands: its foot this far above the plank's top. A fruit is drawn at its own size, so a big one is
 * cut off by the top of the screen, which shows how big it is; one being moved is lifted. */
export const SHELF_FOOT = 2;
export const HOLD_LIFT = 8;

/** The middle of the jar, across. */
export const JAR_MID = (JAR.left + JAR.right) / 2;

/** The basket the pool's fruit wait in, on a ledge past the shelf's right end, 4 pixels from it: the ledge's left edge and the
 * basket's middle. A newly dealt fruit starts its roll along the shelf there, inside the basket, and rolls out of it. */
export const LEDGE_GAP = 4;
export const LEDGE_W = 60;
export const BASKET_W = 56;
export const BASKET_H = 38;
export const ROLL_FROM = JAR_MID + 104 + LEDGE_GAP + LEDGE_W / 2;
/** The coins stand to the right of the basket and its count, with room for a count of two figures between. */
export const COINS_X = ROLL_FROM + 56 / 2 + 50;

/** What is on the shelf (the hand while ordering, then what is left of it while dropping), the places each takes, and the shelf's left end. */
export interface ShelfRow {
  cards: readonly FruitKind[];
  /** The glaze on each, or null. */
  glazes: readonly (Glaze | null)[];
  spans: number[];
  left: number;
}

export function shelfOf(run: Run): ShelfRow {
  const cards = run.phase === "order" ? run.hand : run.queue;
  const glazes = run.phase === "order" ? run.handGlazes : run.queueGlazes;
  return { cards, glazes, spans: cards.map((kind) => slotsOf(kind)), left: JAR_MID - (handSlots(cards) * SLOT) / 2 };
}
