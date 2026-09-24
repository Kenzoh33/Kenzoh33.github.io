"""Turn the text grids in icons/ into sprite-sheet PNGs and a preview page.

Usage (from the repo root):
    python3 scripts/pixel-art/build.py
    python3 scripts/pixel-art/build.py --inspect DIR   # also write upscaled contact sheet

Standard library only: PNGs are written by hand with zlib + struct.
"""

import argparse
import html
import importlib.util
import json
import struct
import sys
import zlib
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
OUT_DIR = ROOT / "assets" / "pixel-art"
PREVIEW_HTML = ROOT / "pixel-preview.html"

sys.path.insert(0, str(HERE))
sys.path.insert(0, str(HERE / "icons"))  # lets icons import shared helpers like _avatar_base
from palette import PALETTE  # noqa: E402

# Display order in the preview; any icon file not listed is appended alphabetically.
ORDER = ["avatar-wave", "speech", "server-stack", "mood-lens", "terminal"]


def hex_to_rgba(value):
    if value is None:
        return (0, 0, 0, 0)
    value = value.lstrip("#")
    return (int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16), 255)


RGBA = {key: hex_to_rgba(val) for key, val in PALETTE.items()}


def parse_frame(text):
    return [line.strip() for line in text.strip("\n").splitlines() if line.strip()]


