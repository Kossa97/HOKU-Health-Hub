# Profil-Zusatz: Titel (Rang und tragbare Abzeichen) — Design

Stand: 2026-11-03 · Status: Entwurf zur Freigabe · baut auf 2a (Sichtbarkeit), 2b (Abzeichen)
und 2c (Web, Link-Karte) auf.
Mockup: `docs/profil/mockups/profil-titel.html` (Entwurf 3, mit tragbaren Abzeichen und den
Schwellen aus 2). Entscheidungen: `memory/projects/titel.md`.

Kennzeichnung wie in den Profil-Specs: **[Nutzer]** = vom Nutzer entschieden,
**[Claude, ungeprüft]** = Vorschlag, noch nicht bestätigt.

## Absicht

Neben dem Namen steht genau **ein Titel**. Er sagt, wer man auf Hoku ist, passend zu
„Sieh, wer du wirst.“ Abzeichen bleiben Sammelstücke; besondere davon lassen sich als Titel tragen.

Erfolg: Mara sieht unter ihrem Namen „ROUTINIER“ und darunter „noch 30 Tage mit Eintrag bis
Veteran“. Am 200. Tag mit Eintrag erscheint nach dem Speichern der Moment „Neuer Rang: Veteran“.
Sie trägt lieber „Läufer“, wählt das im Sheet „Dein Titel“, und Freunde, App-Nutzer, die
Web-Vorschau und die Link-Karte zeigen „LÄUFER“.

## Nicht-Ziele

- Keine Titel aus Körperwerten, Gewicht, Blutwerten, Einnahmen/Stack oder Erfahrungsberichten.
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
| 100 | Routinier | Regular |
| 200 | Veteran | Veteran |
| 365 | Legende | Legend |

Die Schwellen weichen bewusst von den Serien-Abzeichen (7/30/100/365 Tage ohne Lücke) ab.

Technik **[Claude, ungeprüft]**: Die sechs Stufen sind Abzeichen einer eigenen Gruppe `rang`
(`rank_1` … `rank_6`), ausgewertet von `evaluateBadges` und gespeichert in `earned_badges`.
So gilt „einmal verdient bleibt verdient“ ohne neue Logik, auch wenn Einträge gelöscht werden.
Die Gruppe `rang` erscheint nicht in der Abzeichen-Liste.

## 3. Tragbare Abzeichen **[Nutzer: Konzept, Sportarten, Importe zählen]**, Liste **[Claude, ungeprüft]**

Ein Abzeichen ist tragbar, wenn es in `badges.ts` einen Titelnamen (de/en) hat. Nur Abzeichen
aus unverfänglichem Verhalten.

**Aus 2b, tragbar gemacht:**

| Abzeichen | Titel de / en |
|---|---|
| 100 Tage ohne Lücke (`streak_100`) | Unaufhaltsam / Unstoppable |
| 365 Tage ohne Lücke (`streak_365`) | Eiserner Wille / Iron Will |
| 52 Wochen Training in Folge (`training_weeks_52`) | Ganzjahres-Athlet / Year-Round Athlete |
| 100 Workouts (`workouts_100`) | Trainingstier / Workhorse |
| 10 Freunde (`friends_10`) | Motivator / Motivator |

**Neu (neue IDs, Migration):**

| Abzeichen | Bedingung | Titel de / en |
|---|---|---|
| `prs_25` | 25 Bestleistungen | Kraftpaket / Powerhouse |
| `steps_weeks_12` | 12 Wochen mit Ø ≥ 10.000 Schritten | Schrittmacher / Pacesetter |
| `entries_1000` | 1.000 Einträge | Datenprofi / Data Pro |
| `run_50` | 50 Läufe (`run`) | Läufer / Runner |
| `cycle_50` | 50 Radeinheiten (`cycle`) | Radsportler / Cyclist |
| `swim_30` | 30 Schwimmeinheiten (`swim`) | Schwimmer / Swimmer |
| `row_30` | 30 Rudereinheiten (`row`) | Ruderer / Rower |
| `hike_25` | 25 Wanderungen (`hike`) | Wanderer / Hiker |
| `hyrox_20` | 20 Hyrox-Einheiten (`hyrox`) | Hybrid-Athlet / Hybrid Athlete |
| `hiit_50` | 50 HIIT-Einheiten (`hiit`) | Intervall-Profi / Interval Pro |
| `yoga_50` | 50 Yoga- oder Mobility-Einheiten (`yoga`, `mobility`) | Yogi / Yogi |
| `allrounder` | 5 Arten mit je ≥ 10 Einheiten | Allrounder / All-Rounder |

