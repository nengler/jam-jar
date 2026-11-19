import { Flex, Text } from "@tsengine/runtime/jsx";

import { RuleText } from "./RuleText.tsx";
import { FRUITS, type FruitKind } from "./rules/fruits.ts";
import { KEYWORD_LIGHT, LIGHT, LIGHT_SOFT, PLAQUE, TERM_W } from "./theme.ts";

/**
 * A fruit's card, small: its name over what it does, on a dark box. It goes inside a `<Tooltip>` in the box of a fruit drawn in
 * play (on the shelf, in the Pool), so what a fruit does can be read without waiting for the pick. `note` is a line under it.
 */
export function FruitTip({ kind, note = "" }: { kind: FruitKind; note?: string }) {
  return (
    <Flex direction="column" width={TERM_W} paddingX={10} paddingTop={8} paddingBottom={6} backgroundImage={PLAQUE} slice={8} alignItems="center">
      <Text color={LIGHT}>{FRUITS[kind].name}</Text>
      <RuleText x={0} y={0} width={TERM_W - 20} text={FRUITS[kind].text} color={LIGHT} accent={KEYWORD_LIGHT} />
      {/* What can be done with it here (on the shelf: it can be moved), under a gap. */}
      {note !== "" && (
        <Flex paddingTop={6}>
          <Text width={TERM_W - 20} maxWidth={TERM_W - 20} align="center" color={LIGHT_SOFT}>
            {note}
          </Text>
        </Flex>
      )}
    </Flex>
  );
}
