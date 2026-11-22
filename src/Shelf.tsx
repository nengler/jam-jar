import { Entity, Flex, Sprite, Tooltip } from "@tsengine/runtime/jsx";

import { Frame } from "./Coach.tsx";
import { FruitBall } from "./FruitBall.tsx";
import { FruitTip } from "./FruitTip.tsx";
import { grownOf, placed, rollIn, rollStarted, shelfX } from "./layout.ts";
import { HOLD_LIFT, ROLL_FROM, SHELF_FOOT, SHELF_Y, shelfOf, SLOT } from "./places.ts";
import type { FruitKind } from "./rules/fruits.ts";
import { bossNow, handSlots, type Run } from "./rules/jar.ts";
import { biggestFruit, CARD_SLICE, fruitImageSize, SELECT } from "./theme.ts";

/** Where the card of a fruit on the shelf stands: in the top left corner, over the rent board for as long as it is up, so it
 * never lies over the jar, which is what the player is deciding about. */
const TIP_X = 4;
const TIP_TOP = 4;

/** A fruit on the shelf: its size, how far it is lifted (while it is being moved), and the frame round it when it is the chosen one. */
function shelfLook(card: FruitKind, at: number, span: number, held: boolean) {
  const size = fruitImageSize(card);
  return { card, at, size, lift: held ? HOLD_LIFT : 0, frameW: Math.max(40 + SLOT * (span - 1), size + 8), frameH: Math.max(40, size + 8) };
}

interface ShelfProps {
  run: Run;
  /** Seconds since the hand was dealt: each fruit rolls out of the basket to its place (`rollIn`). */
  roll: number;
  /** The held fruit is being dragged: it is drawn under the pointer, at `dragX`, not in its place. */
  dragging: boolean;
  dragX: number;
  /** The chosen fruit's frame shows: at a keyboard, or for a fruit that was tapped. */
  framed: boolean;
  /** The box that hears the hand being dragged and tapped is there: while ordering, with nothing over the screen. */
  listening: boolean;
  onDragStart: (x: number) => void;
  onDrag: (x: number) => void;
  onDragEnd: () => void;
  onPressOutside: () => void;
}

/**
 * The hand on the shelf, each fruit over the lane it drops down. The chosen fruit is framed in amber; a held one is lifted. In the
 * Blind jar each is under a cloth. Under it, the box that hears the hand being dragged and tapped; the tutorial's frame goes
 * round it when the shelf is picked out.
 */
export function Shelf({ run, roll, dragging, dragX, framed, listening, onDragStart, onDrag, onDragEnd, onPressOutside }: ShelfProps) {
  const ordering = run.phase === "order";
  const blind = bossNow(run) === "blind";
  const shelf = shelfOf(run);
  /** How far above the plank the hand reaches, a lifted fruit with its frame included: what the drag box and the shelf's lesson cover. */
  const shelfTall = Math.max(44, biggestFruit(shelf.cards) + SHELF_FOOT + HOLD_LIFT + 4);
  /** Each fruit on the shelf with its size, how far it is lifted, and the size of the frame round it when it is the chosen one. */
  const looks = placed(shelf.cards).map((slot) => shelfLook(slot.card, slot.at, shelf.spans[slot.at] ?? 1, ordering && run.holding && slot.at === run.cursor));
  return (
    <Entity>
      {listening && (
        <Flex x={shelf.left} y={SHELF_Y - shelfTall} width={handSlots(shelf.cards) * SLOT} height={shelfTall + 8} onDragStart={onDragStart} onDrag={onDrag} onDragEnd={onDragEnd} onPressOutside={onPressOutside}>
          <Frame id="shelf" pad={8} padTop={2} padBottom={2} />
        </Flex>
      )}
      {/* Each fruit stands on the plank at its own size; the frame round the chosen one is a little bigger than it (and spans both
          places of a Wide fruit), and goes up with it when it is lifted. Under the Blind jar's cloth every fruit looks the same
          size, so the cloth gives nothing away. */}
      {looks.map((slot) => (
        <Entity key={`${slot.card}${slot.at}`} x={shelfX(slot.at, shelf.left, SLOT, shelf.spans, dragging && slot.at === run.cursor, dragX) + (ordering ? rollIn(roll, slot.at, ROLL_FROM - shelfX(slot.at, shelf.left, SLOT, shelf.spans, false, 0)) : 0)} y={SHELF_Y - SHELF_FOOT}>
          {ordering && !blind && slot.at === run.cursor && framed && <Flex x={-slot.frameW / 2} y={-slot.lift - (slot.size + slot.frameH) / 2} width={slot.frameW} height={slot.frameH} backgroundImage={SELECT} slice={CARD_SLICE} />}
          {!blind && (!ordering || rollStarted(roll, slot.at)) && <FruitBall kind={slot.card} x={0} y={-slot.lift - slot.size / 2} turn={ordering ? rollIn(roll, slot.at, ROLL_FROM - shelfX(slot.at, shelf.left, SLOT, shelf.spans, false, 0)) / 16 : 0} />}
          {blind && (!ordering || rollStarted(roll, slot.at)) && <Sprite image="covered.png" x={-16} y={-32} />}
        </Entity>
      ))}
    </Entity>
  );
}

/**
 * What a fruit on the shelf does: shown for the one that was tapped (or the cursor is on, at a keyboard) while `shown`, and for
 * one the mouse is over, in the top left corner whichever fruit it is for, so it never lies over the jar. Its box stays at the
 * fruit's place on the shelf, not under a fruit being dragged: one that followed the pointer and was moved back by as much shook
 * as it was dragged.
 */
export function ShelfTips({ run, shown }: { run: Run; shown: boolean }) {
  const shelf = shelfOf(run);
  return (
    <Entity>
      {placed(shelf.cards).map((slot) => (
        <Flex key={`tip${slot.card}${slot.at}`} x={shelfX(slot.at, shelf.left, SLOT, shelf.spans, false, 0) - 20} y={SHELF_Y - 38} width={40} height={40}>
          <Tooltip show={shown && slot.at === run.cursor ? true : undefined} anchor="top-left" to="top-left" offsetX={TIP_X - (shelfX(slot.at, shelf.left, SLOT, shelf.spans, false, 0) - 20)} offsetY={TIP_TOP - (SHELF_Y - 38)} background="#00000000" borderWidth={0} paddingX={0} paddingY={0}>
            <FruitTip kind={slot.card} grown={grownOf(run, slot.card)} />
          </Tooltip>
        </Flex>
      ))}
    </Entity>
  );
}
