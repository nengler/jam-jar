import { Flex, Text } from "@tsengine/runtime/jsx";

import { Dialog } from "./Board.tsx";
import { TapButton } from "./KeyHint.tsx";
import { BOARD_W, HUD_X } from "./places.ts";
import { ITEMS, keepingJar } from "./rules/items.ts";
import { keeps, type Run } from "./rules/jar.ts";
import { DISPLAY, DISPLAY_SIZE, INK, INK_SOFT } from "./theme.ts";

/**
 * The Preserves Jar, after the shop: what it is doing, how many are kept of how many it holds, and the way on. It stands where
 * the notes do (`bottom`), in place of one.
 */
export function PreserveBoard({ run, bottom, onDone }: { run: Run; bottom: number; onDone: () => void }) {
  return (
    <Flex right={HUD_X} bottom={bottom} width={BOARD_W} direction="column" alignItems="stretch">
      <Dialog title={ITEMS[keepingJar(run.items) ?? "preserves"].name} gap={4}>
        <Text width={BOARD_W - 40} maxWidth={BOARD_W - 40} align="center" color={INK_SOFT}>
          {`Tap fruit in the jar to keep them next cycle.`}
        </Text>
        <Flex direction="row" justifyContent="center">
          <Text font={DISPLAY} size={DISPLAY_SIZE} color={INK}>{`Kept ${run.kept.length} of ${keeps(run)}`}</Text>
        </Flex>
        <Flex direction="row" justifyContent="center" paddingTop={4}>
          <TapButton label={run.kept.length === 0 ? "Keep none" : "Keep these"} onPress={onDone} />
        </Flex>
      </Dialog>
    </Flex>
  );
}
