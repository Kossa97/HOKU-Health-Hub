"""Dot-Kugel, finale Fassung: Marke (schwarz), App-Icon 1024 (Farbe), Ebenen fuer Icon Composer,
Android-Vordergrund, Favicon. Aufruf: python3 -I docs/logo/dot/kit.py docs/logo/dot/kit"""
import math, sys, os
OUT = sys.argv[1]
C = 128.0
CYAN, VIOLET, PINK = (92, 236, 255), (168, 118, 255), (255, 104, 196)
def mix(a, b, m): return tuple(a[i] + (b[i] - a[i]) * m for i in range(3))
def hexc(c): return "#%02x%02x%02x" % tuple(int(round(v)) for v in c)
def farbe(x, y):  # wie dotEngine.ts / DotLogo.tsx, x,y in -1..1, y nach unten
    m = max(0, min(1, (x - y) * 0.32 + 0.5 - 0.035))
    c = mix(CYAN, VIOLET, m)
    if y > 0.55: c = mix(c, PINK, min(1, (y - 0.55) * 1.4))
    return c
def hash01(i, salt=0):
    x = math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
    return x - math.floor(x)
def write(name, s):
    open(os.path.join(OUT, name), "w").write(s)

def relax(P, iters=80, step=0.02):
    for _ in range(iters):
        F = [[0.0, 0.0, 0.0] for _ in P]
        for i in range(len(P)):
            for j in range(i + 1, len(P)):
                d = [P[i][k] - P[j][k] for k in range(3)]
                dd = max(1e-4, sum(v * v for v in d))
                for k in range(3): F[i][k] += d[k] / dd; F[j][k] -= d[k] / dd
        for i in range(len(P)):
            p = [P[i][k] + F[i][k] * step / len(P) for k in range(3)]
            L = math.sqrt(sum(v * v for v in p)); P[i] = [v / L for v in p]
    return P

def sphere(n, jit=0.6, tilt=0.38, spin=0.9):
    ga = math.pi * (3 - math.sqrt(5))
    P = []
    for i in range(n):
        y = 1 - 2 * (i + 0.5) / n
        rr = math.sqrt(1 - y * y); th = ga * i + (hash01(i, 2) - 0.5) * jit
        P.append([math.cos(th) * rr, y, math.sin(th) * rr])
    P = relax(P)
    out = []
    cs, sn = math.cos(spin), math.sin(spin)
    for i, (x, y, z) in enumerate(P):
        X, Z0 = x * cs + z * sn, -x * sn + z * cs
        Y = y * math.cos(tilt) - Z0 * math.sin(tilt); Z = y * math.sin(tilt) + Z0 * math.cos(tilt)
        out.append((X, Y, Z, 0.5 + 1.1 * hash01(i, 3) ** 1.6))
    return sorted(out, key=lambda p: p[2])

# Geometrie der Marke: Kugelradius 96, Punkte vorn 3.8..9.6
R = 96.0
def separate(res, gap=2.6, fixed=(), iters=300):
    """Schiebt projizierte Punkte auseinander, bis kein Paar naeher als gap ist (fixed: nur ausweichen)."""
    res = [list(p) for p in res]
    for _ in range(iters):
        moved = False
        for i in range(len(res)):
            for j in range(i + 1, len(res)):
                a, b = res[i], res[j]
                dx, dy = b[0] - a[0], b[1] - a[1]
                d = math.hypot(dx, dy) or 1e-3
                need = a[2] + b[2] + gap
                if d < need:
                    push = (need - d) / 2 * 1.05; ux, uy = dx / d, dy / d
                    a[0] -= ux * push; a[1] -= uy * push; b[0] += ux * push; b[1] += uy * push; moved = True
            for f in fixed:
                a = res[i]
                dx, dy = a[0] - f[0], a[1] - f[1]
                d = math.hypot(dx, dy) or 1e-3
                need = a[2] + f[2] + gap * 0.6
                if d < need:
                    push = (need - d) * 1.05; a[0] += dx / d * push; a[1] += dy / d * push; moved = True
        if not moved: break
    return [tuple(p) for p in res]

def dots(pts, zmin, rmin, rmax, fixed=()):
    res = []
    for X, Y, Z, k in pts:
        if Z < zmin: continue
        f = ((Z - zmin) / (1 - zmin)) ** 0.9
        res.append((C + X * R, C + Y * R, (rmin + (rmax - rmin) * f) * k, Z, X, Y))
    return separate(res, fixed=fixed)

def circ(x, y, r, fill, o=None):
    op = "" if o is None else f' fill-opacity="{o:.2f}"'
    return f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r:.2f}" fill="{fill}"{op}/>'

