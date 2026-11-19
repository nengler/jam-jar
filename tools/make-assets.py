"""
Lays out the game's assets/ from the free art in tools/:

- tools/fluent/: Microsoft Fluent Emoji 3D fruit (MIT licence, tools/fluent/LICENSE), 256 x 256. Each fruit is cropped to its
  pixels and scaled down (Lanczos) to its size in the jar, fruit-<kind>.png, and to a 14-pixel icon for the hand and pick lists,
  icon-<kind>.png. Sizes come from the radii in src/rules/fruits.ts, so changing a radius and rerunning keeps them in step.
- tools/kenney/: Kenney's CC0 sounds (from the tse repo's games), copied as they are.

    python3 tools/make-assets.py
"""
import colorsys
import re
import shutil
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
FLUENT = ROOT / "tools" / "fluent"
KENNEY = ROOT / "tools" / "kenney"
ICON = 14

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
    for name, source in SOUNDS.items():
        shutil.copyfile(KENNEY / source, ASSETS / name)
    print(f"wrote {len(SOURCES) * 2} images and {len(SOUNDS)} sounds to {ASSETS}")


if __name__ == "__main__":
    main()
