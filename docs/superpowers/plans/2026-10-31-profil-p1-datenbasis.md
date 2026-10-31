# Profil, Teilprojekt 1: Datenbasis — Bauplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Die App erfasst Umfänge, Ziel-Tags, Land, Profil-Geschlecht, Profil- und Titelbild und speichert Wearable-Tageswerte mit Einwilligung — auf iOS und auf Android (Health Connect, neu eingerichtet).

**Architecture:** Eine Migration legt Spalten, zwei Tabellen und einen privaten Bucket an. Fachlogik steckt in reinen, getesteten Modulen (`measurements.ts`, `profileFields.ts`, `healthDaily.ts`); die Oberfläche hängt sich an bestehende Stellen (Tageseintrag im Fortschritt, Verlauf, Profilseite, Registrieren, `/health`). Der Wearable-Abgleich läuft als Hook im Layout, nur mit Einwilligung, und fragt nie selbst nach Berechtigungen.

**Tech Stack:** React 19 + TypeScript, Vite, Vitest, Supabase (Postgres 16, Storage, RLS), Capacitor mit `@perfood/capacitor-healthkit` (iOS) und `capacitor-health-connect` 0.7 (Android), react-i18next mit `src/i18n/locales/*.json`.

**Spec:** `docs/superpowers/specs/2026-10-31-profil-p1-datenbasis-design.md` (Gesamtbild: `…-profil-social-gesamtbild-design.md`). HRV, VO2max und Schlaf auf Android (Schritt 1b der Spec) sind **nicht** Teil dieses Plans.

## Global Constraints

- Datenbank nach `CLAUDE.md`: Migration als Datei `supabase-profil-p1-datenbasis.sql`, idempotent; Trockenlauf mit Postgres 16 (`/usr/lib/postgresql/16/bin`, als `postgres` unter `/var/tmp/...`), Ist-Zustand nachstellen, **zweimal** laufen lassen, nachzählen. Gegen das echte Projekt erst nach ausdrücklichem Ja des Nutzers; danach dieselbe Zählung, Ergebnis berichten.
- Kein `drop`, `truncate`, `delete` ohne `where`, `update` ohne `where`, `alter … drop column`.
- RLS auf jeder neuen Tabelle: `for all using (auth.uid() = user_id) with check (auth.uid() = user_id)`. Bucket `profile-media` ist **privat**, Zugriff nur auf `<user_id>/…`.
- Texte: neue Schlüssel in `de.json` und `en.json` ausformuliert, in den zwölf übrigen Locales mit dem **englischen** Text. Bestehende Texte der zwölf nicht ändern.
- Alles freiwillig: kein neues Pflichtfeld, Registrieren klappt ohne Geschlecht.
- `profiles.gender` und `profiles.age` nicht anfassen (werden von Ernährung und `/health` gelesen). `body_metrics` nicht anfassen.
- Zyklus, Blutzucker, Medikamente, Temperatur werden **nicht** gelesen.
- Look: Soft Dark, vorhandene Bausteine (`card`, `GlassSegmented`, `Schalter`, `lg-gray-btn`, Sheets mit `useSheetPresence`).
- Nach jeder Aufgabe mit Codeänderung `graphify update .`, Graph in eigenem Commit. Commit-Trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Branch `profil-p1-datenbasis`. Die Brand-Kit-Änderungen im Arbeitsverzeichnis nicht committen.

## Review Focus

1. **Tageseintrag ohne Umfänge:** Jemand trägt nur Energie ein, die Umfänge-Hinweise zeigen alte Werte → es entsteht **keine** Zeile in `body_measurements`. (Task 4)
2. **Komma statt Punkt und Unsinn:** „84,5“ wird 84.5; „0“, „-3“, „800“ werden abgelehnt mit Meldung, nichts gespeichert. (Task 2, Task 4)
3. **Tagesgrenze bei Wearables:** Schlaf von 23:30 bis 7:00 zählt zum Tag des Aufwachens; Messungen werden nach **lokaler** Zeit einem Tag zugeordnet, nicht UTC. (Task 7)
4. **SpO2 als Bruch:** HealthKit liefert 0.97, Health Connect 97 → gespeichert wird immer 97. (Task 7)
5. **Einwilligung widerrufen auf Gerät A, Abgleich läuft auf Gerät B:** Der Abgleich liest die Einwilligung vor jedem Lauf frisch und schreibt ohne sie nichts. (Task 8)

---

### Task 1: Migration und Trockenlauf

**Files:**
- Create: `supabase-profil-p1-datenbasis.sql`

