import { Entity, Flex, Shape, Text } from "@tsengine/runtime/jsx";

import { sweep } from "./layout.ts";
import { DISPLAY, DISPLAY_SIZE, GOLD, INK, LIGHT } from "./theme.ts";

/** The band behind the last turn's banner: the darkest Apollo colour, nearly solid. */
const SWEEP_BAND = "#090a14e6";

/**
 * The last turn of a cycle: a dark band snaps open across the screen and "Last turn" shoots through it, with what is still owed
 * (`owed`, 0 once the rent is made). `since` is the seconds since it began; it is drawn only while it crosses the screen, and
 * only drawn, so the hand can be ordered under it.
 */
export function LastTurn({ since, owed }: { since: number; owed: number }) {
  const banner = sweep(since);
  return (
    <Entity>
      {banner.shown && (
        <Entity>
          <Shape kind="rect" x={0} y={180 - 34 * banner.open} width={640} height={68 * banner.open} color={SWEEP_BAND} />
          <Shape kind="rect" x={0} y={180 - 34 * banner.open - 2} width={640} height={2} color={GOLD} />
          <Shape kind="rect" x={0} y={180 + 34 * banner.open} width={640} height={2} color={GOLD} />
          {/* Each line is centred across the screen and moved within its row: the words one way, what is owed the other. */}
          <Flex left={0} right={0} top={146} direction="row" justifyContent="center">
            <Flex x={banner.x}>
              <Text font={DISPLAY} size={DISPLAY_SIZE * 2} color={GOLD} shadow={INK} shadowX={4} shadowY={4}>
                Last turn
              </Text>
            </Flex>
          </Flex>
          <Flex left={0} right={0} top={194} direction="row" justifyContent="center">
            <Flex x={-banner.x}>
              <Text color={LIGHT}>{owed <= 0 ? "The rent is made" : `${owed} more to make the rent`}</Text>
            </Flex>
          </Flex>
        </Entity>
      )}
    </Entity>
  );
}
