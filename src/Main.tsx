import { Game, Layer, Route, Router, Screen, Shape, useMutable, useUpdate, useWindowSize } from "@tsengine/runtime/jsx";

import { useGame } from "./GameState.ts";
import { fadeThrough, lampOf, opening, SCREEN_FADE, screenParams } from "./layout.ts";
import { NIGHT } from "./theme.ts";
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
  // And the boss jar's look: how long the play screen has been at this boss jar, and since its gravity last turned over.
  const boss = useGame((s) => s.boss);
  const flipped = useGame((s) => s.flipped);
  const fx = useMutable({ mood: "", time: 0, boss: 0, bossTime: 0, flipped: false, flipTime: 99, up: 0 });
  useUpdate((dt) => {
    // How long the game has been up: its first screen comes out of the dark (`opening`).
    fx.up += dt;
    if (mood !== fx.mood) {
      fx.mood = mood;
      fx.time = 0;
    } else fx.time += dt;
    if (boss !== fx.boss) {
      fx.boss = boss;
      fx.bossTime = 0;
    } else fx.bossTime += dt;
    if (flipped !== fx.flipped) {
      fx.flipped = flipped;
      fx.flipTime = 0;
    } else fx.flipTime += dt;
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
        <Layer shader="screen.glsl" lookup="screen-palette.png" params={screenParams(styled, mood, mood === fx.mood ? fx.time : 0, { boss: fx.boss, bossTime: fx.bossTime, flipped: fx.flipped, flipTime: fx.flipTime }, lampOf(screen))}>
          {/* One screen at a time, and a change of screen fades through the dark. */}
          <Router route={screen} transition={fadeThrough} duration={SCREEN_FADE} coverColor={NIGHT}>
            <Route name="title">
              <Title name="Jam Jar" />
            </Route>
            <Route name="settings">
              <Settings />
            </Route>
            <Route name="play">
              <Play />
            </Route>
          </Router>
          {/* The game opens out of the dark, as a change of screen does: the dark over its first screen, lifting. Only drawn. */}
          {/* Not while the phone is held upright: the world waits then, the clock with it, and the card asking for a turn must show. */}
          {!upright && opening(fx.up) > 0 && <Shape kind="rect" x={0} y={0} width={640} height={360} color={NIGHT} opacity={opening(fx.up)} />}
          {upright && <Rotate />}
        </Layer>
      </Screen>
    </Game>
  );
}