Sportart-Einheiten zählen **auch aus Apple Health / Health Connect eingeführt** **[Nutzer]**
(`TrainingSession.kind`, Import über `externalId` ohne Doppelte). `strength`, `walk`, `sport`,
`other` bekommen keinen eigenen Titel (Kraft steckt in Kraftpaket, Gehen in Schrittmacher).

**Nie tragbar:** Körperfett, Gewicht, Umfänge, Blutbilder, Blutwerte, Ruhepuls, Einnahmen,
Zyklen, Erfahrungsberichte, Gesamtfortschritt. Grund: Der Titel steht im Web und auf der
Link-Karte; er würde Gesundheitsdaten (Art. 9 DSGVO) oder Substanzen verraten.

## 4. Anzeige und Bedienung **[Nutzer]**, Gestaltung nach Mockup

- **Chip unter dem Namen:** leise Marke, Mono, Großbuchstaben, umrandet; im eigenen Profil mit
  Pfeil, darunter „Rang: noch X Tage mit Eintrag bis …“ (nur der nächste Schritt).
- **Daneben im eigenen Profil der Sichtbarkeits-Chip** wie bei allen Feldern aus 2a
  (Nur ich → Freunde → Alle).
- **Freunde und App-Nutzer:** Antippen des Chips zeigt kurz, was der Titel bedeutet.
- **Sheet „Dein Titel“** — Einstieg über den Chip **und** über Profil › Einstellungen › Titel
  **[Nutzer]**: oben der getragene Titel; „Rang tragen · steigt von selbst mit“ mit Leiter und
  Fortschritt; „Titel aus Abzeichen“ (verdiente wählbar, offene gedimmt mit Stand wie
  „18/25 Bestleistungen“); „Sichtbar für“ mit den drei Stufen; Fußnote „Einmal erreicht, für immer.“
- **Moment „Neuer Rang“** nach dem Speichern des Eintrags, der die Schwelle nimmt: dunkler
  Grund, Hoku-Licht von unten, Chip mit einem Lichtstreif, „Ab heute: Veteran.“; nur
  `transform`/`opacity`, bei „Bewegung reduzieren“ nur Einblenden.
  - Trägt man den Rang: „Fertig“ / „Titel ansehen“.
  - Trägt man ein Abzeichen: „Als Titel tragen“ / „Später“ **[Nutzer: passt so]**.
- **Neues tragbares Abzeichen:** derselbe Moment mit „Neuer Titel freigeschaltet“ und
  „Als Titel tragen“ / „Später“ **[Claude, ungeprüft]**.
- **Abzeichen-Seite (2b):** tragbare Abzeichen zeigen ihren Titelnamen und „Als Titel tragen“.

## 5. Sichtbarkeit **[Nutzer]**

Der Titel ist ein **Feld `title` mit Stufe wie in 2a**, Standard **„Alle“**.

| Stufe | ich | Freunde | App-Nutzer | Web und Link-Karte |
|---|---|---|---|---|
| Nur ich | ✓ | – | – | – |
| Freunde | ✓ | ✓ | – | – |
| Alle | ✓ | ✓ | ✓ | ✓, wenn Web-Link an und Profil nicht privat |

- Kein eigener Web-Schalter; Web und Karte folgen der 2c-Regel („Alle“ + Web-Link).
- Die Link-Karte sieht für alle gleich aus (Messenger holt sie ohne Anmeldung).
- **Abweichung vom Standard „Nur ich“** aus 2a/2b: juristisch prüfen (Art. 25 DSGVO,
  datenschutzfreundliche Voreinstellung). Vertretbar, weil der Titel nur aus unverfänglichen
  Abzeichen entsteht; im Datenschutztext und beim ersten Rang erwähnen. **[Claude, ungeprüft]**
- Technik: Fehlt `title` in `field_visibility`, gilt „Alle“ (Sonderfall nur für dieses Feld,
  ohne Datenänderung an bestehenden Zeilen). **[Claude, ungeprüft]**

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

1. Titelnamen der tragbaren Abzeichen bestätigen (Tabellen in 3).
2. Schwellen der neuen Sportart-Abzeichen bestätigen (50/30/25/20).
3. Feier auch für neue tragbare Abzeichen (Vorschlag 4)?
4. Standard „Alle“ juristisch freigeben lassen (5).
5. Rang für bestehende Nutzer beim ersten Start: aus der vorhandenen Eintragshistorie sofort
   berechnen, ohne Feier für alle Zwischenstufen (Vorschlag: nur der aktuelle Rang, ein Moment).
