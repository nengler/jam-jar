import { Game, Layer, Screen, useMutable, useUpdate, useWindowSize } from "@tsengine/runtime/jsx";

import { useGame } from "./GameState.ts";
import { screenParams } from "./layout.ts";
import { Play } from "./Play.tsx";
import { Rotate } from "./Rotate.tsx";
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
  // A tutorial lesson that came up while the jar plays holds it still until it is put away (rules/tutorial.ts, `holds`).
  const held = useGame((s) => s.screen === "play" && s.holding >= 0 && s.holding === s.tutorial);
  // A window taller than it is wide (a phone held upright) gets the card asking for it to be turned, and the world waits under it.
  const window = useWindowSize();
  // The whole screen is drawn through one shader (assets/screen.glsl), which the run's mood plays on: how long the mood has lasted.
  const styled = useGame((s) => s.styled);
  const mood = useGame((s) => s.mood);
  const fx = useMutable({ mood: "", time: 0 });
  useUpdate((dt) => {
    if (mood !== fx.mood) {
      fx.mood = mood;
      fx.time = 0;
    } else fx.time += dt;
  });
  const upright = window.height > window.width;
  return (
    <Game id="jam-jar" title="Jam Jar" width={640} height={360} background="#10141f" assets="assets" font="tse:m5x7" textSize={20} paused={paused || upright || held} timeScale={speed} fixedStep={60} upscale="sharp">
      {/* The screen fills the window whatever its size, a phone's included: at a scale that is not a whole number each art pixel is
          still drawn with hard edges (`upscale="sharp"`), only its edge pixels blended, so nothing shimmers or blurs. */}
      <Screen width={640} height={360} fit="contain">
        {/* No music for now: the only tracks on hand are loops of a few seconds, which wear thin at once. `<Music src="theme.ogg"
            fade={1} />` here, outside the screens, plays one on from the title into a run. */}
        {/* Everything is in one layer, drawn through the screen's shader; where shaders do not run it is drawn as it is. */}
        <Layer shader="screen.glsl" params={screenParams(styled, mood, mood === fx.mood ? fx.time : 0)}>
          {screen === "title" && <Title name="Jam Jar" />}
          {screen === "settings" && <Settings />}
          {screen === "play" && <Play />}
          {upright && <Rotate />}
        </Layer>
      </Screen>
    </Game>
  );
}
