"""Siegel „TRACKED BY · DOT · Health Hub“ (Nutzer 27.10.: Text muss dabei sein, Dot immer sichtbar, vielfältig).
Klarer Stil aus siegel_clean.py. Aufruf: PYTHONPATH=<fonttools>:../wortmarke:. python3 tracked.py <ausgabe> <font-ordner> <dot-png>"""
import math, random
import siegel_clean as sc
s0, f, b = sc.s0, sc.f, sc.b
C, LW, KR, RR = sc.C, sc.LW, sc.KR, sc.RR
linie, punkt, polar = sc.linie, sc.punkt, sc.polar
T = "Dot: Health Hub – Tracked by "
TB, N = "TRACKED BY", "DOT · HEALTH HUB"

def zentriert(k, s, size, cx, base, track):
    _, w = b.text(k, s, size, 0, 0, track=track); d, _ = b.text(k, s, size, cx - w / 2, base, track=track); return d, w

def name_block(cx, top, gross=30):
    """„TRACKED BY“ klein, „DOT“ breit (Michroma), „Health Hub“ (Inter Display) – zentriert, gibt Teile und Unterkante."""
    t1, _ = zentriert("mono6", TB, 8.5, cx, top + 8, 0.42)
    upm, xh, cap = b.metrics("michroma"); capx = cap * gross / upm
    t2, w2 = zentriert("michroma", "DOT", gross, cx, top + 16 + capx, 0.16)
    t3, _ = zentriert("id-regular", "Health Hub", gross * 0.42, cx, top + 16 + capx + gross * 0.62, 0.0)
    return [("text", t1, "zusatz"), ("text", t2, "name"), ("text", t3, "zusatz")], top + 16 + capx + gross * 0.62

oben = lambda txt, r=RR + 8, size=9.5, sp=0.42: ("text", s0.bogen("mono6", txt, size, r, sperrung=sp), "zusatz")
unten = lambda txt, r=RR + 8, size=9.5, sp=0.42: ("text", s0.bogen("mono6", txt, size, r, unten=True, sperrung=sp), "zusatz")
W = 256

# 1 · Klassisch: Ring, oben TRACKED BY, unten DOT · HEALTH HUB
f.schreiben("tracked-1-klassisch", T + "Klassisch", W, W, [linie(s0.kreis(RR)), oben(TB), unten(N), punkt(*polar(RR + 12, 90), 1.6), punkt(*polar(RR + 12, 270), 1.6), ("kugel", C, C, KR)])

# 2 · Stempel: Doppelring, Kreisschrift einmal rundum
ring = f.ring_text("mono6", "TRACKED BY · DOT · HEALTH HUB · " * 2, 10.5, C, C, 101)   # zweimal, sonst zu weit gesperrt
f.schreiben("tracked-2-stempel", T + "Stempel", W, W, [linie(s0.kreis(116)), linie(s0.kreis(92)), ("text", ring, "zusatz"), ("kugel", C, C, 60)])

# 3 · Medaille: Dot oben im Ring, Name darunter in der Mitte
teile, unter = name_block(C, C + 16, gross=24)
f.schreiben("tracked-3-medaille", T + "Medaille", W, W, [linie(s0.kreis(112)), ("kugel", C, C - 30, 40), *teile])

# 4 · Fortschritt: Bogen mit Endpunkt, Text oben und unten
bog = s0.bogenlinie(RR - 8, math.radians(-135), math.radians(135)); rest = s0.bogenlinie(RR - 8, math.radians(135), math.radians(225))
f.schreiben("tracked-4-fortschritt", T + "Fortschritt", W, W, [linie(rest, deck=0.14), linie(bog, w=2.2, deck=0.7), punkt(*polar(RR - 8, 135), 3.0),
    oben(TB, RR + 4), unten(N, RR + 6), ("kugel", C, C, KR)])

# 5 · Orbit: eine Bahn, Text oben und unten
rx, ry, rot = 100, 28, math.radians(-16)
f.schreiben("tracked-5-orbit", T + "Orbit", W, W, [linie(s0.bahn(rx, ry, rot, KR)), ("kugel", C, C, KR), punkt(*s0.punkt_auf_bahn(rx, ry, rot, 0.55)[:2], 2.6),
    oben(TB, RR + 12), unten(N, RR + 12)])

# 6 · Sucher: Eckwinkel, Dot oben, Name darunter
e, L = 104, 18
ecken = "".join(f"M{C + sx * e:.1f} {C + sy * (e - L):.1f}L{C + sx * e:.1f} {C + sy * e:.1f}L{C + sx * (e - L):.1f} {C + sy * e:.1f}" for sx in (-1, 1) for sy in (-1, 1))
teile, _ = name_block(C, C + 20, gross=26)
f.schreiben("tracked-6-sucher", T + "Sucher", W, W, [linie(ecken, cap="square"), ("kugel", C, C - 30, 42), *teile])

# 7 · Kapsel: waagerecht für Beiträge und Ecken
Wk, Hk = 300, 96; r = Hk / 2 - 6
kapsel = f"M{6 + r} 6L{Wk - 6 - r} 6A{r} {r} 0 0 1 {Wk - 6 - r} {Hk - 6}L{6 + r} {Hk - 6}A{r} {r} 0 0 1 {6 + r} 6Z"
t1, _ = b.text("mono6", TB, 8.5, 92, 36, track=0.42)
t2, x2 = b.text("michroma", "DOT", 22, 92, 62, track=0.16)
t3, _ = b.text("id-regular", "Health Hub", 13, x2 + 12, 62, track=0.0)
f.schreiben("tracked-7-kapsel", T + "Kapsel", Wk, Hk, [linie(kapsel), ("kugel", 6 + r, Hk / 2, r - 10), ("text", t1, "zusatz"), ("text", t2, "name"), ("text", t3, "zusatz")])

# 8 · Ticket: Rahmen mit Abrisslinie, Dot links, Text rechts
Wt, Ht = 320, 120
rahmen = f"M10 10H{Wt - 10}V{Ht - 10}H10Z"
abriss = "".join(f"M104 {y}L104 {y + 4}" for y in range(16, Ht - 14, 8))
t1, _ = b.text("mono6", TB, 8.5, 124, 44, track=0.42)
t2, x2 = b.text("michroma", "DOT", 24, 124, 74, track=0.16)
t3, _ = b.text("id-regular", "Health Hub", 13.5, 124, 96, track=0.0)
f.schreiben("tracked-8-ticket", T + "Ticket", Wt, Ht, [linie(rahmen, cap="square"), linie(abriss, cap="butt"), ("kugel", 57, Ht / 2, 34), ("text", t1, "zusatz"), ("text", t2, "name"), ("text", t3, "zusatz")])

# 9 · Staubring: Teilchenring, Text oben und unten
random.seed(11); staub = []
for i in range(240):
    a = 2 * math.pi * i / 240 + random.uniform(-0.01, 0.01); rr = 80 + random.gauss(0, 2.2)
    staub.append((C + rr * math.sin(a), C - rr * math.cos(a), 0.55 + 0.5 * random.random() ** 2))
staub_teil = ("roh", {"farbe": "".join(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r:.2f}" fill="#cfe9ff" fill-opacity="0.75"/>' for x, y, r in staub),
                      "schwarz": "".join(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r:.2f}"/>' for x, y, r in staub),
                      "weiss": "".join(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r:.2f}" fill="#fff"/>' for x, y, r in staub)})
f.schreiben("tracked-9-staubring", T + "Staubring", W, W, [staub_teil, ("kugel", C, C, KR), oben(TB, RR + 8), unten(N, RR + 10)])
