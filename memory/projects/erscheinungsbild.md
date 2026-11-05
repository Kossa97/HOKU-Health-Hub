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

## Grundlage für vollständige Looks (03.11.2026)

Nutzer will alle Mockup-Looks (Frost, Labor-HUD, Neon, Tiefsee, Obsidian, Papier)
in der App, jeweils **vollständig**. Mockup: https://claude.ai/artifact/XCK2vkXnMq4Ryp1RnEnRDT

- **Farbkanäle** in `src/index.css` (`:root`): `--ink-rgb` (Schrift, Linien, helle
  Schleier), `--ground-rgb` (Grund), `--slate-50 … --slate-950` (Graphit-Stufen),
  Leerzeichen-getrennt für `rgb(var(--x) / Deckkraft)`.
- **Tailwind** liest `white`, `black` und `slate-*` aus diesen Kanälen
  (`tailwind.config.js`). Ein heller Look dreht sie um, ohne eine Klasse anzufassen.
- **Stildateien**: alle `rgba(255,255,255,x)` sind `rgb(var(--ink-rgb) / x)`
  (148 Stellen; nicht in `url(data:…)`). Für die dunklen Looks pixelgleich
  (Vorher/Nachher-Bilder, Abweichungen nur wie zwischen zwei Läufen).
- **Prüfung**: `npm run looks:audit` (e2e/look-audit.spec.ts, nur mit LOOK_AUDIT=1):
  zehn Hauptseiten je Look als Bild nach `test-results/look-audit/<look>/` und
  `bericht.json` mit Schrift unter 3:1 Kontrast. Looks wählbar über
  `LOOK_AUDIT_LOOKS=papier,neon`.
- **Papier** (hell, Schwarz-Weiß, Vorschau): erster Look, der alle Rollen umstellt.
  Im Profil nur für Admins/Entwicklung. Hoku wird per `filter: invert(1)` auf
  `.tyd-dot-flaeche` schwarz.
- **Neuer Look** = ein Block `html[data-look='…']` mit den Rollen (Vorlage: Papier)
  + Eintrag in `LOOKS`, `STANDARD_JE_LOOK` (hokuFarbe.ts), Profil-Umschalter,
  `look_*`-Text; dann `npm run looks:audit`.

Papier nachgezogen (03.11.2026): Prüfung meldet 0 Stellen. Gelöst: My-Stack-Reiter
(Schrift in `--ground-rgb`), Fortschritt-Ringe (Farben aus `--lg-good/-warn/-bad/-text-3`),
Neu-Kachel (`--glass-bg`), Kopfband Fortschritt (`--ground-rgb`), helle Tailwind-
Schriftstufen `text-<farbe>-100…400` → Stufe 700, Ernährungs-Kugeln (`.tyd-orb`:
`invert(1) hue-rotate(180deg)`), Hoku-Logo-Schein, Hauptknopf als Symbol.

Offen (nächste Schritte, je Bereich):
- Papier: Injektions-Bühne/3D-Licht (zu hell?), Diagramme mit festen Farben
  (Canvas, SVG-Attribute), Verläufe/Schleier auf Schwarz (`rgba(0,0,0,…)` in
  Stildateien, nur wo es kein Schatten ist), Sheets/Menüs mit eigenen Farben.
- Feste Farben in tsx: ~1100 (meist SVG-Attribute in den Produktbildern, die bleiben),
  `#000`/`#fff` in Stildateien.
- Hoku-Licht als gemeinsamer Baustein (flashlight.ts + Position aus dotEngine).
- Danach die Mockup-Looks als echte Looks.

## Hoku-Licht und Look „Frost“ (03.11.2026)

- **Hoku-Licht** `src/lib/hokuLicht.ts`: Quelle ist `api.lage()` der Dot-Engine
  (gesetzt in DotLayer, `null` bei Modus `away`). Für sichtbare Flächen und Knöpfe
  (`.lg-surface, .card, .lg-group, .lg-btn, .lg-icon-btn, .lg-chip, .tyd-tabbar,
  .tyd-tabdock-action`) schreibt es `--hl-a` (Richtung), `--hl-w` (Breite),
  `--hl-i` (Helligkeit, quadratisch, Reichweite 230 px), `--hl-x/--hl-y`.
  Läuft nur, wenn der Look `--hoku-licht: 1` setzt; erst messen, dann schreiben;
  unveränderte Werte nicht neu schreiben.
- **Frost** (öffentlich wählbar): dunkles Cyan, Korn, Karten ohne Weichzeichner,
  Kante als konischer Verlauf aus den `--hl-*`-Werten, Knöpfe glimmen mit `--hl-i`.
  Hoku-Farbe „heute“ (Cyan → Violett → Pink).
- Prüfung: Schrift über Verläufen wird nicht mehr gewertet (Fehlalarme am
  Hauptknopf). Stand: Schwarz, Soft Dark, Frost, Papier je 0 Stellen.
