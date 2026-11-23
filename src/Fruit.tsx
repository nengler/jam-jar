import { Entity, useBall, useMutable, useUpdate } from "@tsengine/runtime/jsx";

import { FruitBall } from "./FruitBall.tsx";
import { FRUITS, type FruitKind } from "./rules/fruits.ts";
import { leanX, leanY } from "./layout.ts";
import { GRAVITY, JAR, type FruitReport } from "./rules/jar.ts";

interface FruitProps {
  id: number;
  kind: FruitKind;
  /** Its ball's radius: its kind's, but for a Gourd, which grows. */
  r: number;
  /** Where its ball starts (it is dropped, made by a merge, or sprouted). */
  x0: number;
  y0: number;
  rotten: boolean;
  honeyed: boolean;
  pickled: boolean;
  /** Held where it is: its ball is pinned while this is on. */
  frozen: boolean;
  /** Held still between turns (`jarHeld`): pinned like a frozen fruit, but not drawn as one. Let go, it starts from rest. */
  held: boolean;
  /** A Pumpkin's Plunge: its ball is driven straight down (up, turned over) through the pile while this is on. */
  plunging: boolean;
  /** The y of the surface of lime juice in the jar, which floats the fruit in it; at or below the floor when there is none. */
  surface: number;
  /** A steady pull to the right, in pixels per second per second: the Tilted jar. */
  pull: number;
  /** Its gravity is turned over: it falls up (the Flip jar). */
  flipped: boolean;
  /** How far the jar leans, in radians: the fruit is drawn where that puts it, turned with the jar. Its ball stays in the
   * jar's own frame, where the walls stand straight. */
  lean: number;
  lit: boolean;
  /** How lit up it is, 0 to 1: something just happened to it or because of it. */
  glow: number;
  /** Each time `kicks` goes up, the ball is pushed by (`kickX`, `kickY`) px/s: a blast. */
  kicks: number;
  kickX: number;
  kickY: number;
  onReport: (report: FruitReport) => void;
}

/** How much of the turning a rolling wheel of its size would do a fruit shows: half. A full roll made every fruit spin like a tyre, and a third looked stiff. */
const ROLL = 0.5;
/**
 * The squash a fruit is drawn with when it lands: flat at once, then a little tall, then round, a swing every `SQUASH_SWING`
 * seconds that dies away over `SQUASH_FADE`. How flat goes by how much falling speed (px/s) it lost in a step, past
 * `SQUASH_FROM`: a drop from the shelf to the floor is about a fifth flatter, at most `SQUASH_MOST`.
 */
const SQUASH_SWING = 0.16;
const SQUASH_FADE = 0.07;
const SQUASH_FROM = 150;
const SQUASH_PER = 0.0003;
const SQUASH_MOST = 0.22;

/** How much of its sliding a fruit pressed against the jar loses each substep in the Tilted jar (the engine's default is 0.1). */
const TILT_FRICTION = 0.01;

/** A Pumpkin's Plunge: how fast its ball is driven down through the pile (px/s). Its weight (`heavy` in the fruit table) lets it through. */
const PLUNGE_SPEED = 520;

/** How much of its speed a fruit in juice loses each step. */
const JUICE_DRAG = 0.12;

/**
 * A fruit in the jar: a ball the engine moves with every other fruit (`useBall`), stopped by the jar's solid walls. Each step it
 * tells the run where it is, how fast it moves and which fruit it touches; the run decides what that means (landing, merging,
 * blowing up). A blast reaches it as a kick through its props. The ball has no angle of its own, so the fruit's turning is
 * drawn from how it moves: it rolls along what it touches.
 */
