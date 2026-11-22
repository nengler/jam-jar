import { Entity, Flex, Sprite, Text, Tooltip } from "@tsengine/runtime/jsx";

import { Panel } from "./Board.tsx";
import { Frame } from "./Coach.tsx";
import { BASKET_H, BASKET_W, BOARD_W, COINS_X, LEDGE_W, ROLL_FROM, SHELF_Y } from "./places.ts";
import type { Run } from "./rules/jar.ts";
import { COIN_JAR, DISPLAY, DISPLAY_SIZE, INK, LIGHT, PLAQUE } from "./theme.ts";

/** The basket's ledge and the inside of its rim: drawn behind a fruit rolling out of it. `drop` is how far above its place it still is, as it arrives. */
export function PoolBasketBack({ drop }: { drop: number }) {
  return (
    <Entity y={-drop}>
      <Sprite image="ledge.png" x={ROLL_FROM - LEDGE_W / 2} y={SHELF_Y} />
      <Sprite image="basket-back.png" x={ROLL_FROM - BASKET_W / 2} y={SHELF_Y - BASKET_H} />
    </Entity>
  );
}

/**
 * The pool's basket: what is still to be dealt this shuffle waits in it, and a dealt hand rolls out of it (drawn over the fruit,
 * so they come out from behind its front). Beside it, how many are left; the mouse over it says of how many, and a tap on it (or
 * D) opens the whole pool. At 0 it is refilled with every fruit before the next deal. Then the coins.
 */
export function PoolBasket({ run, drop, keys, onOpen }: { run: Run; drop: number; keys: boolean; onOpen: () => void }) {
  return (
    <Entity y={-drop}>
      <Sprite image="basket.png" x={ROLL_FROM - BASKET_W / 2} y={SHELF_Y - BASKET_H} />
      <Text x={ROLL_FROM + BASKET_W / 2 + 6} y={SHELF_Y - BASKET_H + 2} font={DISPLAY} size={DISPLAY_SIZE} color={LIGHT} shadow={INK} shadowX={2} shadowY={2}>
        {`${run.draw.length}`}
      </Text>
      {/* The coins, beside the fruit: the jar of coins and how many, as in the shop, standing where the basket does. */}
      <Flex x={COINS_X} y={SHELF_Y - BASKET_H} height={BASKET_H} direction="row" alignItems="end" gap={6}>
        <Sprite image={COIN_JAR} />
        <Flex height={BASKET_H} direction="row" alignItems="start" paddingTop={2}>
          <Text font={DISPLAY} size={DISPLAY_SIZE} color={LIGHT} shadow={INK} shadowX={2} shadowY={2}>{`${run.coins}`}</Text>
        </Flex>
      </Flex>
      <Flex x={ROLL_FROM - BASKET_W / 2} y={SHELF_Y - BASKET_H} width={BASKET_W + 40} height={BASKET_H} focusable={false} onPress={onOpen}>
        <Frame id="pool" pad={8} padBottom={4} />
        <Tooltip anchor="top-left" to="bottom-left" offsetX={0} offsetY={8} background="#00000000" borderWidth={0} paddingX={0} paddingY={0}>
          <Flex width={BOARD_W} direction="column" alignItems="stretch">
            <Panel image={PLAQUE}>
              <Text width={BOARD_W - 32} maxWidth={BOARD_W - 32} color={LIGHT}>
                {`${run.draw.length} of your ${run.pool.length} fruit left to deal. ${keys ? "D" : "Tap"} to see them all.`}
              </Text>
            </Panel>
          </Flex>
        </Tooltip>
      </Flex>
    </Entity>
  );
}
