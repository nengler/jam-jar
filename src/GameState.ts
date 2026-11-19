import { createGameState } from "@tsengine/runtime";

import { effectsLevel, learn, learnedMoments, musicLevel, settings, stepVolume } from "./settings.ts";

type Screen = "title" | "settings" | "play";

/**
 * The game's state, in one place: which screen shows and whether play is paused. A component reads one value with
 * `useGame((s) => s.screen)` and takes the actions it calls with `const { start } = useGame.actions()`. An action is given the state
 * and writes it directly.
 *
 * The volumes, and which moments' keys the player has already been shown, are the player's settings (settings.ts), kept
 * between launches. They are mirrored here, so a screen reads them like any other state. (A component that read `settings`
 * itself with `useStore` would miss the one change that matters most: the engine builds the first screen, then reads the
 * player's files.)
 */
export const useGame = createGameState(
  {
    screen: "title" as Screen,
    paused: false,
    /** The seed of the current run; each new run takes the next one. */
    seed: 1,
    /** The player's settings as the screens show them (settings.ts keeps them): the volumes, 0 to 10, and the moments whose keys
     * have been shown and used once ("title", "order", "pick", "shop", …), whose hints are not drawn again. */
    music: musicLevel(),
    effects: effectsLevel(),
    learned: learnedMoments(),
    /** How fast the game runs: 1, or less for the slow motion a chain of Blasts plays in. */
    speed: 1,
  },
  {
    /** The settings changed, or were read from the player's files: show them. */
    settingsChanged(s) {
      s.music = musicLevel();
      s.effects = effectsLevel();
      s.learned = learnedMoments();
    },
    setSpeed(s, speed: number) {
      s.speed = speed;
    },
    start(s) {
      s.speed = 1;
      learn("title");
      s.screen = "play";
      s.paused = false;
      s.seed += 1;
    },
    openSettings(s) {
      learn("title");
      s.screen = "settings";
    },
    toTitle(s) {
      s.speed = 1;
      if (s.screen === "settings") learn("settings");
      s.screen = "title";
      s.paused = false;
    },
    pause(s) {
      s.paused = true;
    },
    resume(s) {
      s.paused = false;
    },
    /** The settings screen's rows: the volumes are the player's settings (settings.ts), kept between launches. */
    changeMusic(_s, by: number) {
      stepVolume("music", by);
    },
    changeEffects(_s, by: number) {
      stepVolume("effects", by);
    },
  }
);

// Each change to the settings, and their first reading from the player's files, is shown at once.
settings.subscribe(() => useGame.actions().settingsChanged());
