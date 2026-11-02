"""Konzept C: Hoku als geometrische Vektormarke.
Die Punkte liegen auf Breitenkreisen um die Blickachse; innen ist die Pupille leer, der
erste Kreis ist dicht und kräftig (Irisblende wie in engine/auge.ts). Die Kugel blickt
leicht nach oben rechts, so werden Pupille und Kreise zu Ellipsen und sie wirkt räumlich.
Punktgröße nach Tiefe. Nur Kreise, eine Farbe.
python3 vektor.py <out.svg> [pupille°=19] [abstand°=10] [yaw°=22] [pitch°=14] [fill=#000]"""
import math, sys
a = sys.argv
out = a[1]
TP = math.radians(float(a[2]) if len(a) > 2 else 19)
D = math.radians(float(a[3]) if len(a) > 3 else 10)
YAW = math.radians(float(a[4]) if len(a) > 4 else 22)
PIT = math.radians(float(a[5]) if len(a) > 5 else 14)
fill = a[6] if len(a) > 6 else '#000'
FARBIG = fill == 'farbig'
C, R = 128, 106
ga = math.pi * (3 - math.sqrt(5))
# Blickachse G und zwei Achsen senkrecht dazu (x rechts, y unten, z zum Betrachter)
G = (math.cos(PIT) * math.sin(YAW), -math.sin(PIT), math.cos(PIT) * math.cos(YAW))
ex = (math.cos(YAW), 0, -math.sin(YAW))
ey = (G[1] * ex[2] - G[2] * ex[1], G[2] * ex[0] - G[0] * ex[2], G[0] * ex[1] - G[1] * ex[0])
pts = []
th, k = TP + D * 0.55, 0
while th < math.radians(178):
    n = max(1, round(2 * math.pi * math.sin(th) / D * (1.22 if k == 0 else 1)))
    for j in range(n):
        az = k * ga + 2 * math.pi * j / n
        s, c = math.sin(th), math.cos(th)
        v = [G[i] * c + s * (math.cos(az) * ex[i] + math.sin(az) * ey[i]) for i in range(3)]
        if v[2] < 0.08: continue
        r = 3.7 * (0.4 + 0.6 * v[2]) * (1.2 if k == 0 else 1)
        pts.append((v[2], C + R * v[0], C + R * v[1], r, v[0], v[1], k == 0))
    th += D; k += 1
pts.sort()
def farbe(X, Y):
    # wie dotColor in der Engine: Cyan -> Violett diagonal, unten Pink
    cy, vi, pk = (110, 230, 255), (175, 135, 255), (255, 120, 200)
    m = min(1, max(0, (X - Y) * 0.32 + 0.5))
    c = [cy[i] + (vi[i] - cy[i]) * m for i in range(3)]
    if Y > 0.55:
        q = min(1, (Y - 0.55) * 1.4); c = [c[i] + (pk[i] - c[i]) * q for i in range(3)]
    return '#%02x%02x%02x' % tuple(round(x) for x in c)
if FARBIG:
    # App-Icon: dunkle Kachel wie im Brand-Kit, Schein, Punkte farbig; vorn heller
    els = ''.join(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r * 0.92:.2f}" fill="{farbe(X, Y)}" opacity="{0.45 + 0.55 * z:.2f}"/>' for z, x, y, r, X, Y, iris in pts)
    hell = ''.join(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r * 0.42:.2f}"/>' for z, x, y, r, X, Y, iris in pts if z > 0.55)
    defs = ('<defs><radialGradient id="k" cx="50%" cy="42%" r="88%"><stop offset="0" stop-color="#141c33"/><stop offset="1" stop-color="#05060a"/></radialGradient>'
            '<radialGradient id="s" cx="50%" cy="50%" r="50%"><stop offset="0.1" stop-color="#46aaff" stop-opacity=".2"/><stop offset=".5" stop-color="#966eff" stop-opacity=".08"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>'
            '<filter id="g" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="2.2"/></filter></defs>')
    body = (f'<rect width="256" height="256" fill="url(#k)"/><circle cx="128" cy="128" r="190" fill="url(#s)"/>'
            f'<g transform="translate(128 128) scale(.8) translate(-128 -128)"><g filter="url(#g)" opacity=".85">{els}</g><g>{els}</g><g fill="#fff" opacity=".55">{hell}</g></g>')
    open(out, 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="1024" height="1024">{defs}{body}</svg>')
else:
    els = ''.join(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r:.2f}"/>' for z, x, y, r, *_ in pts)
    open(out, 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256"><title>Hoku</title><g fill="{fill}">{els}</g></svg>')
print(out, len(pts), 'Punkte')