**Interfaces:**
- Produces (Datenbank):
  - `profiles.goals text[] not null default '{}'` — Prüfung: jedes Element ∈ `fettabbau, muskelaufbau, recomp, kraft, ausdauer, longevity, blutwerte, schlaf, wohlbefinden`
  - `profiles.country text` — Prüfung `country ~ '^[A-Z]{2}$'`
  - `profiles.profile_gender text` — Prüfung ∈ `male, female, diverse` (null = keine Angabe)
  - `profiles.avatar_path text`, `profiles.cover_path text`
  - `profiles.measurement_sites text[] not null default '{}'` — Prüfung gegen die Stellenliste aus Task 2
  - `profiles.health_store_consent_at timestamptz`
  - Tabelle `body_measurements(id uuid pk default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, measured_on date not null, site text not null, value_cm numeric(5,1) not null check (value_cm between 10 and 250), created_at timestamptz default now(), unique (user_id, measured_on, site))`, Prüfung `site` gegen die Stellenliste; Index `(user_id, measured_on)`
  - Tabelle `health_daily(user_id uuid not null references auth.users on delete cascade, day date not null, steps int, resting_hr numeric(5,1), sleep_min int, active_kcal int, spo2_pct numeric(4,1), resp_rate numeric(4,1), bp_sys int, bp_dia int, source text not null check (source in ('healthkit','health_connect')), updated_at timestamptz default now(), primary key (user_id, day))`
  - Bucket `profile-media` (`public = false`), Policies für select/insert/update/delete mit `(storage.foldername(name))[1] = auth.uid()::text`
- Stellenliste (Schlüssel): `neck, chest, waist, belly, hips, upper_arm, forearm, thigh, calf`

- [ ] **Step 1:** Datei schreiben, nur `add column if not exists`, `create table if not exists`, Constraints per `do $$ … if not exists (select 1 from pg_constraint where conname = …)`, `drop policy if exists` + `create policy`, `insert into storage.buckets … on conflict (id) do nothing`. Kopfkommentar mit den Zählabfragen (wie in `supabase-store-compliance-sql-editor.sql`).
- [ ] **Step 2:** Trockenlauf: Cluster unter `/var/tmp/profil-p1` als `postgres` starten; Minimalschema nachbauen (`auth.users`, `auth.uid()`-Stub, `storage.buckets`, `storage.objects`, `storage.foldername`, `profiles` mit den heutigen Spalten aus `supabase-schema.sql` + `birth_date`, `bio_sex`, `ai_food_consent_at`) und 3 Nutzerzeilen mit Profil einspielen. Migration **zweimal** laufen lassen.
- [ ] **Step 3:** Nachzählen. Erwartet nach Lauf 1 und Lauf 2 identisch: 7 neue Spalten in `profiles`, 2 neue Tabellen mit RLS an (`relrowsecurity = true`), 1 Bucket `profile-media` mit `public = false`, 3 Profilzeilen unverändert (`count(*) = 3`, `goals = '{}'`). Ein Insert mit `site = 'nose'` und einer mit `value_cm = 0` scheitern.
- [ ] **Step 4:** Commit der SQL-Datei. **Dann anhalten:** dem Nutzer die Zählung zeigen und fragen, ob die Migration gegen das echte Projekt laufen darf. Erst nach Ja ausführen, dieselbe Zählung wiederholen (Profilzeilen vorher/nachher gleich) und berichten.

### Task 2: Umfänge — Fachlogik

**Files:**
- Create: `src/features/fortschritt/lib/measurements.ts`
- Test: `src/features/fortschritt/lib/measurements.test.ts`
- Modify: `src/features/fortschritt/types.ts` (Typ `BodyMeasurementEntry`)

**Interfaces:**
- Produces:
  - `type MeasurementSite = 'neck' | 'chest' | 'waist' | 'belly' | 'hips' | 'upper_arm' | 'forearm' | 'thigh' | 'calf'`
  - `const MEASUREMENT_SITES: readonly MeasurementSite[]` (Reihenfolge wie oben)
  - `interface BodyMeasurementEntry { measured_on: string; site: MeasurementSite; value_cm: number }`
  - `parseCircumference(input: string): number | null` — Komma oder Punkt, eine Nachkommastelle, gültig 10–250, sonst `null`
  - `measurementMetricKey(site: MeasurementSite): string` → `` `umfang:${site}` ``
  - `siteFromMetricKey(key: string): MeasurementSite | null`
  - `measurementSeries(entries: BodyMeasurementEntry[], site: MeasurementSite, range: DateRange): SeriesPoint[]` — aufsteigend nach Datum, nur im Bereich
  - `lastMeasurementBefore(entries: BodyMeasurementEntry[], site: MeasurementSite, date: string): number | null`
  - `measurementRowsToSave(userId: string, date: string, typed: Partial<Record<MeasurementSite, number>>): { user_id: string; measured_on: string; site: MeasurementSite; value_cm: number }[]` — nur eingetragene Stellen

