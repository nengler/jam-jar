// A board coming up over the game (the pick, the shop): it is not faded in, it is filled in, pixel by pixel, from the top
// down along a dithered edge. params[0] is how far it has come, 0 (nothing of it) to 1 (all of it).
//
// It works by blocks of two art pixels (four game pixels), so the pattern is coarse enough to be seen as it passes.

const float BAYER[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);

vec4 effect(vec2 uv) {
  vec4 c = texture(image, uv);
  float come = params[0];
  if (come >= 1.0) return c;
  vec2 block = floor(place / 4.0);
  float bayer = (BAYER[int(mod(block.x, 4.0)) + int(mod(block.y, 4.0)) * 4] + 0.5) / 16.0;
  // When this block fills in: sooner the higher it is, and by its place in the pattern within that.
  float when = (place.y / 360.0) * 0.55 + bayer * 0.45;
  return come > when ? c : vec4(0.0);
}