- Nächste Looks aus dem Mockup: Labor-HUD, Neon, Tiefsee, Obsidian.

## Labor, Neon, Tiefsee, Obsidian (03.11.2026)

Alle vier aus dem Mockup als echte Looks, alle mit Hoku-Licht, im Profil wählbar.
Prüfung: je 0 Stellen. **Wichtig für neue Looks:** `var(--hl-*)` nie in einem
Token an der Wurzel (`--lg-card-rim: conic(... var(--hl-a))`) — der Browser löst
Variablen dort auf, wo das Token steht (am `<html>`, dort ist --hl-i = 0). Die
Licht-Formel gehört in eine Regel am Element (`:is(.lg-surface,…)::before`).
Frost war davon betroffen und ist korrigiert; im Browser nachgemessen
(`getComputedStyle(el,'::before')` zeigt den Winkel der Karte).

## Glaslinse der Tab-Leiste (Branch claude/glas-linse, Test)

- Nur transform/opacity: am Finger Feder je Bild (rAF), allein gleitend wird der Weg
  vorab gerechnet und als Web Animation übergeben (läuft weiter, während die neue
  Seite aufgebaut wird — vorher hakte es dort). Logik in `linsenFeder.ts`.
- In der Linse liegt ein Abbild der Leiste (Aussehen per getComputedStyle übernommen)
  samt Hokus Tor (`.tyd-tabbar-linse-tor`, die Engine bewegt es mit dem echten).
  Das echte Tor liegt jetzt IN der Leiste unter der Linse (`unterLinse`).
- Klicks: nur der Platz, auf dem der Finger aufsetzte, öffnet (iPhone öffnete
  unterwegs andere Seiten).
- Regler im Profil (LinsenTest, vor Übernahme entfernen) mit Preset „Apple" nach
  einer Bildschirmaufnahme aus iOS 26: klar, graue breite Ruhekapsel, Regenbogen
  an den Enden. Randbrechung (Regler): zwei maskierte Ringe an der Innenkante, darin
  die Kopie kleiner abgebildet. Echte Brechung des Hintergrunds geht im iPhone-WebView nicht.
- Randbrechung zwei Varianten, Schalter „Brechung als“ (--linse-art): Ringe (1) oder
  Glisse (2, `src/lib/glasBrechung.ts`, SVG-Verschiebungskarte auf der Kopie, nach
  Glisse/MIT; WebKit in objectBoundingBox). Messung Chromium, 4× gedrosselt, Tipp
  Profil→Home: ohne Brechung max. 17 ms Lücke, Ringe 32 ms, Glisse bis 124 ms
  (Filter rechnet jedes Bild neu). drop-shadow an den Symbolen der Kopien halbierte
  die Bildrate → entfernt.

## Navbar im Apple-Stil (Branch claude/glas-linse)

- Grundform für alle Looks; ein Look pflegt nur Werte: `--tabbar-kapsel`,
  `--tabbar-kapsel-kante`, `--tabbar-aktiv`, `--tabbar-rund`, `--linse-rund`
  (liquid-glass.css). Labor eckig (10px/14px), Papier hell.
- Ruhende Kapsel füllt den Reiter; die Leiste hat seitlich denselben Einzug wie
  oben/unten → am äußeren Reiter parallel zur Rundung. In Ruhe auf Gerätepixel
  gerastet, graues Original unter der Kapsel ausgeblendet (`data-ruhig`) gegen
  Zucken beim Scrollen (nur auf dem Branch, auf main nicht).
- „+“ ist ein Glasknopf: übernimmt das Glas der Leiste je Look (BottomNavigation),
  Plus in `--tabbar-aktiv`.
- Hokus Tor: Spalt und Torbild (Canvas `.tyd-dot-torbild`) liegen IN der Leiste unter
  der Linse; die Engine malt dorthin (`torBild` in DotLeiste) und kopiert in die
  Linsen-Kopien. In e2e bleibt Hoku im Haus (`tyd.e2e.dot-im-haus`), zum Prüfen auf 0.
- Glisse archiviert (Schalter nur im Test-Menü), schlank: eine Verschiebung, nur
  solange ein Finger liegt.
- Glas der Navbar: EIN Material für Leiste und Plus nach Glisse „Glass“ (index.css,
  --glas-fuellung/-toenung/-kante-farbe/-tropfen/-unschaerfe/-glimmen). Looks tönen nur.
  Eigene Navbar-Materialien der Looks (v. a. Papier, Obsidian, Instrument) stehen in
  liquid-glass.css, gelten nur mit <html data-navbar="eigen"> (Entscheidung: erst alle Glas).
- 2026-11-04: Versuch „Glas wie Apples Ticket-App-Aufnahme“ (klare Linse über
  verschwommener Seite, zwei Glasschichten in der Leiste, gemessene Werte) auf
  Wunsch des Nutzers ganz zurückgenommen („komplett Müll“, Linse hatte sich mit
  verändert). Lehre: bei Navbar-Änderungen die Linse nicht anfassen; Änderungen
  am Aussehen klein halten und einzeln zeigen.
