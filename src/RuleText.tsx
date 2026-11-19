import { Flex, Text } from "@tsengine/runtime/jsx";

import { ruleWords } from "./rules/terms.ts";

interface RuleTextProps {
  x: number;
  y: number;
  /** The width it wraps in; each line is centred in it. */
  width: number;
  text: string;
  color: string;
  /** The colour of the keywords in it. */
  accent: string;
}

/** The gap between two words: the font's space, at 2x. */
const SPACE = 6;

/**
 * Card text in the game's terms: wrapped and centred like a `<Text>`, but word by word, so the keywords in it (rules/terms.ts)
 * are drawn in the accent colour.
 */
export function RuleText({ x, y, width, text, color, accent }: RuleTextProps) {
  return (
    <Flex x={x} y={y} width={width} direction="row" wrap justifyContent="center" columnGap={SPACE} rowGap={0}>
      {ruleWords(text).map((w) => (
        <Text key={w.id} color={w.keyword ? accent : color}>
          {w.word}
        </Text>
      ))}
    </Flex>
  );
}
