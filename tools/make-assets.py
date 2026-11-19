"""
Lays out the game's assets/ from the free art in tools/:

- tools/fruit/fruit-sheet.png: 16 x 16 pixel fruit. Each fruit is scaled up with no smoothing to its size in the jar,
  fruit-<kind>.png, to a 32-pixel icon for the shelf and the pool, icon-<kind>.png, and to 64 pixels for the pick cards,
  big-<kind>.png; its ball's radius is written to src/rules/sizes.ts, so the physics matches the picture.
- tools/kenney/: Kenney's CC0 assets (from the Kenney Game Assets All-in-1 bundle, and sounds from the tse repo's games):
  - the sounds, copied as they are;
  - pixel art only: UI Pack - Pixel Adventure frames and the ribbon (ADVENTURE), Pattern Pack Pixel's trellis (the wallpaper),
    Pixel Platformer's coin, and the Explosion Pack's pixel explosion.
- Drawn here, in Apollo colours at the same 2x pixel: the kitchen (the wallpaper over a wooden counter), the jar's glass (a
  back, behind the fruit, and a front with its shine and fill line, over them), the shelf, the key caps and the items.

The text is the engine's built-in fonts (m5x7 and Jersey 10), so there is no font file.

    python3 tools/make-assets.py
"""
import shutil
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
KENNEY = ROOT / "tools" / "kenney"

# The fruit: 16 x 16 pixel sprites from tools/fruit/fruit-sheet.png (38 columns x 6 rows). Each kind is (column, row, scale):
# the scale is how many screen pixels an art pixel takes, so the merge ladder grows Cherry -> Watermelon. Whole scales stay
# crisp; Grape (2.5) and Melon (3.5) sit between them, as the ladder needs five sizes. No sprite exists for a Durian (the
# Pineapple stands in), a Seed (the brown Kiwi), a Melon (the round green one), a Prune (the Blackberry), a Fig (the Aubergine)
# or a Honeydew (the golden Apple).
FRUIT_SPRITES = {
    "cherry": (14, 1, 2),
    "grape": (5, 1, 2.5),
    "orange": (9, 1, 3),
    "melon": (17, 1, 3.5),
    "watermelon": (26, 2, 4),
    "apple": (0, 1, 2.5),
    "banana": (7, 1, 2.5),
    "chili": (30, 1, 2),
    "durian": (11, 1, 3),
    "pomegranate": (13, 1, 2.5),
    "blueberry": (16, 1, 2),
    "lemon": (18, 1, 2),
    "seed": (19, 1, 2),
    "prune": (36, 1, 2),
    "fig": (25, 2, 2.5),
    "kiwi": (19, 2, 2.5),
    "peach": (12, 0, 2.5),
    "honeydew": (2, 1, 3),
    "pitaya": (20, 0, 2.5),
    "coconut": (22, 1, 3),
    "lime": (17, 2, 2.5),
    "dragonfruit": (21, 1, 3),
    "snowpear": (10, 1, 2.5),
}
# The Fruit Fly is not on the sheet: it is drawn here (`fruit_fly`), 16 x 16 like the others, at 2x.
FLY_SCALE = 2
FRUIT_SHEET = ROOT / "tools" / "fruit" / "fruit-sheet.png"
SIZES_FILE = ROOT / "src" / "rules" / "sizes.ts"
# A fruit's ball is a little smaller than its sprite's square: the art does not fill the corners. The Fruit Fly's is smaller
# still: it is tiny in its square.
BALL_SHARE = 0.45
FLY_SHARE = 0.3

SOUNDS = {
    "merge.wav": "interface-sounds-glass-001.wav",
    "land.wav": "impact-sounds-impact-soft-medium-000.wav",
    "boom.wav": "impact-sounds-impact-punch-heavy-000.wav",
    "pick.wav": "interface-sounds-confirmation-001.wav",
    "rent.wav": "digital-audio-power-up-2.wav",
    "lose.wav": "interface-sounds-error-004.wav",
    "tick.wav": "interface-sounds-tick-002.wav",
    # The music: Farm Frolics, from Music Loops.
    "theme.ogg": "music-loops-farm-frolics.ogg",
}


