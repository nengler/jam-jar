/**
 * For `tse screenshot --setup`: the tutorial is put at lesson SHOT_LESSON (0 is the first), and once the play screen is up the run
 * takes the fields given in SHOT_RUN (JSON), so a later lesson (the pick's, the shop's) can be looked at without playing there.
 *
 *     SHOT_LESSON=5 SHOT_RUN='{"phase":"settle","turn":2,"hand":[],"calmTime":10}' npx tse screenshot . --setup tools/shots/tutorial.ts --script "_*2,click@175,181,_*60"
 */
import type { Player } from "@tsengine/player";
import { findComponent } from "@tsengine/testing";

import type { Run } from "../../src/rules/jar.ts";
import { setTutorialStep } from "../../src/settings.ts";

const fields = JSON.parse(process.env["SHOT_RUN"] ?? "{}") as Partial<Run>;
const lesson = Number(process.env["SHOT_LESSON"] ?? "0");
let done = false;

export default function setup(player: Player): void {
  setTutorialStep(lesson);
  const play = findComponent("Play", player.world.root) as { s: { run: Run } } | null;
  if (done || play === null) return;
  done = true;
  play.s.run = { ...play.s.run, ...fields };
}
