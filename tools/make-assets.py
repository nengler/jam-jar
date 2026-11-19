"""
Lays out the game's assets/ from the free art in tools/:

- tools/fruit/fruit-sheet.png: 16 x 16 pixel fruit. Each fruit is scaled up with no smoothing to its size in the jar,
  fruit-<kind>.png, and to a 32-pixel icon for the hand and pick lists, icon-<kind>.png; its ball's radius is written to
  src/rules/sizes.ts, so the physics matches the picture.
- tools/kenney/: Kenney's CC0 assets (from the Kenney Game Assets All-in-1 bundle, and sounds from the tse repo's games):
  - the sounds, copied as they are;
  - `kenney-mini-square-mono.ttf` (Kenney Fonts), drawn at twice its pixel size into `font.png`: the ASCII characters 32 to
    127 in a 16 x 6 grid of 12 x 16 cells, as tse's `<Text font>` takes;
  - pixel art only, doubled with no smoothing: UI Pixel Pack panels and buttons (UI_TILES), Pixel Platformer's sky, clouds and
    ground and its coin, and the Explosion Pack's pixel explosion.

    python3 tools/make-assets.py
"""
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
KENNEY = ROOT / "tools" / "kenney"

# The fruit: 16 x 16 pixel sprites from tools/fruit/fruit-sheet.png (38 columns x 6 rows). Each kind is (column, row, scale):
# the scale is how many screen pixels an art pixel takes, so the merge ladder grows Cherry -> Watermelon. Whole scales stay
# crisp; Grape (2.5) and Melon (3.5) sit between them, as the ladder needs five sizes. No sprite exists for a Durian (the
# Pineapple stands in), a Seed (the brown Kiwi) or a Melon (the round green one).
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
}
FRUIT_SHEET = ROOT / "tools" / "fruit" / "fruit-sheet.png"
SIZES_FILE = ROOT / "src" / "rules" / "sizes.ts"
# A fruit's ball is a little smaller than its sprite's square: the art does not fill the corners.
BALL_SHARE = 0.45

SOUNDS = {
    "merge.wav": "interface-sounds-glass-001.wav",
    "land.wav": "impact-sounds-impact-soft-medium-000.wav",
    "boom.wav": "impact-sounds-impact-punch-heavy-000.wav",
    "pick.wav": "interface-sounds-confirmation-001.wav",
    "rent.wav": "digital-audio-power-up-2.wav",
    "lose.wav": "interface-sounds-error-004.wav",
    "tick.wav": "interface-sounds-tick-002.wav",
}


# Every picture is snapped to one palette, Apollo (tools/palette/apollo.hex, by AdamCYounis on Lospec): each pixel becomes the
# nearest of its 46 colours, so the fruit, the Kenney pieces and the background share one set of colours with the UI (src/theme.ts).
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
    "panel": hexes("#4d2b32", "#7a4841", "#ad7757", "#d7b594", "#e7d5b3"),
    "card": hexes("#4d2b32", "#7a4841", "#ad7757", "#c09473", "#d7b594"),
    "chosen": hexes("#602c2c", "#884b2b", "#be772b", "#de9e41", "#e8c170"),
    "jar": hexes("#253a5e", "#3c5e8b", "#4f8fba", "#73bed3", "#a4dddb"),
    "bar": hexes("#241527", "#341c27", "#4d2b32", "#602c2c"),
    "bar-fill": hexes("#884b2b", "#be772b", "#de9e41", "#e8c170"),
    "background": hexes("#151d28", "#172038", "#253a5e", "#3c5e8b"),
}


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
FONT_PX = 16
ICON = 32
# The pick screen's cards show each fruit at 4x.
BIG = 64

# UI Pixel Pack: 16 x 16 tiles, 2 pixels apart. Each image is (column, row, tiles across, tiles down) of the sheet, drawn as a
# 9-slice in the game.
UI_TILES = {
    "panel.png": (0, 13, 3, 3),  # cream panel: the side panels, the banner and the boxes
    "card.png": (9, 13, 3, 3),  # tan panel: hand rows, offers, menu buttons
    "card-chosen.png": (9, 13, 3, 3),  # the same panel in amber: the one chosen
    "jar.png": (13, 20, 3, 3),  # blue-grey glass: the jar, drawn see-through
    "bar.png": (3, 13, 3, 3),  # grey panel: the rent bar's track
    "bar-fill.png": (0, 27, 3, 1),  # yellow bar: the rent paid so far
}
EXPLOSION_FRAMES = 9
BOOM_SIZE = 96


def ui_image(sheet: Image.Image, col: int, row: int, across: int, down: int) -> Image.Image:
    out = Image.new("RGBA", (16 * across, 16 * down))
    for dy in range(down):
        for dx in range(across):
            x, y = (col + dx) * 18, (row + dy) * 18
            out.paste(sheet.crop((x, y, x + 16, y + 16)), (dx * 16, dy * 16))
    box = out.getbbox()
    return out.crop(box) if box else out