# Every picture is snapped to one palette, Apollo (tools/palette/apollo.hex, by AdamCYounis on Lospec): each pixel becomes the
# nearest of its 46 colours, so the fruit and the Kenney pieces share one set of colours with the UI (src/theme.ts).
PALETTE = [tuple(int(line[i : i + 2], 16) for i in (0, 2, 4)) for line in (ROOT / "tools" / "palette" / "apollo.hex").read_text().split()]


def to_palette(image: Image.Image) -> Image.Image:
    out = image.convert("RGBA").copy()
    px = out.load()
    cache: dict[tuple[int, int, int], tuple[int, int, int]] = {}
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a < 128:
                px[x, y] = (0, 0, 0, 0)
                continue
            key = (r, g, b)
            if key not in cache:
                cache[key] = min(PALETTE, key=lambda c: (c[0] - r) ** 2 + (c[1] - g) ** 2 + (c[2] - b) ** 2)
            px[x, y] = (*cache[key], 255)
    return out


def hexes(*codes: str) -> list[tuple[int, int, int]]:
    return [tuple(int(c[i : i + 2], 16) for i in (1, 3, 5)) for c in codes]


# Ramps of Apollo colours, darkest first. A Kenney UI piece keeps its shading but takes a ramp's colours: its own colours,
# ordered by brightness, are spread over the ramp (`recolor`).
RAMPS = {
    "frame": hexes("#341c27", "#7a4841", "#ad7757", "#e7d5b3"),
    "frame-chosen": hexes("#602c2c", "#be772b", "#de9e41", "#e8c170"),
    "select": hexes("#602c2c", "#be772b", "#de9e41", "#e8c170"),
    "plaque": hexes("#090a14", "#10141f", "#151d28", "#394a50"),
    "ribbon": hexes("#241527", "#752438", "#a53030", "#cf573c", "#e7d5b3"),
    "wallpaper": hexes("#151d28", "#172038"),
}

# UI Pack - Pixel Adventure, large tiles with a thick outline: 32 x 32 tiles, packed, already drawn with 2 x 2 art pixels, so
# they are used as they are. Each piece is (column, row, tiles across, ramp), drawn as a 9-slice in the game.
ADVENTURE = {
    "frame.png": (0, 0, 1, "frame"),  # parchment in a wooden frame: boards, cards, menu buttons
    "frame-chosen.png": (0, 0, 1, "frame-chosen"),  # the same in amber: the chosen one
    "select.png": (6, 2, 1, "select"),  # an empty amber frame: around the chosen fruit on the shelf
    "plaque.png": (3, 0, 1, "plaque"),  # dark slate: the note of what just happened
    "ribbon.png": (4, 3, 3, "ribbon"),  # the red ribbon: headings
}
# Pattern Pack Pixel, greyscale: 16 x 16 tiles, packed. The wallpaper is tile (0, 2), a thin trellis, in two close navy blues.
WALLPAPER = (0, 2)

def brightness(c: tuple[int, int, int]) -> float:
    return 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]


def recolor(image: Image.Image, ramp: list[tuple[int, int, int]]) -> Image.Image:
    out = image.convert("RGBA").copy()
    px = out.load()
    colours = sorted({px[x, y][:3] for y in range(out.height) for x in range(out.width) if px[x, y][3] >= 128}, key=brightness)
    if not colours:
        return out
    lo, hi = brightness(colours[0]), brightness(colours[-1])
    to = {c: ramp[round((brightness(c) - lo) / max(1e-9, hi - lo) * (len(ramp) - 1))] for c in colours}
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            px[x, y] = (*to[(r, g, b)], 255) if a >= 128 else (0, 0, 0, 0)
    return out


# Every Kenney picture is pixel art, drawn at exactly twice its size on the 640 x 360 screen (nearest neighbour), so its pixels
# match the font's and each other's.
PX = 2
WIDTH, HEIGHT = 640, 360
ICON = 32
# The pick screen's cards show each fruit at 4x.
BIG = 64

EXPLOSION_FRAMES = 9
BOOM_SIZE = 96


def doubled(image: Image.Image) -> Image.Image:
    return image.resize((image.width * PX, image.height * PX), Image.NEAREST)