- Leistung (2026-11-04, gemessen 4× gedrosselt, Halten+Wischen): Stilberechnung
  1420→~690 ms, Skript 311→~180 ms. Ursachen: hokuLicht schrieb --hl-* an die Leiste
  (jetzt nur mit data-navbar="eigen"); React-setPille bei jeder Fingerbewegung
  (jetzt freiLageRef + direkte Feder). will-change auf allen Linsen-Schichten
  machte es schlechter (verworfen).
- Leiste in der Linse nicht mehr dunkel: Unschärfe der Leiste in eigener Ebene
  (.tyd-glas-koerper, sonst Backdrop Root), Kopie mit eigenem backdrop-filter und
  ohne zweite Füllung; in den Ringen Kopie ohne Grund.
- Linse: Gleitzeit nach Weg (federFuerWeg, Regler „Tempo nach Weg“), Verformung mit
  Tempo und Bremsen (ax, Regler „Verformung“).
- Leistung Looks (2026-11-04): hokuLicht schrieb jedes Bild --hl-* an alle sichtbaren
  Flächen, vererbt → ganzer Karteninhalt neu berechnet. Jetzt @property inherits:false
  (index.css), Pseudo-Kanten holen per `inherit`, .lg-glass/.btn-primary eigene Ziele,
  Werte in Stufen (2°, 2 %, 0,02). Gemessen Frost: Stil 131 → 38 ms/s (wie Schwarz).
  Hokus Tor in Linsen-Kopien nur bei sichtbarer Linse. Achtung: Chromium im Container
  rendert backdrop-filter NICHT (Software-Compositing) — Glas nur am Gerät beurteilbar.
- Hoku „schwammig“ in den neuen Looks (2026-11-04): Im Container messbar kein Unterschied
  Licht an/aus mehr (Schreibungen nur 3–9/s, nur nahe Karten). hokuLicht misst Lagen
  jetzt nur bei Bedarf (Scroll/Resize/Inhalt, sonst alle 500 ms) und rechnet höchstens
  30×/s. Prüfschalter am Gerät per Adresse: ?licht=aus, ?effekte=aus (main.tsx,
  index.css) — Ergebnis vom iPhone steht noch aus.
- Nutzer (iPhone): Labor und Obsidian flüssig, Frost/Neon/Tiefsee mit Hoku schwammig —
  auch mit ?licht=aus und ?effekte=aus. Unterschied der Looks: Seitenhintergrund (Frost
  Rauschen per feTurbulence, Neon/Tiefsee große Verläufe; Obsidian keiner, Labor Raster).
  Gefunden: Hokus Trefferknopf (.tyd-dot-treffer) bekam jedes Bild Breite/Höhe neu →
  Neumalen darunter. Jetzt eigene Ebene (will-change) und Größe nur bei Änderung (2 px).
  Prüfschalter ?hintergrund=aus. Ergebnis vom iPhone steht aus.

### 2026-11-05 Hoku langsamer auf MyStack (Nutzer: unabhängig vom Design)
- Farbe „Passend zum Design" und dieselbe Farbe von Hand sind im Code gleich (Engine liest nur FARBE); kein Stau über Zeit (15 Lookwechsel, Navigation, 30 s: rAF, Beobachter, Animationen konstant).
- Hokus Hauptthread-Takt im Container auf Home, MyStack, Kalender gleich (60/s, 4× gedrosselt).
- Auf MyStack ändert die Flüssigkeit (sloshEngine/LiquidGraphic) dauerhaft SVG-Pfade: 3 Fläschchen ≈ 124 Pfade/s, auch in Ruhe (30 Hz). Verdacht: Malarbeit auf der iPhone-GPU neben Hokus Vollbild-Canvas.
- Prüfschalter `?schwappen=aus` (SloshContext) zum Eingrenzen am Gerät.
- Nutzer 05.11.: auch mit `?schwappen=aus` ist Hoku auf MyStack schwammig → Flüssigkeit ausgeschlossen.
- Prüfanzeige `?messen=an` (src/lib/messAnzeige.ts): Bilder/s, Ruck-Anteil (>20 ms), Skriptzeit aller rAF-Schleifen, längstes Bild. Unterscheidet Rechenkern- von GPU-Last am Gerät.
- iPhone-Messung 05.11. (`?messen=an`): Home 120/s, 0 % Ruck, Skript 84 ms/s. MyStack 42–60/s, 8–29 % Ruck, max 100–120 ms, Skript nur 54–64 ms/s → Malarbeit, nicht Hokus Rechnung.
- Verdacht: Bläschen (`.tyd-liquid-bubble`, CSS-Animation auf SVG-Kreisen) zwingen WebKit, das Fläschchen-SVG (Verläufe, SVG-Filter shellSoft) jedes Bild neu zu malen. Prüfschalter `?blasen=aus` und `?buehne=still` (alle Dauer-Animationen in main + Flüssigkeit).
