# Erscheinungsbild (Looks)

Vier Looks, gewählt im Profil, gespeichert als `tyd_look` (`src/lib/look.ts`),
Werte in `src/styles/liquid-glass.css` unter `html[data-look='…']`.

- **Schwarz** (Standard): reines Schwarz, helle Taschenlampen-Kante.
- **Satin**: dicke, matte Kante mit wanderndem Reflex.
- **Licht**: farbiges Umgebungslicht, Karten ohne Kante.
- **Nacht** (22.10.2026): Umgebungslicht bei 55 %, leise getönte Kante,
  Prismasaum (cyan oben, magenta unten), Korn auf dem Grund.

## Warum Nacht

Auf reinem Schwarz hat der Weichzeichner nichts zu brechen, übrig bleibt nur
die helle Kante — das liest sich als Hochglanz/Lack, nicht als Glas. Nacht
legt gedämpftes Licht dahinter, damit das Glas wieder etwas zeigt.
Mockup (Schwarz/Licht/Nacht nebeneinander):
https://claude.ai/artifact/GESYSbSrfeoXxYuE8BZpa6

## Offen

- **Datenlicht** (eigener Schritt, vom Nutzer so gewünscht): Licht folgt dem
  Blutspiegel, Lichtimpuls beim Eintragen einer Dosis. Technik dafür steht in
  `src/components/ambient/` (Claims für Farbe und Helligkeit je Licht).
- Entscheiden, ob Nacht Schwarz als Standard ablöst.
