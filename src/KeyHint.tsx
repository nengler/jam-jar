import { Button, Flex, Text, useSound } from "@tsengine/runtime/jsx";

import { CLICK_VOLUME, BUTTON, BUTTON_GREY, BUTTON_SLICE, INK, LIGHT } from "./theme.ts";

interface KeyHintProps {
  /** The key's name, written on a key cap; "arrows" draws the left and right arrow keys, "updown" the up and down ones. */
  name: string;
  /** What the key does. */
  label: string;
  color?: string;
}

/** A key and what it does, for a row of hints: a key cap with the key's name on it, then the label. */
export function KeyHint({ name, label, color = LIGHT }: KeyHintProps) {
  return (
    <Flex direction="row" alignItems="center" gap={6} height={26}>
      {name === "arrows" && <Flex width={54} height={26} backgroundImage="key-arrows.png" />}
      {name === "updown" && <Flex width={54} height={26} backgroundImage="key-updown.png" />}
      {name !== "arrows" && name !== "updown" && <KeyCap name={name} />}
      <Text color={color}>{label}</Text>
    </Flex>
  );
}

/**
 * A button to tap or click, for what a key does: "Drop", "Skip", "Pause". It is always there, so the game can be played with
 * no keyboard (a phone, or just the mouse); `keyName` draws the key on it as well, which the screens do until the key is learned.
 */
export function TapButton({ label, keyName = "", onPress }: { label: string; keyName?: string; onPress: () => void }) {
  // Every button clicks as it is pressed.
  const playClick = useSound("click.wav");
  const press = () => {
    playClick(CLICK_VOLUME);
    onPress();
  };
  return (
    <Flex direction="row" alignItems="center" gap={6} height={30} paddingX={8} paddingTop={2} backgroundImage={BUTTON_GREY} hoverBackgroundImage={BUTTON} slice={BUTTON_SLICE} focusable={false} onPress={press}>
      {keyName !== "" && <KeyCap name={keyName} />}
      <Text color={INK}>{label}</Text>
    </Flex>
  );
}

/** A key's name on a key cap (the font's capitals are the top 14 pixels of its 20-pixel line, so the name is set 4 down). */
function KeyCap({ name }: { name: string }) {
  return (
    <Flex height={26} minWidth={26} paddingX={8} paddingTop={4} paddingBottom={2} backgroundImage="key.png" sliceTop={4} sliceBottom={8} sliceLeft={4} sliceRight={4} alignItems="center" justifyContent="center">
      <Text color={INK}>{name}</Text>
    </Flex>
  );
}

/**
 * A row of a menu (the title's, the pause menu, the settings): it clicks as it is pressed. `onAdjust` hears left and right while
 * it has the focus, for a settings row; `x` and `opacity` are for a menu's entrance.
 */
export function MenuButton({ label, onPress, onAdjust, autoFocus = false, x = 0, opacity = 1 }: { label: string; onPress: () => void; onAdjust?: (direction: number) => void; autoFocus?: boolean; x?: number; opacity?: number }) {
  const playClick = useSound("click.wav");
  const press = () => {
    playClick(CLICK_VOLUME);
    onPress();
  };
  const adjust = (direction: number) => {
    if (onAdjust === undefined) return;
    playClick(CLICK_VOLUME);
    onAdjust(direction);
  };
  return (
    <Button x={x} opacity={opacity} autoFocus={autoFocus} onPress={press} onAdjust={adjust} height={40} backgroundImage={BUTTON_GREY} focusBackgroundImage={BUTTON} hoverBackgroundImage={BUTTON} slice={BUTTON_SLICE} paddingTop={4} alignItems="center" justifyContent="center">
      <Text color={INK}>{label}</Text>
    </Button>
  );
}