- [ ] **Step 1: Tests schreiben**

```ts
expect(parseCircumference('84,5')).toBe(84.5)
expect(parseCircumference(' 84.54 ')).toBe(84.5)
expect(parseCircumference('0')).toBeNull()
expect(parseCircumference('-3')).toBeNull()
expect(parseCircumference('800')).toBeNull()
expect(parseCircumference('')).toBeNull()
expect(siteFromMetricKey(measurementMetricKey('waist'))).toBe('waist')
expect(siteFromMetricKey('weight')).toBeNull()
expect(siteFromMetricKey('umfang:nose')).toBeNull()
expect(measurementRowsToSave('u1', '2026-10-31', {})).toEqual([])
expect(measurementRowsToSave('u1', '2026-10-31', { waist: 84 })).toEqual([{ user_id: 'u1', measured_on: '2026-10-31', site: 'waist', value_cm: 84 }])
// measurementSeries: Einträge außerhalb des Bereichs und anderer Stellen fehlen, Sortierung aufsteigend
// lastMeasurementBefore: nimmt den jüngsten Eintrag VOR dem Datum, nicht am Datum
```

- [ ] **Step 2:** `npx vitest run src/features/fortschritt/lib/measurements.test.ts` → FAIL (Modul fehlt).
- [ ] **Step 3:** Implementieren.
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5:** Commit.

### Task 3: Umfänge im Verlauf

**Files:**
- Modify: `src/features/fortschritt/hooks/useFortschrittData.ts` (laden), `src/features/fortschritt/types.ts` (State-Feld `measurements: BodyMeasurementEntry[]`), `src/features/fortschritt/lib/metrics.ts` (`buildMetricSeries`), `src/features/fortschritt/lib/metricDefinitions.ts` (`buildAvailableMetrics`), `src/features/fortschritt/lib/metricLabels.ts`, `src/features/fortschritt/components/verlauf/VerlaufSection.tsx`, Locales
- Test: `src/features/fortschritt/lib/metrics.test.ts` (erweitern), `src/features/fortschritt/lib/metricDefinitions.test.ts` (neu)

**Interfaces:**
- Consumes: Task 2 (`measurementSeries`, `measurementMetricKey`, `siteFromMetricKey`, `MEASUREMENT_SITES`).
- Produces:
  - `buildMetricSeries(key, range, weights, dailyLogs, bloodwork, measurements: BodyMeasurementEntry[] = [])` — für `umfang:*`-Schlüssel die Umfangsreihe, sonst wie bisher
  - `buildAvailableMetrics(pointCounts, labMarkers, labUnits)` liefert zusätzlich je Stelle mit Punkten einen Eintrag `{ key: 'umfang:<site>', label, unit: 'cm', color, isLab: false }`, platziert nach Gewicht/KFA und vor den Laborwerten
  - Locale-Schlüssel `umfang_<site>` (de: Hals, Brust, Taille, Bauch, Hüfte, Oberarm, Unterarm, Oberschenkel, Wade; en: Neck, Chest, Waist, Belly, Hips, Upper arm, Forearm, Thigh, Calf), `umfaenge_title` (Umfänge / Measurements)

- [ ] **Step 1: Tests:** `buildMetricSeries('umfang:waist', …, measurements)` liefert die Taille-Punkte; `buildMetricSeries('weight', …)` unverändert ohne 6. Argument; `buildAvailableMetrics` mit `pointCounts` `{weight: 2, 'umfang:waist': 1}` enthält `umfang:waist` mit `unit: 'cm'` direkt nach `weight`; Stelle mit 0 Punkten fehlt.
- [ ] **Step 2:** Tests → FAIL.
- [ ] **Step 3:** Implementieren. `useFortschrittData` lädt `body_measurements` (`select('measured_on, site, value_cm')`, eigene Zeilen, `collectPagedRows`, aufsteigend) parallel zu den anderen Abfragen; `VerlaufSection` zählt Punkte je Stelle wie bei den Laborwerten und reicht `state.measurements` an `buildMetricSeries` durch; `metricLabel` übersetzt `umfang:*` über `umfang_<site>`.
- [ ] **Step 4:** `npx vitest run src/features/fortschritt` → PASS.
- [ ] **Step 5:** Commit.

### Task 4: Umfänge im Tageseintrag

