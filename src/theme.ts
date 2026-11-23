import type { FruitKind } from "./rules/fruits.ts";
import { FRUIT_ART, FRUIT_PAD } from "./rules/sizes.ts";

/**
 * Jam Jar's look, in one place. Every colour is from the Apollo palette (tools/palette/apollo.hex), which every picture is
 * drawn in as well (art/), and every picture is pixel art at 2x. The text is the engine's built-in
 * pixel fonts at 2x too: m5x7 for reading, Jersey 10 for headings and numbers.
 */
export const INK = "#341c27";
export const INK_SOFT = "#7a4841";
export const LIGHT = "#ebede9";
export const LIGHT_SOFT = "#a8b5b2";
export const GOLD = "#e8c170";
export const GOOD = "#468232";
export const BAD = "#a53030";
/** Over the jar while a menu or the pick is up: the darkest Apollo colour, see-through. */
export const SHADE = "#090a14c0";
/** Over everything a tutorial lesson is not about: the same dark, lighter, so the rest can still be made out. */
export const DIM = "#090a14a0";
/** The shadow a board or a heading casts on the wall, and the colour behind the kitchen while it loads. */
export const WALL_SHADOW = "#10141f";

/** The fonts (built into the engine) and their sizes: each is drawn at twice its own pixel size. */
export const BODY = "tse:m5x7";
export const BODY_SIZE = 20;
export const DISPLAY = "tse:jersey10";
export const DISPLAY_SIZE = 28;

/** Kenney UI Pack - Pixel Adventure pieces, recoloured to Apollo and 9-sliced: parchment in a wooden frame, the same in amber
 * for the chosen one, dark slate for the note, and an empty amber frame for the chosen fruit. Headings are plain
 * lettering: light on the wall above a board, ink at the top of a dialog. */
export const PANEL = "frame.png";
export const PANEL_SLICE = 8;
export const CARD = "frame.png";
export const CARD_CHOSEN = "frame-chosen.png";
export const CARD_SLICE = 8;
export const PLAQUE = "plaque.png";
export const SELECT = "select.png";

/** The card for an offer: amber when it is the chosen one. */
export function cardFor(chosen: boolean): string {
  return chosen ? CARD_CHOSEN : CARD;
}

/**
 * The shop is a market stall in the kitchen (art/shop): a striped awning, the stall's counter, the offers
 * as jam-jar labels (a gingham band on the item's) with their prices on them, a SOLD stamp, wooden signs for the heading and
 * the actions (green for the way out), and a jar of coins for the purse in the bar along the foot. The labels and signs are 9-sliced like the frames.
 */
export const AWNING = "awning.png";
export const AWNING_H = 44;
export const STALL = "stall.png";
export const LABEL_SLICE = 8;
export const SIGN = "sign.png";
export const SIGN_GO = "sign-go.png";
export const SIGN_SLICE = 8;
export const SOLD = "sold.png";
export const CLOTH = "cloth.png";
export const COIN_JAR = "coin-jar.png";

/** An offer's label: cream with a cherry line, gold when it is the chosen one; the item's has a gingham band and a blue line. */
export function labelFor(chosen: boolean, item: boolean): string {
  return `label${item ? "-item" : ""}${chosen ? "-chosen" : ""}.png`;
}

/** A shop action's sign: dark wood, gold when it is the chosen one, and green for the way out until then. */
export function signFor(chosen: boolean, go = false): string {
  return chosen ? "sign-chosen.png" : go ? SIGN_GO : SIGN;
}

/** Every button (src/PushButton.tsx): a parchment key cap like the pause button, amber while focused or hovered, and pushed in when pressed. */
export const BUTTON = "button.png";
export const BUTTON_LIT = "button-lit.png";
export const BUTTON_DOWN = "button-down.png";

/** A rotten fruit is tinted this brown. */
export const ROTTEN = "#ad7757";
/** A Frozen one is tinted this ice blue. */
export const FROZEN = "#73bed3";
/** A Pickled one is tinted this green. */
export const PICKLED = "#a8ca58";
/** A honeyed one is tinted this gold. */
export const HONEYED = "#e8c170";

