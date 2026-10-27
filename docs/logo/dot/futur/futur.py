"""Futuristische Schriftzüge und Stempel/Wasserzeichen für Dot. Nutzt die Helfer aus ../wortmarke/bauen.py.
Aufruf: PYTHONPATH=<fonttools>:../wortmarke python3 futur.py <ausgabe> <font-ordner> <dot-png>
Jede Datei entsteht dreifach: schwarz (PDF, heller Grund), weiss (Foto, dunkler Grund), farbe (auf #05060a)."""
import sys, os, math
sys.argv = [sys.argv[0], sys.argv[1], sys.argv[2], sys.argv[3]]
import bauen as b
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from PIL import Image, ImageDraw, ImageFont

OUT, FD, DOTPNG = sys.argv[1], sys.argv[2], sys.argv[3]
for k, f in {"michroma": "Michroma-400", "sync": "Syncopate-700", "mono": "IBMPlexMono-500", "mono6": "IBMPlexMono-600"}.items():
    b.FONTS[k] = os.path.join(FD, f + ".ttf")

GRAU, CYAN = "#8e98ad", "#6ee6ff"
_C, _V, _P = (110, 230, 255), (175, 135, 255), (255, 120, 200)
def farbe(x, y):
    """Dots Farbe an Stelle x, y (-1..1, y nach unten), wie dotColorInto in dotEngine.ts."""
    mix = lambda a, c, m: tuple(a[i] + (c[i] - a[i]) * m for i in range(3))
    col = mix(_C, _V, max(0, min(1, (x - y) * 0.32 + 0.5 - 0.035)))
    if y > 0.55: col = mix(col, _P, min(1, (y - 0.55) * 1.4))
    return "#%02x%02x%02x" % tuple(int(v) for v in col)

def breite(k, s, size, track):
    _, x = b.text(k, s, size, 0, 0, track=track); return x

def ring_text(k, s, size, cx, cy, R, start=0.0):
    """Text auf einem Kreis (im Uhrzeigersinn, Grundlinie auf R), Sperrung so, dass er den Kreis genau füllt."""
    f = b.font(k); gs = f.getGlyphSet(); cmap = f.getBestCmap(); upm = f["head"].unitsPerEm; sc = size / upm; hm = f["hmtx"]
    names = [cmap[ord(c)] for c in s]; adv = [hm[g][0] * sc for g in names]
    extra = (2 * math.pi * R - sum(adv)) / len(names)
    pen = SVGPathPen(gs); pos = 0.0
    for g, a in zip(names, adv):
        th = start + (pos + a / 2) / R
        tx, ty = math.cos(th), math.sin(th); nx, ny = math.sin(th), -math.cos(th)
        px, py = cx + R * math.sin(th), cy - R * math.cos(th)
        # Glyph: x entlang der Tangente, y (oben) nach aussen; Mitte des Glyphs auf p
        xx, xy, yx, yy = sc * tx, sc * ty, sc * nx, sc * ny
        dx = px - (a / 2) * tx; dy = py - (a / 2) * ty
        gs[g].draw(TransformPen(pen, (xx, xy, yx, yy, dx, dy)))
        pos += a + extra
    return pen.getCommands()

def ticks(cx, cy, r1, r2, n, skip=()):
    d = []
    for i in range(n):
        if i in skip: continue
        th = 2 * math.pi * i / n; s, c = math.sin(th), -math.cos(th)
        d.append(f"M{cx + r1 * s:.2f} {cy + r1 * c:.2f}L{cx + r2 * s:.2f} {cy + r2 * c:.2f}")
    return "".join(d)

