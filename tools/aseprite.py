"""
Reads and writes Aseprite files (.aseprite, .ase) with Pillow and nothing else, so the art can be kept as Aseprite files and
turned into pictures on any machine, without Aseprite installed. The format is Aseprite's own, documented at
https://github.com/aseprite/aseprite/blob/main/docs/ase-file-specs.md.

read(path) gives each frame as one RGBA picture: the visible layers flattened, bottom to top, as Aseprite shows them. It knows
RGBA, grayscale and indexed sprites, layer and cel opacity, groups, linked cels and z-index. It refuses what it cannot flatten
the way Aseprite does (a blend mode other than Normal, a tilemap layer), naming the layer, rather than guess. Reference layers
are left out, as Aseprite leaves them out of an export.

write(path, frames, palette) saves RGBA pictures (one per frame, all one size) as a one-layer RGBA sprite, with the palette in
it, so the file opens in Aseprite with that palette loaded.

    python3 tools/aseprite.py to-aseprite art/shop/sold.png ...   # each PNG beside it as a .aseprite, the PNG removed
    python3 tools/aseprite.py to-png sprite.aseprite ...          # each frame beside it as a PNG (<name>.png, or <name>-<i>.png)
"""
import struct
import sys
import zlib
from pathlib import Path

from PIL import Image

MAGIC = 0xA5E0
FRAME_MAGIC = 0xF1FA

LAYER_VISIBLE = 1
LAYER_BACKGROUND = 8
LAYER_REFERENCE = 64
LAYER_NORMAL, LAYER_GROUP, LAYER_TILEMAP = 0, 1, 2
HEADER_LAYER_OPACITY = 1
HEADER_GROUP_OPACITY = 2
HEADER_LAYER_UUID = 4

CHUNK_OLD_PALETTE = 0x0004
CHUNK_OLD_PALETTE_2 = 0x0011
CHUNK_LAYER = 0x2004
CHUNK_CEL = 0x2005
CHUNK_COLOR_PROFILE = 0x2007
CHUNK_PALETTE = 0x2019

BLEND_MODES = ["Normal", "Multiply", "Screen", "Overlay", "Darken", "Lighten", "Color Dodge", "Color Burn", "Hard Light",
               "Soft Light", "Difference", "Exclusion", "Hue", "Saturation", "Color", "Luminosity", "Addition", "Subtract", "Divide"]


class AsepriteError(Exception):
    pass


class _Reader:
    def __init__(self, data: bytes, at: int = 0):
        self.data = data
        self.at = at

    def take(self, fmt: str):
        values = struct.unpack_from("<" + fmt, self.data, self.at)
        self.at += struct.calcsize("<" + fmt)
        return values if len(values) > 1 else values[0]

    def string(self) -> str:
        length = self.take("H")
        text = self.data[self.at : self.at + length].decode("utf-8", "replace")
        self.at += length
        return text


def _to_rgba(depth: int, raw: bytes, size: tuple[int, int], palette: list[tuple[int, int, int, int]], clear: int | None) -> Image.Image:
    """A cel's pixels as an RGBA picture. `clear` is the indexed sprite's transparent index (None on the background layer)."""
    if depth == 32:
        return Image.frombytes("RGBA", size, raw)
    if depth == 16:
        return Image.frombytes("LA", size, raw).convert("RGBA")
    out = bytearray()
    for index in raw:
        if index == clear:
            out += b"\0\0\0\0"
        elif index < len(palette):
            out += bytes(palette[index])
        else:
            raise AsepriteError(f"a pixel is colour {index}, past the end of the {len(palette)}-colour palette")
    return Image.frombytes("RGBA", size, bytes(out))


