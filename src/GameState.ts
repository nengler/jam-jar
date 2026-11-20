import { createGameState, createSave } from "@tsengine/runtime";

import type { Run } from "./rules/jar.ts";
import { effectsLevel, fastPlay, learn, learnedMoments, settings, setTutorialStep, stepVolume, toggleFast, tutorialStep } from "./settings.ts";
import { LESSONS } from "./rules/tutorial.ts";

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
    /** A run read from the player's files, for the play screen to go on with instead of starting one; null for a new run. */
    savedRun: null as Run | null,
    /** Whether there is a run to continue: the title shows "Continue". */
    hasSave: false,
    /** The player's settings as the screens show them (settings.ts keeps them): the sounds' volume, 0 to 10, the speed, and the moments whose keys
     * have been shown and used once ("title", "order", "pick", "shop", …), whose hints are not drawn again. */
    effects: effectsLevel(),
    fast: fastPlay(),
    learned: learnedMoments(),
    /** The step of the first game's tutorial the player is at (rules/tutorial.ts); past the last lesson once it is over. */
    tutorial: tutorialStep(),
    /** How fast the game runs: 1, or less for the slow motion a chain of Blasts plays in. */
    speed: 1,
  },
  {
    /** The settings changed, or were read from the player's files: show them. */
    settingsChanged(s) {
      s.effects = effectsLevel();
      s.fast = fastPlay();
      s.learned = learnedMoments();
      s.tutorial = tutorialStep();
      // The settings are read when the player's files become readable, which is also the first moment a save can be seen.
      s.hasSave = save.exists();
    },
    /** A run was kept, or the kept one thrown away. */
    saveChanged(s) {
      s.hasSave = save.exists();
    },
    /** Go on with a run read from the player's files. */
    continueRun(s, run: Run) {
      s.savedRun = run;
      s.speed = 1;
      s.screen = "play";
      s.paused = false;
    },
    setSpeed(s, speed: number) {
      s.speed = speed;
    },
    start(s) {
      s.speed = 1;
      learn("title");
      s.savedRun = null;
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
    /** The settings screen's rows, kept between launches (settings.ts). */
    changeEffects(_s, by: number) {
      stepVolume("effects", by);
    },
    changeSpeed() {
      toggleFast();
    },
    /** The tutorial moves to a step: the next lesson, or past the last to end it. */
    toLesson(_s, step: number) {
      setTutorialStep(step);
    },
    /** The settings' Tips row: off ends the tutorial, on starts it again from the first lesson. */
    toggleTips(s) {
      setTutorialStep(s.tutorial >= LESSONS.length ? 0 : LESSONS.length);
    },
  }
);

/** The run as it was last kept, for the save to write. */
let kept: Run | null = null;

/**
 * The run in progress, kept between launches: the title's "Continue" goes on with it. It is written each time the run comes to
 * rest at a point the player acts from (a hand to order, the pick, the rent, the shop, the Preserves Jar) and thrown away when
 * the run ends. Raise `version` when `Run` changes shape: an older save is then ignored, not misread.
 */
export const save = createSave<Run>({
  name: "run",
  version: 8,
  pick: () => kept as Run,
  apply: (run) => {
    if (typeof run?.phase === "string" && Array.isArray(run.fruits) && Array.isArray(run.pool)) useGame.actions().continueRun(run);
  },
});

/**
 * Keep the run, at rest. Each fruit will start where it now lies (its ball is made at `x0`, `y0`), and what was only passing
 * (popups, lines, blasts, sounds) is left out.
 */
export function keepRun(run: Run): void {
  kept = {
    ...run,
    fruits: run.fruits.map((f) => ({ ...f, x0: f.x, y0: f.y, pulse: 0, pulseDelay: 0, kicks: 0 })),
    popups: [],
    links: [],
    effects: [],
    sounds: [],
  };
  save.write();
  useGame.actions().saveChanged();
}

/** The run is over: there is nothing to continue. */
export function dropRun(): void {
  kept = null;
  save.remove();
  useGame.actions().saveChanged();
}

// Each change to the settings, and their first reading from the player's files, is shown at once.
settings.subscribe(() => useGame.actions().settingsChanged());