def doubled(image: Image.Image) -> Image.Image:
    return image.resize((image.width * PX, image.height * PX), Image.NEAREST)


def font_sheet() -> Image.Image:
    """Kenney Mini Square Mono at 16 px, twice its pixel size (every pixel a 2 x 2 block, nothing to smooth). Its glyphs reach
    rows 4 to 18, so each is drawn 4 up in a 12 x 16 cell."""
    font = ImageFont.truetype(str(KENNEY / "kenney-mini-square-mono.ttf"), FONT_PX)
    cell_w, cell_h = 12, 16
    sheet = Image.new("L", (cell_w * 16, cell_h * 6), 0)
    draw = ImageDraw.Draw(sheet)
    for code in range(32, 128):
        i = code - 32
        draw.text(((i % 16) * cell_w, (i // 16) * cell_h - 4), chr(code), font=font, fill=255)
    out = Image.new("RGBA", sheet.size, (255, 255, 255, 0))
    out.putalpha(sheet.point(lambda v: 255 if v >= 128 else 0))
    return out


def background() -> Image.Image:
    """Pixel Platformer's sky, clouds and ground (24 x 24 tiles, packed), laid across a 320 x 180 picture, then doubled."""
    sheet = Image.open(KENNEY / "pixel-platformer-backgrounds.png").convert("RGBA")
    tile = lambda col, row: sheet.crop((col * 24, row * 24, col * 24 + 24, row * 24 + 24))
    w, h = WIDTH // PX, HEIGHT // PX
    out = Image.new("RGBA", (w, h))
    clouds_at = 96
    for x in range(0, w, 24):
        col = (x // 24) % 4
        for y in range(0, clouds_at, 24):
            out.paste(tile(col, 0), (x, y))
        out.paste(tile(col, 1), (x, clouds_at))
        for y in range(clouds_at + 24, h, 24):
            out.paste(tile(col, 2), (x, y))
    return doubled(out)


def coin() -> Image.Image:
    """Pixel Platformer's gold coin (tile 11, 7 of its 18 x 18 packed tiles)."""
    tiles = Image.open(KENNEY / "pixel-platformer-tiles.png").convert("RGBA")
    picture = tiles.crop((11 * 18, 7 * 18, 12 * 18, 8 * 18))
    return doubled(picture.crop(picture.getbbox()))


def main() -> None:
    ASSETS.mkdir(exist_ok=True)
    sheet = to_palette(Image.open(FRUIT_SHEET))
    lines = []
    for kind, (col, row, scale) in FRUIT_SPRITES.items():
        sprite = sheet.crop((col * 16, row * 16, col * 16 + 16, row * 16 + 16))
        size = round(16 * scale)
        sprite.resize((size, size), Image.NEAREST).save(ASSETS / f"fruit-{kind}.png")
        sprite.resize((ICON, ICON), Image.NEAREST).save(ASSETS / f"icon-{kind}.png")
        sprite.resize((BIG, BIG), Image.NEAREST).save(ASSETS / f"big-{kind}.png")
        lines.append(f"  {kind}: {{ size: {size}, radius: {round(size * BALL_SHARE)} }},")
    SIZES_FILE.write_text(
        "/** Written by tools/make-assets.py: each fruit's sprite size and its ball's radius, in pixels. Do not edit. */\n"
        "export const FRUIT_ART = {\n" + "\n".join(lines) + "\n} as const;\n"
    )
    recolor(background(), RAMPS["background"]).save(ASSETS / "background.png")
    ui = Image.open(KENNEY / "ui-pixel-pack-sheet.png").convert("RGBA")
    for name, (col, row, across, down) in UI_TILES.items():
        piece = recolor(ui_image(ui, col, row, across, down), RAMPS[name.removesuffix(".png").replace("card-chosen", "chosen")])
        doubled(piece).save(ASSETS / name)
    to_palette(coin()).save(ASSETS / "coin.png")
    # The explosion's frames (96 x 91) are centred on a 96 x 96 square so they share one origin.
    for i in range(EXPLOSION_FRAMES):
        frame = to_palette(Image.open(KENNEY / f"explosion-pixel-0{i}.png"))
        square = Image.new("RGBA", (BOOM_SIZE, BOOM_SIZE))
        square.paste(frame, ((BOOM_SIZE - frame.width) // 2, (BOOM_SIZE - frame.height) // 2))
        square.save(ASSETS / f"boom-{i}.png")
    font_sheet().save(ASSETS / "font.png")
    for name, source in SOUNDS.items():
        shutil.copyfile(KENNEY / source, ASSETS / name)
    print(f"wrote {len(FRUIT_SPRITES) * 3} fruit images, the font, the background, {len(UI_TILES)} UI images, the coin, the blast and {len(SOUNDS)} sounds")


if __name__ == "__main__":
    main()
