"""
Lays out the game's assets/ from art/ and tools/kenney/:

- art/: every picture, an Aseprite file (.aseprite or .ase; a .png is read too), drawn at its art size (half its size on the
  640 x 360 screen) in the Apollo palette (tools/palette/apollo.hex), every pixel solid or clear. Its visible layers are
  flattened (tools/aseprite.py, so Aseprite need not be installed), checked, then doubled with no smoothing to
  assets/<name>.png (a fruit's to assets/fruit-<kind>.png); a file with more than one frame gives one picture a frame,
  assets/<name>-0.png, <name>-1.png and on. Nothing recolours or redraws it, so what is in art/ is what the game shows. The folders only sort them:
  - fruit/: one picture per fruit, at the size FRUIT_SIZES gives it (each ball's radius is written to src/rules/sizes.ts from
    it, so the physics matches the picture);
  - kitchen/, shop/, items/ and ui/: the rest;
  - palette/light: the light ramp table the fruit's shader (assets/fruit-light.glsl) shades with, copied as it is to
    assets/light.png, not doubled. One row per Apollo colour, in the order of tools/palette/apollo.hex, and LIGHT_STEPS columns:
    that colour in shadow (darker and cooler) on the left, lit (lighter and warmer) on the right, and the colour itself in the
    middle. When the file is missing a first one is worked out (light_table below) and written, to be repainted by hand.
  - screen/: pictures with detail finer than the art's pixel (the Kenney frames and explosion), copied at screen size as they
    are until they are redrawn at art size and moved to another folder.
- tools/kenney/: the sounds (Kenney, CC0), copied as they are; the tally's notes and the entrance sounds are made here.

The text is the engine's built-in fonts (m5x7 and Jersey 10), so there is no font file.

    python3 tools/make-assets.py

npm runs it before `npm run dev`, `build`, `check`, `test` and `package` (the "pre" scripts in package.json), so a saved
picture is in the game the next time it is started.
"""
import math
import shutil
import struct
import wave
import zlib
from pathlib import Path

from PIL import Image

from aseprite import AsepriteError, is_aseprite, read as read_aseprite, write as write_aseprite

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
ART = ROOT / "art"
KENNEY = ROOT / "tools" / "kenney"
SIZES_FILE = ROOT / "src" / "rules" / "sizes.ts"

# Every picture is drawn at twice its size on the screen: an art pixel is 2 x 2 screen pixels.
PX = 2
# Pictures copied at screen size, as they are.
SCREEN_SIZE = "screen"

# The fruit: the size each is drawn at, in art pixels. The size is fixed by the fruit, not the file: the merge ladder grows
# Cherry -> Watermelon, and each ball's radius comes from it. A picture of another size is an error, so a replaced fruit cannot
# change how it plays by accident.
FRUIT_SIZES = {
    "cherry": 16,
    "grape": 20,
    "orange": 24,
    "melon": 28,
    "watermelon": 32,
    "apple": 16,
    "banana": 20,
    "chili": 16,
    "durian": 24,
    "pomegranate": 20,
    "blueberry": 16,
    "lemon": 16,
    "seed": 16,
    "prune": 16,
    "fig": 20,
    "kiwi": 20,
    "peach": 20,
    "honeydew": 24,
    "pitaya": 20,
    "coconut": 24,
    "lime": 20,
    "dragonfruit": 24,
    "snowpear": 20,
    "slice": 20,
    # Wide: it takes two places on the shelf.
    "pumpkin": 36,
    # Drawn at its smallest size: it grows in the jar by being scaled up.
    "gourd": 16,
    # Only made by merging two Watermelons.
    "giantpumpkin": 48,
    "fruitfly": 16,
}

# Clear art pixels round each fruit's picture in assets/ (not in art/): a picture is drawn only inside its rectangle, so a fruit
# drawn to the edge of its square has its edge cut by that rectangle as it turns. The fruit's size and ball are as before.
FRUIT_PAD = 2

# A fruit's ball is a little smaller than its picture's square: the art does not fill the corners. The Fruit Fly's is smaller
# still: it is tiny in its square.
BALL_SHARE = 0.45
SHARES = {"fruitfly": 0.3}

# The Apollo palette (by AdamCYounis, on Lospec): every picture is drawn in its 46 colours, which src/theme.ts names for the UI.
PALETTE = {tuple(int(line[i : i + 2], 16) for i in (0, 2, 4)) for line in (ROOT / "tools" / "palette" / "apollo.hex").read_text().split()}


