"""Baut das HOKU-App-Icon aus dem Brand-Kit v1 überall in die App ein (Nutzer 30.10.2026).
Fertige Kit-Dateien werden übernommen; was das Kit nicht enthält (Android-Größen, adaptiver Vordergrund,
Startbildschirme), wird aus dem blauen Original erzeugt. Aufruf: python3 -I docs/logo/hoku/export_app.py <repo-root>"""
import sys, os, shutil, base64, io
from PIL import Image, ImageDraw, ImageFilter

ROOT = sys.argv[1]
KIT = os.path.join(ROOT, "docs/logo/hoku/brand-kit-v1/04-Icons")
p = lambda *t: os.path.join(ROOT, *t)
k = lambda f: os.path.join(KIT, f)
SRC = Image.open(k("hoku-app-blau-original-1254.png")).convert("RGB")
N = SRC.size[0]
GRUND = SRC.getpixel((4, 4))                       # Grund des blauen Icons (#080b13, = Android-Hintergrund und Manifest)
KUGEL = 0.678                                      # Kugel = 67,8 % der Bildkante, mittig

def save(img, rel):
    os.makedirs(os.path.dirname(p(rel)), exist_ok=True); img.save(p(rel), optimize=True); print("wrote", rel, img.size)
def kit_png(f, rel, rgb=False):
    img = Image.open(k(f)); img = img.convert("RGB") if rgb else img; save(img, rel)
def voll(size): return SRC.resize((size, size), Image.LANCZOS)
def maske(img, form):
    s = img.size[0]; m = Image.new("L", (s * 4, s * 4), 0); d = ImageDraw.Draw(m)
    if form == "kreis": d.ellipse((0, 0, s * 4 - 1, s * 4 - 1), fill=255)
    else: d.rounded_rectangle((0, 0, s * 4 - 1, s * 4 - 1), radius=int(s * 4 * 0.17), fill=255)
    out = img.convert("RGBA"); out.putalpha(m.resize((s, s), Image.LANCZOS)); return out
def mittig(w, h, kugel_px):
    """Grundfläche w×h, Hoku mittig mit Kugeldurchmesser kugel_px, Bildrand weich in den Grund überblendet."""
    can = Image.new("RGB", (w, h), GRUND); inner = int(round(kugel_px / KUGEL)); img = SRC.resize((inner, inner), Image.LANCZOS)
    m = Image.new("L", (inner, inner), 0); r = int(inner * 0.10)
    ImageDraw.Draw(m).ellipse((r, r, inner - r, inner - r), fill=255); m = m.filter(ImageFilter.GaussianBlur(r * 0.7))
    can.paste(img, ((w - inner) // 2, (h - inner) // 2), m); return can
def svg_mit(img, size, title):
    buf = io.BytesIO(); img.save(buf, "PNG", optimize=True); b = base64.b64encode(buf.getvalue()).decode()
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {size} {size}" width="{size}" height="{size}"><title>{title}</title>'
            f'<!-- HOKU (docs/logo/hoku/brand-kit-v1). Raster eingebettet. --><image href="data:image/png;base64,{b}" width="{size}" height="{size}"/></svg>')

# iOS: 1024 aus dem Kit, ohne Alphakanal (App Store verlangt das)
kit_png("hoku-app-blau-1024.png", "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png", rgb=True)
# Android: Launcher eckig/rund, adaptiver Vordergrund (Kugel ~58 % von 108 dp, sichere Zone 61 %)
for d, s in (("mdpi", 48), ("hdpi", 72), ("xhdpi", 96), ("xxhdpi", 144), ("xxxhdpi", 192)):
    save(maske(voll(s), "eckig"), f"android/app/src/main/res/mipmap-{d}/ic_launcher.png")
    save(maske(voll(s), "kreis"), f"android/app/src/main/res/mipmap-{d}/ic_launcher_round.png")
    fg = round(s * 108 / 48); save(mittig(fg, fg, fg * 0.58), f"android/app/src/main/res/mipmap-{d}/ic_launcher_foreground.png")
# Web / PWA: Kit-Dateien unter neuen Namen (gegen zwischengespeicherte alte Icons)
for size in (180, 192, 512): kit_png(f"hoku-app-blau-{size}.png", f"public/icons/hoku-{size}.png", rgb=True)
kit_png("hoku-app-blau-512.png", "public/icons/hoku-maskable-512.png", rgb=True)   # Kugel 68 % liegt in der sicheren Zone (80 %)
for size in (32, 48, 64): kit_png(f"hoku-favicon-{size}.png", f"public/icons/hoku-favicon-{size}.png")
shutil.copyfile(k("favicon.ico"), p("public/favicon.ico")); print("wrote public/favicon.ico (16/32/48/64)")
# Benachrichtigungen und ältere Verweise
kit_png("hoku-app-blau-192.png", "public/icon-192.png", rgb=True); kit_png("hoku-app-blau-512.png", "public/icon-512.png", rgb=True)
open(p("public/icon.svg"), "w").write(svg_mit(Image.open(k("hoku-app-blau-512.png")).convert("RGB"), 512, "HOKU Health Hub"))
open(p("public/favicon.svg"), "w").write(svg_mit(Image.open(k("hoku-favicon-64.png")), 32, "HOKU Health Hub"))
# Startbildschirme: dunkler Grund, Hoku mittig, Kugel 22 % der kurzen Kante (bleibt beim Zuschneiden sichtbar)
for f in ("splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"):
    save(mittig(2732, 2732, 2732 * 0.22), f"ios/App/App/Assets.xcassets/Splash.imageset/{f}")
res = p("android/app/src/main/res")
for d in sorted(os.listdir(res)):
    f = os.path.join(res, d, "splash.png")
    if d.startswith("drawable") and os.path.exists(f):
        w, h = Image.open(f).size; save(mittig(w, h, min(w, h) * 0.22), f"android/app/src/main/res/{d}/splash.png")