def read(path: str | Path, layer: str | None = None) -> list[Image.Image]:
    """
    Each frame of an Aseprite file, its visible layers flattened, as an RGBA picture the size of the sprite. With `layer`, only the
    layer of that name, shown or hidden (an empty list when there is none).
    """
    only = layer
    data = Path(path).read_bytes()
    if len(data) < 128:
        raise AsepriteError("too short to be an Aseprite file")
    head = _Reader(data)
    _size, magic, frames, width, height, depth, flags = head.take("IHHHHHI")
    if magic != MAGIC:
        raise AsepriteError("not an Aseprite file")
    if depth not in (8, 16, 32):
        raise AsepriteError(f"unknown colour depth {depth}")
    head.at = 28
    transparent = head.take("B")

    layers: list[dict] = []
    palette: list[tuple[int, int, int, int]] = []
    # Each frame's cels by layer, to flatten once every layer is known (layers come in the first frame, before its cels).
    cels_by_frame: list[list[dict]] = []

    at = 128
    for frame in range(frames):
        frame_head = _Reader(data, at)
        frame_bytes, frame_magic, old_chunks, _duration = frame_head.take("IHHH")
        frame_head.at += 2
        new_chunks = frame_head.take("I")
        if frame_magic != FRAME_MAGIC:
            raise AsepriteError(f"frame {frame + 1} is damaged")
        chunks = new_chunks if new_chunks != 0 else old_chunks
        cels: list[dict] = []
        chunk_at = at + 16
        for _ in range(chunks):
            chunk = _Reader(data, chunk_at)
            chunk_size, kind = chunk.take("IH")
            if kind == CHUNK_LAYER:
                layer_flags, layer_type, level = chunk.take("HHH")
                chunk.at += 4
                blend, opacity = chunk.take("HB")
                chunk.at += 3
                name = chunk.string()
                layers.append({"flags": layer_flags, "type": layer_type, "level": level, "blend": blend,
                               "opacity": opacity if flags & HEADER_LAYER_OPACITY else 255, "name": name})
            elif kind == CHUNK_CEL:
                layer, x, y, opacity, cel_type, z = chunk.take("HhhBHh")
                chunk.at += 5
                cel = {"layer": layer, "x": x, "y": y, "opacity": opacity, "z": z}
                if cel_type == 1:
                    cel["link"] = chunk.take("H")
                elif cel_type in (0, 2):
                    w, h = chunk.take("HH")
                    body = data[chunk.at : chunk_at + chunk_size]
                    raw = zlib.decompress(body) if cel_type == 2 else body
                    cel["size"] = (w, h)
                    cel["raw"] = raw[: w * h * depth // 8]
                elif cel_type == 3:
                    raise AsepriteError("has a tilemap layer, which cannot be read here: convert it to a normal layer")
                cels.append(cel)
            elif kind == CHUNK_PALETTE:
                count, first, last = chunk.take("III")
                chunk.at += 8
                if len(palette) < count:
                    palette += [(0, 0, 0, 255)] * (count - len(palette))
                for index in range(first, last + 1):
                    entry_flags, r, g, b, a = chunk.take("HBBBB")
                    if entry_flags & 1:
                        chunk.string()
                    palette[index] = (r, g, b, a)
            elif kind in (CHUNK_OLD_PALETTE, CHUNK_OLD_PALETTE_2) and not palette:
                # Only read when there is no new palette chunk, which comes first in files that have both.
                old: list[tuple[int, int, int, int]] = []
                for _packet in range(chunk.take("H")):
                    skip, count = chunk.take("BB")
                    old += [(0, 0, 0, 255)] * skip
                    for _ in range(count or 256):
                        r, g, b = chunk.take("BBB")
                        if kind == CHUNK_OLD_PALETTE_2:
                            r, g, b = (r * 255 // 63, g * 255 // 63, b * 255 // 63)
                        old.append((r, g, b, 255))
                palette = old
            chunk_at += chunk_size
        cels_by_frame.append(cels)
        at += frame_bytes

    # A layer is shown when it and every group it is in are visible. Its parent is the nearest layer above it in the list with
    # a smaller child level.
    shown: list[bool] = []
    for index, layer in enumerate(layers):
        visible = bool(layer["flags"] & LAYER_VISIBLE) and not layer["flags"] & LAYER_REFERENCE
        for parent in range(index - 1, -1, -1):
            if layers[parent]["level"] < layer["level"]:
                visible = visible and shown[parent]
                break
        if only is not None:
            visible = layer["name"] == only and layer["type"] == LAYER_NORMAL
        shown.append(visible)
        if not visible:
            continue
        what = f'layer "{layer["name"]}"'
        if layer["type"] == LAYER_TILEMAP:
            raise AsepriteError(f"{what} is a tilemap layer, which cannot be read here: convert it to a normal layer")
        is_group = layer["type"] == LAYER_GROUP
        if layer["blend"] != 0 and (not is_group or flags & HEADER_GROUP_OPACITY):
            mode = BLEND_MODES[layer["blend"]] if layer["blend"] < len(BLEND_MODES) else str(layer["blend"])
            raise AsepriteError(f"{what} is in {mode} blend mode: only Normal is read here")
        if is_group and flags & HEADER_GROUP_OPACITY and layer["opacity"] != 255:
            raise AsepriteError(f"{what} is a group at {layer['opacity']} opacity: only groups at full opacity are read here")

    if only is not None and not any(shown):
        return []
    pictures: list[Image.Image] = []
    for frame, cels in enumerate(cels_by_frame):
        canvas = Image.new("RGBA", (width, height))
        # Bottom to top: by layer, moved up or down by the cel's z-index, a lower z-index first among those at one place.
        for cel in sorted(cels, key=lambda c: (c["layer"] + c["z"], c["z"])):
            if cel["layer"] >= len(layers) or not shown[cel["layer"]] or layers[cel["layer"]]["type"] != LAYER_NORMAL:
                continue
            layer = layers[cel["layer"]]
            source = cel
            if "link" in cel:
                source = next((c for c in cels_by_frame[cel["link"]] if c["layer"] == cel["layer"] and "raw" in c), None)
                if source is None:
                    raise AsepriteError(f'frame {frame + 1}, layer "{layer["name"]}": a linked cel with nothing to link to')
            clear = None if layer["flags"] & LAYER_BACKGROUND else transparent
            picture = _to_rgba(depth, source["raw"], source["size"], palette, clear)
            opacity = cel["opacity"] * layer["opacity"]
            if opacity != 255 * 255:
                alpha = picture.getchannel("A").point(lambda a: (a * opacity + 255 * 255 // 2) // (255 * 255))
                picture.putalpha(alpha)
            # Only the part over the canvas: a cel can hang off its edges.
            x, y = cel["x"], cel["y"]
            left, top = max(0, -x), max(0, -y)
            right, bottom = min(picture.width, width - x), min(picture.height, height - y)
            if left >= right or top >= bottom:
                continue
            canvas.alpha_composite(picture.crop((left, top, right, bottom)), dest=(x + left, y + top))
        pictures.append(canvas)
    return pictures


def _chunk(kind: int, body: bytes) -> bytes:
    return struct.pack("<IH", 6 + len(body), kind) + body


def _string(text: str) -> bytes:
    encoded = text.encode("utf-8")
    return struct.pack("<H", len(encoded)) + encoded


def write(
    path: str | Path,
    frames: list[Image.Image],
    palette: list[tuple[int, int, int]] = (),
    duration: int = 100,
    hidden: list[tuple[str, list[Image.Image]]] = (),
) -> None:
    """
    Saves the pictures (RGBA, one size) as the frames of an RGBA sprite, each shown for `duration` ms, with the palette. They are
    its one visible layer, "Layer 1"; `hidden` adds hidden layers under it, each a name and a picture per frame (kept for
    reference: `read`, and the game, leave them out).
    """
    if not frames:
        raise AsepriteError("no frames to write")
    width, height = frames[0].size
    if any(frame.size != (width, height) for frame in frames):
        raise AsepriteError("every frame must be one size")
    for name, pictures in hidden:
        if len(pictures) != len(frames) or any(picture.size != (width, height) for picture in pictures):
            raise AsepriteError(f"the hidden layer {name!r} needs one picture of the sprite's size per frame")
    # Bottom first, as Aseprite stores them: the hidden layers, then the visible one.
    layers = [(name, False, pictures) for name, pictures in hidden] + [("Layer 1", True, frames)]
    colours = len(palette) or 1
    body = bytearray()
    for index, frame in enumerate(frames):
        chunks = []
        if index == 0:
            # sRGB, as Aseprite writes it by default.
            chunks.append(_chunk(CHUNK_COLOR_PROFILE, struct.pack("<HHI8x", 1, 0, 0)))
            entries = b"".join(struct.pack("<HBBBB", 0, r, g, b, 255) for r, g, b in (palette or [(0, 0, 0)]))
            chunks.append(_chunk(CHUNK_PALETTE, struct.pack("<III8x", colours, 0, colours - 1) + entries))
            # The old palette chunk too, as Aseprite writes it for older readers.
            old = b"".join(struct.pack("<BBB", r, g, b) for r, g, b in (palette or [(0, 0, 0)])[:256])
            chunks.append(_chunk(CHUNK_OLD_PALETTE, struct.pack("<HBB", 1, 0, colours % 256) + old))
            for name, visible, _pictures in layers:
                flags = (LAYER_VISIBLE if visible else 0) | 2
                layer = struct.pack("<HHHHHHB3x", flags, LAYER_NORMAL, 0, 0, 0, 0, 255) + _string(name)
                chunks.append(_chunk(CHUNK_LAYER, layer))
        for layer_index, (_name, _visible, pictures) in enumerate(layers):
            pixels = zlib.compress(pictures[index].convert("RGBA").tobytes(), 9)
            chunks.append(_chunk(CHUNK_CEL, struct.pack("<HhhBHh5xHH", layer_index, 0, 0, 255, 2, 0, width, height) + pixels))
        frame_body = b"".join(chunks)
        body += struct.pack("<IHHH2xI", 16 + len(frame_body), FRAME_MAGIC, len(chunks), duration, len(chunks)) + frame_body
    header = struct.pack("<IHHHHHIHII", 128 + len(body), MAGIC, len(frames), width, height, 32, HEADER_LAYER_OPACITY, duration, 0, 0)
    header += struct.pack("<B3xHBBhhHH", 0, colours if colours < 256 else 0, 1, 1, 0, 0, 16, 16)
    header += bytes(128 - len(header))
    Path(path).write_bytes(header + bytes(body))


def is_aseprite(path: Path) -> bool:
    return path.suffix.lower() in (".aseprite", ".ase")


def _main(args: list[str]) -> None:
    if len(args) < 2 or args[0] not in ("to-aseprite", "to-png"):
        raise SystemExit(__doc__)
    palette_file = Path(__file__).resolve().parent / "palette" / "apollo.hex"
    palette = [tuple(int(line[i : i + 2], 16) for i in (0, 2, 4)) for line in palette_file.read_text().split()]
    for name in args[1:]:
        source = Path(name)
        if args[0] == "to-aseprite":
            target = source.with_suffix(".aseprite")
            write(target, [Image.open(source).convert("RGBA")], palette)
            if read(target)[0].tobytes() != Image.open(source).convert("RGBA").tobytes():
                raise SystemExit(f"{target}: reads back different from {source}; {source} is kept")
            source.unlink()
        else:
            frames = read(source)
            for index, frame in enumerate(frames):
                frame.save(source.with_name(source.stem + (f"-{index}" if len(frames) > 1 else "") + ".png"))
        print(f"{source} -> {target if args[0] == 'to-aseprite' else source.stem + '.png'}")


if __name__ == "__main__":
    _main(sys.argv[1:])