/** On parchment: a bar's or a pip's empty colour, the rent bar's fill, and a thin rule between rows. */
export const WELL = "#c09473";
export const BAR_FILL = "#be772b";
/** The rent's bar: a dark trough, so what is filled stands out on the parchment, filled in gold and, once the rent is made, in a light green. */
export const BAR_WELL = "#4d2b32";
export const BAR_GOLD = "#e8c170";
export const BAR_PAID = "#75a743";
export const RULE = "#d7b594";

/** The line drawn between two fruit when one does something to the other, by what it did (rules/jar.ts, `Link`). */
export const LINK: Readonly<Record<"boost" | "rot" | "honey" | "eat" | "freeze", string>> = {
  boost: "#e8c170",
  honey: "#de9e41",
  rot: "#ad7757",
  eat: "#ebede9",
  freeze: "#a4dddb",
};

/** A keyword in card text: on parchment, and on the dark shade under a card. */
export const KEYWORD = "#3c5e8b";
export const KEYWORD_LIGHT = "#e8c170";


/**
 * A fruit's picture, and its size in pixels: one picture, at its size in the jar, which the shelf, the cards and every board show
 * too, so each fruit is drawn once and is the same size wherever it is.
 */
export function fruitImage(kind: FruitKind): string {
  return `fruit-${kind}.png`;
}

/**
 * The fruit drawn flat, in their base colours with an outline, with their light painted on a hidden "shading" layer: the game
 * lights them as they are drawn, the painted light staying put on the screen (from the top left, as painted) however they have
 * rolled (assets/fruit-light.glsl, by the steps of the light table, art/palette/light.aseprite). tools/make-assets.py finds them
 * by that layer and marks them `shaded` in src/rules/sizes.ts; the others have their light drawn in, and are drawn as they are.
 */
export const FLAT_FRUIT: ReadonlySet<FruitKind> = new Set<FruitKind>((Object.keys(FRUIT_ART) as FruitKind[]).filter((kind) => FRUIT_ART[kind].shaded));

/** The fruit's light: the shader, its table, and its params (how strongly the ball is lit, how much the edge away from the light darkens, how much shine, the clear margin round the picture): see the shader. */
export const FRUIT_LIGHT = "fruit-light.glsl";
export const LIGHT_TABLE = "light.png";
export const FRUIT_LIGHT_PARAMS: readonly number[] = [1, 0.8, 0.12, FRUIT_PAD];

/** Where a fruit's middle is in its picture, in pixels each way: its picture has a clear margin round it (FRUIT_PAD). */
export function fruitImageMiddle(kind: FruitKind): number {
  return FRUIT_ART[kind].size / 2 + FRUIT_PAD;
}

export function fruitImageSize(kind: FruitKind): number {
  return FRUIT_ART[kind].size;
}

/** The biggest of these fruit's pictures, in pixels (0 for none): how much room a row or a card of them needs. */
export function biggestFruit(kinds: readonly FruitKind[]): number {
  return Math.max(0, ...kinds.map((kind) => FRUIT_ART[kind].size));
}

/** Where the counter's top is on the screen: what stands on it (the jar, the title's fruit) has its foot here. */
export const COUNTER_Y = 350;
/** The shadow a thing standing on the counter casts on it. */
export const COUNTER_SHADOW = "#090a1480";

/** The motes of dust in the kitchen's air: two blues a little lighter than the wall. */
export const MOTE: readonly [string, string] = ["#253a5e", "#3c5e8b"];

/** A card's tooltip: one box for each keyword on it, this wide, beside the card. */
export const TERM_W = 216;

/** The liquid in the jar, by what is in it: its body, behind the fruit, and the line along its surface. */
export const JUICE: Readonly<Record<"lime" | "milk" | "both", { body: string; top: string }>> = {
  lime: { body: "#25562e", top: "#75a743" },
  milk: { body: "#a8b5b2", top: "#ebede9" },
  both: { body: "#468232", top: "#d0da91" },
};

/** How loud the sounds of things arriving are, of the sounds' volume: a bloop, a fruit's tock on the shelf, the jar's thud. */
export const POP_VOLUME = 0.35;
export const TOCK_VOLUME = 0.35;
export const THUD_VOLUME = 0.6;

/** How loud a button's click is, of the sounds' volume: there are many, so it is soft. */
export const CLICK_VOLUME = 0.5;
