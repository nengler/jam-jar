// The whole screen, as the last thing drawn (src/Main.tsx). Two things are always on: the corners fall away into the dark, as a
// kitchen lit by one lamp, and every pixel is put on the screen's palette (the `lookup`, assets/screen-palette.png: 29 of
// the art's 46 colours, tools/palette/screen.hex: fifteen for everything, eleven more that only the fruit are drawn in, so
// the fruit keep their colours, and three that keep the jar's glass, the wood and the paper from being all dither), with a
// dither where a colour lies between two of them, so what the game blends (a dimmed screen, a tint, a flash) is still drawn
// in the art's own colours. Two more come and go with the run:
//
// params[0]  1 for all of this, 0 to draw the screen as it is (the settings' Screen row).
// params[1]  the last turn of a cycle, 0 to 1: the edges of the screen darken and warm.
// params[2]  the rent missed, 0 to 1: the colour drains out of the screen.
//
// params[3]  the boss jar of the cycle: 0 none, 1 the Peg jar, 2 the Blind jar, 3 the Tilted jar, 4 the Flip jar; and
// params[4]  how far its look has come in, 0 to 1:
//              Peg: the dark closes in from both sides, as the post's two halves.
//              Blind: the dark closes in all round, to a small lit middle.
//              Tilted: the light falls from the low side: the high side is dark and the low one warm.
//              Flip: the dark hangs from the side the pile falls away from (params[5]: 1 while gravity is turned over), and
// params[6]    the screen smears up and down for a moment as gravity turns, 1 fading to 0.
//
// params[7]  where the lamp's pool of light is, across, in game pixels (0: none): a warm light over the jar, falling off
//            into the wall through the dither.
//
// It works by the art's pixels (two game pixels square), so the dither is as coarse as the art.

const vec2 GAME = vec2(640.0, 360.0);

// How much the dither is turned down: 1 is every shade dithered in proportion; more leaves the faint ones flat.
const float CALM = 1.25;

// The 4 x 4 ordered dither: which of two colours a pixel takes when its own lies between them.
const float BAYER[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);

/** The palette's colour for `rgb` at the art pixel `q`: the nearest, or the next nearest by the dither when it lies between. */
vec3 onPalette(vec3 rgb, vec2 q) {
  // The palette is the lookup: one pixel a colour (assets/screen-palette.png, which tools/make-assets.py writes from its file).
  int count = textureSize(lookup, 0).x;
  vec3 first = texelFetch(lookup, ivec2(0, 0), 0).rgb;
  vec3 second = first;
  float d1 = 1e9;
  float d2 = 1e9;
  for (int i = 0; i < count; i++) {
    vec3 colour = texelFetch(lookup, ivec2(i, 0), 0).rgb;
    vec3 d = rgb - colour;
    float far = dot(d, d);
    if (far < d1) {
      d2 = d1;
      second = first;
      d1 = far;
      first = colour;
    } else if (far < d2) {
      d2 = far;
      second = colour;
    }
  }
  if (d1 < 0.00002) return first;
  // How far along the way from the nearest to the next this colour is, against this pixel's place in the pattern.
  vec3 way = second - first;
  float along = clamp(dot(rgb - first, way) / max(dot(way, way), 0.000001), 0.0, 1.0);
  // The dither is turned down a little (`CALM`): a colour near one of the two takes it outright, so a faint shade is flat and
  // only what is well between two colours is dithered.
  along = clamp(0.5 + (along - 0.5) * CALM, 0.0, 1.0);
  int at = int(mod(q.x, 4.0)) + int(mod(q.y, 4.0)) * 4;
  return along > (BAYER[at] + 0.5) / 16.0 ? second : first;
}

// A number from 0 to 1 for each point of a grid, the same every time, and the same smoothed between the grid's points: the
// paper's grain.
float grainAt(vec2 cell) {
  return fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
}
float grain(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = p - cell;
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(grainAt(cell), grainAt(cell + vec2(1.0, 0.0)), f.x), mix(grainAt(cell + vec2(0.0, 1.0)), grainAt(cell + vec2(1.0, 1.0)), f.x), f.y);
}

