import { Flex, Text } from "@tsengine/runtime/jsx";

import { RuleText } from "./RuleText.tsx";
import { FRUITS, type FruitKind } from "./rules/fruits.ts";
import { KEYWORD_LIGHT, LIGHT, PLAQUE, TERM_W } from "./theme.ts";

/**
 * A fruit's card, small: its name over what it does, on a dark box. It goes inside a `<Tooltip>` in the box of a fruit drawn in
 * play (on the shelf, in the Pool), so what a fruit does can be read without waiting for the pick.
 */
export function FruitTip({ kind }: { kind: FruitKind }) {
  return (
    <Flex direction="column" width={TERM_W} paddingX={10} paddingTop={8} paddingBottom={6} backgroundImage={PLAQUE} slice={8} alignItems="center">
      <Text color={LIGHT}>{FRUITS[kind].name}</Text>
      <RuleText x={0} y={0} width={TERM_W - 20} text={FRUITS[kind].text} color={LIGHT} accent={KEYWORD_LIGHT} />
    </Flex>
  );
}
