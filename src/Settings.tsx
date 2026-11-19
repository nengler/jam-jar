import { Button, Entity, Flex, Menu, Sprite, Text } from "@tsengine/runtime/jsx";

import { useGame } from "./GameState.ts";
import { BUTTON, BUTTON_GREY, BUTTON_SLICE, GOLD, INK, PANEL, PANEL_SLICE, SHADOW } from "./theme.ts";

/** The settings: left and right change the row with the focus (`onAdjust`), Enter presses it, and Escape goes back (`onBack`). */
export function Settings() {
  const volume = useGame((s) => s.volume);
  const music = useGame((s) => s.music);
  const { changeVolume, toggleMusic, toTitle } = useGame.actions();
  return (
    <Entity>
      <Sprite image="background.png" />
      <Flex direction="column" width={640} height={360} alignItems="center" justifyContent="center" gap={16}>
        <Text size={32} color={GOLD} shadow={SHADOW} shadowX={2} shadowY={2}>
          Settings
        </Text>
        <Menu gap={10} padding={20} backgroundImage={PANEL} slice={PANEL_SLICE} alignItems="stretch" width={300} onBack={toTitle}>
          <Button autoFocus onPress={() => changeVolume(1)} onAdjust={(direction) => changeVolume(direction)} height={44} backgroundImage={BUTTON_GREY} focusBackgroundImage={BUTTON} hoverBackgroundImage={BUTTON} slice={BUTTON_SLICE} alignItems="center" justifyContent="center">
            <Text color={INK}>{`Volume  < ${volume} >`}</Text>
          </Button>
          <Button onPress={toggleMusic} onAdjust={() => toggleMusic()} height={44} backgroundImage={BUTTON_GREY} focusBackgroundImage={BUTTON} hoverBackgroundImage={BUTTON} slice={BUTTON_SLICE} alignItems="center" justifyContent="center">
            <Text color={INK}>{`Music  ${music ? "on" : "off"}`}</Text>
          </Button>
          <Button onPress={toTitle} height={44} backgroundImage={BUTTON_GREY} focusBackgroundImage={BUTTON} hoverBackgroundImage={BUTTON} slice={BUTTON_SLICE} alignItems="center" justifyContent="center">
            <Text color={INK}>Back</Text>
          </Button>
        </Menu>
      </Flex>
    </Entity>
  );
}
