# HOKU – Branding-Entscheidungen

Stand: 02.11.2026. Festgehalten aus dem Branding-Gespräch mit dem Nutzer.

## Aktuell bestätigt – Cyan-Hoku mit natürlicher Pupille (02.11.2026)

Der Nutzer bestätigt das generierte Cyan-App-Icon ausdrücklich: „das wird es damit updaten wir unser branding“.

- Bildmaster: `../entwuerfe/hoku-app-icon-cyan-natuerliche-pupille-v1.png`, unverändert im neuen Paket als `../brand-kit-v2/04-Icons/hoku-app-cyan-original.png` gesichert.
- Hoku bleibt die räumliche Partikelkugel, jetzt mit natürlicher, leicht nach oben rechts versetzter Pupille und nahezu weißem Partikelrand. Die 3H-Pupillenentwürfe sind nicht die bestätigte Auswahl.
- App-Cyan #00CCF5 dient als Farbreferenz. Wortmarke, Unterzeile und Rahmen bleiben Weiß oder Schwarz. Farbige und monochrome Platzierungsfassungen sind enthalten.
- Michroma Regular 400 (+0,16 em), IBM Plex Mono Medium 500 (+0,5 em), gleich breite Unterzeile und bestätigte Logo-Anordnungen bleiben erhalten. Die neue Pupille wird auch in die monochromen Maskottchen übernommen.
- Aktuelles Einsatzpaket: `../brand-kit-v2/`; ZIP: `../HOKU-Brand-Kit-v2.zip`. Es ersetzt v1 für neue Anwendungen. V1 und ältere Originale bleiben als Verlauf erhalten.
- Das KI-Button-Symbol mit integriertem Funkeln bleibt auf ausdrücklichen Nutzerwunsch unverändert. Alle zugehörigen Dateien werden bytegleich aus v1 übernommen.
- Die Freistellung ist ein aus dem bestätigten Bild abgeleiteter Rastermaster. Das App-Icon-Original bleibt unverändert; Logo-SVGs enthalten Raster-Hoku und Vektorschrift.
- Diese Freigabe aktualisiert die Branding-Dateien. Einbau in die App, Veröffentlichung und Git-Push werden nicht automatisch ausgeführt.

Die nachfolgenden Entscheidungen dokumentieren die ursprüngliche Typografie und frühere Bildfassungen. Bei Abweichungen gilt diese aktuelle Auswahl.

### Ergänzung: vertikale Variante 6 und zwei Plaketten

Der Nutzer wählt die Kombination aus dem Feinschliff-Vergleich ausdrücklich für das Paket: „baue 6 mit ins branding paket“. Sie ergänzt die bestehenden Anordnungen.

- Hoku groß oberhalb von HOKU und HEALTH HUB; beide Textzeilen gleich breit. Feinere Striche der Unterzeile, optisch angepasste Abstände und reduzierte Lichthöfe sind übernommen.
- Die frei stehende 1360 × 1620 px große PNG ist bytegleich zur freigegebenen Vorschau 6. Master-PNG und Master-SVG liegen unter `../brand-kit-v2/QUELLEN/hoku-vertikal-v6-master.*`.
- Drei Fassungen in `../brand-kit-v2/08-Vertikal-und-Plaketten/`: frei stehend, hohe Plakette mit TRACKED BY und horizontaler Trennlinie, hohe Plakette nur mit Umrandung.
- Cyan mit weißer Schrift, jeweils auf tiefdunklem Hintergrund und transparent; PNGs mit 1360 und 2400 px Breite sowie SVG-Layouts mit Raster-Hoku und Vektorschrift/-rahmen.
- Die engeren HOKU-Abstände (+0,015 em vor Paaranpassungen), der kleinere Wortabstand und die per Vektorfilter feineren IBM-Plex-Mono-Striche gelten für diese vertikale Zusatzfassung. Die Typografie der horizontalen Hauptfassung bleibt unverändert.
- App-Icon und KI-Symbol bleiben erhalten. Brand-Guide, Übersichten und ZIP enthalten die Ergänzung.