def off_palette(image: Image.Image) -> str | None:
    """What is wrong with a picture that should be in Apollo colours: its first pixel that is half see-through, or of a colour
    not in the palette (with how many such pixels there are); None when there is nothing."""
    bad = [(x, y, px) for y in range(image.height) for x in range(image.width) if (px := image.getpixel((x, y)))[3] != 0 and (px[3] != 255 or px[:3] not in PALETTE)]
    if not bad:
        return None
    x, y, (r, g, b, a) = bad[0]
    what = f"#{r:02x}{g:02x}{b:02x}" + (f" at {round(100 * a / 255)}% opacity" if a != 255 else "")
    count = "1 pixel" if len(bad) == 1 else f"{len(bad)} pixels"
    return f"{count} off the palette, the first at ({x}, {y}), {what}"


# The light ramp table (art/palette/light.aseprite): a column per step of light, from LIGHT_STEPS // 2 steps of shadow to as many
# of light, the colour itself in the middle; a row per palette colour, in the file's order.
LIGHT_TABLE = ART / "palette" / "light.aseprite"
LIGHT_STEPS = 5
PALETTE_ORDER = [tuple(int(line[i : i + 2], 16) for i in (0, 2, 4)) for line in (ROOT / "tools" / "palette" / "apollo.hex").read_text().split()]
# Colours the light leaves as they are: the fruit's outline (the shader draws an outline in the dark steps of what it is beside).
UNLIT = {(0x24, 0x15, 0x27)}
# The rows painted by hand, for the colours the flat fruit are drawn in, after the placeholders' own shading: shadows go cold
# (red to crimson to violet, yellow to a dusky brown, green to blue-green), lights go warm, and the last step is the shine, a
# touch of near white where the light hits squarely. Every other row is worked out (light_table).
PAINTED = {
    "a53030": ["402751", "752438", "a53030", "cf573c", "ebede9"],  # apple, cherry, chili
    "da863e": ["a53030", "cf573c", "da863e", "de9e41", "e8c170"],  # orange
    "e8c170": ["ad7757", "de9e41", "e8c170", "e7d5b3", "ebede9"],  # lemon
    "de9e41": ["7a4841", "be772b", "de9e41", "e8c170", "e7d5b3"],  # banana
    "3c5e8b": ["1e1d39", "253a5e", "3c5e8b", "4f8fba", "a4dddb"],  # blueberry
    "253a5e": ["10141f", "172038", "253a5e", "3c5e8b", "73bed3"],  # blueberry's crown
    "468232": ["19332d", "25562e", "468232", "75a743", "a8ca58"],  # leaves, stems, the watermelon's dark stripes
    "75a743": ["25562e", "468232", "75a743", "a8ca58", "d0da91"],  # the watermelon's light stripes
    "4d2b32": ["241527", "341c27", "4d2b32", "7a4841", "ad7757"],  # stems
}


def oklab(rgb: tuple[int, int, int]) -> tuple[float, float, float]:
    """An sRGB colour in Oklab (Bjorn Ottosson's): lightness, then green-red and blue-yellow, so distances look like differences."""
    lin = [(c / 255) / 12.92 if c / 255 <= 0.04045 else (((c / 255) + 0.055) / 1.055) ** 2.4 for c in rgb]
    l = 0.4122214708 * lin[0] + 0.5363325363 * lin[1] + 0.0514459929 * lin[2]
    m = 0.2119034982 * lin[0] + 0.6806995451 * lin[1] + 0.1073969566 * lin[2]
    s = 0.0883024619 * lin[0] + 0.2817188376 * lin[1] + 0.6299787005 * lin[2]
    l, m, s = (v ** (1 / 3) for v in (l, m, s))
    return (
        0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
        1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
        0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s,
    )


