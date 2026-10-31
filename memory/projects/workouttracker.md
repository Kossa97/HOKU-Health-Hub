# Workout-Tracker

**Stand:** 18.10.2026, Bau auf `claude/workout-tracker`
**Code:** `src/features/training/`, Route `/training`, Migration `supabase-training.sql`

## Entschieden (Nutzer, 18.10.2026)

- **Umfang v1:** alles — Kraft-Logger, Ausdauer/Sport, Apple-Health/Health-Connect-Import,
  Kopplung mit Stack/Blutwerten, **GLP-1-Modus**.
- **Einstieg:** Home-Kachel + Eintrag im Schnellzugriff (Mitte-Knopf). Tab-Leiste bleibt.
- **Vorbilder:** Hevy (Logger) und fin fitnesstracker (Bereitschaft, Ruhetage, Wochenbilanz, Hyrox).

## Was wir besser machen (aus der Recherche)

| Schwäche der anderen | Bei uns |
|---|---|
| Hevy/Strong/fin: Gratis nur 3–4 Routinen, Verlauf begrenzt | keine Grenze |
| fin: Bereitschaft nur Pro, nur mit Apple Health, nur iOS | gratis; ohne Uhr aus dem Tagesprotokoll (Schlaf/Energie); PWA + Android |
| Hevy: Import nur aus Strong, Social nicht abschaltbar | Import Hevy + Strong (CSV), Export jederzeit; kein Social, privat |
| Kraft und Ausdauer in getrennten Apps | ein Modell für jede Einheit |
| keine App koppelt Training an Stack/Blutwerte/Ernährung | Marker im Übungs-Chart, GLP-1-Ansicht, kcal für Kalorientracker |

## Architektur

- Eine Einheit (`training_sessions`) für jede Art; Sätze als jsonb in der Einheit
  (atomar speichern, Auswertung in der App).
- Übungskatalog im Code (`data/exercises.ts`, de/en), eigene Übungen in
  `training_custom_exercises`, Kennung `custom:<uuid>`.
- Texte in eigenem i18n-Namensraum `training` (de/en), andere Sprachen fallen
  auf Englisch zurück — wie die FAQ. Nur Kachel/Schnellzugriff in den Haupt-Locales.
- Laufendes Training liegt lokal (übersteht App-Neustart), erst „Beenden“ schreibt.

## Stand 18.10.2026

