# Hoku-Rundflug im Injektionstracker — Design

Stand 04.11.2026, gemeinsam mit dem Nutzer geplant (Sitzung vom 03./04.11.).
Markierungen: **[Nutzer]** = vom Nutzer so entschieden, **[Claude]** = von Claude
vorgeschlagen und vom Nutzer bestätigt, **[offen]** = erst nach dem Mockup
entschieden, **[Bauende]** = bewusst dem Bauenden überlassen.

## Absicht

Beim Öffnen des Injektionstrackers zeigt Hoku die Injektionen der **letzten
3 Tage**: Er fliegt um den Torso, hält an jeder Stelle kurz an, sie leuchtet auf,
und er sagt, was wo injiziert wurde und wie lange es her ist. Am Ende nennt er,
wo frei ist. **[Nutzer]**

Vorbild ist der Rundflug im Kalorientracker (Variante B „Halt an jedem Körper“,
`src/features/ernaehrung/hooks/useDotRundflug.ts`, `lib/dotRundflug.ts`, Notiz in
`memory/projects/ki-coach.md` „Rundflug im Kalorientracker“). Die Engine hat dafür
schon die Schnittstelle `Rundflug` (`src/features/dot/engine/dotEngine.ts`).

## Ablauf

| Situation | Ablauf |
|---|---|
| **Voller Rundflug** | Hoku kommt vom linken Rand. Die Kamera kreist auf dem **kürzesten Weg** um den Torso und bringt jeden Pin der letzten 3 Tage nach vorn; Hoku hält daneben an, der Pin leuchtet auf, Hoku sagt z. B. „Bauch rechts / vor 1 Tag“. Am Ende: „Frei: Oberschenkel links, / Bauch links“. Danach fährt die Kamera in die Ganzansicht, das Leuchten blendet weich aus, nichts bleibt angewählt. **[Nutzer]** |
| **Dazwischen** | Kurze Runde um den Torso ohne Halt und ohne Sätze, dann setzt sich Hoku. **[Nutzer]** |
| **Keine Injektion in 3 Tagen** | Kurze Runde, dazu der Satz „3 Tage keine Injektion / alles frei“. **[Nutzer]** |

## Entscheidungen

- **Häufigkeit:** wie im Kalorientracker — voller Rundflug nach **2 h** oder beim
  **3. Öffnen** seit dem letzten vollen; sonst die kurze Runde. Eigener Schlüssel
  (z. B. `tyd.dot.rundflug.injektion.v1` = `{t, n}`), nicht der des
  Kalorientrackers. **[Nutzer]**
- **Rückseite:** Die **Kamera dreht mit**, damit auch Pins auf der Rückseite
  (Gesäß) nach vorn kommen. Hoku bleibt im Bild vorn, er fliegt nicht „hinter“ den
  Torso. **[Nutzer]**
- **Reihenfolge:** kürzester Weg um den Torso (nach Blickwinkel sortiert), nicht
  nach Zeit. Die Zeit steht ja in jedem Satz. **[Nutzer]**
- **Sätze:** je Stelle „Region Seite / vor N Tagen“ (heute, gestern, vor N Tagen),
  am Ende die freien Stellen. **[Nutzer]**
- **Freie Stellen:** nur aus **Regionen, die der Nutzer sonst benutzt** (aus seinem
  Verlauf), und davon die **zwei, die am längsten frei** sind. Kandidaten sind die
  festen Stellen aus `src/lib/injectionSitePresets.ts`. **[Nutzer]**
- **Danach:** Leuchten blendet weich aus, Pins bleiben normal sichtbar, nichts
  angewählt, Kamera in der Ganzansicht. **[Nutzer]**
- **Hintergrund:** Studio-Schwarz in jedem Erscheinungsbild, Licht überall Studio
  (umgesetzt 04.11.2026). **[Nutzer]**

## Feste Regeln

- **Jede Berührung oder Eingabe bricht sofort ab** (Kamera bleibt stehen, wo sie
  ist; Leuchten aus; Hoku setzt sich). Hoku blockiert nie. **[Claude]**
- **Weniger Bewegung** (`prefers-reduced-motion`): kein Flug, keine Kamerafahrt; die
  Sätze erscheinen als Text, wie beim Login. **[Claude]**
- Sätze gehen zusätzlich an Screenreader. **[Claude]**
- **Höchstens zwei kurze Zeilen** je Satz. **[Claude]**
- **Höchstens 4 Halte**, die jüngsten; der ganze Rundflug unter 10 s. **[Claude]**
- „Frei“ heißt nur: in 3 Tagen nicht benutzt. **Keine medizinische Empfehlung**,
  Hoku sagt nicht „empfohlen“. **[Claude]**
- Texte nur de/en; neue Schlüssel in den zwölf übrigen Sprachen mit englischem
  Platzhalter (CLAUDE.md). **[Claude]**
- Läuft nicht, solange ein Sheet offen ist, der Tracker per Direktlink mit einer
  Einnahme geöffnet wurde (dann geht es um das Setzen einer Stelle) oder die Daten
  noch laden. **[Claude]**

## Technik (Skizze)

- Ein Zeitplan (Halte mit Kamerazielen und Haltezeiten) aus den Pins der letzten
  3 Tagen, als reine Funktion mit Tests (Reihenfolge, Höchstzahl, freie Stellen,
  Sätze).
- Die Seite fährt die Kamera nach diesem Zeitplan (wie `CameraRig`, an der Uhr) und
  gibt der Engine einen `Rundflug`, dessen `pos(t)` die Bildschirmposition des Pins
  zum Zeitpunkt t liefert (Pin mit der Kamera dieses Zeitpunkts projiziert, plus
  Abstand daneben). Beide laufen auf demselben Startzeitpunkt.
- Hervorheben: eigener Zustand für die Pins (Leuchten), getrennt von Auswahl und
  Sichtbarkeit.
- **[Bauende]:** Haltezeiten, Abstand Hoku–Pin, Kurve der Kamera.
- **Wechsel zwischen zwei Stellen = Variante B** (Mockup 04.11.2026): Hoku bleibt
  seitlich neben dem Pin, der Torso dreht sich unter ihm; Hoku macht einen Hopser
  (≈58 px hoch, ≈24 px gegen die Drehrichtung) und federt beim Landen kurz ein.
  „Hoku umkreist den Torso“ (A) ist verworfen. **[Nutzer]**
- **Hoku muss fliegen, nicht gleiten** (Nutzer: „wirkt sehr starr, auch Partikel
  und Pupille“): Partikel reagieren auf Beschleunigung, die Pupille aufs Blickziel.
  Deshalb Bahnen im Bogen, Ankunft mit gedämpfter Feder (≈7 % Überschwingen),
  beim Halt Schweben in einer liegenden Acht (±6/±4 px), Blick im Flug voraus,
  am Halt erst auf den Pin, dann zum Nutzer. Werte im Mockup
  (`hoku-rundflug/main.tsx`, Abschnitt „Flugbewegung“). **[Nutzer]**

## Offen

- **[offen]** Zeiten und Leuchten (Bewegung siehe oben): im Live-Mockup mit Hokus echter Engine
  und dem echten Torso festlegen, bevor gebaut wird.
- **[offen]** Ob die kurze Runde („dazwischen“) die Kamera mitdreht oder nur Hoku
  um den stehenden Torso fliegt.
