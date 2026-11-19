import { Game, Screen } from "@tsengine/runtime/jsx";

import { useGame } from "./GameState.ts";
import { Play } from "./Play.tsx";
import { Settings } from "./Settings.tsx";
import { Title } from "./Title.tsx";

/** The root: one screen at a time. While the pause menu is open the world does not step (`paused`), but the menu still works. */
export default function Main() {
  const screen = useGame((s) => s.screen);
  const paused = useGame((s) => s.paused);
  return (
    <Game title="Jam Jar" width={640} height={360} background="#172038" assets="assets" font="font.png" textSize={16} paused={paused}>
      <Screen width={640} height={360} fit="integer">
        {screen === "title" && <Title name="Jam Jar" />}
        {screen === "settings" && <Settings />}
        {screen === "play" && <Play />}
      </Screen>
    </Game>
  );
}
