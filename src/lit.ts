import { createContext } from "@tsengine/runtime";

import type { LessonTarget } from "./rules/tutorial.ts";

/**
 * What is picked out on the play screen now (the shelf, the jar, a board; some lessons pick out two), or none: the play screen provides it, and each part
 * of the screen it can be asks it, to stand above the dark and to draw its own frame (see `Raise`, `Frame` and `Dim` in Coach.tsx).
 */
export const Lit = createContext<readonly LessonTarget[]>([]);
