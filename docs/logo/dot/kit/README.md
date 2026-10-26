# Dot-Kugel – App-Icon-Kit (26.10.2026)

Gewählte Richtung: **A · Kugel** (Nutzer: „A ist schon am besten“). Alles hier erzeugt
`kit.py` (`python3 -I docs/logo/dot/kit.py docs/logo/dot/kit`), gerastert mit Playwright.

## Idee
Dot, wie er in der App lebt: eine Kugel aus leuchtenden Punkten, ohne Augen. Vorderseite
71 Punkte (groß, hell), Rückseite 79 Punkte (klein, gedämpft) – dadurch liest sich die
Kugel als Körper, nicht als Scheibe. Punktgrößen stark gestreut (Nutzer 26.10.: „mehr
Ungleichmäßigkeit“): Faktor 0,5–1,6 mit Potenzverteilung, viele kleine, wenige große.
Jeder Punkt ist ein Leuchtpunkt wie `gl.POINTS` im Shader: voller Kern, kurzer weicher
Abfall, helle Mitte; dazu ein weiter Schein (Weichzeichner 46). Kontrast (Nutzer 26.10.):
Grund fast schwarz, Streulicht knapp, Helligkeit der Punkte nach Tiefe (vorn hell und
satt, zum Rand dunkler), Rückseite stark gedämpft. Farben wie in `dotEngine.ts`: Cyan → Violett
diagonal, Pink unten. Dunkle Kachel wie der Look „Nacht“.

## Dateien
| Datei | Zweck |
|---|---|
| `dot-kugel.svg` | Marke schwarz, 256er Raster, Vorderseite (Master für Druck/Einfarbig) |
| `dot-kugel-klein-marke.svg` | Marke mit 27 Punkten für ≤ 32 px |
| `dot-kugel-icon.svg` / `-1024.png` | App-Icon 1024, deckend, ohne Transparenz (App Store) |
| `ebenen/*.svg` + `.png` | Vier Ebenen für Icon Composer (iOS 26): Hintergrund (deckend), Schein, Punkte hinten, Punkte vorn (transparent) |
| `android-foreground.svg` | Vordergrund des adaptiven Icons, Kugel in der sicheren Zone (66 dp) |
| `dot-kugel-klein.svg` / `favicon-64.png` | Favicon-Fassung, ohne Weichzeichner |
| `varianten/` | einfarbig schwarz, weiß, Cyan `#6ee6ff` |

## Eingebaut
- iOS: `ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` (1024, deckend).
- Android: `mipmap-*/ic_launcher.png` (abgerundet), `ic_launcher_round.png`,
  `ic_launcher_foreground.png` (108 dp Raster), Hintergrund `#05060a`.
- Web/PWA: `public/icon.svg`, `public/favicon.svg`, `icon-192.png`, `icon-512.png`
  (über `node scripts/gen-icons.cjs`).

## Farben
| | RGB | HEX |
|---|---|---|
| Cyan | 92 236 255 | `#5cecff` |
| Violett | 168 118 255 | `#a876ff` |
| Pink | 255 104 196 | `#ff68c4` |
| Kachel | 2 3 6 → 11 16 32 (radial) | `#020306` → `#0b1020` |

## Regeln
- Mindestgröße der Vollfassung 40 px; darunter `dot-kugel-klein`.
- Schutzzone um die Kugel: ein Punktdurchmesser (≈ 10 % der Kugel).
- Nicht: Augen, Umriss, andere Farben, auf hellem Grund ohne Kachel (dort die schwarze Marke).
- Keine Transparenz im App-Store-Export; iOS maskiert selbst.

## Offen
- iOS 26: Ebenen in Icon Composer zu einem `.icon` zusammensetzen (Xcode 26); bis dahin gilt das flache 1024er.
- Android: alte Launcher zeigen `ic_launcher.png` abgerundet; neuere maskieren Vorder-/Hintergrund.
- Gerätetest: Home-Bildschirm hell/dunkel, getönte Icons (iOS 18+), Spotlight.