def load_icon(path):
    spec = importlib.util.spec_from_file_location(path.stem, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    frames = [parse_frame(f) for f in module.FRAMES]
    size = getattr(module, "SIZE", 16)
    errors = []
    for i, rows in enumerate(frames):
        if len(rows) != size:
            errors.append(f"frame {i}: {len(rows)} rows, expected {size}")
        for r, row in enumerate(rows):
            if len(row) != size:
                errors.append(f"frame {i} row {r}: {len(row)} chars, expected {size}")
            bad = set(row) - set(PALETTE)
            if bad:
                errors.append(f"frame {i} row {r}: unknown palette keys {sorted(bad)}")
    if errors:
        raise SystemExit(f"{path.name}:\n  " + "\n  ".join(errors))
    return {
        "name": path.stem.replace("_", "-"),
        "label": getattr(module, "LABEL", path.stem),
        "size": size,
        "fps": module.FPS,
        "frames": frames,
    }


def write_png(path, width, height, pixels):
    """pixels: list of rows, each a list of (r, g, b, a) tuples."""
    raw = b"".join(b"\x00" + bytes(c for px in row for c in px) for row in pixels)

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    path.write_bytes(png)


def sheet_pixels(icon):
    """Horizontal strip: frame 0 at x=0, frame 1 at x=size, ..."""
    return [
        [RGBA[ch] for rows in icon["frames"] for ch in rows[y]]
        for y in range(icon["size"])
    ]


def write_inspect_sheet(icons, out_path, scale=8, gap=2):
    """Every icon on one image, one row per icon, on a light and a dark band."""
    bands = [(214, 208, 198, 255), (28, 27, 25, 255)]
    max_frames = max(len(i["frames"]) for i in icons)
    cell = 32 * scale if any(i["size"] > 16 for i in icons) else 16 * scale
    width = len(bands) * (max_frames * (cell + gap) + gap * 4)
    height = sum(i["size"] * scale + gap for i in icons) + gap
    canvas = [[(128, 128, 128, 255)] * width for _ in range(height)]
    y0 = gap
    for icon in icons:
        s = icon["size"]
        for b, bg in enumerate(bands):
            x_band = b * (max_frames * (cell + gap) + gap * 4)
            for f, rows in enumerate(icon["frames"]):
                x0 = x_band + gap + f * (cell + gap)
                for y in range(s * scale):
                    for x in range(s * scale):
                        px = RGBA[rows[y // scale][x // scale]]
                        canvas[y0 + y][x0 + x] = px if px[3] else bg
        y0 += s * scale + gap
    write_png(out_path, width, height, canvas)


def write_preview(icons):
    cards = []
    for icon in icons:
        n, size, fps = len(icon["frames"]), icon["size"], icon["fps"]
        src = f"assets/pixel-art/{icon['name']}.png"
        sprites = []
        for bg in ("light", "dark"):
            cells = "".join(
                f'<figure><span class="sprite" style="--n:{n};--fps:{fps};--size:{size};--s:{s};'
                f"background-image:url('{src}')\"></span><figcaption>{s}x</figcaption></figure>"
                for s in (1, 2, 3)
            )
            sprites.append(f'<div class="band {bg}">{cells}</div>')
        cards.append(
            f'<article class="card"><header><h2>{html.escape(icon["name"])}</h2>'
            f'<p>{html.escape(icon["label"])} &middot; {size}x{size} &middot; {n} frames @ {fps} fps</p></header>'
            f'{"".join(sprites)}'
            f'<img class="strip" src="{src}" alt="{html.escape(icon["name"])} frames" '
            f'style="width:{size * n * 3}px"></article>'
        )

    page = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pixel Icon Preview</title>
<!-- Generated by scripts/pixel-art/build.py. Edit the icon grids, not this file. -->
<style>
  :root {{ --light: #FAF8F4; --dark: #1C1B19; --ink: #1C1B19; --muted: #6B6560; --line: #E4DFD6; }}
  * {{ box-sizing: border-box; }}
  body {{ margin: 0; padding: 32px 16px; background: #F1EDE6; color: var(--ink);
         font: 14px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }}
  h1 {{ font-size: 20px; margin: 0 0 4px; }}
  .intro {{ color: var(--muted); margin: 0 0 24px; }}
  .grid {{ display: grid; gap: 16px; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }}
  .card {{ background: #fff; border: 1px solid var(--line); padding: 16px; }}
  .card h2 {{ font-size: 15px; margin: 0; font-family: ui-monospace, Menlo, monospace; }}
  .card p {{ margin: 2px 0 12px; color: var(--muted); font-size: 12px; }}
  .band {{ display: flex; align-items: flex-end; gap: 20px; padding: 12px; }}
  .band.light {{ background: var(--light); }}
  .band.dark {{ background: var(--dark); color: #A8A29A; }}
  figure {{ margin: 0; display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 11px; }}
  .sprite {{
    display: block;
    width: calc(var(--size) * var(--s) * 1px);
    height: calc(var(--size) * var(--s) * 1px);
    background-repeat: no-repeat;
    background-size: calc(var(--size) * var(--s) * var(--n) * 1px) auto;
    image-rendering: pixelated;
    animation: play calc(var(--n) / var(--fps) * 1s) steps(var(--n)) infinite;
  }}
  @keyframes play {{ to {{ background-position-x: calc(var(--size) * var(--s) * var(--n) * -1px); }} }}
  .strip {{ display: block; margin-top: 12px; image-rendering: pixelated; background: var(--light);
            outline: 1px dashed var(--line); }}
  label {{ display: inline-flex; gap: 6px; align-items: center; margin-bottom: 16px; cursor: pointer; }}
  body.paused .sprite {{ animation-play-state: paused; }}
</style>
</head>
<body>
<h1>Pixel icon preview</h1>
<p class="intro">Each icon at 1x, 2x and 3x on light and dark backgrounds. The strip under each card shows every frame at 3x.</p>
<label><input type="checkbox" onchange="document.body.classList.toggle('paused', this.checked)"> Pause animation</label>
<div class="grid">
{chr(10).join(cards)}
</div>
</body>
</html>
"""
    PREVIEW_HTML.write_text(page)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--inspect", type=Path, help="also write an 8x contact sheet here")
    args = parser.parse_args()

    paths = {p.stem.replace("_", "-"): p for p in (HERE / "icons").glob("*.py")
             if not p.stem.startswith("_")}
    names = [n for n in ORDER if n in paths] + sorted(set(paths) - set(ORDER))
    icons = [load_icon(paths[n]) for n in names]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest = []
    for icon in icons:
        n, size = len(icon["frames"]), icon["size"]
        write_png(OUT_DIR / f"{icon['name']}.png", size * n, size, sheet_pixels(icon))
        manifest.append({"name": icon["name"], "label": icon["label"], "size": size,
                         "frames": n, "fps": icon["fps"], "file": f"{icon['name']}.png"})
        print(f"  {icon['name']:<14} {size}x{size}  {n} frames  {icon['fps']} fps")
    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    write_preview(icons)
    print(f"Wrote {len(icons)} sprite sheets to {OUT_DIR.relative_to(ROOT)}/ and {PREVIEW_HTML.name}")

    if args.inspect:
        args.inspect.mkdir(parents=True, exist_ok=True)
        write_inspect_sheet(icons, args.inspect / "contact-sheet.png")
        print(f"Contact sheet: {args.inspect / 'contact-sheet.png'}")


if __name__ == "__main__":
    main()
