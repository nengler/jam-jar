/**
 * For `tse screenshot --setup`: puts a new run in the Tilted jar (its boss cycle) once the play screen is up, so the jar can be
 * looked at without playing two cycles to reach it.
 *
 *     npx tse screenshot . --setup tools/shots/tilt.ts --script "_*30,Enter,_*20,Space,_*300" --every 8 --from 60 --to 250 --sheet tilt
 */
import type { Player } from "@tsengine/player";
import { findComponent } from "@tsengine/testing";

import type { Run } from "../../src/rules/jar.ts";

export default function setup(player: Player): void {
  const play = findComponent("Play", player.world.root) as { s: { run: Run } } | null;
  if (play === null || (play.s.run.boss === "tilt" && play.s.run.cycle === 3)) return;
  play.s.run = { ...play.s.run, boss: "tilt", cycle: 3 };
}
