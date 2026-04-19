#!/usr/bin/env python3
"""Generate public/icon-192.png and public/icon-512.png (requires Pillow)."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]

# Deep indigo → violet
C_TOP = (67, 56, 202, 255)
C_MID = (91, 33, 182, 255)
C_BOT = (30, 27, 75, 255)
AC_FILL = (248, 250, 252, 255)
AC_DIM = (226, 232, 240, 255)


def _draw_ac_vector(
    d: ImageDraw.ImageDraw,
    size: int,
    fill: tuple[int, int, int, int],
    dx: int = 0,
    dy: int = 0,
) -> None:
    """Geometric AC monogram (consistent on every machine)."""
    s = size
    cx, cy = s // 2 + dx, int(s * 0.48) + dy
    thick = max(5, int(s * 0.055))
    cx -= int(s * 0.025)

    x0, y0 = cx - int(s * 0.19), cy + int(s * 0.17)
    xm, ym = cx, cy - int(s * 0.21)
    x1, y1 = cx + int(s * 0.11), cy + int(s * 0.17)
    d.line([(x0, y0), (xm, ym)], fill=fill, width=thick, joint="curve")
    d.line([(x1, y1), (xm, ym)], fill=fill, width=thick, joint="curve")
    bar_y = cy - int(s * 0.02)
    d.line([(cx - int(s * 0.075), bar_y), (cx + int(s * 0.04), bar_y)], fill=fill, width=int(thick * 0.88))

    ccx = cx + int(s * 0.175)
    r = int(s * 0.135)
    box = [ccx - r, cy - r, ccx + r, cy + r]
    d.arc(box, start=52, end=308, fill=fill, width=thick)


def compose_icon(size: int) -> Image.Image:
    bg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    px = bg.load()
    for y in range(size):
        fy = y / max(size - 1, 1)
        for x in range(size):
            fx = x / max(size - 1, 1)
            u = 0.55 * fy + 0.45 * fx
            r = int(C_TOP[0] * (1 - u) + C_MID[0] * u * 0.7 + C_BOT[0] * u * 0.3)
            g = int(C_TOP[1] * (1 - u) + C_MID[1] * u * 0.7 + C_BOT[1] * u * 0.3)
            b = int(C_TOP[2] * (1 - u) + C_MID[2] * u * 0.7 + C_BOT[2] * u * 0.3)
            px[x, y] = (r, g, b, 255)

    shadow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    m = size * 0.1
    rr = int(size * 0.22)
    off = max(2, size // 64)
    sd.rounded_rectangle(
        [m + off, m + off + size * 0.02, size - m + off, size - m + off],
        radius=rr,
        fill=(15, 23, 42, 85),
    )
    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=max(1.5, size / 96)))
    bg = Image.alpha_composite(bg, shadow)

    d = ImageDraw.Draw(bg)
    hi = (255, 255, 255, 38)
    d.rounded_rectangle(
        [m, m + size * 0.015, size - m, size - m - size * 0.015],
        radius=rr,
        fill=(255, 255, 255, 22),
        outline=(255, 255, 255, 55),
        width=max(1, size // 200),
    )
    d.rounded_rectangle(
        [m + size * 0.03, m + size * 0.04, size - m - size * 0.03, int(m + size * 0.09)],
        radius=int(size * 0.04),
        fill=hi,
    )

    inner = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    di = ImageDraw.Draw(inner)
    inset = int(size * 0.14)
    di.rounded_rectangle(
        [inset, inset, size - inset, size - inset],
        radius=int(size * 0.14),
        fill=(15, 23, 42, 55),
        outline=(255, 255, 255, 40),
        width=max(1, size // 256),
    )
    bg = Image.alpha_composite(bg, inner)

    d2 = ImageDraw.Draw(bg)
    o = max(1, size // 128)
    _draw_ac_vector(d2, size, (15, 23, 42, 100), dx=o, dy=o + 1)
    _draw_ac_vector(d2, size, AC_DIM, dx=max(1, o // 2), dy=0)
    _draw_ac_vector(d2, size, AC_FILL)

    return bg


def main() -> None:
    pub = ROOT / "public"
    img512 = compose_icon(512)
    img512.save(pub / "icon-512.png", "PNG", optimize=True)
    img512.resize((192, 192), Image.Resampling.LANCZOS).save(pub / "icon-192.png", "PNG", optimize=True)
    print("Wrote public/icon-512.png and public/icon-192.png")


if __name__ == "__main__":
    main()