def light_table() -> Image.Image:
    """
    A first light ramp table: the PAINTED rows as they are, and the rest worked out: each step of shadow a little darker and pulled toward blue-violet, each step of light a
    little lighter and pulled toward yellow-orange (hue shifting, as a painter shades), then snapped to the nearest palette colour
    that is darker (or lighter) than the step before, so a ramp never turns back. Where there is none, the step repeats.
    """
    LIGHTER, WARM, COOL = 0.08, (0.035, 0.07), (0.0, -0.06)
    lab = {colour: oklab(colour) for colour in PALETTE_ORDER}
    table = Image.new("RGBA", (LIGHT_STEPS, len(PALETTE_ORDER)))
    middle = LIGHT_STEPS // 2
    for row, colour in enumerate(PALETTE_ORDER):
        table.putpixel((middle, row), colour + (255,))
        painted = PAINTED.get(bytes(colour).hex())
        if painted is not None and len(painted) == LIGHT_STEPS:
            for step, hex_colour in enumerate(painted):
                table.putpixel((step, row), tuple(bytes.fromhex(hex_colour)) + (255,))
            continue
        for side in (-1, 1):
            previous = colour
            for step in range(1, middle + 1):
                if colour in UNLIT:
                    table.putpixel((middle + side * step, row), colour + (255,))
                    continue
                L, a, b = lab[colour]
                pull = WARM if side > 0 else COOL
                target = (L + side * step * LIGHTER, a + (pull[0] - a) * 0.12 * step, b + (pull[1] - b) * 0.12 * step)
                darker_or_lighter = [c for c in PALETTE_ORDER if (lab[c][0] - lab[previous][0]) * side > 0.02]
                if darker_or_lighter:
                    # Nearest in colour, and as strong a colour as the one it shades: a step that keeps its colour reads better than a
                    # grey exactly as light.
                    strength = math.hypot(a, b)
                    previous = min(
                        darker_or_lighter,
                        key=lambda c: 0.5 * (lab[c][0] - target[0]) ** 2
                        + (lab[c][1] - target[1]) ** 2
                        + (lab[c][2] - target[2]) ** 2
                        + 1.5 * (math.hypot(lab[c][1], lab[c][2]) - strength) ** 2,
                    )
                table.putpixel((middle + side * step, row), previous + (255,))
    return table


def check_light_table(picture: Image.Image, where: Path) -> None:
    """The table must be LIGHT_STEPS wide, a row per palette colour, each row's middle that row's colour."""
    if picture.size != (LIGHT_STEPS, len(PALETTE_ORDER)):
        raise SystemExit(f"{where} is {picture.width} x {picture.height}: the light table is {LIGHT_STEPS} x {len(PALETTE_ORDER)}, a row per palette colour")
    middle = LIGHT_STEPS // 2
    for row, colour in enumerate(PALETTE_ORDER):
        if picture.getpixel((middle, row))[:3] != colour or any(picture.getpixel((x, row))[3] != 255 for x in range(LIGHT_STEPS)):
            raise SystemExit(f"{where}, row {row}: every pixel solid, its middle the palette's colour {row} (#{bytes(colour).hex()}), in the order of tools/palette/apollo.hex")


def read_frames(source: Path) -> list[tuple[str, Image.Image]]:
    """A file's pictures, each with its name: one for a PNG or a one-frame Aseprite file, one a frame (<name>-<i>) for more."""
    if not is_aseprite(source):
        return [(source.stem, Image.open(source).convert("RGBA"))]
    try:
        frames = read_aseprite(source)
    except (AsepriteError, ValueError, struct.error, zlib.error) as error:
        raise SystemExit(f"{source.relative_to(ROOT)}: {error}")
    if len(frames) == 1:
        return [(source.stem, frames[0])]
    return [(f"{source.stem}-{index}", frame) for index, frame in enumerate(frames)]


