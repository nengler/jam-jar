// The game, when something comes up over it (the pick, a board, the pause menu): it falls back to four colours of the wall's
// blues, by how light each pixel was, dithered where it lies between two. It reads as behind, not just as darker.
//
// params[0] is how far it has receded, 0 (as it is) to 1; between, it goes over pixel by pixel through the dither's pattern.
// params[1..12] are the four colours, darkest first, three numbers each.

const float BAYER[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);

vec4 effect(vec2 uv) {
  vec4 c = texture(image, uv);
  float gone = params[0];
  if (gone <= 0.0 || c.a == 0.0) return c;
  vec2 q = floor(place / 2.0);
  float bayer = (BAYER[int(mod(q.x, 4.0)) + int(mod(q.y, 4.0)) * 4] + 0.5) / 16.0;
  if (gone < 1.0 && bayer > gone) return c;
  // How light it was picks its colour; a pixel between two takes the lighter by its place in the pattern.
  float level = clamp(dot(c.rgb, vec3(0.299, 0.587, 0.114)) * 1.3, 0.0, 1.0) * 3.0;
  float band = floor(level);
  if (level - band > bayer) band += 1.0;
  return vec4(param3(1 + 3 * int(min(band, 3.0))), c.a);
}
