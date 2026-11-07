# Profil, Teilprojekt 2a: Sichtbarkeit, neues Profil, Einstellungen, Bild-Check — Bauplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Jeder Profilwert hat eine eigene Stufe (Nur ich / Freunde / Alle). Das Profil ist ein Schaufenster im Aufbau von `profil-v3.html`, alles Einstellbare liegt hinter ⚙︎. Andere sehen nur Freigegebenes, gefiltert auf dem Server. Bilder erst nach Bild-Check. `/u/<name>` zeigt ohne Anmeldung keine Erfahrungsberichte mehr.

**Architecture:** Eine Migration legt Sichtbarkeit, Schnappschuss-Tabelle, Bildstatus, Muskelmasse und Trainingsauswahl an, dazu `profile_view` (security definer), eine Storage-Policy für fremde Bilder und die angepasste Berichte-Funktion. Das Gerät des Nutzers berechnet seine Profilwerte mit der vorhandenen App-Logik und schreibt sie als Schnappschuss; `profile_view` filtert ihn nach Stufe des Betrachters. Reine, getestete Module: `profileVisibility.ts` (Felder, Stufen, Layoutregel), `profileSnapshot.ts` (Werte aus App-Daten). Der Bild-Check ist eine Supabase-Funktion wie `food-photo`.

**Tech Stack:** React 19 + TypeScript, Vite, Vitest, Playwright (Mock-Supabase), Supabase (Postgres 16, Storage, RLS, Edge Functions in Deno), Claude `claude-haiku-5-5`, react-i18next.

**Spec:** `docs/superpowers/specs/2026-10-31-profil-p2a-sichtbarkeit-design.md`. Mockup: `docs/profil/mockups/profil-2a.html`. Gesamtfortschritt, Abzeichen (2b), volle Web-Vorschau, QR (2c) sind **nicht** Teil dieses Plans.

## Global Constraints

- Datenbank nach `CLAUDE.md`: Migration `supabase-profil-p2a-sichtbarkeit.sql`, idempotent; Trockenlauf mit Postgres 16 (`/usr/lib/postgresql/16/bin`, als `postgres` unter `/var/tmp/...`), Ist-Zustand nachstellen (inkl. P1-Spalten und je ein Profil mit `is_public` true/false), **zweimal** laufen lassen, nachzählen. Gegen Produktion erst nach ausdrücklichem Ja; danach dieselbe Zählung, Ergebnis berichten.
- Kein `drop`, `truncate`, `delete` ohne `where`, `update` ohne `where`, `alter … drop column`. `is_public` und `share_*` bleiben stehen.
- Verborgenes verlässt den Server nie: Fremde Profile nur über `profile_view`, nie per `select` auf `profiles` oder `profile_snapshots`.
- Substanznamen erscheinen im Profil nie, auch nicht im Schnappschuss.
- Texte: neue Schlüssel in `de.json` und `en.json` ausformuliert, in den zwölf übrigen Locales mit dem englischen Text; `src/features/my-stack/lib/i18n.test.ts` grün halten.
- Look: Soft Dark, vorhandene Bausteine (`card`, `GlassSegmented`, `Schalter`, Sheets mit `useSheetPresence`); Chips, Kacheln, Karten nach `profil-v3.html`.
- Nach jeder Aufgabe mit Codeänderung `graphify update .`, Graph in eigenem Commit. Commit-Trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Brand-Dateien (`docs/logo/hoku/**`) nicht anfassen.

## Review Focus

1. **Leck über den Server:** Ein Feld auf „Nur ich“ taucht in keiner Antwort von `profile_view` für einen anderen Nutzer auf, auch nicht als `null`-Schlüssel. (Task 1, Task 3)
2. **Stufe „Freunde“ vor Teilprojekt 3:** Ein anderer angemeldeter Nutzer sieht Felder auf „Freunde“ **nicht**. (Task 1)
3. **Blockieren beidseitig:** Wer blockiert hat oder blockiert wurde, bekommt nur `{ blocked: true }`. (Task 1)
4. **Bildstatus nicht fälschbar:** Ein `update profiles set avatar_status = 'approved'` des Eigentümers wirkt nicht; ein neuer Pfad setzt den Status auf `pending`. (Task 1)
5. **Ohne Anmeldung:** `/u/<name>` liefert keine Erfahrungsberichte; bei Web-Link aus dieselbe Antwort wie für ein unbekanntes Konto. (Task 1, Task 7)
6. **Freitext im Schnappschuss:** Routinename und eigene Übungsnamen (`routine`, `favorite_exercise`, `e1rm`) sind Freitext des Nutzers. Bevor sie für andere sichtbar werden, laufen sie durch `oeffentlicher_text_fehler` (in `profile_view` oder beim Speichern des Schnappschusses); sonst gehen nur Katalognamen hinaus. (Task 5, Task 7)
7. **Symmetrie:** 1, 2, 3, 4, 5 sichtbare Werte und Paare halber Karten ergeben nie eine leere Zelle. (Task 2, Task 5)

