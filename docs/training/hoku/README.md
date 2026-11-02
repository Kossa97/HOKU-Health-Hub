# Trainingsabschluss: Silo und Hoku trägt – Entwürfe

Stand 29.10.2026. Nur Entwürfe (Artefakte), nicht Teil der App, werden nicht ausgeliefert.
Entscheidungen und offene Punkte stehen auch in `memory/projects/workouttracker.md`.

## Dateien

| Datei | Was | Live |
|---|---|---|
| `volumen-silo.html` | Silo wächst mit dem Volumen (1–30 t), Scheiben mit Physik (Matter.js), Teilen | https://claude.ai/artifact/MGkfvzxB1nysjytcuajLSf |
| `silo-rueckblick.html` | Abschluss Satz für Satz, Glas-Silo, Skala je Übung, Eisen/Neon, 5 Teilen-Varianten | https://claude.ai/artifact/AnzdAMmN3s8wQ5bQyfwGWB |
| `hoku-traegt.html` | Hoku trägt die Scheiben (Physik) – verworfen, Scheiben „sehen doof aus“ | https://claude.ai/artifact/EiC4EepENnk4evu1mi7Ahd |
| `hoku-poster.html` | **Aktuelle Richtung:** Poster am Trainingsende, Hoku trägt Gegenstände nach Gewicht | https://claude.ai/artifact/YUdrjVjDrjDmT7QMvcYWZx |
| `hoku-arme.html` | Baustein: Hokus Muskelarme aus Punkten, Federphysik, Last-Regler | https://claude.ai/artifact/Tvc27dech6tc8ALHzoXusn |
| `obj-bus.png` | Bus, hier gerendert aus `render/models/bus.glb` | – |
| `mockup-v2/` | Quelle des Design-Canvas „TYD Training v2“ (Logger, Editor, Scheiben legen) | https://claude.ai/artifact/Rg8Myea78FVk1qbp4JvLvX |
| `render/` | Render-Strecke: glTF → PNG mit Alphakanal, feste Studio-Beleuchtung | – |

Lokal ansehen: Die HTML-Dateien sind Artefakt-Seiten ohne `<html>`-Gerüst. Zum Testen
in ein Gerüst legen und über einen lokalen Server öffnen (`python3 -m http.server`),
sonst sperrt der Browser das Exportieren des Canvas mit Bildern (file://).

## Entscheidungen des Nutzers (Verlauf)

1. Gewicht veranschaulichen: Scheiben stapeln → dunkle Bühne mit Studiolicht → Frontansicht, Gusseisen.
2. Turm zu hoch → großer Behälter (Silo), Physik, 30 t pro Training, darüber zweites Silo.
3. Silo wächst mit dem Inhalt, Scheiben rutschen beim Wachsen nach; teilbar als Bild/Wasserzeichen.
4. Silo füllt sich automatisch Satz für Satz am Ende, Tippen = nächster Satz sofort.
5. Schichten je Übung: Beschriftung im Haufen passt nie → Skala senkrecht neben dem Silo.
   Farbe nur beim Auswählen. Stahlsilo + orange Hervorhebung gefiel besser als Glas/Neon-Cyan.
6. **Hoku** (früher „Dot“, KI-Assistent der App, Punktkugel – `src/features/dot/` auf `main`)
   trägt das Gewicht, verformt sich, bekommt riesige Arme.
7. Keine Scheiben, sondern **Gegenstände** nach Gewicht, proportional zueinander.
   Keine Animation nötig: **ein Bild am Trainingsende**.
8. Gegenstände als **realistische, hochwertige gerenderte PNGs**; Hoku bleibt Hoku (Licht),
   Grafikstile heben sich voneinander ab. Weg: fertige 3D-Modelle laden und hier rendern.
9. Arme: kommen **aus Hoku heraus**, viel größer als Hoku (unproportional), sehr detailliert,
   Muskeln, Physik.

## Offen

- **Stil der Modelle:** Bus (HCR2) ist comichaft. Entscheidung offen: alles stilisiert
  (Spielzeug-Diorama, Empfehlung) oder alles realistisch. Nicht mischen.
- **Weitere Modelle** (vom Nutzer zu laden, GLB mit 4k-Texturen, Lizenz CC0/CC BY):
  Elefant 6 t, Nashorn 2,3 t, Kleinwagen 1 t, Konzertflügel 500 kg, Motorrad 200 kg,
  Waschmaschine 70 kg, Hantelscheibe 20 kg. Sketchfab ist aus der Cloud-Umgebung nicht
  erreichbar (nur GitHub), daher lädt der Nutzer und lädt hoch.
- **Arme:** Pose und Physik stehen; Muskeldefinition aus Punkten allein reicht nicht.
  Nächster Schritt: jede Muskelgruppe als eigene beleuchtete Form (Kern, Rand,
  Trennlinie), Punkte nur als Material darauf. Dann Arme ins Poster übernehmen.
- „Bild speichern“ nutzt die Artefakt-Fähigkeit `downloads`; in der App wird das
  System-Teilen (Capacitor Share) daraus.

## Rendern (`render/`)

```
cd docs/training/hoku/render
mkdir -p lib hdr && (cd lib && npm pack three@0.170.0 && tar xzf three-0.170.0.tgz)
curl -o hdr/studio.hdr https://raw.githubusercontent.com/mrdoob/three.js/r170/examples/textures/equirectangular/royal_esplanade_1k.hdr
node render.js bus.glb out.png 270 8 2048   # Modell, Ausgabe, Drehung (Grad), Neigung, Größe
```

Drehung so wählen, dass die Seitenansicht nach links schaut (beim Bus 270). Danach das
PNG auf den Inhalt zuschneiden (PIL `getbbox`). Benötigt Playwright mit Chromium.

## Lizenzen

| Modell | Autor | Lizenz | Pflicht |
|---|---|---|---|
| HCR2 Bus (`render/models/bus.glb`) | oakar258 (Sketchfab) | CC BY 4.0 | Nennung in der App |
| Studio-HDRI (wird geladen, nicht im Repo) | Poly Haven „Royal Esplanade“ über three.js | CC0 | – |
| Matter.js 0.19 (CDN) | liabru | MIT | – |
