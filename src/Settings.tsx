import { Button, Entity, Flex, Menu, Text } from "@tsengine/runtime/jsx";

import { Backdrop } from "./Backdrop.tsx";
import { useGame } from "./GameState.ts";
import { BUTTON, BUTTON_GREY, BUTTON_SLICE, GOLD, INK, PANEL, PANEL_SLICE } from "./theme.ts";

/** The settings: left and right change the row with the focus (`onAdjust`), Enter presses it, and Escape goes back (`onBack`). */
export function Settings() {
  const volume = useGame((s) => s.volume);
  const music = useGame((s) => s.music);
  const { changeVolume, toggleMusic, toTitle } = useGame.actions();
  return (
    <Entity>
      <Backdrop />
      <Flex direction="column" width={640} height={360} alignItems="center" justifyContent="center" gap={16}>
        <Text color={GOLD} shadow={INK} shadowX={2} shadowY={2}>
          Settings
        </Text>
        <Menu gap={8} padding={16} backgroundImage={PANEL} slice={PANEL_SLICE} alignItems="stretch" width={288} onBack={toTitle}>
          <Button autoFocus onPress={() => changeVolume(1)} onAdjust={(direction) => changeVolume(direction)} height={40} backgroundImage={BUTTON_GREY} focusBackgroundImage={BUTTON} hoverBackgroundImage={BUTTON} slice={BUTTON_SLICE} alignItems="center" justifyContent="center">
            <Text color={INK}>{`Volume < ${volume} >`}</Text>
          </Button>
          <Button onPress={toggleMusic} onAdjust={() => toggleMusic()} height={40} backgroundImage={BUTTON_GREY} focusBackgroundImage={BUTTON} hoverBackgroundImage={BUTTON} slice={BUTTON_SLICE} alignItems="center" justifyContent="center">
            <Text color={INK}>{`Music ${music ? "on" : "off"}`}</Text>
          </Button>
          <Button onPress={toTitle} height={40} backgroundImage={BUTTON_GREY} focusBackgroundImage={BUTTON} hoverBackgroundImage={BUTTON} slice={BUTTON_SLICE} alignItems="center" justifyContent="center">
            <Text color={INK}>Back</Text>
          </Button>
        </Menu>
      </Flex>
    </Entity>
  );
}
