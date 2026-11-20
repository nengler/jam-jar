import { Flex, Text } from "@tsengine/runtime/jsx";

import { termsOf } from "./layout.ts";
import { RuleText } from "./RuleText.tsx";
import { KEYWORD_LIGHT, LIGHT, PLAQUE, TERM_W } from "./theme.ts";

/**
 * What a card's keywords mean: a dark box for each keyword in its text, its name in gold over one line of what it means. It
 * goes inside a `<Tooltip>` in the card (the tooltip must be the card's own child to follow the mouse over it), so hovering a
 * card explains it, as Slay the Spire's cards do.
 */
export function Terms({ text }: { text: string }) {
  return (
    <Flex direction="column" gap={2}>
      {termsOf(text).map((term) => (
        <Flex key={term.id} direction="column" width={TERM_W} paddingX={10} paddingTop={8} paddingBottom={6} backgroundImage={PLAQUE} slice={8}>
          <Text color={KEYWORD_LIGHT}>{term.name}</Text>
          {/* The keywords in what it means are picked out as on a card: "Never ages, never Rotten." */}
          <RuleText x={0} y={0} width={TERM_W - 20} text={term.text} color={LIGHT} accent={KEYWORD_LIGHT} align="start" />
        </Flex>
      ))}
    </Flex>
  );
}
