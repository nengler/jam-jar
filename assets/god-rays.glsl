// God rays: a few shafts of warm light coming in from the top left of the screen (where the fruit's light comes from, as through
// a window), slanting down to the right, fading as they cross the room, each breathing slowly brighter and dimmer and drifting a
// little. Laid over what is under them with `add`, so they only brighten. In whole art pixels (2 x 2 of the screen's) and in a few
// steps, so they read as part of the pixel art and not as a smooth glow. The layer they are on is clear, so where shaders do not
// run (tests, screenshots) it adds nothing.
//
// The shafts are the same as `rayLight` in src/layout.ts, which the motes of dust use to catch the light: change both together.
//
// params[0]: how bright the brightest step of a shaft is (0.24: a quarter of the warm light added).

const vec3 WARM = vec3(0.91, 0.76, 0.44);
// The way the light falls: down and to the right.
const vec2 FALL = vec2(0.6, 0.8);
// Each shaft: where it is across the light (pixels along the line at right angles to it), how wide, how fast it breathes and
// where in its breath it starts.
const int SHAFTS = 5;
const float AT[5] = float[5](-250.0, -165.0, -70.0, 25.0, 110.0);
const float WIDE[5] = float[5](22.0, 34.0, 16.0, 40.0, 20.0);
const float PACE[5] = float[5](0.21, 0.13, 0.29, 0.17, 0.24);
const float PHASE[5] = float[5](0.0, 1.9, 3.7, 0.8, 2.6);

vec4 effect(vec2 uv) {
  // The middle of this art pixel on the screen.
  vec2 p = floor(pixel / 2.0) * 2.0 + 1.0;
  vec2 across = vec2(-FALL.y, FALL.x);
  float a = dot(p, across);
  float along = dot(p, FALL);
  float light = 0.0;
  for (int i = 0; i < SHAFTS; i++) {
    float drift = sin(time * 0.05 + PHASE[i]) * 12.0;
    float breath = 0.55 + 0.45 * sin(time * PACE[i] + PHASE[i]);
    float edge = abs(a - AT[i] - drift) / WIDE[i];
    light += breath * (1.0 - smoothstep(0.55, 1.0, edge));
  }
  // Brightest where they come in, gone by the far side of the room.
  light *= 1.0 - smoothstep(60.0, 640.0, along);
  // In four steps, like the art's shading.
  light = floor(min(light, 1.0) * 4.0) / 4.0;
  return vec4(WARM, light * params[0]);
}
