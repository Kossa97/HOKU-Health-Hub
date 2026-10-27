# Schriftzug „Dot: Health Hub“ – Konzepte (Runde 1, 26.10.2026)

Mit dem Skill `logo-design` (Schriftstudie, drei Konzepte, Prüfung, Konzeptblatt), Typografie nach
`references/typography.md` und `apple-design` §15 (große Schrift enger laufen lassen, Hierarchie über Gewicht und Größe).

- **Name und Zusatz:** Marke ist „Dot“, „Health Hub“ ist der Zusatz. „Dot: Health Hub“ mit Doppelpunkt
  ist die Schreibweise für den Store-Titel, nicht für das Logo.
- **Schriften:** Inter Display (SIL OFL) und Space Grotesk (SIL OFL, Überschriftenschrift der App), beide als
  Pfade umgewandelt, im Logo braucht man die Schrift also nicht mehr.
- **Dot:** schwarz als Vektor (Punkte aus `kit/dot-marke.svg`), in Farbe als Raster aus dem Renderer
  (`dot-hell-1024.png`, Helligkeit 1,3 und Schein 1,0, damit er neben weißer Schrift nicht verblasst).

| Datei | Konzept |
|---|---|
| `a-schlusspunkt` | „dot“ (Inter Display SemiBold) mit Dot als Schlusspunkt |
| `b-o-ist-dot` | „D●t“ in Space Grotesk 500, Dot ersetzt das o |
| `c-lockup` | Dot links, „Dot“ (Inter Display Medium) und „Health Hub“ (Regular) rechts – Empfehlung |

Jeweils `.svg` schwarz und `-farbe.svg` auf `#05060a`. `konzepte.png` (grau, mit 64/32/16 px) und `farbe.png`.
Neu erzeugen: `PYTHONPATH=<fonttools> python3 bauen.py . <ordner mit SpaceGrotesk-500.ttf> dot-hell-1024.png`.

Prüfung (`svg_audit`): alle drei 82–83/100; Warnungen nur für die vielen kleinen Punkte der Kugel (gehört zu Dot).
Unter 32 px trägt die Kugel keine Punkte mehr → dort nur das App-Icon verwenden, nicht den Schriftzug.

## Varianten zu C (Runde 2, Nutzer wählte C)

`varianten.py` baut sieben Fassungen, je schwarz und `-farbe`; Übersicht `varianten-farbe.png`, `varianten-schwarz.png`.

| Datei | Unterschied |
|---|---|
| `c1-basis` | Inter Display Medium / Regular, Kugel über beide Zeilen |
| `c2-kraeftig` | „Dot“ SemiBold, Zusatz in Versalien mit Sperrung |
| `c3-leicht` | „Dot“ Light, eleganter, bei kleinen Größen schwächer |
| `c4-zeile` | alles in einer Zeile, für breite Banner und Kopfzeilen |
| `c5-kompakt` | Kugel nur so hoch wie der Name, Zusatz darunter |
| `c6-gestapelt` | Kugel oben, Text zentriert darunter, für quadratische Formate |
| `c7-app-schrift` | „Dot“ in Space Grotesk, der Überschriftenschrift der App |
