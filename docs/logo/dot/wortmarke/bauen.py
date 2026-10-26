"""Wortmarke „Dot: Health Tracker“ – drei Konzepte als Pfade (Schrift umgewandelt).
Aufruf: PYTHONPATH=<fonttools> python3 bauen.py <ausgabe-ordner> <space-grotesk-ordner> [dot-png]
Schwarz: Kugel als Vektor (Punkte aus kit/dot-marke.svg). Farbe: weiße Schrift, Kugel als Raster (Dot aus dem Renderer)."""
import sys, os, re, base64
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

OUT, SG = sys.argv[1], sys.argv[2]
DOTPNG = sys.argv[3] if len(sys.argv) > 3 else None
HERE = os.path.dirname(os.path.abspath(__file__))
INTER = "/usr/share/fonts/opentype/inter/"
FONTS = {
    "id-semibold": INTER + "InterDisplay-SemiBold.otf",
    "id-medium": INTER + "InterDisplay-Medium.otf",
    "id-regular": INTER + "InterDisplay-Regular.otf",
    "sg-500": os.path.join(SG, "SpaceGrotesk-500.ttf"),
}
_cache = {}
def font(k):
    if k not in _cache: _cache[k] = TTFont(FONTS[k])
    return _cache[k]

def metrics(k):
    f = font(k); upm = f["head"].unitsPerEm; os2 = f["OS/2"]
    return upm, os2.sxHeight, os2.sCapHeight

def kern_pairs(f):
    """Paar-Unterschneidung aus GPOS (nur Format-1-Paare und Klassen, reicht für wenige Buchstaben)."""
    pairs = {}
    if "GPOS" not in f: return pairs
    for lookup in f["GPOS"].table.LookupList.Lookup:
        for st in lookup.SubTable:
            if lookup.LookupType == 9: st = st.ExtSubTable
            if getattr(st, "Format", None) == 1 and hasattr(st, "PairSet"):
                cov = st.Coverage.glyphs
                for i, ps in enumerate(st.PairSet):
                    for pv in ps.PairValueRecord:
                        v = getattr(pv.Value1, "XAdvance", 0) if pv.Value1 else 0
                        if v: pairs.setdefault((cov[i], pv.SecondGlyph), v)
            elif getattr(st, "Format", None) == 2 and hasattr(st, "Class1Record"):
                cov = set(st.Coverage.glyphs); c1 = st.ClassDef1.classDefs; c2 = st.ClassDef2.classDefs
                st._lookup = (cov, c1, c2, st.Class1Record)
                pairs.setdefault("_class", []).append(st._lookup)
    return pairs

def kern(f, pairs, a, b):
    if (a, b) in pairs: return pairs[(a, b)]
    for cov, c1, c2, rec in pairs.get("_class", []):
        if a in cov:
            r = rec[c1.get(a, 0)].Class2Record[c2.get(b, 0)]
            v = getattr(r.Value1, "XAdvance", 0) if r.Value1 else 0
            if v: return v
    return 0

def text(k, s, size, x, base, track=0.0, adjust=None):
    """Pfad für Text s; size = Schriftgröße in px, base = Grundlinie; track in em; adjust: {index: px} optisch."""
    f = font(k); gs = f.getGlyphSet(); cmap = f.getBestCmap(); upm = f["head"].unitsPerEm; sc = size / upm
    pairs = kern_pairs(f); hm = f["hmtx"]
    names = [cmap[ord(c)] for c in s]
    pen = SVGPathPen(gs); cx = x
    for i, g in enumerate(names):
        if adjust and i in adjust: cx += adjust[i]
        tp = TransformPen(pen, (sc, 0, 0, -sc, cx, base))
        gs[g].draw(tp)
        adv = hm[g][0] * sc
        if i + 1 < len(names): adv += kern(f, pairs, g, names[i + 1]) * sc + track * size
        cx += adv
    return pen.getCommands(), cx

def glyph_bounds(k, ch):
    from fontTools.pens.boundsPen import BoundsPen
    f = font(k); gs = f.getGlyphSet(); g = f.getBestCmap()[ord(ch)]; bp = BoundsPen(gs); gs[g].draw(bp); return bp.bounds

# Kugel: Punkte der einfarbigen Marke (256er Raster, Mitte 128, Radius 0,38*256)
MARKE = open(os.path.join(HERE, "..", "kit", "dot-marke.svg")).read()
CIRC = [tuple(map(float, m)) for m in re.findall(r'<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/>', MARKE)]
R_MARKE = 0.38 * 256
def kugel_vec(cx, cy, r):
    s = r / R_MARKE
    return "".join(f'<circle cx="{cx + (x - 128) * s:.2f}" cy="{cy + (y - 128) * s:.2f}" r="{rr * s:.2f}"/>' for x, y, rr in CIRC)
