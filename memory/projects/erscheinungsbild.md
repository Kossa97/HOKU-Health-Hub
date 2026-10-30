# Erscheinungsbild (Looks)

Sechs Looks, gewählt im Profil, gespeichert als `tyd_look` (`src/lib/look.ts`),
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
- **Soft Dark** (29.10.2026, Nutzer gab eine Wetter-App als Referenz vor):
  weiches Anthrazit (#1f2023, oben heller), jede Fläche leicht erhaben
  (Verlauf #303136 → #27282c, Lichtsaum oben, weicher Schatten) — ausdrücklich
  **nicht eingelassen** (Nutzer). Blau (#4ea8ff, Hauptknopf als Verlauf mit
  Schein) ist die Farbe der Bedienung, Cyan bleibt den Daten. Leiste: erhabene
  Kapsel, aktiver Reiter blau mit leichtem Leuchten. Gedrückt: Schatten flacher,
  Karten 0,985. Sterne im Hintergrund lehnte der Nutzer ab (beißen sich mit
  Dots Partikeln). Mockup aller Screens: https://claude.ai/artifact/MehxjrTT48ZnjZHVzC372K
  (Seite „Soft Dark"); dort auch Dot in der Mitte der Leiste — in der App bisher
  nur CSS, die Leiste behält ihren Aufbau.
  **Nachgeschärft (30.10.2026, Nutzer: „noch etwas dunkler wie im Foto“, Kanten
  „sehr dünn, weich und dezent“; dann „die selben Farbtöne wie im Screenshot“):
  dann „mit einer Pipette“): Werte per Pipette (Median kleiner Flächen) aus dem
  Referenzfoto — Grund #17181c (oben #232429), Flächen #21252a → #20242a →
  #1e2026, Knöpfe #23272d → #1f2228, Kante kaum sichtbar (oben weiß 6 %, sonst
  2–3 %), kein innerer Lichtsaum. Blau 1:1 aus dem Foto: #4ebbfe → #3c8bf0 →
  #347cef (weiße Schrift darauf nur ~3,4:1 — vom Nutzer so gewollt).

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

## App-Icon (26.10.2026)

Nutzer: Icon soll Dot sein; aus drei Konzepten (Kugel, Punkt, Bahn) **A · Kugel**
gewählt („A ist schon am besten"). Kugel aus 71 Punkten vorn + 79 gedämpften hinten (Größen stark gestreut, Leuchtpunkte wie im Shader; Nutzer 26.10.: „mehr Ungleichmäßigkeit, bessere Qualität"; eine Kontrast-Fassung mit fast schwarzem Grund und abgedunkelten Randpunkten lehnte der Nutzer ab: „Das davor war doch besser" – Stand 68eef72 gilt),
Dots Farben (Cyan → Violett, Pink unten), dunkle Kachel `#05060a` → `#141c33`.
Quelle `docs/logo/dot/kit.py`, Kit und Regeln in `docs/logo/dot/kit/README.md`.
Eingebaut: iOS `AppIcon-512@2x.png`, Android `mipmap-*` + Hintergrundfarbe, Web
`public/icon.svg`, `favicon.svg`, `icon-192/512.png`. Die alten Icons (iOS blaues
Kreuz auf Weiß, Web Durchstechflasche) sind damit abgelöst.
Offen: iOS-26-Ebenen in Icon Composer (`kit/ebenen/`), Gerätetest, getönte Icons.
`scripts/gen-icons.cjs` braucht `@resvg/resvg-js` (nicht installiert) — PNGs kamen
aus Playwright.

**Fassung 2 (26.10.2026, Nutzer: „Das Logo soll ihn nachahmen“):** Icon ist Dot selbst,
gerendert mit dem Zeichenweg der Engine (`docs/logo/dot/echt/dot-icon.html`, Export
`export.cjs`): 460 Punkte, Shader, Farben und Schein wie in `dotEngine.ts`, Zustand
„Sprechen“ für mehr Präsenz. Ersetzt die gezeichnete Kugel (Fassung 1, Commit 68eef72).
Favicon als Kleinfassung (Kugel größer und heller). Kit: `docs/logo/dot/kit/README.md`.

## Name, Schriftzug und Stempel (26./27.10.2026)

- **Name der App: „Dot: Health Hub“** (Nutzer 27.10.; „Health Tracker“ war ein Versehen). Marke ist „Dot“,
  „Health Hub“ der Zusatz; der Doppelpunkt gehört nur in den Store-Titel.
- Schriftzug: erst ruhig (Inter Display, `docs/logo/dot/wortmarke`), Nutzer wollte es futuristischer →
  `docs/logo/dot/futur`: F1 Weit (Michroma), F2 Punktschrift, F3 Umlaufbahn; Zusatz IBM Plex Mono in Versalien.
  Stempel für geteilte Erfolge, Beiträge, PDFs: S1 Siegel, S2 Kennung, S3 „TRACKED WITH DOT“ – je schwarz, weiß, farbig.
  Nutzer findet alle gut. **Favorit Stempel: S2 Kennung** (27.10.). Dazu sechs Siegel-Varianten
  „aus Neugier“ (`futur/siegel.py`). Hauptschriftzug noch offen (Vorschlag F1).

**Fassung 3 (29.10.2026): App-Icon ist das Dot-Bild von Codex** (Nutzer: „perfekt, ändere alle Logos der App“).
Quelle und Export in `docs/logo/dot/codex/`; ersetzt iOS, Android, Web/PWA, Favicon und Benachrichtigungs-Icon.
Web-Dateien heißen `icons/dot-codex-*`. Tab-Leisten-Logo (`DotLogo.tsx`) unverändert.

**Fassung 4 (30.10.2026): HOKU-Brand-Kit v1** (`docs/logo/hoku/brand-kit-v1`, Maskottchen heißt dort Hoku).
App-Icon = blaue Fassung aus dem Kit überall (iOS, Android, Web, Favicon aus dem Kit, Benachrichtigungen),
dazu neue Startbildschirme (vorher Capacitor-Standardkreuz). Einbau: `docs/logo/hoku/EINBAU.md`.
Name der App noch nicht auf HOKU umgestellt.

**Name (30.10.2026, Nutzer):** App heißt **„HOKU: Health Hub“** (Startbildschirm/Kurzname „HOKU“), der Assistent
heißt **Hoku** statt Dot. Umgestellt in allen sichtbaren de/en-Texten, Rechtstexten, PDFs (Dateinamen `HOKU-…`),
iOS/Android-Namen und Berechtigungstexten, Manifest, Capacitor `appName`, Coach-Prompt. Unverändert: App-ID
`com.kossa97.tyd`, Speicherschlüssel `tyd_*`, Code-Bezeichner (`features/dot`, `Dot…`), die zwölf weiteren Sprachen
(CLAUDE.md), User-Agent der Lebensmittel-Suche.
