// God rays: three shafts of warm light coming in from the top right of the screen (where the fruit's light comes from, as through
// a window), falling down and to the left, 25 degrees from straight down, fading toward the floor, each breathing slowly brighter and dimmer and drifting a
// little. Laid over what is under them with `add`, so they only brighten. In whole art pixels (2 x 2 of the screen's) and in a few
// steps, so they read as part of the pixel art and not as a smooth glow. The layer they are on is clear, so where shaders do not
// run (tests, screenshots) it adds nothing.
//
// The shafts are the same as `rayLight` in src/layout.ts, which the motes of dust use to catch the light: change both together.
//
// params[0]: how bright the brightest step of a shaft is (0.24: a quarter of the warm light added).

const vec3 WARM = vec3(0.91, 0.76, 0.44);
// The way the light falls: down and to the left, 25 degrees from straight down.
const vec2 FALL = vec2(-0.4226, 0.9063);
// Each shaft: where it is across the light (pixels along the line at right angles to it), how wide, how fast it breathes and
// where in its breath it starts.
// They come in along the top of the screen at about x = 330, 450 and 565.
const int SHAFTS = 3;
const float AT[3] = float[3](-300.0, -408.0, -512.0);
const float WIDE[3] = float[3](26.0, 36.0, 20.0);
const float PACE[3] = float[3](0.21, 0.13, 0.27);
const float PHASE[3] = float[3](0.0, 1.9, 3.7);

vec4 effect(vec2 uv) {
  // The middle of this art pixel on the screen.
  vec2 p = floor(pixel / 2.0) * 2.0 + 1.0;
  vec2 across = vec2(-FALL.y, FALL.x);
  float a = dot(p, across);
  float light = 0.0;
  for (int i = 0; i < SHAFTS; i++) {
    float drift = sin(time * 0.05 + PHASE[i]) * 12.0;
    float breath = 0.55 + 0.45 * sin(time * PACE[i] + PHASE[i]);
    float edge = abs(a - AT[i] - drift) / WIDE[i];
    light += breath * (1.0 - smoothstep(0.55, 1.0, edge));
  }
  // Brightest where they come in at the top, gone by the floor.
  light *= 1.0 - smoothstep(40.0, 380.0, p.y);
  // In four steps, like the art's shading.
  light = floor(min(light, 1.0) * 4.0) / 4.0;
  return vec4(WARM, light * params[0]);
}
