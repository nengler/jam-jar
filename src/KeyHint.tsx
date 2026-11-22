import { Flex, Text } from "@tsengine/runtime/jsx";

import { PushButton } from "./PushButton.tsx";
import { COUNTER_SHADOW, INK, LIGHT } from "./theme.ts";

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

/**
 * A button to tap or click, for what a key does: "Drop", "Skip", "Pause". It is always there, so the game can be played with
 * no keyboard (a phone, or just the mouse); `keyName` draws the key beside it as well, which the screens do until the key is
 * learned. The key stands just left of the button, as in a row of `KeyHint`s, not on it: a key cap inside the button looked like
 * a second button laid over the first.
 */
export function TapButton({ label, keyName = "", onPress }: { label: string; keyName?: string; onPress: () => void }) {
  return (
    <Flex direction="row" alignItems="center" gap={6}>
      {keyName !== "" && (
        <Flex height={26} minWidth={26} paddingX={8} paddingTop={4} paddingBottom={2} backgroundImage="key.png" sliceTop={4} sliceBottom={8} sliceLeft={4} sliceRight={4} alignItems="center" justifyContent="center">
          <Text color={INK}>{keyName}</Text>
        </Flex>
      )}
      <PushButton label={label} onPress={onPress} />
    </Flex>
  );
}

/**
 * The pause button: the same key cap as every button, square, with two bars on it (in a font, two bars read as a Roman numeral),
 * standing on the counter in the bottom right corner with its shadow under it, like anything else put down there. Given
 * `pressKey` (Escape), the key presses it, so it pushes in on screen as it does under a finger.
 */
export function PauseButton({ onPress, pressKey }: { onPress: () => void; pressKey?: string }) {
  return (
    <Flex width={32} height={30}>
      <Flex left={3} top={25} width={32} height={6} background={COUNTER_SHADOW} />
      <PushButton width={32} height={30} paddingX={0} pressKey={pressKey} onPress={onPress}>
        <Flex direction="row" gap={4}>
          <Flex width={4} height={12} background={INK} />
          <Flex width={4} height={12} background={INK} />
        </Flex>
      </PushButton>
    </Flex>
  );
}
