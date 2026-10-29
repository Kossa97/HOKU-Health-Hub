# App-Icon: Dot von Codex (29.10.2026)

Nutzer: „Dieses Logo hat Codex erstellt, es ist perfekt, ändere alle Logos der App in dieses um.“
Es ersetzt das gerenderte Icon aus `docs/logo/dot/echt` (Fassung 2) überall in der App.

- Quelle: `dot-codex.webp`, 1254 × 1254 px, Kugel mittig, 68 % der Breite, Grund `#060911`.
- Export: `python3 -I docs/logo/dot/codex/export.py $PWD` schreibt alle Dateien.
- Eingebaut: iOS `AppIcon-512@2x.png` (1024); Android `mipmap-*` (eckig, rund, adaptiver Vordergrund:
  Bild auf 85 % mit weichem Rand, Kugel bei ~58 % in der sicheren Zone) und Hintergrund `#060911`;
  Web `public/icons/dot-codex-{32,180,192,512,maskable-512}.png` (neue Namen gegen alte Zwischenspeicher),
  `icon-192/512.png` (Benachrichtigungen), `icon.svg`, `favicon.svg`; Manifest-Hintergrund `#060911`.
- Favicon 32 px: Ausschnitt um die Kugel (sie füllt 80 %), sonst wäre sie zu klein.
- Grenze: Das Bild ist ein Raster mit 1254 px. Für die Icons reicht das (größte Datei 1024 px);
  für Druck oder Social-Formate über 1254 px müsste es hochskaliert oder neu erzeugt werden.
- Nicht geändert: Dots Logo in der Tab-Leiste (`src/features/dot/DotLogo.tsx`, 30 px als SVG gezeichnet).
