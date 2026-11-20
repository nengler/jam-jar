import { Button, Entity, Flex, Menu, Text, useInputDevice } from "@tsengine/runtime/jsx";

import { Backdrop } from "./Backdrop.tsx";
import { useGame } from "./GameState.ts";
import { KeyHint } from "./KeyHint.tsx";
import { LESSONS } from "./rules/tutorial.ts";
import { BUTTON, BUTTON_GREY, BUTTON_SLICE, DISPLAY, DISPLAY_SIZE, INK, LIGHT_SOFT, PANEL, PANEL_SLICE } from "./theme.ts";

/** The settings (the music's and the sounds' volume, 0 to 10; 0 is off): left and right change the row with the focus (`onAdjust`), Enter presses it, and Escape goes back (`onBack`). */
export function Settings() {
  const effects = useGame((s) => s.effects);
  const fast = useGame((s) => s.fast);
  const learned = useGame((s) => s.learned);
  // Whether the player is at a keyboard, by what was pressed last (a mouse and a finger are both the pointer): a key is named only then.
  const device = useInputDevice();
  const keys = device === "keyboard";
  const tutorial = useGame((s) => s.tutorial);
  const { changeEffects, changeSpeed, toggleTips, toTitle } = useGame.actions();
  return (
    <Entity>
      <Backdrop />
      <Flex direction="column" width={640} height={320} alignItems="center" justifyContent="center" gap={12}>
        <Menu gap={8} padding={16} paddingTop={10} backgroundImage={PANEL} slice={PANEL_SLICE} alignItems="stretch" width={288} onBack={toTitle}>
          <Flex direction="row" justifyContent="center" height={30}>
            <Text font={DISPLAY} size={DISPLAY_SIZE} color={INK}>
              Settings
            </Text>
          </Flex>
          {/* The music's row is out while there is no music (see Main.tsx). */}
          <Button autoFocus onPress={() => changeEffects(1)} onAdjust={(direction) => changeEffects(direction)} height={40} backgroundImage={BUTTON_GREY} focusBackgroundImage={BUTTON} hoverBackgroundImage={BUTTON} slice={BUTTON_SLICE} paddingTop={4} alignItems="center" justifyContent="center">
            <Text color={INK}>{`Sounds < ${effects} >`}</Text>
          </Button>
          <Button onPress={changeSpeed} onAdjust={() => changeSpeed()} height={40} backgroundImage={BUTTON_GREY} focusBackgroundImage={BUTTON} hoverBackgroundImage={BUTTON} slice={BUTTON_SLICE} paddingTop={4} alignItems="center" justifyContent="center">
            <Text color={INK}>{`Speed < ${fast ? "Fast" : "Normal"} >`}</Text>
          </Button>
          {/* The first game's tutorial: on until its last lesson has been seen; turned on again, it starts over. */}
          <Button onPress={toggleTips} onAdjust={() => toggleTips()} height={40} backgroundImage={BUTTON_GREY} focusBackgroundImage={BUTTON} hoverBackgroundImage={BUTTON} slice={BUTTON_SLICE} paddingTop={4} alignItems="center" justifyContent="center">
            <Text color={INK}>{`Tips < ${tutorial < LESSONS.length ? "On" : "Off"} >`}</Text>
          </Button>
          <Button onPress={toTitle} height={40} backgroundImage={BUTTON_GREY} focusBackgroundImage={BUTTON} hoverBackgroundImage={BUTTON} slice={BUTTON_SLICE} paddingTop={4} alignItems="center" justifyContent="center">
            <Text color={INK}>Back</Text>
          </Button>
        </Menu>
        <Flex direction="row" gap={20} height={26}>
          {keys && !learned.includes("settings") && <KeyHint name="arrows" label="Change" color={LIGHT_SOFT} />}
          {keys && !learned.includes("settings") && <KeyHint name="Esc" label="Back" color={LIGHT_SOFT} />}
        </Flex>
      </Flex>
    </Entity>
  );
}
