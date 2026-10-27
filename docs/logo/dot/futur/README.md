# Dot – futuristische Richtung (Runde 3, 27.10.2026)

Name (Nutzer 27.10.): **„Dot: Health Hub“** – vorher versehentlich „Health Tracker“, alles neu gebaut.
Nutzer: Varianten zu C „zu wenig sci-fi/futuristisch“; dazu ein Stempel/Wasserzeichen für geteilte Erfolge,
Beiträge und PDFs. Schriftstudie mit 14 offenen Schriften (alle SIL OFL); gewählt: **Michroma** (breit, ruhig),
**Syncopate Bold** (breit, kräftig), **IBM Plex Mono** in Versalien für den Zusatz (feste Sperrung 0,5 em; die Größe passt sich an, bis der Zusatz so breit wie „DOT“ ist, begrenzt) (die App nutzt Plex Mono
schon). Orbitron und Audiowide verworfen (Klischee). Alle Schriften als Pfade, Dot schwarz/weiß als Vektor,
in Farbe aus dem Renderer.

Jede Datei dreifach: `-schwarz` (PDF, heller Grund), `-weiss` (Foto, dunkler Grund), `-farbe` (auf `#05060a`).
Neu erzeugen: `PYTHONPATH=<fonttools>:../wortmarke python3 futur.py . <font-ordner> ../wortmarke/dot-hell-1024.png`.

| Datei | Was |
|---|---|
| `f1-weit` | Dot + „DOT“ in Michroma, Zusatz Plex Mono gesperrt |
| `f2-punktschrift` | D und T aus Punkten (Syncopate gerastert), das O ist Dot |
| `f3-umlaufbahn` | Dot im Ring mit Skala und einem kreisenden Punkt, „DOT“ in Syncopate |
| `s1-siegel` | rundes Siegel: Kreisschrift, Skala, Dot – für Zertifikate, besondere Erfolge |
| `s2-kennung` | kleine Zeile Dot · DOT · HEALTH HUB – für Ecken, Fußzeilen, PDFs |
| `s3-erfolg` | „TRACKED WITH DOT“ – für geteilte Erfolge und Beiträge |

`uebersicht.png` zeigt alles auf Dunkel, auf einem Foto und im PDF.

## Favorit und Siegel-Varianten (27.10.2026)

- **S2 · Kennung ist der Favorit des Nutzers** (Stempel/Wasserzeichen).
- „Nur aus Neugier“: sechs abgespacete Siegel zu S1, `siegel.py`, Übersicht `siegel-uebersicht.png`
  (Farbe, schwarz, weiß auf Foto): `siegel-1-mission` (Raumfahrt-Patch, EST · 2026), `siegel-2-radar`
  (Fadenkreuz, Gradzahlen, Suchstrahl), `siegel-3-orbits` (drei Bahnen, hinter Dot ausgeblendet),
  `siegel-4-galaxie` (Teilchenring), `siegel-5-hud` (Sechseck mit Eckwinkeln, N° 0001 – Platz für eine
  laufende Nummer je Erfolg), `siegel-6-fortschritt` (segmentierter Ring wie eine Ladeanzeige).

## Siegel, reduziert (27.10.2026, Nutzer: „ästhetischer, cleaner, simpler“)

`siegel_clean.py`, Übersicht `siegel-clean-uebersicht.png`. Eine Idee je Siegel, eine Linienstärke (1 px auf 256),
mehr Luft um Dot; in Farbe sind die Linien leises Weiß (38 %), nur Dot und ein Akzentpunkt leuchten.
Mission (Ring, Text oben und unten), Radar (Ring, vier Marken, leiser Suchstrahl), Orbit (eine Bahn, ein Satellit),
Staubring (feiner Teilchenring), Rahmen (vier Eckwinkel, Kennung darunter), Fortschritt (ein Bogen mit Endpunkt).

## Siegel „TRACKED BY · DOT · Health Hub“ (27.10.2026)

Nutzer: „TRACKED BY“ und „DOT · Health Hub“ sollen dabei sein, Dot immer sichtbar, vielfältige Möglichkeiten.
`tracked.py`, Übersicht `tracked-uebersicht.png` (Farbe, schwarz, weiß auf Foto). Klarer Stil aus `siegel_clean.py`.

| Datei | Form |
|---|---|
| `tracked-1-klassisch` | Ring, oben TRACKED BY, unten DOT · HEALTH HUB |
| `tracked-2-stempel` | Doppelring, Kreisschrift zweimal rundum (Gummistempel) |
| `tracked-3-medaille` | Ring, Dot oben, darunter TRACKED BY / DOT (Michroma) / Health Hub (Inter) |
| `tracked-4-fortschritt` | Bogen mit Endpunkt, Text oben und unten |
| `tracked-5-orbit` | eine Bahn mit Satellit, Text oben und unten |
| `tracked-6-sucher` | Eckwinkel, Dot oben, Namensblock darunter |
| `tracked-7-kapsel` | waagerechte Kapsel, Dot links – für Beiträge und Bildecken |
| `tracked-8-ticket` | Rahmen mit Abrisslinie, Dot links, Namensblock rechts |
| `tracked-9-staubring` | Teilchenring, Text oben und unten |
