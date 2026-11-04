# Profil-Zusatz: Titel (Rang und tragbare Abzeichen) — Design

Stand: 2026-11-04 · Status: Entwurf zur Freigabe · baut auf 2a (Sichtbarkeit), 2b (Abzeichen)
und 2c (Web, Link-Karte) auf.
Mockup: `docs/profil/mockups/profil-titel.html` (Entwurf 4: tragbare Abzeichen, Stufen je
Sportart, persönliche Titel, Standard „Nur ich“). Entscheidungen: `memory/projects/titel.md`.

Kennzeichnung wie in den Profil-Specs: **[Nutzer]** = vom Nutzer entschieden,
**[Claude, ungeprüft]** = Vorschlag, noch nicht bestätigt.

## Absicht

Neben dem Namen steht genau **ein Titel**. Er sagt, wer man auf Hoku ist, passend zu
„Sieh, wer du wirst.“ Abzeichen bleiben Sammelstücke; besondere davon lassen sich als Titel tragen.

Erfolg: Mara sieht unter ihrem Namen „ROUTINIER“ und darunter „noch 50 Tage mit Eintrag bis
Veteran“. Am 200. Tag mit Eintrag erscheint nach dem Speichern der Moment „Neuer Rang: Veteran“.
Sie trägt lieber „Läufer“, wählt das im Sheet „Dein Titel“, und Freunde, App-Nutzer, die
Web-Vorschau und die Link-Karte zeigen „LÄUFER“.

## Nicht-Ziele

- Keine persönlichen Titel (Körper, Gewicht, Blut, Einnahmen …) ohne ausdrückliche Bestätigung (3.3).
- Kein Verlust eines Titels, kein Verblassen nach Pausen.
- Keine Ranglisten oder Vergleiche zwischen Nutzern.
- Keine eigene Web-Einstellung für den Titel (er folgt der Feldstufe, siehe 5).

## 1. Zwei Arten von Titeln **[Nutzer]**

| | Rang | tragbares Abzeichen |
|---|---|---|
| sagt | wie lange du dranbleibst | wofür du stehst (Sportart, Stärke) |
| bekommt | jeder, von selbst | wer das Abzeichen verdient |
| getragen | ab Werk | wenn gewählt |
| wechselt | steigt von selbst mit, solange er getragen wird | bleibt, bis man etwas anderes wählt |

Einmal erreicht, für immer (wie Abzeichen in 2b).

## 2. Rang **[Nutzer]**

Grundlage: **Tage mit eigenem Eintrag, zusammengezählt** (`BadgeFacts.entryDays`, ohne
Doppelte). Lücken sind erlaubt. Nicht: Tage mit geöffneter App, Tage, an denen nur ein Wearable
Daten überträgt, Tage in Folge.

| ab Tagen mit Eintrag | de | en |
|---|---|---|
| 1 | Neuling | Newcomer |
| 10 | Entdecker | Explorer |
| 50 | Dranbleiber | Committed |
| 100 | Routinier | Steady |
| 200 | Veteran | Veteran |
| 365 | Legende | Legend |

Die Schwellen weichen bewusst von den Serien-Abzeichen (7/30/100/365 Tage ohne Lücke) ab.

Technik **[Claude, ungeprüft]**: Die sechs Stufen sind Abzeichen einer eigenen Gruppe `rang`
(`rank_1` … `rank_6`), ausgewertet von `evaluateBadges` und gespeichert in `earned_badges`.
So gilt „einmal verdient bleibt verdient“ ohne neue Logik, auch wenn Einträge gelöscht werden.
Die Gruppe `rang` erscheint nicht in der Abzeichen-Liste.

## 3. Tragbare Abzeichen **[Nutzer: Konzept, Sportarten mit Stufen, Importe zählen, persönliche Titel]**

Ein Abzeichen ist tragbar, wenn es in `badges.ts` einen Titelnamen (de/en) hat. Namen
**[Claude, ungeprüft]**, zur Freigabe.

### 3.1 Aus 2b, tragbar gemacht

| Abzeichen | Titel de / en |
|---|---|
| 100 Tage ohne Lücke (`streak_100`) | Unaufhaltsam / Unstoppable |
| 365 Tage ohne Lücke (`streak_365`) | Eiserner Wille / Iron Will |
| 52 Wochen Training in Folge (`training_weeks_52`) | Ganzjahres-Athlet / Year-Round Athlete |
| 100 Workouts (`workouts_100`) | Trainingstier / Workhorse |
| 10 Freunde (`friends_10`) | Motivator / Motivator |

Neu ohne Stufen: `prs_25` Kraftpaket / Powerhouse (25 Bestleistungen) · `steps_weeks_12`
Schrittmacher / Pacesetter (12 Wochen Ø ≥ 10.000 Schritte) · `entries_1000` Datenprofi / Data Pro
(1.000 Einträge) · `allrounder` Allrounder / All-Rounder (5 Sportarten mit je ≥ 10 Einheiten).

