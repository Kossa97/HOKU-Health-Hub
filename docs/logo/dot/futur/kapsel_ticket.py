"""Varianten zu Kapsel und Ticket (Nutzer 27.10.). Alle mit Dot und „TRACKED BY · DOT · Health Hub“.
Aufruf: PYTHONPATH=<fonttools>:../wortmarke:. python3 kapsel_ticket.py <ausgabe> <font-ordner> <dot-png>"""
import math
import tracked as tr
f, b, s0 = tr.f, tr.b, tr.s0
GRAU, NAME, BG = "#8e98ad", "#f2f4f8", "#05060a"
TB = "TRACKED BY"

class Bild:
    """Sammelt Teile je Modus (farbe/schwarz/weiss); 'inv' = auf gefüllter Fläche (Farben getauscht)."""
    def __init__(s, w, h): s.w, s.h, s.t = w, h, {"farbe": [], "schwarz": [], "weiss": []}
    def add(s, **m):
        for k, v in m.items(): s.t[k].append(v)
    def text(s, d, rolle="name", inv=False):
        s.add(farbe=f'<path d="{d}" fill="{NAME if rolle == "name" else GRAU}"/>',
              schwarz=f'<path d="{d}" fill="{"#fff" if inv else "#000"}"/>', weiss=f'<path d="{d}" fill="{BG if inv else "#fff"}"/>')
    def kugel(s, cx, cy, r, inv=False):
        s.add(farbe=b.kugel_img(cx, cy, r, s.w, s.h), schwarz=f'<g fill="{"#fff" if inv else "#000"}">{b.kugel_vec(cx, cy, r)}</g>',
              weiss=f'<g fill="{BG if inv else "#fff"}">{b.kugel_vec(cx, cy, r)}</g>')
    def linie(s, d, w=1.0, deck=0.38, cap="round", dash=None, verlauf=False, inv=False):
        da = f' stroke-dasharray="{dash}"' if dash else ""
        if verlauf:
            gid = f"v{len(s.t['farbe'])}"
            fa = (f'<defs><linearGradient id="{gid}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6ee6ff"/>'
                  f'<stop offset="0.6" stop-color="#af87ff"/><stop offset="1" stop-color="#ff78c8" stop-opacity="0.8"/></linearGradient></defs>'
                  f'<path d="{d}" fill="none" stroke="url(#{gid})" stroke-width="{w}" stroke-linecap="{cap}" stroke-opacity="0.85"{da}/>')
        else:
            fa = f'<path d="{d}" fill="none" stroke="#e6ebf5" stroke-width="{w}" stroke-linecap="{cap}" stroke-opacity="{deck}"{da}/>'
        s.add(farbe=fa, schwarz=f'<path d="{d}" fill="none" stroke="{"#fff" if inv else "#000"}" stroke-width="{w}" stroke-linecap="{cap}"{da}/>',
              weiss=f'<path d="{d}" fill="none" stroke="{BG if inv else "#fff"}" stroke-width="{w}" stroke-linecap="{cap}"{da}/>')
    def flaeche(s, d):
        """Gefüllte Form: in Farbe Glas (leicht hell + Haarlinie), einfarbig voll."""
        s.add(farbe=f'<path d="{d}" fill="#ffffff" fill-opacity="0.06" stroke="#e6ebf5" stroke-opacity="0.22" stroke-width="1"/>',
              schwarz=f'<path d="{d}" fill="#000"/>', weiss=f'<path d="{d}" fill="#fff"/>')
    def punkt(s, x, y, r, inv=False):
        s.add(farbe=f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r:.2f}" fill="#bfefff"/>', schwarz=f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r:.2f}" fill="{"#fff" if inv else "#000"}"/>',
              weiss=f'<circle cx="{x:.2f}" cy="{y:.2f}" r="{r:.2f}" fill="{BG if inv else "#fff"}"/>')
    def schreiben(s, name, title):
        for m, parts in s.t.items():
            b.save(f"{name}-{m}.svg", b.svg(s.w, s.h, "".join(parts), title, bg=BG if m == "farbe" else None))

def kapsel_d(x0, y0, x1, y1):
    r = (y1 - y0) / 2
    return f"M{x0 + r} {y0}L{x1 - r} {y0}A{r} {r} 0 0 1 {x1 - r} {y1}L{x0 + r} {y1}A{r} {r} 0 0 1 {x0 + r} {y0}Z"

