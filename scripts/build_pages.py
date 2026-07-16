#!/usr/bin/env python3
"""Build Neusic GitHub Pages metadata, social cards, and shared chrome."""

from __future__ import annotations

import re
import struct
import sys
import zlib
from datetime import datetime, timezone
from pathlib import Path

WIDTH = 1200
HEIGHT = 630


def _blend(base: int, overlay: int, alpha: float) -> int:
    return max(0, min(255, round(base * (1 - alpha) + overlay * alpha)))


def _make_canvas(top: tuple[int, int, int], bottom: tuple[int, int, int]) -> bytearray:
    pixels = bytearray(WIDTH * HEIGHT * 3)
    for y in range(HEIGHT):
        t = y / max(1, HEIGHT - 1)
        color = tuple(round(top[i] * (1 - t) + bottom[i] * t) for i in range(3))
        row = bytes(color) * WIDTH
        start = y * WIDTH * 3
        pixels[start : start + WIDTH * 3] = row
    return pixels


def _rect(pixels: bytearray, x1: int, y1: int, x2: int, y2: int, color: tuple[int, int, int], alpha: float = 1.0) -> None:
    x1, y1 = max(0, x1), max(0, y1)
    x2, y2 = min(WIDTH, x2), min(HEIGHT, y2)
    for y in range(y1, y2):
        row = y * WIDTH * 3
        for x in range(x1, x2):
            idx = row + x * 3
            pixels[idx] = _blend(pixels[idx], color[0], alpha)
            pixels[idx + 1] = _blend(pixels[idx + 1], color[1], alpha)
            pixels[idx + 2] = _blend(pixels[idx + 2], color[2], alpha)


def _frame(pixels: bytearray, x1: int, y1: int, x2: int, y2: int, color: tuple[int, int, int], thickness: int = 2) -> None:
    _rect(pixels, x1, y1, x2, y1 + thickness, color)
    _rect(pixels, x1, y2 - thickness, x2, y2, color)
    _rect(pixels, x1, y1, x1 + thickness, y2, color)
    _rect(pixels, x2 - thickness, y1, x2, y2, color)


def _circle_ring(pixels: bytearray, cx: int, cy: int, radius: int, color: tuple[int, int, int], thickness: int = 8) -> None:
    outer = radius * radius
    inner = max(0, radius - thickness) ** 2
    for y in range(max(0, cy - radius), min(HEIGHT, cy + radius + 1)):
        dy = y - cy
        for x in range(max(0, cx - radius), min(WIDTH, cx + radius + 1)):
            d = (x - cx) ** 2 + dy * dy
            if inner <= d <= outer:
                idx = (y * WIDTH + x) * 3
                pixels[idx : idx + 3] = bytes(color)


def _write_png(path: Path, pixels: bytearray) -> None:
    raw = bytearray()
    stride = WIDTH * 3
    for y in range(HEIGHT):
        raw.append(0)
        raw.extend(pixels[y * stride : (y + 1) * stride])

    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", WIDTH, HEIGHT, 8, 2, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(bytes(raw), 9))
    png += chunk(b"IEND", b"")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png)


def _base_card(accent: tuple[int, int, int], accent2: tuple[int, int, int]) -> bytearray:
    pixels = _make_canvas((7, 9, 11), (14, 19, 23))
    _rect(pixels, 28, 28, WIDTH - 28, HEIGHT - 28, (6, 10, 13), 0.72)
    _frame(pixels, 28, 28, WIDTH - 28, HEIGHT - 28, (66, 78, 86), 2)
    _rect(pixels, 50, 86, WIDTH - 50, 89, (60, 70, 77), 0.9)
    for size, alpha in ((280, 0.05), (210, 0.08), (140, 0.12)):
        _rect(pixels, WIDTH - size, 30, WIDTH - 30, 30 + size, accent, alpha)
        _rect(pixels, WIDTH - size - 70, HEIGHT - size, WIDTH - 40, HEIGHT - 40, accent2, alpha * 0.75)
    return pixels


def build_suite_card(path: Path) -> None:
    colors = [(226, 168, 75), (50, 231, 255), (174, 184, 191)]
    pixels = _base_card(colors[0], colors[1])
    _rect(pixels, 72, 150, 490, 250, (235, 240, 242), 0.96)
    _rect(pixels, 72, 282, 760, 304, (124, 137, 145), 0.9)
    _rect(pixels, 72, 332, 940, 350, colors[0], 0.95)
    for index, color in enumerate(colors):
        x = 72 + index * 360
        _rect(pixels, x, 430, x + 310, 540, (18, 24, 28), 0.96)
        _frame(pixels, x, 430, x + 310, 540, color, 3)
        _rect(pixels, x + 24, 462, x + 86, 512, color, 0.95)
        _rect(pixels, x + 110, 462, x + 270, 480, (232, 237, 239), 0.9)
        _rect(pixels, x + 110, 496, x + 240, 508, (110, 123, 131), 0.9)
    _write_png(path, pixels)