def colour(code: str) -> tuple[int, int, int, int]:
    rgb = hexes(code)[0]
    assert rgb in PALETTE, f"{code} is not an Apollo colour"
    return (*rgb, 255)


# The jar, as src/rules/jar.ts has it (JAR and RIM), in art pixels (half the screen's): its inside, the line fruit must stay
# under, and where its glass starts. The glass is 3 art pixels thick, and the pictures reach MARGIN art pixels outside the walls.
JAR_LEFT, JAR_RIGHT, JAR_FLOOR, JAR_RIM, JAR_TOP = 112, 208, 168, 52, 36
GLASS = 3
MARGIN = 6
# How far the mouth's rim reaches above and below the glass's top.
MOUTH = 4
# Where the counter's top starts, where its front starts, in art pixels: the jar's foot stands on the top.
COUNTER_TOP, COUNTER_FRONT = 162, 173


def wallpaper() -> Image.Image:
    """The kitchen's wall: trellis wallpaper in two navy blues, a tile bigger than the screen each way, so the game can let it
    drift by less than a tile and wrap with no seam."""
    sheet = Image.open(KENNEY / "pattern-pack-pixel-grayscale.png").convert("RGBA")
    tile = recolor(sheet.crop((WALLPAPER[0] * 16, WALLPAPER[1] * 16, WALLPAPER[0] * 16 + 16, WALLPAPER[1] * 16 + 16)), RAMPS["wallpaper"])
    w, h = WIDTH // PX + 16, HEIGHT // PX + 16
    out = Image.new("RGBA", (w, h))
    for y in range(0, h, 16):
        for x in range(0, w, 16):
            out.paste(tile, (x, y))
    return doubled(out)


def counter() -> Image.Image:
    """The kitchen's counter, drawn over the wall: a skirting shadow, then wood seen a little from above (its top, then its
    front). The size of the screen, and clear above the shadow."""
    w, h = WIDTH // PX, HEIGHT // PX
    out = Image.new("RGBA", (w, h))
    draw = ImageDraw.Draw(out)
    # The wall darkens to the counter: a dithered row, then two dark ones.
    for x in range(0, w, 2):
        out.putpixel((x, COUNTER_TOP - 3), colour("#10141f"))
    draw.rectangle((0, COUNTER_TOP - 2, w, COUNTER_TOP - 1), fill=colour("#10141f"))
    # The top: light wood, a lighter back edge, and short grain lines.
    draw.rectangle((0, COUNTER_TOP, w, COUNTER_FRONT - 1), fill=colour("#c09473"))
    draw.line((0, COUNTER_TOP, w, COUNTER_TOP), fill=colour("#d7b594"))
    for i, x in enumerate(range(5, w, 23)):
        y = COUNTER_TOP + 2 + (i * 5) % 8
        draw.line((x, y, x + 9 + (i * 7) % 6, y), fill=colour("#ad7757"))
    # The front: a lit edge, darker wood, plank seams and a shadow along the bottom.
    draw.rectangle((0, COUNTER_FRONT, w, h), fill=colour("#7a4841"))
    draw.line((0, COUNTER_FRONT, w, COUNTER_FRONT), fill=colour("#e7d5b3"))
    draw.line((0, COUNTER_FRONT + 1, w, COUNTER_FRONT + 1), fill=colour("#ad7757"))
    draw.line((0, h - 1, w, h - 1), fill=colour("#4d2b32"))
    for x in range(31, w, 64):
        draw.line((x, COUNTER_FRONT + 2, x, h), fill=colour("#4d2b32"))
    return doubled(out)


