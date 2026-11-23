// The fruit's light: from the top left of the screen, wherever a fruit has rolled to. A flat fruit (FLAT_FRUIT in src/theme.ts) is
// lit here by which way each of its pixels faces, from the normal map beside its picture (tools/make-assets.py works it out from
// the fruit's shape, each part a dome; a "normals" layer painted in its Aseprite file is used instead where there is one). The
// normals turn with the fruit, so the light falls right at every turn, on any shape: the side toward the light lit, the far
// side in shadow, the shine where a part faces halfway between the light and the eye.
//
// It is shaded by the steps of the light table (`lookup`, assets/light.png from art/palette/light.aseprite): a row per palette
// colour, two steps of shadow on the left, the colour itself in the middle, a step of light and then the shine on the right. A
// colour is only ever swapped for another from its row, so the fruit stays in the palette, colder in shadow and warmer in the
// light. Each art pixel (2 x 2 of the picture's) is one step, so the light falls in whole pixels.
// - the outline is not black: a dark step of what it is beside, the first where it faces the light, the darkest away from it;
//   an inner line (between two cherries, berries or bananas) the darkest, so the parts stay apart;
// - a line one pixel across (a stalk) in two tones; a stem a dark stalk;
// - turned, it is drawn in whole art pixels lined up with the fruit, its outline made again round the turned shape.
//
// params[0]: how strongly it is lit (1); params[1]: unused; params[2]: how much shine (0.12; 0 for none); params[3]: the clear
// margin round the fruit in its picture, in pixels each side (FRUIT_PAD).

// The light comes from the top left of the screen, and from in front of it by LIGHT_HEIGHT.
const vec2 SCREEN_LIGHT = vec2(-1.0, -1.0);
const float LIGHT_HEIGHT = 0.9;
// The colours the flat fruit keep for their outline and their stems.
const vec3 OUTLINE = vec3(36.0, 21.0, 39.0) / 255.0;
const vec3 STEM = vec3(77.0, 43.0, 50.0) / 255.0;
// How squarely a pixel must face the light for each step: above LIT the step of light, above PLAIN the colour itself, above
// SHADOW the first step of shadow, below it the darkest. The outline turns from its first dark step to its darkest at
// OUTLINE_TURN.
const float LIT = 0.60;
const float PLAIN = 0.24;
const float SHADOW = -0.35;
const float OUTLINE_TURN = 0.0;

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

// Which way the art pixel `at` (the picture's pixels from the region's corner) faces in the picture, from the normal map beside
// it: x and y as the picture's (y down), z toward the eye. Facing the eye where the map has nothing.
vec3 normalIn(vec2 at) {
  if (any(lessThan(at, vec2(0.0))) || any(greaterThanEqual(at, region.zw))) return vec3(0.0, 0.0, 1.0);
  vec4 n = texture(image, (region.xy + vec2(region.z, 0.0) + at) / size);
  if (n.a < 0.5) return vec3(0.0, 0.0, 1.0);
  return normalize(vec3((n.rg * 255.0 - 128.0) / 127.0, n.b));
}

// The screen's art-pixel blocks: where this one samples the picture, and how far the next one right and the next one down move
// that, so the blocks around it can be read as the fruit lies on the screen, turned.
vec2 blockUv;
vec2 blockRight;
vec2 blockDown;

// The picture under the block `o` blocks from this one (x right, y down on the screen), clear outside the region.
vec4 blockAt(vec2 o) {
  vec2 u = blockUv + blockRight * o.x + blockDown * o.y;
  vec2 r = u * size - region.xy;
  if (any(lessThan(r, vec2(0.0))) || any(greaterThanEqual(r, region.zw))) return vec4(0.0);
  return texture(image, u);
}

bool solidBlock(vec2 o) {
  return blockAt(o).a > 0.5;
}

