// What a blast does to the jar and everything in it: a ripple runs out from it, pushing the picture outwards as it passes, and a
// big score splits the colours for an instant. It moves the picture by whole art pixels (two game pixels), so the pixel art
// stays pixel art while it bends.
//
// params[0..2] and params[3..5] are two blasts: where each is, in the game's pixels (640 x 360), and how far through its ripple
// it is, 0 to 1 (0 or less, or 1 or more: no ripple). params[6] is how far apart the colours are split, in game pixels.

const vec2 GAME = vec2(640.0, 360.0);

/** How far, in game pixels, the picture at `at` is pushed by the ripple of a blast at `from`, `t` of the way through. */
vec2 ripple(vec2 at, vec2 from, float t) {
  if (t <= 0.0 || t >= 1.0) return vec2(0.0);
  vec2 d = at - from;
  float far = length(d);
  if (far < 1.0) return vec2(0.0);
  // The ring runs out fast and slows, and what it pushes dies away as it goes.
  float radius = 14.0 + 170.0 * (1.0 - (1.0 - t) * (1.0 - t));
  float k = (far - radius) / 20.0;
  if (abs(k) >= 1.0) return vec2(0.0);
  return (d / far) * (1.0 - k * k) * 12.0 * (1.0 - t);
}

vec4 effect(vec2 uv) {
  float split = params[6];
  if ((params[2] <= 0.0 || params[2] >= 1.0) && (params[5] <= 0.0 || params[5] >= 1.0) && split == 0.0) return texture(image, uv);
  // The game is drawn in the middle of the window, as big as fits: where this pixel is in the game's own pixels.
  float scale = min(resolution.x / GAME.x, resolution.y / GAME.y);
  vec2 at = (pixel - (resolution - GAME * scale) / 2.0) / scale;
  at = floor(at / 2.0) * 2.0 + 1.0;
  vec2 push = ripple(at, vec2(params[0], params[1]), params[2]) + ripple(at, vec2(params[3], params[4]), params[5]);
  push = floor(push / 2.0 + 0.5) * 2.0;
  // A game pixel in the layer's own coordinates, whichever way up it is held.
  vec2 step = vec2(dFdx(uv.x), -dFdy(uv.y)) * scale;
  // The picture is pushed outwards: this pixel shows what was nearer the blast.
  vec2 from = uv - push * step;
  vec4 c = texture(image, from);
  if (split == 0.0) return c;
  vec4 l = texture(image, from - vec2(split, 0.0) * step);
  vec4 r = texture(image, from + vec2(split, 0.0) * step);
  return vec4(l.r, c.g, r.b, max(c.a, max(l.a, r.a)));
}
