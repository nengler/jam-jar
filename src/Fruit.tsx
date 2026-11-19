import { useBall, useMutable, useUpdate } from "@tsengine/runtime/jsx";

import { FruitBall } from "./FruitBall.tsx";
import { FRUITS, type FruitKind } from "./rules/fruits.ts";
import { GRAVITY, JAR, type FruitReport } from "./rules/jar.ts";

interface FruitProps {
  id: number;
  kind: FruitKind;
  /** Where its ball starts (it is dropped, made by a merge, or sprouted). */
  x0: number;
  y0: number;
  rotten: boolean;
  honeyed: boolean;
  pickled: boolean;
  /** Held where it is: its ball is pinned while this is on. */
  frozen: boolean;
  /** The y of the surface of lime juice in the jar, which floats the fruit in it; at or below the floor when there is none. */
  surface: number;
  /** A steady pull to the right, in pixels per second per second: the Tilted jar. */
  pull: number;
  lit: boolean;
  /** How lit up it is, 0 to 1: something just happened to it or because of it. */
  glow: number;
  /** Each time `kicks` goes up, the ball is pushed by (`kickX`, `kickY`) px/s: a blast. */
  kicks: number;
  kickX: number;
  kickY: number;
  onReport: (report: FruitReport) => void;
}

/** How much of its speed a fruit in juice loses each step. */
const JUICE_DRAG = 0.12;

/**
 * A fruit in the jar: a ball the engine moves with every other fruit (`useBall`), stopped by the jar's solid walls. Each step it
 * tells the run where it is, how fast it moves and which fruit it touches; the run decides what that means (landing, merging,
 * blowing up). A blast reaches it as a kick through its props. The ball has no angle of its own, so the fruit's turning is
 * drawn from how it moves: it rolls along what it touches.
 */
export function Fruit({ id, kind, x0, y0, rotten, honeyed, pickled, frozen, surface, pull, lit, glow, kicks, kickX, kickY, onReport }: FruitProps) {
  // `turn` is how far it has rolled, in degrees; `lastX` where it was a step ago.
  const s = useMutable({ kicked: 0, turn: 0, lastX: x0, lastY: y0 });
  const { x, y, contacts, push, speed, pin, setGravity } = useBall({
    x: x0,
    y: y0,
    radius: FRUITS[kind].radius,
    mass: FRUITS[kind].radius * FRUITS[kind].radius * (FRUITS[kind].heavy ?? 1),
    gravity: GRAVITY,
    tag: "fruit",
    data: { id: id },
    // A fruit that comes back from a save frozen is held from its first step.
    pinned: frozen,
  });
  useUpdate(() => {
    pin(frozen);
    // In lime juice it floats: the more of it is under the surface, the less it weighs, down to rising as hard as it would fall,
    // so it comes to rest half out of the juice. The juice also slows it, or it would bob for ever. A Heavy fruit sinks.
    const radius = FRUITS[kind].radius;
    const under = FRUITS[kind].heavy === undefined ? Math.max(0, Math.min(1, (y + radius - surface) / (radius * 2))) : 0;
    setGravity(GRAVITY * (1 - 2 * under));
    if (under > 0) push(-(x - s.lastX) * 60 * JUICE_DRAG, -(y - s.lastY) * 60 * JUICE_DRAG);
    if (pull !== 0) push(pull / 60, 0);
    if (kicks !== s.kicked) {
      s.kicked = kicks;
      push(kickX, kickY);
    }
    const touching = contacts("fruit").map((c) => c.data.id);
    // It rolls: while it touches a fruit or the floor, it turns by how far it moved across, as a wheel of its size would.
    if (touching.length > 0 || y + FRUITS[kind].radius >= JAR.floor - 2) s.turn += (((x - s.lastX) / FRUITS[kind].radius) * 180) / Math.PI;
    s.lastX = x;
    s.lastY = y;
    onReport({ id: id, x: x, y: y, speed: speed(), touching: touching });
  });
  return <FruitBall kind={kind} x={x} y={y} turn={s.turn} rotten={rotten} honeyed={honeyed} pickled={pickled} frozen={frozen} lit={lit} glow={glow} />;
}
