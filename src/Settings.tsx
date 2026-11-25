import { Entity, Flex, Menu, Text, useInputDevice } from "@tsengine/runtime/jsx";

import { Backdrop } from "./Backdrop.tsx";
import { Grain } from "./Board.tsx";
import { PushButton } from "./PushButton.tsx";
import { useGame } from "./GameState.ts";
import { KeyHint } from "./KeyHint.tsx";
import { LESSONS } from "./rules/tutorial.ts";
import { DISPLAY, DISPLAY_SIZE, INK, LIGHT_SOFT, PANEL, PANEL_SLICE } from "./theme.ts";

/** The settings (the music's and the sounds' volume, 0 to 10; 0 is off): left and right change the row with the focus (`onAdjust`), Enter presses it, and Escape goes back (`onBack`). */
export function Settings() {
  const effects = useGame((s) => s.effects);
  const fast = useGame((s) => s.fast);
  const styled = useGame((s) => s.styled);
  const learned = useGame((s) => s.learned);
  // Whether the player is at a keyboard, by what was pressed last (a mouse and a finger are both the pointer): a key is named only then.
  const device = useInputDevice();
  const keys = device === "keyboard";
  const tutorial = useGame((s) => s.tutorial);
  const { changeEffects, changeSpeed, changeStyled, toggleTips, toTitle } = useGame.actions();
  return (
    <Entity>
      <Backdrop />
      <Flex direction="column" width={640} height={320} alignItems="center" justifyContent="center" gap={12}>
        <Menu gap={8} padding={16} paddingTop={10} backgroundImage={PANEL} slice={PANEL_SLICE} alignItems="stretch" width={288} onBack={toTitle}>
          <Grain seed={4} />
          <Flex direction="row" justifyContent="center" height={30}>
            <Text font={DISPLAY} size={DISPLAY_SIZE} color={INK}>
              Settings
            </Text>
          </Flex>
          {/* The music's row is out while there is no music (see Main.tsx). */}
          <PushButton focusable autoFocus onPress={() => changeEffects(1)} onAdjust={changeEffects} height={40} label={`Sounds < ${effects} >`} />
          <PushButton focusable onPress={changeSpeed} onAdjust={changeSpeed} height={40} label={`Speed < ${fast ? "Fast" : "Normal"} >`} />
          {/* The whole screen's shader (assets/screen.glsl): the dark corners, the palette's dither, and what the run does to it. */}
          <PushButton focusable onPress={changeStyled} onAdjust={changeStyled} height={40} label={`Screen < ${styled ? "Styled" : "Plain"} >`} />
          {/* The first game's tutorial: on until its last lesson has been seen; turned on again, it starts over. */}
          <PushButton focusable onPress={toggleTips} onAdjust={toggleTips} height={40} label={`Tips < ${tutorial < LESSONS.length ? "On" : "Off"} >`} />
          <PushButton focusable onPress={toTitle} height={40} label="Back" />
        </Menu>
        <Flex direction="row" gap={20} height={26}>
          {keys && !learned.includes("settings") && <KeyHint name="arrows" label="Change" color={LIGHT_SOFT} />}
          {keys && !learned.includes("settings") && <KeyHint name="Esc" label="Back" color={LIGHT_SOFT} />}
        </Flex>
      </Flex>
    </Entity>
  );
}
