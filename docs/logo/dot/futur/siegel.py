"""Abgespacete Siegel-Varianten zu S1 (Nutzer 27.10.: „nur aus Neugier“). Nutzt futur.py und ../wortmarke/bauen.py.
Aufruf: PYTHONPATH=<fonttools>:../wortmarke:. python3 siegel.py <ausgabe> <font-ordner> <dot-png>"""
import sys, math, random
import futur as f
b = f.b
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

T = "Dot: Health Hub – Siegel "
W = 256; C = 128

def bogen(k, s, size, R, mitte=0.0, unten=False, sperrung=0.25):
    """Text auf einem Bogen, mittig um den Winkel 'mitte' (0 = oben, im Uhrzeigersinn).
    Oben: Grundlinie auf R, Buchstaben nach außen. Unten: aufrecht lesbar, Buchstaben nach innen, gleiches Band wie oben."""
    font = b.font(k); gs = font.getGlyphSet(); cmap = font.getBestCmap(); upm = font["head"].unitsPerEm; sc = size / upm; hm = font["hmtx"]
    cap = font["OS/2"].sCapHeight * sc
    names = [cmap[ord(c)] for c in s]; adv = [hm[g][0] * sc for g in names]
    total = sum(adv) + sperrung * size * (len(names) - 1)
    pen = SVGPathPen(gs)
    if not unten:
        th0 = (mitte if mitte else 0) - total / R / 2; pos = 0.0
        for g, a in zip(names, adv):
            th = th0 + (pos + a / 2) / R
            tx, ty, nx, ny = math.cos(th), math.sin(th), math.sin(th), -math.cos(th)
            px, py = C + R * math.sin(th), C - R * math.cos(th)
            gs[g].draw(TransformPen(pen, (sc * tx, sc * ty, sc * nx, sc * ny, px - a / 2 * tx, py - a / 2 * ty)))
            pos += a + sperrung * size
    else:
        Rb = R + cap; mid = math.pi if not mitte else mitte
        th0 = mid + total / Rb / 2; pos = 0.0
        for g, a in zip(names, adv):
            th = th0 - (pos + a / 2) / Rb
            tx, ty = -math.cos(th), -math.sin(th)         # Leserichtung
            ux, uy = -math.sin(th), math.cos(th)          # oben = zur Mitte
            px, py = C + Rb * math.sin(th), C - Rb * math.cos(th)
            gs[g].draw(TransformPen(pen, (sc * tx, sc * ty, sc * ux, sc * uy, px - a / 2 * tx, py - a / 2 * ty)))
            pos += a + sperrung * size
    return pen.getCommands()

def kreis(r): return f"M{C} {C - r}A{r} {r} 0 1 1 {C - 0.01} {C - r}"
def bogenlinie(r, a0, a1):
    x0, y0 = C + r * math.sin(a0), C - r * math.cos(a0); x1, y1 = C + r * math.sin(a1), C - r * math.cos(a1)
    return f"M{x0:.2f} {y0:.2f}A{r} {r} 0 {1 if a1 - a0 > math.pi else 0} 1 {x1:.2f} {y1:.2f}"

def bahn(rx, ry, rot, kr, schritte=240):
    """Ellipse um die Mitte, um 'rot' gedreht; der hintere Teil hinter Dot (Radius kr) fehlt."""
    d, an = [], False
    cr, sr = math.cos(rot), math.sin(rot)
    for i in range(schritte + 1):
        t = 2 * math.pi * i / schritte
        ex, ey = rx * math.cos(t), ry * math.sin(t)
        x, y = C + ex * cr - ey * sr, C + ex * sr + ey * cr
        hinten = math.sin(t) < 0 and math.hypot(x - C, y - C) < kr * 1.08
        if hinten: an = False; continue
        d.append(("L" if an else "M") + f"{x:.2f} {y:.2f}"); an = True
    return "".join(d)

def punkt_auf_bahn(rx, ry, rot, t, r=3.2):
    cr, sr = math.cos(rot), math.sin(rot); ex, ey = rx * math.cos(t), ry * math.sin(t)
    return C + ex * cr - ey * sr, C + ex * sr + ey * cr, r

def sterne(n, r0, r1, seed, rmin=0.6, rmax=1.6):
    random.seed(seed); out = []
    while len(out) < n:
        a = random.random() * 2 * math.pi; rr = r0 + (r1 - r0) * random.random() ** 0.7
        out.append((C + rr * math.sin(a), C - rr * math.cos(a), rmin + (rmax - rmin) * random.random() ** 2))
    return out