**Files:**
- Modify: `src/features/fortschritt/components/TodayLogSheet.tsx`, `src/features/fortschritt/FortschrittPage.tsx` (Messstellen + Einträge durchreichen), Locales
- Create: `src/features/fortschritt/components/MeasurementSection.tsx`
- Test: `src/features/fortschritt/components/TodayLogSheet.test.ts` (erweitern), `src/features/fortschritt/components/MeasurementSection.test.tsx`

**Interfaces:**
- Consumes: Task 2 (`parseCircumference`, `lastMeasurementBefore`, `measurementRowsToSave`), Task 1 (`profiles.measurement_sites`).
- Produces: `MeasurementSection({ sites, entries, date, typed, onTyped, onSitesChange })` — einklappbar, Überschrift `umfaenge_title`; ohne gewählte Stellen nur der Knopf „Messstellen wählen“ (`umfaenge_choose_sites`), der eine Mehrfachauswahl aller neun Stellen öffnet und `profiles.measurement_sites` speichert.

- [ ] **Step 1: Tests:** (a) Feld zeigt den letzten Wert als `placeholder`, `value` ist leer. (b) Ungültige Eingabe zeigt `umfaenge_invalid` und blockiert Speichern. (c) Quelltext-Test wie die bestehenden: `measurementRowsToSave` wird nur mit `typed` aufgerufen, Upsert auf `body_measurements` mit `onConflict: 'user_id,measured_on,site'`. (d) „Mindestens ein Wert“ zählt eine eingetragene Stelle mit (nur Umfang eintragen ist erlaubt).
- [ ] **Step 2:** Tests → FAIL.
- [ ] **Step 3:** Implementieren. Speichern der Umfänge **nach** Tageswerten und Gewicht; scheitert es, bleibt das Sheet offen mit `umfaenge_save_failed` (gleiches Muster wie `weightFailed`, inkl. `partiallySavedRef`). Datum wechseln leert `typed`.
- [ ] **Step 4:** `npx vitest run src/features/fortschritt` → PASS.
- [ ] **Step 5:** Commit.

### Task 5: Ziel-Tags, Land, Profil-Geschlecht (Profilseite und Registrieren)

**Files:**
- Create: `src/features/profil/lib/profileFields.ts`, `src/features/profil/components/UeberDichKarte.tsx`
- Test: `src/features/profil/lib/profileFields.test.ts`
- Modify: `src/pages/Profil.tsx` (Karte unter dem Avatar-Bereich, vor „Profil teilen“), `src/pages/Auth.tsx` (Registrieren), `src/features/compliance/components/ConsentGate.tsx` (Profilzeile aus Metadaten), Locales

**Interfaces:**
- Produces:
  - `type GoalTag = 'fettabbau' | 'muskelaufbau' | 'recomp' | 'kraft' | 'ausdauer' | 'longevity' | 'blutwerte' | 'schlaf' | 'wohlbefinden'`, `const GOAL_TAGS: readonly GoalTag[]`
  - `type ProfileGender = 'male' | 'female' | 'diverse'`
  - `genderSymbol(g: ProfileGender | null): string | null` → `♂`, `♀`, `⚧` (Platzhalter, bis der Nutzer sein Zeichen liefert), `null`
  - `geschlechtFelder(g: ProfileGender | null): { profile_gender: ProfileGender | null; bio_sex?: 'male' | 'female' }` — `bio_sex` nur bei male/female
  - `countryOptions(locale: string): { code: string; name: string; flag: string }[]` — alle ISO-Codes aus einer festen Liste in der Datei, Namen über `Intl.DisplayNames(locale, { type: 'region' })`, sortiert nach Name, Flagge aus Regional-Indicator-Zeichen
  - `isCountryCode(v: string): boolean`
  - Locale-Schlüssel `ziel_<tag>` (de: Fettabbau, Muskelaufbau, Recomp, Kraft, Ausdauer, Longevity, Blutwerte optimieren, Schlaf & Erholung, Wohlbefinden; en: Fat loss, Muscle gain, Recomp, Strength, Endurance, Longevity, Optimise bloodwork, Sleep & recovery, Wellbeing), `geschlecht_male/female/diverse/none` (Männlich/Weiblich/Divers/Keine Angabe; Male/Female/Diverse/Prefer not to say), `profil_ueber_dich`, `profil_ziele`, `profil_land`, `profil_land_suchen`, `profil_geschlecht`, `register_geschlecht_frage` (de: „Geschlecht (freiwillig)“, en: „Gender (optional)“)

