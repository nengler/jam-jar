import { Flex, Text } from "@tsengine/runtime/jsx";

import { RuleText } from "./RuleText.tsx";
import { FRUITS, type FruitKind } from "./rules/fruits.ts";
import { Terms } from "./Terms.tsx";
import { KEYWORD_LIGHT, LIGHT, PLAQUE, TERM_W } from "./theme.ts";

/**
 * A fruit's card, small: its name over what it does, on a dark box, and under it a box for each keyword in that text saying
 * what the keyword means, as a pick's card shows. It goes inside a `<Tooltip>` in the box of a fruit drawn in play (on the
 * shelf, in the Pool), so what a fruit does can be read in full without waiting for the pick. `grown` is what every fruit of
 * the kind has gained this run.
 */
export function FruitTip({ kind, grown = 0 }: { kind: FruitKind; grown?: number }) {
  return (
    <Flex direction="column" gap={2}>
      <Flex direction="column" width={TERM_W} paddingX={10} paddingTop={8} paddingBottom={6} backgroundImage={PLAQUE} slice={8} alignItems="center">
        <Text color={LIGHT}>{FRUITS[kind].name}</Text>
        <RuleText x={0} y={0} width={TERM_W - 20} text={FRUITS[kind].text} color={LIGHT} accent={KEYWORD_LIGHT} />
        {/* What the run has added to every fruit of this kind (see `grownOf`). */}
        {grown > 0 && (
          <Text width={TERM_W - 20} maxWidth={TERM_W - 20} align="center" color={KEYWORD_LIGHT}>
            {`Every ${FRUITS[kind].name} has Grown +${grown}.`}
          </Text>
        )}
      </Flex>
      <Terms text={FRUITS[kind].text} />
    </Flex>
  );
}
