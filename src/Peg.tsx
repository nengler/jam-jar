import { Sprite, useBall } from "@tsengine/runtime/jsx";

import { PEG } from "./rules/jar.ts";

/**
 * The boss jar's peg: a wooden post seen end on, in the middle of the jar. It is a ball like the fruit, so they roll off it, but
 * with no weight on it and so heavy that nothing moves it: it is drawn where it was put.
 */
export function Peg() {
  useBall({ x: PEG.x, y: PEG.y, radius: PEG.r, gravity: 0, mass: 1e12, tag: "peg", data: null });
  return <Sprite image="peg.png" x={PEG.x - PEG.r} y={PEG.y - PEG.r} />;
}
