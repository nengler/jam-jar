// The kitchen wall's light: soft bands of light, as through a window, drifting slowly across the wallpaper and swaying a
// little. It only brightens what is there, in a few steps and by the art's own pixels (two screen pixels at 640 x 360), so it
// reads as part of the pixel art and not as a smooth glow over it. params[0] is how bright the brightest band is (0.2: a fifth
// brighter than the wall).
vec4 effect(vec2 uv) {
  vec4 c = texture(image, uv);
  // Which art pixel this is: 320 x 180 of them, whatever size the game is drawn at.
  vec2 q = floor(pixel / resolution * vec2(320.0, 180.0));
  // Two bands a little off each other's pace, leaning like light through a window.
  float lean = q.x + q.y * 0.6;
  float a = sin(lean * 0.040 - time * 0.22) * 0.5 + 0.5;
  float b = sin(lean * 0.023 + time * 0.13 + 1.7) * 0.5 + 0.5;
  // They sway up and down the wall, so the light is never still.
  float sway = 0.75 + 0.25 * sin(q.y * 0.05 + time * 0.35);
  float light = smoothstep(0.55, 1.0, a * 0.7 + b * 0.3) * sway;
  // In four steps, like the art's shading.
  light = floor(light * 4.0 + 0.5) / 4.0;
  return vec4(c.rgb * (1.0 + params[0] * light), c.a);
}
