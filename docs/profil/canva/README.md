# Link-Karten als Canva-Vorlage

`hoku-link-karten.pptx`: 20 Folien, jede eine Link-Karte in 1200 × 630 px (Open-Graph-Bild), aus dem Karten-Mockup Fassung 2 (`../mockups/profil-2c-karten.html`).

| Folien | Inhalt |
|---|---|
| 1–3 | gewählt: A1, C und neutral mit Hauptlogo (H) |
| 4–9 | A1 mit Bildmarke B1–B6 |
| 10–15 | C mit Bildmarke B1–B6 |
| 16–20 | neutral mit Bildmarke B1–B4, B6 |

B-Varianten mit kleinem Logo. Sie sind laut Brand-Guide noch nicht freigegeben (Anschnitt, Profilbild vor der Bildmarke, 20 % Deckkraft).

## In Canva öffnen

Canva → **Erstellen** → **Importieren** → `hoku-link-karten.pptx` auswählen. Jedes Element ist einzeln bearbeitbar: Texte, Logos, Bildmarke, Linien, Knopf, Profilbild-Kreis (Foto hineinziehen) und Hintergrund (Hoku-Licht als Bild, am besten sperren).

- Schriften: Space Grotesk (Name, Zahlen, Überschriften), Inter (Fließtext), IBM Plex Mono (Adresse, „Über Hoku“). Alle drei gibt es in Canva. Fehlt eine, ersetzt Canva sie. Dann bitte von Hand wählen.
- Falls Canva das Format nicht als 1200 × 630 px übernimmt: **Größe ändern** → 1200 × 630 px.
- Halbtransparente Schriftfarben sind als feste Farben auf dem Grund #0f1116 gemischt.
- In den Notizen jeder Folie stehen die Variante, die anderen C-Texte bzw. Slogans und die Regeln aus dem Brand-Guide.
- Logos stammen aus `docs/logo/hoku/brand-kit-v2` (Hauptlogo und Kompaktlogo 1200 px, Bildmarke 1024 px). Nicht größer ziehen als die Datei, nicht färben oder verzerren.

## Neu erzeugen

In `quelle/`: `extract.cjs` liest die Karten per Playwright aus dem Mockup aus, `build.cjs` baut daraus die pptx (pptxgenjs, sharp), `dedupe.py` legt doppelte Bilder nur einmal ab.
