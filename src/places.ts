import type { FruitKind } from "./rules/fruits.ts";
import type { Glaze } from "./rules/glazes.ts";
import { handSlots, JAR, RIM, slotsOf, type Run } from "./rules/jar.ts";
import type { Lesson, LessonTarget } from "./rules/tutorial.ts";
import { biggestFruit } from "./theme.ts";

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

/** How far above the plank the hand reaches, a lifted fruit with its frame included: what the shelf's drag box and its lesson cover. */
export function shelfTall(cards: readonly FruitKind[]): number {
  return Math.max(44, biggestFruit(cards) + SHELF_FOOT + HOLD_LIFT + 4);
}

/** What is picked out on the play screen: what the lesson is about, or the jar while a Preserves Jar's fruit are chosen. */
export function litOf(lesson: Lesson | null, preserving: boolean): LessonTarget {
  return lesson !== null ? lesson.target : preserving ? "jar" : null;
}

/** A box on the screen. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The rent board's height, from its heading's line to its foot (it is as tall as what is on it, which does not change). */
const RENT_BOARD_H = 132;

/**
 * Where a part of the play screen a lesson picks out is, as the amber frame goes round it (`Frame` in Coach.tsx, with the same
 * room round each box): the hole the dark leaves (`Dim`). It is worked out here, not read from the part's own box, because
 * the dark is drawn after everything it dims, and nothing drawn tells another where it was laid out.
 */
export function litBox(target: LessonTarget, run: Run): Box {
  if (target === "jar") return { x: JAR.left - 8, y: RIM - 40, width: JAR.right - JAR.left + 16, height: 280 };
  // The rent board with its heading, which is lettered on the wall above its box.
  if (target === "rent") return { x: HUD_X - 6, y: BOARD_Y - 22, width: BOARD_W + 12, height: RENT_BOARD_H + 32 };
  if (target === "pool") return { x: ROLL_FROM - BASKET_W / 2 - 8, y: SHELF_Y - BASKET_H - 8, width: BASKET_W + 40 + 16, height: BASKET_H + 12 };
  if (target === "shelf") {
    const shelf = shelfOf(run);
    const tall = shelfTall(shelf.cards);
    return { x: shelf.left - 8, y: SHELF_Y - tall - 2, width: handSlots(shelf.cards) * SLOT + 16, height: tall + 8 + 4 };
  }
  // Nothing is picked out: no hole (and the dark is not drawn).
  return { x: 0, y: 0, width: 0, height: 0 };
}