def write_pictures() -> int:
    """Check every picture in art/ and write it to assets/, doubled (or as it is, from screen/); write the fruit's ball sizes."""
    names: dict[str, Path] = {}
    fruit = []
    if not LIGHT_TABLE.exists():
        LIGHT_TABLE.parent.mkdir(parents=True, exist_ok=True)
        write_aseprite(LIGHT_TABLE, [light_table()], PALETTE_ORDER)
        print(f"wrote a first {LIGHT_TABLE.relative_to(ROOT)}: repaint it as you like")
    sources = sorted(path for path in ART.rglob("*") if path.is_file() and (path.suffix.lower() == ".png" or is_aseprite(path)))
    for source, name, picture in ((source, name, picture) for source in sources for name, picture in read_frames(source)):
        where = source.relative_to(ROOT)
        frame = f" (frame {name.rsplit('-', 1)[1]})" if name != source.stem else ""
        if name in names:
            raise SystemExit(f"{where}{frame} and {names[name].relative_to(ROOT)}: two pictures named {name}")
        names[name] = source
        wrong = off_palette(picture)
        if wrong is not None:
            raise SystemExit(f"{where}{frame}: {wrong}. Pictures are drawn in the Apollo palette (tools/palette/apollo.hex), each pixel solid or clear")
        if source.parent.name == "fruit":
            if name != source.stem:
                raise SystemExit(f"{where} has more than one frame: a fruit is one picture")
            art = FRUIT_SIZES.get(source.stem)
            if art is None:
                raise SystemExit(f"{where}: no fruit is called {source.stem} (FRUIT_SIZES)")
            if picture.size != (art, art):
                raise SystemExit(f"{where} is {picture.width} x {picture.height}: a {source.stem} is drawn at {art} x {art}")
            fruit.append(source.stem)
        if source.parent.name == "palette":
            check_light_table(picture, where)
            picture.save(ASSETS / f"{name}.png")
            continue
        if source.parent.name == "fruit":
            padded = Image.new("RGBA", (picture.width + 2 * FRUIT_PAD, picture.height + 2 * FRUIT_PAD), (0, 0, 0, 0))
            padded.paste(picture, (FRUIT_PAD, FRUIT_PAD))
            picture = padded
        out = picture if source.parent.name == SCREEN_SIZE else picture.resize((picture.width * PX, picture.height * PX), Image.NEAREST)
        out.save(ASSETS / (f"fruit-{name}.png" if source.parent.name == "fruit" else f"{name}.png"))
    missing = [kind for kind in FRUIT_SIZES if kind not in fruit]
    if missing:
        raise SystemExit(f"no picture in art/fruit for {', '.join(missing)}")
    lines = [f"  {kind}: {{ size: {art * PX}, radius: {round(art * PX * SHARES.get(kind, BALL_SHARE))} }}," for kind, art in FRUIT_SIZES.items()]
    SIZES_FILE.write_text(
        "/** Written by tools/make-assets.py: each fruit's sprite size and its ball's radius, in pixels. Do not edit. */\n"
        "export const FRUIT_ART = {\n" + "\n".join(lines) + "\n} as const;\n"
        f"/** The clear margin round each fruit's picture, in pixels each side, so it can turn without its edge being cut. */\nexport const FRUIT_PAD = {FRUIT_PAD * PX};\n"
    )
    return len(names)


# The tally's notes, made here and not taken from a pack: eight steps up a pentatonic scale from C5, so each score of a tally
# rings one higher than the last and any run of them is in tune. Each is a small bell: the note, an octave and a fifth over it
# and a faint inharmonic partial, struck at once and dying away in about a third of a second.
SCORE_NOTES = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51]
SCORE_RATE = 22050


def write_score_notes() -> None:
    import math
    import struct
    import wave

    for index, pitch in enumerate(SCORE_NOTES):
        frames = int(SCORE_RATE * 0.42)
        samples = []
        for n in range(frames):
            t = n / SCORE_RATE
            # Struck at once, and faded to nothing over its last 30 ms so it does not end on a click.
            attack = min(1.0, t / 0.004) * min(1.0, (frames - n) / (SCORE_RATE * 0.03))
            body = math.sin(2 * math.pi * pitch * t) * math.exp(-t * 9.0)
            octave = 0.35 * math.sin(2 * math.pi * pitch * 2 * t) * math.exp(-t * 13.0)
            fifth = 0.2 * math.sin(2 * math.pi * pitch * 3 * t) * math.exp(-t * 18.0)
            ring = 0.12 * math.sin(2 * math.pi * pitch * 4.2 * t) * math.exp(-t * 26.0)
            samples.append(int(max(-1.0, min(1.0, 0.55 * attack * (body + octave + fifth + ring))) * 32767))
        with wave.open(str(ASSETS / f"score-{index}.wav"), "wb") as out:
            out.setnchannels(1)
            out.setsampwidth(2)
            out.setframerate(SCORE_RATE)
            out.writeframes(struct.pack(f"<{len(samples)}h", *samples))


def write_last_turn() -> None:
    """The last turn's sound: a quick rising whoosh of filtered noise into two struck low notes a fifth apart, a drum roll's weight without a drum."""
    import math
    import random
    import struct
    import wave

    rng = random.Random(5)
    frames = int(SCORE_RATE * 0.7)
    samples = []
    smooth = 0.0
    for n in range(frames):
        t = n / SCORE_RATE
        # The whoosh: noise through a low-pass that opens, swelling over the first 0.22 s and cut off as the notes strike.
        swell = min(1.0, t / 0.22) ** 2 if t < 0.22 else math.exp(-(t - 0.22) * 30.0)
        smooth += (rng.uniform(-1.0, 1.0) - smooth) * (0.05 + 0.5 * min(1.0, t / 0.22))
        whoosh = 0.5 * swell * smooth
        # The strike: G3 and D4 together, with a little of the octave, dying away.
        s = max(0.0, t - 0.22)
        struck = 0.0 if t < 0.22 else math.exp(-s * 6.0) * (math.sin(2 * math.pi * 196.0 * s) + 0.7 * math.sin(2 * math.pi * 293.66 * s) + 0.3 * math.sin(2 * math.pi * 392.0 * s))
        fade = min(1.0, (frames - n) / (SCORE_RATE * 0.03))
        samples.append(int(max(-1.0, min(1.0, fade * (whoosh + 0.4 * struck))) * 32767))
    with wave.open(str(ASSETS / "last.wav"), "wb") as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(SCORE_RATE)
        out.writeframes(struct.pack(f"<{len(samples)}h", *samples))


