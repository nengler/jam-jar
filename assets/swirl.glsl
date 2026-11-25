// A slow swirl of paint behind the title and the shop, in place of the kitchen wall: four colours of one ramp, turning about the
// middle of the screen and folding into each other. It is drawn by the art's pixels (two game pixels square) and each colour
// meets the next along a dithered edge, so it is pixel art that moves, not a smooth gradient.
//
// params[0..11] are the four colours, darkest first, three numbers each; params[12] is how fast it turns (1: the title's pace).

const float BAYER[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);

vec4 effect(vec2 uv) {
  vec4 c = texture(image, uv);
  vec2 q = floor(place / 2.0);
  // From the middle of the screen, in screen heights.
  vec2 p = (q * 2.0 + 1.0 - vec2(320.0, 180.0)) / 360.0;
  float t = time * params[12];
  // Turned about the middle, more the nearer it: a spiral, slowly unwinding.
  float r = length(p);
  float a = atan(p.y, p.x) + 1.1 / (r + 0.4) + t * 0.07;
  vec2 s = vec2(cos(a), sin(a)) * r * 3.2;
  // Folded over itself a few times, each fold drifting at its own pace.
  for (int i = 0; i < 3; i++) {
    s += 0.5 * sin(s.yx * 1.6 + t * 0.19 + float(i) * 1.7);
  }
  float v = 0.5 + 0.5 * sin(s.x * 1.4 + s.y * 1.1 + r * 3.0 - t * 0.11);
  // Which of the four colours: mostly the darker ones, and the next one up along a dithered edge.
  float level = pow(v, 1.9) * 3.6;
  float band = floor(level);
  float along = level - band;
  float bayer = (BAYER[int(mod(q.x, 4.0)) + int(mod(q.y, 4.0)) * 4] + 0.5) / 16.0;
  if (along > 0.7 && (along - 0.7) / 0.3 > bayer) band += 1.0;
  return vec4(param3(3 * int(min(band, 3.0))), c.a);
}
