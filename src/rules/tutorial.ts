import type { Run } from "./jar.ts";

/**
 * The first game's lessons. They are not a game of their own: a card beside the jar says one thing at a time about the run the
 * player is really playing, and moves on when they have done it. A lesson that only tells them something (the rent, the pool) has a "Got it" to put it away with. Each lesson waits for its moment (the
 * pick's waits for the first pick), so the card is away while there is nothing to say.
 */
export type LessonId = "shelf" | "order" | "drop" | "score" | "rent" | "pick" | "pool" | "shop";

/** What a lesson's frame is drawn around on the play screen, if anything. */
export type LessonTarget = "shelf" | "jar" | "rent" | "pool" | null;

export interface Lesson {
  id: LessonId;
  title: string;
  /** What the card says to a player using the pointer (a mouse or a finger), and at a keyboard when that differs. */
  text: string;
  keysText?: string;
  target: LessonTarget;
  /** It asks for nothing, only tells: its card has a "Got it" to put it away with. The others go when the player does what they say. */
  told?: boolean;
}

export const LESSONS: readonly Lesson[] = [
  {
    id: "shelf",
    title: "Your shelf",
    text: "This is your hand for the turn. Tap a fruit to see what it does.",
    keysText: "This is your hand for the turn. Left and Right look at each fruit.",
    target: "shelf",
  },
  {
    id: "order",
    title: "Order matters",
    text: "Fruit drop left to right and score by what they touch. Drag one to reorder.",
    keysText: "Fruit drop left to right and score by what they touch. Enter picks one up to move it.",
    target: "shelf",
  },
  {
    id: "drop",
    title: "Drop them in",
    text: "Happy with the order? Tap the jar to drop them in.",
    keysText: "Happy with the order? Press Space to drop them in.",
    target: "jar",
  },
  {
    id: "score",
    title: "Scoring",
    text: "Matching fruit that touch merge. When the jar is still, everything in it scores.",
    target: "jar",
  },
  {
    id: "rent",
    title: "The rent",
    text: "Score the rent within 5 turns or you are evicted. Every 10 points over it is a coin.",
    target: "rent",
    told: true,
  },
  {
    id: "pick",
    title: "A new fruit",
    text: "Tap a card to read it. Tap it again to take it.",
    keysText: "Left and Right choose a card. Enter takes it.",
    target: null,
  },
  {
    id: "pool",
    title: "Your pool",
    text: "Every fruit you own. Each turn deals four, so what you add keeps coming back.",
    target: "pool",
    told: true,
  },
  {
    id: "shop",
    title: "The shop",
    text: "Coins buy fruit and items. Remove weak fruit to see your best more often.",
    target: null,
  },
];

/** The lesson at a step of the tutorial, or null once it is over. */
export function lessonAt(step: number): Lesson | null {
  return LESSONS[step] ?? null;
}

/** Whether this is the lesson's moment: the card shows only then. */
export function lessonShows(lesson: Lesson, run: Run): boolean {
  switch (lesson.id) {
    case "score":
      return run.phase === "drop" || run.phase === "settle" || run.phase === "tally";
    case "pick":
      return run.phase === "pick";
    case "shop":
      return run.phase === "shop";
    default:
      return run.phase === "order";
  }
}

/** What the player has done since the lesson came up. */
export interface Did {
  /** Looked at a fruit of the shelf: tapped it, or moved the cursor to another. */
  looked: boolean;
  /** Changed the order of the hand. */
  moved: boolean;
  /** Did something the game answered (bought, or tried to): what it says has changed. */
  acted: boolean;
}

/** Whether a lesson that has been showing is done with: the player did what it asked, or its moment has passed. */
export function lessonDone(lesson: Lesson, run: Run, did: Did): boolean {
  if (!lessonShows(lesson, run)) return true;
  if (lesson.id === "shelf") return did.looked;
  if (lesson.id === "order") return did.moved;
  // The shop's lesson lies over where the shop says what happened, so it goes as soon as there is something to say.
  if (lesson.id === "shop") return did.acted;
  return false;
}

/** The lesson to show now: the one at this step of the tutorial, if this is its moment. */
export function lessonNow(step: number, run: Run): Lesson | null {
  const lesson = lessonAt(step);
  return lesson !== null && lessonShows(lesson, run) ? lesson : null;
}
