import { Flex, Text } from "@tsengine/runtime/jsx";

import { INK, LIGHT } from "./theme.ts";

interface KeyHintProps {
  /** The key's name, written on a key cap; "arrows" draws the left and right arrow keys, "updown" the up and down ones. */
  name: string;
  /** What the key does. */
  label: string;
  color?: string;
}


/** A key and what it does (the font's capitals are the top 14 pixels of its 20-pixel line, so the name is set 4 down), for a row of hints: a key cap with the key's name on it, then the label. */
export function KeyHint({ name, label, color = LIGHT }: KeyHintProps) {
  return (
    <Flex direction="row" alignItems="center" gap={6} height={26}>
      {name === "arrows" && <Flex width={54} height={26} backgroundImage="key-arrows.png" />}
      {name === "updown" && <Flex width={54} height={26} backgroundImage="key-updown.png" />}
      {name !== "arrows" && name !== "updown" && (
        <Flex height={26} minWidth={26} paddingX={8} paddingTop={4} paddingBottom={2} backgroundImage="key.png" sliceTop={4} sliceBottom={8} sliceLeft={4} sliceRight={4} alignItems="center" justifyContent="center">
          <Text color={INK}>{name}</Text>
        </Flex>
      )}
      <Text color={color}>{label}</Text>
    </Flex>
  );
}