def jar_pictures() -> tuple[Image.Image, Image.Image]:
    """The jar, drawn twice: its back (the tinted inside, the glass walls, the far side of its mouth and its shadow on the counter), behind
    the fruit, and its front (the near side of its mouth, the shine, the screw thread and the dashed fill line), over them. Both are the same size, with
    the jar's inside left wall MARGIN art pixels in and its glass top MARGIN down."""
    w = JAR_RIGHT - JAR_LEFT + MARGIN * 2
    h = JAR_FLOOR - JAR_TOP + MARGIN * 2
    left, right, top, floor, rim = MARGIN, w - MARGIN, MARGIN, h - MARGIN, MARGIN + JAR_RIM - JAR_TOP
    back = Image.new("RGBA", (w, h))
    draw = ImageDraw.Draw(back)
    # Its shadow on the counter, to the right.
    draw.rectangle((left, floor + GLASS, w - 1, floor + GLASS + 1), fill=colour("#ad7757"))
    draw.rectangle((left - 1, floor + GLASS - 1, w - 3, floor + GLASS), fill=colour("#ad7757"))
    # The glass: an outer line, a bright middle and an inner line, with the foot's corners rounded; then the tinted inside.
    for inset, code in ((0, "#4f8fba"), (1, "#a4dddb"), (2, "#3c5e8b")):
        draw.rounded_rectangle((left - GLASS + inset, top - 8, right + GLASS - 1 - inset, floor + GLASS - 1 - inset), radius=4 - inset, fill=colour(code))
    draw.rectangle((left, 0, right - 1, floor - 1), fill=colour("#202e37"))
    draw.rectangle((0, 0, w, top - 1), fill=(0, 0, 0, 0))
    # Darker glass low down and a soft reflection up each side.
    draw.rectangle((left, floor - 2, right - 1, floor - 1), fill=colour("#151d28"))
    draw.rectangle((left + 3, rim + 4, left + 5, floor - 8), fill=colour("#253a5e"))
    draw.rectangle((right - 4, rim + 30, right - 3, floor - 6), fill=colour("#253a5e"))
    # The mouth, seen a little from above like the counter: the far half of its rim, and the inside showing under it.
    mouth = (left - GLASS, top - MOUTH, right + GLASS - 1, top + MOUTH)
    draw.chord(mouth, 180, 360, fill=colour("#202e37"))
    draw.arc(mouth, 180, 360, fill=colour("#3c5e8b"))

    front = Image.new("RGBA", (w, h))
    draw = ImageDraw.Draw(front)
    # The near half of the rim, lit, with a darker line under it; then the screw thread: two broken lines round the neck.
    draw.arc((mouth[0], mouth[1] + 1, mouth[2], mouth[3] + 1), 0, 180, fill=colour("#4f8fba"))
    draw.arc(mouth, 0, 180, fill=colour("#a4dddb"))
    draw.arc(mouth, 60, 120, fill=colour("#ebede9"))
    for y, start in ((top + MOUTH + 4, 0), (top + MOUTH + 7, 6)):
        for x in range(left + start, right - 6, 12):
            draw.line((x, y, x + 6, y), fill=colour("#3c5e8b"))
    # The fill line: dashes across, and a tick on each wall.
    for x in range(left + 2, right - 3, 5):
        draw.line((x, rim, x + 2, rim), fill=colour("#cf573c"))
    for x in (left - GLASS, right):
        draw.line((x, rim, x + GLASS - 1, rim), fill=colour("#cf573c"))
    # The shine: a long streak and a short one down the left, a glint low on the right.
    draw.line((left + 4, rim + 6, left + 4, rim + 44), fill=colour("#a4dddb"))
    draw.line((left + 4, rim + 8, left + 4, rim + 20), fill=colour("#ebede9"))
    draw.line((left + 4, rim + 50, left + 4, rim + 56), fill=colour("#a4dddb"))
    draw.line((right - 4, floor - 22, right - 4, floor - 10), fill=colour("#73bed3"))
    return doubled(back), doubled(front)


def shelf(width: int) -> Image.Image:
    """The shelf the hand waits on: a plank, `width` art pixels long."""
    out = Image.new("RGBA", (width, 6))
    draw = ImageDraw.Draw(out)
    draw.rectangle((0, 0, width - 1, 5), fill=colour("#341c27"))
    draw.rectangle((1, 1, width - 2, 4), fill=colour("#ad7757"))
    draw.line((1, 1, width - 2, 1), fill=colour("#d7b594"))
    draw.line((1, 4, width - 2, 4), fill=colour("#7a4841"))
    return doubled(out)


