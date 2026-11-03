# HOKU in der App – organisches Cyan-Icon

Stand: 03.11.2026. Zusätzlich bestätigt: „das icon mit allen app icons überschreiben“. Bisheriger Auftrag: „das neue icon überall überschreiben, vernünftig immer in richtiger größe keine toten ränder“.

Aktuelle Quelle: `brand-kit-v2/QUELLEN/hoku-app-icon-organisch-cyan-v3-master.png`. Dieser Master ist bytegleich zum bestätigten Bild exec-8233a755-bd9f-4458-8699-579876229c60.png. Alle eingebundenen App-Icons einschließlich älterer URLs, Benachrichtigungs-Icons und Startbilder werden daraus abgeleitet. Die bisherigen Varianten bleiben im Brand-Kit als Archiv erhalten. Die separat freigegebenen Nav- und KI-Symbole werden nicht geändert. Für die tatsächlichen App-Flächen werden die leeren Originalränder enger zugeschnitten und die Größe pro Einsatz angepasst.

Erzeugen: `npm run icons:update`. Prüfen: `npm run icons:verify`. Die frühere Python-Einstiegsdatei leitet auf denselben aktuellen Export weiter.

## Eingesetzte Dateien

| Einsatz | Dateien | Größe und Ausschnitt |
|---|---|---|
| iOS App-Icon | `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` | 1024 × 1024, RGB ohne Alphakanal, Hoku ca. 84 % der Kante; Abrundung durch iOS |
| Android Launcher | `android/app/src/main/res/mipmap-*/ic_launcher.png` und `ic_launcher_round.png` | 48 / 72 / 96 / 144 / 192 px, Hoku ca. 84 %, passende vorhandene Kreis-/Rechteckform |
| Android adaptiv | `mipmap-*/ic_launcher_foreground.png`, `values/ic_launcher_background.xml` | 108 / 162 / 216 / 324 / 432 px, transparenter Vordergrund, Hoku ca. 59 % der gesamten Ebene; Hintergrund #000101 |
| Web/PWA | `public/icons/hoku-organisch-v3-180.png`, `hoku-organisch-v3-192.png`, `hoku-organisch-v3-512.png`, `hoku-organisch-v3-1024.png`, `public/apple-touch-icon.png` | 180 / 192 / 512 / 1024 px, RGB, Hoku ca. 84 % |
| Maskierbare PWA | `public/icons/hoku-organisch-v3-maskable-512.png` | 512 px, deckend, Hoku ca. 76 % |
| Favicons | `public/favicon.ico`, `favicon.svg`, `icons/hoku-fav-organisch-v3-*.png` | 16 / 32 / 48 / 64 px, enger Ausschnitt mit ca. 92 % Hoku |
| Benachrichtigungen / ältere Verweise | `public/icon-192.png`, `icon-512.png`, `icon.svg`, bisherige `icons/hoku-*.png` und `hoku-fav-blau-*.png` | Auch diese vorhandenen URLs enthalten das neue dunkle Motiv |
| Untere App-Leiste | `src/features/dot/DotLogo.tsx`, Referenz `branding/hoku-nav-etwas-dichter.svg` | Gewählter Vektor „Etwas dichter“, Anzeige 30 px; Grundfarbe wie Nachbar-Icons, Cyan-Leuchten und vorhandene Animationen erhalten |
| Startbildschirme | iOS `Splash.imageset/splash-2732x2732*.png`, Android `drawable*/splash.png` | Bestehende Auflösungen erhalten, Hoku mittig, 24 % der kurzen Bildkante, keine zusätzliche dunkle Bildkachel |

Für die untere Leiste wurde am 02.11.2026 die Vorschau „Etwas dichter“ (zweiter Vergleich, 3/3) gewählt: die frühere Punktkugel mit ausgesparter Pupille und hellerem Augenrand durch höhere Partikeldeckkraft. Der Vektor erbt über `currentColor` die Farbe der übrigen Nav-Symbole; das bestehende Leuchten bleibt Cyan. Das Zeichen ist direkt eingebettet und benötigt auch offline keine Bilddatei. Die Profilfarbe gilt weiterhin für den lebenden Hoku, nicht für das einfarbige Nav-Symbol. Das separate KI-Button-Symbol mit Funkeln bleibt unverändert.

## Sicherheitsbereiche und Hintergrund

Der Rand wird je Ziel berechnet und nicht vom klein dargestellten Original übernommen. Androids adaptive Darstellung benötigt dennoch Platz für Masken und Bewegungen: 108-dp-Ebene mit geschütztem 66-dp-Bereich; die tatsächlich sichtbare Darstellung füllt Hoku entsprechend stärker aus. [Android-Dokumentation](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive).

Maskierbare PWA-Icons schützen ihren wichtigen Inhalt innerhalb eines mittigen Kreises mit 40 % Radius. Der 76-%-Ausschnitt wird gegen diesen Kreis geprüft. [Web-App-Manifest-Spezifikation](https://www.w3.org/TR/appmanifest/#icon-masks).

Hintergrund für Android, PWA-Start und Startbilder: #000101, passend zum dunklen Master. iOS erhält ein quadratisches RGB-Icon ohne vorgezeichnete transparente Ecken. Native Vordergrund- und Leistenzeichen entfernen den dunklen Hintergrund über einen SVG-Alphafilter; die hellen Partikelkerne behalten ihre Farbe.

## Aktualisierung und Prüfung

### Historisch: iPhone-Korrektur vom 02.11.2026

Die folgenden Aussagen dokumentieren die damalige dunkle Fassung. Seit dem ausdrücklichen Austauschauftrag vom 03.11.2026 nutzen alle App-Icon- und Startbilddateien den organischen Master. Die Standard-Apple-Adresse und die beiden Größen bleiben erhalten; ihre Versionskennung und die PWA-/Favicon-URLs sind aktualisiert.

Das vorhandene dunkle Cyan-Motiv bleibt unverändert. Eine neu generierte Alternative wurde abgelehnt und wird nicht eingebaut. Die öffentliche Standard-Adresse `/apple-touch-icon.png` lieferte bei der Prüfung HTML statt eines Bildes. Sie enthält jetzt denselben vollständig deckenden 180-px-Export wie die vorhandene iPhone-Fassung. Zusätzlich ist derselbe freigegebene 1024-px-Export wie beim nativen iOS-App-Icon als größeres Touch-Icon verlinkt. Die neuen Links tragen eine Versionskennung. Es gibt keine neue weiße Kachel, keine vorgezeichneten runden Ecken und keinen veränderten Partikelausschnitt in diesen Dateien.

Die Auswirkungen auf Safaris Installationsvorschau müssen nach Veröffentlichung am Gerät geprüft werden; das beobachtete weiße Vorschaubild lässt sich aus dem Screenshot allein nicht vollständig erklären. Grundlage für den Standard-Pfad und die Größenwahl: [Apple Safari Web Content Guide](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html).

HTML und PWA-Manifest verwenden neue Icon-URLs, damit alte zwischengespeicherte Fassungen leichter abgelöst werden. Die bisher verwendeten Dateien sind ebenfalls überschrieben. `EINBAU-CHECKS.json` hält Größen, tatsächliche Inhaltsgrenzen, Sicherheitsbereich und Dateiprüfsummen fest. `eingebaut.png` zeigt die konkreten Exporte einschließlich einer adaptiven Kreis-Maske und der Startbildschirme.

Diese Dateien sind im Projekt eingebaut. Veröffentlichung und ein neuer nativer App-Build sind eigene Schritte; eine bereits installierte App wird durch lokale Dateiersetzung nicht ausgetauscht.