- [ ] **Step 1: Tests:** `geschlechtFelder('female')` → `{ profile_gender: 'female', bio_sex: 'female' }`; `geschlechtFelder('diverse')` → `{ profile_gender: 'diverse' }` ohne `bio_sex`; `geschlechtFelder(null)` → `{ profile_gender: null }`; `genderSymbol(null)` → `null`; `countryOptions('de')` enthält `{ code: 'DE', name: 'Deutschland', flag: '🇩🇪' }`; `isCountryCode('de')` → false, `'DE'` → true.
- [ ] **Step 2:** Tests → FAIL.
- [ ] **Step 3:** Implementieren.
  - `UeberDichKarte`: Ziel-Tags als **eine wischbare Zeile** (`overflow-x: auto`, Tags umschaltbar, keine Obergrenze); Land mit Suchfeld und Liste in einem Sheet, „Keine Angabe“ zuerst; Geschlecht als `GlassSegmented` mit vier Werten. Speichert sofort per `update` der eigenen Zeile, Fehler als Toast. Ändert `bio_sex` **nicht**.
  - Name im Profil-Kopf bekommt rechts `genderSymbol(...)` in `--lg-text-3`, klein; „keine Angabe“ zeigt nichts.
  - `Auth.tsx` Registrieren: zwischen Passwort-Wiederholung und Zustimmung eine Zeile mit vier Chips (Männlich, Weiblich, Divers, Keine Angabe; vorgewählt: keine), Label `register_geschlecht_frage`. Wert geht als `profile_gender` in `options.data` von `signUp` und mit `geschlechtFelder(...)` in das `profiles`-Upsert.
  - `ConsentGate`: beim Anlegen der Profilzeile aus Metadaten `geschlechtFelder(meta.profile_gender)` mitschreiben, wenn der Wert gültig ist.
  - Blutwerte: Bei divers oder keine Angabe bleibt `bio_sex` leer; die Nachfrage übernimmt der vorhandene Hinweis auf `BlutwertePage` (`zeigeBioHinweis`, Zeile ~205). Keine neue Abfrage bauen, nur prüfen, dass er bei leerem `bio_sex` erscheint.
- [ ] **Step 4:** `npx vitest run src/features/profil src/features/compliance src/features/auth` → PASS; `npx vitest run src/features/my-stack/lib/i18n.test.ts` → PASS.
- [ ] **Step 5:** Commit.

### Task 6: Profilbild und Titelbild

**Files:**
- Create: `src/features/profil/services/profileMedia.ts`, `src/features/profil/components/ProfilBilder.tsx`
- Test: `src/features/profil/services/profileMedia.test.ts`, `src/features/compliance/services/account.test.ts` (erweitern)
- Modify: `src/pages/Profil.tsx` (Avatar-Bereich ersetzen), `src/features/compliance/services/account.ts` (`nutzerOrdner`), Locales

**Interfaces:**
- Consumes: Task 1 (`profile-media`, `avatar_path`, `cover_path`).
- Produces:
  - `type MediaKind = 'avatar' | 'cover'`
  - `targetSize(w: number, h: number, kind: MediaKind): { sx: number; sy: number; sw: number; sh: number; outW: number; outH: number }` — mittiger Zuschnitt auf 1:1 (avatar, Ausgabe 512×512) bzw. 3:1 (cover, Ausgabe 1500×500), nie hochskalieren
  - `prepareImage(file: File, kind: MediaKind): Promise<Blob>` — Canvas-Neukodierung als JPEG 0.82 (entfernt EXIF), Ziel < 500 KB, sonst Qualität in Schritten von 0.1 bis 0.5 senken
  - `uploadProfileMedia(userId: string, kind: MediaKind, file: File): Promise<string>` — Pfad `${userId}/${kind}-${Date.now()}.jpg`, danach `profiles.<kind>_path` setzen, alte Datei löschen; gibt den Pfad zurück
  - `removeProfileMedia(userId: string, kind: MediaKind, path: string): Promise<void>`
  - `signedMediaUrl(path: string): Promise<string | null>` (1 h gültig)
  - `nutzerOrdner(userId)` enthält zusätzlich `['profile-media', userId]`

- [ ] **Step 1: Tests:** `targetSize(4000, 3000, 'avatar')` → `{ sx: 500, sy: 0, sw: 3000, sh: 3000, outW: 512, outH: 512 }`; `targetSize(300, 300, 'avatar')` → `outW: 300` (kein Hochskalieren); `targetSize(3000, 3000, 'cover')` → `sh: 1000, sw: 3000, sy: 1000, outW: 1500, outH: 500`; `nutzerOrdner('u1')` enthält `['profile-media', 'u1']`; vorhandener Konto-Löschtest: Dateien in `profile-media` werden vor `delete_my_account` entfernt.
- [ ] **Step 2:** Tests → FAIL.
- [ ] **Step 3:** Implementieren. `ProfilBilder`: Titelbild oben (3:1, Platzhalter-Verlauf ohne Bild), Profilbild rund darüber (überlappt unten wie im Mockup `profil-v3.html`), je ein Menü „Ändern / Entfernen“. Hinweis darunter `profil_bilder_privat` (de: „Nur du siehst deine Bilder — bis das Profil für andere freigeschaltet wird.“, en entsprechend).
- [ ] **Step 4:** `npx vitest run src/features/profil src/features/compliance` → PASS.
- [ ] **Step 5:** Commit.