def key_cap(width: int = 8, arrow: str = "") -> Image.Image:
    """A key cap, 13 art pixels tall: a lit top edge, a face tall enough for a line of text, and a lip. With no arrow it is a
    9-slice the game writes the key's name on; with one ("left", "right", "up", "down") it is 13 wide with the arrow on it."""
    out = Image.new("RGBA", (width, 13))
    draw = ImageDraw.Draw(out)
    draw.rounded_rectangle((0, 0, width - 1, 12), radius=1, fill=colour("#202e37"))
    draw.rectangle((1, 1, width - 2, 9), fill=colour("#c7cfcc"))
    draw.line((1, 1, width - 2, 1), fill=colour("#ebede9"))
    draw.rectangle((1, 10, width - 2, 11), fill=colour("#a8b5b2"))
    # The arrow: a 5 x 3 wedge about (6, 5), pointing its way.
    for i in range(3):
        for j in range(-i, i + 1):
            dx, dy = {"left": (i - 1, j), "right": (1 - i, j), "up": (j, i - 1), "down": (j, 1 - i)}.get(arrow, (None, None))
            if dx is not None:
                out.putpixel((6 + dx, 5 + dy), colour("#202e37"))
    return out


def key_pair(first: str, second: str) -> Image.Image:
    """Two arrow keys side by side, an art pixel apart."""
    out = Image.new("RGBA", (27, 13))
    out.paste(key_cap(13, first), (0, 0))
    out.paste(key_cap(13, second), (14, 0))
    return doubled(out)


# The items: each on a 24 x 20 art-pixel picture, standing on its bottom edge.
ITEM_W, ITEM_H = 24, 20


def item_lid() -> Image.Image:
    """The Lid: a brass screw lid seen a little from above, its top lit and its side ridged."""
    out = Image.new("RGBA", (ITEM_W, ITEM_H))
    draw = ImageDraw.Draw(out)
    draw.rounded_rectangle((0, 10, 23, 19), radius=2, fill=colour("#341c27"))
    draw.rectangle((1, 12, 22, 18), fill=colour("#be772b"))
    for x in range(3, 22, 3):
        draw.line((x, 14, x, 18), fill=colour("#884b2b"))
    draw.ellipse((0, 6, 23, 14), fill=colour("#341c27"))
    draw.ellipse((1, 7, 22, 13), fill=colour("#e8c170"))
    draw.ellipse((4, 8, 19, 12), fill=colour("#de9e41"))
    draw.line((6, 8, 12, 8), fill=colour("#e7d5b3"))
    return doubled(out)


def item_juicer() -> Image.Image:
    """The Juicer: a glass citrus reamer, a ridged cone standing in a dish."""
    out = Image.new("RGBA", (ITEM_W, ITEM_H))
    draw = ImageDraw.Draw(out)
    draw.polygon(((11, 1), (12, 1), (18, 13), (5, 13)), fill=colour("#253a5e"))
    draw.polygon(((11, 2), (12, 2), (17, 13), (6, 13)), fill=colour("#73bed3"))
    for x, top in ((9, 6), (11, 3), (14, 7)):
        draw.line((x, top, x, 13), fill=colour("#a4dddb"))
    draw.line((12, 4, 16, 13), fill=colour("#4f8fba"))
    draw.rounded_rectangle((0, 12, 23, 19), radius=3, fill=colour("#253a5e"))
    draw.rounded_rectangle((1, 13, 22, 18), radius=2, fill=colour("#4f8fba"))
    draw.line((2, 13, 21, 13), fill=colour("#a4dddb"))
    draw.line((3, 17, 20, 17), fill=colour("#3c5e8b"))
    return doubled(out)


def item_shaker() -> Image.Image:
    """The Shaker: a steel cocktail shaker, a tapered tin under a cap."""
    out = Image.new("RGBA", (ITEM_W, ITEM_H))
    draw = ImageDraw.Draw(out)
    draw.polygon(((6, 7), (17, 7), (15, 19), (8, 19)), fill=colour("#202e37"))
    draw.polygon(((7, 8), (16, 8), (14, 18), (9, 18)), fill=colour("#a8b5b2"))
    draw.line((9, 8, 10, 18), fill=colour("#ebede9"))
    draw.line((14, 8, 13, 18), fill=colour("#577277"))
    draw.rounded_rectangle((7, 3, 16, 8), radius=1, fill=colour("#202e37"))
    draw.rectangle((8, 4, 15, 7), fill=colour("#c7cfcc"))
    draw.rounded_rectangle((9, 0, 14, 4), radius=1, fill=colour("#202e37"))
    draw.rectangle((10, 1, 13, 3), fill=colour("#a8b5b2"))
    draw.point((10, 1), fill=colour("#ebede9"))
    return doubled(out)


