import { Entity, Flex, Menu, useInputDevice } from "@tsengine/runtime/jsx";

import { KeyHint } from "./KeyHint.tsx";
import { PushButton } from "./PushButton.tsx";
import { useGame } from "./GameState.ts";
import { Dialog } from "./Board.tsx";
import { SHADE } from "./theme.ts";

/**
 * The pause menu, over the game, set a little above the middle so the keys under it stay clear of the foot of the screen. It is `modal`: while it is open only it hears the keys, so Escape here closes the menu
 * (`onBack`) and does not reach the play screen's Escape.
 */
export function Pause() {
  // Whether the player is at a keyboard, by what was pressed last (a mouse and a finger are both the pointer): a key is named only then.
  const device = useInputDevice();
  const keys = device === "keyboard";
  const { resume, toTitle } = useGame.actions();
  return (
    <Entity>
      <Flex modal width={640} height={360} paddingBottom={56} background={SHADE} alignItems="center" justifyContent="center">
        <Flex width={256} direction="column" alignItems="stretch">
          <Dialog title="Paused">
            <Menu gap={8} alignItems="stretch" onBack={resume}>
              <PushButton focusable autoFocus onPress={resume} height={40} label="Resume" />
              <PushButton focusable onPress={toTitle} height={40} label="Quit to title" />
            </Menu>
          </Dialog>
        </Flex>
      </Flex>
      {/* The keys, for a player at a keyboard: always here, as the play screen shows each moment's only the first time. */}
      {keys && (
        <Flex x={224} y={226} direction="column" gap={0}>
          <KeyHint name="arrows" label="Choose" />
          <KeyHint name="Enter" label="Take or buy" />
          <KeyHint name="Space" label="Drop or skip" />
          <KeyHint name="F" label="Hold to hurry" />
        </Flex>
      )}
    </Entity>
  );
}
