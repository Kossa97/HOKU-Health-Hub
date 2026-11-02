"""HOKU-App-Logo aus dem H-Monogramm (Vorlage des Nutzers, 02.11.2026), mit dem Logo-Design-Skill.

Monogramm: drei H-Arme im 120°-Abstand. Je Arm zwei parallele Balken (Abstand 2d) mit
Querstrich; die Balken benachbarter Arme laufen innen in einem gerundeten Knick zusammen.
Einheit: Armlänge 1. Exakt dreifach symmetrisch, optisch mittig (Begrenzungsrahmen zentriert).

Konzepte:
  a  Linie     – das Monogramm als klare Linienmarke
  b  Partikel  – dieselbe Linie aus gleichmäßig gesetzten Punkten (Hokus Partikel)
  c  Hoku-Ring – das Monogramm in einem Ring aus Partikeln (Hoku als Kugel darum)
python3 h_logo.py <ordner>
"""
import math, sys, os

M = dict(d=0.275, w=0.19, quer=0.569, knick=0.20)
S, C = 256, 128          # Zeichenfläche wie im Skill (viewBox 0 0 256 256)

def geom(m=M):
    """Mittellinien: Liste von Pfaden [(x, y), …] (Knick als Bogen angenähert) und Querstriche."""
    d, quer, r = m['d'], m['quer'], m['knick']
    arme = [math.radians(g) for g in (-90, 30, 150)]
    A = lambda f: (math.cos(f), math.sin(f)); P = lambda f: (-math.sin(f), math.cos(f))
    linien, quer_l = [], []
    for k in range(3):
        f, g = arme[k], arme[(k + 1) % 3]
        a, p, b, q = A(f), P(f), A(g), P(g)
        e1 = (a[0] + d * p[0], a[1] + d * p[1])
        vm = d / math.sin(math.pi / 3)
        v = (vm * math.cos(f + math.pi / 3), vm * math.sin(f + math.pi / 3))
        e2 = (b[0] - d * q[0], b[1] - d * q[1])
        # Bogen am Knick: Tangentenlänge t = r / tan(60°)
        t = r / math.tan(math.pi / 3)
        u1 = norm((e1[0] - v[0], e1[1] - v[1])); u2 = norm((e2[0] - v[0], e2[1] - v[1]))
        t1 = (v[0] + u1[0] * t, v[1] + u1[1] * t); t2 = (v[0] + u2[0] * t, v[1] + u2[1] * t)
        bogen = [bez(t1, v, t2, i / 16) for i in range(17)]
        linien.append([e1] + bogen + [e2])
        quer_l.append([(a[0] * quer + d * p[0], a[1] * quer + d * p[1]), (a[0] * quer - d * p[0], a[1] * quer - d * p[1])])
    return linien, quer_l

