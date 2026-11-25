// What a blast does to the jar and everything in it: a ripple runs out from it, pushing the picture outwards as it passes, and a
// big score splits the colours for an instant. It moves the picture by whole art pixels (two game pixels), so the pixel art
// stays pixel art while it bends.
//
// params[0] is how far apart the colours are split, in game pixels, and params[1] how many blasts follow: three numbers each,
// where it is in the game's pixels and how far through its ripple it is, 0 to 1.

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
  float split = params[0];
  int blasts = int(params[1] + 0.5);
  if (blasts == 0 && split == 0.0) return texture(image, uv);
  // The middle of the art pixel this is.
  vec2 at = floor(place / 2.0) * 2.0 + 1.0;
  vec2 push = vec2(0.0);
  for (int i = 0; i < blasts; i++) {
    vec3 blast = param3(2 + 3 * i);
    push += ripple(at, blast.xy, blast.z);
  }
  push = floor(push / 2.0 + 0.5) * 2.0;
  // The picture is pushed outwards: this pixel shows what was nearer the blast.
  vec2 from = place - push;
  vec4 c = texture(image, uvOf(from));
  if (split == 0.0) return c;
  vec4 l = texture(image, uvOf(from - vec2(split, 0.0)));
  vec4 r = texture(image, uvOf(from + vec2(split, 0.0)));
  return vec4(l.r, c.g, r.b, max(c.a, max(l.a, r.a)));
}