v1 auf `main` (PR #27, Merge 6522945, 18.10.2026). Trockenlauf der Migration
bestanden (`scripts/sql/training.test.sql`). **In Prod eingespielt am 18.10.2026** (Migration `training_workout_tracker`): 4 Tabellen, 4× RLS, 16 Policies, 0 Zeilen; Security-Advisor ohne neuen Befund. Konto löschen erfasst die Tabellen per `on delete cascade` an `auth.users`.
Gerätetest `e2e/training.spec.ts` (Chromium-Profile grün, WebKit lokal nicht installiert).

## v2: Logger + Editor (Konzept 28.10.2026, Branch `claude/workout-tracker-v2`)

Grundlage: Recherche `reports/Workout Tracker Apps und Schwächen.md` (lokal, nicht im
Repo). Kernaussage: Die Logger sehen bei allen gleich aus; verloren wird an den
Übergängen (Hintergrund, Vorlage, Update) und an Fairness. Nutzer wollen Automatik,
die sich erklärt und sich übersteuern lässt (Alpha Progression am nächsten dran).

**Entschieden (Claude, Nutzer verbessert nach Belieben):**

Logger (Live-Training)
- Satzzeile: `Nr/Typ · Vorher · [kg] [Wdh] · ✓`. Felder sind mit dem **Vorschlag**
  vorbelegt (Akzentfarbe, kursiv-leicht), bis der Nutzer tippt oder abhakt. Nie
  automatisch überschreiben, was der Nutzer eingetragen hat.
- **Vorschlag mit Begründung** je Übung, eine Zeile unter dem Kopf:
  „Letztes Mal 3 × 10 @ 80 kg, RPE ≤ 8 → heute 82,5 kg". Regeln in
  `lib/progression.ts` (Doppelprogression, Sprung je Gerät, max. +10 %, bei zu
  großem Sprung erst +1 Wdh., nach verfehlten Sätzen Gewicht halten).
- Pausentimer: Zeitstempel-basiert (ist so). Neu: zeigt den **nächsten Satz**
  („Satz 3 · 82,5 × 10"); Benachrichtigung bei Pausenende im Hintergrund;
  Bearbeiten/Abhaken eines **früheren** Satzes startet keine neue Pause; ±15 s;
  Ton+Vibration abschaltbar.
- Löschen (Satz, Übung) mit **Rückgängig** im Toast (Reducer: `undo`-Snapshot).
- Supersatz: nach dem Haken springt die Ansicht zur nächsten Übung der Gruppe.
- Nächster offener Satz ist markiert (Ring in Akzentfarbe).
- Kopf: Sicherungsstatus „Auf dem Gerät gesichert" (jeder Satz sofort lokal, ist so).
- Minimiert: Leiste mit Dauer **und** Pausen-Countdown.
- Abschluss: Dauer, Volumen, Sätze, Rekorde, RPE; wenn das Training von der
  Routine abweicht (Übungen/Satzzahl/Reihenfolge/Gewichtsziele): Schalter
  **„Änderungen in die Routine übernehmen"** (`lib/routineDiff.ts`).

Editor (Routine)
- Routine = Name · Ordner (Plan) · Wochentage · Übungen; je Übung Satzzeilen mit
  **Wdh.-Bereich** (min–max), optional Zielgewicht/RPE, Satztyp; Pause je Übung;
  Supersatz; Notiz. Drag-Reorder per Griff (Pointer), dazu ↑↓ für Tastatur.
- **Sätze je Muskel** als Balken im Editor (direkt + ½ indirekt), Richtwert 10–20
  pro Woche über alle Routinen eines Ordners × Wochentage.
- **Ordner = Plan**: Routinen gruppiert; „Als Nächstes" = Routine nach der zuletzt
  trainierten im Ordner (Rotation aus dem Verlauf, kein Zustand). Wochen/Deload
  bleiben v3.
- Vorlagen (Code, `data/plans.ts`): Ganzkörper 3×, Ober/Unter 4×, Push/Pull/Beine
  6×, Hyrox (bestehend). Ein Tipp legt Ordner + Routinen an, alles editierbar.
- Speichern beim Schließen (implizit), Toast „Gespeichert"; keine Obergrenze.
- Nichts davon hinter einer Bezahlschranke; Bearbeiten und Tausch nie.

Daten
- `RoutineExercise.sets[]`: zusätzlich `repsMin`, `repsMax`, `rpe` (jsonb, keine
  Migration). `TrainingRoutine.folder: string | null` → Migration
  `supabase-training-v2.sql` (`add column if not exists folder text`), Trockenlauf
  nach CLAUDE.md, erst dann Prod. **Die v2-Migration muss VOR dem Frontend-Deploy in
  Prod sein:** `ROUTINE_COLUMNS` selektiert `folder`; `loadRoutines` faellt bei
  fehlender Spalte (42703) auf ein Select ohne `folder` zurueck, `saveRoutine` nicht
  (Fehler-Toast). Review-Befund 28.10.2026.
- Settings: `restSound: boolean`, `restNotify: boolean`.

**Stand 28.10.2026:** v2 gebaut auf `claude/workout-tracker-v2` (Logger, Editor,
Pläne, Vorlagen), Live-Mockup https://claude.ai/artifact/Rg8Myea78FVk1qbp4JvLvX.
**Migration v2 in Prod eingespielt am 29.10.2026** (Migration `training_workout_tracker_v2_folder`,
mit Zustimmung des Nutzers): Trockenlauf mit Postgres 16 zweimal (zweiter Lauf: „already exists,
skipping"), Prüfregel getestet (leer und 41 Zeichen abgelehnt). Prod danach: `training_routines`
mit Spalte `folder` + Prüfregel (5 Checks), 0 Zeilen, RLS an, 4 Policies; Security-Advisor ohne
neuen Befund. Das v2-Frontend darf jetzt deployt werden.
Prüfungen grün: tsc, eslint (0 Fehler), 3165 Unit-Tests, e2e Training (iPhone 13,
Pixel 7), Build. Code-Review (10 Punkte) eingearbeitet. **Noch nicht auf main,
Migration v2 noch nicht in Prod** (Reihenfolge: erst Migration, dann Deploy).
Nutzer wollte alles selbst nachbessern. Übungsmedien (Gym Visual) und 3D-Körper
(anatomy-models, Demo https://claude.ai/artifact/Lt3V66ArqPxMnTjHQPznE1) offen.

## Trainingsabschluss: Silo und „Hoku trägt“ (Entwurf, 28./29.10.2026)

Alle Entwürfe, Links, Verlauf der Entscheidungen und offenen Punkte:
`docs/training/hoku/README.md`. Aktuelle Richtung: **ein Bild am Trainingsende**,
Hoku (KI-Assistent, früher „Dot“, `src/features/dot/` auf `main`) trägt **Gegenstände**,
die zusammen das Volumen wiegen (Bus 12 t, Elefant 6 t … Waschmaschine 70 kg),
proportional zueinander; Gegenstände als gerenderte 3D-Modelle (Render-Strecke in
`docs/training/hoku/render/`), Hoku bleibt Licht. Arme kommen aus Hoku, riesig, Muskeln,
Physik (Baustein `hoku-arme.html`). Offen: Stil der Modelle (stilisiert vs. realistisch),
weitere Modelle vom Nutzer, Muskeldefinition der Arme.

**Auf main seit 30.10.2026** (PR #99, Merge `ae39159`, auf Wunsch ohne auf die Gerätetests zu
warten). Danach im Safari-Profil (iphone-13-webkit) rot: das Gewichtsrad rastete beim Öffnen
eigenmächtig zwei Zeilen weiter (82 → 84). Fix: kein CSS-`scroll-snap` mehr, das Rad rastet beim
Stillstand selbst auf die nächste Zeile (Touch-Halten verhindert Einrasten unter dem Finger).
Bekannt rot von main, nicht vom Tracker: `login.spec.ts:211` (WebKit), wackelnd
`sheet-wegziehen.spec.ts:16` (WebKit) und `dot.spec.ts` „mit Pro“ unter Last.

## Einstieg „Heute“ (Entscheidung Nutzer, 29.10.2026)

Mockup: https://claude.ai/artifact/A1i3nr5H3aqc9ruQcXpg8J (Variante 1).
- Reihenfolge: Titel · Tabs (Heute/Verlauf/Fortschritt) · **Wochenleiste** (Datum oben,
  Wochentag darunter) · **Leeres Training starten** · **Routinen** (die von heute bzw. die
  nächste oben im Ordner, hervorgehoben, großer Start; an Ruhetagen ruhiger mit Mond) ·
  Aktivität eintragen · Diese Woche · Bereitschaft (nur mit Wert) · GLP-1 · Zuletzt.
- Tabs oben, weil sie den ganzen Tracker umschalten; der Kalender ist Inhalt von „Heute“.
- **Dot gehört nicht in die Karten.** Er lebt in der Tab-Leiste, kommt heraus und sagt per
  Sprechblase, was heute dran ist, oder motiviert. Angebunden am 29.10.2026 nach dem Merge
  von `main`: Seiten geben ihm über `dotStore.setHinweis(text)` einen Satz; ist er draußen
  (`modus === 'home'`), sagt er ihn, beim Herauskommen grüßt er damit. Der Satz für
  „Heute" kommt aus `training/lib/dotHint.ts` (heute dran / erledigt / Ruhetag / niedrige
  Bereitschaft / Wochenziel). Während das Live-Training offen ist, schweigt er dazu.
- Merge mit `main` (29.10.2026): `main` hatte den Tracker auf das schwarze Design (lg-Klassen)
  gebracht; aufgelöst als v2-Logik mit lg-Optik, alte Farbvariablen auf lg-Variablen gemappt.
- Pausen-Benachrichtigung ist jetzt **Opt-in** (Standard aus, Erlaubnis beim Einschalten).
  Offen: auf Android/iOS/Capacitor zeigt die Seiten-Benachrichtigung nichts zuverlässig —
  braucht geplante Benachrichtigung über Service Worker bzw. Capacitor Local Notifications.
- Die Karte „Heute geplant/Als Nächstes“ (`NextInPlanCard`) und die leere
  Bereitschaftskarte sind entfallen.

## Pläne, Workouts, Favoriten (Entscheidung Nutzer, 31.10.2026)

- **Begriffe, verbindlich:** **Plan** enthält **Workouts**, ein Workout enthält **Übungen**,
  eine Übung enthält Sätze, Wiederholungen, Pausen usw. Das Wort **„Routine" entfällt**
  überall in der Oberfläche (de/en: Plan/Workout). Im Code heißt das bisherige
  `TrainingRoutine` = Workout, `folder` = Plan.
- **Zeitplan am Plan:** feste Wochentage · X-mal pro Woche · alle X Tage. Bei X-mal/alle X
  Tage laufen die Workouts der Reihe nach; „alle X Tage" zählt ab der letzten Einheit.
- **Kopieren, Einfügen, Duplizieren, Verschieben** für Pläne, Workouts und Übungen;
  Übungen per Mehrfachauswahl (lange drücken → antippen → Leiste unten). Zwischenablage in
  der App. Ein Workout gehört zu genau einem Plan (Kopie statt Verknüpfung).
- **Werte:** kopierte/verschobene Übungen behalten Sätze, Gewichte, Wdh., Pausen, Notiz;
  neu hinzugefügte sind leer („Wie letztes Mal" bleibt als Vorschlag im Training).
- **Favoriten-Stern** an Übungen: oben in der Übungsauswahl + Filter; in
  `training_settings.settings` (jsonb), keine Migration.
- Pläne mit Zeitplan brauchen eine eigene Tabelle; vorhandene Ordnernamen werden
  übernommen, `folder` bleibt stehen. Migration nach Datenbankregel (Trockenlauf, Zustimmung).
- Reihenfolge: Favoriten → Mehrfachauswahl/Kopieren → Pläne mit Zeitplan.

## Offen

| Punkt | Stand |
|---|---|
| Kalorientracker | nicht im Repo gefunden; GLP-1-Protein (`Glp1Card avgProteinG`) und Trainings-kcal brauchen ihn — Schnittstelle `trainingEnergyForDay` (`lib/energy.ts`) steht bereit |
| Android-Workouts | `capacitor-health-connect` 0.7 kann keine ExerciseSession lesen; anderes Plugin nötig. AndroidManifest hat bisher **keine** Health-Berechtigungen (betrifft auch Gewicht/Schritte) — bewusst nicht geändert (Play-Erklärung nötig) |
| iOS HealthKit | Entitlement/Capability fehlt im Xcode-Projekt; Info.plist-Text nennt Workouts/Ruhepuls nicht |
| HRV | liefert keins der Plugins; Bereitschaft nutzt Schlaf, Ruhepuls, Tagesform, Last |
| Hevy/Strong-CSV | Formate aus Sekundärquellen; mit echten Exportdateien gegenprüfen |
| Hyrox | Mixed Doubles fehlt (Quellen widersprüchlich); Women-Open-Wall-Balls 100 angenommen |
| Schnellzugriff-Label | „Training" (öffnet den Bereich, 30.10.2026) hart deutsch wie die übrigen Einträge in `Layout.tsx` |
| Live Activity / Apple Watch | braucht nativen Swift-Code, v2 |
| Auto-Progression / Deload-Vorschlag | v2 |