def norm(v): l = math.hypot(*v); return (v[0] / l, v[1] / l)
def bez(a, b, c, t): return ((1 - t) ** 2 * a[0] + 2 * (1 - t) * t * b[0] + t * t * c[0], (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * b[1] + t * t * c[1])

def rahmen(m=M):
    """Begrenzung der Strichfläche (mit halber Strichstärke) → Versatz für optische Mitte."""
    linien, quer_l = geom(m)
    pts = [p for l in linien + quer_l for p in l]
    h = m['w'] / 2
    xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
    return min(xs) - h, max(xs) + h, min(ys) - h, max(ys) + h

def abbild(m, groesse):
    x0, x1, y0, y1 = rahmen(m)
    s = groesse / max(x1 - x0, y1 - y0)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    return lambda p: (C + (p[0] - cx) * s, C + (p[1] - cy) * s), s

def pfad(l, T): return 'M' + ' L'.join(f'{T(p)[0]:.2f} {T(p)[1]:.2f}' for p in l)

def linie_svg(m=M, groesse=200, farbe='#000', extra=''):
    linien, quer_l = geom(m); T, s = abbild(m, groesse)
    w = m['w'] * s
    teile = ''.join(f'<path d="{pfad(l, T)}"/>' for l in linien + quer_l)
    return f'<g fill="none" stroke="{farbe}" stroke-width="{w:.2f}" stroke-linejoin="round" stroke-linecap="butt">{teile}</g>{extra}'

def entlang(l, abstand):
    """Punkte gleichmäßig entlang eines Linienzugs."""
    seg = [(l[i], l[i + 1]) for i in range(len(l) - 1)]
    laenge = sum(math.dist(a, b) for a, b in seg)
    n = max(1, round(laenge / abstand)); out = []
    for i in range(n + 1):
        z = i / n * laenge
        for a, b in seg:
            dl = math.dist(a, b)
            if z <= dl + 1e-9:
                q = z / dl if dl else 0; out.append((a[0] + (b[0] - a[0]) * q, a[1] + (b[1] - a[1]) * q)); break
            z -= dl
    return out

def partikel_svg(m=M, groesse=200, farbe='#000', dichte=1.12):
    linien, quer_l = geom(m); T, s = abbild(m, groesse)
    w = m['w']; ab = w * dichte; r = w * 0.42
    pts = []
    for l in linien: pts += entlang(l, ab)
    for l in quer_l:
        # Querstrich: Enden sitzen auf den Balken, dort keine doppelten Punkte
        for p in entlang(l, ab)[1:-1]: pts.append(p)
    return f'<g fill="{farbe}">' + ''.join(f'<circle cx="{T(p)[0]:.2f}" cy="{T(p)[1]:.2f}" r="{r * s:.2f}"/>' for p in pts) + '</g>'

def ring_svg(farbe='#000', R=116, n=96, seed=7):
    """Ring aus Partikeln wie Hokus Kugelrand: Größe schwankt weich um den Umfang, leichte Streuung."""
    out = []
    for i in range(n):
        # exakt rund und gleichmäßig verteilt; nur die Größe verläuft weich (wie Licht auf einer Kugel)
        a = 2 * math.pi * i / n - math.pi / 2
        rr = R
        g = 1.1 + 1.5 * (0.5 + 0.5 * math.cos(a + math.radians(135))) ** 1.5
        out.append(f'<circle cx="{C + rr * math.cos(a):.2f}" cy="{C + rr * math.sin(a):.2f}" r="{g:.2f}"/>')
    return f'<g fill="{farbe}">' + ''.join(out) + '</g>'

def svg(inhalt, titel='HOKU', defs='', px=256):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="{px}" height="{px}"><title>{titel}</title>{defs}{inhalt}</svg>'

KONZEPTE = {
    'a': lambda f: linie_svg(groesse=204, farbe=f),
    'b': lambda f: partikel_svg(groesse=204, farbe=f),
    'c': lambda f: ring_svg(farbe=f) + linie_svg(dict(M, w=0.17), groesse=150, farbe=f),
}

# App-Icon: dunkle Kachel, Monogramm im Cyan-Verlauf (Hokus Cyan-Weiß), weicher Schein
VERLAUF = ('<defs><radialGradient id="k" cx="50%" cy="40%" r="80%"><stop offset="0" stop-color="#0d1d26"/><stop offset="1" stop-color="#03070a"/></radialGradient>'
           '<linearGradient id="v" gradientUnits="userSpaceOnUse" x1="50" y1="30" x2="206" y2="226"><stop offset="0" stop-color="#e9fdff"/><stop offset="0.45" stop-color="#68e6fc"/><stop offset="1" stop-color="#0096c0"/></linearGradient>'
           '<radialGradient id="s" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#50d2f0" stop-opacity=".22"/><stop offset="1" stop-color="#50d2f0" stop-opacity="0"/></radialGradient>'
           '<filter id="g" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter></defs>')

def icon(k, skala=0.74):
    inner = KONZEPTE[k]('url(#v)')
    t = f'translate({C} {C}) scale({skala}) translate({-C} {-C})'
    return svg(f'<rect width="256" height="256" fill="url(#k)"/><circle cx="128" cy="128" r="120" fill="url(#s)"/>'
               f'<g transform="{t}"><g filter="url(#g)" opacity=".55">{inner}</g>{inner}</g>', 'HOKU App-Icon', VERLAUF, px=1024)

if __name__ == '__main__':
    ziel = sys.argv[1]; os.makedirs(ziel, exist_ok=True)
    for k, f in KONZEPTE.items():
        open(f'{ziel}/{k}-symbol.svg', 'w').write(svg(f('#000')))
        open(f'{ziel}/{k}-icon.svg', 'w').write(icon(k))
    print('ok')