def build_live_card(path: Path) -> None:
    lane_colors = [(77, 231, 238), (158, 124, 255), (105, 217, 148), (242, 189, 91), (237, 111, 137)]
    pixels = _base_card((226, 168, 75), (237, 111, 137))
    _rect(pixels, 72, 150, 650, 230, (238, 242, 244), 0.96)
    _rect(pixels, 72, 270, 910, 292, (226, 168, 75), 0.95)
    for index, color in enumerate(lane_colors):
        x = 68 + index * 222
        _rect(pixels, x, 360, x + 180, 550, (18, 25, 29), 0.96)
        _frame(pixels, x, 360, x + 180, 550, color, 3)
        _circle_ring(pixels, x + 90, 422, 38, color, 8)
        _rect(pixels, x + 28, 477, x + 152, 513, (74, 25, 35) if index == 0 else (28, 36, 40), 0.98)
        _rect(pixels, x + 70, 525, x + 110, 542, color, 0.9)
    _write_png(path, pixels)


def build_wave_card(path: Path) -> None:
    cyan, violet = (50, 231, 255), (158, 124, 255)
    pixels = _base_card(cyan, violet)
    _rect(pixels, 72, 150, 565, 230, (238, 242, 244), 0.96)
    _rect(pixels, 72, 270, 940, 292, cyan, 0.95)
    mid = 455
    previous_y = mid
    for x in range(80, 1120, 4):
        phase = (x - 80) / 1040
        y = round(mid + 62 * __import__("math").sin(phase * 24) + 18 * __import__("math").sin(phase * 97))
        y1, y2 = sorted((previous_y, y))
        _rect(pixels, x, y1, x + 4, y2 + 4, cyan, 0.95)
        previous_y = y
    for index in range(8):
        x = 110 + index * 135
        _circle_ring(pixels, x, mid, 13, violet, 5)
    _write_png(path, pixels)


def build_lab_card(path: Path) -> None:
    graphite, gold = (174, 184, 191), (212, 163, 84)
    pixels = _base_card(graphite, gold)
    _rect(pixels, 72, 150, 500, 230, (238, 242, 244), 0.96)
    _rect(pixels, 72, 270, 820, 292, gold, 0.95)
    track_colors = [gold, (50, 231, 255), (158, 124, 255), (105, 217, 148)]
    for index, color in enumerate(track_colors):
        y = 365 + index * 52
        _rect(pixels, 75, y, 1125, y + 34, (18, 24, 28), 0.98)
        _frame(pixels, 75, y, 1125, y + 34, (62, 72, 78), 1)
        starts = (110, 360, 655, 900)
        widths = (180, 220, 155, 175)
        for clip, start in enumerate(starts):
            width = widths[(index + clip) % len(widths)]
            _rect(pixels, start, y + 6, min(1114, start + width), y + 28, color, 0.75)
    _write_png(path, pixels)


