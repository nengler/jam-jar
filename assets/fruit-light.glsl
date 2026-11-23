// The fruit's light: from the top right of the screen, wherever a fruit has rolled to. A fruit drawn flat (FLAT_FRUIT in
// src/theme.ts) is shaded here, by steps of the light table (`lookup`, assets/light.png from art/palette/light.aseprite): a row
// per palette colour, two steps of shadow on the left, the colour itself in the middle, a step of light and then the shine on
// the right. A colour is only ever swapped for another from its row, so the fruit stays in the palette, colder in shadow and
// warmer in the light.
//
// It is shaded as the placeholder fruit were painted (the old Apple most of all). Each art pixel (2 x 2 of the picture's) is one
// step, so the light falls in whole pixels.
//
// Which way each pixel faces comes from the fruit's own shape, not from a ball the size of its picture: the edges near it, in
// rings around it, say which way the surface turns there. An edge is the clear, the outline (#241527, the inner lines too, as
// between two cherries or three berries) or a stem (#4d2b32). So a banana rounds along its bend, each berry of a bunch and each
// cherry of a pair is its own round, and the fruit dips toward its stem. As much again of a ball over the whole fruit is mixed
// in, so the whole fruit turns from light to dark across it, not only at its edges.
// - the steps go in bands that follow the outline, as the old Apple is painted: each band a step lighter going in from the edge
//   (how far in comes from looking eight ways out), wide where the fruit faces away from the light and thin where it faces it.
//   So the shadows hug the fruit's shape, and the lit side has only a pixel of the plain colour before its outline. The same
//   bands all round would be pillow shading: how the fruit faces the light is what makes them wide on one side only;
// - the shine, one speck on each part, where it faces halfway between the light and the eye;
// - a line one pixel across (a stalk) in two tones, and an inner line between two parts as the deepest shadow;
// - a stem is a dark stalk;
// - the outline is not black: a dark step of what it is beside, the first toward the light and the darkest away from it.
//
// params[0]: how strongly it is lit (1: as painted); params[1]: how much the edge away from the light darkens (0.8);
// params[2]: how much shine (0.12; 0 for none).

const vec2 SCREEN_LIGHT = vec2(1.0, -1.0);
// The colours the flat fruit keep for their outline and their stems.
const vec3 OUTLINE = vec3(36.0, 21.0, 39.0) / 255.0;
const vec3 STEM = vec3(77.0, 43.0, 50.0) / 255.0;

// The bands: how much lighter each art pixel in from the edge is, how much facing the light counts, where they start, and below
// what the darkest step begins.
const float BAND_IN = 0.6;
const float BAND_FACING = 1.5;
const float BAND_FROM = -1.6;
const float DARKEST = -1.9;

int middle;
int rows;
vec2 size;

bool same(vec3 a, vec3 b) {
  return all(lessThan(abs(a - b), vec3(0.01)));
}

// The row of the table whose middle is this colour, or -1.
int rowOf(vec3 colour) {
  for (int i = 0; i < 64; i++) {
    if (i >= rows) break;
    if (same(texelFetch(lookup, ivec2(middle, i), 0).rgb, colour)) return i;
  }
  return -1;
}

// The colour a step of a row is, the step clamped to the row.
vec3 stepOf(int row, int step) {
  return texelFetch(lookup, ivec2(middle + clamp(step, -middle, middle), row), 0).rgb;
}

// The picture's pixel at `at` (in its pixels, from the region's corner), clear outside the region.
vec4 pixelAt(vec2 at) {
  if (any(lessThan(at, vec2(0.0))) || any(greaterThanEqual(at, region.zw))) return vec4(0.0);
  return texture(image, (region.xy + at) / size);
}

// Whether the pixel at `at` is an edge of the fruit's surface: the clear, the outline or a stem.
bool edgeAt(vec2 at) {
  vec4 p = pixelAt(at);
  return p.a < 0.5 || same(p.rgb, OUTLINE) || same(p.rgb, STEM);
}