### 3.2 Sportarten mit drei Stufen **[Nutzer: Stufen]**

Getragen wird die höchste erreichte Stufe; sie steigt von selbst mit. Einheiten zählen **auch aus
Apple Health / Health Connect eingeführt** (`TrainingSession.kind`, ohne Doppelte über `externalId`).

| Sportart (`kind`) | Stufe 1 | Stufe 2 | Stufe 3 |
|---|---|---|---|
| Laufen (`run`) | Hobbyläufer / Hobby Runner · 10 | Läufer / Runner · 50 | Ausdauerläufer / Endurance Runner · 150 |
| Rad (`cycle`) | Gelegenheitsradler / Casual Cyclist · 10 | Radsportler / Cyclist · 50 | Kilometerfresser / Road Warrior · 150 |
| Schwimmen (`swim`) | Schwimmfreund / Swim Fan · 10 | Schwimmer / Swimmer · 30 | Bahnenzieher / Lap Master · 100 |
| Rudern (`row`) | Ruderfreund / Rowing Fan · 10 | Ruderer / Rower · 30 | Schlagmann / Stroke Master · 100 |
| Wandern (`hike`) | Wanderfreund / Trail Friend · 10 | Wanderer / Hiker · 25 | Gipfelstürmer / Summit Seeker · 75 |
| Hyrox (`hyrox`) | Hyrox-Starter / Hyrox Starter · 5 | Hybrid-Athlet / Hybrid Athlete · 20 | Hyrox-Veteran / Hyrox Veteran · 60 |
| HIIT (`hiit`) | Intervall-Starter / Interval Starter · 10 | Intervall-Profi / Interval Pro · 50 | Pulsjäger / Pulse Chaser · 150 |
| Yoga, Mobility | Yoga-Einsteiger / Yoga Beginner · 10 | Yogi / Yogi · 50 | Zen-Meister / Zen Master · 150 |

`strength`, `walk`, `sport`, `other` ohne eigene Leiter (Kraft steckt in Kraftpaket, Gehen in
Schrittmacher). Keine Wörter wie „-süchtig“.

### 3.3 Persönliche Titel **[Nutzer: tragbar, Standard aus; Bedingungen bestätigt]**

Titel aus Körperfett, Gewicht, Blut, Ruhepuls, Einnahmen, Zyklen, Erfahrungsberichten und
Gesamtfortschritt gibt es, unter vier Bedingungen:

1. **Ab Werk aus:** Schalter „Persönliche Titel erlauben“ im Sheet, Standard aus.
2. **Bestätigung je Titel, jedes Mal vor dem ersten Tragen:** „Dieser Titel zeigt anderen, dass du …
   Das ist ein Gesundheitsdatum. Sichtbar höchstens wie dein Feld …“ → „Trotzdem tragen“ /
   „Abbrechen“. Einwilligung nach Art. 9 Abs. 2 a DSGVO, widerrufbar (anderer Titel oder Schalter aus).
3. **Nie sichtbarer als das zugehörige Feld:** wirksame Stufe = die strengere aus Titel-Feld und
   Quellfeld (z. B. Körperfett auf „Freunde“ → „In Form“ nur für Freunde, auch wenn der Titel auf
   „Alle“ steht). Prüfung in `profile_view`, nicht nur im Client.
4. **Neutrale Namen** ohne Bezug auf Substanzen oder Körperideale (App-Store-Richtlinien zu
   Substanzen); Text und Namen juristisch prüfen lassen.

Vorschlag **[Claude, ungeprüft]**: In Form / In Shape (−5 % Körperfett) · Formwandler / Shape Shifter
(−10 %) · Neu geformt / Reshaped (−20 %) · Leichter unterwegs / Lighter Steps (−5 % Gewicht) ·
Werte-Kenner / Lab Regular (erstes Blutbild) · Im grünen Bereich / In the Green (alle Blutwerte im
Zielbereich) · Ruhepol / Calm Heart (Ruhepuls −5 bpm) · Konsequent / Consistent (30 Tage alle
Einnahmen bestätigt) · Durchgezogen / Saw It Through (erster Zyklus) · Berichterstatter / Reporter
(erster Erfahrungsbericht) · Auf Kurs / On Track, Im Aufwind / On the Rise, Verwandelt / Transformed
(Gesamtfortschritt +10/+25/+50 %).

## 4. Anzeige und Bedienung **[Nutzer]**, Gestaltung nach Mockup

- **Chip unter dem Namen:** leise Marke, Mono, Großbuchstaben, umrandet; im eigenen Profil mit
  Pfeil, darunter „Rang: noch X Tage mit Eintrag bis …“ (nur der nächste Schritt).
