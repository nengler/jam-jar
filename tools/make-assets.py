"""
Lays out the game's assets/ from the free art in tools/:

- tools/fluent/: Microsoft Fluent Emoji 3D fruit (MIT licence, tools/fluent/LICENSE), 256 x 256. Each fruit is cropped to its
  pixels and scaled down (Lanczos) to its size in the jar, fruit-<kind>.png, and to a 14-pixel icon for the hand and pick lists,
  icon-<kind>.png. Sizes come from the radii in src/rules/fruits.ts, so changing a radius and rerunning keeps them in step.
- tools/kenney/: Kenney's CC0 assets (from the Kenney Game Assets All-in-1 bundle, and sounds from the tse repo's games):
  - the sounds, copied as they are;
  - `kenney-mini-square-mono.ttf` (Kenney Fonts), drawn at twice its pixel size into `font.png`: the ASCII characters 32 to
    127 in a 16 x 6 grid of 12 x 16 cells, as tse's `<Text font>` takes;
  - pixel art only, doubled with no smoothing: UI Pixel Pack panels and buttons (UI_TILES), Pixel Platformer's sky, clouds and
    ground and its coin, and the Explosion Pack's pixel explosion.

    python3 tools/make-assets.py
"""
import colorsys
import re
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
FLUENT = ROOT / "tools" / "fluent"
KENNEY = ROOT / "tools" / "kenney"

# Fruit kind -> (Fluent image, hue shift in turns or None). No emoji exists for a Durian or a Pomegranate, so they use stand-ins:
# a Pineapple (spiky), and the Red Apple shifted toward magenta.
SOURCES = {
    "cherry": ("cherries", None),
    "grape": ("grapes", None),
    "orange": ("tangerine", None),
    "melon": ("melon", None),
    "watermelon": ("watermelon", None),
    "apple": ("red_apple", None),
    "banana": ("banana", None),
    "chili": ("hot_pepper", None),
    "durian": ("pineapple", None),
    "pomegranate": ("red_apple", -0.08),
    "blueberry": ("blueberries", None),
    "lemon": ("lemon", None),
    "seed": ("chestnut", None),
}

SOUNDS = {
    "merge.wav": "interface-sounds-glass-001.wav",
    "land.wav": "impact-sounds-impact-soft-medium-000.wav",
    "boom.wav": "impact-sounds-impact-punch-heavy-000.wav",
    "pick.wav": "interface-sounds-confirmation-001.wav",
    "rent.wav": "digital-audio-power-up-2.wav",
    "lose.wav": "interface-sounds-error-004.wav",
    "tick.wav": "interface-sounds-tick-002.wav",
}


def radii() -> dict[str, int]:
    text = (ROOT / "src" / "rules" / "fruits.ts").read_text()
    return {kind: int(r) for kind, r in re.findall(r"^\s+(\w+): \{ name: \"[^\"]+\", radius: (\d+)", text, re.M)}


def hue_shift(image: Image.Image, turns: float) -> Image.Image:
    out = image.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            h, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            r2, g2, b2 = colorsys.hsv_to_rgb((h + turns) % 1, s, v * 0.85)
            px[x, y] = (round(r2 * 255), round(g2 * 255), round(b2 * 255), a)
    return out


def fit(image: Image.Image, size: int) -> Image.Image:
    """The image's pixels, scaled to fit a size x size square and centred in it."""
    cropped = image.crop(image.getbbox())
    scale = size / max(cropped.width, cropped.height)
    w, h = max(1, round(cropped.width * scale)), max(1, round(cropped.height * scale))
    small = cropped.resize((w, h), Image.LANCZOS)
    out = Image.new("RGBA", (size, size))
    out.paste(small, ((size - w) // 2, (size - h) // 2))
    return out


# Every Kenney picture is pixel art, drawn at exactly twice its size on the 640 x 360 screen (nearest neighbour), so its pixels
# match the font's and each other's.
PX = 2
WIDTH, HEIGHT = 640, 360
FONT_PX = 16
ICON = 28

# UI Pixel Pack: 16 x 16 tiles, 2 pixels apart. Each image is (column, row, tiles across, tiles down) of the sheet, drawn as a
# 9-slice in the game.
UI_TILES = {
    "panel.png": (0, 13, 3, 3),  # cream panel: the side panels and the boxes
    "card.png": (0, 0, 3, 1),  # white button: hand rows, pick cards, menu buttons
    "card-chosen.png": (6, 0, 3, 1),  # yellow button: the one chosen
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
    sizes = radii()
    for kind, (source, shift) in SOURCES.items():
        image = Image.open(FLUENT / f"{source}.png").convert("RGBA")
        if shift is not None:
            image = hue_shift(image, shift)
        # A little bigger than the physics circle: emoji art is not round, and this keeps the pile looking snug.
        fit(image, sizes[kind] * 2 + 2).save(ASSETS / f"fruit-{kind}.png")
        fit(image, ICON).save(ASSETS / f"icon-{kind}.png")
    background().save(ASSETS / "background.png")
    ui = Image.open(KENNEY / "ui-pixel-pack-sheet.png").convert("RGBA")
    for name, (col, row, across, down) in UI_TILES.items():
        doubled(ui_image(ui, col, row, across, down)).save(ASSETS / name)
    coin().save(ASSETS / "coin.png")
    # The explosion's frames (96 x 91) are centred on a 96 x 96 square so they share one origin.
    for i in range(EXPLOSION_FRAMES):
        frame = Image.open(KENNEY / f"explosion-pixel-0{i}.png").convert("RGBA")
        square = Image.new("RGBA", (BOOM_SIZE, BOOM_SIZE))
        square.paste(frame, ((BOOM_SIZE - frame.width) // 2, (BOOM_SIZE - frame.height) // 2))
        square.save(ASSETS / f"boom-{i}.png")
    font_sheet().save(ASSETS / "font.png")
    for name, source in SOUNDS.items():
        shutil.copyfile(KENNEY / source, ASSETS / name)
    print(f"wrote {len(SOURCES) * 2} fruit images, the font, the background, {len(UI_TILES)} UI images, the coin, the blast and {len(SOUNDS)} sounds")


if __name__ == "__main__":
    main()