def block(B, x, y, gross=22, inv=False, health_rechts=True, tb=8.5):
    """TRACKED BY (klein) über DOT (Michroma) + Health Hub (Inter): rechts daneben oder darunter."""
    t1, _ = b.text("mono6", TB, tb, x, y, track=0.42); B.text(t1, "zusatz", inv)
    upm, xh, cap = b.metrics("michroma"); capx = cap * gross / upm
    t2, x2 = b.text("michroma", "DOT", gross, x, y + 8 + capx, track=0.16); B.text(t2, "name", inv)
    if health_rechts: t3, x3 = b.text("id-regular", "Health Hub", gross * 0.58, x2 + gross * 0.5, y + 8 + capx, track=0.0)
    else: t3, x3 = b.text("id-regular", "Health Hub", gross * 0.56, x, y + 8 + capx + gross * 0.9, track=0.0)
    B.text(t3, "zusatz", inv); return max(x2, x3)

T = "Dot: Health Hub – "
# ===================== Kapseln =====================
# K1 · Linie (Basis)
B = Bild(300, 96); B.linie(kapsel_d(6, 6, 294, 90)); B.kugel(48, 48, 32); block(B, 92, 36); B.schreiben("kapsel-1-linie", T + "Kapsel Linie")
# K2 · Gefüllt (Glas; einfarbig als volle Fläche mit ausgesparter Schrift)
B = Bild(300, 96); B.flaeche(kapsel_d(6, 6, 294, 90)); B.kugel(48, 48, 32, inv=True); block(B, 92, 36, inv=True); B.schreiben("kapsel-2-gefuellt", T + "Kapsel gefüllt")
# K3 · Dot bricht aus: Kugel größer als die Kapsel
B = Bild(320, 120)
xk = 58 + math.sqrt(50 ** 2 - 34 ** 2) + 4          # Linie beginnt am Rand der Kugel, läuft nicht durch sie hindurch
B.linie(f"M{xk:.2f} 26L280 26A34 34 0 0 1 280 94L{xk:.2f} 94"); B.kugel(58, 60, 50); block(B, 122, 50, gross=20); B.schreiben("kapsel-3-ausbruch", T + "Kapsel Ausbruch")
# K4 · Kompakt, nur Mono: zwei Zeilen
B = Bild(250, 72); B.linie(kapsel_d(5, 5, 245, 67)); B.kugel(36, 36, 22)
t1, _ = b.text("mono6", TB, 8.5, 68, 31, track=0.42); B.text(t1, "zusatz")
t2, _ = b.text("mono6", "DOT · HEALTH HUB", 11, 68, 49, track=0.28); B.text(t2, "name"); B.schreiben("kapsel-4-kompakt", T + "Kapsel kompakt")
# K5 · Einzeilig, schmal
B = Bild(360, 56); B.linie(kapsel_d(4, 4, 356, 52)); B.kugel(28, 28, 17)
t1, x1 = b.text("mono6", TB, 8.5, 54, 31.5, track=0.42); B.text(t1, "zusatz")
t2, x2 = b.text("michroma", "DOT", 15, x1 + 14, 34, track=0.16); B.text(t2, "name")
t3, _ = b.text("id-regular", "Health Hub", 11.5, x2 + 8, 34, track=0.0); B.text(t3, "zusatz"); B.schreiben("kapsel-5-einzeilig", T + "Kapsel einzeilig")
# K6 · Geteilt: Segmente wie eine Anzeige, Rand im Verlauf
B = Bild(340, 80); B.linie(kapsel_d(5, 5, 335, 75), verlauf=True); B.kugel(42, 40, 26)
B.linie("M82 18L82 62", deck=0.3); t1, x1 = b.text("mono6", "TRACKED", 8.5, 96, 37, track=0.42); B.text(t1, "zusatz"); t1b, _ = b.text("mono6", "BY", 8.5, 96, 50, track=0.42); B.text(t1b, "zusatz")
B.linie(f"M{x1 + 14} 18L{x1 + 14} 62", deck=0.3)
upm, xh, cap = b.metrics("michroma"); capx = cap * 22 / upm
t2, x2 = b.text("michroma", "DOT", 22, x1 + 30, 40 + capx / 2 - 6, track=0.16); B.text(t2, "name")
t3, _ = b.text("id-regular", "Health Hub", 11, x1 + 30, 40 + capx / 2 + 10, track=0.0); B.text(t3, "zusatz"); B.schreiben("kapsel-6-geteilt", T + "Kapsel geteilt")

