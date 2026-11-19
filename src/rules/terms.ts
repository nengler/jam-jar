/**
 * The game's terms: the keywords its cards are written in, each with one meaning everywhere. A card is a row of them, often with
 * a number, the way Slay the Spire's say "Block 5": the Chili is "Fresh 2. Exploder 4." What a keyword means is said once, here,
 * and shown in a tooltip beside the card. A keyword is written with a capital in card text, in one of its `FORMS`, so the screen
 * can find it, colour it (and the number after it) and explain it.
 */
export type Keyword =
  | "fresh"
  | "simmer"
  | "booster"
  | "merge"
  | "exploder"
  | "buried"
  | "explode"
  | "exploded"
  | "burst"
  | "sprout"
  | "rotten"
  | "rots"
  | "ripen"
  | "contained"
  | "honeyed"
  | "honey"
  | "eat"
  | "hatch"
  | "grow"
  | "heavy"
  | "double"
  | "sour"
  | "dense"
  | "deep"
  | "copy"
  | "bouncy"
  | "crack"
  | "skip"
  | "legendary"
  | "crush"
  | "shake"
  | "preserve"
  | "pickled"
  | "once"
  | "spill";

export interface KeywordDef {
  name: string;
  /** What it means. "This" is the number after it on the card. At most 46 characters: two lines of a tooltip, one under a card. */
  text: string;
}

export const KEYWORDS: Readonly<Record<Keyword, KeywordDef>> = {
  fresh: { name: "Fresh", text: "Scores this once, when it lands or is made." },
  simmer: { name: "Simmer", text: "Scores this at the end of every turn." },
  booster: { name: "Booster", text: "Scores nothing itself." },
  merge: { name: "Merge", text: "Two that touch become the fruit named." },
  exploder: { name: "Exploder", text: "Explodes when touching this many fruit." },
  buried: { name: "Buried", text: "Explodes, big, under this many fruit." },
  explode: { name: "Explode", text: "Destroys nearby fruit for points +6 (big: +8)." },
  exploded: { name: "Exploded", text: "When an explosion destroys it." },
  burst: { name: "Burst", text: "Breaks into this many Cherries." },
  sprout: { name: "Sprout", text: "A Cherry, Grape or Orange grows here." },
  rotten: { name: "Rotten", text: "Scores nothing, can't Merge, spreads." },
  rots: { name: "Rots", text: "Turns Rotten after this many turns." },
  ripen: { name: "Ripen", text: "Scores this much more each turn." },
  contained: { name: "Contained", text: "Its rot does not spread." },
  honeyed: { name: "Honeyed", text: "Scores +2 at the end of every turn." },
  honey: { name: "Honey", text: "Makes a fruit it touches Honeyed." },
  eat: { name: "Eat", text: "Removes one fruit it touches." },
  hatch: { name: "Hatch", text: "A new Fruit Fly appears where it ate." },
  grow: { name: "Grow", text: "That kind scores this much more, all run." },
  heavy: { name: "Heavy", text: "Shoulders lighter fruit aside." },
  double: { name: "Double", text: "Fruit touching it score x2." },
  sour: { name: "Sour", text: "Fruit touching it can't Merge." },
  dense: { name: "Dense", text: "Counts as this many fruit when touched." },
  deep: { name: "Deep", text: "Up to this much more the deeper it sits." },
  copy: { name: "Copy", text: "Becomes the first fruit it lands on." },
  bouncy: { name: "Bouncy", text: "Bounces, shoving its neighbours." },
  crack: { name: "Crack", text: "After this many turns: Booster, Double." },
  skip: { name: "Skip", text: "A Merge touching it skips a size." },
  legendary: { name: "Legendary", text: "Rare, and never in the shop." },
  crush: { name: "Crush", text: "Destroys a fruit for its points +3." },
  shake: { name: "Shake", text: "Throws every fruit about." },
  preserve: { name: "Preserve", text: "Keeps this many fruit past the rent." },
  pickled: { name: "Pickled", text: "Never ages, never Rotten." },
  once: { name: "Once", text: "Used up the first time it works." },
  spill: { name: "Spill", text: "Fruit over the rim are lost: -5 each." },
};

/** Every way a keyword is written in card text, beside its name. */
const OTHER_FORMS: Readonly<Record<string, Keyword>> = {
  Merged: "merge",
  Explodes: "explode",
};

const FORMS: Readonly<Record<string, Keyword>> = {
  ...Object.fromEntries((Object.keys(KEYWORDS) as Keyword[]).map((keyword) => [KEYWORDS[keyword].name, keyword])),
  ...OTHER_FORMS,
};

/** The keyword a word of card text is, if it is one: "Exploder" and "Exploded:" are keywords, "exploded" is not. */
export function keywordOf(word: string): Keyword | undefined {
  return FORMS[word.replace(/[^A-Za-z]/g, "")];
}

/** A word of card text, and whether it is drawn in the accent colour: a keyword, or the number after one ("Fresh 3."). */
export interface RuleWord {
  id: number;
  word: string;
  keyword: boolean;
}

export function ruleWords(text: string): RuleWord[] {
  const words = text.split(" ");
  return words.map((word, id) => {
    const after = id > 0 && keywordOf(words[id - 1] as string) !== undefined && /^[+x]?\d/.test(word);
    return { id, word, keyword: keywordOf(word) !== undefined || after };
  });
}

/** The keywords in a card's text, in the order they first appear. */
export function keywordsIn(text: string): Keyword[] {
  const found: Keyword[] = [];
  for (const word of text.split(" ")) {
    const keyword = keywordOf(word);
    if (keyword !== undefined && !found.includes(keyword)) found.push(keyword);
  }
  return found;
}

/** The lines under a card that say what its keywords mean: "Exploder: Explodes when …", the first `most` of them. */
export function glossary(keywords: readonly Keyword[], most: number): string[] {
  return keywords.slice(0, most).map((keyword) => `${KEYWORDS[keyword].name}: ${KEYWORDS[keyword].text}`);
}
