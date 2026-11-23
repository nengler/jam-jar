// The fruit's light: from the top right of the screen, wherever a fruit has rolled to. A fruit drawn flat (FLAT_FRUIT in
// src/theme.ts) is shaded here, by steps of the light table (`lookup`, assets/light.png from art/palette/light.aseprite): a row
// per palette colour, two steps of shadow on the left, the colour itself in the middle, a step of light and then the shine on
// the right. A colour is only ever swapped for another from its row, so the fruit stays in the palette, colder in shadow and
// warmer in the light.
//
// It is shaded as the placeholder fruit were painted. Each art pixel (2 x 2 of the picture's) is one step, so the light falls in
// whole pixels. Taking the fruit as a ball:
// - the side facing the light is lit, one step up, over most of the fruit;
// - the edge away from the light is a step darker, following the fruit's shape (never the edge all round: that is pillow
//   shading, which ignores where the light is);
// - the far side falls to the darkest step;
// - a speck where the light hits squarely is the shine;
// - the outline is not black, and not one colour all round: it takes a step of what it is beside, by how squarely it faces the
//   light, the colour itself where it faces it, a step darker across the middle and the darkest away from it (a row that is one
//   colour all along, as the outline's is, marks the outline).
//
// params[0]: how strongly the ball is lit (1: as painted); params[1]: how much the edge away from the light darkens (0.8);
// params[2]: the shine's size, as a share of the fruit's radius (0.12; 0 for none).

const vec2 SCREEN_LIGHT = vec2(1.0, -1.0);

int middle;
int rows;

// The row of the table whose middle is this colour, or -1.
int rowOf(vec3 colour) {
  for (int i = 0; i < 64; i++) {
    if (i >= rows) break;
    vec3 base = texelFetch(lookup, ivec2(middle, i), 0).rgb;
    if (all(lessThan(abs(base - colour), vec3(0.01)))) return i;
  }
  return -1;
}

// Whether a row is the same colour all along: the light leaves it alone (the outline).
bool unlit(int row) {
  vec3 base = texelFetch(lookup, ivec2(middle, row), 0).rgb;
  return all(lessThan(abs(texelFetch(lookup, ivec2(0, row), 0).rgb - base), vec3(0.01))) &&
         all(lessThan(abs(texelFetch(lookup, ivec2(middle + 1, row), 0).rgb - base), vec3(0.01)));
}

// The picture's pixel at `at` (in its pixels, from the region's corner), clear outside the region.
vec4 pixelAt(vec2 at, vec2 size) {
  if (any(lessThan(at, vec2(0.0))) || any(greaterThanEqual(at, region.zw))) return vec4(0.0);
  return texture(image, (region.xy + at) / size);
}

// The colour a step of a row is, the step clamped to the row.
vec3 stepOf(int row, int step) {
  return texelFetch(lookup, ivec2(middle + clamp(step, -middle, middle), row), 0).rgb;
}

vec4 effect(vec2 uv) {
  vec4 c = texture(image, uv);
  if (c.a < 0.5) return c;
  ivec2 table = textureSize(lookup, 0);
  middle = table.x / 2;
  rows = table.y;
  int row = rowOf(c.rgb);
  if (row < 0) return c;

  vec2 size = vec2(textureSize(image, 0));
  // The middle of this art pixel, in the picture's pixels from the region's corner.
  vec2 at = floor((uv * size - region.xy) / 2.0) * 2.0 + 1.0;
  // The light, in the picture: the screen's top right, turned back by how the fruit is turned; and as it falls on a ball.
  vec2 toward = normalize(transpose(turn) * SCREEN_LIGHT);
  vec3 light = normalize(vec3(toward, 0.9));

  // Where this pixel is on the ball, from its middle, as a share of its radius; and how squarely it faces the light.
  vec2 d = (at - region.zw * 0.5) / (region.zw * 0.45);
  float out2 = min(dot(d, d), 1.0);
  vec3 normal = normalize(vec3(d, sqrt(1.0 - out2)));
  float facing = dot(normal, light) * params[0];

  // The outline: a step of the colour beside it, by how squarely it faces the light.
  if (unlit(row)) {
    // The four pixels beside it first, then the four corners (an outline's corner pixel can touch the fruit only there).
    for (int i = 0; i < 8; i++) {
      vec2 by = i < 4 ? (i == 0 ? vec2(2.0, 0.0) : i == 1 ? vec2(-2.0, 0.0) : i == 2 ? vec2(0.0, 2.0) : vec2(0.0, -2.0))
                      : vec2(i == 4 || i == 5 ? 2.0 : -2.0, i == 4 || i == 6 ? 2.0 : -2.0);
      vec4 beside = pixelAt(at + by, size);
      if (beside.a < 0.5) continue;
      int besideRow = rowOf(beside.rgb);
      if (besideRow < 0 || unlit(besideRow)) continue;
      return vec4(stepOf(besideRow, facing > 0.5 ? 0 : facing > -0.1 ? -1 : -2), c.a);
    }
    return c;
  }

  // The edge away from the light: a pixel with the outline or the clear beside it on the side away from the light turns a step
  // darker, so the shadow side rounds off along the fruit's own shape. Only that side: an edge darkened all round, whatever the
  // light, is pillow shading, and the side toward the light keeps its light up to the outline.
  vec4 away = pixelAt(at - toward * 2.0, size);
  int awayRow = away.a < 0.5 ? -1 : rowOf(away.rgb);
  float shadowEdge = away.a < 0.5 || (awayRow >= 0 && unlit(awayRow)) ? 1.0 : 0.0;
  vec4 near = pixelAt(at + toward * 2.0, size);
  int nearRow = near.a < 0.5 ? -1 : rowOf(near.rgb);
  bool litEdge = near.a < 0.5 || (nearRow >= 0 && unlit(nearRow));

  // The steps: lit over most of the side toward the light, the colour itself across the middle, then down to the darkest.
  float level = facing * 2.2 + 0.3 - shadowEdge * params[1];
  int step = level > 0.5 ? 1 : level > -0.5 ? 0 : level > -1.5 ? -1 : -2;
  // The shine: near where the light hits the ball squarely, not on the edge.
  if (params[2] > 0.0 && !litEdge && shadowEdge == 0.0 && length(d - light.xy * 0.6) < params[2]) step = 2;
  return vec4(stepOf(row, step), c.a);
}
