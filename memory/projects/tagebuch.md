# Tagebuch — Formular v2

Stand: 2026-10-18. Vorbild: Chip-Auswahl wie in Zyklus-Apps (Flo), angepasst.

## Entschieden

- **Ein Eintrag kann einer angelegten Substanz zugeordnet werden** (freiwillig,
  Entscheidung 2026-10-19). Darin werden
  mehrere Wirkungen und Nebenwirkungen als Chips gewählt — ein Eintrag, viele Chips.
- **Umschalter Wirkung/Nebenwirkung entfällt.** Die Art ergibt sich aus dem Chip:
  der Katalog hat zwei Blöcke, mehrdeutige Dinge werden je Block eindeutig
  benannt (z. B. „Weniger Hunger" = Wirkung, „Appetitlosigkeit" = Nebenwirkung).
- **Titel** steht ganz oben und ist **Pflicht** (ersetzt die Freitext-Beschreibung).
  Speichern braucht Titel + mindestens einen Chip.
- **Datenmodell:** eigene Tabelle für Chips (eine Zeile pro Chip); Chips als
  fester Schlüssel (`nausea`), Namen de/en aus der Übersetzung.
- **Alte Tagebuchdaten sind laut Nutzer simuliert:** keine Migration, sondern
  löschen und im neuen Format neu simulieren (Zustimmung 2026-10-19). Stand
  Zählung: 58 Zeilen in `effects` bei 4 von 14 Konten (30/25/2/1), 2025-10-18
  bis 2026-09-29. Ablauf trotzdem nach CLAUDE.md (Datei, Trockenlauf, zählen).
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
- **Migration Schritt 1 erledigt (2026-10-19):** `supabase-tagebuch-chips.sql` –
  Tabelle `effect_symptoms` (effect_id, user_id, kind, symptom_key | custom_label,
  severity 1–5, duration_minutes, ongoing, position) mit RLS „Own effect symptoms",
  Eigentümer-Trigger (Execute entzogen), Katalog-Chip je Eintrag eindeutig;
  `effects.type`/`severity` dürfen leer sein. Trockenlauf 2× + Funktionstests OK,
  in Produktion angewendet: 58 effects unverändert, 0 Chips.
  `supabase-tagebuch-reset.sql` (löscht alle effects) liegt bereit, **noch nicht
  ausgeführt** – erst mit neuen Testdaten im neuen Format.
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
  Streuung 37 % → 11 %. Knötchen danach neu: Oberkörper-Grundform mit festem
  Knoten (Variante K-a, Gewicht 1,07, 0 Ausreißer); Alternative K-b Hautquerschnitt.
- **Barrierefreiheit (2026-10-19, accessibility-review, WCAG 2.1 AA):** Kontraste
  der Symbole/Chips/Zahlen OK. Offen: Picker-Rad nicht per Tastatur bedienbar
  (kritisch); Chip-Editor ohne Fokusführung/Escape; Tabs ohne Pfeiltasten und
  aria-controls; Art nur über Farbe in Liste/Suche – grün/orange bei Rot-Grün-
  Schwäche ≈ gleich (1,07–1,28:1) → zusätzliches Formzeichen; roter Fleck vs.
  oranger Linie 1,7:1; Kontrast „sehr leicht/stark“ 3,7:1 und Dauer im gewählten
  Chip 4,47:1; Tippflächen 34–40 px (< 44).
  **Alles umgesetzt im Mockup (2026-10-19):** Picker-Rad als `spinbutton`
  (Pfeile, Bild auf/ab, Pos1/Ende); Art-Kennzeichen (2026-10-19 nach Skizze des
  Nutzers, ersetzt ＋/−): Symbol oben links über dem Rahmen, Intensität oben rechts
  als geschlossener Kreis auf der Linie, Rahmen wölbt sich unten links zu einem
  Kreis, darin ein Ring mit ＋ (Wirkung) bzw. − (Nebenwirkung) (`framedChip`); Art auch in der Ansage; Editor und Info mit Fokus
  hinein, Tab-Falle, Escape, Fokus zurück zum Öffner; Tabs mit Pfeiltasten,
  `aria-controls`/`tabpanel`; Tippflächen 44 px über unsichtbare Fläche
  (`.tyd-hit`); `aria-haspopup="dialog"` an Chips und „i“; dunkler Ring um den
  roten Fleck; „sehr leicht/stark“ und Dauer auf 62 % (5,7:1 / 5,2:1).
  Nicht mit echtem VoiceOver/Gerät getestet.

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
