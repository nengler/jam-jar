// A fruit that is something special, drawn so it shows. Everything here is done by the art's own pixels (the art is drawn at
// 2x, so two image pixels square) and in hard steps, so it reads as part of the pixel art and not as a glow over it. The light is
// at the screen's top left, as it is drawn on every fruit, and stays there however the fruit rolls (`turn`).
//
// params[0] is the look:
//   1  a shimmer: a band of light crosses the fruit every few seconds, and its lit edge is the colour params[1..3] (a glazed
//      fruit, in its glaze's colour; a Golden Apple; a Legendary).
//   2  frost: an icy rim toward the light, and crystals that twinkle (a Frozen fruit; its tint makes them ice blue).
//   3  honey: a slow sheen running down it, and a bright rim (a honeyed fruit).
//   4  rot: blotches of mould that turn with the fruit, and its far edge gone dark (a rotten fruit).
// params[4] is where in its cycle this fruit is (0 to 1), so a jar of them does not all shine at once.

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

vec4 effect(vec2 uv) {
  vec4 c = texture(image, uv);
  if (c.a == 0.0) return c;
  int look = int(params[0] + 0.5);
  vec2 size = vec2(textureSize(image, 0));
  // Which art pixel this is, from the middle of the picture, and where that is on the screen from the fruit's middle.
  vec2 q = floor((uv * size - region.xy) / 2.0);
  vec2 p = q + 0.5 - region.zw / 4.0;
  vec2 s = turn * p;
  float across = region.z / 2.0;
  // One art pixel toward the light, and one away: a pixel with nothing there is on the lit edge, or the dark one.
  vec2 light = transpose(turn) * normalize(vec2(-1.0, -1.0));
  vec2 one = floor(light * 1.5 + 0.5) * 2.0 / size;
  float lit = texture(image, uv + one).a == 0.0 ? 1.0 : 0.0;
  float dark = texture(image, uv - one).a == 0.0 ? 1.0 : 0.0;
  vec3 white = vec3(0.92, 0.93, 0.91);
  vec3 rgb = c.rgb;

  if (look == 1) {
    vec3 colour = vec3(params[1], params[2], params[3]);
    // The band runs from the top left to the bottom right in the first third of every 2.8 seconds: a bright line and a
    // fainter one behind it.
    float t = fract(time / 2.8 + params[4]);
    float along = (s.x + s.y) / across;
    float d = along - (t * 3.0 * 2.6 - 1.3);
    float band = abs(d) < 0.14 ? 0.65 : (d < -0.24 && d > -0.36 ? 0.3 : 0.0);
    rgb = mix(rgb, colour, lit * 0.75);
    rgb = mix(rgb, white, band);
  } else if (look == 2) {
    rgb = mix(rgb, white, lit * 0.8);
    // A crystal here and there, each lit for a moment in its own time.
    float h = hash(q);
    if (h > 0.88 && fract(time * 0.6 + h * 17.0 + params[4]) < 0.18) rgb = white;
    rgb *= 1.0 - dark * 0.2;
  } else if (look == 3) {
    // The sheen slides down the fruit, slowly, as honey does.
    float t = fract(time / 3.6 + params[4]);
    float d = s.y / across - (t * 2.0 * 1.6 - 0.8);
    float band = abs(d) < 0.12 ? 0.45 : 0.0;
    rgb = mix(rgb, white, max(band, lit * 0.6));
  } else if (look == 4) {
    // Mould in blotches two art pixels across, fixed to the fruit.
    float h = hash(floor(q / 2.0) + 3.0);
    if (h > 0.7) rgb *= vec3(0.55, 0.78, 0.5);
    if (h > 0.93) rgb = mix(rgb, vec3(0.66, 0.79, 0.35), 0.6);
    rgb *= 1.0 - dark * 0.35;
  }
  return vec4(rgb, c.a);
}
