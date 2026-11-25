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
  | "cluster"
  | "benched"
  | "link"
  | "echo"
  | "bud"
  | "afloat"
  | "heavy"
  | "double"
  | "spoil"
  | "dense"
  | "edge"
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
  | "spill"
  | "smashed"
  | "slice"
  | "wide"
  | "absorb"
  | "shockwave"
  | "plunge"
  | "golden"
  | "glaze"
  | "spicy"
  | "ripe"
  | "fizzy"
  | "seeded"
  | "anchored";

export interface KeywordDef {
  name: string;
  /** What it means. "This" is the number after it on the card. At most 46 characters: two lines of a tooltip. */
  text: string;
}

export const KEYWORDS: Readonly<Record<Keyword, KeywordDef>> = {
  fresh: { name: "Fresh", text: "Scores this once, when it lands or is made." },
  simmer: { name: "Simmer", text: "Scores this at the end of every turn." },
  booster: { name: "Booster", text: "Scores nothing itself." },
  merge: { name: "Merge", text: "Touching one of its kind turns both into this." },
  exploder: { name: "Exploder", text: "Explodes touching this many: a link each lost." },
  buried: { name: "Buried", text: "Explodes, big, under this many fruit." },
  explode: { name: "Explode", text: "Destroys nearby fruit: points +10 (big +14)." },
  exploded: { name: "Exploded", text: "When an explosion destroys it." },
  burst: { name: "Burst", text: "Breaks into this many Cherries." },
  sprout: { name: "Sprout", text: "A Cherry, Grape or Orange grows here." },
  rotten: { name: "Rotten", text: "Scores nothing. Each turn, rots one neighbour." },
  rots: { name: "Rots", text: "Turns Rotten after this many turns." },
  ripen: { name: "Ripen", text: "Scores this much more each turn." },
  honeyed: { name: "Honeyed", text: "+4 each turn. Sticks to what it touches." },
  honey: { name: "Honey", text: "Makes a fruit it touches Honeyed." },
  eat: { name: "Eat", text: "Removes one fruit it touches." },
  hatch: { name: "Hatch", text: "A new Fruit Fly appears where it ate." },
  grow: { name: "Grow", text: "That kind scores this much more, all run." },
  benched: { name: "Benched", text: "On a turn it sits out, left in the basket." },
  link: { name: "Link", text: "Each link of the turn's chain. Not multiplied." },
  echo: { name: "Echo", text: "Its right-hand tray neighbour lands twice." },
  bud: { name: "Bud", text: "Grows a Cherry beside it, if the jar has room." },
  afloat: { name: "Afloat", text: "While it sits in juice or milk." },
  cluster: { name: "Cluster", text: "Landing, its kind scores this more till rent." },
  heavy: { name: "Heavy", text: "Shoulders lighter fruit aside." },
  double: { name: "Double", text: "Fruit and Merges touching it score x2." },
  spoil: { name: "Spoil", text: "Each turn, turns one neighbour Rotten." },
  dense: { name: "Dense", text: "Counts as this many fruit, and lands as links." },
  edge: { name: "Edge", text: "Scores this more touching the floor or a wall." },
  copy: { name: "Copy", text: "Becomes the first fruit it lands on." },
  bouncy: { name: "Bouncy", text: "Shoves its neighbours: each one is 2 links." },
  crack: { name: "Crack", text: "After this many turns, or hit hard, it opens:" },
  juice: { name: "Juice", text: "Pours juice in the jar. Fruit in it float." },
  milk: { name: "Milk", text: "Pours milk in the jar. Fruit in it score x2." },
  skip: { name: "Skip", text: "A Merge touching it skips a size." },
  legendary: { name: "Legendary", text: "Rare, and never in the shop." },
  crush: { name: "Crush", text: "Destroys a fruit for its points +3." },
  shake: { name: "Shake", text: "Throws every fruit about." },
  preserve: { name: "Preserve", text: "Keeps this many fruit for the next cycle." },
  frozen: { name: "Frozen", text: "Held, blast-proof, kept past rent. 3 turns." },
  pickled: { name: "Pickled", text: "Never ages, never Rotten." },
  once: { name: "Once", text: "Used up the first time it works." },
  spill: { name: "Spill", text: "Fruit over the rim are lost: -5 each." },
  smashed: { name: "Smashed", text: "Breaks into 2 of the next size down, scoring." },
  slice: { name: "Slice", text: "Breaks into this many Slices, Fresh 15 each." },
  wide: { name: "Wide", text: "Takes 2 places on the shelf: 2 lanes." },
  absorb: { name: "Absorb", text: "Takes in a fruit no bigger and grows a size." },
  shockwave: { name: "Shockwave", text: "Throws the pile aside, Smashes what it hits." },
  plunge: { name: "Plunge", text: "Sinks to the floor; Smashes pay 75% at once." },
  golden: { name: "Golden", text: "This many coins at rent, or when destroyed." },
  glaze: { name: "Glaze", text: "On one fruit in your pool; lost if it changes." },
  spicy: { name: "Spicy", text: "Explodes when it Merges, sparing what it made." },
  ripe: { name: "Ripe", text: "Lands one size bigger." },
  fizzy: { name: "Fizzy", text: "Each time it scores: 1 more chain link." },
  seeded: { name: "Seeded", text: "Blown up or Crushed: a plain one grows back." },
  anchored: { name: "Anchored", text: "A Plunge or a Shockwave can't throw it." },
};

/** Every way a keyword is written in card text, beside its name. */
const OTHER_FORMS: Readonly<Record<string, Keyword>> = {
  Merged: "merge",
  Merges: "merge",
  Crushed: "crush",
  Smashes: "smashed",
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

/** A word of card text or of a keyword's meaning, and whether it is drawn in the accent colour: a keyword, the number after one ("Fresh 3."), or a signed number ("+4"). */
export interface RuleWord {
  id: number;
  word: string;
  keyword: boolean;
}

export function ruleWords(text: string): RuleWord[] {
  const words = text.split(" ");
  return words.map((word, id) => {
    const after = id > 0 && keywordOf(words[id - 1] as string) !== undefined && /^[+x]?\d/.test(word);
    // A number with its sign ("+4", "x2", "-5") is what the words are about, so it is picked out too.
    return { id, word, keyword: keywordOf(word) !== undefined || after || /^[+\-x]\d/.test(word) };
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
