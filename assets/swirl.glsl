// Jam Jar's backdrop: a slow, Balatro-like swirl in four dark Apollo colours. It works on a grid of the art's 2x pixels, so the
// swirl is as chunky as the pixel art, and picks one of four exact palette colours per cell (no blending), so it stays on the
// palette. params[0] is how fast it turns (1 is the default speed).
vec4 effect(vec2 uv) {
  float cell = resolution.y / 180.0;
  vec2 p = (floor(pixel / cell) + 0.5) * cell;
  vec2 q = (p - resolution * 0.5) / resolution.y;
  float t = time * 0.12 * max(params[0], 0.0001);
  float r = length(q);
  float a = atan(q.y, q.x);
  float swirl = a * 3.0 + r * 9.0 - t * 2.0;
  float v = 0.5 + 0.5 * sin(swirl + 1.6 * sin(r * 6.0 - t * 3.0));
  v = 0.75 * v + 0.25 * (0.5 + 0.5 * sin(q.x * 5.0 + t * 1.7) * sin(q.y * 4.0 - t * 1.3));
  v -= 0.35 * r;
  vec3 c;
  if (v < 0.22) c = vec3(30.0, 29.0, 57.0) / 255.0;        // #1e1d39
  else if (v < 0.42) c = vec3(23.0, 32.0, 56.0) / 255.0;   // #172038
  else if (v < 0.60) c = vec3(37.0, 58.0, 94.0) / 255.0;   // #253a5e
  else c = vec3(64.0, 39.0, 81.0) / 255.0;                 // #402751
  return vec4(c, 1.0);
}
