"""Siegel, reduziert (Nutzer 27.10.: „ästhetischer, cleaner, simpler“). Eine Idee je Siegel, eine Linienstärke,
mehr Luft; in Farbe sind Linien leises Weiß, damit nur Dot leuchtet.
Aufruf: PYTHONPATH=<fonttools>:../wortmarke:. python3 siegel_clean.py <ausgabe> <font-ordner> <dot-png>"""
import math, random
import siegel as s0
f, b, C, W = s0.f, s0.b, s0.C, s0.W

LW = 1.0                        # eine Linienstärke für alles
KR = 54                         # Dot
RR = 98                         # Hauptring
T = "Dot: Health Hub – Siegel clean "

def linie(d, w=LW, deck=0.38, cap="round"):
    st = lambda col, op: f'<path d="{d}" fill="none" stroke="{col}" stroke-width="{w}" stroke-linecap="{cap}" stroke-opacity="{op}"/>'
    return ("roh", {"farbe": st("#e6ebf5", deck), "schwarz": st("#000", 1), "weiss": st("#fff", 1)})

def punkt(x, y, r):
    return ("roh", {"farbe": f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r * 2.4:.2f}" fill="#6ee6ff" fill-opacity="0.16"/><circle cx="{x:.2f}" cy="{y:.2f}" r="{r:.2f}" fill="#bfefff"/>',
                    "schwarz": f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r:.2f}" fill="#000"/>', "weiss": f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r:.2f}" fill="#fff"/>'})

def polar(r, grad): a = math.radians(grad); return C + r * math.sin(a), C - r * math.cos(a)
N = "DOT · HEALTH HUB"
unten = lambda txt, r=RR + 8, size=9.5, sp=0.42: ("text", s0.bogen("mono6", txt, size, r, unten=True, sperrung=sp), "zusatz")
oben = lambda txt, r=RR + 8, size=9.5, sp=0.42: ("text", s0.bogen("mono6", txt, size, r, sperrung=sp), "zusatz")

# 1 · Mission: ein Ring, Text oben und unten, zwei Punkte als Trenner
f.schreiben("siegel-clean-1-mission", T + "Mission", W, W, [
    linie(s0.kreis(RR)), oben(N), unten("EST · 2026"), punkt(*polar(RR + 12, 90), 1.6), punkt(*polar(RR + 12, 270), 1.6), ("kugel", C, C, KR)])

# 2 · Radar: Ring, vier Marken, ein leiser Suchstrahl
marken = "".join(f"M{polar(RR - 6, g)[0]:.2f} {polar(RR - 6, g)[1]:.2f}L{polar(RR + 6, g)[0]:.2f} {polar(RR + 6, g)[1]:.2f}" for g in (0, 90, 180, 270))
a0, a1 = 18, 62
keil_d = f"M{C} {C}L{polar(RR, a0)[0]:.2f} {polar(RR, a0)[1]:.2f}A{RR} {RR} 0 0 1 {polar(RR, a1)[0]:.2f} {polar(RR, a1)[1]:.2f}Z"
g0, g1 = polar(80, a0), polar(80, a1)
keil = ("roh", {"farbe": f'<defs><linearGradient id="swc" gradientUnits="userSpaceOnUse" x1="{g0[0]:.1f}" y1="{g0[1]:.1f}" x2="{g1[0]:.1f}" y2="{g1[1]:.1f}"><stop offset="0" stop-color="#6ee6ff" stop-opacity="0"/><stop offset="1" stop-color="#6ee6ff" stop-opacity="0.22"/></linearGradient></defs><path d="{keil_d}" fill="url(#swc)"/>',
                "schwarz": f'<path d="M{polar(KR + 6, a1)[0]:.2f} {polar(KR + 6, a1)[1]:.2f}L{polar(RR, a1)[0]:.2f} {polar(RR, a1)[1]:.2f}" stroke="#000" stroke-width="{LW}"/>',
                "weiss": f'<path d="M{polar(KR + 6, a1)[0]:.2f} {polar(KR + 6, a1)[1]:.2f}L{polar(RR, a1)[0]:.2f} {polar(RR, a1)[1]:.2f}" stroke="#fff" stroke-width="{LW}"/>'})
f.schreiben("siegel-clean-2-radar", T + "Radar", W, W, [keil, linie(s0.kreis(RR)), linie(marken), unten(N, RR + 14), ("kugel", C, C, KR), punkt(*polar(78, 50), 2.2)])

# 3 · Orbit: eine geneigte Bahn, ein Satellit, sonst nichts
rx, ry, rot = 104, 30, math.radians(-16)
f.schreiben("siegel-clean-3-orbit", T + "Orbit", W, W, [linie(s0.bahn(rx, ry, rot, KR)), ("kugel", C, C, KR), punkt(*s0.punkt_auf_bahn(rx, ry, rot, 0.55)[:2], 2.6), unten(N, RR + 16)])

# 4 · Staubring: ein feiner, gleichmäßiger Ring aus Teilchen
random.seed(11); staub = []
for i in range(260):
    a = 2 * math.pi * i / 260 + random.uniform(-0.01, 0.01); rr = 82 + random.gauss(0, 2.2)
    staub.append((C + rr * math.sin(a), C - rr * math.cos(a), 0.55 + 0.5 * random.random() ** 2))
staub_teil = ("roh", {"farbe": "".join(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r:.2f}" fill="#cfe9ff" fill-opacity="0.75"/>' for x, y, r in staub),
                      "schwarz": "".join(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r:.2f}"/>' for x, y, r in staub),
                      "weiss": "".join(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r:.2f}" fill="#fff"/>' for x, y, r in staub)})
f.schreiben("siegel-clean-4-staubring", T + "Staubring", W, W, [staub_teil, ("kugel", C, C, KR), unten(N, RR + 12)])

# 5 · Rahmen: vier Eckwinkel um Dot, Kennung darunter
e, L = 92, 18
ecken = "".join(f"M{C + sx * e:.1f} {C + sy * (e - L):.1f}L{C + sx * e:.1f} {C + sy * e:.1f}L{C + sx * (e - L):.1f} {C + sy * e:.1f}" for sx in (-1, 1) for sy in (-1, 1))
d1, w1 = b.text("mono6", N, 9.5, 0, 0, track=0.42); d1, _ = b.text("mono6", N, 9.5, C - w1 / 2, C + e - 10, track=0.42)
f.schreiben("siegel-clean-5-rahmen", T + "Rahmen", W, W, [linie(ecken, cap="square"), ("kugel", C, C - 8, KR), ("text", d1, "zusatz")])

# 6 · Fortschritt: ein durchgehender Bogen, am Ende ein Punkt
ende = 270
bog = s0.bogenlinie(RR - 8, 0.0, math.radians(ende))
rest = s0.bogenlinie(RR - 8, math.radians(ende), 2 * math.pi - 0.001)
f.schreiben("siegel-clean-6-fortschritt", T + "Fortschritt", W, W, [linie(rest, deck=0.14), linie(bog, w=2.2, deck=0.7), punkt(*polar(RR - 8, ende), 3.2),
    ("kugel", C, C, KR), unten(N, RR + 6)])
