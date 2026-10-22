# Erscheinungsbild (Looks)

Vier Looks, gewählt im Profil, gespeichert als `tyd_look` (`src/lib/look.ts`),
Werte in `src/styles/liquid-glass.css` unter `html[data-look='…']`.

- **Schwarz** (Standard): reines Schwarz, helle Taschenlampen-Kante.
- **Satin**: dicke, matte Kante mit wanderndem Reflex.
- **Licht**: farbiges Umgebungslicht, Karten ohne Kante.
- **Nacht** (22.10.2026): Umgebungslicht bei 55 %, leise getönte Kante,
  Prismasaum (cyan oben, magenta unten), Korn auf dem Grund.
- **Instrument** (22.10.2026, mein Vorschlag nach drei Clean-Dark-Richtungen):
  wie ein Messgerät — reines Schwarz, feste Flächen #0b0c0e mit Haarlinie,
  kein Glas/Glanz/Glow, weißer Hauptknopf, Cyan nur für Daten („jetzt").
  Mockup: https://claude.ai/artifact/QWVFNb3XebtLZUf72NoPZK

Injektionstracker (22.10.2026): bei Nacht Kantenlichter der Figur links
cyan, rechts violett (Hauptlicht und Haut wie „Studio“), Bühne als
`--inj-backdrop` mit kühlem Schein, Grün/Violett und Korn. Blätter
(`.lg-sheet`) bekommen app-weit die getönte Kante. Kantenlicht vom Nutzer
bewusst dezent gelassen.

## Warum Nacht

Auf reinem Schwarz hat der Weichzeichner nichts zu brechen, übrig bleibt nur
die helle Kante — das liest sich als Hochglanz/Lack, nicht als Glas. Nacht
legt gedämpftes Licht dahinter, damit das Glas wieder etwas zeigt.
Mockup (Schwarz/Licht/Nacht nebeneinander):
https://claude.ai/artifact/GESYSbSrfeoXxYuE8BZpa6

## Offen

- Instrument ist bisher nur der CSS-Teil. Noch nicht umgesetzt: leichtere
  Überschriften überall (viele Titel nutzen eigene Klassen), große dünne
  Zahlen, Skalen (Tagesskala, Zielbereich, Referenzskala bei Blutwerten).

- **Datenlicht** (eigener Schritt, vom Nutzer so gewünscht): Licht folgt dem
  Blutspiegel, Lichtimpuls beim Eintragen einer Dosis. Technik dafür steht in
  `src/components/ambient/` (Claims für Farbe und Helligkeit je Licht).
- Entscheiden, ob Nacht Schwarz als Standard ablöst.