### Task 7: Wearables lesen und zu Tageswerten verdichten

**Files:**
- Modify: `src/lib/health.ts`
- Create: `src/features/wearables/lib/healthDaily.ts`
- Test: `src/features/wearables/lib/healthDaily.test.ts`

**Interfaces:**
- Produces:
  - In `health.ts`: `IOS_READ_PERMISSIONS` ergänzt um `'calories', 'oxygenSaturation', 'respiratoryRate', 'bloodPressureSystolic', 'bloodPressureDiastolic'`; `ANDROID_READ_PERMISSIONS` um `'ActiveCaloriesBurned', 'OxygenSaturation', 'RespiratoryRate', 'BloodPressure'`
  - `interface HealthSample { date: Date; value: number }`, `interface HealthBloodPressure { date: Date; systolic: number; diastolic: number }`
  - `getActiveEnergy(o?: HealthQueryOptions): Promise<{ start: Date; end: Date; kcal: number }[]>` (iOS `activeEnergyBurned`, Android `ActiveCaloriesBurned`)
  - `getOxygenSaturation(o?): Promise<HealthSample[]>` — **Wert immer in Prozent** (iOS-Bruch × 100)
  - `getRespiratoryRate(o?): Promise<HealthSample[]>`
  - `getBloodPressure(o?): Promise<HealthBloodPressure[]>` (iOS: systolisch und diastolisch über gleiche `endDate` paaren)
  - In `healthDaily.ts`: `interface HealthDailyRow { day: string; steps: number | null; resting_hr: number | null; sleep_min: number | null; active_kcal: number | null; spo2_pct: number | null; resp_rate: number | null; bp_sys: number | null; bp_dia: number | null }`
  - `localDay(d: Date): string` (`yyyy-MM-dd` in lokaler Zeit)
  - `aggregateHealthDaily(input: { steps: { start: Date; count: number }[]; restingHr: HealthHeartRate[]; sleep: HealthSleep[]; activeEnergy: { start: Date; kcal: number }[]; spo2: HealthSample[]; respRate: HealthSample[]; bloodPressure: HealthBloodPressure[] }): HealthDailyRow[]` — Schritte und kcal summiert (gerundet), Ruhepuls/SpO2/Atemfrequenz/Blutdruck gemittelt (eine Nachkommastelle, Blutdruck ganzzahlig), Schlaf = Summe der Abschnitte außer `InBed`, gebucht auf den Tag von `endDate`; Tage ohne jeden Wert fehlen; aufsteigend sortiert
  - `getStepsByDay(o): Promise<{ start: Date; count: number }[]>` in `health.ts` (Schritte je Tag statt Gesamtsumme; `getSteps` bleibt)

- [ ] **Step 1: Tests** für `aggregateHealthDaily`: Schlaf 23:30–07:00 landet am Folgetag mit 450 min; `InBed` zählt nicht; zwei SpO2-Werte 96 und 98 → 97; Schritte über zwei Proben am selben Tag summiert; ein Tag nur mit Blutdruck hat sonst `null`; Messung um 00:30 lokal landet am lokalen Tag (Test mit `TZ=Europe/Berlin` über `vi.stubEnv` oder feste Date-Konstruktion in lokaler Zeit). Für `getOxygenSaturation` (iOS-Pfad gemockt wie in vorhandenen Health-Tests, falls vorhanden; sonst die Umrechnung als exportierte Hilfsfunktion `spo2Percent(v: number): number` testen: `0.97 → 97`, `97 → 97`).
- [ ] **Step 2:** Tests → FAIL.
- [ ] **Step 3:** Implementieren.
- [ ] **Step 4:** `npx vitest run src/features/wearables src/lib` → PASS.
- [ ] **Step 5:** Commit.

### Task 8: Einwilligung, Abgleich, Workout-Import, Datenschutz

