/** Jam Jar's colours and the Kenney images its screens are made of (tools/make-assets.py). */
export const INK = "#3b3f4a";
export const INK_SOFT = "#6b7080";
export const GOLD = "#ffd166";
export const LIGHT = "#fffaf0";
export const GOOD = "#2f9e44";
export const BAD = "#d6336c";
export const SHADOW = "#00000080";

/** UI Pack grey and yellow panels, 9-sliced. */
export const PANEL = "panel.png";
export const PANEL_CHOSEN = "panel-chosen.png";
export const PANEL_SLICE = 16;

/** The panel for a row or card: yellow when it is the chosen one. */
export function panelFor(chosen: boolean): string {
  return chosen ? PANEL_CHOSEN : PANEL;
}
/** UI Pack buttons, 9-sliced. */
export const BUTTON = "button.png";
export const BUTTON_GREY = "button-grey.png";
export const BUTTON_SLICE = 16;
