import { Entity, Flex, Menu, useInputDevice } from "@tsengine/runtime/jsx";

import { KeyHint } from "./KeyHint.tsx";
import { PushButton } from "./PushButton.tsx";
import { useGame } from "./GameState.ts";
import { Dialog, Rule } from "./Board.tsx";
import { INK, SHADE } from "./theme.ts";

/** The room each key of the list takes: as wide as the widest (Space, Enter). */
const KEY_W = 72;

/**
 * The pause menu, over the game, set a little above the middle, with the keys listed on it. It is `modal`: while it is open only it hears the keys, so Escape here closes the menu
 * (`onBack`) and does not reach the play screen's Escape.
 */
export function Pause() {
  // Whether the player is at a keyboard, by what was pressed last (a mouse and a finger are both the pointer): a key is named only then.
  const device = useInputDevice();
  const keys = device === "keyboard";
  const { resume, toTitle } = useGame.actions();
  return (
    <Entity>
      <Flex modal width={640} height={360} paddingBottom={24} background={SHADE} alignItems="center" justifyContent="center">
        <Flex width={256} direction="column" alignItems="stretch">
          <Dialog title="Paused" still>
            <Menu gap={8} alignItems="stretch" onBack={resume}>
              <PushButton focusable autoFocus onPress={resume} height={40} label="Resume" />
              <PushButton focusable onPress={toTitle} height={40} label="Quit to title" />
            </Menu>
            {/* The keys, for a player at a keyboard: always here, as the play screen shows each moment's only the first time. On
                the board, under a rule, each key in a column as wide as the widest, so what they do reads down one line. */}
            {keys && <Rule />}
            {keys && (
              <Flex direction="column" gap={0}>
                <KeyHint name="arrows" label="Choose" color={INK} keyWidth={KEY_W} />
                <KeyHint name="Enter" label="Take or buy" color={INK} keyWidth={KEY_W} />
                <KeyHint name="Space" label="Drop or skip" color={INK} keyWidth={KEY_W} />
                <KeyHint name="F" label="Hold to hurry" color={INK} keyWidth={KEY_W} />
              </Flex>
            )}
          </Dialog>
        </Flex>
      </Flex>
    </Entity>
  );
}