_gid = [0]
def glow_dot(x, y, r, col, o=1.0, soft=0.12):
    """Leuchtpunkt wie gl.POINTS im Shader: Kern voll, dann weicher Abfall. r = Kernradius."""
    _gid[0] += 1; g = f"d{_gid[0]}"
    c = hexc(col); hi = hexc(mix(col, (255, 255, 255), 0.34))
    R2 = r * (1 + soft)
    k = r / R2
    grad = (f'<radialGradient id="{g}"><stop offset="0" stop-color="{hi}" stop-opacity="{o:.2f}"/>'
            f'<stop offset="{k * 0.9:.3f}" stop-color="{c}" stop-opacity="{o:.2f}"/>'
            f'<stop offset="{(k + 1) / 2:.3f}" stop-color="{c}" stop-opacity="{0.3 * o:.2f}"/>'
            f'<stop offset="1" stop-color="{c}" stop-opacity="0"/></radialGradient>')
    return grad, f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{R2:.2f}" fill="url(#{g})"/>'

def marke(front, name, title):
    body = "".join(circ(x, y, r, "#000") for x, y, r, *_ in front)
    write(name, f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256"><title>{title}</title>{body}</svg>')

DEFS = ('<defs>'
        '<radialGradient id="gBg" cx="50%" cy="40%" r="62%"><stop offset="0" stop-color="#0b1020"/><stop offset="0.7" stop-color="#04050a"/><stop offset="1" stop-color="#020306"/></radialGradient>'
        '<radialGradient id="gGlow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#46aaff" stop-opacity="0.22"/><stop offset="0.45" stop-color="#966eff" stop-opacity="0.07"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>'
        '<filter id="blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="14"/></filter>'
        '<filter id="blurW" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="46"/></filter>'
        '</defs>')

def layers(front, back, S=4.0, scale=0.84, glow=True):
    """Liefert die Ebenen (hintergrund, schein, punkte_hinten, punkte_vorn) als SVG-Fragmente auf 1024."""
    tr = f'transform="translate(512 512) scale({scale}) translate(-512 -512)"'
    defs, h, v, vflat = [], [], [], []
    for x, y, r, Z, X, Y in back:
        g, c = glow_dot(x * S, y * S, r * S, mix(farbe(X, Y), (18, 28, 70), 0.62), 0.22 + 0.26 * ((Z + 1) / 2), soft=0.5)
        defs.append(g); h.append(c)
    for x, y, r, Z, X, Y in front:
        g, c = glow_dot(x * S, y * S, r * S, mix((26, 36, 88), farbe(X, Y), 0.58 + 0.42 * Z), 1.0)
        defs.append(g); v.append(c)
        vflat.append(circ(x * S, y * S, r * S, hexc(farbe(X, Y))))
    hinten = "".join(h); vorn = "".join(v); flach = "".join(vflat)
    schein = (f'<rect x="60" y="60" width="904" height="904" fill="url(#gGlow)"/>'
              f'<g filter="url(#blurW)" opacity="0.26">{flach}</g>') if glow else ""
    return {
        "defs": "".join(defs),
        "hintergrund": '<rect width="1024" height="1024" fill="url(#gBg)"/>',
        "schein": f'<g {tr}>{schein}</g>',
        "punkte_hinten": f'<g {tr} style="mix-blend-mode:screen">{hinten}</g>',
        "punkte_vorn": f'<g {tr}>{vorn}</g>',
    }

def svg1024(inner, title, defs=""):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024"><title>{title}</title>{DEFS}'
            + (f'<defs>{defs}</defs>' if defs else '') + inner + '</svg>')

pts = sphere(150)
front = dots(pts, 0.02, 3.8, 9.6)
back = dots([p for p in pts if p[2] < 0.02], -1.0, 1.9, 4.8, fixed=front)
print("vorn", len(front), "hinten", len(back))

# 1 Marke schwarz (Vorderseite)
marke(front, "dot-kugel.svg", "TYD – Dot")
# 2 App-Icon 1024 (alle Ebenen)
L = layers(front, back)
write("dot-kugel-icon.svg", svg1024(L["hintergrund"] + L["schein"] + L["punkte_hinten"] + L["punkte_vorn"], "TYD – App-Icon", L["defs"]))
# 3 Ebenen einzeln (Icon Composer): Hintergrund deckend, Rest transparent
for k, v in L.items():
    if k == "defs": continue
    write(os.path.join("ebenen", f"{k}.svg"), svg1024(v, f"TYD – Ebene {k}", L["defs"]))
# 4 Android-Vordergrund: 108 dp Raster, Kugel in die sichere Zone (66 dp)
La = layers(front, back, scale=0.60)
write("android-foreground.svg", svg1024(
    '<rect width="1024" height="1024" fill="url(#gBg)" opacity="0"/>' + La["schein"] + La["punkte_hinten"] + La["punkte_vorn"], "TYD – Android Vordergrund", La["defs"]))
# 5 Favicon: weniger Punkte, ohne Weichzeichner, auf Kachel
pk = [(X, Y, Z, 0.75 + 0.5 * (k - 0.5)) for X, Y, Z, k in sphere(56)]
fk = dots(pk, 0.05, 5.2, 12.0)
flat = "".join(circ(x * 4, y * 4, r * 4, hexc(farbe(X, Y))) for x, y, r, Z, X, Y in fk)
write("dot-kugel-klein.svg", svg1024(L["hintergrund"] + f'<rect x="92" y="92" width="840" height="840" fill="url(#gGlow)"/>'
      + f'<g transform="translate(512 512) scale(0.9) translate(-512 -512)">{flat}</g>', "TYD – Favicon"))
marke(fk, "dot-kugel-klein-marke.svg", "TYD – Dot klein")
print("ok")