def kugel_img(cx, cy, r, w, h):
    # Raster aus dem Renderer (dot-hell-1024.png): Kugelradius 0,22 der Kante, damit der Schein (bis 2r) im Bild ausläuft.
    # Eine weiche Maske blendet den Schein vor dem Rand der Fläche aus, sonst entsteht dort eine harte Kante.
    if not DOTPNG: return ""
    side = r / 0.22; b = base64.b64encode(open(DOTPNG, "rb").read()).decode()
    avail = min(cx, cy, w - cx, h - cy); inner = min(r * 1.04, avail * 0.92)
    mid = f"m{int(cx)}{int(cy)}"
    return (f'<defs><radialGradient id="g{mid}" gradientUnits="userSpaceOnUse" cx="{cx:.2f}" cy="{cy:.2f}" r="{avail:.2f}">'
            f'<stop offset="{inner / avail:.3f}" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient>'
            f'<mask id="{mid}" maskUnits="userSpaceOnUse" x="0" y="0" width="{w:.0f}" height="{h:.0f}"><rect width="{w:.0f}" height="{h:.0f}" fill="url(#g{mid})"/></mask></defs>'
            f'<image mask="url(#{mid})" href="data:image/png;base64,{b}" x="{cx - side / 2:.2f}" y="{cy - side / 2:.2f}" width="{side:.2f}" height="{side:.2f}"/>')

def svg(w, h, body, title, bg=None):
    rect = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ""
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" width="{w:.0f}" height="{h:.0f}"><title>{title}</title>{rect}{body}</svg>'

def save(name, s):
    open(os.path.join(OUT, name), "w").write(s); print("wrote", name)

def bauen(name, title, parts, w, h):
    """parts: Liste (art, daten); art 'text' -> (d, rolle) ; 'kugel' -> (cx, cy, r)"""
    schwarz, farbe = [], []
    for art, d in parts:
        if art == "text":
            path, rolle = d
            schwarz.append(f'<path d="{path}" fill="#000"/>')
            farbe.append(f'<path d="{path}" fill="{"#f2f4f8" if rolle == "name" else "#8e98ad"}"/>')
        else:
            schwarz.append(f'<g fill="#000">{kugel_vec(*d)}</g>'); farbe.append(kugel_img(*d, w, h))
    save(f"{name}.svg", svg(w, h, "".join(schwarz), title))
    save(f"{name}-farbe.svg", svg(w, h, "".join(farbe), title, bg="#05060a"))

H = 256
# ---- A: „dot“ mit Dot als Schlusspunkt (Inter Display SemiBold) ----
k = "id-semibold"; upm, xh, cap = metrics(k); size = 150; base = 150
d1, x_end = text(k, "dot", size, 24, base, track=-0.035)
xhpx = xh * size / upm
r = xhpx * 0.25; kx = x_end + size * 0.035 + r; ky = base - r
d2, x2 = text("id-medium", "Health Tracker", size * 0.19, 30, base + 52, track=0.0)
bauen("a-schlusspunkt", "Dot: Health Tracker – Schlusspunkt", [("text", (d1, "name")), ("kugel", (kx, ky, r)), ("text", (d2, "zusatz"))], max(kx + r + 24, x2 + 24), H)

# ---- B: Das o ist Dot (Space Grotesk 500) ----
k = "sg-500"; upm, xh, cap = metrics(k); size = 150; base = 150
dD, xD = text(k, "D", size, 24, base)
xhpx = xh * size / upm; r = xhpx * 0.53
ox = xD + size * 0.012 + r; oy = base - xhpx / 2
dT, xT = text(k, "t", size, ox + r + size * 0.018, base)
d2, x2 = text("id-medium", "Health Tracker", size * 0.19, 30, base + 52)
bauen("b-o-ist-dot", "Dot: Health Tracker – das o ist Dot", [("text", (dD, "name")), ("kugel", (ox, oy, r)), ("text", (dT, "name")), ("text", (d2, "zusatz"))], max(xT, x2) + 24, H)

# ---- C: Zeichen + Wortmarke + Zusatz (Inter Display Medium / Regular) ----
k = "id-medium"; upm, xh, cap = metrics(k); size = 132; capx = cap * size / upm
zs = size * 0.3; base1 = 128 - 4; base2 = base1 + zs * 1.45
blockTop = base1 - capx; blockBot = base2
r = (blockBot - blockTop) / 2 * 1.06; kcx = 48 + r; kcy = (blockTop + blockBot) / 2
tx = kcx + r + r * 0.42
d1, x1 = text(k, "Dot", size, tx, base1, track=-0.03)
d2, x2 = text("id-regular", "Health Tracker", zs, tx + size * 0.012, base2, track=0.005)
bauen("c-lockup", "Dot: Health Tracker – Zeichen und Wortmarke", [("kugel", (kcx, kcy, r)), ("text", (d1, "name")), ("text", (d2, "zusatz"))], max(x1, x2) + 48, H)
