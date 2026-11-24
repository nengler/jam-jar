import { Flex, Text } from "@tsengine/runtime/jsx";

import { RuleText } from "./RuleText.tsx";
import { FRUITS, type FruitKind } from "./rules/fruits.ts";
import { Terms } from "./Terms.tsx";
import { KEYWORD_LIGHT, LIGHT, PLAQUE, TERM_W } from "./theme.ts";

/**
 * A fruit's card, small: its name over what it does, on a dark box, and under it a box saying what each keyword in that
 * text means, as a pick's card shows. It goes inside a `<Tooltip>` in the box of a fruit drawn in play (on the
 * shelf, in the Pool), so what a fruit does can be read in full without waiting for the pick. `grown` is what every fruit of
 * the kind has gained this run, and `text` what its card says in this run (`cardText`: a Pumpkin Seed's changes).
 *
 * With `apart`, the card and its keywords stand that many pixels apart edge to edge, the card at the left and the keywords at the
 * right: the shelf's tip, beside the jar on both sides, as one column of both was taller than the screen for a fruit with many
 * keywords (a Pumpkin's ran off its foot).
 */
export function FruitTip({ kind, grown = 0, text, apart, down = 0 }: { kind: FruitKind; grown?: number; text: string; apart?: number; down?: number }) {
  return (
    <Flex direction={apart === undefined ? "column" : "row"} width={apart ?? "fit"} justifyContent={apart === undefined ? "start" : "space-between"} alignItems="start" gap={2}>
      {/* With `apart`, the card stands `down` pixels lower than its keywords: under the rent board, which is taller than the basket. */}
      <Flex direction="column" paddingTop={apart === undefined ? 0 : down}>
      <Flex direction="column" width={TERM_W} paddingX={10} paddingTop={8} paddingBottom={6} backgroundImage={PLAQUE} slice={8} alignItems="center">
        <Text color={LIGHT}>{FRUITS[kind].name}</Text>
        <RuleText x={0} y={0} width={TERM_W - 20} text={text} color={LIGHT} accent={KEYWORD_LIGHT} />
        {/* What the run has added to every fruit of this kind (see `grownOf`). */}
        {grown > 0 && (
          <Text width={TERM_W - 20} maxWidth={TERM_W - 20} align="center" color={KEYWORD_LIGHT}>
            {`Every ${FRUITS[kind].name} has Grown +${grown}.`}
          </Text>
        )}
      </Flex>
      </Flex>
      <Terms text={text} />
    </Flex>
  );
}

/** The same for a thing that is not a fruit (the shop's item, a glaze): its name over what it does, and what its keywords mean. */
export function CardTip({ name, text }: { name: string; text: string }) {
  return (
    <Flex direction="column" alignItems="start" gap={2}>
      <Flex direction="column" width={TERM_W} paddingX={10} paddingTop={8} paddingBottom={6} backgroundImage={PLAQUE} slice={8} alignItems="center">
        <Text color={LIGHT}>{name}</Text>
        <RuleText x={0} y={0} width={TERM_W - 20} text={text} color={LIGHT} accent={KEYWORD_LIGHT} />
      </Flex>
      <Terms text={text} />
    </Flex>
  );
}