fx = lambda x: (x - C) / 110; fy = lambda y: (y - C) / 110
N = "DOT · HEALTH HUB"

# 1 · Mission: Abzeichen wie ein Raumfahrt-Patch
oben = bogen("mono6", N, 13, 100, sperrung=0.32)
unten = bogen("mono6", "EST · 2026", 11, 100, unten=True, sperrung=0.5)
sk = f.ticks(C, C, 86, 90, 120)
f.schreiben("siegel-1-mission", T + "Mission", W, W, [
    ("strich", kreis(122), 2.2), ("strich", kreis(117), 0.9), ("strich", kreis(91), 1.1), ("strich", sk, 0.8),
    ("text", oben, "zusatz"), ("text", unten, "zusatz"),
    ("punkte", [(C - 103, C, 2.6), (C + 103, C, 2.6)], fx, fy),
    ("punkte", sterne(26, 66, 84, 3), fx, fy),
    ("strich", bahn(84, 22, math.radians(-18), 48), 1.0),
    ("kugel", C, C, 48), ("punkte", [punkt_auf_bahn(84, 22, math.radians(-18), 0.35)], fx, fy)])

# 2 · Radar: Fadenkreuz, Ringe, Gradzahlen, Suchstrahl
grad = "".join(bogen("mono", t, 8, 104, mitte=math.radians(a), sperrung=0.1) for t, a in (("000", 0), ("090", 90), ("270", 270)))   # unten steht der Name
kreuz = f"M{C} {C - 98}L{C} {C - 62}M{C} {C + 62}L{C} {C + 98}M{C - 98} {C}L{C - 62} {C}M{C + 62} {C}L{C + 98} {C}"
a0, a1 = math.radians(20), math.radians(68)
keil_d = f"M{C} {C}L{C + 96 * math.sin(a0):.2f} {C - 96 * math.cos(a0):.2f}A96 96 0 0 1 {C + 96 * math.sin(a1):.2f} {C - 96 * math.cos(a1):.2f}Z"
keil = {"farbe": f'<defs><linearGradient id="sw" gradientUnits="userSpaceOnUse" x1="{C + 80 * math.sin(a0):.1f}" y1="{C - 80 * math.cos(a0):.1f}" x2="{C + 80 * math.sin(a1):.1f}" y2="{C - 80 * math.cos(a1):.1f}"><stop offset="0" stop-color="#6ee6ff" stop-opacity="0"/><stop offset="1" stop-color="#6ee6ff" stop-opacity="0.32"/></linearGradient></defs><path d="{keil_d}" fill="url(#sw)"/>',
        "schwarz": "".join(f'<path d="M{C} {C}L{C + 96 * math.sin(a):.2f} {C - 96 * math.cos(a):.2f}" stroke="#000" stroke-width="0.8" stroke-opacity="{0.15 + 0.85 * i / 7:.2f}"/>' for i, a in enumerate([a0 + (a1 - a0) * j / 7 for j in range(8)])),
        "weiss": "".join(f'<path d="M{C} {C}L{C + 96 * math.sin(a):.2f} {C - 96 * math.cos(a):.2f}" stroke="#fff" stroke-width="0.8" stroke-opacity="{0.15 + 0.85 * i / 7:.2f}"/>' for i, a in enumerate([a0 + (a1 - a0) * j / 7 for j in range(8)]))}
unten = bogen("mono6", N, 11.5, 112, unten=True, sperrung=0.34)
f.schreiben("siegel-2-radar", T + "Radar", W, W, [
    ("roh", keil), ("strich", kreis(96), 1.2), ("strich", kreis(78), 0.7), ("strich", kreis(60), 0.5), ("strich", kreuz, 0.9),
    ("strich", f.ticks(C, C, 96, 100, 72), 0.8), ("text", grad, "zusatz"), ("text", unten, "zusatz"),
    ("punkte", [(C + 72 * math.sin(math.radians(58)), C - 72 * math.cos(math.radians(58)), 2.8), (C + 86 * math.sin(math.radians(140)), C - 86 * math.cos(math.radians(140)), 1.8)], fx, fy),
    ("kugel", C, C, 44)])

