import { Flex, Text, useSound } from "@tsengine/runtime/jsx";

import { CLICK_VOLUME, BUTTON, BUTTON_GREY, BUTTON_SLICE, COUNTER_SHADOW, INK, LIGHT } from "./theme.ts";

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
  // Every button clicks as it is pressed.
  const playClick = useSound("click.wav");
  const press = () => {
    playClick(CLICK_VOLUME);
    onPress();
  };
  return (
    <Flex direction="row" alignItems="center" gap={6}>
      {keyName !== "" && (
        <Flex height={26} minWidth={26} paddingX={8} paddingTop={4} paddingBottom={2} backgroundImage="key.png" sliceTop={4} sliceBottom={8} sliceLeft={4} sliceRight={4} alignItems="center" justifyContent="center">
          <Text color={INK}>{keyName}</Text>
        </Flex>
      )}
      <Flex direction="row" alignItems="center" height={30} paddingX={8} paddingTop={2} backgroundImage={BUTTON_GREY} hoverBackgroundImage={BUTTON} slice={BUTTON_SLICE} focusable={false} onPress={press}>
        <Text color={INK}>{label}</Text>
      </Flex>
    </Flex>
  );
}

/**
 * The pause button: a chunky block, like a key cap, with two bars on it (in a font, two bars read as a Roman numeral), standing
 * on the counter in the bottom right corner with its shadow under it, like anything else put down there. It lights amber under
 * the mouse.
 */
export function PauseButton({ onPress }: { onPress: () => void }) {
  const playClick = useSound("click.wav");
  const press = () => {
    playClick(CLICK_VOLUME);
    onPress();
  };
  return (
    <Flex width={32} height={30}>
      <Flex left={3} top={25} width={32} height={6} background={COUNTER_SHADOW} />
      <Flex width={32} height={30} backgroundImage="pause.png" hoverBackgroundImage="pause-hover.png" focusable={false} onPress={press} />
    </Flex>
  );
}
