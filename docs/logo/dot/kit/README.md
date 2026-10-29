# Dot – App-Icon-Kit (26.10.2026, Fassung 2: „Dot, wie er ist“)

Nutzer: „Das Logo soll ihn nachahmen.“ Das Icon ist deshalb kein gezeichnetes Zeichen
mehr, sondern Dot selbst, gerendert mit demselben Zeichenweg wie
`src/features/dot/engine/dotEngine.ts`. Fassung 1 (gezeichnete Kugel mit 71 + 79 Punkten)
liegt in der Git-Geschichte (Commit 68eef72).

## Wie es entsteht
- `docs/logo/dot/echt/dot-icon.html` – Renderer: 460 Punkte als Fibonacci-Kugel, Neigung
  0,38, Drehung 0,6, Tiefe z = 0,1 + 0,85·f², Punktgröße 0,034·r·(0,55 + 0,6·z)·3,
  Farbe Cyan → Violett diagonal mit Pink unten (Farbton 0,45), WebGL-Punkte mit dem
  Shader der Engine (Kern bis 0,42, Abfall bis 0,62, Saum bis 1,0), additiv; Schein
  rgba(70,170,255) / rgba(150,110,255) von 0,2·r bis 2·r; Rand atmet leicht (3 Wellen,
  Stärke 0,02 wie „Gelee“). Gerendert auf 2048, dann schrittweise verkleinert.
- `docs/logo/dot/echt/export.cjs` – schreibt alle Dateien (`node docs/logo/dot/echt/export.cjs $PWD`).
- Werte: Zustand „Sprechen“ (Helligkeit 1,0, Schein 0,65) statt „Ruhe“ (0,85 / 0,4),
  weil er auf dem Home-Bildschirm sonst zu blass ist. Kugeldurchmesser 66 % der Kachel.
- Abgleich mit dem echten Dot auf der Chat-Bühne des Mockups: gleiche Punktanordnung,
  Größen, Farben und Weichheit.

## Dateien
| Datei | Zweck |
|---|---|
| `dot-icon-1024.png` | App-Store-Icon, deckend |
| `ebenen/hintergrund.png`, `schein.png`, `punkte.png` | Ebenen für Icon Composer (iOS 26) |
| `favicon-64.png`, `favicon-32.png` | Kleinfassung: Kugel größer und heller, sonst zerfällt sie unter 32 px |
| `dot-marke.svg` | einfarbige Vektor-Fassung (Vorderseite, 315 Punkte) für Druck, Prägung, Einfarbig |
| `varianten/` | Marke schwarz, weiß, Cyan `#6ee6ff` (aus `export_variants.py` des Skills) |
| `eingebaut.png` | Übersicht aller eingebauten Dateien |

## Eingebaut
- iOS `AppIcon-512@2x.png` (1024, deckend).
- Android `mipmap-*`: `ic_launcher` (abgerundet), `ic_launcher_round`, `ic_launcher_foreground`
  (108 dp, Kugel in der sicheren Zone), Hintergrund `#05060a`.
- Web: `icon-192.png`, `icon-512.png`; `icon.svg` und `favicon.svg` betten das Raster ein
  (additive Leuchtpunkte gibt es in SVG nicht). `scripts/gen-icons.cjs` wird nicht mehr gebraucht.

## Geprüft (Testblatt des Skills `logo-design`)
- Marke: hält Schwarz, Weiß, Markenfarbe, Foto, Muster, Spiegeln, 180°, Unschärfe.
- Farb-Icon: ab 40 px als Dots Kugel lesbar; bei 16–24 px nur noch leuchtender Ball → Kleinfassung.
- `svg_audit`: Marke 92/100, einzige Warnung: 630 Ankerpunkte. Das ist Dot (460 Punkte) und bewusst so.

## Farben
| | RGB | HEX |
|---|---|---|
| Cyan | 110 230 255 | `#6ee6ff` |
| Violett | 175 135 255 | `#af87ff` |
| Pink | 255 120 200 | `#ff78c8` |
| Kachel | 5 6 10 → 20 28 51 (radial) | `#05060a` → `#141c33` |

## Offen
- iOS 26: Ebenen in Icon Composer zu einem `.icon` zusammensetzen; bis dahin gilt das flache 1024er.
- Gerätetest: Home-Bildschirm hell/dunkel, getönte Icons (iOS 18+), Spotlight.