export function Fruit({ id, kind, r, x0, y0, rotten, honeyed, pickled, frozen, held, plunging, surface, pull, flipped, lean, lit, glow, kicks, kickX, kickY, onReport }: FruitProps) {
  // `turn` is how far it has rolled, in radians; `lastX` where it was a step ago.
  const s = useMutable({ kicked: 0, turn: 0, lastX: x0, lastY: y0, fall: 0, squash: 0, hit: 1, flat: 0 });
  const { x, y, contacts, push, speed, pin, setGravity, setGravityX, stick } = useBall({
    x: x0,
    y: y0,
    radius: r,
    mass: r * r * (FRUITS[kind].heavy ?? 1),
    gravity: GRAVITY,
    tag: "fruit",
    data: { id: id },
    // In the Tilted jar the pull presses fruit against the low wall and along the floor, and the walls' usual grip held them
    // there: a fruit in the right lane took 3 seconds to slide down the wall (now about 0.8 s, against 0.7 s falling free). The jar is fixed for the cycle, so this is too.
    friction: pull !== 0 ? TILT_FRICTION : undefined,
    // A fruit that comes back from a save frozen, or between turns, is held from its first step.
    pinned: frozen || held,
  });
  useUpdate((dt) => {
    pin(frozen || held);
    // Honey is sticky: a honeyed fruit holds on to every fruit that comes to touch it, and they move as one lump.
    if (honeyed) stick("fruit");
    // In lime juice it floats: the more of it is under the surface, the less it weighs, down to rising as hard as it would fall,
    // so it comes to rest half out of the juice. The juice also slows it, or it would bob for ever. A Heavy fruit sinks.
    const radius = r;
    const under = FRUITS[kind].heavy === undefined ? Math.max(0, Math.min(1, (y + radius - surface) / (radius * 2))) : 0;
    setGravity(flipped ? -GRAVITY : GRAVITY * (1 - 2 * under));
    if (under > 0 && !flipped) push(-(x - s.lastX) * 60 * JUICE_DRAG, -(y - s.lastY) * 60 * JUICE_DRAG);
    setGravityX(pull);
    if (plunging && dt > 0) {
      // Driven straight down at `PLUNGE_SPEED`: what it moves across is cancelled, what it lacks downwards is added.
      const vx = (x - s.lastX) / dt;
      const vy = (y - s.lastY) / dt;
      push(-vx, (flipped ? -PLUNGE_SPEED : PLUNGE_SPEED) - vy);
    }
    if (kicks !== s.kicked) {
      s.kicked = kicks;
      push(kickX, kickY);
    }
    const touching = contacts("fruit").map((c) => c.data.id);
    // It rolls: while it touches a fruit or the floor, it turns by how far it moved across, as a wheel of its size would.
    if (touching.length > 0 || y + r >= JAR.floor - 2) s.turn += ((x - s.lastX) / r) * ROLL;
    // Drawn only: when it stops falling all at once (it hit the floor or the pile), it squashes flat and springs back.
    const fall = dt > 0 ? Math.abs(y - s.lastY) / dt : 0;
    const impact = s.fall - fall;
    if (s.fall > SQUASH_FROM && impact > SQUASH_FROM) {
      s.hit = 0;
      s.flat = Math.min(SQUASH_MOST, impact * SQUASH_PER);
    } else s.hit += dt;
    s.fall = fall;
    s.squash = s.flat * Math.exp(-s.hit / SQUASH_FADE) * Math.cos((2 * Math.PI * s.hit) / SQUASH_SWING);
    s.lastX = x;
    s.lastY = y;
    onReport({ id: id, x: x, y: y, speed: speed(), touching: touching });
  });
  // The squash is the jar's up and down, not the fruit's own: it is around the fruit's turning, not inside it. It is pinned at the
  // fruit's underside (its top, under a turned-over gravity), so a flattened fruit still sits on what it landed on.
  const sink = r * s.squash * (flipped ? -1 : 1);
  // A grown Gourd is its picture scaled up to its size.
  const grow = r / FRUITS[kind].radius;
  return (
    <Entity x={leanX(x, y, lean, JAR.right, JAR.floor)} y={leanY(x, y, lean, JAR.right, JAR.floor) + sink} scaleX={grow * (1 + s.squash)} scaleY={grow * (1 - s.squash)}>
      <FruitBall kind={kind} x={0} y={0} turn={s.turn + lean} rotten={rotten} honeyed={honeyed} pickled={pickled} frozen={frozen} lit={lit} glow={glow} />
    </Entity>
  );
}
