# HOKU in der App – dunkles Cyan-Icon

Stand: 02.11.2026. Nutzer: „das neue icon überall überschreiben, vernünftig immer in richtiger größe keine toten ränder“.

Aktuelle Quelle: `brand-kit-v2/QUELLEN/hoku-app-icon-cyan-dunkel-master.png`. Der bestätigte Master und die Branding-Logos bleiben unverändert erhalten. Für die tatsächlichen App-Flächen werden die leeren Originalränder enger zugeschnitten und die Größe pro Einsatz angepasst.

Erzeugen: `npm run icons:update`. Prüfen: `npm run icons:verify`. Die frühere Python-Einstiegsdatei leitet auf denselben aktuellen Export weiter.

## Eingesetzte Dateien

| Einsatz | Dateien | Größe und Ausschnitt |
|---|---|---|
| iOS App-Icon | `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` | 1024 × 1024, RGB ohne Alphakanal, Hoku ca. 88 % der Kante; Abrundung durch iOS |
| Android Launcher | `android/app/src/main/res/mipmap-*/ic_launcher.png` und `ic_launcher_round.png` | 48 / 72 / 96 / 144 / 192 px, Hoku ca. 88 %, passende vorhandene Kreis-/Rechteckform |
| Android adaptiv | `mipmap-*/ic_launcher_foreground.png`, `values/ic_launcher_background.xml` | 108 / 162 / 216 / 324 / 432 px, transparenter Vordergrund, Hoku ca. 59 % der gesamten Ebene; Hintergrund #000101 |
| Web/PWA | `public/icons/hoku-dunkel-180.png`, `hoku-dunkel-192.png`, `hoku-dunkel-512.png` | 180 / 192 / 512 px, RGB, Hoku ca. 88 % |
| Maskierbare PWA | `public/icons/hoku-dunkel-maskable-512.png` | 512 px, deckend, Hoku ca. 76 % |
| Favicons | `public/favicon.ico`, `favicon.svg`, `icons/hoku-fav-dunkel-*.png` | 16 / 32 / 48 / 64 px, enger Ausschnitt mit ca. 94 % Hoku |
| Benachrichtigungen / ältere Verweise | `public/icon-192.png`, `icon-512.png`, `icon.svg`, bisherige `icons/hoku-*.png` und `hoku-fav-blau-*.png` | Auch diese vorhandenen URLs enthalten das neue dunkle Motiv |
| Untere App-Leiste | `src/features/dot/DotLogo.tsx`, `public/icons/hoku-dunkel-symbol-64.png`, `hoku-dunkel-symbol-128.png` | Transparenter Ableger, Anzeige 30 px, Hoku ca. 92 %; vorhandene Animationen erhalten |
| Startbildschirme | iOS `Splash.imageset/splash-2732x2732*.png`, Android `drawable*/splash.png` | Bestehende Auflösungen erhalten, Hoku mittig, 24 % der kurzen Bildkante, keine zusätzliche dunkle Bildkachel |

Die untere Leiste verwendet jetzt den aktuellen Hoku mit Pupille statt der älteren Punktkugel. Die auf main ergänzte Farbwahl im Profil und die automatische Anpassung an das App-Design bleiben dabei erhalten. Das separate KI-Button-Symbol mit Funkeln und der lebende Assistent werden nicht verändert.

## Sicherheitsbereiche und Hintergrund

Der Rand wird je Ziel berechnet und nicht vom klein dargestellten Original übernommen. Androids adaptive Darstellung benötigt dennoch Platz für Masken und Bewegungen: 108-dp-Ebene mit geschütztem 66-dp-Bereich; die tatsächlich sichtbare Darstellung füllt Hoku entsprechend stärker aus. [Android-Dokumentation](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive).

Maskierbare PWA-Icons schützen ihren wichtigen Inhalt innerhalb eines mittigen Kreises mit 40 % Radius. Der 76-%-Ausschnitt wird gegen diesen Kreis geprüft. [Web-App-Manifest-Spezifikation](https://www.w3.org/TR/appmanifest/#icon-masks).

Hintergrund für Android, PWA-Start und Startbilder: #000101, passend zum dunklen Master. iOS erhält ein quadratisches RGB-Icon ohne vorgezeichnete transparente Ecken. Native Vordergrund- und Leistenzeichen entfernen den dunklen Hintergrund über einen SVG-Alphafilter; die hellen Partikelkerne behalten ihre Farbe.

## Aktualisierung und Prüfung

HTML und PWA-Manifest verwenden neue Icon-URLs, damit alte zwischengespeicherte Fassungen leichter abgelöst werden. Die bisher verwendeten Dateien sind ebenfalls überschrieben. `EINBAU-CHECKS.json` hält Größen, tatsächliche Inhaltsgrenzen, Sicherheitsbereich und Dateiprüfsummen fest. `eingebaut.png` zeigt die konkreten Exporte einschließlich einer adaptiven Kreis-Maske und der Startbildschirme.

Diese Dateien sind im Projekt eingebaut. Veröffentlichung und ein neuer nativer App-Build sind eigene Schritte; eine bereits installierte App wird durch lokale Dateiersetzung nicht ausgetauscht.
