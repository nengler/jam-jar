"""
Lays out the game's assets/ from the free art in tools/:

- tools/fluent/: Microsoft Fluent Emoji 3D fruit (MIT licence, tools/fluent/LICENSE), 256 x 256. Each fruit is cropped to its
  pixels and scaled down (Lanczos) to its size in the jar, fruit-<kind>.png, and to a 14-pixel icon for the hand and pick lists,
  icon-<kind>.png. Sizes come from the radii in src/rules/fruits.ts, so changing a radius and rerunning keeps them in step.
- tools/kenney/: Kenney's CC0 assets (from the Kenney Game Assets All-in-1 bundle, and sounds from the tse repo's games):
  - the sounds, copied as they are;
  - `kenney-mini-square-mono.ttf` (Kenney Fonts), drawn at twice its pixel size into `font.png`: the ASCII characters 32 to
    127 in a 16 x 6 grid of 12 x 16 cells, as tse's `<Text font>` takes;
  - UI Pack panels and buttons, a Physics Assets glass frame (the jar) and background, the Explosion Pack's regular explosion
    and Splat Pack splats (see KENNEY_IMAGES, EXPLOSION_FRAMES and SPLATS).

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


# Kenney files (tools/kenney) laid out as the game's images, by name in assets/: (source, size to scale to or None).
KENNEY_IMAGES = {
    # 9-slices: the side panels and cards (grey), the chosen card and title buttons (yellow), the jar (glass), the rent bar.
    "panel.png": ("ui-grey-button-square-depth-flat.png", None),
    "panel-chosen.png": ("ui-yellow-button-square-depth-flat.png", None),
    "button.png": ("ui-yellow-button-rectangle-depth-gloss.png", None),
    "button-grey.png": ("ui-grey-button-rectangle-depth-flat.png", None),
    "jar.png": ("physics-glass-035.png", (70, 70)),
    "bar.png": ("ui-grey-slide-horizontal-grey.png", None),
    "bar-fill.png": ("ui-yellow-slide-horizontal-color.png", None),
    "coin.png": ("ui-yellow-star.png", (16, 15)),
}
EXPLOSION_FRAMES = 9
BOOM_SIZE = 192
SPLATS = {"splat-0.png": "splat-00.png", "splat-1.png": "splat-05.png", "splat-2.png": "splat-12.png"}
SPLAT_SIZE = 64
WIDTH, HEIGHT = 640, 360
FONT_PX = 16
ICON = 28


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
    """Physics Assets' sky and hills, scaled to the screen's width and cut to its height from the bottom (the hills)."""
    image = Image.open(KENNEY / "physics-background-colored-land.png").convert("RGBA")
    scaled = image.resize((WIDTH, WIDTH), Image.LANCZOS)
    return scaled.crop((0, WIDTH - HEIGHT - 40, WIDTH, WIDTH - 40))


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
    for name, (source, size) in KENNEY_IMAGES.items():
        image = Image.open(KENNEY / source).convert("RGBA")
        if size is not None:
            image = image.resize(size, Image.LANCZOS)
        image.save(ASSETS / name)
    # The explosion's frames differ in size; each is centred on a 192 x 192 square so they share one origin.
    for i in range(EXPLOSION_FRAMES):
        frame = Image.open(KENNEY / f"explosion-regular-0{i}.png").convert("RGBA")
        square = Image.new("RGBA", (BOOM_SIZE, BOOM_SIZE))
        square.paste(frame, ((BOOM_SIZE - frame.width) // 2, (BOOM_SIZE - frame.height) // 2))
        square.save(ASSETS / f"boom-{i}.png")
    for name, source in SPLATS.items():
        Image.open(KENNEY / source).convert("RGBA").resize((SPLAT_SIZE, SPLAT_SIZE), Image.LANCZOS).save(ASSETS / name)
    font_sheet().save(ASSETS / "font.png")
    for name, source in SOUNDS.items():
        shutil.copyfile(KENNEY / source, ASSETS / name)
    print(f"wrote {len(SOURCES) * 2} fruit images, the font, the background, {len(KENNEY_IMAGES)} UI images, the blast and splats, and {len(SOUNDS)} sounds")


if __name__ == "__main__":
    main()