def matrix_buchstaben(text, k, hoehe, x0, base, schritt, track=0.12):
    """Buchstaben aus Punkten: Glyph rastern, auf einem Raster abtasten, Punkt wo Fläche ist."""
    px = 600; font = ImageFont.truetype(b.FONTS[k], px)
    dots, x = [], x0
    for ch in text:
        bb = font.getbbox(ch); w, h = bb[2] - bb[0], bb[3] - bb[1]
        img = Image.new("L", (w + 4, h + 4), 0); ImageDraw.Draw(img).text((2 - bb[0], 2 - bb[1]), ch, font=font, fill=255)
        sc = hoehe / h; g = schritt / sc
        cols, rows = int(w / g) + 1, int(h / g) + 1
        for j in range(rows):
            for i in range(cols):
                cx0, cy0 = 2 + (i + 0.5) * g * (w / (cols * g)), 2 + (j + 0.5) * g * (h / (rows * g))
                box = (int(cx0 - g / 2), int(cy0 - g / 2), int(cx0 + g / 2), int(cy0 + g / 2))
                cov = sum(img.crop(box).getdata()) / (255 * max(1, (box[2] - box[0]) * (box[3] - box[1])))
                if cov > 0.42:
                    dots.append((x + (cx0 - 2) * sc, base - hoehe + (cy0 - 2) * sc, schritt * 0.36 * (0.85 + 0.3 * cov)))
        x += w * sc + hoehe * track
    return dots, x - hoehe * track

def schreiben(name, title, w, h, teile):
    """teile: ('text', d, rolle) | ('kugel', cx, cy, r) | ('strich', d, breite) | ('punkte', [(x,y,r)])"""
    for modus, bg in (("schwarz", None), ("weiss", None), ("farbe", "#05060a")):
        out = []
        for t in teile:
            art = t[0]
            if art == "text":
                fill = {"schwarz": "#000", "weiss": "#fff"}.get(modus) or ("#f2f4f8" if t[2] == "name" else GRAU)
                out.append(f'<path d="{t[1]}" fill="{fill}"/>')
            elif art == "kugel":
                if modus == "farbe": out.append(b.kugel_img(t[1], t[2], t[3], w, h))
                else: out.append(f'<g fill="{"#000" if modus == "schwarz" else "#fff"}">{b.kugel_vec(t[1], t[2], t[3])}</g>')
            elif art == "strich":
                col = {"schwarz": "#000", "weiss": "#fff"}.get(modus) or CYAN
                op = "" if modus != "farbe" else ' stroke-opacity="0.55"'
                out.append(f'<path d="{t[1]}" fill="none" stroke="{col}" stroke-width="{t[2]}" stroke-linecap="round"{op}/>')
            elif art == "punkte":
                for (x, y, r) in t[1]:
                    if modus == "farbe":
                        c = farbe(t[2](x), t[3](y))
                        out.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r * 1.6:.2f}" fill="{c}" fill-opacity="0.18"/><circle cx="{x:.2f}" cy="{y:.2f}" r="{r:.2f}" fill="{c}"/>')
                    else:
                        out.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r:.2f}" fill="{"#000" if modus == "schwarz" else "#fff"}"/>')
        b.save(f"{name}-{modus}.svg", b.svg(w, h, "".join(out), title, bg=bg))

T = "Dot: Health Tracker – "
# ---------- F1 · Weit: Michroma, gesperrter Mono-Zusatz ----------
upm, xh, cap = b.metrics("michroma"); size = 96; capx = cap * size / upm
ds = 15; base1 = 128 + (capx - ds * 2.1) / 2; base2 = base1 + ds * 2.1
r = (base2 - (base1 - capx)) / 2 * 1.1; kcx = 52 + r; kcy = (base1 - capx + base2) / 2
tx = kcx + r + r * 0.5
d1, x1 = b.text("michroma", "DOT", size, tx, base1, track=0.16)
d2, x2 = b.text("mono", "HEALTH TRACKER", ds, tx + 2, base2, track=0.42)
schreiben("f1-weit", T + "F1 Weit", max(x1, x2) + 52, 256, [("kugel", kcx, kcy, r), ("text", d1, "name"), ("text", d2, "zusatz")])

# ---------- F2 · Punktschrift: D und T aus Punkten, das O ist Dot ----------
hoehe = 104; base = 128 + hoehe / 2 - 12; step = 8.2
dD, xD = matrix_buchstaben("D", "sync", hoehe, 52, base, step)
ro = hoehe / 2 * 1.08; ox = xD + hoehe * 0.16 + ro; oy = base - hoehe / 2
dT, xT = matrix_buchstaben("T", "sync", hoehe, ox + ro + hoehe * 0.16, base, step)
d2, x2 = b.text("mono", "HEALTH TRACKER", 15, 54, base + 40, track=0.42)
w = max(xT, x2) + 52; fx = lambda x: (x - w / 2) / (w / 2) * 0.9; fy = lambda y: (y - oy) / (hoehe / 2) * 0.8
schreiben("f2-punktschrift", T + "F2 Punktschrift", w, 256, [("punkte", dD + dT, fx, fy), ("kugel", ox, oy, ro), ("text", d2, "zusatz")])

