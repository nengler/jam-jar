import { createGameState } from "@tsengine/runtime";

type Screen = "title" | "settings" | "play";

/**
 * The game's state, in one place: which screen shows, whether play is paused, and the settings. A component reads one value with
 * `useGame((s) => s.screen)` and takes the actions it calls with `const { start } = useGame.actions()`. An action is given the state
 * and writes it directly.
 *
 * The keys for a moment (ordering a hand, the pick, the shop, …) are shown the first time it comes up and not again: `learned`
 * lists the moments the player has been through. The pause menu always shows them.
 */
export const useGame = createGameState(
  {
    screen: "title" as Screen,
    paused: false,
    /** The volume, 0 to 10. */
    volume: 8,
    music: true,
    /** The seed of the current run; each new run takes the next one. */
    seed: 1,
    /** How fast the game runs: 1, or less for the slow motion a chain of Blasts plays in. */
    speed: 1,
    /** The moments whose keys have been shown and used once ("title", "order", "pick", "shop", …): their hints are not drawn again. */
    learned: [] as string[],
  },
  {
    setSpeed(s, speed: number) {
      s.speed = speed;
    },
    /** The player has got through this moment once, so they know its keys. */
    learn(s, moment: string) {
      if (moment !== "" && !s.learned.includes(moment)) s.learned = [...s.learned, moment];
    },
    start(s) {
      s.speed = 1;
      if (!s.learned.includes("title")) s.learned = [...s.learned, "title"];
      s.screen = "play";
      s.paused = false;
      s.seed += 1;
    },
    openSettings(s) {
      if (!s.learned.includes("title")) s.learned = [...s.learned, "title"];
      s.screen = "settings";
    },
    toTitle(s) {
      s.speed = 1;
      if (s.screen === "settings" && !s.learned.includes("settings")) s.learned = [...s.learned, "settings"];
      s.screen = "title";
      s.paused = false;
    },
    pause(s) {
      s.paused = true;
    },
    resume(s) {
      s.paused = false;
    },
    changeVolume(s, by: number) {
      s.volume = Math.min(10, Math.max(0, s.volume + by));
    },
    toggleMusic(s) {
      s.music = !s.music;
    },
  }
);