def item_preserves(jam: str = "#a53030", shine: str = "#cf573c", lid: tuple[str, str] = ("#cf573c", "#e7d5b3"), wide: int = 0) -> Image.Image:
    """The Preserves Jar: a small jar of red jam under a gingham cloth lid. The Big Preserves Jar is `wide` art pixels wider each
    side; the Pickling Jar is green, under a plain lid."""
    out = Image.new("RGBA", (ITEM_W, ITEM_H))
    draw = ImageDraw.Draw(out)
    left, right = 5 - wide, 18 + wide
    draw.rounded_rectangle((left, 6, right, 19), radius=2, fill=colour("#341c27"))
    draw.rounded_rectangle((left + 1, 7, right - 1, 18), radius=1, fill=colour("#73bed3"))
    draw.rectangle((left + 1, 10, right - 1, 18), fill=colour(jam))
    draw.line((left + 1, 10, right - 1, 10), fill=colour(shine))
    draw.line((left + 3, 9, left + 3, 16), fill=colour("#e7d5b3"))
    draw.rounded_rectangle((left - 1, 1, right + 1, 7), radius=1, fill=colour("#341c27"))
    for y in range(2, 7):
        for x in range(left, right + 1):
            draw.point((x, y), fill=colour(lid[0] if (x // 2 + y // 2) % 2 == 0 else lid[1]))
    return doubled(out)


def item_bigpreserves() -> Image.Image:
    return item_preserves(wide=3)


def item_pickling() -> Image.Image:
    return item_preserves(jam="#468232", shine="#75a743", lid=("#a8b5b2", "#a8b5b2"))


def peg() -> Image.Image:
    """The boss jar's peg, 22 x 22 art pixels (PEG.r in src/rules/jar.ts is its radius on screen): a wooden post seen end on."""
    out = Image.new("RGBA", (22, 22))
    draw = ImageDraw.Draw(out)
    draw.ellipse((0, 0, 21, 21), fill=colour("#341c27"))
    draw.ellipse((1, 1, 20, 20), fill=colour("#ad7757"))
    draw.ellipse((4, 4, 17, 17), outline=colour("#7a4841"))
    draw.ellipse((7, 7, 14, 14), outline=colour("#7a4841"))
    draw.rectangle((10, 10, 11, 11), fill=colour("#7a4841"))
    draw.arc((1, 1, 20, 20), 180, 280, fill=colour("#d7b594"))
    return doubled(out)


def pointer() -> Image.Image:
    """A gold arrow pointing down, 9 x 7 art pixels: over the fruit the Preserves Jar's cursor is on."""
    out = Image.new("RGBA", (9, 7))
    draw = ImageDraw.Draw(out)
    draw.polygon(((0, 0), (8, 0), (8, 2), (4, 6), (0, 2)), fill=colour("#341c27"))
    draw.polygon(((1, 1), (7, 1), (4, 4)), fill=colour("#e8c170"))
    draw.line((2, 1, 6, 1), fill=colour("#e7d5b3"))
    return doubled(out)


def fruit_fly() -> Image.Image:
    """The Fruit Fly, 16 x 16 art pixels: a dark body, a red eye and two pale wings."""
    out = Image.new("RGBA", (16, 16))
    draw = ImageDraw.Draw(out)
    for box in ((2, 3, 7, 8), (8, 3, 13, 8)):
        draw.ellipse(box, fill=colour("#577277"))
        draw.ellipse((box[0] + 1, box[1] + 1, box[2] - 1, box[3] - 1), fill=colour("#c7cfcc"))
    draw.ellipse((5, 6, 10, 12), fill=colour("#241527"))
    draw.rectangle((6, 8, 9, 10), fill=colour("#4d2b32"))
    draw.rectangle((6, 4, 9, 6), fill=colour("#241527"))
    draw.point((6, 5), fill=colour("#cf573c"))
    draw.point((9, 5), fill=colour("#cf573c"))
    return out


def coin() -> Image.Image:
    """Pixel Platformer's gold coin (tile 11, 7 of its 18 x 18 packed tiles)."""
    tiles = Image.open(KENNEY / "pixel-platformer-tiles.png").convert("RGBA")
    picture = tiles.crop((11 * 18, 7 * 18, 12 * 18, 8 * 18))
    return doubled(picture.crop(picture.getbbox()))


def main() -> None:
    ASSETS.mkdir(exist_ok=True)
    sheet = to_palette(Image.open(FRUIT_SHEET))
    lines = []
    sprites = {kind: (sheet.crop((col * 16, row * 16, col * 16 + 16, row * 16 + 16)), scale, BALL_SHARE) for kind, (col, row, scale) in FRUIT_SPRITES.items()}
    sprites["fruitfly"] = (fruit_fly(), FLY_SCALE, FLY_SHARE)
    for kind, (sprite, scale, share) in sprites.items():
        size = round(16 * scale)
        sprite.resize((size, size), Image.NEAREST).save(ASSETS / f"fruit-{kind}.png")
        sprite.resize((ICON, ICON), Image.NEAREST).save(ASSETS / f"icon-{kind}.png")
        sprite.resize((BIG, BIG), Image.NEAREST).save(ASSETS / f"big-{kind}.png")
        lines.append(f"  {kind}: {{ size: {size}, radius: {round(size * share)} }},")
    SIZES_FILE.write_text(
        "/** Written by tools/make-assets.py: each fruit's sprite size and its ball's radius, in pixels. Do not edit. */\n"
        "export const FRUIT_ART = {\n" + "\n".join(lines) + "\n} as const;\n"
    )
    to_palette(coin()).save(ASSETS / "coin.png")
    adventure = Image.open(KENNEY / "ui-pixel-adventure-large-thick.png").convert("RGBA")
    for name, (col, row, across, ramp) in ADVENTURE.items():
        recolor(adventure.crop((col * 32, row * 32, (col + across) * 32, row * 32 + 32)), RAMPS[ramp]).save(ASSETS / name)
    doubled(key_cap()).save(ASSETS / "key.png")
    key_pair("left", "right").save(ASSETS / "key-arrows.png")
    key_pair("up", "down").save(ASSETS / "key-updown.png")
    for name, picture in (
        ("lid", item_lid),
        ("juicer", item_juicer),
        ("shaker", item_shaker),
        ("preserves", item_preserves),
        ("bigpreserves", item_bigpreserves),
        ("pickling", item_pickling),
    ):
        picture().save(ASSETS / f"item-{name}.png")
    pointer().save(ASSETS / "pointer.png")
    peg().save(ASSETS / "peg.png")
    wallpaper().save(ASSETS / "wall.png")
    counter().save(ASSETS / "counter.png")
    back, front = jar_pictures()
    back.save(ASSETS / "jar-back.png")
    front.save(ASSETS / "jar-front.png")
    shelf(104).save(ASSETS / "shelf.png")
    # The explosion's frames (96 x 91) are centred on a 96 x 96 square so they share one origin.
    for i in range(EXPLOSION_FRAMES):
        frame = to_palette(Image.open(KENNEY / f"explosion-pixel-0{i}.png"))
        square = Image.new("RGBA", (BOOM_SIZE, BOOM_SIZE))
        square.paste(frame, ((BOOM_SIZE - frame.width) // 2, (BOOM_SIZE - frame.height) // 2))
        square.save(ASSETS / f"boom-{i}.png")
    for name, source in SOUNDS.items():
        shutil.copyfile(KENNEY / source, ASSETS / name)
    print(f"wrote {len(sprites) * 3} fruit images, the kitchen, the jar, the shelf, {len(ADVENTURE)} frames, the keys, the coin, the blast and {len(SOUNDS)} sounds (the music among them)")


if __name__ == "__main__":
    main()
