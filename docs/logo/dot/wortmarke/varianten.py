"""Varianten zu Konzept C (Zeichen + Name). Aufruf wie bauen.py:
PYTHONPATH=<fonttools> python3 varianten.py <ausgabe-ordner> <space-grotesk-ordner> <dot-png>"""
import bauen as b

def zeile(k, s, size, track=0.0):
    """Breite eines Textes (für Zentrierung)."""
    _, x = b.text(k, s, size, 0, 0, track=track); return x

def lockup(name, title, nk, nsize, ntrack, dk, dsize, dtext, dtrack, layout="rechts", kugel=1.0, rand=48):
    upm, xh, cap = b.metrics(nk); capx = cap * nsize / upm
    dupm, dxh, dcap = b.metrics(dk); dcapx = dcap * dsize / dupm
    parts = []
    if layout == "rechts":            # Name über Zusatz, Kugel spannt beide Zeilen
        base1 = 124; base2 = base1 + dsize * 1.45
        top, bot = base1 - capx, base2
        r = (bot - top) / 2 * 1.06 * kugel; kcx = rand + r; kcy = (top + bot) / 2
        tx = kcx + r + r * 0.42
        d1, x1 = b.text(nk, "Dot", nsize, tx, base1, track=ntrack)
        d2, x2 = b.text(dk, dtext, dsize, tx + nsize * 0.012, base2, track=dtrack)
        w = max(x1, x2) + rand; h = 256
    elif layout == "kompakt":         # Kugel nur so hoch wie der Name, Zusatz unter dem Namen
        base1 = 128 + (capx - dsize * 1.5) / 2; base2 = base1 + dsize * 1.5   # Block senkrecht mittig
        r = capx / 2 * 1.12 * kugel; kcx = rand + r; kcy = base1 - capx / 2
        tx = kcx + r + r * 0.5
        d1, x1 = b.text(nk, "Dot", nsize, tx, base1, track=ntrack)
        d2, x2 = b.text(dk, dtext, dsize, tx + nsize * 0.012, base2, track=dtrack)
        w = max(x1, x2) + rand; h = 256
    elif layout == "zeile":           # alles auf einer Grundlinie
        base1 = 128 + capx / 2; r = capx / 2 * 1.18 * kugel; kcx = rand + r; kcy = base1 - capx / 2   # Versalhöhe mittig
        tx = kcx + r + r * 0.5
        d1, x1 = b.text(nk, "Dot", nsize, tx, base1, track=ntrack)
        d2, x2 = b.text(dk, dtext, dsize, x1 + nsize * 0.28, base1, track=dtrack)
        w = x2 + rand; h = 256
    elif layout == "gestapelt":       # Kugel oben, Name und Zusatz zentriert darunter
        r = 74 * kugel; w1 = zeile(nk, "Dot", nsize, ntrack); w2 = zeile(dk, dtext, dsize, dtrack)
        w = max(w1, w2, 2 * r) + 2 * rand
        kcx = w / 2; kcy = rand + r + 8
        base1 = kcy + r + r * 0.42 + capx; base2 = base1 + dsize * 1.55
        d1, _ = b.text(nk, "Dot", nsize, (w - w1) / 2, base1, track=ntrack)
        d2, _ = b.text(dk, dtext, dsize, (w - w2) / 2, base2, track=dtrack)
        h = base2 + rand
    parts = [("kugel", (kcx, kcy, r)), ("text", (d1, "name")), ("text", (d2, "zusatz"))]
    b.bauen(name, title, parts, w, h)

T = "Dot: Health Tracker – "
lockup("c1-basis", T + "C1 Basis", "id-medium", 132, -0.03, "id-regular", 132 * 0.3, "Health Tracker", 0.005)
lockup("c2-kraeftig", T + "C2 Kräftig", "id-semibold", 132, -0.035, "id-medium", 132 * 0.2, "HEALTH TRACKER", 0.14)
lockup("c3-leicht", T + "C3 Leicht", "id-light", 140, -0.02, "id-regular", 140 * 0.27, "Health Tracker", 0.01)
lockup("c4-zeile", T + "C4 Eine Zeile", "id-medium", 132, -0.03, "id-regular", 132, "Health Tracker", -0.02, layout="zeile")
lockup("c5-kompakt", T + "C5 Kompakt", "id-semibold", 132, -0.035, "id-regular", 132 * 0.26, "Health Tracker", 0.005, layout="kompakt")
lockup("c6-gestapelt", T + "C6 Gestapelt", "id-medium", 104, -0.03, "id-regular", 104 * 0.3, "Health Tracker", 0.005, layout="gestapelt")
lockup("c7-app-schrift", T + "C7 Schrift der App", "sg-500", 132, -0.02, "id-regular", 132 * 0.28, "Health Tracker", 0.005)
