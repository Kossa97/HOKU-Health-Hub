# Profil, Teilprojekt 1: Datenbasis — Design

Stand 31.10.2026. Gehört zu `2026-10-31-profil-social-gesamtbild-design.md`
(dort stehen Absicht, Sichtbarkeit und Reihenfolge der vier Teilprojekte).
Markierungen: **[Nutzer]**, **[Claude]** (vorgeschlagen und bestätigt),
**[Claude, ungeprüft]** (Entscheidung von Claude, dem Nutzer zur Durchsicht
genannt), **[Bauende]**.

## Absicht

Das neue Profil soll Werte zeigen, die die App heute gar nicht erfasst. Dieses
Teilprojekt schafft nur die **Daten** dafür: Nutzer können sie eintragen bzw. die
App liest sie ein und speichert sie. Wie und für wen sie im Profil erscheinen, ist
Teilprojekt 2.

Erfolg: Nach diesem Teilprojekt kann ein Nutzer Umfänge messen und im Verlauf
sehen, Ziel-Tags, Land, Geschlecht, Profil- und Titelbild setzen, und die
zusätzlichen Wearable-Werte landen täglich in der Datenbank.

## Ziele

1. **Umfänge** erfassen und als Verlauf im Fortschritt sehen.
2. **Ziel-Tags** wählen.
3. **Land** (Herkunft) wählen.
4. **Geschlecht** fürs Profil, getrennt vom biologischen Geschlecht der Blutwerte.
5. **Profilbild** und **Titelbild** hochladen, ändern, entfernen.
6. **Wearables:** zusätzliche Werte lesen und **Tageswerte serverseitig speichern**.

## Nicht-Ziele

- Keine Sichtbarkeit für andere, kein Profil-Umbau, kein Gesamtfortschritt, keine
  Abzeichen (alles Teilprojekt 2). Bilder sind in diesem Teilprojekt nur für den
  Nutzer selbst sichtbar.
- Kein Bild-Check (Nacktheit) — kommt in Teilprojekt 2, bevor Bilder für andere
  sichtbar werden.
- Keine Story (Teilprojekt 4).
- Kein Aufräumen der ungenutzten Tabelle `body_metrics` und der alten Spalten
  `profiles.age`/`gender` (nur erwähnen, nicht löschen).
- Keine weiteren Sprachen als de/en.

## Anti-Ziele

- Wearable- oder Körperdaten, die ohne ausdrückliche Einwilligung auf dem Server
  landen.
- Pflichtfelder: Alles hier ist freiwillig. Niemand muss Land, Geschlecht oder ein
  Bild angeben, um die App zu nutzen.
- Ein zweites Eingabeformular neben dem bestehenden Tageseintrag, das sich anders
  anfühlt.

## Randbedingungen

- Datenbankänderungen nach `CLAUDE.md`: Migration als `supabase-*.sql`,
  Trockenlauf mit Postgres 16 (zweimal laufen lassen, nachzählen), erst dann
  gegen das echte Projekt, danach nachzählen und berichten.
- RLS: jede neue Tabelle und jeder Bucket nur für den eigenen Nutzer
  (`auth.uid() = user_id`), wie `weight_logs` und `progress_photos`.
- i18n: neue Schlüssel in `de` und `en`; übrige Sprachen bekommen den englischen
  Text als Platzhalter (`src/features/my-stack/lib/i18n.test.ts` verlangt jeden
  Schlüssel überall).
- Look: Soft Dark, bestehende Bausteine (`GlassSegmented`, `Schalter`, Sheets).
- Nach Codeänderungen `graphify update .`, dann `code-review`.

## 1. Umfänge

**Messstellen [Claude, ungeprüft]:** Hals, Brust, Taille, Bauch (Nabelhöhe),
Hüfte, Oberarm, Unterarm, Oberschenkel, Wade. Je Stelle **ein** Wert in cm; wer
links und rechts misst, nimmt eine Seite. Nutzer wählen, welche Stellen sie
überhaupt messen; nicht gewählte Stellen erscheinen nirgends.

**Speicherung [Claude, ungeprüft]:** neue Tabelle `body_measurements`
(`user_id`, `measured_on date`, `site text` mit Prüfung gegen die Liste oben,
`value_cm numeric(5,1)` mit plausiblen Grenzen, `created_at`), eindeutig je
`(user_id, measured_on, site)`. Lange Form statt einer Spalte je Stelle, damit
spätere Stellen keine Migration brauchen.

**Eingabe:** im bestehenden Tageseintrag des Fortschritts
(`src/features/fortschritt/components/TodayLogSheet.tsx`) als eigener,
einklappbarer Abschnitt „Umfänge“ unter Gewicht/KFA — nicht als zweites
Formular. **Anders als bei Gewicht und KFA** wird der letzte Wert nur als Hinweis
im leeren Feld gezeigt, nicht vorbelegt; gespeichert werden nur Stellen, die der
Nutzer an diesem Tag tatsächlich eingetragen hat. Sonst entstünde bei jedem
Tageseintrag eine kopierte Messung je Stelle, und Verlauf wie Gesamtfortschritt
würden verfälscht. Umfänge misst man eher wöchentlich oder monatlich.
**[Claude, ungeprüft]**

