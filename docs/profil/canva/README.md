# Link-Karten als Canva-Vorlage

**`hoku-link-karten.pptx`** – freigegeben am 03.11.2026, gebaut aus `../mockups/profil-2c-karten-auswahl.html`.
Jede Folie ist eine Link-Karte in 1200 × 630 px (Open-Graph-Bild).

| Folie | Karte |
|---|---|
| 1 | **Fortschritt**: Hauptlogo unten Mitte (Cyan), „Seit 7 Monaten dabei“, „1.240 Einträge“, „trackt 9 Werte“, „über 30 %“ |
| 2 | **Rückfall**: Hoku unten rechts (B1), Kompaktlogo weiß, „Mehr als nur Tracking.“ |
| 3 | **Neutral**: Hoku links (B3), Hauptlogo weiß, „Sieh, wer du wirst.“ |
| 4–6 | Varianten: Fortschritt mit Abzeichen, Fortschritt mit Titel (künftig), Rückfall mit Ersatztext |

In den Notizen jeder Folie stehen, wann die Karte erscheint, der englische Text und die Regeln aus dem Brand-Guide.

Archiv: `hoku-link-karten-fassung2-varianten.pptx` (20 Folien, alle Logo-Varianten B1–B6 aus Fassung 2).

## In Canva öffnen

Canva → **Erstellen** → **Importieren** → `hoku-link-karten.pptx` auswählen. Jedes Element ist einzeln bearbeitbar: Texte, Logos, Bildmarke, Linien, Knopf, Profilbild-Kreis (Foto hineinziehen), Titel-Marke und Hintergrund (Hoku-Licht als Bild, am besten sperren).

- Schriften: Space Grotesk (Name, Zahlen, Überschriften), Inter und Inter Kursiv (Fließtext), IBM Plex Mono („Über Hoku“, Titel, Adresse). Fehlt eine in Canva, ersetzt Canva sie; dann bitte von Hand wählen.
- Falls Canva das Format nicht als 1200 × 630 px übernimmt: **Größe ändern** → 1200 × 630 px.
- Die große Zahl „30 %“ ist in Canva etwas breiter als im Mockup. Das Trend-Symbol daneben bei Bedarf nachrücken.
- Halbtransparente Schriftfarben sind als feste Farben auf dem Grund #0f1116 gemischt.
- Logos aus `docs/logo/hoku/brand-kit-v2`: Cyan (01/02 cyan-schrift-weiss) und monochrom weiß (01/02 weiss), je 1200 px; Bildmarke 1024 px. Nicht größer ziehen, nicht färben oder verzerren.

## Neu erzeugen

In `quelle/`: `extract3.cjs` liest die Karten per Playwright aus dem Mockup (`window.HOKU`), `build3.cjs` baut daraus die pptx (pptxgenjs, sharp), `dedupe.py` legt doppelte Bilder nur einmal ab. `extract.cjs` und `build.cjs` gehören zur Fassung 2.
