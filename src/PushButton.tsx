import { Flex, Text, useInput, useMutable, useSound, type Child } from "@tsengine/runtime/jsx";

import { BUTTON, BUTTON_DOWN, BUTTON_LIT, CLICK_VOLUME, INK } from "./theme.ts";

/** How many steps a button stays pushed in after a press (a tenth of a second at 60 a second), or for as long as the mouse is held on it. */
const DOWN_STEPS = 6;
/** How far the face sinks when pushed in: two art pixels, as the lip under it goes from three deep to one. */
const SINK = 4;
/** The picture's edges (button.png, from tools/make-assets.py): the outline and lit edge above the face, and the lip and outline under it. */
const EDGE_TOP = 4;
const EDGE_BOTTOM = 8;
const EDGE_SIDE = 4;

interface PushButtonProps {
  onPress: () => void;
  /** Left or right while it has the focus, for a settings row (`focusable` only). It clicks as a press does. */
  onAdjust?: (direction: number) => void;
  /** Its words, in ink, set so the capitals sit in the middle of the face. Or give `children` for anything else. */
  label?: string;
  children?: Child;
  /** A menu item takes the focus (and the arrows move it between them); a button on the play screen does not, so the keys stay the screen's. */
  focusable?: boolean;
  autoFocus?: boolean;
  /** A key that presses it, wherever the focus is (the pause button's Escape): it clicks and pushes in as a tap does. */
  pressKey?: string;
  width?: number | "fit";
  height?: number;
  paddingX?: number;
  x?: number;
  opacity?: number;
}

/**
 * Every button in the game: a chunky key cap like the pause button, parchment with an ink outline and a deep lip, amber while the
 * mouse is over it or it has the focus. Pressed (a click, a tap or Enter), it clicks and pushes in, the face sinking onto a shallow
 * lip with what is on it, and comes back up a moment later or when the mouse is let go.
 */
export function PushButton({ onPress, onAdjust, label, children, focusable = false, autoFocus = false, pressKey, width = "fit", height = 30, paddingX = 8, x = 0, opacity = 1 }: PushButtonProps) {
  const playClick = useSound("click.wav");
  const s = useMutable({ down: 0 });
  // Steps count while the world is paused as well (the pause menu's buttons), so this is `useInput`, not `useUpdate`.
  useInput((input) => {
    if (s.down > 0 && !input.down("MouseLeft")) s.down -= 1;
  });
  const press = () => {
    playClick(CLICK_VOLUME);
    s.down = DOWN_STEPS;
    onPress();
  };
  const adjust = (direction: number) => {
    playClick(CLICK_VOLUME);
    s.down = DOWN_STEPS;
    onAdjust?.(direction);
  };
  const down = s.down > 0;
  return (
    <Flex
      x={x}
      opacity={opacity}
      width={width}
      height={height}
      direction="row"
      alignItems="center"
      justifyContent="center"
      paddingLeft={EDGE_SIDE + paddingX}
      paddingRight={EDGE_SIDE + paddingX}
      paddingTop={down ? EDGE_TOP + SINK : EDGE_TOP}
      paddingBottom={down ? EDGE_BOTTOM - SINK : EDGE_BOTTOM}
      backgroundImage={down ? BUTTON_DOWN : BUTTON}
      hoverBackgroundImage={down ? undefined : BUTTON_LIT}
      focusBackgroundImage={down ? undefined : BUTTON_LIT}
      sliceTop={EDGE_BOTTOM}
      sliceBottom={EDGE_BOTTOM}
      sliceLeft={EDGE_SIDE}
      sliceRight={EDGE_SIDE}
      focusable={focusable}
      autoFocus={autoFocus}
      pressKey={pressKey}
      onPress={press}
      onAdjust={onAdjust === undefined ? undefined : adjust}
    >
      {/* The font's capitals are the top 14 pixels of its 20-pixel line: a box that tall, with the line hanging out under it, centres them. */}
      {label !== undefined && (
        <Flex height={14}>
          <Text color={INK}>{label}</Text>
        </Flex>
      )}
      {children}
    </Flex>
  );
}