# ===================== Tickets =====================
def ticket_d(x0, y0, x1, y1, px=None, rn=0, rc=0):
    """Ticket: Rechteck, optional Ecken rc und Kerben rn oben/unten an der Abrisslinie px."""
    d = f"M{x0 + rc} {y0}"
    if px and rn: d += f"H{px - rn}A{rn} {rn} 0 0 0 {px + rn} {y0}"
    d += f"H{x1 - rc}" + (f"A{rc} {rc} 0 0 1 {x1} {y0 + rc}" if rc else "") + f"V{y1 - rc}" + (f"A{rc} {rc} 0 0 1 {x1 - rc} {y1}" if rc else "")
    if px and rn: d += f"H{px + rn}A{rn} {rn} 0 0 0 {px - rn} {y1}"
    d += f"H{x0 + rc}" + (f"A{rc} {rc} 0 0 1 {x0} {y1 - rc}" if rc else "") + f"V{y0 + rc}" + (f"A{rc} {rc} 0 0 1 {x0 + rc} {y0}" if rc else "") + "Z"
    return d
abriss = lambda x, y0, y1: f"M{x} {y0}L{x} {y1}"

# T1 · Linie (Basis)
B = Bild(320, 120); B.linie(ticket_d(10, 10, 310, 110), cap="square"); B.linie(abriss(104, 18, 102), dash="3 5", cap="butt"); B.kugel(57, 60, 34)
block(B, 124, 44, gross=24, health_rechts=False); B.schreiben("ticket-1-linie", T + "Ticket Linie")
# T2 · Kerben an der Abrisslinie
B = Bild(320, 120); B.linie(ticket_d(10, 10, 310, 110, px=104, rn=9), cap="square"); B.linie(abriss(104, 24, 96), dash="3 5", cap="butt"); B.kugel(57, 60, 34)
block(B, 124, 44, gross=24, health_rechts=False); B.schreiben("ticket-2-kerben", T + "Ticket Kerben")
# T3 · Hochformat: Dot oben, Text unten
B = Bild(170, 270)
d = f"M18 10H152A8 8 0 0 1 160 18V160A10 10 0 0 0 160 180V252A8 8 0 0 1 152 260H18A8 8 0 0 1 10 252V180A10 10 0 0 0 10 160V18A8 8 0 0 1 18 10Z"
B.linie(d); B.linie("M24 170L146 170", dash="3 5", cap="butt"); B.kugel(85, 86, 52)
t1, w1 = tr.zentriert("mono6", TB, 8.5, 85, 200, 0.42); B.text(t1, "zusatz")
t2, _ = tr.zentriert("michroma", "DOT", 24, 85, 228, 0.16); B.text(t2, "name")
t3, _ = tr.zentriert("id-regular", "Health Hub", 12.5, 85, 246, 0.0); B.text(t3, "zusatz"); B.schreiben("ticket-3-hochformat", T + "Ticket hoch")
# T4 · Boarding Pass: Felder für Nummer und Datum (Platzhalter, später je Erfolg gefüllt)
B = Bild(380, 130); B.linie(ticket_d(8, 8, 372, 122, px=270, rn=9, rc=10)); B.linie(abriss(270, 24, 106), dash="3 5", cap="butt"); B.kugel(56, 65, 34)
block(B, 108, 48, gross=22, health_rechts=False)
for i, (lab, val) in enumerate((("NO.", "0001"), ("DATE", "27.10.26"))):
    y = 44 + i * 40
    t, _ = b.text("mono", lab, 7.5, 288, y, track=0.4); B.text(t, "zusatz")
    t, _ = b.text("mono6", val, 12, 288, y + 17, track=0.12); B.text(t, "name")
B.schreiben("ticket-4-boarding", T + "Ticket Boarding Pass")
# T5 · Gefüllt mit Kerben: Glas, einfarbig volle Fläche
B = Bild(320, 120); B.flaeche(ticket_d(10, 10, 310, 110, px=104, rn=9, rc=12)); B.linie(abriss(104, 24, 96), dash="3 5", cap="butt", inv=True, deck=0.3)
B.kugel(57, 60, 34, inv=True); block(B, 124, 44, gross=24, health_rechts=False, inv=True); B.schreiben("ticket-5-gefuellt", T + "Ticket gefüllt")
# T6 · Punktcode: Abschnitt rechts mit einem Code aus Punkten
B = Bild(360, 120); B.linie(ticket_d(10, 10, 350, 110, rc=10), verlauf=True); B.linie(abriss(268, 18, 102), dash="3 5", cap="butt"); B.kugel(57, 60, 34)
block(B, 112, 44, gross=24, health_rechts=False)
for j in range(9):
    for i in range(5):
        v = (math.sin(i * 12.9898 + j * 78.233) * 43758.5453) % 1
        if v > 0.32: B.punkt(286 + i * 11, 22 + j * 9.6, 1.2 + 2.2 * v)
B.schreiben("ticket-6-punktcode", T + "Ticket Punktcode")
