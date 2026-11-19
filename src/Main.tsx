import { Game, Music, Screen } from "@tsengine/runtime/jsx";

import { useGame } from "./GameState.ts";
import { Play } from "./Play.tsx";
import { Settings } from "./Settings.tsx";
import { Title } from "./Title.tsx";

/** The root: one screen at a time, and the music over all of them. While the pause menu is open the world does not step (`paused`), but the menu still works. */
export default function Main() {
  const screen = useGame((s) => s.screen);
  const paused = useGame((s) => s.paused);
  const volume = useGame((s) => s.volume);
  const speed = useGame((s) => s.speed);
  const music = useGame((s) => s.music);
  return (
    <Game title="Jam Jar" width={640} height={360} background="#10141f" assets="assets" font="tse:m5x7" textSize={20} paused={paused} timeScale={speed}>
      <Screen width={640} height={360} fit="integer">
        {/* Here, not in a screen, so it plays on from the title into a run. Quieter than the sounds, and with the volume setting. */}
        <Music src="theme.ogg" playing={music} volume={(0.4 * volume) / 10} fade={1} />
        {screen === "title" && <Title name="Jam Jar" />}
        {screen === "settings" && <Settings />}
        {screen === "play" && <Play />}
      </Screen>
    </Game>
  );
}
