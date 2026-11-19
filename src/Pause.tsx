import { Button, Entity, Flex, Menu, Text } from "@tsengine/runtime/jsx";

import { Heading } from "./Board.tsx";
import { KeyHint } from "./KeyHint.tsx";
import { useGame } from "./GameState.ts";
import { BUTTON, BUTTON_GREY, BUTTON_SLICE, INK, PANEL, PANEL_SLICE, SHADE } from "./theme.ts";

/**
 * The pause menu, over the game, set a little above the middle so the keys under it stay clear of the foot of the screen. It is `modal`: while it is open only it hears the keys, so Escape here closes the menu
 * (`onBack`) and does not reach the play screen's Escape.
 */
export function Pause() {
  const { resume, toTitle } = useGame.actions();
  return (
    <Entity>
      <Flex modal width={640} height={360} paddingBottom={56} background={SHADE} alignItems="center" justifyContent="center">
        <Menu
          gap={8}
          padding={16}
          paddingTop={28}
          backgroundImage={PANEL}
          slice={PANEL_SLICE}
          width={256}
          alignItems="stretch"
          onBack={resume}
        >
          <Button autoFocus onPress={resume} height={40} backgroundImage={BUTTON_GREY} focusBackgroundImage={BUTTON} hoverBackgroundImage={BUTTON} slice={BUTTON_SLICE} paddingTop={4} alignItems="center" justifyContent="center">
            <Text color={INK}>Resume</Text>
          </Button>
          <Button onPress={toTitle} height={40} backgroundImage={BUTTON_GREY} focusBackgroundImage={BUTTON} hoverBackgroundImage={BUTTON} slice={BUTTON_SLICE} paddingTop={4} alignItems="center" justifyContent="center">
            <Text color={INK}>Quit to title</Text>
          </Button>
        </Menu>
      </Flex>
      <Heading x={320} y={72} width={248} text="Paused" />
      {/* The keys, always here: the play screen shows each moment's only the first time. */}
      <Flex x={224} y={226} direction="column" gap={0}>
        <KeyHint name="arrows" label="Choose" />
        <KeyHint name="Enter" label="Take or buy" />
        <KeyHint name="Space" label="Drop or skip" />
        <KeyHint name="F" label="Hold to hurry" />
      </Flex>
    </Entity>
  );
}
