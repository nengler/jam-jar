import { useBall, useMutable, useUpdate } from "@tsengine/runtime/jsx";

import { FruitBall } from "./FruitBall.tsx";
import { FRUITS, type FruitKind } from "./rules/fruits.ts";
import { GRAVITY, type FruitReport } from "./rules/jar.ts";

interface FruitProps {
  id: number;
  kind: FruitKind;
  /** Where its ball starts (it is dropped, made by a merge, or sprouted). */
  x0: number;
  y0: number;
  rotten: boolean;
  honeyed: boolean;
  pickled: boolean;
  lit: boolean;
  /** How lit up it is, 0 to 1: something just happened to it or because of it. */
  glow: number;
  /** Each time `kicks` goes up, the ball is pushed by (`kickX`, `kickY`) px/s: a blast. */
  kicks: number;
  kickX: number;
  kickY: number;
  onReport: (report: FruitReport) => void;
}

/**
 * A fruit in the jar: a ball the engine moves with every other fruit (`useBall`), stopped by the jar's solid walls. Each step it
 * tells the run where it is, how fast it moves and which fruit it touches; the run decides what that means (landing, merging,
 * blowing up). A blast reaches it as a kick through its props.
 */
export function Fruit({ id, kind, x0, y0, rotten, honeyed, pickled, lit, glow, kicks, kickX, kickY, onReport }: FruitProps) {
  const s = useMutable({ kicked: 0 });
  const { x, y, contacts, push, speed } = useBall({
    x: x0,
    y: y0,
    radius: FRUITS[kind].radius,
    mass: FRUITS[kind].radius * FRUITS[kind].radius * (FRUITS[kind].heavy ?? 1),
    gravity: GRAVITY,
    tag: "fruit",
    data: { id: id },
  });
  useUpdate(() => {
    if (kicks !== s.kicked) {
      s.kicked = kicks;
      push(kickX, kickY);
    }
    onReport({ id: id, x: x, y: y, speed: speed(), touching: contacts("fruit").map((c) => c.data.id) });
  });
  return <FruitBall kind={kind} x={x} y={y} rotten={rotten} honeyed={honeyed} pickled={pickled} lit={lit} glow={glow} />;
}
