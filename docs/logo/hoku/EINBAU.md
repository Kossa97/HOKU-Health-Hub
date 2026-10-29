# HOKU in der App (30.10.2026)

Nutzer: „Das App-Logo ist neu, es liegt in HOKU-Brand-Kit-v1.zip; überall vernünftig ersetzen, dann auf main.“
App-Icon ist die **blaue Fassung** aus `brand-kit-v1/04-Icons` (laut Brand-Guide die erste App-Icon-Fassung).
Export: `python3 -I docs/logo/hoku/export_app.py $PWD`; Übersicht `eingebaut.png`.

| Wo | Datei | Quelle |
|---|---|---|
| iOS App-Icon | `AppIcon-512@2x.png` (1024) | Kit `hoku-app-blau-1024.png`, ohne Alphakanal |
| iOS Startbildschirm | `Splash.imageset/splash-2732x2732*.png` | erzeugt: Grund `#080b13`, Hoku mittig (22 % der kurzen Kante) |
| Android Launcher | `mipmap-*/ic_launcher(_round).png` | erzeugt aus `hoku-app-blau-original-1254.png` |
| Android adaptiv | `mipmap-*/ic_launcher_foreground.png`, Hintergrund `#080b13` | erzeugt, Kugel ~58 % von 108 dp |
| Android Startbildschirm | `drawable*/splash.png` | erzeugt wie iOS |
| Web Home-Bildschirm | `public/icons/hoku-180.png` | Kit `hoku-app-blau-180.png` |
| Web Manifest | `public/icons/hoku-192/512.png`, `hoku-maskable-512.png` | Kit blau 192/512 |
| Favicon | `public/favicon.ico` (16/32/48/64), `icons/hoku-favicon-32/48/64.png`, `favicon.svg` | Kit-Favicons (einfarbig, wie im Kit festgelegt) |
| Benachrichtigungen | `public/icon-192.png`, `icon-512.png`, `icon.svg` | Kit blau |

Vorher: das Codex-Bild (`docs/logo/dot/codex`) als `icons/dot-codex-*` – entfernt. Die Startbildschirme zeigten noch das
Capacitor-Standardkreuz auf Weiß. Nicht geändert: Name der App/Web-App und Dots Logo in der Tab-Leiste (`DotLogo.tsx`).