**Anzeige:** Umfänge erscheinen als auswählbare Werte im Verlauf des Fortschritts
(`metricDefinitions.ts`, `buildAvailableMetrics`), wie Gewicht und KFA.

## 2. Ziel-Tags

Feste Liste **[Claude]:** Fettabbau, Muskelaufbau, Recomp, Kraft,
Ausdauer, Longevity, Blutwerte optimieren, Schlaf & Erholung, Wohlbefinden.
**Keine Obergrenze**; im Profil stehen die Tags in einer Zeile, die sich
seitlich wischen lässt. **[Nutzer]** Gespeichert als `profiles.goals text[]` mit
Prüfung gegen die Liste. Auswahl im Profil (heutige Seite `src/pages/Profil.tsx`).

Die Tags bestimmen in Teilprojekt 2 die Standardrichtung von Gewicht und Umfängen
im Gesamtfortschritt; hier werden sie nur gespeichert.

## 3. Land

`profiles.country text` als ISO-3166-1-Alpha-2-Code, Auswahl mit Suche und
Flagge, Namen über `Intl.DisplayNames` in der App-Sprache. Freiwillig.
**[Claude, ungeprüft]**

## 4. Geschlecht

**Zwei getrennte Angaben** — Vorschlag **[Claude, ungeprüft]** auf die Frage des
Nutzers, ob und wie man trennt:

| | Profil-Geschlecht | Biologisches Geschlecht |
|---|---|---|
| Wofür | Anzeige im Profil | Referenzbereiche der Blutwerte (und Ernährung, `/health`) |
| Werte | männlich, weiblich, divers, keine Angabe | männlich, weiblich |
| Gespeichert | neue Spalte `profiles.profile_gender` | vorhandenes `profiles.bio_sex` |
| Gefragt | beim Registrieren, überspringbar **[Nutzer]** | nur wenn gebraucht |
| Sichtbar | als dezentes Zeichen oben im Profil neben dem Namen (♂ ♀ ⚧), „keine Angabe“ zeigt nichts; **keine eigene Karte** in „Über mich“ **[Nutzer]** | nie im Profil |

Zusammenspiel:
- Wählt jemand beim Registrieren männlich oder weiblich, wird `bio_sex` mit
  demselben Wert vorbelegt. Ändern lässt es sich weiter in der Karte
  `BioProfilKarte` („für die Referenzbereiche deiner Blutwerte“).
- Bei divers oder keine Angabe bleibt `bio_sex` leer. Beim ersten Blutwert-Eintrag
  fragt die App dann: „Für passende Referenzbereiche brauchen wir dein
  biologisches Geschlecht.“ Ohne Angabe gelten die Bereiche, die der Befund selbst
  mitbringt, wie heute.
- Ändert jemand später das Profil-Geschlecht, bleibt `bio_sex` unberührt, und
  umgekehrt.
- Zeichen für divers: ⚧ als Platzhalter. Der Nutzer wollte ein Bild des Zeichens
  schicken; es ist nicht angekommen und muss nachgereicht werden.
- Die Abfrage beim Registrieren ist ein zusätzlicher Schritt im bestehenden
  Registrieren-Ablauf mit Hoku (`docs/superpowers/specs/2026-10-29-hoku-login-fuehrung-design.md`,
  `src/features/auth`).

Bestand: Es gibt heute `profiles.bio_sex` (male/female, für Referenzbereiche der
Blutwerte, Karte `BioProfilKarte`). Die alte Spalte
`profiles.gender` ist **nicht** frei: `altfelderAus` schreibt sie als Kopie von
`bio_sex`, und Ernährung (`nutritionStore.ts`) sowie `/health` lesen sie über
`geschlechtAusAltangabe`. Ein eigenes Profilfeld bräuchte deshalb eine neue
Spalte; `gender` darf dafür nicht umgedeutet werden.

## 5. Profilbild und Titelbild

- Neuer **privater** Bucket `profile-media`, Pfad `<user_id>/avatar.<ext>` und
  `<user_id>/cover.<ext>`, Zugriff in diesem Teilprojekt nur für den Nutzer selbst
  (signierte URLs wie bei `progress-photos`). **[Claude, ungeprüft]**
- Spalten `profiles.avatar_path`, `profiles.cover_path`.
- Vor dem Hochladen auf dem Gerät zuschneiden und verkleinern: Profilbild
  quadratisch, Titelbild 3:1; Ziel unter ~500 KB; EXIF-Daten (Ort!) entfernen.
- Ersetzen löscht die alte Datei; „Entfernen“ löscht Datei und Pfad.
- Anzeige: Profilbild ersetzt das Platzhalter-Symbol auf `src/pages/Profil.tsx`;
  das Titelbild erscheint dort oben.

## 6. Wearables

**Was die Plugins heute können** (geprüft 31.10.2026):

