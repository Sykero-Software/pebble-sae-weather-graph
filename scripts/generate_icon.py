#!/usr/bin/env python3
"""Generate app icon: Pebble stock cloud + precipitation bars + temperature zigzag.

Outputs:
  resources/launcher_icon.png          - 25x25, Pebble palette, indexed PNG
  resources/launcher_icon_preview.png  - 250x250 nearest-pixel preview
"""
import os
import sys
from PIL import Image, ImageDraw

# Run from project root
os.chdir(os.path.join(os.path.dirname(__file__), ".."))

W = H = 25

# Pebble-palette colours (2-bit per channel: 0/85/170/255)
TRANS = (0,   0,   0,   0)
BLUE  = (0,   170, 255, 255)   # GColorVividCerulean — same as app precip bars
RED   = (170, 0,   0,   255)   # GColorDarkCandyAppleRed — same as temperature curve

def snap(c):
    if c <  43: return 0
    if c < 128: return 85
    if c < 213: return 170
    return 255

# ── Load Pebble stock cloud at 25×25 ──────────────────────────────────────────
# Use the rain-map launcher icon — already a correct 25×25 Pebble-palette render
# of the same stock heavy-rain cloud icon.
rain_map_icon = "/Users/tuukka/personal/git/pebble/pebble-rain-map-finland/resources/launcher_icon.png"
cloud_src = Image.open(rain_map_icon).convert('RGBA')

img = Image.new('RGBA', (W, H), TRANS)

# Copy cloud rows 0–12 only; omit rain-drop rows
for y in range(13):
    for x in range(W):
        r, g, b, a = cloud_src.getpixel((x, y))
        if a >= 50:
            img.putpixel((x, y), (snap(r), snap(g), snap(b), 255))

# ── Bars: hang downward from row 13, varying depths ───────────────────────────
# 4 bars × 4px wide with 1px gaps, starting at x=2.
bars = [
    (2,  7),   # medium
    (7,  10),  # tallest
    (12, 5),   # shortest
    (17, 8),   # tall
]
for bx, bh in bars:
    for y in range(13, 13 + bh):
        for x in range(bx, bx + 4):
            img.putpixel((x, y), BLUE)

# ── Temperature zigzag (three 45° segments: ↘ ↗ ↘) ──────────────────────────
# dx=dy=7 per segment, total width=21px, spanning x=1..22
d = ImageDraw.Draw(img)
x0, yt, yb = 1, 14, 21
p0  = (x0,      yt)
p1  = (x0 + 7,  yb)
p2  = (x0 + 14, yt)   # end of center segment
p2b = (x0 + 12, yt)   # start of last segment (2px left)
p3  = (x0 + 19, yb)
d.line([p0, p1],  fill=RED, width=2)
d.line([p1, p2],  fill=RED, width=2)
d.line([p2b, p3], fill=RED, width=2)

# ── Save 250×250 nearest-pixel preview ────────────────────────────────────────
preview = img.resize((W * 10, H * 10), Image.NEAREST)
preview.save("resources/launcher_icon_preview.png")
print("Preview saved: resources/launcher_icon_preview.png")

# ── Save 25×25 indexed PNG with Pebble palette ────────────────────────────────
# Index 0 is the transparency placeholder — a colour not used in the image.
# This prevents opaque black (0,0,0) from colliding with the transparency index.
TRANS_PLACEHOLDER = (0, 85, 0)

palette_rgb = [TRANS_PLACEHOLDER]
for r in (0, 85, 170, 255):
    for g in (0, 85, 170, 255):
        for b in (0, 85, 170, 255):
            if (r, g, b) != TRANS_PLACEHOLDER:
                palette_rgb.append((r, g, b))

flat_pal = []
for rgb in palette_rgb:
    flat_pal += list(rgb)
flat_pal += [0, 0, 0] * (256 - len(palette_rgb))

pal_img = Image.new('P', (1, 1))
pal_img.putpalette(flat_pal)

indexed = img.convert('RGB').quantize(palette=pal_img, dither=0)
indexed.info['transparency'] = 0
for y in range(H):
    for x in range(W):
        if img.getpixel((x, y))[3] == 0:
            indexed.putpixel((x, y), 0)

indexed.save("resources/launcher_icon.png")
print("Icon saved:    resources/launcher_icon.png  (25×25, indexed, Pebble palette)")

# ── ASCII preview ──────────────────────────────────────────────────────────────
print("\n25×25 pixel preview:")
for y in range(H):
    row = ""
    for x in range(W):
        r, g, b, a = img.getpixel((x, y))
        if a == 0:                  row += "."
        elif r+g+b < 50:            row += "#"
        elif b > 200 and r < 50:    row += "B"
        elif r > 100 and g+b < 50:  row += "R"
        elif r > 200 and g > 200:   row += "W"
        else:                       row += "?"
    print(row)
