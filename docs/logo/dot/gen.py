"""Dot-Logo-Konzepte: schwarz auf weiss (256er Raster) + farbige App-Icon-Fassung (1024)."""
import math, sys, os
OUT = sys.argv[1]
C = 128.0
CYAN, VIOLET, PINK = (110, 230, 255), (175, 135, 255), (255, 120, 200)
def mix(a, b, m): return tuple(a[i] + (b[i] - a[i]) * m for i in range(3))
def farbe(x, y):  # wie DotLogo.tsx: x,y in -1..1 (y nach unten positiv)
    m = max(0, min(1, (x - y) * 0.32 + 0.5 - 0.035))
    c = mix(CYAN, VIOLET, m)
    if y > 0.55: c = mix(c, PINK, min(1, (y - 0.55) * 1.4))
    return "#%02x%02x%02x" % tuple(int(v) for v in c)
def hash01(i, salt=0):
    x = math.sin(i * 12.9898 + salt * 78.233) * 43758.5453
    return x - math.floor(x)
def circ(x, y, r, fill="#000"): return f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r:.2f}" fill="{fill}"/>'
def svg(body, title): return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256"><title>{title}</title>{body}</svg>'
def write(name, s): open(os.path.join(OUT, name), "w").write(s)

def icon(name, dots, paths=(), title="Dot"):
    """Farbige App-Icon-Fassung 1024: dunkle Kachel, Schein, Punkte in Dots Farben."""
    S = 4
    parts = []
    for x, y, r in dots:
        parts.append(circ(x * S, y * S, r * S, farbe((x - C) / 100, (y - C) / 100)))
    body_paths = "".join(f'<path d="{d}" fill="url(#gBody)" transform="scale({S})"/>' for d in paths)
    inner = body_paths + "".join(parts)
    s = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024"><title>{title}</title>'
         '<defs><radialGradient id="gBg" cx="50%" cy="42%" r="60%"><stop offset="0" stop-color="#121a2e"/><stop offset="1" stop-color="#05060a"/></radialGradient>'
         '<radialGradient id="gGlow" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#46aaff" stop-opacity="0.34"/><stop offset="0.55" stop-color="#966eff" stop-opacity="0.12"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>'
         '<linearGradient id="gBody" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#78e8ff"/><stop offset="0.55" stop-color="#a88cff"/><stop offset="1" stop-color="#ff7ac8"/></linearGradient>'
         '<filter id="blur" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="22"/></filter></defs>'
         '<rect width="1024" height="1024" fill="url(#gBg)"/>'
         '<rect x="112" y="112" width="800" height="800" fill="url(#gGlow)"/>'
         f'<g transform="translate(512 512) scale(0.86) translate(-512 -512)"><g filter="url(#blur)" opacity="0.75">{inner}</g>{inner}</g></svg>')
    write(name, s)

# ---------- A: Kugel aus Punkten ----------
def relax(P, iters=60, step=0.02):
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
def kugel(n, R, rmin, rmax, zmin, jit, tilt=0.38, name="a-kugel"):
    ga = math.pi * (3 - math.sqrt(5))
    P = []
    for i in range(n):
        y = 1 - 2 * (i + 0.5) / n
        rr = math.sqrt(1 - y * y); th = ga * i + (hash01(i, 2) - 0.5) * jit
        P.append([math.cos(th) * rr, y, math.sin(th) * rr])
    P = relax(P)
    pts = []
    for i, (x, y, z) in enumerate(P):
        Y = y * math.cos(tilt) - z * math.sin(tilt)
        Z = y * math.sin(tilt) + z * math.cos(tilt)
        if Z < zmin: continue
        f = (Z - zmin) / (1 - zmin)
        pts.append((C + x * R, C + Y * R, rmin + (rmax - rmin) * f * (0.85 + 0.3 * hash01(i, 3)), Z))
    pts.sort(key=lambda p: p[3])
    dots = [(x, y, r) for x, y, r, _ in pts]
    write(name + ".svg", svg("".join(circ(*d) for d in dots), "Dot – Kugel"))
    icon(name + "-icon.svg", dots)
    return len(dots)

# ---------- B: Ein Punkt, von dem sich oben rechts Punkte loesen (organisch) ----------
def punkt(name="b-punkt", R=82.0, n=26, base=-45, half=56, dmin=3.0, dmax=50.0, smax=8.0, smin=3.4, seed=7):
    path = f'M {C - R} {C} A {R} {R} 0 1 1 {C + R} {C} A {R} {R} 0 1 1 {C - R} {C} Z'
    dots, i = [], 0
    while len(dots) < n and i < 4000:
        i += 1
        u, v = hash01(i, seed), hash01(i, seed + 1)
        # Abstand vom Rand: nah am Rand dichter (u^1.6), Winkel: mittig dichter
        dist = dmin + (dmax - dmin) * (u ** 1.6)
        t = (v * 2 - 1) * half * (0.55 + 0.45 * (dist / dmax))  # weit draussen breiter gestreut
        f = dist / dmax
        sz = smax + (smin - smax) * (f ** 0.8)
        sz *= 0.85 + 0.3 * hash01(i, seed + 2)
        th = math.radians(base + t)
        rad = R + dist + sz
        x, y = C + rad * math.cos(th), C + rad * math.sin(th)
        if x + sz > 254 or y - sz < 2: continue
        if any(math.hypot(x - a, y - b) < sz + c + 3.0 for a, b, c in dots): continue
        dots.append((x, y, sz))
    write(name + ".svg", svg(f'<path d="{path}" fill="#000"/>' + "".join(circ(*d) for d in dots), "Dot – Punkt"))
    icon(name + "-icon.svg", dots, (path,))
    return len(dots)

# ---------- C: Punkt mit Bahn (Dot in Bewegung) ----------
def bahn(name="c-bahn", head=(104, 150, 50), ctrl=(118, 22), end=(222, 70), ts=(0.42, 0.6, 0.76, 0.9), sizes=(13, 9.5, 7, 5)):
    def bez(t):
        u = 1 - t
        return (u * u * head[0] + 2 * u * t * ctrl[0] + t * t * end[0], u * u * head[1] + 2 * u * t * ctrl[1] + t * t * end[1])
    dots = [(head[0], head[1], head[2])] + [(*bez(t), sz) for t, sz in zip(ts, sizes)]
    write(name + ".svg", svg("".join(circ(*d) for d in dots), "Dot – Bahn"))
    icon(name + "-icon.svg", dots)
    return dots

print("A", kugel(150, 96, 3.0, 8.4, 0.0, 0.6))
print("A-klein", kugel(56, 96, 5.0, 11.5, 0.05, 0.6, name="a-kugel-klein"))
print("B", punkt())
print("C", [(round(x), round(y), s) for x, y, s in bahn()])