### Ergänzung: dunkles Cyan-App-Icon in mehreren Größen

Der Nutzer fordert die neu erzeugte dunkle Variante ausdrücklich in verschiedenen Größen für das Branding-Paket an.

- Bildmaster: `../exports/hoku-app-icon-cyan-dunkel-v1.png`, unverändert im Paket als `../brand-kit-v2/QUELLEN/hoku-app-icon-cyan-dunkel-master.png` und `../brand-kit-v2/04-Icons/Dunkel/hoku-app-cyan-dunkel-original.png`.
- Aktueller Hoku mit natürlicher Pupille, dunklerem Hintergrund und zurückgenommenem Umgebungsleuchten. Die bisherige Cyan-Fassung bleibt erhalten.
- Ordner `04-Icons/Dunkel`: 24 quadratische RGB-PNG-Größen von 1024 bis 16 px ohne Alphakanal sowie vier enger zugeschnittene Favicons, ICO und ein SVG mit eingebettetem Rasterbild.
- Guide, Größenübersicht und ZIP enthalten beide Lichtstimmungen. KI-Symbol, Logo-Anordnungen und tatsächliche App-Dateien werden dadurch nicht geändert.

### Einbau des dunklen Icons in die App

Auf ausdrücklichen Nutzerwunsch ersetzt das dunkle Icon jetzt die aktiven App-, Launcher-, Browser- und PWA-Icons sowie die Startbilder und das Zeichen in der unteren App-Leiste. Die vorherige Aussage zum reinen Paket-Update beschreibt den damaligen Stand; der neue Einbau ist in `../EINBAU.md` dokumentiert.

- App-Icons: engerer Ausschnitt mit ca. 88 % Hoku; Favicons ca. 94 %; maskierbare PWA-Fassung ca. 76 %; Android-Vordergrund ca. 59 % der 108-dp-Ebene, innerhalb der Sicherheitszone.
- Alte öffentliche Bild-URLs enthalten ebenfalls das neue Motiv. HTML und PWA-Manifest verwenden zusätzlich neue Dateinamen.
- Das KI-Button-Symbol mit Funkeln und der lebende Hoku-Assistent bleiben unverändert.
- Web-Build und kopierte Web-Dateien in beiden nativen Projekten sind aktualisiert. Die lokalen Änderungen veröffentlichen keine neue App-Version.

## Gewähltes Hauptlogo

### Finale Auswahl – ersetzt die früheren Schriftzug-Entscheidungen unten

Der Nutzer hat die Michroma-Fassung mit Hoku-PNG links und gleich breiter Unterzeile **HEALTH HUB** ausdrücklich als finale Wahl bestätigt.

