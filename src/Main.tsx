import { Game, Screen, useWindowSize } from "@tsengine/runtime/jsx";

import { useGame } from "./GameState.ts";
import { Play } from "./Play.tsx";
import { Rotate } from "./Rotate.tsx";
import { Settings } from "./Settings.tsx";
import { Title } from "./Title.tsx";
import { BODY, BODY_SIZE, SCREEN_H, SCREEN_W, WALL_SHADOW } from "./theme.ts";

/**
 * The root: one screen at a time. While the pause menu is open the world does not step (`paused`), but the menu still works.
 * The game steps 60 times a second whatever the display does (`fixedStep`), so a jar plays out the same on any machine, and slow
 * motion and fast-forward (`timeScale`) run the very same steps slower or faster.
 */
export default function Main() {
  const screen = useGame((s) => s.screen);
  const paused = useGame((s) => s.paused);
  const speed = useGame((s) => s.speed);
  // A window taller than it is wide (a phone held upright) gets the card asking for it to be turned, and the world waits under it.
  const window = useWindowSize();
  const upright = window.height > window.width;
  return (
    <Game id="jam-jar" title="Jam Jar" width={SCREEN_W} height={SCREEN_H} background={WALL_SHADOW} assets="assets" font={BODY} textSize={BODY_SIZE} paused={paused || upright} timeScale={speed} fixedStep={60} upscale="sharp">
      {/* The screen fills the window whatever its size, a phone's included: at a scale that is not a whole number each art pixel is
          still drawn with hard edges (`upscale="sharp"`), only its edge pixels blended, so nothing shimmers or blurs. */}
      <Screen width={SCREEN_W} height={SCREEN_H} fit="contain">
        {/* No music for now: the only tracks on hand are loops of a few seconds, which wear thin at once. `<Music src="theme.ogg"
            fade={1} />` here, outside the screens, plays one on from the title into a run. */}
        {screen === "title" && <Title name="Jam Jar" />}
        {screen === "settings" && <Settings />}
        {screen === "play" && <Play />}
        {upright && <Rotate />}
      </Screen>
    </Game>
  );
}
