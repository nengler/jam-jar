import { Button, Entity, Flex, Menu, Text } from "@tsengine/runtime/jsx";

import { Backdrop } from "./Backdrop.tsx";
import { useGame } from "./GameState.ts";
import { Heading } from "./Board.tsx";
import { KeyHint } from "./KeyHint.tsx";
import { BUTTON, BUTTON_GREY, BUTTON_SLICE, INK, LIGHT_SOFT, PANEL, PANEL_SLICE } from "./theme.ts";

/** The settings: left and right change the row with the focus (`onAdjust`), Enter presses it, and Escape goes back (`onBack`). */
export function Settings() {
  const volume = useGame((s) => s.volume);
  const music = useGame((s) => s.music);
  const { changeVolume, toggleMusic, toTitle } = useGame.actions();
  return (
    <Entity>
      <Backdrop />
      <Flex direction="column" width={640} height={320} alignItems="center" justifyContent="center" gap={12}>
        <Menu gap={8} padding={16} paddingTop={28} backgroundImage={PANEL} slice={PANEL_SLICE} alignItems="stretch" width={288} onBack={toTitle}>
          <Button autoFocus onPress={() => changeVolume(1)} onAdjust={(direction) => changeVolume(direction)} height={40} backgroundImage={BUTTON_GREY} focusBackgroundImage={BUTTON} hoverBackgroundImage={BUTTON} slice={BUTTON_SLICE} paddingTop={4} alignItems="center" justifyContent="center">
            <Text color={INK}>{`Volume < ${volume} >`}</Text>
          </Button>
          <Button onPress={toggleMusic} onAdjust={() => toggleMusic()} height={40} backgroundImage={BUTTON_GREY} focusBackgroundImage={BUTTON} hoverBackgroundImage={BUTTON} slice={BUTTON_SLICE} paddingTop={4} alignItems="center" justifyContent="center">
            <Text color={INK}>{`Music ${music ? "on" : "off"}`}</Text>
          </Button>
          <Button onPress={toTitle} height={40} backgroundImage={BUTTON_GREY} focusBackgroundImage={BUTTON} hoverBackgroundImage={BUTTON} slice={BUTTON_SLICE} paddingTop={4} alignItems="center" justifyContent="center">
            <Text color={INK}>Back</Text>
          </Button>
        </Menu>
        <Flex direction="row" gap={20}>
          <KeyHint name="arrows" label="Change" color={LIGHT_SOFT} />
          <KeyHint name="Esc" label="Back" color={LIGHT_SOFT} />
        </Flex>
      </Flex>
      <Heading x={320} y={44} width={280} text="Settings" />
    </Entity>
  );
}