# ---------- F3 · Umlaufbahn: Dot im Ring mit Skala, Syncopate ----------
upm, xh, cap = b.metrics("sync"); size = 70; capx = cap * size / upm
R = 86; kcx = 52 + R; kcy = 128
ring = f"M{kcx} {kcy - R}A{R} {R} 0 1 1 {kcx - 0.01} {kcy - R}"
sk = ticks(kcx, kcy, R + 7, R + 13, 72) + ticks(kcx, kcy, R + 7, R + 19, 8)
sat_th = math.radians(52); sx, sy = kcx + R * math.sin(sat_th), kcy - R * math.cos(sat_th)
tx = kcx + R + 52; base1 = kcy + capx / 2 - 10; base2 = base1 + 32
d1, x1 = b.text("sync", "DOT", size, tx, base1, track=0.14)
d2, x2 = b.text("mono", "HEALTH TRACKER", 14, tx + 2, base2, track=0.42)
schreiben("f3-umlaufbahn", T + "F3 Umlaufbahn", max(x1, x2) + 52, 256,
          [("strich", ring, 1.4), ("strich", sk, 1.2), ("kugel", kcx, kcy, R * 0.66), ("punkte", [(sx, sy, 5.5)], lambda x: 0.6, lambda y: -0.4), ("text", d1, "name"), ("text", d2, "zusatz")])

# ---------- S1 · Siegel: Kreisschrift + Skala + Dot ----------
W = 256; c = 128
rt = ring_text("mono6", "DOT · HEALTH TRACKER · DOT · HEALTH TRACKER · ", 13.5, c, c, 98, start=0)
sk = ticks(c, c, 80, 86, 96) + ticks(c, c, 78, 88, 8)
schreiben("s1-siegel", T + "S1 Siegel", W, W, [("text", rt, "zusatz"), ("strich", sk, 1.1), ("strich", f"M{c} {c - 112}A112 112 0 1 1 {c - 0.01} {c - 112}", 1.2), ("kugel", c, c, 58)])

# ---------- S2 · Kennung: kleine Zeile für Ecken und Fußzeilen ----------
size = 40; upm, xh, cap = b.metrics("michroma"); capx = cap * size / upm
r = capx * 0.78; kcx = 24 + r; kcy = 64
d1, x1 = b.text("michroma", "DOT", size, kcx + r + 16, kcy + capx / 2, track=0.16)
lx = x1 + 18
d2, x2 = b.text("mono", "HEALTH", 11, lx + 16, kcy - 3, track=0.38)
d3, x3 = b.text("mono", "TRACKER", 11, lx + 16, kcy + 12, track=0.38)
schreiben("s2-kennung", T + "S2 Kennung", max(x2, x3) + 24, 128,
          [("kugel", kcx, kcy, r), ("text", d1, "name"), ("strich", f"M{lx} {kcy - capx / 2 - 2}L{lx} {kcy + capx / 2 + 2}", 1.2), ("text", d2, "zusatz"), ("text", d3, "zusatz")])

# ---------- S3 · Erfolg: „TRACKED WITH DOT“ für geteilte Erfolge ----------
r = 30; kcx = 24 + r; kcy = 64
d1, x1 = b.text("mono", "TRACKED WITH", 12, kcx + r + 18, kcy - 10, track=0.38)
d2, x2 = b.text("michroma", "DOT", 30, kcx + r + 18, kcy + 24, track=0.18)
klammer = f"M{kcx + r + 8} {kcy - 26}L{kcx + r + 4} {kcy - 26}L{kcx + r + 4} {kcy + 26}L{kcx + r + 8} {kcy + 26}"
schreiben("s3-erfolg", T + "S3 Erfolg", max(x1, x2) + 24, 128, [("kugel", kcx, kcy, r), ("text", d1, "zusatz"), ("text", d2, "name")])
