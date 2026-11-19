import { Game, Music, Screen } from "@tsengine/runtime/jsx";

import { useGame } from "./GameState.ts";
import { Play } from "./Play.tsx";
import { Settings } from "./Settings.tsx";
import { Title } from "./Title.tsx";

/**
 * The game steps 60 times a second whatever the display does (`fixedStep`), so a jar plays out the same on any machine, slow
 * motion and fast-forward (`timeScale`) run the very same steps slower or faster, and drawing is smoothed between steps.
 */
/** The root: one screen at a time, and the music over all of them. While the pause menu is open the world does not step (`paused`), but the menu still works. */
export default function Main() {
  const screen = useGame((s) => s.screen);
  const paused = useGame((s) => s.paused);
  const speed = useGame((s) => s.speed);
  return (
    <Game id="jam-jar" title="Jam Jar" width={640} height={360} background="#10141f" assets="assets" font="tse:m5x7" textSize={20} paused={paused} timeScale={speed} fixedStep={60}>
      <Screen width={640} height={360} fit="integer">
        {/* Here, not in a screen, so it plays on from the title into a run. How loud is the player's music setting, which the engine applies. */}
        <Music src="theme.ogg" fade={1} />
        {screen === "title" && <Title name="Jam Jar" />}
        {screen === "settings" && <Settings />}
        {screen === "play" && <Play />}
      </Screen>
    </Game>
  );
}