- HOKU: Michroma Regular 400, Sperrung +0,16 em.
- HEALTH HUB: IBM Plex Mono Medium 500, Sperrung +0,5 em; proportional auf dieselbe sichtbare Breite wie HOKU gesetzt.
- Maskottchen: `../exports/hoku-maskottchen-weiss-v1.png`; die PNG-Partikelstruktur bleibt erhalten. Keine Ersetzung durch das ältere Vektor-Punktzeichen.
- Finale Einzeldateien: `../exports/hoku-health-hub-michroma-weiss-auf-schwarz-v1.png` und `../exports/hoku-health-hub-michroma-schwarz-auf-weiss-v1.png`, jeweils 2700 × 1680 px.
- Beide Fassungen rein monochrom, Schrift und Maskottchen in derselben Farbe. Die nachfolgenden alten K-Geometrie-Entscheidungen betreffen frühere Entwürfe.
- Für eine spätere farbige Fassung wurde neutrale weiße/schwarze Schrift neben farbigem Hoku empfohlen; ein farbiger Export ist noch nicht bestätigt.
- TRACKED BY-Siegel: **03 als Plakette** ist vom Nutzer gewählt. TRACKED / BY links, vertikale Trennlinie, Hoku-PNG und zweizeiliger Schriftzug rechts; dünner Rahmen mit dezent gerundeten Ecken.
- Gewählte Plakette gesichert unter `../exports/hoku-tracked-by-03-p-weiss-auf-schwarz.png` und `../exports/hoku-tracked-by-03-p-schwarz-auf-weiss.png`, zusätzlich jeweils als SVG mit eingebettetem Hoku-PNG. Transparente Fassungen und Größenempfehlungen sind im Einsatzpaket enthalten.
- Auf Nutzerwunsch ergänzt: Kompaktlogo ohne HEALTH HUB, Hoku und Michroma-Schriftzug optisch gleich hoch. Die bestätigte Hauptfassung mit Unterzeile bleibt ebenfalls verfügbar.
- Einsatzpaket: `../brand-kit-v1/` mit transparenten und deckenden Haupt-/Kompaktlogos, Plakette 03 einschließlich dezenter 35-%-Fassungen, Einzelzeichen, Icons, Originalfonts samt Lizenzen sowie Brand-Guide. Geprüfte Größenempfehlungen stehen im Guide; das 16-px-Favicon verliert Partikeldetails.
- App-Icon-Auswahl ergänzt: die frühere hellere/blaue Fassung (`hoku-app-icon-premium-v1.png`) vor der dunklen Fassung im Guide und in der Übersicht. Im Paket unter `04-Icons/hoku-app-blau-*`, einschließlich unverändertem Original und 1024/512/192/180-px-Exporten. Die dunkle Fassung bleibt enthalten.
- 30.10.2026: Für das reine Symbol kontextbezogener KI-Buttons hat der Nutzer eine Vereinfachung erlaubt und **C / Detailliert, 48 Partikel** gewählt. Finaldateien im Paket unter `07-KI-Button-Symbol/`, Blau und Weiß, transparente SVGs und PNGs. Keine Änderung der App-Buttons mit dieser Asset-Auswahl.
- Finale Ergänzung, 30.10.2026: Nutzer bestätigt **vierzackiges Funkeln, weiter in Hokus Kontur gerückt** („ja ist gut“). Diese Fassung ersetzt die sternlose KI-Symbolfassung im Paket. Grundlage: 48-Partikel-Kugel, mit Freiraum für den integrierten Stern verbleiben 41 Punkte. Keine Änderung am Hauptlogo oder an der App-Oberfläche.

### Frühere Auswahl / Verlauf

Der Nutzer hat **„Zeichen links“** als beste und hochwertigste Fassung gewählt.

- Hoku als vollständige Partikelkugel links neben dem ausgeschriebenen **HOKU**.
- Sehr feine, geradlinige Großbuchstaben aus dem vorhandenen Schriftzug-Kit, mit geraden Strichenden. Die Wortmarke ist eine geometrische Pfadkonstruktion, keine der zuvor getesteten Manrope-, Geist- oder Sora-Fassungen.
- Ein normales, fein gezeichnetes O im Namen.
- Dunkle Gestaltung: schwarzer Hintergrund, heller Schriftzug (`#DDE0E8`) und die zuletzt erstellte dunklere Hoku-Kugel.
- Die Kugel ist etwas höher als die Buchstaben. Die gewählte Komposition bleibt für die Hauptdatei unverändert.
- Das App-Icon zeigt Hoku allein.

## Gesicherte Dateien

