import type { FruitKind } from "./rules/fruits.ts";
import { FRUIT_ART } from "./rules/sizes.ts";

/**
 * Jam Jar's look, in one place. Every colour is from the Apollo palette (tools/palette/apollo.hex), which every picture is
 * snapped to or drawn in as well (tools/make-assets.py), and every picture is pixel art at 2x. The text is the engine's built-in
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

/** Menu buttons: a parchment card, amber while focused or hovered. */
export const BUTTON = CARD_CHOSEN;
export const BUTTON_GREY = CARD;
export const BUTTON_SLICE = CARD_SLICE;

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


/** Which picture of a fruit: its size in the jar, a 32-pixel icon, or a 64-pixel one for the pick cards. */
export type FruitLook = "jar" | "icon" | "big";

export function fruitImage(kind: FruitKind, look: FruitLook): string {
  return look === "icon" ? `icon-${kind}.png` : look === "big" ? `big-${kind}.png` : `fruit-${kind}.png`;
}

export function fruitImageSize(kind: FruitKind, look: FruitLook): number {
  return look === "icon" ? 32 : look === "big" ? 64 : FRUIT_ART[kind].size;
}

/** Where the counter's top is on the screen: what stands on it (the jar, the title's fruit) has its foot here. */
export const COUNTER_Y = 342;

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