---

### Task 1: Migration und Trockenlauf

**Files:**
- Create: `supabase-profil-p2a-sichtbarkeit.sql`

**Interfaces (Datenbank):**
- `profiles.field_visibility jsonb not null default '{}'` — Prüfung per Funktion: Schlüssel ∈ Feldliste (Task 2), Werte ∈ `friends`, `all`.
- `profiles.profile_private boolean not null default false`, `profiles.web_link_enabled boolean not null default false`
- `profiles.avatar_status text`, `profiles.cover_status text` — ∈ `pending`, `approved`, `rejected`; Trigger: neuer Pfad → `pending`, kein Pfad → `null`; Änderungen am Status durch den Eigentümer werden verworfen (Muster `protect_profile_admin_flag`).
- `profiles.favorite_exercise text`, `profiles.profile_routine_id uuid references training_routines(id) on delete set null`
- `daily_logs.muscle_mass_kg numeric(4,1)` mit `check (muscle_mass_kg between 10 and 150)`
- Tabelle `profile_snapshots(user_id uuid primary key references auth.users on delete cascade, data jsonb not null, updated_at timestamptz not null default now())`, RLS `for all using (auth.uid() = user_id) with check (auth.uid() = user_id)`
- Funktion `profile_view(p_username text, p_as text default null) returns jsonb` (security definer, `search_path` fest): Profil auflösen wie `public_profile_reviews`; ausgeblendet/blockiert (beide Richtungen) → `{ "blocked": true }` bzw. „nicht gefunden“; Stufe des Betrachters: Eigentümer alles (oder `p_as`), angemeldet → nur `all`, ohne Anmeldung → nur bei `web_link_enabled` und nicht privat: Name, Nickname, Profilbild-Pfad (freigegeben), Bio bei `all`. Gibt nur Schlüssel freigegebener Felder zurück.
- Funktion `profile_media_visible(p_name text) returns boolean` und Storage-Policy `select` auf `profile-media` für `authenticated` und `anon` damit.
- `public_profile_reviews`: nur angemeldet, nur bei Feld `berichte` = `all`.
- `check_public_profile_text`: Bio prüfen, sobald `field_visibility ? 'bio'`.
- Bestand: `update profiles set field_visibility = field_visibility || '{"bio":"all","berichte":"all"}', web_link_enabled = true where is_public = true`.

- [ ] **Step 1:** Datei schreiben (`add column if not exists`, Constraints über `pg_constraint`, `create or replace function`, `drop policy if exists` + `create policy`). Kopfkommentar mit Zählabfragen.
- [ ] **Step 2:** Trockenlauf unter `/var/tmp/profil-p2a`: Minimalschema (inkl. `auth.uid()`-Stub, der eine Sitzungsvariable liest, `storage.*`, `profiles` mit P1-Spalten, `user_blocks`, `reviews`, `training_routines`, `daily_logs`), 3 Profile (einer `is_public = true`), zweimal laufen lassen.
- [ ] **Step 3:** Nachzählen und Proben: Spalten, Tabelle mit RLS, Policies; Profilzahl gleich; nur das öffentliche Profil hat `bio`/`berichte` = `all` und Web-Link an. Proben für Review Focus 1–5 als SQL (Betrachter über die Sitzungsvariable wechseln).
- [ ] **Step 4:** Commit. **Anhalten:** dem Nutzer die Zählung zeigen, Ja für Produktion abwarten, dann ausführen, nachzählen, berichten.

### Task 2: Felder, Stufen und Layoutregel

**Files:**
- Create: `src/features/profil/lib/profileVisibility.ts`, `profileVisibility.test.ts`

**Interfaces:**
- `PROFILE_FIELDS` (30 Schlüssel, Bereich, i18n-Schlüssel), `type Visibility = 'me' | 'friends' | 'all'`, `visibilityOf(map, key)`, `cycleVisibility(v)`, `setSection(map, section, v)`.
- `tileLayout(keys, isLongText) → 'r1' | 'r3' | 'r2' | 'r2-rest'`, `pairCards(cards) → Array<Card | [Card, Card]>`.

- [ ] Tests zuerst: Standard „me“, Kreislauf, Bereich setzen, Layout für 1–8 Werte, Umfänge nie in Dreierreihe, Paare nur bei direkt aufeinanderfolgenden Ein-Wert-Karten. Feldliste identisch mit der SQL-Prüfung (Test liest die Migration).

### Task 3: Schnappschuss

**Files:**
- Create: `src/features/profil/lib/profileSnapshot.ts` (+ Test), `src/features/profil/hooks/useProfileSnapshotSync.ts` (+ Test)
- Modify: `src/components/Layout.tsx` (Hook einhängen)

