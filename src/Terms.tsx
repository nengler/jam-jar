import { Flex } from "@tsengine/runtime/jsx";

import { termsOf } from "./layout.ts";
import { RuleText } from "./RuleText.tsx";
import { KEYWORD_LIGHT, LIGHT, PLAQUE, TERM_W } from "./theme.ts";

/**
 * What a card's keywords mean, in one dark box: a line for each keyword in its text, its name in gold and then what it means
 * ("Wide: Takes 2 places…"). It goes inside a `<Tooltip>` in the card (the tooltip must be the card's own child to follow the
 * mouse over it), so hovering a card explains it, as Slay the Spire's cards do. Every card has the one box, however many keywords
 * it has: a box for each was taller than the screen for a card with four (a Pumpkin's, a Watermelon's), and the two looks side
 * by side read as two different things.
 */
export function Terms({ text }: { text: string }) {
  const terms = termsOf(text);
  if (terms.length === 0) return null;
  return (
    <Flex direction="column" width={TERM_W} paddingX={10} paddingTop={8} paddingBottom={6} gap={4} backgroundImage={PLAQUE} slice={8}>
      {/* The name is a keyword, so it is drawn in gold, as are the keywords in what it means. */}
      {terms.map((term) => (
        <RuleText key={term.id} x={0} y={0} width={TERM_W - 20} text={`${term.name}: ${term.text}`} color={LIGHT} accent={KEYWORD_LIGHT} align="start" />
      ))}
    </Flex>
  );
}
