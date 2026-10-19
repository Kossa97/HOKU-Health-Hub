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
  Herzrasen / Racing heart · Hitzewallung / Flushing · Müdigkeit / Fatigue ·
  Benommenheit / Brain fog
- **Schlaf:** Schlechter geschlafen / Slept worse · Einschlafprobleme / Trouble falling asleep ·
  Lebhafte Träume / Vivid dreams
- **Körper:** Wassereinlagerung / Water retention · Kribbeln oder Taubheit / Tingling or numbness ·
  Gelenkschmerzen / Joint pain · Muskelkrämpfe / Muscle cramps · Mehr Hunger / Increased hunger
- **Haut & Stimmung:** Akne / Acne · Hautausschlag / Rash · Gereiztheit / Irritability ·
  Gedrückte Stimmung / Low mood · Innere Unruhe / Restlessness
- **Libido:** Weniger Libido / Lower libido
- Eigene Nebenwirkung … / Custom side effect …