- [ ] Werte aus vorhandener Logik: Alter (`birth_date`), Größe, Gewicht + Änderung seit Start (`weight_logs`), KFA und Muskelmasse (`daily_logs`), Umfänge (`body_measurements`), Adherence 90 Tage und bestätigt/verpasst (Logik aus `features/fortschritt`), Substanzen + aktive Zyklen (nur Zahlen), Blutmarker + im Zielbereich, Tageswerte Ø 7 Tage aus `health_daily`, Workouts + pro Woche, gewählte Routine und Lieblingsübung, Top-3-e1RM (`progressModel`), Berichte-Zahl + Schnitt, Streak.
- [ ] Felder ohne Wert fehlen im Schnappschuss. Schreiben entprellt nach App-Start und nach eigenen Einträgen; ohne Änderung kein Schreiben.

### Task 4: Muskelmasse im Tageseintrag

**Files:**
- Modify: `src/features/fortschritt/components/TodayLogSheet.tsx`, Verlauf (`metricDefinitions.ts`, `buildAvailableMetrics`), Tests

- [ ] Feld „Muskelmasse (kg)“ neben KFA, wie KFA vorbelegt, Komma erlaubt, Grenzen 10–150; im Verlauf auswählbar.

### Task 5: Neues eigenes Profil

**Files:**
- Create: `src/features/profil/components/ProfilKopf.tsx`, `ProfilKarten.tsx`, `SichtbarkeitsChip.tsx` (+ Tests)
- Modify: `src/pages/Profil.tsx` (wird Schaufenster), `src/features/profil/components/UeberDichKarte.tsx` (Bearbeiten-Sheet)

- [ ] Aufbau nach Spec Abschnitt 2 und Mockup; Chips schalten Stufen und speichern sofort (`field_visibility`), Fehler → Rückgängig + Meldung.
- [ ] „Bearbeiten“-Sheet: Bio, Ziele, Land, Geschlecht, Bilder (aus P1), Lieblingsübung, Routine.
- [ ] Herkunft als Flagge + Kürzel neben dem Namen; Über mich als Dreierreihe.

### Task 6: Einstellungen-Bildschirm

**Files:**
- Create: `src/pages/ProfilEinstellungen.tsx`, `src/features/profil/components/WerSiehtWas.tsx`, `BlockiertListe.tsx` (+ Tests)
- Modify: `src/App.tsx` (Routen `/profil/einstellungen`, `/profil/sichtbarkeit`, `/profil/blockiert`), `src/features/compliance/components/AccountSection.tsx`

- [ ] Inhalt nach Spec Abschnitt 3. Alles, was heute auf der Profilseite steht und kein Schaufenster ist, zieht hierher; nichts geht verloren (Test: jeder bisherige Abschnitt ist erreichbar).
- [ ] Schalter „öffentliches Profil“ und `share_*` entfernen.

### Task 7: Fremdes Profil und Web-Link

**Files:**
- Modify: `src/pages/PublicProfile.tsx` (liest `profile_view`, gleiche Kartenkomponenten ohne Chips), Tests, `e2e/support/mockSupabase.ts`

- [ ] Angemeldet: App-Ansicht mit ⋯ (Melden/Blockieren wie heute), Berichte nur bei Freigabe.
- [ ] Ohne Anmeldung: Profilbild, Name, Nickname, Bio bei „Alle“, „In Hoku öffnen“; sonst „Seite nicht gefunden“.
- [ ] „Ansehen als“: eigene Seite mit `p_as`.

### Task 8: Bild-Check

**Files:**
- Create: `supabase/functions/profile-image-check/index.ts`, `check.ts`, `check.test.ts`
- Modify: `src/features/profil/services/profileMedia.ts`, `ProfilBilder.tsx` (+ Tests)

- [ ] Funktion: Nutzer aus dem Token, Pfad aus `profiles` (nie aus dem Request), Bild laden, Claude fragen (striktes JSON `{ "zeigbar": boolean }`), Status setzen; abgelehnt → Datei löschen, Pfad `null`. Höchstens 20 Prüfungen pro Tag und Nutzer.
- [ ] Client: nach Upload prüfen lassen; „wird geprüft“ am Bild; abgelehnt → Hinweis „Anderes wählen“; offene Prüfungen beim Öffnen des eigenen Profils nachholen.

### Task 9: Datenschutz, Texte, Browser-Tests

**Files:**
- Modify: `src/pages/Legal.tsx` (+ Test), `src/i18n/locales/*.json`, `e2e/` (neue Spec `profil-sichtbarkeit.spec.ts`)

- [ ] Datenschutz de/en: Sichtbarkeit, Schnappschuss, Bild-Check über Anthropic (USA), Web-Link.
- [ ] Browser-Tests: Chip umschalten → „Ansehen als Alle“ zeigt den Wert; „Nur ich“ → Wert und Karte weg, keine Lücke; privates Profil; Web ohne Anmeldung ohne Berichte; Bild „wird geprüft“.

### Task 10: Abschluss

- [ ] `npm test`, `npm run lint`, `npm run build`, `npm run test:e2e` (Chromium lokal).
- [ ] `graphify update .`, `code-review`, `security-review` (Sichtbarkeit, Storage-Policy, Edge Function).
- [ ] Projektgedächtnis `memory/projects/profil.md` nachziehen, PR nach `main`.