# 3 · Orbits: drei Bahnen wie ein Atom, Kreisschrift außen
bahnen = [(98, 30, math.radians(a)) for a in (-30, 30, 90)]
f.schreiben("siegel-3-orbits", T + "Orbits", W, W, [
    *[("strich", bahn(rx, ry, ro, 50), 1.0) for rx, ry, ro in bahnen],
    ("text", f.ring_text("mono6", "DOT · HEALTH HUB · DOT · HEALTH HUB · DOT · HEALTH HUB · ", 10, C, C, 116), "zusatz"),
    ("kugel", C, C, 50),
    ("punkte", [punkt_auf_bahn(rx, ry, ro, t) for (rx, ry, ro), t in zip(bahnen, (0.5, 2.3, 4.2 - math.pi))], fx, fy)])

# 4 · Galaxie: Ring aus Teilchen um Dot, Text oben und unten
oben = bogen("mono6", "DOT", 14, 104, sperrung=0.6); unten = bogen("mono6", "HEALTH HUB", 11, 104, unten=True, sperrung=0.45)
random.seed(7); teil = []
for i in range(420):
    a = random.random() * 2 * math.pi; rr = 76 + random.gauss(0, 6.5)
    teil.append((C + rr * math.sin(a), C - rr * math.cos(a) * 0.98, 0.5 + 1.3 * random.random() ** 3))
f.schreiben("siegel-4-galaxie", T + "Galaxie", W, W, [("punkte", teil, fx, fy), ("strich", kreis(96), 0.6), ("text", oben, "zusatz"), ("text", unten, "zusatz"), ("kugel", C, C, 50)])

# 5 · HUD: Sechseck mit Eckwinkeln, Text auf den Kanten
def hexpunkt(r, i): a = math.radians(30 + 60 * i); return C + r * math.sin(a), C - r * math.cos(a)   # flache Seite oben
hx = "M" + "L".join(f"{x:.2f} {y:.2f}" for x, y in (hexpunkt(112, i) for i in range(6))) + "Z"
ecken = ""
for i in range(6):
    x, y = hexpunkt(120, i); x1, y1 = hexpunkt(120, i - 1); x2, y2 = hexpunkt(120, i + 1)
    ecken += f"M{x + (x1 - x) * 0.12:.2f} {y + (y1 - y) * 0.12:.2f}L{x:.2f} {y:.2f}L{x + (x2 - x) * 0.12:.2f} {y + (y2 - y) * 0.12:.2f}"
d1, w1 = b.text("mono6", "DOT // HEALTH HUB", 8.6, 0, 0, track=0.26); d1, _ = b.text("mono6", "DOT // HEALTH HUB", 8.6, C - w1 / 2, C - 70, track=0.26)
d2, w2 = b.text("mono", "N° 0001", 9.5, 0, 0, track=0.4); d2, _ = b.text("mono", "N° 0001", 9.5, C - w2 / 2, C + 82, track=0.4)
f.schreiben("siegel-5-hud", T + "HUD", W, W, [("strich", hx, 1.1), ("strich", ecken, 2.2), ("strich", kreis(60), 0.6),
    ("strich", f.ticks(C, C, 60, 64, 48), 0.7), ("text", d1, "zusatz"), ("text", d2, "zusatz"), ("kugel", C, C, 52)])

# 6 · Fortschritt: segmentierter Ring wie eine Ladeanzeige, Text oben und unten
seg = ""
for i in range(40):
    a = 2 * math.pi * i / 40 + 0.02; seg_end = a + 2 * math.pi / 40 * 0.62
    if i < 29: seg += bogenlinie(90, a, seg_end)
blass = "".join(bogenlinie(90, 2 * math.pi * i / 40 + 0.02, 2 * math.pi * i / 40 + 0.02 + 2 * math.pi / 40 * 0.62) for i in range(29, 40))
oben = bogen("mono6", "TRACKED", 11, 108, sperrung=0.5); unten = bogen("mono6", N, 10.5, 108, unten=True, sperrung=0.32)
f.schreiben("siegel-6-fortschritt", T + "Fortschritt", W, W, [("strich", seg, 5.5), ("roh", {m: f'<path d="{blass}" fill="none" stroke="{c}" stroke-width="5.5" stroke-opacity="0.22"/>' for m, c in (("farbe", "#6ee6ff"), ("schwarz", "#000"), ("weiss", "#fff"))}),
    ("strich", kreis(78), 0.6), ("text", oben, "zusatz"), ("text", unten, "zusatz"), ("kugel", C, C, 56)])
