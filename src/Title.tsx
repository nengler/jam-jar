import { Button, Entity, Flex, Menu, Text, useInputDevice, useTime } from "@tsengine/runtime/jsx";

import { Backdrop } from "./Backdrop.tsx";
import { DemoJar } from "./DemoJar.tsx";
import { save, useGame } from "./GameState.ts";
import { KeyHint } from "./KeyHint.tsx";
import { ENTER, entered, INTRO, jarDrop, popIn } from "./layout.ts";
import { BUTTON, BUTTON_GREY, BUTTON_SLICE, DISPLAY, DISPLAY_SIZE, GOLD, INK, LIGHT_SOFT } from "./theme.ts";

/** The title's two halves: the name and the menu are centred in the left `MENU_W` pixels, and the jar stands this far right of
 * where the play screen's does, in the middle of what is left. */
const MENU_W = 352;
const JAR_SHIFT = 176;

/** The room the name takes in the column, and when the line under it and the menu start to come in, in seconds. */
const NAME_H = 84;
const MENU_AT = 0.7;
/** How far left of its place a menu button starts. */
const MENU_SLIDE = 280;

/** The title: the name on the kitchen wall and the menu on the left, and on the right a jar filling up as it does in play. */
export function Title({ name }: { name: string }) {
  const learned = useGame((g) => g.learned);
  // Whether the player is at a keyboard, by what was pressed last (a mouse and a finger are both the pointer): a key is named only then.
  const device = useInputDevice();
  const keys = device === "keyboard";
  const hasSave = useGame((g) => g.hasSave);
  const { start, openSettings } = useGame.actions();
  // The title comes in as a run does: the name drops onto the wall and bounces, the jar falls into place, the line under
  // the name appears, and the buttons slide in from the left one after another, each within its own place in the menu.
  const time = useTime();
  return (
    <Entity>
      <Backdrop />
      <DemoJar x={JAR_SHIFT} lift={time < ENTER.jar ? 400 : jarDrop(time - ENTER.jar, 400)} wait={ENTER.jar + INTRO.fall} />
      <Flex direction="column" width={MENU_W} height={324} alignItems="center" justifyContent="center" gap={hasSave ? 6 : 12}>
        {/* The name keeps its room in the column while it falls into it. */}
        <Flex height={NAME_H} direction="row" justifyContent="center">
          <Entity y={-jarDrop(time, 160)}>
            <Text font={DISPLAY} size={DISPLAY_SIZE * 3} color={GOLD} shadow={INK} shadowX={4} shadowY={4}>
              {name}
            </Text>
          </Entity>
        </Flex>
        <Flex opacity={entered(time, 0, MENU_AT)}>
          <Text color={LIGHT_SOFT}>Fill the jar. Make the rent.</Text>
        </Flex>
        <Menu gap={8} alignItems="stretch" width={208} paddingTop={8} paddingBottom={8}>
          {hasSave && (
            <Button x={-MENU_SLIDE * (1 - popIn(time, MENU_AT + 0 * ENTER.gap, ENTER.pop))} opacity={entered(time, 0, MENU_AT)} autoFocus onPress={() => save.load()} height={40} backgroundImage={BUTTON_GREY} focusBackgroundImage={BUTTON} hoverBackgroundImage={BUTTON} slice={BUTTON_SLICE} paddingTop={4} alignItems="center" justifyContent="center">
              <Text color={INK}>Continue</Text>
            </Button>
          )}
          <Button x={-MENU_SLIDE * (1 - popIn(time, MENU_AT + 1 * ENTER.gap, ENTER.pop))} opacity={entered(time, 1, MENU_AT)} autoFocus={!hasSave} onPress={start} height={40} backgroundImage={BUTTON_GREY} focusBackgroundImage={BUTTON} hoverBackgroundImage={BUTTON} slice={BUTTON_SLICE} paddingTop={4} alignItems="center" justifyContent="center">
            <Text color={INK}>{hasSave ? "New run" : "Play"}</Text>
          </Button>
          <Button x={-MENU_SLIDE * (1 - popIn(time, MENU_AT + 2 * ENTER.gap, ENTER.pop))} opacity={entered(time, 2, MENU_AT)} onPress={openSettings} height={40} backgroundImage={BUTTON_GREY} focusBackgroundImage={BUTTON} hoverBackgroundImage={BUTTON} slice={BUTTON_SLICE} paddingTop={4} alignItems="center" justifyContent="center">
            <Text color={INK}>Settings</Text>
          </Button>
        </Menu>
        {/* The keys, for a player at a keyboard, until a button has been pressed once. The row keeps its height after that, so the menu does not move. */}
        <Flex direction="row" gap={20} height={26}>
          {keys && !learned.includes("title") && <KeyHint name="updown" label="Choose" color={LIGHT_SOFT} />}
          {keys && !learned.includes("title") && <KeyHint name="Enter" label="Select" color={LIGHT_SOFT} />}
        </Flex>
      </Flex>
    </Entity>
  );
}
