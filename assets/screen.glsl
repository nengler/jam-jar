// The whole screen, as the last thing drawn (src/Main.tsx). Two things are always on: the corners fall away into the dark, as a
// kitchen lit by one lamp, and every pixel is put back on the game's palette (Apollo, tools/palette/apollo.hex), with a
// dither where a colour lies between two of them, so what the game blends (a dimmed screen, a tint, a flash) is still drawn
// in the art's own colours. Three more come and go with the run:
//
// params[0]  1 for all of this, 0 to draw the screen as it is (the settings' Screen row).
// params[1]  the last turn of a cycle, 0 to 1: the edges of the screen darken and warm.
// params[2]  the rent missed, 0 to 1: the colour drains out of the screen.
// params[3]  the rent paid, 0 to 1 as a band of gold crosses the screen once (0: none).
//
// It works by the art's pixels (two game pixels square), so the dither is as coarse as the art.

const vec2 GAME = vec2(640.0, 360.0);

const vec3 PALETTE[46] = vec3[46](
  vec3(0.0902, 0.1255, 0.2196),
  vec3(0.1451, 0.2275, 0.3686),
  vec3(0.2353, 0.3686, 0.5451),
  vec3(0.3098, 0.5608, 0.7294),
  vec3(0.4510, 0.7451, 0.8275),
  vec3(0.6431, 0.8667, 0.8588),
  vec3(0.0980, 0.2000, 0.1765),
  vec3(0.1451, 0.3373, 0.1804),
  vec3(0.2745, 0.5098, 0.1961),
  vec3(0.4588, 0.6549, 0.2627),
  vec3(0.6588, 0.7922, 0.3451),
  vec3(0.8157, 0.8549, 0.5686),
  vec3(0.3020, 0.1686, 0.1961),
  vec3(0.4784, 0.2824, 0.2549),
  vec3(0.6784, 0.4667, 0.3412),
  vec3(0.7529, 0.5804, 0.4510),
  vec3(0.8431, 0.7098, 0.5804),
  vec3(0.9059, 0.8353, 0.7020),
  vec3(0.2039, 0.1098, 0.1529),
  vec3(0.3765, 0.1725, 0.1725),
  vec3(0.5333, 0.2941, 0.1686),
  vec3(0.7451, 0.4667, 0.1686),
  vec3(0.8706, 0.6196, 0.2549),
  vec3(0.9098, 0.7569, 0.4392),
  vec3(0.1412, 0.0824, 0.1529),
  vec3(0.2549, 0.1137, 0.1922),
  vec3(0.4588, 0.1412, 0.2196),
  vec3(0.6471, 0.1882, 0.1882),
  vec3(0.8118, 0.3412, 0.2353),
  vec3(0.8549, 0.5255, 0.2431),
  vec3(0.1176, 0.1137, 0.2235),
  vec3(0.2510, 0.1529, 0.3176),
  vec3(0.4784, 0.2118, 0.4824),
  vec3(0.6353, 0.2431, 0.5490),
  vec3(0.7765, 0.3176, 0.5922),
  vec3(0.8745, 0.5176, 0.6471),
  vec3(0.0353, 0.0392, 0.0784),
  vec3(0.0627, 0.0784, 0.1216),
  vec3(0.0824, 0.1137, 0.1569),
  vec3(0.1255, 0.1804, 0.2157),
  vec3(0.2235, 0.2902, 0.3137),
  vec3(0.3412, 0.4471, 0.4667),
  vec3(0.5059, 0.5922, 0.5882),
  vec3(0.6588, 0.7098, 0.6980),
  vec3(0.7804, 0.8118, 0.8000),
  vec3(0.9216, 0.9294, 0.9137)
);

// The 4 x 4 ordered dither: which of two colours a pixel takes when its own lies between them.
const float BAYER[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);

/** The palette's colour for `rgb` at the art pixel `q`: the nearest, or the next nearest by the dither when it lies between. */
vec3 onPalette(vec3 rgb, vec2 q) {
  vec3 first = PALETTE[0];
  vec3 second = PALETTE[0];
  float d1 = 1e9;
  float d2 = 1e9;
  for (int i = 0; i < 46; i++) {
    vec3 d = rgb - PALETTE[i];
    float far = dot(d, d);
    if (far < d1) {
      d2 = d1;
      second = first;
      d1 = far;
      first = PALETTE[i];
    } else if (far < d2) {
      d2 = far;
      second = PALETTE[i];
    }
  }
  if (d1 < 0.00002) return first;
  // How far along the way from the nearest to the next this colour is, against this pixel's place in the pattern.
  vec3 way = second - first;
  float along = clamp(dot(rgb - first, way) / max(dot(way, way), 0.000001), 0.0, 1.0);
  int at = int(mod(q.x, 4.0)) + int(mod(q.y, 4.0)) * 4;
  return along > (BAYER[at] + 0.5) / 16.0 ? second : first;
}

vec4 effect(vec2 uv) {
  vec4 c = texture(image, uv);
  if (params[0] == 0.0) return c;
  // The game is drawn in the middle of the window, as big as fits: where this pixel is in the game's own pixels, and which art
  // pixel that is.
  float scale = min(resolution.x / GAME.x, resolution.y / GAME.y);
  vec2 at = (pixel - (resolution - GAME * scale) / 2.0) / scale;
  vec2 q = floor(at / 2.0);
  at = q * 2.0 + 1.0;
  // How far from the middle of the screen, 0 to about 1.4 in the corners.
  vec2 d = (at - GAME / 2.0) / (GAME / 2.0);
  float out_ = length(d);
  vec3 rgb = c.rgb;

  // The rent paid: a band of gold, leaning, crosses from the left to the right.
  float paid = params[3];
  if (paid > 0.0 && paid < 1.0) {
    float where = at.x + (GAME.y - at.y) * 0.5;
    float far = abs(where - (paid * (GAME.x + GAME.y * 0.5 + 160.0) - 80.0));
    float band = far < 22.0 ? 1.0 : (far < 44.0 ? 0.5 : 0.0);
    rgb = mix(rgb, vec3(0.910, 0.757, 0.439), band * 0.4);
  }

  // The last turn: the edges darken and warm, as the light goes.
  float last = params[1] * smoothstep(0.6, 1.3, out_);
  rgb = mix(rgb, rgb * vec3(1.05, 0.62, 0.42), last * 0.75);

  // The lamp: the corners fall away into the dark.
  float dark = smoothstep(0.95, 1.5, out_) * 0.5;
  rgb = mix(rgb, vec3(0.035, 0.039, 0.078), dark);

  // The rent missed: the colour drains away, and the screen dims a little.
  float drained = params[2];
  if (drained > 0.0) {
    float grey = dot(rgb, vec3(0.299, 0.587, 0.114));
    rgb = mix(rgb, vec3(grey) * 0.9, drained * 0.7);
  }

  return vec4(onPalette(rgb, q), c.a);
}
