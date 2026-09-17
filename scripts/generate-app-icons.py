"""
Generates every app-icon asset for iOS, Android, web and the stores from
one source: "The Aperture" mark, using the same geometry as
src/components/auth/BrandMark.tsx (viewBox 0 0 120 120, ring centred at
60,60, outer radius 46, inner radius 25, four 68-degree segments).

Run from mobile-app/:   python scripts/generate-app-icons.py
Needs Pillow only. Everything is drawn at 4x and downsampled, so edges are
anti-aliased without an SVG renderer.
"""

import math
import os

from PIL import Image, ImageDraw

ROOT = os.path.join(os.path.dirname(__file__), '..', 'assets')
IMAGES = os.path.join(ROOT, 'images')
STORE = os.path.join(ROOT, 'store')

SS = 4  # supersampling factor

# Brand colours (qode-theme.ts / Brand Guidelines p.20-21)
GREEN = (0x02, 0x42, 0x2B)
GREEN_DEEP = (0x00, 0x20, 0x17)
QAW = (0x00, 0x84, 0x55)
QGF = (0x0A, 0x34, 0x52)
QTF = (0x55, 0x0E, 0x0E)
GOLD = (0xDA, 0xBD, 0x38)

# Segment centre angles (degrees, screen coords: 0 = right, 90 = down) and
# colours, matching BrandMark.tsx's path order: top, right, bottom, left.
SEGMENTS = [(-90, QAW), (0, QGF), (90, QTF), (180, GOLD)]
HALF_SWEEP = 34  # each segment spans 68 degrees
R_OUTER, R_INNER = 46 / 92, 25 / 92  # as a fraction of the mark's diameter

# On a dark background the navy and maroon segments almost vanish, so the
# dark iOS variant lifts them to the lighter chart strokes the web app uses
# (qode-oneview from-analysis.ts STRATEGY_COLOR.stroke).
DARK_VARIANT = {QGF: (0x6B, 0xA8, 0xDC), QTF: (0xD0, 0x6A, 0x63), QAW: (0x2F, 0xBF, 0x87)}

# Tinted iOS icons are grayscale; iOS applies the user's tint. Distinct
# grays keep the four segments readable.
TINT_GRAYS = {QAW: 255, QGF: 200, QTF: 150, GOLD: 225}


def segment_polygon(cx, cy, diameter, centre_deg, steps=90):
    ro, ri = R_OUTER * diameter, R_INNER * diameter
    a0, a1 = centre_deg - HALF_SWEEP, centre_deg + HALF_SWEEP
    pts = []
    for i in range(steps + 1):
        a = math.radians(a0 + (a1 - a0) * i / steps)
        pts.append((cx + ro * math.cos(a), cy + ro * math.sin(a)))
    for i in range(steps, -1, -1):
        a = math.radians(a0 + (a1 - a0) * i / steps)
        pts.append((cx + ri * math.cos(a), cy + ri * math.sin(a)))
    return pts


def draw_mark(img, size, mark_fraction, colour_for):
    """Draw the mark centred on a size x size canvas (already supersampled)."""
    d = ImageDraw.Draw(img)
    diameter = size * mark_fraction
    for deg, colour in SEGMENTS:
        d.polygon(segment_polygon(size / 2, size / 2, diameter, deg), fill=colour_for(colour))


def gradient(size):
    """Diagonal brand gradient, #02422B top-left to #002017 bottom-right."""
    g = Image.new('RGB', (size, size))
    px = g.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * (size - 1))
            px[x, y] = tuple(round(a + (b - a) * t) for a, b in zip(GREEN, GREEN_DEEP))
    return g


def render(size, mark_fraction, background, colour_for=lambda c: c + (255,)):
    """background: 'gradient', 'transparent', 'black' or an RGB tuple."""
    big = size * SS
    if background == 'transparent':
        img = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    elif background == 'gradient':
        img = gradient(size).resize((big, big), Image.BICUBIC).convert('RGBA')
    else:
        img = Image.new('RGBA', (big, big), (0, 0, 0) if background == 'black' else background)
    if mark_fraction:
        draw_mark(img, big, mark_fraction, colour_for)
    return img.resize((size, size), Image.LANCZOS)


def save(img, folder, name, opaque=False):
    os.makedirs(folder, exist_ok=True)
    if opaque:
        img = img.convert('RGB')  # App Store rejects icons with an alpha channel
    img.save(os.path.join(folder, name), optimize=True)
    print('wrote', os.path.relpath(os.path.join(folder, name), os.path.join(ROOT, '..')))


# iOS masks the square itself; ~60% leaves Apple's recommended breathing room.
IOS_MARK = 0.60
# Android adaptive icons: 108dp canvas, 66dp guaranteed-visible circle
# (61%). Google's keyline puts the logo itself around 48dp (44%); 0.48 sits
# comfortably inside every launcher mask without looking cramped.
ANDROID_MARK = 0.48

# --- iOS (and the top-level `icon` fallback) ---
save(render(1024, IOS_MARK, 'gradient'), IMAGES, 'icon.png', opaque=True)
save(render(1024, IOS_MARK, 'transparent',
            lambda c: DARK_VARIANT.get(c, c) + (255,)), IMAGES, 'ios-icon-dark.png')
save(render(1024, IOS_MARK, 'transparent',
            lambda c: (TINT_GRAYS[c],) * 3 + (255,)), IMAGES, 'ios-icon-tinted.png')

# --- Android adaptive icon (8.0+) and themed icon (13+) ---
save(render(1024, ANDROID_MARK, 'transparent'), IMAGES, 'android-icon-foreground.png')
save(render(1024, 0, 'gradient'), IMAGES, 'android-icon-background.png')
save(render(1024, ANDROID_MARK, 'transparent',
            lambda c: (255, 255, 255, 255)), IMAGES, 'android-icon-monochrome.png')

# --- Web ---
save(render(48, 0.72, 'gradient'), IMAGES, 'favicon.png', opaque=True)

# --- Store listings (uploaded by hand, not referenced by app.json) ---
# Play Console: 512x512 32-bit PNG, full square; Google applies the mask.
save(render(512, IOS_MARK, 'gradient'), STORE, 'play-store-icon-512.png', opaque=True)
# App Store Connect takes its marketing icon from the build, this copy is for reference/decks.
save(render(1024, IOS_MARK, 'gradient'), STORE, 'app-store-icon-1024.png', opaque=True)
