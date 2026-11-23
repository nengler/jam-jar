// The fruit's light: from the top right of the screen, wherever a fruit has rolled to. A fruit drawn flat (FLAT_FRUIT in
// src/theme.ts) is shaded here, by steps of the light table (`lookup`, assets/light.png from art/palette/light.aseprite): a row
// per palette colour, its shadows on the left, its lights on the right, the colour itself in the middle. A colour is only ever
// swapped for another from its row, so the fruit stays in the palette, cooler in shadow and warmer in the light.
//
// Each art pixel (2 x 2 of the picture's) is shaded as one, so the light falls in whole pixels, as the art is drawn. How lit a
// pixel is comes from two things: where it is on the fruit, taken as a ball (the side toward the light lit, the far side in
// shadow), and whether it is on the fruit's edge toward the light or away from it, which follows the fruit's own shape.
//
// params[0]: how many steps the ball's light spans from its middle (1.4: about two up on the lit side, two down on the far one).
// params[1]: how many steps the edge toward the light is lifted, and the edge away from it lowered.

// Whether the art pixel `at` (in the picture's pixels, from the region's corner) is part of the fruit.
bool solid(vec2 at, vec2 size) {
  if (any(lessThan(at, vec2(0.0))) || any(greaterThanEqual(at, region.zw))) return false;
  return texture(image, (region.xy + at) / size).a > 0.5;
}

vec4 effect(vec2 uv) {
  vec4 c = texture(image, uv);
  if (c.a < 0.5) return c;
  // This colour's row of the table: the row whose middle it is. A colour with none is left as it is.
  ivec2 table = textureSize(lookup, 0);
  int middle = table.x / 2;
  int row = -1;
  for (int i = 0; i < 64; i++) {
    if (i >= table.y) break;
    vec3 base = texelFetch(lookup, ivec2(middle, i), 0).rgb;
    if (all(lessThan(abs(base - c.rgb), vec3(0.01)))) {
      row = i;
      break;
    }
  }
  if (row < 0) return c;

  vec2 size = vec2(textureSize(image, 0));
  // The middle of this art pixel, in the picture's pixels from the region's corner.
  vec2 at = floor((uv * size - region.xy) / 2.0) * 2.0 + 1.0;
  // The light's direction in the picture: the screen's top right, turned back by how the fruit is turned.
  vec2 toward = normalize(transpose(turn) * vec2(1.0, -1.0));

  // As a ball: where this pixel is on it, from its middle, and how squarely it faces the light (y down, z out of the screen).
  vec2 d = (at - region.zw * 0.5) / (region.zw * 0.5);
  vec3 normal = normalize(vec3(d, sqrt(max(0.0, 1.0 - dot(d, d))) + 0.2));
  float ball = dot(normal, normalize(vec3(toward, 0.8)));

  // The edge: a pixel with nothing beside it toward the light catches it; one with nothing beside it away from it is in shadow.
  float edge = (solid(at + toward * 2.0, size) ? 0.0 : 1.0) - (solid(at - toward * 2.0, size) ? 0.0 : 1.0);

  float level = ball * params[0] + edge * params[1];
  int step = clamp(int(floor(level + 0.5)), -middle, middle);
  return vec4(texelFetch(lookup, ivec2(middle + step, row), 0).rgb, c.a);
}
