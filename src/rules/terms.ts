/**
 * The game's terms: the keywords its cards are written in, each with one meaning everywhere. A card says "Touching 4 fruit:
 * Blast." and never "explodes" or "blows up"; what Blast means is said once, here, and shown under the card (the way Slay the
 * Spire's cards name Block or Exhaust and a tooltip explains them). A keyword is written with a capital in card text, in one
 * of its `FORMS`, so the screen can find and highlight it.
 */
export type Keyword =
  | "fresh"
  | "simmer"
  | "booster"
  | "merge"
  | "blast"
  | "burst"
  | "rotten"
  | "honeyed"
  | "eat"
  | "heavy"
  | "sprout"
  | "crush"
  | "spill";

export interface KeywordDef {
  name: string;
  /** What it means, in one line of the screen (at most 60 characters). */
  text: string;
}

export const KEYWORDS: Readonly<Record<Keyword, KeywordDef>> = {
  fresh: { name: "Fresh", text: "Scores once, when it lands or a Merge makes it." },
  simmer: { name: "Simmer", text: "Scores at the end of every turn it is in the jar." },
  booster: { name: "Booster", text: "Scores nothing itself. It changes what others score." },
  merge: { name: "Merge", text: "Two of a kind that touch become the next fruit up." },
  blast: { name: "Blast", text: "Destroys nearby fruit. Each scores its points +6 (big +8)." },
  burst: { name: "Burst", text: "Breaks apart into smaller fruit." },
  rotten: { name: "Rotten", text: "Scores nothing, can't Merge, and spreads by touch." },
  honeyed: { name: "Honeyed", text: "Scores +2 at the end of every turn." },
  eat: { name: "Eat", text: "Removes one fruit it touches from the jar." },
  heavy: { name: "Heavy", text: "Shoulders lighter fruit aside on its way down." },
  sprout: { name: "Sprout", text: "A Cherry, Grape or Orange grows in its place." },
  crush: { name: "Crush", text: "Destroys a fruit for its points +3." },
  spill: { name: "Spill", text: "Fruit over the rim when a turn ends are lost: -5 each." },
};

/** Every way a keyword is written in card text. */
const FORMS: Readonly<Record<string, Keyword>> = {
  Fresh: "fresh",
  Simmer: "simmer",
  Booster: "booster",
  Merge: "merge",
  Merged: "merge",
  Blast: "blast",
  Blasted: "blast",
  Burst: "burst",
  Rotten: "rotten",
  Rots: "rotten",
  Honeyed: "honeyed",
  Honey: "honeyed",
  Eat: "eat",
  Heavy: "heavy",
  Sprout: "sprout",
  Crush: "crush",
  Spill: "spill",
};

/** The keyword a word of card text is, if it is one: "Blast." and "Blasted:" are Blast. */
export function keywordOf(word: string): Keyword | undefined {
  return FORMS[word.replace(/[^A-Za-z]/g, "")];
}

/** A word of card text, and whether it is a keyword (drawn in the accent colour). */
export interface RuleWord {
  id: number;
  word: string;
  keyword: boolean;
}

export function ruleWords(text: string): RuleWord[] {
  return text.split(" ").map((word, id) => ({ id, word, keyword: keywordOf(word) !== undefined }));
}

/** The keywords in a card's text, in the order they first appear, after any given first (a fruit's scoring type). */
export function keywordsIn(text: string, first: readonly Keyword[] = []): Keyword[] {
  const found = [...first];
  for (const word of text.split(" ")) {
    const keyword = keywordOf(word);
    if (keyword !== undefined && !found.includes(keyword)) found.push(keyword);
  }
  return found;
}

/** The lines under a card that say what its keywords mean: "Blast: Destroys fruit nearby. …", the first `most` of them. */
export function glossary(keywords: readonly Keyword[], most: number): string[] {
  return keywords.slice(0, most).map((keyword) => `${KEYWORDS[keyword].name}: ${KEYWORDS[keyword].text}`);
}
