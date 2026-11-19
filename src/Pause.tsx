import { Button, Flex, Menu, Text } from "@tsengine/runtime/jsx";

import { useGame } from "./GameState.ts";
import { BUTTON, BUTTON_GREY, BUTTON_SLICE, INK, PANEL, PANEL_SLICE, SHADE } from "./theme.ts";

/**
 * The pause menu, over the game. It is `modal`: while it is open only it hears the keys, so Escape here closes the menu
 * (`onBack`) and does not reach the play screen's Escape.
 */
export function Pause() {
  const { resume, toTitle } = useGame.actions();
  return (
    <Flex modal width={640} height={360} background={SHADE} alignItems="center" justifyContent="center">
      <Menu
        gap={8}
        padding={16}
        backgroundImage={PANEL}
        slice={PANEL_SLICE}
        width={256}
        alignItems="stretch"
        onBack={resume}
      >
        <Text color={INK} align="center" width={224}>
          Paused
        </Text>
        <Button autoFocus onPress={resume} height={40} backgroundImage={BUTTON_GREY} focusBackgroundImage={BUTTON} hoverBackgroundImage={BUTTON} slice={BUTTON_SLICE} alignItems="center" justifyContent="center">
          <Text color={INK}>Resume</Text>
        </Button>
        <Button onPress={toTitle} height={40} backgroundImage={BUTTON_GREY} focusBackgroundImage={BUTTON} hoverBackgroundImage={BUTTON} slice={BUTTON_SLICE} alignItems="center" justifyContent="center">
          <Text color={INK}>Quit to title</Text>
        </Button>
      </Menu>
    </Flex>
  );
}
