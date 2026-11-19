/**
 * For `tse screenshot --setup`: starts the run with the pool named in SHOT_POOL (kinds, comma-separated; the first four are the
 * first hand, in that order), so a fruit can be looked at without waiting to be offered it.
 *
 *     SHOT_POOL=honeydew,cherry,cherry,grape,orange,apple npx tse screenshot . --setup tools/shots/pool.ts \
 *       --script "_*30,Enter,_*20,Space,_*430" --every 12 --from 60 --sheet honey
 */
import type { Player } from "@tsengine/player";
import { findComponent } from "@tsengine/testing";

import type { FruitKind } from "../../src/rules/fruits.ts";
import type { Run } from "../../src/rules/jar.ts";

const pool = (process.env["SHOT_POOL"] ?? "").split(",").filter((kind) => kind !== "") as FruitKind[];
let done = false;

export default function setup(player: Player): void {
  const play = findComponent("Play", player.world.root) as { s: { run: Run } } | null;
  if (done || play === null || pool.length < 4) return;
  done = true;
  play.s.run = { ...play.s.run, pool: pool, hand: pool.slice(0, 4), draw: pool.slice(4), discard: [] };
}
