import { CHAIN_TIERS, type Run } from "./jar.ts";

/**
 * The first game's lessons. They are not a game of their own: a card beside the jar says one thing at a time about the run the
 * player is really playing, and moves on when they have done it. A lesson that only tells them something (the rent, the pool, the
 * shop, where nothing has to be bought) has a "Got it" to put it away with. Each lesson waits for its moment (the
 * pick's waits for the first pick), so the card is away while there is nothing to say. One that comes up while the jar plays (the
 * scoring, the chain) holds the jar still until its "Got it", so it is not gone before it has been read.
 */
export type LessonId = "shelf" | "order" | "drop" | "score" | "pick" | "rent" | "pool" | "shop" | "chain";

/** A part of the play screen a lesson's frame can be drawn around. */
export type LessonTarget = "shelf" | "jar" | "rent" | "pool";

export interface Lesson {
  id: LessonId;
  title: string;
  /** What the card says to a player using the pointer (a mouse or a finger), and at a keyboard. */
  text: string;
  keysText: string;
  /** What its frame is drawn around on the play screen: one part, several, or nothing. */
  target: LessonTarget | readonly LessonTarget[] | null;
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
    text: "Four fall straight down from their spots. The one in the basket sits out. Drag to move.",
    keysText: "Four fall from their spots; the one in the basket sits out. Enter picks one up to move.",
    target: "shelf",
  },
  {
    id: "drop",
    title: "Drop them in",
    text: "Happy with the tray? Tap the jar to drop them in.",
    keysText: "Happy with the tray? Press Space to drop them in.",
    // The tray it asks about and the jar it goes into.
    target: ["shelf", "jar"],
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
    id: "pick",
    title: "A new fruit",
    text: "Tap a card to read it, then Take.",
    keysText: "Arrows choose a card, Enter takes.",
    target: null,
  },
  {
    id: "rent",
    title: "The rent",
    text: "Make the rent in 5 turns or you are evicted. It pays 4 coins, +1 a turn to spare.",
    keysText: "Make the rent in 5 turns or you are evicted. It pays 4 coins, +1 a turn to spare.",
    target: "rent",
    told: true,
  },
  {
    id: "pool",
    title: "Your pool",
    text: "Your fruit wait in the basket. Each turn deals five; empty, it refills. Tap it to see all.",
    keysText: "Your fruit wait in the basket. Each turn deals five; empty, it refills. D shows them all.",
    target: "pool",
    told: true,
  },
  {
    id: "shop",
    title: "The shop",
    text: "Buy fruit, items, or take weak fruit out. Unspent coins carry over.",
    keysText: "Buy fruit, items, or take weak fruit out. Unspent coins carry over.",
    target: null,
    told: true,
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

/** The parts a lesson (if one is up) picks out: what its frame is drawn around. */
export function targets(lesson: Lesson | null): readonly LessonTarget[] {
  const target = lesson === null ? null : lesson.target;
  return target === null ? [] : typeof target === "string" ? [target] : target;
}

/** Whether a lesson (if one is up) is about `target`, among whatever else it picks out. */
export function about(lesson: Lesson | null, target: LessonTarget): boolean {
  return targets(lesson).includes(target);
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
}

/** Whether a lesson that has been showing is done with: the player did what it asked, or its moment has passed. */
export function lessonDone(lesson: Lesson, run: Run, did: Did): boolean {
  // A lesson that holds the jar still stays until its "Got it": its moment cannot pass while it is up.
  if (lesson.holds === true) return false;
  if (!lessonShows(lesson, run)) return true;
  if (lesson.id === "shelf") return did.looked;
  if (lesson.id === "order") return did.moved;
  // The shop's only tells (the player may have no coins, or want none of it): it goes with its "Got it", or when they leave the
  // shop. It lies over the awning, where a chosen label's keywords are told, so it goes too once a label is chosen.
  if (lesson.id === "shop") return run.shop !== null && !run.shop.removing && run.shop.cursor >= 0;
  return false;
}

/** The lesson to show now: the one at this step of the tutorial, if this is its moment. */
export function lessonNow(step: number, run: Run): Lesson | null {
  const lesson = lessonAt(step);
  return lesson !== null && lessonShows(lesson, run) ? lesson : null;
}