def write_wave(name: str, samples: list[float]) -> None:
    import struct
    import wave

    tail = int(SCORE_RATE * 0.02)
    out = [int(max(-1.0, min(1.0, v * min(1.0, (len(samples) - n) / tail))) * 32767) for n, v in enumerate(samples)]
    with wave.open(str(ASSETS / name), "wb") as file:
        file.setnchannels(1)
        file.setsampwidth(2)
        file.setframerate(SCORE_RATE)
        file.writeframes(struct.pack(f"<{len(out)}h", *out))


def write_entrance_sounds() -> None:
    """Sounds for things arriving: five bloops, each higher than the last, for boards, cards and buttons popping in one after
    another; a soft wooden tock for a fruit rolling to its place on the shelf; and a low thud for the jar landing."""
    import math
    import random

    # A bloop: a round tone that starts a third high and drops to its note in a twentieth of a second, like a bubble.
    for index, pitch in enumerate([392.0, 440.0, 523.25, 587.33, 659.25]):
        samples = []
        phase = 0.0
        for n in range(int(SCORE_RATE * 0.14)):
            t = n / SCORE_RATE
            now = pitch * (1.0 + 0.35 * math.exp(-t * 45.0))
            phase += 2 * math.pi * now / SCORE_RATE
            samples.append(0.5 * min(1.0, t / 0.003) * math.exp(-t * 22.0) * (math.sin(phase) + 0.2 * math.sin(2 * phase)))
        write_wave(f"pop-{index}.wav", samples)

    # A tock: a woodblock's short knock, a tone and its uneven overtone gone in a few hundredths of a second, under a tick of noise.
    rng = random.Random(11)
    samples = []
    for n in range(int(SCORE_RATE * 0.09)):
        t = n / SCORE_RATE
        knock = math.sin(2 * math.pi * 330.0 * t) * math.exp(-t * 55.0) + 0.5 * math.sin(2 * math.pi * 912.0 * t) * math.exp(-t * 90.0)
        samples.append(0.5 * knock + 0.15 * rng.uniform(-1.0, 1.0) * math.exp(-t * 400.0))
    write_wave("tock.wav", samples)

    # A thud: a low tone falling from 110 Hz as it dies, with a short burst of dull noise at the start.
    rng = random.Random(3)
    samples = []
    phase = 0.0
    dull = 0.0
    for n in range(int(SCORE_RATE * 0.3)):
        t = n / SCORE_RATE
        phase += 2 * math.pi * (60.0 + 50.0 * math.exp(-t * 18.0)) / SCORE_RATE
        dull += (rng.uniform(-1.0, 1.0) - dull) * 0.12
        samples.append(0.8 * math.sin(phase) * math.exp(-t * 13.0) + 0.5 * dull * math.exp(-t * 60.0))
    write_wave("thud.wav", samples)


SOUNDS = {
    "merge.wav": "interface-sounds-glass-001.wav",
    "land.wav": "impact-sounds-impact-soft-medium-000.wav",
    "boom.wav": "impact-sounds-impact-punch-heavy-000.wav",
    "pick.wav": "interface-sounds-confirmation-001.wav",
    "rent.wav": "digital-audio-power-up-2.wav",
    "lose.wav": "interface-sounds-error-004.wav",
    "tick.wav": "interface-sounds-tick-002.wav",
    "click.wav": "interface-sounds-click-002.wav",
    # The music: Farm Frolics, from Music Loops.
    "theme.ogg": "music-loops-farm-frolics.ogg",
}


def main() -> None:
    ASSETS.mkdir(exist_ok=True)
    pictures = write_pictures()
    for name, source in SOUNDS.items():
        shutil.copyfile(KENNEY / source, ASSETS / name)
    write_score_notes()
    write_last_turn()
    write_entrance_sounds()
    print(f"wrote {pictures} pictures and {len(SOUNDS)} sounds (the music among them), and made the tally's notes and the entrance sounds")


if __name__ == "__main__":
    main()
