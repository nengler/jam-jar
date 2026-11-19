import { Sprite } from "@tsengine/runtime/jsx";

/**
 * The backdrop behind every screen: a kitchen. Trellis wallpaper (Kenney's Pattern Pack Pixel) in two navy blues, and a wooden
 * counter along the bottom that the jar stands on. One picture, drawn by tools/make-assets.py.
 */
export function Backdrop() {
  return <Sprite image="kitchen.png" />;
}
