import { Game, Screen, useUpdate } from "@tsengine/runtime/jsx";

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
  const keys = useGame((s) => s.keys);
  const { usedKeys } = useGame.actions();
  // Which the player is using, the keyboard or the pointer (a mouse or a finger): whatever was pressed last. The screens word
  // their prompts by it.
  useUpdate((dt, input) => {
    const last = input.lastPressed();
    if (last === undefined) return;
    const key = !last.startsWith("Mouse");
    if (key !== keys) usedKeys(key);
  });
  return (
    <Game id="jam-jar" title="Jam Jar" width={640} height={360} background="#10141f" assets="assets" font="tse:m5x7" textSize={20} paused={paused} timeScale={speed} fixedStep={60} upscale="sharp">
      {/* The screen fills the window whatever its size, a phone's included: at a scale that is not a whole number each art pixel is
          still drawn with hard edges (`upscale="sharp"`), only its edge pixels blended, so nothing shimmers or blurs. */}
      <Screen width={640} height={360} fit="contain">
        {/* No music for now: the only tracks on hand are loops of a few seconds, which wear thin at once. `<Music src="theme.ogg"
            fade={1} />` here, outside the screens, plays one on from the title into a run. */}
        {screen === "title" && <Title name="Jam Jar" />}
        {screen === "settings" && <Settings />}
        {screen === "play" && <Play />}
      </Screen>
    </Game>
  );
}
