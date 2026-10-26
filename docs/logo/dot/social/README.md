# Dot für Social Media

Erzeugt mit `docs/logo/dot/echt/social.cjs` aus demselben Renderer wie das App-Icon
(Dot wie in `dotEngine.ts`, Zustand „Sprechen“). Gerendert wird bis 8192 px (Grenze von
WebGL) und dann schrittweise verkleinert. Die PNGs liegen nicht im Repo (zusammen
etwa 130 MB), sie entstehen neu mit:

```
npm ci
PW_CHROMIUM=<Pfad zu Chromium, falls Playwright keinen eigenen Browser hat> node docs/logo/dot/echt/social.cjs $PWD
```

| Datei | Größen | Wofür |
|---|---|---|
| `dot-quadrat-*` | 8192, 4096, 2048, 1080 | Master, Instagram-Post 1:1, Druck |
| `dot-transparent-*` | 8192, 4096, 2048 | ohne Hintergrund, für eigene Gestaltung (nur auf dunklem Grund, die Punkte leuchten additiv) |
| `dot-profilbild-*` | 2048, 1080 | Profilbild; Kugel etwas größer, hält den Kreisschnitt |
| `dot-hochformat-4x5-*` | 2160×2700, 1080×1350 | Instagram-Post hoch |
| `dot-story-9x16-*` | 2160×3840, 1080×1920 | Story, Reel-Cover, TikTok |
| `dot-banner-3x1-*` | 3000×1000, 1500×500 | Header für X, Website |

Instagram speichert höchstens 1080 px Breite; die größeren Fassungen sind für Druck,
Website und Plattformen, die mehr annehmen.
