// The whole screen, as the last thing drawn (src/Main.tsx). Two things are always on: the corners fall away into the dark, as a
// kitchen lit by one lamp, and every pixel is put back on the game's palette (Apollo: the `lookup`, assets/apollo.png), with a
// dither where a colour lies between two of them, so what the game blends (a dimmed screen, a tint, a flash) is still drawn
// in the art's own colours. Two more come and go with the run:
//
// params[0]  1 for all of this, 0 to draw the screen as it is (the settings' Screen row).
// params[1]  the last turn of a cycle, 0 to 1: the edges of the screen darken and warm.
// params[2]  the rent missed, 0 to 1: the colour drains out of the screen.
//
// It works by the art's pixels (two game pixels square), so the dither is as coarse as the art.

const vec2 GAME = vec2(640.0, 360.0);

// The 4 x 4 ordered dither: which of two colours a pixel takes when its own lies between them.
const float BAYER[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);

/** The palette's colour for `rgb` at the art pixel `q`: the nearest, or the next nearest by the dither when it lies between. */
vec3 onPalette(vec3 rgb, vec2 q) {
  // The palette is the lookup: one pixel a colour (assets/apollo.png, which tools/make-assets.py writes from the palette's file).
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
  int at = int(mod(q.x, 4.0)) + int(mod(q.y, 4.0)) * 4;
  return along > (BAYER[at] + 0.5) / 16.0 ? second : first;
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