- **Daneben im eigenen Profil der Sichtbarkeits-Chip** wie bei allen Feldern aus 2a
  (Nur ich → Freunde → Alle).
- **Freunde und App-Nutzer:** Antippen des Chips zeigt kurz, was der Titel bedeutet.
- **Sheet „Dein Titel“** — Einstieg über den Chip **und** über Profil › Einstellungen › Titel:
  getragener Titel; Rang mit Leiter und Fortschritt; Titel aus Abzeichen (verdiente wählbar, bei
  Sportarten mit Stufe; offene: die fünf nächsten mit Stand, Rest über „Alle offenen ansehen“);
  persönliche Titel (3.3); „Sichtbar für“; Fußnote „Einmal erreicht, für immer.“
- **Moment „Neuer Rang“** nach dem Speichern des Eintrags, der die Schwelle nimmt: dunkler
  Grund, Hoku-Licht von unten, Chip mit einem Lichtstreif, „Ab heute: Veteran.“; darunter
  **„Wer soll deinen Titel sehen?“ (Nur ich / Freunde / Alle), jedes Mal** **[Nutzer]**; nur
  `transform`/`opacity`, bei „Bewegung reduzieren“ nur Einblenden.
  - Trägt man den Rang: „Fertig“ / „Titel ansehen“. Trägt man einen anderen Titel: „Als Titel
    tragen“ / „Später“.
- **Neuer Abzeichen-Titel oder neue Sportart-Stufe:** derselbe Moment, „Neuer Titel freigeschaltet“
  **[Nutzer: ja]**.
- **Abzeichen-Seite (2b):** tragbare Abzeichen zeigen ihren Titelnamen und „Als Titel tragen“.

## 5. Sichtbarkeit **[Nutzer]**

Der Titel ist ein **Feld `title` mit Stufe wie in 2a**, Standard **„Nur ich“** wie alle Felder
(Art. 25 DSGVO damit erfüllt). Die Feier fragt jedes Mal, wer ihn sehen soll.

| Stufe | ich | Freunde | App-Nutzer | Web und Link-Karte |
|---|---|---|---|---|
| Nur ich | ✓ | – | – | – |
| Freunde | ✓ | ✓ | – | – |
| Alle | ✓ | ✓ | ✓ | ✓, wenn Web-Link an und Profil nicht privat |

- Kein eigener Web-Schalter; Web und Karte folgen der 2c-Regel („Alle“ + Web-Link).
- Persönliche Titel höchstens so sichtbar wie ihr Quellfeld (3.3).
- Die Link-Karte sieht für alle gleich aus (Messenger holt sie ohne Anmeldung).

## 6. Datenmodell **[Claude, ungeprüft]**

- `profiles.title_choice text null`: `null` = Rang tragen, sonst eine tragbare Abzeichen-ID.
  Prüfung per Check-Funktion: nur IDs aus `profile_title_badge_ids()`.
- `profile_badge_ids()` und `BADGE_IDS` um `rank_1`…`rank_6` und die neuen Abzeichen erweitern;
  neue Funktion `profile_title_badge_ids()` (tragbare) und `profile_rank_ids()`.
- `PROFILE_FIELDS` / `profile_fields()` um `title`.
- `profile_view` gibt in jeder Stufe, in der `title` sichtbar ist, `title: { kind: 'rank'|'badge', id }`
  aus: `title_choice` nur, wenn das Abzeichen in `earned_badges` steht, sonst der höchste
  verdiente Rang; Namen kommen aus dem Client (de/en), nie Freitext aus der Datenbank.
- Migration `supabase-profil-titel.sql` nach CLAUDE.md: Datei, Trockenlauf mit Postgres 16
  zweimal, nachzählen, Produktivlauf nur nach ausdrücklichem Ja; Reihenfolge nach 2b und 2c.
- `BadgeFacts` erweitert um `sessionsByKind` (eigene und eingeführte Einheiten je
  `SessionKind`) und `entryCount` (kommt mit 2c).

## 7. Texte

Nur de/en werden geschrieben. Neue Schlüssel bekommen in den übrigen zwölf Sprachen den
englischen Text als Platzhalter (i18n-Vertrag, CLAUDE.md). Datenschutztext Abschnitt
„Profil und Sichtbarkeit“ um den Titel ergänzen.

## Offene Fragen

1. Titelnamen bestätigen (3.1–3.3), auch die Stufen-Zahlen der Sportarten.
2. Persönliche Titel juristisch prüfen: Text der Bestätigung und Namen (3.3).
3. Rang für Nutzer, die schon vor dem Titel-Update getrackt haben (nur wenn die Titel nach dem
   App-Start kommen): nur der aktuelle Rang, ein Moment, keine Feier für Zwischenstufen.
