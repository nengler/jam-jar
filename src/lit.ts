import { createContext } from "@tsengine/runtime";

import type { LessonTarget } from "./rules/tutorial.ts";

/**
 * What is picked out on the play screen now (the shelf, the jar, a board), or null: the play screen provides it, and each part
 * of the screen it can be asks it, to draw its own frame, and the dark leaves a hole where it is (see `Frame` and `Dim` in Coach.tsx).
 */
export const Lit = createContext<LessonTarget>(null);
