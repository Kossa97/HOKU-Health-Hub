# Tagebuch — Formular v2

Stand: 2026-10-18. Vorbild: Chip-Auswahl wie in Zyklus-Apps (Flo), angepasst.

## Entschieden

- **Ein Eintrag gehört zu einer angelegten Substanz** (Pflicht). Darin werden
  mehrere Wirkungen und Nebenwirkungen als Chips gewählt — ein Eintrag, viele Chips.
- **Umschalter Wirkung/Nebenwirkung entfällt.** Die Art ergibt sich aus dem Chip:
  der Katalog hat zwei Blöcke, mehrdeutige Dinge werden je Block eindeutig
  benannt (z. B. „Weniger Hunger" = Wirkung, „Appetitlosigkeit" = Nebenwirkung).
- **Titel** steht ganz oben (ersetzt die bisherige Freitext-Beschreibung).
- **Intensität 1–5 und Dauer je Chip.** Antippen eines Chips öffnet den
  **Chip-Editor** (eigenes kleines Sheet über dem Formular): Intensität 1–5 und
  Dauer als Picker-Rad im Apple-Stil (Zahl + Einheit, dazu „hält noch an").
  Die Werte stehen danach am Chip: Intensität als kleine Zahl am Rahmen, Dauer
  kurz im Chip.
- **Tabs Wirkungen | Nebenwirkungen** über den Chips (mit Zahl der gewählten),
  zusammen mit Suche und Info-Knopf oben festgehalten beim Scrollen. Suche
  zeigt beide Arten. Titel, Substanz und Zeitpunkt in einer Gruppe.
- **Info-Knopf (i)** öffnet eine Erklärung mit Grafik: Aufbau eines Chips
  (A Name, B Dauer, C Intensität, D Farbe = Art) und Beispielzustände.
- **Symbole:** jeder Chip hat links ein Lucide-Symbol (die App nutzt
  `lucide-react`) in einer runden, in der Art-Farbe getönten Scheibe; gewählt
  kräftiger getönt. Zuordnung im Mockup (`ICON_OF`), erste Fassung.
- Mockup: https://claude.ai/artifact/1f5afzwrMim3P6FK2xjfM2
- **Symbolsatz offen:** Lucide oder Health Icons (MIT, healthicons.org). Health
  Icons decken 38 von 54 Chips ab; 11 weitere aus Material Symbols (Apache 2.0:
  Schlaf, Haut, Libido) und Health Icons (traumatism, measles, intestinal-pain).
  Eigene Entwürfe für die Lücken vom Nutzer verworfen. Nachrecherche über alle
  248 Iconify-Sammlungen: Einschlafprobleme = iconoven:insomnia (Auge + Mond),
  Aufstoßen = iconoven:sore-throat, Knötchen = iconoven:acne-spot (alle MIT).
  Rötung und Schwellung: kein freies Symbol gefunden; auf Nutzerwunsch eigene
  Varianten auf der Oberkörper-Grundform (wie Brustspannen) mit Nabel: Rötung mit
  echtem rotem Fleck (#ff5c50, Hof 30 %), Schwellung mit getönter Wölbung.
  Schulter-Varianten liegen als Alternative vor.
  TRT-Nebenwirkungen ergänzt (Ölige Haut, Haarausfall, Brustspannen, Nachtschweiß,
  Hoden kleiner, Blutdruck erhöht); Vorauswahl O2/H2/B1/N1/T1/D1, Hitzewallung
  dafür auf healthicons:fever. Brustspannen = hugeicons:body-part-six-pack ohne Bauch
  plus Spannungsstrahlen unter der Brust (Variante Bd), Hoden kleiner = lucide:mars
  mit kleinerem Kreis (r 3 statt 6, Variante Tb) – beides auf Wunsch abgewandelt
  und vom Nutzer abgenommen (2026-10-19). Ein eigenes Biohacking-/TRT-Symbolset gibt es nicht. Durchsucht: Health Icons, Material
  Symbols, Fluent, Phosphor, MDI, Tabler, Medical Icons, IconPark, Streamline.
- Stimmung/Energie/Libido als Tageswert bleiben in `daily_logs`; im Tagebuch
  nur als Wirkung einer Substanz.

## Offen

- Chip-Editor im Detail: Pflichtangaben, Verhalten beim Wegwischen, Entfernen
  (Vorschlag in der Antwort vom 2026-10-18).
- Titel Pflicht oder optional (Vorschlag: optional, Platzhalter aus Substanz + Datum)?
- Datenmodell: Kindtabelle für Chips (`effect_id, symptom_key, custom_label,
  kind, severity, duration_minutes, ongoing`). Alte Einträge: Beschreibung → Titel, ein
  eigener Chip mit bisheriger Art und Intensität. Migration nach CLAUDE.md-Ablauf.
- Auswertung (`src/pages/tagebuch/stats.ts`) zählt dann nach `symptom_key`.
- Chip-Katalog (Entwurf unten) gegenlesen.
- **Symbol-Audit (2026-10-19, design-system):** 43 Health Icons (Fläche, 48er,
  Strich ≈0,9 px), 8 Material Symbols (Fläche, 24er, ≈1,75 px – zu schwer),
  9 Linien-Symbole (24er, ≈1,3 px). 19 von 60 Ausreißer beim optischen Gewicht
  (Median ±): zu schwer u. a. Gelenkschmerzen, Mehr Ausdauer, Weniger Libido,
  Bessere Konzentration, alle Material; zu leicht Knötchen, Besserer Pump,
  Wassereinlagerung, Schneller satt, Mehr Libido, Hoden kleiner. Maßnahmen:
  Material → material-symbols-light, Linien-Strich auf ≈1,0 px, Größe je Symbol
  optisch angleichen, Ausreißer tauschen. Umgesetzt im Mockup: 6 Material-Symbole
  auf material-symbols-light (Schneller eingeschlafen, Bessere Haut gibt es dort
  nicht), Linien-Strich 1,6 → 1,2 (≈1,0 px), Faktor je Symbol (`OPTICAL`,
  0,78–1,28, max. 21 px in der 30-px-Scheibe). Ergebnis: Ausreißer 19 → 1,
  Streuung 37 % → 11 %. Rest: Knötchen (0,55, flaches Motiv) – tauschen?

## Chip-Katalog — Entwurf (de / en)

### Wirkungen
- **Energie & Kopf:** Mehr Energie / More energy · Bessere Konzentration / Better focus ·
  Klarer Kopf / Clear head · Bessere Stimmung / Better mood · Weniger Stress / Less stress
- **Schlaf:** Besser geschlafen / Slept better · Schneller eingeschlafen / Fell asleep faster ·
  Erholter aufgewacht / Woke up rested
- **Training & Körper:** Mehr Kraft / More strength · Mehr Ausdauer / More endurance ·
  Schnellere Erholung / Faster recovery · Besserer Pump / Better pump ·
  Weniger Gelenkschmerzen / Less joint pain
- **Appetit & Gewicht:** Weniger Hunger / Less hunger · Weniger Heißhunger / Fewer cravings ·
  Schneller satt / Full sooner · Weniger Wassereinlagerung / Less water retention
- **Haut & Heilung:** Bessere Haut / Better skin · Schnellere Wundheilung / Faster healing
- **Libido:** Mehr Libido / Higher libido
- Eigene Wirkung … / Custom effect …

### Nebenwirkungen
- **Einstichstelle:** Rötung / Redness · Schwellung / Swelling · Juckreiz / Itching ·
  Knötchen / Lump · Bluterguss / Bruise · Brennen beim Spritzen / Stinging on injection
- **Verdauung:** Übelkeit / Nausea · Erbrechen / Vomiting · Sodbrennen / Heartburn ·
  Aufstoßen / Burping · Blähungen / Bloating · Verstopfung / Constipation ·
  Durchfall / Diarrhea · Appetitlosigkeit / Loss of appetite
- **Kopf & Kreislauf:** Kopfschmerzen / Headache · Schwindel / Dizziness ·
  Herzrasen / Racing heart · Blutdruck erhöht / High blood pressure · Hitzewallung / Flushing · Müdigkeit / Fatigue ·
  Benommenheit / Brain fog
- **Schlaf:** Schlechter geschlafen / Slept worse · Einschlafprobleme / Trouble falling asleep ·
  Lebhafte Träume / Vivid dreams · Nachtschweiß / Night sweats
- **Körper:** Wassereinlagerung / Water retention · Kribbeln oder Taubheit / Tingling or numbness ·
  Gelenkschmerzen / Joint pain · Muskelkrämpfe / Muscle cramps · Mehr Hunger / Increased hunger ·
  Brustspannen / Breast tenderness · Hoden kleiner / Smaller testicles
- **Haut & Stimmung:** Akne / Acne · Ölige Haut / Oily skin · Haarausfall / Hair loss · Hautausschlag / Rash · Gereiztheit / Irritability ·
  Gedrückte Stimmung / Low mood · Innere Unruhe / Restlessness
- **Libido:** Weniger Libido / Lower libido
- Eigene Nebenwirkung … / Custom side effect …
