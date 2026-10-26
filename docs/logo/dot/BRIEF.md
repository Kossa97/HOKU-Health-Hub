# App-Icon mit Dot – Brief (Runde 1, 26.10.2026)

Erstellt mit dem Skill `logo-design` (`.claude/skills/logo-design`), Schnellverfahren:
keine Rückfragen, Annahmen stehen hier.

## Auftrag
App-Store-Icon für **TYD – Track Your Dose** (iOS/Android, Capacitor). Wunsch des
Nutzers: das Icon soll **Dot**, der KI-Assistent der App, sein.

## Was Dot ist (aus `memory/projects/ki-coach.md` und `src/features/dot/`)
- Kugel aus ~460 leuchtenden Punkten, 56 px Durchmesser, ohne Augen (bewusst verworfen).
- Farben: Cyan `rgb(110,230,255)` → Violett `rgb(175,135,255)` diagonal, unten Pink
  `rgb(255,120,200)`; Schein cyan/violett; additiv auf dunklem Grund.
- Weicher Körper („Gelee“), klebt an Kanten, zerfließt flach, löst sich in Punkte auf
  (Kamera, Hineingehen), bildet Ringe (Denken), Welle (Sprechen), Haken (Freude).
- Logo in der Tab-Leiste: dieselbe Punktkugel als SVG mit 46 Punkten (`DotLogo.tsx`).

## Annahmen
- Name der App bleibt „TYD – Track Your Dose“; „Dot“ ist der Assistent, nicht der
  App-Name (Markenfrage „Dot“ offen, siehe ki-coach.md).
- Zielgruppe: Menschen, die Peptide/Substanzen protokollieren; Adjektive aus der
  App: präzise, ruhig, dunkel, hochwertig, lebendig (Dot).
- Muss funktionieren: 1024 px ohne Transparenz (App Store), 60/40/29 pt auf dem
  Gerät, iOS-26-Icon mit Ebenen (Icon Composer), Android adaptive icon, Favicon.
- Bisherige Icons: iOS `AppIcon-512@2x.png` (blaues Kreuz/X auf Weiß), Web
  `public/icon.svg` (Durchstechflasche mit cyanfarbener Flüssigkeit). Beide weichen
  voneinander ab; das neue Icon löst beide ab.

## Klischees der Kategorie (gemieden oder bewusst gebrochen)
- Gesundheits-Apps: Herz, Kreuz, Pille, Kapsel, Spritze, Tropfen, Grün/Blau-Verläufe.
- KI-Assistenten: Funkeln (✦), Partikelkugel, Siri-Wellen, Regenbogenverlauf.
  Dot **ist** eine Partikelkugel – darum ist Konzept A ehrlich, aber das am
  wenigsten eigene; B und C nehmen nur Dots Natur (Punkt + lose Punkte) und
  bauen eine eigene, einfache Form daraus.

## Konzepte (schwarz zuerst, dann Farbfassung als Icon)
- **A – Kugel:** Dot wörtlich, Kugel aus Punkten. Kleine Fassung mit 26 Punkten.
- **B – Punkt (Empfehlung):** ein Punkt, von dem sich oben rechts Punkte lösen.
- **C – Bahn:** ein Punkt mit Schweif, gerade angeflogen.

Dateien: `*.svg` (Marke schwarz, 256er Raster), `*-icon.svg` (Farbfassung 1024),
`*-icon-1024.png` (Export), `konzepte.png` (Übersicht grau), `gen.py` erzeugt alles.
