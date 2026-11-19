import { Button, Entity, Flex, Menu, Text } from "@tsengine/runtime/jsx";

import { Backdrop } from "./Backdrop.tsx";
import { useGame } from "./GameState.ts";
import { Heading } from "./Board.tsx";
import { KeyHint } from "./KeyHint.tsx";
import { BUTTON, BUTTON_GREY, BUTTON_SLICE, INK, LIGHT_SOFT, PANEL, PANEL_SLICE } from "./theme.ts";

/** The settings (the music's and the sounds' volume, 0 to 10; 0 is off): left and right change the row with the focus (`onAdjust`), Enter presses it, and Escape goes back (`onBack`). */
export function Settings() {
  const music = useGame((s) => s.music);
  const effects = useGame((s) => s.effects);
  const learned = useGame((s) => s.learned);
  const { changeMusic, changeEffects, toTitle } = useGame.actions();
  return (
    <Entity>
      <Backdrop />
      <Flex direction="column" width={640} height={320} alignItems="center" justifyContent="center" gap={12}>
        <Menu gap={8} padding={16} paddingTop={28} backgroundImage={PANEL} slice={PANEL_SLICE} alignItems="stretch" width={288} onBack={toTitle}>
          <Button autoFocus onPress={() => changeMusic(1)} onAdjust={(direction) => changeMusic(direction)} height={40} backgroundImage={BUTTON_GREY} focusBackgroundImage={BUTTON} hoverBackgroundImage={BUTTON} slice={BUTTON_SLICE} paddingTop={4} alignItems="center" justifyContent="center">
            <Text color={INK}>{`Music < ${music} >`}</Text>
          </Button>
          <Button onPress={() => changeEffects(1)} onAdjust={(direction) => changeEffects(direction)} height={40} backgroundImage={BUTTON_GREY} focusBackgroundImage={BUTTON} hoverBackgroundImage={BUTTON} slice={BUTTON_SLICE} paddingTop={4} alignItems="center" justifyContent="center">
            <Text color={INK}>{`Sounds < ${effects} >`}</Text>
          </Button>
          <Button onPress={toTitle} height={40} backgroundImage={BUTTON_GREY} focusBackgroundImage={BUTTON} hoverBackgroundImage={BUTTON} slice={BUTTON_SLICE} paddingTop={4} alignItems="center" justifyContent="center">
            <Text color={INK}>Back</Text>
          </Button>
        </Menu>
        <Flex direction="row" gap={20} height={26}>
          {!learned.includes("settings") && <KeyHint name="arrows" label="Change" color={LIGHT_SOFT} />}
          {!learned.includes("settings") && <KeyHint name="Esc" label="Back" color={LIGHT_SOFT} />}
        </Flex>
      </Flex>
      <Heading x={320} y={44} width={280} text="Settings" />
    </Entity>
  );
}
