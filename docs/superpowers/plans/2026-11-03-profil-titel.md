# Profil-Zusatz: Titel — Bauplan

**Goal:** Unter dem Namen steht genau ein Titel (Rang nach Tagen mit eigenem Eintrag oder ein
tragbares Abzeichen), mit Sichtbarkeitsstufe wie jedes Feld, Sheet „Dein Titel“, Moment
„Neuer Rang“ und Anzeige in Web-Vorschau und Link-Karte.

**Architecture:** Ränge und neue Sportart-Abzeichen sind Abzeichen aus `badges.ts` und laufen
durch dieselbe Auswertung (`evaluateBadges`, `earned_badges`). Gewählt wird über
`profiles.title_choice`; `profile_view` gibt den Titel nur als bekannte ID aus und nur in
sichtbaren Stufen. Namen und Texte bleiben im Client (de/en).

**Spec:** `docs/superpowers/specs/2026-11-03-profil-titel-design.md`. Mockup:
`docs/profil/mockups/profil-titel.html`. Entscheidungen: `memory/projects/titel.md`.
Baut auf 2b (PR Kossa97/HOKU-Health-Hub#128) und 2c (Web, Link-Karte) auf; vorher nicht mergen.

## Regeln

- Datenbank nach CLAUDE.md: Migration als Datei, Trockenlauf mit Postgres 16 zweimal mit
  nachgestelltem Ist-Zustand und Zählung, Produktivlauf nur nach ausdrücklichem Ja.
- Keine Titel aus Körper-, Gewichts-, Blut-, Einnahme- oder Berichtsdaten (Test prüft die Liste).
- Texte nur de/en; neue Schlüssel in den zwölf anderen Sprachen mit englischem Platzhalter.
- Nach jeder Codeänderung `graphify update .` (in Cloud-Sitzungen lokal nachziehen).

## Tasks

### Task 1: Abzeichen-IDs und Migration
- [ ] `badgeIds.ts`: Gruppe `rang` (`rank_1`…`rank_6`) und neue IDs (`prs_25`, `steps_weeks_12`,
  `entries_1000`, `run_50`, `cycle_50`, `swim_30`, `row_30`, `hike_25`, `hyrox_20`, `hiit_50`,
  `yoga_50`, `allrounder`); Test „IDs = SQL-Liste“ anpassen.
- [ ] `supabase-profil-titel.sql`: `profile_badge_ids()` erweitern, `profile_title_badge_ids()`,
  `profile_rank_ids()`, `profiles.title_choice` (add column if not exists, Check über die
  tragbaren IDs), `profile_fields()` um `title`, `profile_view`: `title` je Stufe (fehlender
  Schlüssel = „Alle“), nur verdiente Wahl, sonst höchster Rang.
- [ ] Trockenlauf: Schema aus 2a/2b/2c nachbauen, Ist-Zustand mit Beispielzeilen, Migration
  zweimal, Zählungen (IDs, Spalten, `profile_view` je Stufe) festhalten.

### Task 2: Auswertung
- [ ] `BadgeFacts` um `sessionsByKind` (eigene + eingeführte Einheiten) und `entryCount`.
- [ ] `badges.ts`: Ränge (Tage mit Eintrag 1/10/50/100/200/365), neue Abzeichen, Feld
  `title: { de, en }` an tragbaren; `TITLE_BADGES` abgeleitet.
- [ ] Tests: Schwellen, Lücken erlaubt, Wearable-Tage zählen nicht für den Rang, Importe zählen
  für Sportarten, „einmal verdient“, Verbotsliste (keine Gruppe `fortschritt`-Körperwerte,
  keine Blut/Einnahmen/Berichte tragbar), `allrounder`.

### Task 3: Titel im Profil
- [ ] `TitleChip` unter dem Namen (eigenes Profil mit Pfeil und Sichtbarkeits-Chip; Freunde und
  App-Nutzer mit Erklärung beim Antippen), Hinweis „noch X Tage mit Eintrag bis …“.
- [ ] Sichtbarkeit über die bestehende Feld-Logik aus 2a (`useFieldVisibility`), Standard „Alle“.

### Task 4: Sheet „Dein Titel“
- [ ] Bottom-Sheet nach Mockup: getragener Titel, Rang mit Leiter, Titel aus Abzeichen,
  „Sichtbar für“, Fußnote. Schreiben von `title_choice` (null = Rang).
- [ ] Einstieg auch aus Profil › Einstellungen › Titel.
- [ ] Abzeichen-Seite: tragbare zeigen Titelnamen und „Als Titel tragen“.

### Task 5: Moment „Neuer Rang“ / „Neuer Titel freigeschaltet“
- [ ] Nach dem Speichern eines Eintrags: neu verdiente Rang- bzw. tragbare Abzeichen erkennen
  (vorher/nachher), Moment zeigen; Knöpfe je nach getragenem Titel.
- [ ] Erster Start: nur der aktuelle Rang, ein Moment, keine Zwischenstufen.
- [ ] Web Animations API, nur `transform`/`opacity`, Abbruch bei erneutem Abspielen,
  „Bewegung reduzieren“ nur Einblenden.

### Task 6: Web und Link-Karte (nach 2c)
- [ ] Web-Vorschau: Chip unter dem Namen, wenn `title` in der Web-Stufe vorhanden.
- [ ] `api/_lib/profileCard.js`: Titel-Chip auf Fortschritt- und Rückfall-Karte
  (Mono, Großbuchstaben, umrandet; Varianten wie in der Canva-Vorlage Folie 5), Meta-Text ohne Titel.

### Task 7: Texte, Datenschutz, Tests
- [ ] de/en für Ränge, Titelnamen, Sheet, Moment; Platzhalter in den zwölf anderen Sprachen.
- [ ] Datenschutztext „Profil und Sichtbarkeit“: Titel, Standard „Alle“, woraus er entsteht.
- [ ] E2E: Chip und Sichtbarkeit je Sicht (ich, Freunde, App-Nutzer, Web), Sheet-Wahl, Moment
  bei Schwelle, Web zeigt Titel nur auf „Alle“ + Web-Link.

## Offene Punkte vor dem Bau
Siehe Spec „Offene Fragen“ (Titelnamen, Schwellen, Feier für Abzeichen, juristische Freigabe
des Standards „Alle“, erster Start).