vec4 effect(vec2 uv) {
  vec4 c = texture(image, uv);
  if (params[0] == 0.0) return c;
  // Which art pixel this is (`place` is where it is in the game's own pixels), and that pixel's middle.
  vec2 q = floor(place / 2.0);
  vec2 at = q * 2.0 + 1.0;
  // How far from the middle of the screen, 0 to about 1.4 in the corners.
  vec2 d = (at - GAME / 2.0) / (GAME / 2.0);
  float out_ = length(d);
  vec3 rgb = c.rgb;

  // Paper (a board, a card, a key cap) has a grain: patches a little darker, which come out as a dither in the paper's two
  // colours. Only the paper's own colour is touched, so what is written on it stays clean.
  vec3 paper = vec3(0.906, 0.835, 0.702);
  vec3 off = rgb - paper;
  if (dot(off, off) < 0.0004) {
    float worn = grain(at / 38.0) * 0.65 + grain(at / 13.0) * 0.35;
    rgb = mix(rgb, vec3(0.843, 0.710, 0.580), 0.55 * smoothstep(0.42, 0.85, worn));
  }

  // The Flip jar, as gravity turns: the picture is dragged up and down for a moment.
  float smear = params[6];
  if (smear > 0.0) {
    vec3 dragged = vec3(0.0);
    for (int i = 1; i <= 3; i++) {
      float far = float(i) * 10.0 * smear;
      dragged += texture(image, uvOf(vec2(place.x, place.y - far))).rgb + texture(image, uvOf(vec2(place.x, place.y + far))).rgb;
    }
    rgb = mix(rgb, dragged / 6.0, 0.65 * smear);
  }

  // The last turn: the edges darken and warm, as the light goes.
  float last = params[1] * smoothstep(0.6, 1.3, out_);
  rgb = mix(rgb, rgb * vec3(1.05, 0.62, 0.42), last * 0.75);

  // The lamp's pool of light, over the jar: warm, and gone within a couple of hundred pixels.
  if (params[7] > 0.0) {
    vec2 from = (at - vec2(params[7], 200.0)) / vec2(190.0, 230.0);
    float pool = 1.0 - smoothstep(0.25, 1.0, length(from));
    // The inside of the jar (its glass's own dark tint) takes none of that light: added to the glass it lay half way between
    // two colours, and the whole jar was dithered from wall to wall, right behind the fruit. The glass is shaded instead, in
    // rings: clear in the middle of the jar, then bands of dither each denser than the last, through the glass's next tone
    // and on toward the one after it in the corners. The rings' edges wander (the paper's grain, again), so they are not
    // drawn ovals.
    vec3 glass = rgb - vec3(0.125, 0.180, 0.216);
    if (dot(glass, glass) > 0.0004) {
      rgb += pool * 0.075 * vec3(1.0, 0.85, 0.6);
    } else {
      float out_ = length((at - vec2(params[7], 228.0)) / vec2(96.0, 116.0)) + (grain(at / 24.0) - 0.5) * 0.34 + (grain(at / 9.0) - 0.5) * 0.14;
      // How shaded, 0 in the middle to about 1.5 in the corners, in six steps: each step is one band.
      float shade = smoothstep(0.42, 1.3, out_);
      shade = floor(shade * shade * 1.6 * 6.0 + 0.5) / 6.0;
      vec3 next = vec3(0.224, 0.290, 0.314);
      rgb = shade <= 1.0 ? mix(rgb, next, shade) : mix(next, vec3(0.341, 0.447, 0.467), shade - 1.0);
    }
  }

  // The lamp: the corners fall away into the dark.
  // What is light goes darker by a third as much: a heading or a number in a corner keeps its colour, with a little of the
  // dither on it, and is not muddied as the wall behind it is darkened.
  float bright = dot(rgb, vec3(0.299, 0.587, 0.114));
  float dark = smoothstep(0.95, 1.5, out_) * 0.5 * mix(1.0, 0.35, smoothstep(0.4, 0.7, bright));
  rgb = mix(rgb, vec3(0.035, 0.039, 0.078), dark);

  // The boss jar's own dark, over the lamp's.
  int boss = int(params[3] + 0.5);
  float come = params[4];
  vec3 night = vec3(0.035, 0.039, 0.078);
  if (boss == 1) {
    rgb = mix(rgb, night, come * 0.6 * smoothstep(0.55, 1.05, abs(d.x)));
  } else if (boss == 2) {
    rgb = mix(rgb, night, come * 0.7 * smoothstep(0.6, 1.2, out_));
  } else if (boss == 3) {
    // From the high side (the left) to the low one, leaning as the jar does.
    float side = d.x * 0.85 + d.y * 0.35;
    rgb = mix(rgb, night, come * 0.55 * smoothstep(0.25, 1.1, -side));
    rgb = mix(rgb, rgb * vec3(1.08, 0.86, 0.66), come * 0.6 * smoothstep(0.35, 1.1, side));
  } else if (boss == 4) {
    float away = params[5] > 0.5 ? d.y : -d.y;
    rgb = mix(rgb, night, come * 0.6 * smoothstep(0.3, 1.0, away));
  }

  // The rent missed: the colour drains away, and the screen dims a little.
  float drained = params[2];
  if (drained > 0.0) {
    float grey = dot(rgb, vec3(0.299, 0.587, 0.114));
    rgb = mix(rgb, vec3(grey) * 0.9, drained * 0.7);
  }

  return vec4(onPalette(rgb, q), c.a);
}
