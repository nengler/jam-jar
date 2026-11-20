import { Entity, useMutable, useSound, useUpdate } from "@tsengine/runtime/jsx";

import { arrived, crossed } from "./layout.ts";
import { POP_VOLUME, THUD_VOLUME } from "./theme.ts";

/**
 * The sound of a row of things popping in one after another (a screen's cards, its buttons, a board's tiles): a bloop for each,
 * every one a note higher than the last. It draws nothing. Put it in the screen whose entrance it is for: it counts from when it
 * is made, as the screen's own clock does, the first bloop at `start` seconds and each next one `gap` later, `count` of them
 * (five at most: there are five notes).
 */
export function Bloops({ start, gap, count }: { start: number; gap: number; count: number }) {
  const s = useMutable({ time: 0 });
  const pop0 = useSound("pop-0.wav");
  const pop1 = useSound("pop-1.wav");
  const pop2 = useSound("pop-2.wav");
  const pop3 = useSound("pop-3.wav");
  const pop4 = useSound("pop-4.wav");
  useUpdate((dt) => {
    const before = s.time;
    s.time += dt;
    const n = arrived(before, s.time, start, gap, Math.min(count, 5));
    if (n === 0) pop0(POP_VOLUME);
    else if (n === 1) pop1(POP_VOLUME);
    else if (n === 2) pop2(POP_VOLUME);
    else if (n === 3) pop3(POP_VOLUME);
    else if (n === 4) pop4(POP_VOLUME);
  });
  return <Entity />;
}

/** The sound of something heavy landing (the jar, the title's name), `at` seconds after this is made. It draws nothing. */
export function Thud({ at }: { at: number }) {
  const s = useMutable({ time: 0 });
  const thud = useSound("thud.wav");
  useUpdate((dt) => {
    const before = s.time;
    s.time += dt;
    if (crossed(before, s.time, at)) thud(THUD_VOLUME);
  });
  return <Entity />;
}