**Files:**
- Create: `src/features/wearables/services/healthStore.ts`, `src/features/wearables/hooks/useHealthStoreConsent.ts`, `src/features/wearables/hooks/useHealthDailySync.ts`, `src/features/wearables/components/HealthStoreConsentSheet.tsx`, `src/features/wearables/components/HealthStoreProfile.tsx`
- Test: `src/features/wearables/services/healthStore.test.ts`, `src/features/wearables/hooks/useHealthDailySync.test.ts`
- Modify: `src/components/Layout.tsx` (Hook einhängen), `src/pages/Profil.tsx` (Zeile neben `PhotoConsentProfile`), `src/features/training/hooks/useTrainingData.ts` (Import nur mit Einwilligung), `src/features/training/components/settings/SettingsSheet.tsx` (Einschalten fragt die Einwilligung), `src/features/compliance/legal/texts.ts` (de/en), Locales

**Interfaces:**
- Consumes: Task 7 (alle `get*`, `aggregateHealthDaily`), Task 1 (`health_daily`, `health_store_consent_at`).
- Produces:
  - `loadHealthStoreConsent(userId): Promise<string | null>`, `setHealthStoreConsent(userId, granted: boolean): Promise<string | null>` (Muster wie `loadFoodAiConsent`/`setFoodAiConsent`)
  - `upsertHealthDaily(userId: string, rows: HealthDailyRow[], source: 'healthkit' | 'health_connect'): Promise<void>` — Upsert auf `(user_id, day)`, in Blöcken zu 100
  - `deleteHealthDaily(userId: string): Promise<void>` — `delete … where user_id = userId`
  - `syncWindow(lastSyncedDay: string | null, today: string): { from: string; to: string }` — ohne Stand 30 Tage zurück, sonst ab dem Tag **vor** dem letzten Stand (damit ein angefangener Tag nachgezogen wird)
  - `useHealthStoreConsent(userId)` → `{ consent, error, set, reload }` (Muster wie `useFoodAiConsent`)
  - `useHealthDailySync()` — nur nativ, nur mit Einwilligung (vor jedem Lauf frisch gelesen), höchstens einmal pro App-Start und dann alle 6 h im Vordergrund; liest nie per `requestPermissions`; letzter Stand in `localStorage` `hoku.healthDaily.last.<userId>`
  - `HealthStoreConsentSheet({ open, onDone })` — erklärt, was gespeichert wird (Tageswerte: Schritte, Ruhepuls, Schlaf, aktive kcal, SpO2, Atemfrequenz, Blutdruck; Workouts aus dem Training), wer es sieht (nur du, bis du es im Profil freigibst), Löschen jederzeit; Knopf „Zustimmen“ ruft erst `requestPermissions()`, dann `setHealthStoreConsent(true)`
  - `HealthStoreProfile` — Stand der Einwilligung, „Widerrufen“ und „Gespeicherte Werte löschen“ (Bestätigung, dann `deleteHealthDaily`, dann Widerruf)

- [ ] **Step 1: Tests:** `syncWindow(null, '2026-10-31')` → `{ from: '2026-10-01', to: '2026-10-31' }`; `syncWindow('2026-10-29', '2026-10-31')` → `from: '2026-10-28'`; Hook-Test mit gemocktem Service: ohne Einwilligung wird `upsertHealthDaily` nie aufgerufen; Einwilligung zwischen zwei Läufen widerrufen → zweiter Lauf schreibt nichts; `requestPermissions` wird vom Hook nie aufgerufen.
- [ ] **Step 2:** Tests → FAIL.
- [ ] **Step 3:** Implementieren.
  - **Workout-Import:** In `useTrainingData` laufen beide Stellen (`settings.healthImport`) nur, wenn zusätzlich die Einwilligung vorliegt. Hat jemand `healthImport` an, aber keine Einwilligung, öffnet sich beim nächsten Öffnen des Trainings einmal das Einwilligungs-Sheet; bis zur Zustimmung pausiert der Import. Lehnt die Person ab, bleibt `healthImport` an, der Import pausiert, und in den Trainingseinstellungen steht `health_import_paused` mit Knopf zum Nachholen.
  - **Löschen** betrifft nur `health_daily`; bereits importierte Workouts bleiben als Trainingsverlauf (eigene Daten des Trainings, löschbar wie jedes Workout).
  - **Datenschutzerklärung** (`texts.ts`, de und en): neuer Absatz „Daten aus Apple Health / Health Connect“: welche Werte, nur Tageswerte, Zweck (Verlauf, später Profil), Rechtsgrundlage ausdrückliche Einwilligung Art. 9 Abs. 2 lit. a DSGVO, Widerruf und Löschen im Profil, keine Weitergabe, keine Werbung (Apple- und Google-Vorgabe).