- `../exports/hoku-hauptlogo-dunkel-v3.png`: aktuelle Hauptfassung als PNG, 2800 × 1200 px. Auf ausdrücklichen Nutzerwunsch ursprüngliche K-Form, nur der kleine Überstand links am K entfernt.
- `../exports/hoku-hauptlogo-dunkel-v3.svg`: dieselbe Komposition; Buchstaben als Vektorpfade, Hoku als eingebettetes Rasterbild. Kein vollständig vektorisierter Leucht-Master.
- Die v1-Dateien erhalten die ursprünglich gewählte Vorschau.
- `../exports/hoku-hauptlogo-weiss-auf-schwarz-v1.png` und `.svg`: Hoku links und Schriftzug gemeinsam weiß auf Schwarz, mit der ursprünglichen K-Form aus v3.
- `../exports/hoku-hauptlogo-weiss-transparent-v1.png` und `.svg`: dieselbe weiße Hauptfassung auf transparentem Hintergrund; PNG 2800 × 1200 px.
- `../exports/hoku-maskottchen-weiss-v1.png`: weiße Hoku-Fassung mit transparenten Zwischenräumen, aus dem dunklen App-Icon abgeleitet.
- Die weiße Hauptfassung wurde vom Nutzer ausdrücklich positiv bewertet („das ist sehr gut“).
- `../exports/hoku-app-icon-dark-v1.png`: Quelle der dunkleren Kugel.
- `../exports/hoku-app-icon-dark-v1-1024.png`: quadratischer 1024er Export.

## Weitere Richtungen

- „Hoku als O“ war ebenfalls ein Favorit. Seine Rolle als zusätzliche Wortmarke ist noch nicht festgelegt; es ist nicht das gewählte Hauptlogo.
- Die Varianten mit einem H als Aussparung wurden ausdrücklich verworfen.
- Horizont-Anschnitte wurden ausprobiert; die anschließende Entscheidung fiel auf „Zeichen links“.

## Noch zu erarbeiten

- Die K-Variante v4 mit gekürztem unterem Arm wurde verworfen („vorher war besser“). **v3 bleibt die Grundlage:** ursprüngliche K-Geometrie, ausschließlich Überstand links korrigiert. Das gilt auch für die weiße Fassung.
- Die alternative K-Konstruktion mit mittiger Verzweigung (v2) wurde verworfen. Der Nutzer möchte das ursprüngliche K behalten und ausschließlich den kleinen weißen Überstand links am Stamm korrigieren. In v3 umgesetzt; gegenüber v1 beschränkt sich die Pixeländerung auf den Knoten am K.
- Transparente Hauptfassung, abgestimmt auf das gewählte dunkle Logo.
- Erste Wasserzeichen-Auswahl in `../watermarks-v1/`: W1–W3 frei, K1–K3 Kapseln, T1–T3 Tickets. Jeweils PNG und SVG in Weiß, Schwarz, Farbig-dunkel, Farbig-hell und Weiß-dezent (35 %). Die bestätigte K-Form ist in allen Entwürfen übernommen. Varianten und die optionalen Zusatzzeilen „TRACKED BY“ / „Health Hub“ sind noch nicht endgültig ausgewählt.
- Abgestimmte Exporte, Mindestgrößen und Schutzraum.
- Abschließende Zusammenstellung des Brand-Kits.

Ältere Regeln in `../kit/README.md`, die Hoku als O zwingend vorsehen, beschreiben einen früheren Entwurf und werden durch die Auswahl des Hauptlogos in diesem Gespräch überholt.

## Nav-Symbol – finale Auswahl vom 02.11.2026

- Bestätigt: „Etwas dichter“ aus dem zweiten Variantenvergleich (3/3), nicht die spätere Reihe „Dezent feiner“.
- Referenz: `hoku-nav-etwas-dichter.svg`. Die Partikelpositionen, Größen, Deckkraft und ausgesparte Pupille werden exakt übernommen.
- Grundfarbe: `currentColor`, passend zu den übrigen Symbolen der Navleiste. Keine eigene Cyan-Füllung und keine Profilfarbwahl im Nav-Symbol.
- Leuchten: bestehender Cyan-Effekt in `src/features/dot/dot.css`; Pulsieren, Wackeln und Zustandswechsel bleiben erhalten.