CREATOR_STYLE = '''<style id="neusic-creator-credit-style">
:root{--neusic-credit-safe:14px;--neusic-credit-primary:#d4a354;--neusic-credit-secondary:#f0c77d;--neusic-credit-tertiary:#68d8ff}
.neusic-creator-credit{position:fixed;z-index:100000;max-width:calc(100vw - 16px);padding:3px 7px;pointer-events:none;border:1px solid color-mix(in srgb,var(--neusic-credit-primary) 30%,transparent);background:rgba(2,7,10,.9);font:700 6px/1 "JetBrains Mono",ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;white-space:nowrap;box-shadow:0 4px 16px rgba(0,0,0,.42),inset 0 0 12px color-mix(in srgb,var(--neusic-credit-primary) 8%,transparent);isolation:isolate}
.neusic-creator-credit span{display:block;color:transparent;background:linear-gradient(90deg,var(--neusic-credit-primary),var(--neusic-credit-secondary),var(--neusic-credit-tertiary),var(--neusic-credit-secondary),var(--neusic-credit-primary));background-size:320% 100%;background-position:0 50%;-webkit-background-clip:text;background-clip:text;filter:drop-shadow(0 0 3px color-mix(in srgb,var(--neusic-credit-primary) 65%,transparent));animation:neusic-credit-flow 5.2s linear infinite,neusic-credit-pulse 2.6s ease-in-out infinite alternate}
.neusic-creator-top{top:0;left:0;border-width:0 1px 1px 0;border-radius:0 0 5px 0}.neusic-creator-bottom{right:0;bottom:0;border-width:1px 0 0 1px;border-radius:5px 0 0 0}
@keyframes neusic-credit-flow{to{background-position:320% 50%}}@keyframes neusic-credit-pulse{from{opacity:.76;filter:drop-shadow(0 0 2px var(--neusic-credit-primary))}to{opacity:1;filter:drop-shadow(0 0 6px var(--neusic-credit-secondary))}}
body>.neusic-creator-top~#boot{inset:var(--neusic-credit-safe) 0!important}body>.neusic-creator-top~iframe#studio{height:calc(100dvh - (var(--neusic-credit-safe) * 2))!important;margin-top:var(--neusic-credit-safe)!important;margin-bottom:var(--neusic-credit-safe)!important}body>.neusic-creator-top~#app{height:calc(100dvh - (var(--neusic-credit-safe) * 2))!important;max-height:calc(100dvh - (var(--neusic-credit-safe) * 2))!important;margin-top:var(--neusic-credit-safe)!important;margin-bottom:var(--neusic-credit-safe)!important}body>.neusic-creator-top~.topbar{top:var(--neusic-credit-safe)!important}body>.neusic-creator-top~.workspace{padding-bottom:calc(8px + var(--neusic-credit-safe))!important}body>.neusic-creator-top~.performance-shell{padding-top:calc(28px + var(--neusic-credit-safe))!important;padding-bottom:calc(40px + var(--neusic-credit-safe))!important}body>.neusic-creator-bottom~#app #mobile-nav,body>.neusic-creator-bottom~#app .neusic-mobile-nav,body>.neusic-creator-bottom~.wave-mobile-dock,body>.neusic-creator-bottom~#studio-v4-mobile-nav{bottom:var(--neusic-credit-safe)!important}
@media(max-width:580px){.neusic-creator-credit{font-size:5px;letter-spacing:.08em;padding:2px 5px}:root{--neusic-credit-safe:11px}}@media(prefers-reduced-motion:reduce){.neusic-creator-credit span{animation:none;background-position:50% 50%}}
</style>'''
CREATOR_MARKUP = '<div class="neusic-creator-credit neusic-creator-top" data-neusic-creator><span>Made by Anderson Paulino</span></div><div class="neusic-creator-credit neusic-creator-bottom" data-neusic-creator><span>Made by Anderson Paulino</span></div>'
CREATOR_SCRIPT = '''<script id="neusic-creator-credit-script">(()=>{const root=document.documentElement,store="neusic-theme-v1";let last="";const hex=v=>{const m=String(v||"").trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);if(!m)return null;let s=m[1];if(s.length===3)s=[...s].map(x=>x+x).join("");return "#"+s.toLowerCase()};const apply=()=>{let saved={};try{saved=JSON.parse(localStorage.getItem(store)||"{}")}catch(_){}const c=getComputedStyle(root),read=n=>hex(c.getPropertyValue(n));const p=hex(saved.accent)||read("--studio-accent")||read("--acc")||read("--accent")||read("--cyan")||"#d4a354",s=hex(saved.bright)||read("--studio-accent-bright")||read("--accent-bright")||"#f0c77d",t=read("--violet")||"#68d8ff",key=[p,s,t].join("|");if(key===last)return;last=key;root.style.setProperty("--neusic-credit-primary",p);root.style.setProperty("--neusic-credit-secondary",s);root.style.setProperty("--neusic-credit-tertiary",t)};apply();addEventListener("storage",apply);setInterval(apply,1000)})();</script>'''


def upsert_tag(html: str, pattern: str, tag: str) -> str:
    if re.search(pattern, html, flags=re.I | re.S):
        return re.sub(pattern, tag, html, count=1, flags=re.I | re.S)
    return html.replace("</head>", f"  {tag}\n</head>", 1)


def set_meta(html: str, attribute: str, key: str, value: str) -> str:
    tag = f'<meta {attribute}="{key}" content="{value}">'
    pattern = rf'<meta\b[^>]*\b{attribute}=["\']{re.escape(key)}["\'][^>]*>'
    return upsert_tag(html, pattern, tag)