vec4 effect(vec2 uv) {
  // Drawn in whole art pixels, turned or not: each 2 x 2 block of the screen takes the fruit's colour at its middle, as if the
  // game were drawn at 320 x 180. A fruit turned part way otherwise breaks its edge into half-pixel teeth,
  // and its dark outline into a fringe of specks.
  // `pixel` counts down from the top, the derivatives up from the bottom.
  vec2 right = dFdx(uv), down = -dFdy(uv);
  size = vec2(textureSize(image, 0));
  // The blocks are lined up with the fruit, not the screen: from where the fruit's middle lands on the screen (found by taking
  // the picture's middle back through how it is laid on the screen), whole pixels to the nearest. So a fruit at an odd pixel,
  // turned or not, has each block take the middle of an art pixel, not the edge between two, where rounding dropped or doubled
  // a row of them (a stem came away from a banana).
  vec2 middleUv = (region.xy + region.zw * 0.5) / size;
  vec2 middleOnScreen = floor(pixel + inverse(mat2(right, down)) * (middleUv - uv) + 0.5);
  vec2 snapped = middleOnScreen + floor((pixel - middleOnScreen) / 2.0) * 2.0 + 1.0 - pixel;
  uv += right * snapped.x + down * snapped.y;
  blockUv = uv;
  blockRight = right * 2.0;
  blockDown = down * 2.0;
  vec2 inRegion = uv * size - region.xy;
  vec4 c = blockAt(vec2(0.0));
  // A stalk or a stem a pixel across breaks into specks when turned: a clear block with one a quarter of a block from its middle
  // is drawn as it, which joins the specks back into a line.
  if (c.a < 0.5) {
    for (int i = 0; i < 4; i++) {
      vec2 q = vec2(i == 0 || i == 1 ? 0.25 : -0.25, i == 0 || i == 2 ? 0.25 : -0.25);
      vec2 u = blockUv + blockRight * q.x + blockDown * q.y;
      vec2 r = u * size - region.xy;
      if (any(lessThan(r, vec2(0.0))) || any(greaterThanEqual(r, region.zw))) continue;
      vec4 p = texture(image, u);
      if (p.a < 0.5 || same(p.rgb, OUTLINE)) continue;
      vec2 pAt = floor(r / 2.0) * 2.0 + 1.0;
      bool stalk = same(p.rgb, STEM) || (pixelAt(pAt + vec2(2.0, 0.0)).a < 0.5 && pixelAt(pAt - vec2(2.0, 0.0)).a < 0.5) ||
                   (pixelAt(pAt + vec2(0.0, 2.0)).a < 0.5 && pixelAt(pAt - vec2(0.0, 2.0)).a < 0.5);
      if (stalk) {
        c = p;
        break;
      }
    }
    if (c.a < 0.5) return vec4(0.0);
  }
  ivec2 table = textureSize(lookup, 0);
  middle = table.x / 2;
  rows = table.y;

  // The edge is made again on the screen's blocks, so it is one block all round at any turn: turning a picture breaks its
  // outline, two blocks thick in places and gone in others, and leaves single blocks sticking out. A block with at most one
  // solid block beside it is such a spur, and is left out; one with any clear beside it is the edge, drawn as the outline.
  int solidBeside = (solidBlock(vec2(1.0, 0.0)) ? 1 : 0) + (solidBlock(vec2(-1.0, 0.0)) ? 1 : 0) +
                    (solidBlock(vec2(0.0, 1.0)) ? 1 : 0) + (solidBlock(vec2(0.0, -1.0)) ? 1 : 0);
  bool thin = (!solidBlock(vec2(1.0, 0.0)) && !solidBlock(vec2(-1.0, 0.0))) || (!solidBlock(vec2(0.0, 1.0)) && !solidBlock(vec2(0.0, -1.0)));
  // Not one that joins a stem to the fruit, though: that left a turned stem floating.
  bool byStemBlock = false;
  for (int i = 0; i < 8; i++) {
    vec2 o = i < 4 ? (i == 0 ? vec2(1.0, 0.0) : i == 1 ? vec2(-1.0, 0.0) : i == 2 ? vec2(0.0, 1.0) : vec2(0.0, -1.0))
                   : vec2(i == 4 || i == 5 ? 1.0 : -1.0, i == 4 || i == 6 ? 1.0 : -1.0);
    vec4 b = blockAt(o);
    if (b.a > 0.5 && same(b.rgb, STEM)) byStemBlock = true;
  }
  if (solidBeside <= 1 && !same(c.rgb, STEM) && !thin && !byStemBlock) return vec4(0.0);
  // A block with nothing solid in the eight round it floats free of the fruit (a speck of a turned stalk): left out, stem or not.
  bool alone = true;
  for (int i = 0; i < 8; i++) {
    vec2 o = i < 4 ? (i == 0 ? vec2(1.0, 0.0) : i == 1 ? vec2(-1.0, 0.0) : i == 2 ? vec2(0.0, 1.0) : vec2(0.0, -1.0))
                   : vec2(i == 4 || i == 5 ? 1.0 : -1.0, i == 4 || i == 6 ? 1.0 : -1.0);
    if (solidBlock(o)) alone = false;
  }
  if (alone) return vec4(0.0);
  bool screenEdge = solidBeside < 4;
  // An outline block inside the edge (the outline came out two thick there) is the fruit: it takes the colour beside it.
  bool nearClear = false;
  for (int i = 0; i < 8; i++) {
    vec2 o = i < 4 ? (i == 0 ? vec2(1.0, 0.0) : i == 1 ? vec2(-1.0, 0.0) : i == 2 ? vec2(0.0, 1.0) : vec2(0.0, -1.0))
                   : vec2(i == 4 || i == 5 ? 1.0 : -1.0, i == 4 || i == 6 ? 1.0 : -1.0);
    if (!solidBlock(o)) nearClear = true;
  }
  // The fruit's colour at or beside this block (not the outline or a stem), for an edge or a doubled outline to be shaded from.
  vec3 body = c.rgb;
  if (same(body, OUTLINE) || (screenEdge && same(body, STEM))) {
    for (int i = 0; i < 8; i++) {
      vec2 o = i < 4 ? (i == 0 ? vec2(1.0, 0.0) : i == 1 ? vec2(-1.0, 0.0) : i == 2 ? vec2(0.0, 1.0) : vec2(0.0, -1.0))
                     : vec2(i == 4 || i == 5 ? 1.0 : -1.0, i == 4 || i == 6 ? 1.0 : -1.0);
      vec4 b = blockAt(o);
      if (b.a > 0.5 && !same(b.rgb, OUTLINE) && !same(b.rgb, STEM)) {
        body = b.rgb;
        break;
      }
    }
  }
  bool asEdge = screenEdge && !thin && !same(c.rgb, STEM);
  // Not an inner line, though (between two berries or cherries): that has no clear round it in the picture, however it lies.
  vec2 here = floor(inRegion / 2.0) * 2.0 + 1.0;
  bool innerLine = true;
  for (int i = 0; i < 8; i++) {
    vec2 o = i < 4 ? (i == 0 ? vec2(2.0, 0.0) : i == 1 ? vec2(-2.0, 0.0) : i == 2 ? vec2(0.0, 2.0) : vec2(0.0, -2.0))
                   : vec2(i == 4 || i == 5 ? 2.0 : -2.0, i == 4 || i == 6 ? 2.0 : -2.0);
    if (pixelAt(here + o).a < 0.5) innerLine = false;
  }
  if (same(c.rgb, OUTLINE) && !screenEdge && nearClear && !innerLine) c.rgb = body;
  // An inner line a pixel wide breaks into gaps when turned (at 45 degrees most), letting two berries or cherries run together:
  // a block of the fruit with an inner line half a block down and right of its middle is drawn as that line, so it stays whole.
  if (!same(c.rgb, OUTLINE) && !same(c.rgb, STEM) && !screenEdge) {
    // One point only, half a block down and right: enough to close the gaps a turned line leaves, without making it two thick.
    for (int i = 0; i < 1; i++) {
      vec2 q = vec2(0.5, 0.5);
      vec2 u = blockUv + blockRight * q.x + blockDown * q.y;
      vec2 r = u * size - region.xy;
      if (any(lessThan(r, vec2(0.0))) || any(greaterThanEqual(r, region.zw))) continue;
      vec4 p = texture(image, u);
      if (p.a < 0.5 || !same(p.rgb, OUTLINE)) continue;
      vec2 pAt = floor(r / 2.0) * 2.0 + 1.0;
      bool inner = true;
      for (int j = 0; j < 8; j++) {
        vec2 o = j < 4 ? (j == 0 ? vec2(2.0, 0.0) : j == 1 ? vec2(-2.0, 0.0) : j == 2 ? vec2(0.0, 2.0) : vec2(0.0, -2.0))
                       : vec2(j == 4 || j == 5 ? 2.0 : -2.0, j == 4 || j == 6 ? 2.0 : -2.0);
        if (pixelAt(pAt + o).a < 0.5) inner = false;
      }
      if (inner) {
        c.rgb = OUTLINE;
        break;
      }
    }
  }
  int row = rowOf(asEdge ? body : c.rgb);
  if (row < 0) return c;

  // The middle of this art pixel, in the picture's pixels from the region's corner.
  vec2 at = floor(inRegion / 2.0) * 2.0 + 1.0;
  // The light, in the picture (for the stalks' two tones): the screen's top left, turned back by how the fruit is turned.
  vec2 toward = normalize(transpose(turn) * SCREEN_LIGHT);

  // A stem: a dark stalk.
  if (same(c.rgb, STEM)) return vec4(stepOf(rowOf(STEM), -2), c.a);

  // Which way it faces on the screen: its normal, turned with the fruit; and how squarely that is toward the light.
  vec3 inPicture = normalIn(at);
  vec3 normal = normalize(vec3(turn * inPicture.xy, inPicture.z));
  vec3 light = normalize(vec3(SCREEN_LIGHT, LIGHT_HEIGHT));
  float facing = dot(normal, light) * params[0];

  // The edge on the screen: the outline, a dark step of the fruit's colour, the first where it faces the light and the darkest
  // along the side away from it.
  if (asEdge) return vec4(stepOf(row, facing > OUTLINE_TURN ? -1 : -2), c.a);

  // The outline inside the edge: a dark step of the colour beside it; an inner line, with no clear round it, the darkest.
  if (same(c.rgb, OUTLINE)) {
    for (int i = 0; i < 8; i++) {
      vec2 by = i < 4 ? (i == 0 ? vec2(2.0, 0.0) : i == 1 ? vec2(-2.0, 0.0) : i == 2 ? vec2(0.0, 2.0) : vec2(0.0, -2.0))
                      : vec2(i == 4 || i == 5 ? 2.0 : -2.0, i == 4 || i == 6 ? 2.0 : -2.0);
      vec4 beside = pixelAt(at + by);
      if (beside.a < 0.5 || same(beside.rgb, OUTLINE) || same(beside.rgb, STEM)) continue;
      int besideRow = rowOf(beside.rgb);
      if (besideRow < 0) continue;
      bool outer = false;
      for (int j = 0; j < 8; j++) {
        vec2 near = j < 4 ? (j == 0 ? vec2(2.0, 0.0) : j == 1 ? vec2(-2.0, 0.0) : j == 2 ? vec2(0.0, 2.0) : vec2(0.0, -2.0))
                          : vec2(j == 4 || j == 5 ? 2.0 : -2.0, j == 4 || j == 6 ? 2.0 : -2.0);
        if (pixelAt(at + near).a < 0.5) outer = true;
      }
      return vec4(stepOf(besideRow, outer && facing > OUTLINE_TURN ? -1 : -2), c.a);
    }
    return c;
  }

  // A thin line of colour, one pixel across (a cherry's stalk, a leaf's tip): two tones, its side toward the light and the rest.
  if (thin || (edgeAt(at + vec2(2.0, 0.0)) && edgeAt(at - vec2(2.0, 0.0))) || (edgeAt(at + vec2(0.0, 2.0)) && edgeAt(at - vec2(0.0, 2.0)))) {
    return vec4(stepOf(row, edgeAt(at + toward * 2.0) ? 0 : -1), c.a);
  }

  // The fruit: lit, plain, in shadow or in the darkest shadow by how squarely it faces the light; the shine where it faces
  // halfway between the light and the eye.
  int step = facing > LIT ? 1 : facing > PLAIN ? 0 : facing > SHADOW ? -1 : -2;
  vec3 halfway = normalize(light + vec3(0.0, 0.0, 1.0));
  if (params[2] > 0.0 && dot(normal, halfway) > 1.0 - params[2] * 0.12) step = 2;
  return vec4(stepOf(row, step), c.a);
}
