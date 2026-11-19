import { Flex, Text } from "@tsengine/runtime/jsx";

import { termsOf } from "./layout.ts";
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
          <Text width={TERM_W - 20} maxWidth={TERM_W - 20} color={LIGHT}>
            {term.text}
          </Text>
        </Flex>
      ))}
    </Flex>
  );
}