def set_preview(path: Path, *, title: str, description: str, url: str, image: str) -> None:
    html = path.read_text()
    updated = datetime.now(timezone.utc).isoformat()
    html = upsert_tag(html, r"<title\b[^>]*>.*?</title>", f"<title>{title}</title>")
    html = upsert_tag(html, r'<link\b[^>]*\brel=["\']canonical["\'][^>]*>', f'<link rel="canonical" href="{url}">')
    html = upsert_tag(html, r'<link\b[^>]*\brel=["\']image_src["\'][^>]*>', f'<link rel="image_src" href="{image}">')
    for attribute, key, value in [
        ("name", "description", description),
        ("property", "og:type", "website"),
        ("property", "og:locale", "en_US"),
        ("property", "og:site_name", "Neusic"),
        ("property", "og:title", title),
        ("property", "og:description", description),
        ("property", "og:url", url),
        ("property", "og:image", image),
        ("property", "og:image:url", image),
        ("property", "og:image:secure_url", image),
        ("property", "og:image:type", "image/png"),
        ("property", "og:image:width", str(WIDTH)),
        ("property", "og:image:height", str(HEIGHT)),
        ("property", "og:image:alt", f"{title} link preview"),
        ("property", "og:updated_time", updated),
        ("name", "twitter:card", "summary_large_image"),
        ("name", "twitter:title", title),
        ("name", "twitter:description", description),
        ("name", "twitter:image", image),
        ("name", "twitter:image:src", image),
        ("name", "twitter:image:alt", f"{title} link preview"),
    ]:
        html = set_meta(html, attribute, key, value)
    path.write_text(html)


def build(site: Path) -> None:
    social = site / "social"
    build_suite_card(social / "neusic-suite-card-v3.png")
    build_live_card(social / "live-loop-card-v3.png")
    build_wave_card(social / "wave-card-v3.png")
    build_lab_card(social / "lab-card-v3.png")

    base = "https://bnsceo.github.io/NeusicLabV1"
    previews = {
        site / "index.html": (
            "Neusic — Live Loop, Wave & Lab",
            "Three connected music apps: capture synchronized loops, transform sound, and finish the record in one creative workflow.",
            f"{base}/",
            f"{base}/social/neusic-suite-card-v3.png",
        ),
        site / "live-loop/index.html": (
            "Neusic Live Loop — Five-Lane Performance Instrument",
            "Record voice, rhythm, harmony, instruments, and samples across five synchronized touch-first loop lanes. MIDI is optional.",
            f"{base}/live-loop/",
            f"{base}/social/live-loop-card-v3.png",
        ),
        site / "wave-loom/index.html": (
            "Neusic Wave — Sample Performance & Sound Design",
            "Record or upload sound, trim and slice it in The Forge, perform it through Wave, Sample, Granular, or Hybrid engines, and send it to Lab.",
            f"{base}/wave-loom/",
            f"{base}/social/wave-card-v3.png",
        ),
        site / "studio/index.html": (
            "Neusic Lab — Music Production Workspace",
            "Arrange, record, edit, mix, master, recover, and export a connected Neusic project with a persistent track sidebar and dedicated workspace.",
            f"{base}/studio/",
            f"{base}/social/lab-card-v3.png",
        ),
    }
    for page, (title, description, url, image) in previews.items():
        set_preview(page, title=title, description=description, url=url, image=image)

    landing = site / "index.html"
    html = landing.read_text()
    html = re.sub(r'\s*<nav\b[^>]*class=["\']desktop-nav["\'][^>]*>.*?</nav>', "", html, flags=re.I | re.S)
    html = re.sub(r'\s*<button\b[^>]*id=["\']menuButton["\'][^>]*>.*?</button>', "", html, flags=re.I | re.S)
    html = re.sub(r'\s*<nav\b[^>]*id=["\']mobileMenu["\'][^>]*>.*?</nav>', "", html, flags=re.I | re.S)
    if "site-polish.css" not in html:
        html = html.replace("</head>", '<link rel="stylesheet" href="./site-polish.css?v=10"></head>', 1)
    if "site-polish.js" not in html:
        html = html.replace("</body>", '<script src="./site-polish.js?v=10"></script></body>', 1)
    landing.write_text(html)

    for page in site.rglob("*.html"):
        html = page.read_text()
        if "data-neusic-creator" not in html:
            html = html.replace("</head>", CREATOR_STYLE + "</head>", 1)
            body_at = html.find("<body")
            if body_at >= 0:
                body_end = html.find(">", body_at)
                if body_end >= 0:
                    html = html[: body_end + 1] + CREATOR_MARKUP + html[body_end + 1 :]
            html = html.replace("</body>", CREATOR_SCRIPT + "</body>", 1)
        page.write_text(html)


if __name__ == "__main__":
    destination = Path(sys.argv[1] if len(sys.argv) > 1 else "_site")
    if not destination.exists():
        raise SystemExit(f"Pages directory does not exist: {destination}")
    build(destination)
