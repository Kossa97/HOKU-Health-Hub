"""App-Icons aus dem Dot-Bild von Codex (Nutzer 29.10.2026: „perfekt, ändere alle Logos der App“).
Quelle: dot-codex.webp (1254 × 1254, Kugel mittig, 68 % der Breite, Grund #060911).
Aufruf: python3 -I docs/logo/dot/codex/export.py <repo-root>"""
import sys, os, base64, io
from PIL import Image, ImageDraw, ImageFilter

ROOT = sys.argv[1]
SRC = Image.open(os.path.join(ROOT, "docs/logo/dot/codex/dot-codex.webp")).convert("RGB")
GRUND = (6, 9, 17)                       # Ecke des Bildes, auch Android-Hintergrund
N = SRC.size[0]

def p(*teile): return os.path.join(ROOT, *teile)
def save(img, rel):
    os.makedirs(os.path.dirname(p(rel)), exist_ok=True); img.save(p(rel), optimize=True); print("wrote", rel, img.size)

def voll(size):
    """Ganzes Bild, deckend."""
    return SRC.resize((size, size), Image.LANCZOS)

def nah(size, anteil=0.80):
    """Ausschnitt um die Kugel (für kleine Größen): Kugel füllt mehr der Fläche."""
    k = int(N * 0.678 / anteil); o = (N - k) // 2
    return SRC.crop((o, o, o + k, o + k)).resize((size, size), Image.LANCZOS)

def maske(img, form):
    s = img.size[0]; m = Image.new("L", (s * 4, s * 4), 0); d = ImageDraw.Draw(m)
    if form == "kreis": d.ellipse((0, 0, s * 4 - 1, s * 4 - 1), fill=255)
    else: d.rounded_rectangle((0, 0, s * 4 - 1, s * 4 - 1), radius=int(s * 4 * 0.17), fill=255)
    out = img.convert("RGBA"); out.putalpha(m.resize((s, s), Image.LANCZOS)); return out

def vordergrund(size, skala=0.85):
    """Android adaptiv (108 dp): Bild auf 85 %, Ränder weich in den Grund überblendet, Kugel bei ~58 % (sichere Zone 61 %)."""
    can = Image.new("RGB", (size, size), GRUND); inner = int(size * skala); img = SRC.resize((inner, inner), Image.LANCZOS)
    m = Image.new("L", (inner, inner), 0); r = int(inner * 0.08)
    ImageDraw.Draw(m).rectangle((r, r, inner - r, inner - r), fill=255); m = m.filter(ImageFilter.GaussianBlur(r * 0.6))
    o = (size - inner) // 2; can.paste(img, (o, o), m); return can

def svg_mit(img, size, title):
    buf = io.BytesIO(); img.save(buf, "PNG", optimize=True); b = base64.b64encode(buf.getvalue()).decode()
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}"><title>{title}</title>'
            f'<!-- Dot (Bild von Codex, docs/logo/dot/codex). Raster eingebettet. --><image href="data:image/png;base64,{b}" width="{size}" height="{size}"/></svg>')

# iOS: 1024, deckend, iOS rundet selbst
save(voll(1024), "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png")
# Android
for d, s in (("mdpi", 48), ("hdpi", 72), ("xhdpi", 96), ("xxhdpi", 144), ("xxxhdpi", 192)):
    save(maske(voll(s), "eckig"), f"android/app/src/main/res/mipmap-{d}/ic_launcher.png")
    save(maske(voll(s), "kreis"), f"android/app/src/main/res/mipmap-{d}/ic_launcher_round.png")
    save(vordergrund(round(s * 108 / 48)), f"android/app/src/main/res/mipmap-{d}/ic_launcher_foreground.png")
# Web / PWA (neue Namen gegen zwischengespeicherte alte Icons)
save(voll(180), "public/icons/dot-codex-180.png")
save(voll(192), "public/icons/dot-codex-192.png")
save(voll(512), "public/icons/dot-codex-512.png")
save(voll(512), "public/icons/dot-codex-maskable-512.png")       # Kugel 68 % liegt in der sicheren Zone (80 %)
save(nah(32), "public/icons/dot-codex-32.png")
# Benachrichtigungen und ältere Verweise
save(voll(192), "public/icon-192.png"); save(voll(512), "public/icon-512.png")
open(p("public/icon.svg"), "w").write(svg_mit(voll(512), 512, "Dot: Health Hub"))
open(p("public/favicon.svg"), "w").write(svg_mit(nah(64), 32, "Dot: Health Hub"))
# Master im Kit
save(SRC, "docs/logo/dot/codex/dot-codex-1254.png")
save(voll(1024), "docs/logo/dot/codex/dot-codex-1024.png")
