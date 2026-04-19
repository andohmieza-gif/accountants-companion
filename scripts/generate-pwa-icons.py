#!/usr/bin/env python3
"""
Build public/icon-192.png and public/icon-512.png from the app artwork.

Place the master square asset at public/app-icon-source.png (min 512px wide).
Requires Pillow.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "public" / "app-icon-source.png"


def _square_crop(im: Image.Image) -> Image.Image:
    w, h = im.size
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    return im.crop((left, top, left + side, top + side))


def main() -> None:
    if not SOURCE.is_file():
        raise SystemExit(f"Missing {SOURCE.name}: add your square app icon there, then re-run.")

    pub = ROOT / "public"
    im = Image.open(SOURCE).convert("RGBA")
    im = _square_crop(im)

    im.resize((512, 512), Image.Resampling.LANCZOS).save(pub / "icon-512.png", "PNG", optimize=True)
    im.resize((192, 192), Image.Resampling.LANCZOS).save(pub / "icon-192.png", "PNG", optimize=True)
    print(f"Wrote icon-512.png and icon-192.png from {SOURCE.name}")


if __name__ == "__main__":
    main()