// Which way the surface faces at `at`: from the edges in rings around it (sixteen ways out, three distances), the nearer
// counting more, mixed with a ball over the whole picture. x and y as the picture's (y down), z toward the eye.
vec3 normalAt(vec2 at) {
  float reach = clamp(region.z * 0.12, 4.0, 10.0); // in the picture's pixels: about a fifth of the fruit across, at most 5 art pixels
  vec2 out_ = vec2(0.0);
  float total = 0.0;
  for (int ring = 1; ring <= 3; ring++) {
    float r = reach * float(ring) / 3.0;
    float weight = 1.0 / float(ring);
    for (int i = 0; i < 16; i++) {
      float a = float(i) * 0.39269908; // 2 pi / 16
      vec2 dir = vec2(cos(a), sin(a));
      if (edgeAt(at + dir * r)) out_ += dir * weight;
      total += weight;
    }
  }
  // Half the rings in the clear is right at an edge: facing out sideways there.
  vec2 side = out_ / total * 2.2;
  if (length(side) > 0.95) side = normalize(side) * 0.95;
  vec3 shape = vec3(side, sqrt(1.0 - dot(side, side)));
  vec2 d = (at - region.zw * 0.5) / (region.zw * 0.45);
  if (length(d) > 1.0) d = normalize(d);
  vec3 ball = vec3(d, sqrt(max(0.0, 1.0 - dot(d, d))));
  return normalize(shape * 0.5 + ball * 0.5);
}

// Whether the pixel at `at` is where its part shines: it faces halfway between the light and the eye closely enough, and better
// than any pixel of the fruit around it (ties going to the one nearer the light, so a flat patch shines in one place).
bool shinesAt(vec2 at, vec2 toward) {
  if (edgeAt(at)) return false;
  // Not beside a stem: the fruit dips toward it, which would make a second, false shine there.
  for (int i = 0; i < 8; i++) {
    vec2 by = i < 4 ? (i == 0 ? vec2(2.0, 0.0) : i == 1 ? vec2(-2.0, 0.0) : i == 2 ? vec2(0.0, 2.0) : vec2(0.0, -2.0))
                    : vec2(i == 4 || i == 5 ? 2.0 : -2.0, i == 4 || i == 6 ? 2.0 : -2.0);
    vec4 p = pixelAt(at + by);
    if (p.a > 0.5 && same(p.rgb, STEM)) return false;
  }
  vec3 light = normalize(vec3(toward, 0.9));
  vec3 halfway = normalize(light + vec3(0.0, 0.0, 1.0));
  float gleam = dot(normalAt(at), halfway);
  if (gleam < 1.0 - params[2] * 1.2) return false;
  for (int i = 0; i < 8; i++) {
    vec2 by = i < 4 ? (i == 0 ? vec2(2.0, 0.0) : i == 1 ? vec2(-2.0, 0.0) : i == 2 ? vec2(0.0, 2.0) : vec2(0.0, -2.0))
                    : vec2(i == 4 || i == 5 ? 2.0 : -2.0, i == 4 || i == 6 ? 2.0 : -2.0);
    if (edgeAt(at + by)) continue;
    float other = dot(normalAt(at + by), halfway);
    if (other > gleam || (other == gleam && dot(by, toward) > 0.0)) return false;
  }
  return true;
}