- [ ] **Step 4:** `npx vitest run src/features/wearables src/features/training src/features/compliance` → PASS.
- [ ] **Step 5:** Commit.

### Task 9: Neue Werte auf `/health`

**Files:**
- Modify: `src/pages/Health.tsx`, Locales
- Test: `src/pages/Health.test.tsx` (neu, nur die Darstellung der Kacheln mit gemockten `health_daily`-Zeilen)

**Interfaces:**
- Consumes: `health_daily` (Task 1), `HealthDailyRow` (Task 7).

- [ ] **Step 1: Test:** Mit einer Zeile `{ day: heute, active_kcal: 620, spo2_pct: 97, resp_rate: 14.2, bp_sys: 121, bp_dia: 78 }` zeigt die Seite „620 kcal“, „97 %“, „14,2 /min“ (de), „121/78“; ohne Zeile „—“; ohne Einwilligung statt der Kacheln ein Hinweis mit Knopf, der `HealthStoreConsentSheet` öffnet.
- [ ] **Step 2:** Test → FAIL.
- [ ] **Step 3:** Implementieren: vier Kacheln unter den bestehenden Geräte-Werten, Werte aus `health_daily` (letzter Tag mit Wert, Datum klein darunter).
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5:** Commit.

### Task 10: Android Health Connect einrichten

**Files:**
- Modify: `android/app/src/main/AndroidManifest.xml`, `android/app/capacitor.build.gradle`, `android/build.gradle`, `android/capacitor.settings.gradle`, `android/variables.gradle` (vorhandene ungespeicherte Änderungen prüfen und übernehmen), ggf. `android/app/src/main/java/**/MainActivity.java`
- Create: `docs/android/health-connect-play-console.md` (Texte für die Play-Console-Angaben)

- [ ] **Step 1:** Die vier ungespeicherten Gradle-Änderungen lesen (`git diff android/`). Übernehmen, was das Plugin `capacitor-health-connect` braucht (Einbindung, `minSdk`/`compileSdk` laut Plugin-Doku); alles andere dem Nutzer nennen statt committen.
- [ ] **Step 2:** Manifest: `<uses-permission>` für `android.permission.health.READ_STEPS`, `READ_HEART_RATE`, `READ_RESTING_HEART_RATE`, `READ_WEIGHT`, `READ_ACTIVE_CALORIES_BURNED`, `READ_OXYGEN_SATURATION`, `READ_RESPIRATORY_RATE`, `READ_BLOOD_PRESSURE`; `<queries><package android:name="com.google.android.apps.healthdata" /></queries>`; Erklär-Einstieg: Intent-Filter `androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE` an `MainActivity` und `activity-alias` mit `android.intent.action.VIEW_PERMISSION_USAGE` + Kategorie `android.intent.category.HEALTH_PERMISSIONS` (Android 14). Kommt die App über diesen Intent, öffnet sie `/datenschutz` am Abschnitt aus Task 8.
- [ ] **Step 3:** `npx cap sync android` und Gradle-Build (`cd android && ./gradlew assembleDebug`) → BUILD SUCCESSFUL.
- [ ] **Step 4:** Emulator (AVD mit API 34, Google-Play-Image), App installieren, in der „Health Connect Toolbox“ Testdaten für Schritte, Ruhepuls, kcal, SpO2, Atemfrequenz, Blutdruck anlegen. Prüfen: Einwilligung erteilen → Berechtigungsdialog zeigt die acht Typen → `/health` zeigt die Werte → in `health_daily` (Testkonto) steht eine Zeile mit `source = 'health_connect'`. Bildschirmfotos dem Nutzer zeigen.
- [ ] **Step 5:** `docs/android/health-connect-play-console.md` mit Zweck je Datentyp (de/en) für die Play-Console-Erklärung. Commit. Im Bericht vermerken: Test auf echter Hardware steht vor dem Store-Start aus.

### Task 11: Abschluss

- [ ] **Step 1:** `npx vitest run` → alle grün; `npm run lint`; `npx tsc -b` ohne Fehler.
- [ ] **Step 2:** App im Browser starten (Skill `run`), Fortschritt → Tageseintrag mit Umfängen, Verlauf „Taille“, Profil mit Bildern, Ziel-Tags, Land, Geschlechtszeichen, Registrieren mit Geschlecht; Bildschirmfotos.
- [ ] **Step 3:** `graphify update .`, Graph in eigenem Commit.
- [ ] **Step 4:** Skill `code-review` über den Branch, Befunde beheben.
- [ ] **Step 5:** `memory/projects/profil.md` um den Stand ergänzen (gebaut, offen: echtes Android-Gerät, Divers-Zeichen, 1b), Commit.
