# HOKU – Logo A „Hoku, echt" (Hoku mit Pupille)

Stand 02.11.2026. Hoku als Kugel aus Partikeln mit seinem Auge: Die Pupille wirkt als
Irisblende, die Partikel weichen an ihren Rand und bilden dort einen hellen Ring. Gezeichnet
mit derselben Augen-Rechnung wie in der App (`src/features/dot/engine/auge.ts`), für das Logo
mit 1400 statt 460 Partikeln, gestreuten Größen und leicht gelockertem Raster.

## Ordner

| Ordner | Inhalt | Wofür |
|---|---|---|
| `SVG/` | farbig, weiß, schwarz | Vektor: beliebig groß, für Druck und Layout. Jeder Partikel ist ein Kreis, ohne Leuchtrand. |
| `PNG-transparent/farbig/` | 512 bis 8192 px | auf dunklem Grund (die Farben leuchten, auf Weiß wirken sie blass) |
| `PNG-transparent/weiss/` | 512 bis 8192 px | auf dunklen Flächen, Fotos, Videos |
| `PNG-transparent/schwarz/` | 512 bis 8192 px | auf hellen Flächen |
| `App-Icon/` | 1024 und 8192 px | quadratisch mit dunkler Kachel und Schein, wie das bisherige Icon |
| `Vorschau.png` | Übersicht aller Fassungen | |

PNG: Partikel mit weichem Leuchtrand wie in der App. SVG: dieselben Partikel als klare Kreise,
Tiefe über Deckkraft.

## Neu erzeugen

```
node docs/logo/hoku/auge/export-a.cjs docs/logo/hoku/A-hoku-echt
```
(Chromium mit WebGL, `PW_CHROMIUM` auf den Browser setzen.) Einstellungen stehen oben in
`export-a.cjs` (Blick, Partikelzahl, Streuung). Die 8192-px-Dateien sind wegen ihrer Größe
nicht im Repository, sie lassen sich so jederzeit neu erzeugen.
