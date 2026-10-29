# HOKU – Schriftzug-Kit (29.10.2026)

Nutzer: „Ja, Hoku bauen“, dann „groß“. App und Maskottchen heißen **Hoku** (hawaiianisch
„Stern“), weil „Dot“ in der EU markenrechtlich blockiert ist (siehe
`memory/projects/ki-coach.md`, Abschnitt „Name der App“). Der Schriftzug ist **HOKU** in dünnen,
weit gesperrten Versalien; **das O ist Dots Kugel**. Das App-Icon bleibt die Kugel
(`docs/logo/dot/kit/`).

## Wie es entsteht
- `kit.cjs` baut alles (`node docs/logo/hoku/kit/kit.cjs`, braucht installiertes Chrome).
  Die Kugel kommt aus dem echten Renderer `docs/logo/dot/echt/dot-icon.html`.
- Einfarb-Varianten: `export_variants.py` aus dem Skill `logo-design` (Befehl unten).
- Konzepte davor: `docs/logo/hoku/schriftzug/` (klein „hoku“, Vektorfassung).

## Aufbau
- Feld 540 × 256, Versalhöhe 120 (y 68–188), Strich 7, eckige Enden.
- H 20–100 · O Mitte 200 · K 300–400 (Arm und Bein genau 45°) · U 440–520.
- O optisch größer als die Versalhöhe: Vektor 4 % (Überhang runder Formen), leuchtend 10 %
  (der weiche Rand frisst Größe).
- Kleinfassung: Strich 16, O als volle Scheibe – unter 24 px Höhe zerfallen die Punkte.

## Dateien
| Datei | Zweck |
|---|---|
| `hoku-wortmarke-leuchtend-1024/512/256.png` | **Hauptfassung**, transparent, für dunklen Grund (Website, Splash, Store-Grafiken, Social) |
| `hoku-wortmarke.svg` | Vektor-Master schwarz (Kugel aus 315 Punkten) – Druck, Prägung, heller Grund |
| `hoku-klein.svg`, `hoku-klein-leuchtend-128.png` | Kleinfassung unter 24 px Höhe |
| `varianten/` | Schwarz, Weiß, Cyan `#6ee6ff` als SVG und PNG (Master 1200, klein 400) |
| `hoku-lockup-schwarz.png`, `-transparent.png` | Icon + Schriftzug (Website-Kopf, Pressebild) |
| `uebersicht.png` | alles auf einen Blick |

## Regeln
- **Schreibweise:** Das Logo ist HOKU in Versalien. In Texten, im App Store und wenn die Figur
  spricht: „Hoku“ („Frag Hoku“, „Hoku – Biohacking Tracker“).
- **Schutzraum:** rundum mindestens der Radius des O (≈ halbe Versalhöhe) frei.
- **Mindestgrößen:** Hauptfassung ab 32 px Höhe; 16–24 px nur die Kleinfassung; kleiner nicht.
- **Grund:** Leuchtfassung nur auf Schwarz oder sehr dunklem Grund (`#000`, `#05060a`, `#0b0c0e`).
  Auf hellem Grund oder auf Fotos die einfarbige Vektorfassung.
- **Farben:** Buchstaben weiß (dunkel) bzw. schwarz (hell); Farbe trägt nur die Kugel
  (Cyan `#6ee6ff` → Violett `#af87ff`, Pink `#ff78c8` unten). Einfarbig auch ganz in Cyan.
- **Lockup sparsam:** Icon und Schriftzug zeigen beide die Kugel; zusammen nur, wo das Icon
  wirklich gebraucht wird (Website-Kopf, Presse). Sonst der Schriftzug allein.
- **Nicht:** Buchstaben einfärben oder mit Verlauf füllen, Sperrung ändern, das O durch einen
  normalen Buchstaben ersetzen, die Kugel verzerren oder drehen, Schatten/Kontur hinzufügen,
  Leuchtfassung auf hellem Grund.

## Geprüft (Skill `logo-design`)
- `svg_audit`: Kleinfassung 99/100; Vektor-Master 82/100 – einzige Warnungen sind die 315
  Kugelpunkte (bewusst, das ist Dot) und dass sie unter 32 px verschwinden → Kleinfassung.
- Größenleiter 96 → 16 px auf Schwarz und Hell, Einfarbig auf Hell, Schwarz und Cyan: angesehen.

## Varianten neu erzeugen
```
python .claude/skills/logo-design/scripts/export_variants.py docs/logo/hoku/kit/hoku-wortmarke.svg --title "HOKU" --only black white mono --mono "#6ee6ff" --out-dir docs/logo/hoku/kit/varianten --png 1200
python .claude/skills/logo-design/scripts/export_variants.py docs/logo/hoku/kit/hoku-klein.svg --title "HOKU klein" --only black white mono --mono "#6ee6ff" --out-dir docs/logo/hoku/kit/varianten --png 400
```

## Offen
- In App, Code und Texten heißt alles noch „Dot“ – Umbenennung ist ein eigener Schritt.
- Website-/Splash-Einbau, Store-Grafiken, Social-Profilbilder.
- Markenanmeldung (Wort- und Bildmarke Kl. 9/42) nach Rücksprache mit Anwalt (HOKO, hoki).
