/** Jam Jar's colours and the Kenney images its screens are made of (tools/make-assets.py). */
export const INK = "#3b3f4a";
export const INK_SOFT = "#6b7080";
export const GOLD = "#ffd166";
export const LIGHT = "#fffaf0";
export const GOOD = "#2f9e44";
export const BAD = "#d6336c";
export const SHADOW = "#00000080";

/** Kenney UI Pixel Pack, doubled (every picture is pixel art at 2x): a cream panel, white cards and a yellow chosen card. */
export const PANEL = "panel.png";
export const PANEL_SLICE = 12;
export const CARD = "card.png";
export const CARD_CHOSEN = "card-chosen.png";
export const CARD_SLICE = 12;

/** The card for a row or an offer: yellow when it is the chosen one. */
export function cardFor(chosen: boolean): string {
  return chosen ? CARD_CHOSEN : CARD;
}
/** Menu buttons: a white card, yellow while focused or hovered. */
export const BUTTON = CARD_CHOSEN;
export const BUTTON_GREY = CARD;
export const BUTTON_SLICE = CARD_SLICE;