| Wert | iOS `@perfood/capacitor-healthkit` | Android `capacitor-health-connect` |
|---|---|---|
| Schritte, Ruhepuls, Puls, Gewicht, KFA | ja | ja |
| Aktive kcal, SpO2, Atemfrequenz, Blutdruck | ja | ja |
| Schlaf | ja | **nein** |
| HRV, VO2max | **nein** | **nein** |

**Umfang [Claude, ungeprüft]:**
- **1a** (dieses Teilprojekt): aktive kcal, SpO2, Atemfrequenz, Blutdruck
  zusätzlich lesen; Schlaf auf iOS. Leseberechtigungen ergänzen
  (`IOS_READ_PERMISSIONS` in `src/lib/health.ts`, Health-Connect-Berechtigungen,
  iOS-Info.plist-Texte).
- **1b** (eigener Schritt danach): HRV, VO2max und Schlaf auf Android. Braucht
  ein anderes Plugin oder eigenen nativen Code (Swift/Kotlin). Der Bauende prüft,
  welches Plugin alle drei kann, und schlägt es vor, bevor er wechselt. **[Bauende]**

**Speicherung [Nutzer]:** Heute werden Wearables meist nur live auf dem Gerät
gelesen. Für Profil und Gesamtfortschritt kommen Tageswerte auf den Server (siehe
Entscheidungen unten). Tabelle `health_daily` (`user_id`, `day`, `steps`, `resting_hr`,
`sleep_min`, `active_kcal`, `spo2_pct`, `resp_rate`, `bp_sys`, `bp_dia`, später
`hrv_ms`, `vo2max`, `source`), eindeutig je `(user_id, day)`. Abgleich beim Öffnen
der App für die letzten 30 Tage, danach inkrementell. Nur Tageswerte, keine
Einzelmessungen. Der Abgleich läuft nur bei Nutzern, die schon zugestimmt und die
Leseberechtigungen erteilt haben; er fragt selbst nie nach Berechtigungen.
**[Claude, ungeprüft]**

Die neuen Werte (aktive kcal, SpO2, Atemfrequenz, Blutdruck) werden in diesem
Teilprojekt auf der Seite `/health` angezeigt, damit 1a auch ohne Profil-Umbau
sichtbar ist. **[Claude, ungeprüft]**

Bestand: Das Training importiert schon heute Workouts aus HealthKit samt kcal und
Durchschnittspuls in das Konto (`syncHealthWorkouts` in `useTrainingData.ts`,
Schalter `healthImport` in den Trainingseinstellungen). Wearable-Daten liegen also
teils schon auf dem Server.

Android: `AndroidManifest.xml` deklariert heute **keine**
`android.permission.health.READ_*`-Berechtigungen, und das Plugin ist nur in
ungespeicherten Änderungen im Arbeitsverzeichnis eingebunden
(`android/*.gradle`). Health Connect liefert auf Android also derzeit nichts.

Zyklus, Blutzucker und Medikamente werden **nicht** gelesen.

## Entscheidungen des Nutzers (31.10.2026)

1. **Wearable-Tageswerte werden auf dem Server gespeichert.** Eine eigene
   Einwilligung („Gesundheitsdaten aus Apple Health / Health Connect in deinem
   Hoku-Konto speichern“) deckt auch den bestehenden Workout-Import des Trainings
   mit ab. **[Nutzer]** Dazu gehören ein Eintrag in der Datenschutzerklärung (de/en)
   und eine Möglichkeit, alle gespeicherten Wearable-Daten zu löschen. Für Nutzer,
   die `healthImport` schon eingeschaltet haben, wird die Einwilligung beim
   nächsten Öffnen einmal nachgeholt; bis dahin pausiert der Import.
   **[Claude, ungeprüft]**
2. **Android Health Connect einrichten gehört zu diesem Teilprojekt.** **[Nutzer]**
   Also: Health-Berechtigungen im Manifest, der von Health Connect verlangte
   Bildschirm zur Erklärung der Berechtigungen, die Angaben zu Gesundheitsdaten in
   der Play Console (vom Nutzer auszufüllen, Text liefert der Bauende), und die
   ungespeicherten Änderungen an `android/*.gradle` prüfen und übernehmen.
   **Getestet wird im Emulator**, weil kein Android-Gerät da ist **[Nutzer]**:
   Android-Emulator ab API 34 (Health Connect ist eingebaut), Testdaten über die
   „Health Connect Toolbox“. Ein Test auf echter Hardware steht vor dem Store-Start
   noch aus und wird als offen vermerkt.
3. **Geschlecht:** getrennt, siehe Abschnitt 4. Frage **[Nutzer]**, Aufteilung
   **[Claude, ungeprüft]**.

## Dem Bauenden überlassen

- Plugin-Wahl für HRV/VO2max (1b), mit Vorschlag vor dem Wechsel.
- Länderliste und Suche im Detail, Zuschnitt-Werkzeug für Bilder.
- Genaue Plausibilitätsgrenzen für Umfänge.
- Ob der Wearable-Abgleich im Vordergrund oder beim nächsten Start nachholt.
