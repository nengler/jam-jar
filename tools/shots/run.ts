/**
 * For `tse screenshot --setup`: once the play screen is up, the run takes the fields given in SHOT_RUN (JSON), so a screen that is
 * far into a run (the last rent, an eviction, a jar with items) can be looked at without playing there.
 *
 *     SHOT_RUN='{"phase":"over","cycleScore":80}' npx tse screenshot . --setup tools/shots/run.ts --script "_*30,Enter,_*30"
 */
import type { Player } from "@tsengine/player";
import { findComponent } from "@tsengine/testing";

import type { Run } from "../../src/rules/jar.ts";

const fields = JSON.parse(process.env["SHOT_RUN"] ?? "{}") as Partial<Run>;
let done = false;

export default function setup(player: Player): void {
  const play = findComponent("Play", player.world.root) as { s: { run: Run } } | null;
  if (done || play === null) return;
  done = true;
  play.s.run = { ...play.s.run, ...fields };
}
