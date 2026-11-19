/**
 * Circle physics for the jar: position-based dynamics (Verlet). Each body keeps where it is and where it was a substep ago; the
 * difference is its velocity. Every substep moves the bodies under gravity, then pushes overlapping circles apart (by mass) and
 * keeps them inside the jar a few times over. No restitution: fruit settle into a pile instead of bouncing forever.
 *
 * The engine itself has no physics (its colliders only report touching), so this is the game's own. It is deterministic: the
 * same bodies in the same order step to the same places, which rewind, replays and tests rely on.
 */
export interface Circle {
  id: number;
  x: number;
  y: number;
  /** Where it was one substep ago. */
  px: number;
  py: number;
  r: number;
}

export interface JarBounds {
  left: number;
  right: number;
  floor: number;
}

export const GRAVITY = 600;
const SUBSTEPS = 4;
const ITERATIONS = 3;
/** Kept of the velocity each substep: air drag, so piles come to rest. */
const DAMPING = 0.995;
/** Kept of the sideways velocity of a body resting on the floor: friction. */
const FLOOR_FRICTION = 0.85;
/** Two circles closer than this (beyond touching) still count as touching: piles jitter by a fraction of a pixel. */
export const TOUCH_TOLERANCE = 1.5;

export function stepPhysics(bodies: Circle[], jar: JarBounds, dt: number): void {
  const h = dt / SUBSTEPS;
  for (let sub = 0; sub < SUBSTEPS; sub++) {
    for (const b of bodies) {
      const vx = (b.x - b.px) * DAMPING;
      const vy = (b.y - b.py) * DAMPING;
      b.px = b.x;
      b.py = b.y;
      b.x += vx;
      b.y += vy + GRAVITY * h * h;
    }
    for (let it = 0; it < ITERATIONS; it++) {
      for (let i = 0; i < bodies.length; i++) {
        const a = bodies[i] as Circle;
        for (let j = i + 1; j < bodies.length; j++) {
          const b = bodies[j] as Circle;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const min = a.r + b.r;
          const d2 = dx * dx + dy * dy;
          if (d2 >= min * min) continue;
          let d = Math.sqrt(d2);
          let nx: number;
          let ny: number;
          if (d < 1e-6) {
            // Exactly on top of each other: push apart sideways, by id so it is deterministic.
            nx = a.id < b.id ? 1 : -1;
            ny = 0;
            d = 0;
          } else {
            nx = dx / d;
            ny = dy / d;
          }
          const overlap = min - d;
          const ma = a.r * a.r;
          const mb = b.r * b.r;
          const wa = mb / (ma + mb);
          const wb = ma / (ma + mb);
          a.x -= nx * overlap * wa;
          a.y -= ny * overlap * wa;
          b.x += nx * overlap * wb;
          b.y += ny * overlap * wb;
        }
      }
      for (const b of bodies) {
        if (b.x - b.r < jar.left) b.x = jar.left + b.r;
        if (b.x + b.r > jar.right) b.x = jar.right - b.r;
        if (b.y + b.r > jar.floor) {
          b.y = jar.floor - b.r;
          // Friction on the floor: lose some of the sideways motion.
          b.px = b.x - (b.x - b.px) * FLOOR_FRICTION;
        }
      }
    }
  }
}

/** Speed in pixels per second, from the last substep's motion. */
export function speedOf(b: Circle, dt: number): number {
  const h = dt / SUBSTEPS;
  const vx = (b.x - b.px) / h;
  const vy = (b.y - b.py) / h;
  return Math.sqrt(vx * vx + vy * vy);
}

export function touching(a: Circle, b: Circle): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const reach = a.r + b.r + TOUCH_TOLERANCE;
  return dx * dx + dy * dy <= reach * reach;
}

/** For each body (by index), the indexes of the bodies it touches. */
export function contacts(bodies: readonly Circle[]): number[][] {
  const out: number[][] = bodies.map(() => []);
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      if (touching(bodies[i] as Circle, bodies[j] as Circle)) {
        (out[i] as number[]).push(j);
        (out[j] as number[]).push(i);
      }
    }
  }
  return out;
}

/** Whether a body rests on the jar's floor (within the touch tolerance). */
export function onFloor(b: Circle, jar: JarBounds): boolean {
  return b.y + b.r >= jar.floor - TOUCH_TOLERANCE;
}

/** Give a body a velocity (pixels per second), as Verlet keeps it: by where it was a substep ago. */
export function kick(b: Circle, vx: number, vy: number, dt: number): void {
  const h = dt / SUBSTEPS;
  b.px = b.x - vx * h;
  b.py = b.y - vy * h;
}