vec4 effect(vec2 uv) {
  vec4 c = texture(image, uv);
  if (c.a < 0.5) return c;
  ivec2 table = textureSize(lookup, 0);
  middle = table.x / 2;
  rows = table.y;
  size = vec2(textureSize(image, 0));
  int row = rowOf(c.rgb);
  if (row < 0) return c;

  // The middle of this art pixel, in the picture's pixels from the region's corner.
  vec2 at = floor((uv * size - region.xy) / 2.0) * 2.0 + 1.0;
  // The light, in the picture: the screen's top right, turned back by how the fruit is turned; as it falls from the front.
  vec2 toward = normalize(transpose(turn) * SCREEN_LIGHT);
  vec3 light = normalize(vec3(toward, 0.9));

  // A stem: a dark stalk.
  if (same(c.rgb, STEM)) return vec4(stepOf(row, -1), c.a);

  vec3 normal = normalAt(at);
  float facing = dot(normal, light) * params[0];

  // The outline: a dark step of the colour beside it, the first where it faces the light, the darkest where it does not.
  if (same(c.rgb, OUTLINE)) {
    // The four pixels beside it first, then the four corners (an outline's corner pixel can touch the fruit only there).
    for (int i = 0; i < 8; i++) {
      vec2 by = i < 4 ? (i == 0 ? vec2(2.0, 0.0) : i == 1 ? vec2(-2.0, 0.0) : i == 2 ? vec2(0.0, 2.0) : vec2(0.0, -2.0))
                      : vec2(i == 4 || i == 5 ? 2.0 : -2.0, i == 4 || i == 6 ? 2.0 : -2.0);
      vec4 beside = pixelAt(at + by);
      if (beside.a < 0.5 || same(beside.rgb, OUTLINE) || same(beside.rgb, STEM)) continue;
      int besideRow = rowOf(beside.rgb);
      if (besideRow < 0) continue;
      // An inner line, one with no clear around it (between two cherries, berries or bananas), is the deepest shadow, where one
      // part tucks behind the other: it keeps the parts apart however they are lit.
      bool outer = false;
      for (int j = 0; j < 8; j++) {
        vec2 near = j < 4 ? (j == 0 ? vec2(2.0, 0.0) : j == 1 ? vec2(-2.0, 0.0) : j == 2 ? vec2(0.0, 2.0) : vec2(0.0, -2.0))
                          : vec2(j == 4 || j == 5 ? 2.0 : -2.0, j == 4 || j == 6 ? 2.0 : -2.0);
        if (pixelAt(at + near).a < 0.5) outer = true;
      }
      // The outer outline: the first dark step where it faces the light, the darkest where it faces away from it.
      return vec4(stepOf(besideRow, outer && facing > 0.0 ? -1 : -2), c.a);
    }
    return c;
  }

  // A thin line of colour, one pixel across (a cherry's stalk, a leaf's tip): two tones, its side toward the light and the rest,
  // not shaded as a round.
  if ((edgeAt(at + vec2(2.0, 0.0)) && edgeAt(at - vec2(2.0, 0.0))) || (edgeAt(at + vec2(0.0, 2.0)) && edgeAt(at - vec2(0.0, 2.0)))) {
    return vec4(stepOf(row, edgeAt(at + toward * 2.0) ? 0 : -1), c.a);
  }

  // Whether the edge is right beside it on the side away from the light (no shine there).
  bool shadowEdge = edgeAt(at - toward * 2.0);

  // How far in from the nearest edge it is, in art pixels (1 beside the outline), looking eight ways out to six pixels.
  float inside = 6.0;
  for (int i = 0; i < 8; i++) {
    vec2 dir = i < 4 ? (i == 0 ? vec2(1.0, 0.0) : i == 1 ? vec2(-1.0, 0.0) : i == 2 ? vec2(0.0, 1.0) : vec2(0.0, -1.0))
                     : vec2(i == 4 || i == 5 ? 1.0 : -1.0, i == 4 || i == 6 ? 1.0 : -1.0);
    for (int n = 1; n <= 6; n++) {
      if (float(n) >= inside) break;
      if (edgeAt(at + dir * 2.0 * float(n))) {
        inside = float(n);
        break;
      }
    }
  }

  // The steps go in bands following the outline, as the old Apple is painted: each band a step lighter going in from the edge,
  // and wide where it faces away from the light, thin where it faces it. So the shadows hug the fruit's shape.
  float level = inside * BAND_IN + facing * BAND_FACING + BAND_FROM;
  int step = level > 0.6 ? 1 : level > -0.2 ? 0 : level > DARKEST ? -1 : -2;
  // The shine: on each part, the pixel that faces halfway between the light and the eye best of those around it, and on a part
  // wide enough for it, one pixel either way along the curve from that one, a short streak as the old Apple has.
  vec2 along = vec2(toward.y, -toward.x);
  along = vec2(abs(along.x) > 0.38 ? sign(along.x) : 0.0, abs(along.y) > 0.38 ? sign(along.y) : 0.0) * 2.0;
  if (params[2] > 0.0 && !shadowEdge &&
      (shinesAt(at, toward) || (inside >= 3.0 && (shinesAt(at + along, toward) || shinesAt(at - along, toward))))) step = 2;
  return vec4(stepOf(row, step), c.a);
}
