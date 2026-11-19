import type { FruitKind } from "./rules/fruits.ts";
import { FRUIT_ART } from "./rules/sizes.ts";

/**
 * Jam Jar's look, in one place. Every colour is from the Apollo palette (tools/palette/apollo.hex), which every picture is
 * snapped to as well (tools/make-assets.py), and every picture is pixel art at 2x. Text is one size, 16 px, so its pixels match.
 */
export const INK = "#341c27";
export const INK_SOFT = "#7a4841";
export const LIGHT = "#ebede9";
export const LIGHT_SOFT = "#a4dddb";
export const GOLD = "#e8c170";
export const GOOD = "#468232";
export const BAD = "#a53030";
export const RIM_LINE = "#cf573c";
export const SHADE = "#090a14b0";

/** Kenney UI Pixel Pack pieces, recoloured to Apollo: a cream panel, tan cards and an amber chosen card, all 9-sliced. */
export const PANEL = "panel.png";
export const PANEL_SLICE = 12;
export const CARD = "card.png";
export const CARD_CHOSEN = "card-chosen.png";
export const CARD_SLICE = 12;

/** The card for a row or an offer: amber when it is the chosen one. */
export function cardFor(chosen: boolean): string {
  return chosen ? CARD_CHOSEN : CARD;
}

/** Menu buttons: a tan card, amber while focused or hovered. */
export const BUTTON = CARD_CHOSEN;
export const BUTTON_GREY = CARD;
export const BUTTON_SLICE = CARD_SLICE;

/** A rotten fruit is tinted this brown. */
export const ROTTEN = "#ad7757";
/** The dark of the pips still to come and of the shelf's shadow. */
export const DARK = "#241527";

/** Which picture of a fruit: its size in the jar, a 32-pixel icon, or a 64-pixel one for the pick cards. */
export type FruitLook = "jar" | "icon" | "big";

export function fruitImage(kind: FruitKind, look: FruitLook): string {
  return look === "icon" ? `icon-${kind}.png` : look === "big" ? `big-${kind}.png` : `fruit-${kind}.png`;
}

export function fruitImageSize(kind: FruitKind, look: FruitLook): number {
  return look === "icon" ? 32 : look === "big" ? 64 : FRUIT_ART[kind].size;
}
