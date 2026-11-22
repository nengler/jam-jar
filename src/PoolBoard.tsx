import { Entity, Flex, Shape, Text } from "@tsengine/runtime/jsx";

import { Dialog } from "./Board.tsx";
import { FruitBall } from "./FruitBall.tsx";
import { FruitTip } from "./FruitTip.tsx";
import { TapButton } from "./KeyHint.tsx";
import { countOf, grownOf, kindAt, placed, poolRows } from "./layout.ts";
import type { FruitKind } from "./rules/fruits.ts";
import type { Run } from "./rules/jar.ts";
import { CARD_SLICE, fruitImageSize, INK, INK_SOFT, SELECT, SHADE, TERM_W } from "./theme.ts";

/** The whole-pool board: each kind in a cell its own fruit's width and a little more, a row as tall as its tallest, wrapping at this width. */
const POOL_W = 400;
/** The tallest the pool board's fruit get before they scroll: what keeps the board on the screen with its sign and its button. */
const POOL_MAX_H = 256;
/** The tallest a kind's card and keywords get beside the board before they scroll. */
const TIP_MAX_H = 352;

/** A kind's cell on the pool board: its fruit's width with room for the frame that marks the chosen one, and never narrower than its count. */
function poolCell(kind: FruitKind): number {
  return Math.max(40, fruitImageSize(kind)) + 12;
}

interface PoolBoardProps {
  run: Run;
  /** The place of the kind tapped on the board, or -1. */
  chosenAt: number;
  onLook: (at: number) => void;
  onLookAway: () => void;
  onClose: () => void;
}

/**
 * The whole pool, over everything: every kind in it and how many, dealt or not. A tap on a kind shows all it does, beside the
 * board (a tooltip under the fruit would run off the foot of the screen); a tap anywhere else puts that away.
 */
export function PoolBoard({ run, chosenAt, onLook, onLookAway, onClose }: PoolBoardProps) {
  const whole = poolRows(run.pool);
  const looked = kindAt(whole, chosenAt);
  return (
    <Entity>
      <Shape kind="rect" x={0} y={0} width={640} height={360} color={SHADE} />
      <Flex left={0} right={0} top={0} bottom={0} direction="row" alignItems="center" justifyContent="center" gap={8}>
        {/* At most as tall as the screen: a Watermelon's card and keywords are a little taller, and scroll. */}
        <Flex width={TERM_W} maxHeight={TIP_MAX_H} direction="column" alignItems="stretch" overflow="scroll" scrollbarColor={INK_SOFT}>
          {looked !== null && <FruitTip kind={looked ?? "cherry"} grown={grownOf(run, looked ?? "cherry")} />}
        </Flex>
        <Flex width={Math.max(240, Math.min(POOL_W, whole.reduce((w, row) => w + poolCell(row.kind), 0) + 32))} direction="column" alignItems="stretch">
          <Dialog title={`Your pool: ${run.pool.length} fruit`}>
            <Flex maxHeight={POOL_MAX_H} direction="row" wrap justifyContent="center" alignItems="end" rowGap={2} columnGap={0} overflow="scroll" scrollbarColor={INK_SOFT} onPressOutside={onLookAway}>
              {placed(whole).map((slot) => (
                <Flex key={slot.card.kind} width={poolCell(slot.card.kind)} direction="column" alignItems="center" gap={4} paddingTop={2} backgroundImage={chosenAt === slot.at ? SELECT : undefined} slice={CARD_SLICE} focusable={false} onPress={() => onLook(slot.at)}>
                  {/* A kind with none left to deal this shuffle is faded; under each, how many are left of how many there are. */}
                  <Flex width={fruitImageSize(slot.card.kind)} height={fruitImageSize(slot.card.kind)} opacity={countOf(run.draw, slot.card.kind) === 0 ? 0.35 : 1}>
                    <FruitBall kind={slot.card.kind} x={fruitImageSize(slot.card.kind) / 2} y={fruitImageSize(slot.card.kind) / 2} />
                  </Flex>
                  <Text color={countOf(run.draw, slot.card.kind) === 0 ? INK_SOFT : INK}>{`${countOf(run.draw, slot.card.kind)}/${slot.card.count}`}</Text>
                </Flex>
              ))}
            </Flex>
            <Flex direction="row" justifyContent="center" paddingTop={4}>
              <TapButton label="Close" onPress={onClose} />
            </Flex>
          </Dialog>
        </Flex>
      </Flex>
    </Entity>
  );
}
