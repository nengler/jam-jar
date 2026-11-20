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
  | "juice"
  | "milk"
  | "skip"
  | "legendary"
  | "crush"
  | "shake"
  | "preserve"
  | "pickled"
  | "frozen"
  | "once"
  | "spill";

export interface KeywordDef {
  name: string;
  /** What it means. "This" is the number after it on the card. At most 32 characters: a phrase, not a sentence, so a tooltip of several keywords stays small. */
  text: string;
}

export const KEYWORDS: Readonly<Record<Keyword, KeywordDef>> = {
  fresh: { name: "Fresh", text: "Scores once, on landing." },
  simmer: { name: "Simmer", text: "Scores every turn." },
  booster: { name: "Booster", text: "Scores nothing itself." },
  merge: { name: "Merge", text: "Two touching become this." },
  exploder: { name: "Exploder", text: "Explodes touching this many." },
  buried: { name: "Buried", text: "Big explosion under this many." },
  explode: { name: "Explode", text: "Destroys nearby: +10 (big +14)." },
  exploded: { name: "Exploded", text: "When an explosion hits it." },
  burst: { name: "Burst", text: "Breaks into this many Cherries." },
  sprout: { name: "Sprout", text: "Grows a small fruit here." },
  rotten: { name: "Rotten", text: "No score. Spreads. Merges." },
  rots: { name: "Rots", text: "Rotten after this many turns." },
  ripen: { name: "Ripen", text: "Scores this more each turn." },
  honeyed: { name: "Honeyed", text: "+4 a turn. Sticky." },
  honey: { name: "Honey", text: "Honeys a fruit it touches." },
  eat: { name: "Eat", text: "Removes a fruit it touches." },
  hatch: { name: "Hatch", text: "A Fruit Fly appears there." },
  grow: { name: "Grow", text: "Its kind gains this, all run." },
  heavy: { name: "Heavy", text: "Pushes lighter fruit aside." },
  double: { name: "Double", text: "Touching fruit score x2." },
  sour: { name: "Sour", text: "Touching fruit can't Merge." },
  dense: { name: "Dense", text: "Counts as this many fruit." },
  deep: { name: "Deep", text: "Up to this more when deep." },
  copy: { name: "Copy", text: "Becomes what it lands on." },
  bouncy: { name: "Bouncy", text: "Bounces its neighbours." },
  crack: { name: "Crack", text: "Opens after this many turns." },
  juice: { name: "Juice", text: "Juice this deep. Fruit float." },
  milk: { name: "Milk", text: "Milk this deep. Fruit score x2." },
  skip: { name: "Skip", text: "Merges by it skip a size." },
  legendary: { name: "Legendary", text: "Rare. Never in the shop." },
  crush: { name: "Crush", text: "Destroys a fruit: points +3." },
  shake: { name: "Shake", text: "Throws every fruit about." },
  preserve: { name: "Preserve", text: "Keeps this many past rent." },
  frozen: { name: "Frozen", text: "Can't move or be exploded." },
  pickled: { name: "Pickled", text: "Never ages or rots." },
  once: { name: "Once", text: "Used up after one use." },
  spill: { name: "Spill", text: "Over the rim: lost, -5 each." },
};

/** Every way a keyword is written in card text, beside its name. */
const OTHER_FORMS: Readonly<Record<string, Keyword>> = {
  Merged: "merge",
  Crushed: "crush",
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
