import { CHAIN_TIERS, type Run } from "./jar.ts";

/**
 * The first game's lessons. They are not a game of their own: a card beside the jar says one thing at a time about the run the
 * player is really playing, and moves on when they have done it. A lesson that only tells them something (the rent, the pool) has a "Got it" to put it away with. Each lesson waits for its moment (the
 * pick's waits for the first pick), so the card is away while there is nothing to say. One that comes up while the jar plays (the
 * scoring, the chain) holds the jar still until its "Got it", so it is not gone before it has been read.
 */
export type LessonId = "shelf" | "order" | "drop" | "score" | "rent" | "pick" | "pool" | "shop" | "chain";

/** What a lesson's frame is drawn around on the play screen, if anything. */
export type LessonTarget = "shelf" | "jar" | "rent" | "pool" | null;

export interface Lesson {
  id: LessonId;
  title: string;
  /** What the card says to a player using the pointer (a mouse or a finger), and at a keyboard. */
  text: string;
  keysText: string;
  target: LessonTarget;
  /** It asks for nothing, only tells: its card has a "Got it" to put it away with. The others go when the player does what they say. */
  told?: boolean;
  /**
   * It comes up while the jar plays, and the jar stands still under it until its "Got it" (or Enter): its moment would otherwise
   * pass, and the card with it, before the player had read it. Only a lesson that is `told` holds the jar.
   */
  holds?: boolean;
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
    title: "Placement",
    text: "Each fruit falls straight down from its spot and scores by what it touches. Drag to move.",
    keysText: "Each fruit falls straight down from its spot. Enter picks one up to move it.",
    target: "shelf",
  },
  {
    id: "drop",
    title: "Drop them in",
    text: "Happy with the tray? Tap the jar to drop them in.",
    keysText: "Happy with the tray? Press Space to drop them in.",
    target: "jar",
  },
  {
    id: "score",
    title: "Scoring",
    text: "Matching fruit that touch merge. When the jar is still, everything in it scores.",
    keysText: "Matching fruit that touch merge. Once the jar is still, it all scores. Enter goes on.",
    target: "jar",
    told: true,
    holds: true,
  },
  {
    id: "rent",
    title: "The rent",
    text: "Score the rent within 5 turns or you are evicted. Every 10 points over it is a coin.",
    keysText: "Score the rent within 5 turns or you are evicted. Every 10 points over it is a coin.",
    target: "rent",
    told: true,
  },
  {
    id: "pick",
    title: "A new fruit",
    text: "Tap a card to read it, then Take.",
    keysText: "Arrows choose a card, Enter takes.",
    target: null,
  },
  {
    id: "pool",
    title: "Your pool",
    text: "Your fruit wait in the basket. Each turn deals four; empty, it refills. Tap it to see all.",
    keysText: "Your fruit wait in the basket. Each turn deals four; empty, it refills. D shows them all.",
    target: "pool",
    told: true,
  },
  {
    id: "shop",
    title: "The shop",
    text: "Remove weak fruit to see your best more often.",
    keysText: "Remove weak fruit to see your best more often.",
    target: null,
  },
  {
    id: "chain",
    title: "Chains",
    text: "Each merge, blast and score adds a link to the chain. At 5 links points are x2, at 10 x3.",
    keysText: "Each merge, blast and score is a link. At 5 links points are x2, at 10 x3. Enter goes on.",
    target: "jar",
    told: true,
    holds: true,
  },
];

/** Whether a lesson (if one is up) is about `target`: what its frame is drawn around. */
export function about(lesson: Lesson | null, target: LessonTarget): boolean {
  return lesson !== null && lesson.target === target;
}

/** The lesson at a step of the tutorial, or null once it is over. */
export function lessonAt(step: number): Lesson | null {
  return LESSONS[step] ?? null;
}

/** Whether this is the lesson's moment: the card shows only then. */
export function lessonShows(lesson: Lesson, run: Run): boolean {
  switch (lesson.id) {
    case "score":
      // Once the hand has landed and scored: there is nothing to read about in a jar whose fruit are still on the shelf.
      return (run.phase === "settle" && run.turnScore > 0 && run.calmTime > 0) || run.phase === "tally";
    case "pick":
      return run.phase === "pick";
    case "shop":
      return run.phase === "shop";
    case "chain":
      // Once a chain has reached its first tier, while the jar plays (the chain is shown on it then).
      return run.bestChain >= (CHAIN_TIERS[0] as number) && (run.phase === "drop" || run.phase === "settle" || run.phase === "tally");
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
  /** Did something the game answered (bought, or tried to): the coins, the pool or what it says has changed. */
  acted: boolean;
}

/**
 * What changes when the player does something the game answers, to compare with what it was (`Did.acted`): the coins (a buy,
 * a removal, a new shelf all cost some), the pool, and what the game says (a buy refused). A buy itself says nothing.
 */
export function acts(run: Run): string {
  return `${run.coins}|${run.pool.length}|${run.message}`;
}

/** Whether a lesson that has been showing is done with: the player did what it asked, or its moment has passed. */
export function lessonDone(lesson: Lesson, run: Run, did: Did): boolean {
  // A lesson that holds the jar still stays until its "Got it": its moment cannot pass while it is up.
  if (lesson.holds === true) return false;
  if (!lessonShows(lesson, run)) return true;
  if (lesson.id === "shelf") return did.looked;
  if (lesson.id === "order") return did.moved;
  // The shop's lesson lies over where the shop says what happened and over the foot of the labels, where the chosen one's Buy
  // button stands, so it goes as soon as there is something to say or a card is chosen.
  if (lesson.id === "shop") return did.acted || (run.shop !== null && !run.shop.removing && run.shop.cursor >= 0);
  return false;
}

/** The lesson to show now: the one at this step of the tutorial, if this is its moment. */
export function lessonNow(step: number, run: Run): Lesson | null {
  const lesson = lessonAt(step);
  return lesson !== null && lessonShows(lesson, run) ? lesson : null;
}
