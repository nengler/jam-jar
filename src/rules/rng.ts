/**
 * A seeded random number generator (mulberry32). The run keeps its seed as a plain number, so the same seed and the same input
 * play the same run, rewind replays exactly, and a test can pin a roll.
 */
export interface Roll {
  /** In [0, 1). */
  value: number;
  /** The seed for the next roll. */
  seed: number;
}

export function roll(seed: number): Roll {
  const next = (seed + 0x6d2b79f5) | 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, seed: next };
}

/** A small mutable source over a seed, for code that rolls many times; read `seed` back when done. */
export class Rng {
  seed: number;

  constructor(seed: number) {
    this.seed = seed;
  }

  next(): number {
    const r = roll(this.seed);
    this.seed = r.seed;
    return r.value;
  }

  /** An integer in [min, max]. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** A real number in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)] as T;
  }

  /** A shuffled copy (Fisher–Yates). */
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = out[i] as T;
      out[i] = out[j] as T;
      out[j] = tmp;
    }
    return out;
  }
}
