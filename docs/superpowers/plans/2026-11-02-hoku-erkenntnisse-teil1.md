# Hoku-Erkenntnisse, Teil 1: Fundament und erstes Wochen-Update — Bauplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mit eigener Einwilligung rechnet jede Nacht eine feste Engine in Supabase fünf Fundarten (H1, E2, W1, T7, R4) aus den eigenen Daten, und die App zeigt sonntags ein Wochen-Update mit Beleg, geprüft vom Regelwächter.

**Architecture:** Der Kern (Typen, Tage bilden, Statistik, Katalog, Detektoren, Auswahl, Abgleich, Regelwächter) ist reines TypeScript ohne Abhängigkeiten unter `supabase/functions/_shared/erkenntnisse/`. Die Edge Function `erkenntnisse` und die App importieren ihn beide. Die Edge Function lädt Daten, ruft den Kern und schreibt `hoku_funde`/`hoku_wochen`; ein Vercel-Cron stößt sie nur an. Die App rendert Funde aus festen de/en-Vorlagen (`src/features/dot/erkenntnisse/`), jede Vorlage ist gegen den Wächter getestet.

**Tech Stack:** React 19 + TypeScript, Vite, Vitest (`environment: node`, `TZ=Europe/Berlin`), Supabase (Postgres 16, RLS, Edge Functions/Deno), Vercel Cron (`vercel.json`).

**Spec:** `docs/superpowers/specs/2026-11-02-hoku-erkenntnisse-design.md` (freigegeben 02.11.2026). Gestaltung: Mockup v1 https://claude.ai/artifact/NX5KTV23zHGFofRLz12dZY (Screens „Home", „Wochen-Update", „Fund im Detail"; lesen mit dem Artifact-Tool, `action: "read"`).

## Gesamtbild: die Teilpläne

Das Design umfasst mehrere unabhängige Teilsysteme. Jeder Teil liefert für sich lauffähige, getestete Software und bekommt seinen eigenen Plan, wenn er dran ist.

| Teil | Inhalt | Voraussetzung |
|---|---|---|
| **1 (dieser Plan)** | Kern, Regelwächter, Katalog-Format, Einwilligung, Speicher, Nachtlauf, Wochen-Update-Seite, H1/E2/W1/T7/R4 | — |
| 2 | Ton- und Essenskritik-Einstellung; „Nicht hilfreich" aggregiert zählen; Punktstreifen im Fund-Detail; restliche T/B/R/E/W/F; Erweiterung V, VB, SW, WA, K, E5–E8, RY, G, C, H8–H10, L, R6–R7; Funde im Feature (Spalte „Ort") | 1 |
| 3 | Push: Wochen-Update Sonntagabend und „deutlich"-Funde; Web-Push und **nativ** (APNs/FCM, Geräte-Token); KI-Einleitungssatz über `coach` | 1 |
| 4 | Substanz-Bilanz S1–S12, verknüpfte Tagebuch-Einträge, Sicherheitshinweis-Chips, Zufriedenheit S5, Selbstversuch S6 | 2 |
| 5 | Koffein: Erkennungsliste, `food_logs.consumed_time` + Uhrzeit-Feld, KO1–KO8 | 2 |
| 6 | Rund um die Blutabnahme M1–M5, Feld „Uhrzeit der Abnahme" | 2 |
| 7 | Schlafphasen HS1–HS5 | Profil P1, Schritt 1b |
| R | Einstufungsbegründung `docs/recht/hoku-erkenntnisse-einstufung.md`, Datenschutzerklärung de/en, `docs/datenschutz/dsfa-ki.md` | **vor** Freischaltung für Nutzer, parallel zu 1–3 möglich |

Teil 1 schaltet nichts für Nutzer frei: Die Seite ist nur für Tester sichtbar (Schalter in Task 7), bis Teil R erledigt ist.

## Global Constraints

- Datenbank nach `CLAUDE.md`: Migration als Datei `supabase-hoku-erkenntnisse.sql`, idempotent; Trockenlauf mit Postgres 16 (Ist-Zustand der betroffenen Tabellen nachstellen), **zweimal** laufen lassen, nachzählen. Gegen das echte Projekt erst nach ausdrücklichem Ja des Nutzers; danach dieselbe Zählung, Ergebnis berichten.
- Kein `drop`, `truncate`, `delete` ohne `where`, `update` ohne `where`, `alter … drop column`. Keine Nutzerzeilen in Antworten, Commits, Artefakten.
- Gesundheitsdaten werden nur in Supabase verarbeitet. `api/hoku-anstoss.js` (Vercel) stößt an und sieht keine Gesundheitsdaten.
- Engine: **keine KI**, nur fester Katalog; gleiche Daten → gleiche Funde (Zufall nur mit festem Seed).
- Texte nur `de`/`en`, im Namensraum von Dot (`src/features/dot/erkenntnisse/vorlagen.ts`), Locale-Dateien unberührt.
- Hoku nennt keine Dosis, rät zu nichts, diagnostiziert nicht, sagt nie „wirkt"/„Ursache"; jeder angezeigte Satz besteht `pruefeText` (Task 4).
- Kern-Dateien unter `supabase/functions/_shared/erkenntnisse/`: keine Imports außer relativen mit Endung `.ts`, keine DOM-/Vite-/Deno-APIs (läuft in Browser, Node-Tests und Deno).
- Look: Soft Dark (`memory/projects/erscheinungsbild.md`), vorhandene Bausteine (`card`, `Sheet`, `Schalter`). Cyan nur für Daten.
- Branch `hoku-erkenntnisse` von `main`. Erster Commit: Spec + dieser Plan + `memory/projects/hoku-erkenntnisse.md`. Brand-Kit-Änderungen im Arbeitsverzeichnis nicht committen.
- Nach jeder Aufgabe mit Codeänderung `graphify update .`, Graph in eigenem Commit. Commit-Trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Am Ende `code-review`.

## Review Focus

1. **Zeitzone und Tagesgrenze:** Training um 22:30 Berliner Zeit (21:30 UTC) zählt für H1 als „ab 21 Uhr" und zum lokalen Tag; ein Eintrag um 00:30 Berliner Zeit zählt zum neuen Tag; Schlaf der Nacht danach ist `health_daily.day` = Folgetag. (Task 2)
2. **Lücken statt Nullen:** Ein Tag ohne Ernährungseintrag hat `proteinG = null`, nicht 0, und fällt aus E2 heraus; ein Tag ohne Schlafwert fällt aus H1/W1. (Task 2, Task 3)
3. **Zu wenig Daten:** 7 Tage je Gruppe ergeben keinen Fund, auch bei riesigem Unterschied. (Task 3)
4. **Widerruf:** `erkenntnisse_consent_at` wird null → alle `hoku_funde` und `hoku_wochen` des Nutzers sind weg, der nächste Nachtlauf überspringt ihn. (Task 1, Task 6)
5. **Eine Woche ohne Neues:** Sonntag ohne neue Funde → Wochen-Update mit `fund_ids = '{}'` und `tage_eingeflossen`, die Seite zeigt den ehrlichen Satz statt einer leeren Karte. (Task 5, Task 8)

---

### Task 1: Migration und Trockenlauf

**Files:**
- Create: `supabase-hoku-erkenntnisse.sql`

**Interfaces:**
- Produces (Datenbank):
  - `profiles.erkenntnisse_consent_at timestamptz` (null = keine Einwilligung)
  - `profiles.hoku_zeitzone text`, Prüfung `hoku_zeitzone is null or public.tyd_is_valid_timezone(hoku_zeitzone)`
  - Tabelle `hoku_funde(id uuid pk default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade, schluessel text not null check (char_length(schluessel) <= 200), fund jsonb not null check (pg_column_size(fund) <= 16384), datenlage text not null check (datenlage in ('hinweis','deutlich')), gueltig boolean not null default true, gefunden_am timestamptz not null default now(), aktualisiert_am timestamptz not null default now(), gemeldet_am date, gemeldet_datenlage text check (gemeldet_datenlage in ('hinweis','deutlich')), ausgeblendet_am timestamptz, unique (user_id, schluessel))`
  - Tabelle `hoku_wochen(user_id uuid not null references auth.users on delete cascade, woche date not null, fund_ids uuid[] not null default '{}', tage_eingeflossen smallint not null check (tage_eingeflossen between 0 and 7), sichtbar_ab timestamptz not null, gelesen_am timestamptz, erstellt_am timestamptz not null default now(), primary key (user_id, woche))` — `woche` = lokaler Sonntag
  - RLS an beiden: `select` und `delete` eigene Zeilen. `update` nur Spalte `ausgeblendet_am` (hoku_funde) bzw. `gelesen_am` (hoku_wochen): `revoke update on … from authenticated, anon; grant update (spalte) on … to authenticated;` plus Policy `for update using (auth.uid() = user_id) with check (auth.uid() = user_id)`. Kein `insert` für `authenticated` (schreibt nur die Edge Function mit Service-Rolle).
  - Trigger `hoku_widerruf` auf `profiles` `after update of erkenntnisse_consent_at`: wenn `new.erkenntnisse_consent_at is null and old.erkenntnisse_consent_at is not null` → `delete from public.hoku_funde where user_id = new.id; delete from public.hoku_wochen where user_id = new.id;` (`security definer`, `set search_path = public`)
  - Index `hoku_funde (user_id, gueltig)`

- [ ] **Step 1:** Datei schreiben wie `supabase-profil-p1-datenbasis.sql`: `add column if not exists`, `create table if not exists`, Constraints per `do $$ … if not exists (select 1 from pg_constraint where conname = …)`, `drop policy if exists` + `create policy`, `create or replace function`, `drop trigger if exists` + `create trigger`. Kopfkommentar mit den Zählabfragen.
- [ ] **Step 2:** Trockenlauf: Cluster unter `/var/tmp/hoku-erkenntnisse` (Windows ohne Container: lokales Postgres 16 oder Docker `postgres:16`); Minimalschema nachbauen (`auth.users`, `auth.uid()`-Stub, Rollen `authenticated`/`anon`, `profiles` mit den heutigen Spalten inkl. `coach_consent_at`, `pro_until`, `is_admin`; `tyd_timezone_names` + `tyd_is_valid_timezone` aus `supabase-perf-timezone-check.sql`) und 3 Nutzer mit Profil einspielen. Migration **zweimal** laufen lassen.
- [ ] **Step 3:** Nachzählen, nach Lauf 1 und 2 identisch: 2 neue Spalten in `profiles`; 2 neue Tabellen mit `relrowsecurity = true`; 3 Profilzeilen unverändert. Prüfen: `hoku_zeitzone = 'Mars/Olymp'` scheitert; als `authenticated` mit gesetztem `auth.uid()` scheitern `insert` in `hoku_funde` und `update … set fund = '{}'`, `update … set ausgeblendet_am = now()` klappt; Einwilligung setzen, 2 Funde + 1 Woche per Service-Rolle anlegen, Einwilligung auf null → 0 Zeilen in beiden Tabellen für diesen Nutzer, die der anderen bleiben.
- [ ] **Step 4:** Commit. **Dann anhalten:** dem Nutzer die Zählung zeigen und fragen, ob die Migration gegen das echte Projekt laufen darf. Erst nach Ja ausführen, Zählung wiederholen (Profilzeilen vorher/nachher gleich), berichten.

### Task 2: Kern — Typen, Zeit, Tage bilden

**Files:**
- Create: `supabase/functions/_shared/erkenntnisse/typen.ts`, `zeit.ts`, `tage.ts`
- Test: `supabase/functions/_shared/erkenntnisse/tage.test.ts`

**Interfaces:**
- Produces (`typen.ts`):
  ```ts
  export type FundId = 'H1' | 'E2' | 'W1' | 'T7' | 'R4'
  export type Richtung = 'positiv' | 'kritisch' | 'neutral'
  export type Datenlage = 'hinweis' | 'deutlich'
  export interface Fund {
    id: FundId
    schluessel: string          // eindeutig je Nutzer, siehe Detektoren
    bezug: string | null        // z. B. Übungs-ID bei R4
    richtung: Richtung
    datenlage: Datenlage
    staerke: number             // 0..1, nur zum Sortieren
    zeitraum: { von: string; bis: string }   // lokale Tage YYYY-MM-DD
    werte: Record<string, number | string>   // alles, was eine Vorlage zeigen darf
  }
  export interface Training { startedAt: string; kind: string; exercises: { exerciseId: string; sets: { type?: string; weightKg?: number | null; reps?: number | null }[] }[] }
  export interface Rohdaten {
    health: { day: string; sleep_min: number | null }[]
    tagebuch: { log_date: string; energie: number | null }[]          // daily_logs
    effekte: { occurred_at: string }[]                                // effects
    essen: { log_date: string; protein_g: number; source: string }[]  // food_logs
    trainings: Training[]                                             // training_sessions
  }
  export interface Tag {
    datum: string
    schlafMin: number | null    // Nacht, die an diesem Morgen endet (health_daily.day)
    energie: number | null
    proteinG: number | null     // null = an dem Tag nichts mit Menge eingetragen
    trainingsStunden: number[]  // lokale Startstunde je Einheit
    tagebuch: boolean           // daily_logs- oder effects-Eintrag an dem Tag
  }
  ```
- Produces (`zeit.ts`): `lokalerTag(iso: string, zone: string): string`, `lokaleStunde(iso: string, zone: string): number`, `tagePlus(datum: string, n: number): string`, `tageZwischen(von: string, bis: string): string[]` (beide inklusive), `wochentag(datum: string): number` (0 = Sonntag). Umsetzung mit `Intl.DateTimeFormat` und `timeZone`.
- Produces (`tage.ts`): `baueTage(roh: Rohdaten, zone: string, von: string, bis: string): Tag[]` — ein Eintrag je Tag in `tageZwischen(von, bis)`, aufsteigend.

- [ ] **Step 1: Tests schreiben**

```ts
expect(lokalerTag('2026-10-31T23:30:00Z', 'Europe/Berlin')).toBe('2026-11-01')
expect(lokaleStunde('2026-10-31T21:30:00Z', 'Europe/Berlin')).toBe(22)
expect(tageZwischen('2026-10-30', '2026-11-01')).toEqual(['2026-10-30', '2026-10-31', '2026-11-01'])
// Lücken bleiben null, Schnelleinträge (source 'quick', protein 0) zählen nicht als Proteinangabe
const t = baueTage({ health: [{ day: '2026-11-01', sleep_min: 420 }], tagebuch: [], effekte: [],
  essen: [{ log_date: '2026-10-31', protein_g: 30, source: 'bls' }, { log_date: '2026-10-31', protein_g: 0, source: 'quick' }, { log_date: '2026-11-01', protein_g: 0, source: 'quick' }],
  trainings: [{ startedAt: '2026-10-31T21:30:00Z', kind: 'strength', exercises: [] }] }, 'Europe/Berlin', '2026-10-31', '2026-11-01')
expect(t[0]).toEqual({ datum: '2026-10-31', schlafMin: null, energie: null, proteinG: 30, trainingsStunden: [22], tagebuch: false })
expect(t[1].schlafMin).toBe(420)
expect(t[1].proteinG).toBeNull()
// Effekt um 00:30 Berliner Zeit zählt zum neuen Tag
expect(baueTage({ ...leer, effekte: [{ occurred_at: '2026-10-31T23:30:00Z' }] }, 'Europe/Berlin', '2026-11-01', '2026-11-01')[0].tagebuch).toBe(true)
```

- [ ] **Step 2:** `npx vitest run supabase/functions/_shared/erkenntnisse/tage.test.ts` → FAIL (Module fehlen).
- [ ] **Step 3:** `typen.ts`, `zeit.ts`, `tage.ts` umsetzen. `proteinG` = Summe der Einträge mit `source !== 'quick'`, null wenn keiner.
- [ ] **Step 4:** Test → PASS. Commit.

### Task 3: Kern — Statistik, Katalog, Detektoren, Analyse

**Files:**
- Create: `supabase/functions/_shared/erkenntnisse/statistik.ts`, `katalog.ts`, `detektoren.ts`, `analyse.ts`
- Test: `statistik.test.ts`, `detektoren.test.ts`, `analyse.test.ts` (gleicher Ordner)
- Test (Abgleich mit der App): `supabase/functions/_shared/erkenntnisse/einrm.test.ts` importiert `estimateOneRepMax` aus `../../../../src/features/training/lib/stats`

**Interfaces:**
- Consumes: Task 2.
- Produces (`statistik.ts`):
  - `seed(text: string): number` (FNV-1a 32 bit), `zufall(seed: number): () => number` (mulberry32)
  - `permutationsTest(a: number[], b: number[], laeufe: number, rnd: () => number): number` — zweiseitiger p-Wert der Mittelwertdifferenz, `(treffer + 1) / (laeufe + 1)`
  - `benjaminiHochberg(p: number[]): number[]` — adjustierte q-Werte, gleiche Reihenfolge
- Produces (`katalog.ts`):
  ```ts
  export type Messwert = 'schlafMin' | 'proteinG' | 'energie'
  export interface KatalogEintrag {
    id: 'H1' | 'E2' | 'W1'
    messwert: Messwert
    versatzTage: 0 | 1                    // Messwert an Tag D + versatz
    gruppe: (tag: Tag) => 'a' | 'b' | null  // Gruppe an Tag D, null = Tag zählt nicht
    gruppen: { a: string; b: string }     // Schlüssel für die Vorlagen
    minEffekt: number
    einheit: 'min' | 'g' | 'punkte'
    besser: 'hoeher' | null               // null = keine Wertung, Reihenfolge a/b bleibt
    grenze?: number                       // erscheint in werte.grenze
  }
  export const KATALOG: readonly KatalogEintrag[]
  ```
  Werte des Katalogs (aus der Spec, H1/E2/W1):
  - H1: `schlafMin`, versatz 1, Gruppe nur an Tagen mit Training: `a` = alle Einheiten starten vor 21 Uhr, `b` = mindestens eine ab 21 Uhr; gruppen `{ a: 'vor_grenze', b: 'ab_grenze' }`, minEffekt 15, `min`, besser `hoeher`, grenze 21
  - E2: `proteinG`, versatz 0, `a` = Trainingstag, `b` = Ruhetag; gruppen `{ a: 'trainingstag', b: 'ruhetag' }`, minEffekt 15, `g`, besser `null`
  - W1: `energie`, versatz 0, `a` = `schlafMin >= 420`, `b` = `schlafMin < 420` (null → null); gruppen `{ a: 'schlaf_ab_grenze', b: 'schlaf_unter_grenze' }`, minEffekt 0.8, `punkte`, besser `hoeher`, grenze 7
- Produces (`detektoren.ts`):
  - `vergleiche(e: KatalogEintrag, tage: Tag[]): Kandidat | null` mit `interface Kandidat { fund: Omit<Fund, 'datenlage'>; p: number; nMin: number }` — `null`, wenn eine Gruppe < 8 Tage hat oder `|differenz| < minEffekt`. Bei `besser: 'hoeher'` ist `a` im Fund die Gruppe mit dem höheren Mittel (ggf. getauscht). `schluessel` = `` `${id}:${gruppenschluessel der vorderen Gruppe}` ``, `richtung: 'neutral'`, `staerke = min(1, |d| / (3 * minEffekt))`, `werte = { gruppe_a, gruppe_b, mittel_a, mittel_b, n_a, n_b, differenz, einheit, grenze? }` (Mittel und Differenz gerundet: min/g ganzzahlig, punkte auf 0,1). p aus `permutationsTest(…, 2000, zufall(seed(schluessel + zeitraum.bis)))`.
  - `tagebuchSerie(tage: Tag[]): Fund | null` (T7) — Länge der Serie aufeinanderfolgender `tagebuch`-Tage, die am letzten Tag endet; Fund nur, wenn die Serie in den letzten 7 Tagen eine der Marken `7, 14, 30, 60, 100, 365` erreicht hat (gemeldet wird die höchste erreichte). `schluessel` `T7:tagebuch:<marke>`, `richtung: 'positiv'`, `datenlage: 'deutlich'`, `staerke: 0.6`, `werte = { tage: marke }`
  - `kraftRekorde(trainings: Training[], zone: string, bis: string): Fund[]` (R4) — je `exerciseId` bestes `einRM(weightKg, reps)` über Sätze ohne `type: 'warmup'`; Fund, wenn das Beste der letzten 7 Tage (bis einschließlich `bis`) höher ist als alles davor **und** davor mindestens 3 Einheiten mit dieser Übung liegen. `schluessel` `` `R4:${exerciseId}:${kg}` ``, `bezug: exerciseId`, `richtung: 'positiv'`, `datenlage: 'deutlich'`, `staerke: 0.7`, `werte = { kg, vorher }` (auf 0,5 kg gerundet)
  - `einRM(weightKg, reps): number | null` — gleiche Formel wie `estimateOneRepMax` in `src/features/training/lib/stats.ts` (Epley, reps 1–12)
- Produces (`analyse.ts`): `analysiere(roh: Rohdaten, zone: string, heute: string): Fund[]` — Zeitraum `von = tagePlus(heute, -90)`, `bis = tagePlus(heute, -1)`; alle `KATALOG`-Einträge vergleichen, q-Werte über **alle** Kandidaten dieses Laufs per `benjaminiHochberg`; `deutlich` wenn `q ≤ 0.05` und `nMin ≥ 12`, sonst `hinweis` wenn `q ≤ 0.10`, sonst verworfen; dazu T7 und R4 unverändert.

- [ ] **Step 1: Tests schreiben**

```ts
// statistik
expect(permutationsTest([1,1,1,1,1,1,1,1], [1,1,1,1,1,1,1,1], 2000, zufall(1))).toBeGreaterThan(0.9)
expect(permutationsTest(Array(10).fill(480), Array(10).fill(400), 2000, zufall(1))).toBeLessThan(0.01)
expect(benjaminiHochberg([0.01, 0.04, 0.03])).toEqual([0.03, 0.04, 0.04])
expect(permutationsTest(a, b, 2000, zufall(seed('x')))).toBe(permutationsTest(a, b, 2000, zufall(seed('x'))))  // reproduzierbar
// H1: 10 Tage Training 18 Uhr → 470 min, 10 Tage Training 22 Uhr → 420 min (Schlaf am Folgetag)
const f = vergleiche(KATALOG.find(e => e.id === 'H1')!, tageH1)!
expect(f.fund.werte).toMatchObject({ gruppe_a: 'vor_grenze', mittel_a: 470, mittel_b: 420, differenz: 50, grenze: 21, n_a: 10, n_b: 10 })
expect(f.fund.schluessel).toBe('H1:vor_grenze')
// umgekehrt: späte Einheiten schlafen länger → a wird 'ab_grenze'
expect(vergleiche(H1, tageH1Umgekehrt)!.fund.schluessel).toBe('H1:ab_grenze')
// 7 Tage je Gruppe → kein Fund; Unterschied 10 min → kein Fund
expect(vergleiche(H1, tageH1Nur7)).toBeNull()
expect(vergleiche(H1, tageH1Klein)).toBeNull()
// T7: Serie von 15 Tagen bis gestern → Marke 14
expect(tagebuchSerie(serie(15))?.werte).toEqual({ tage: 14 })
expect(tagebuchSerie(serie(6))).toBeNull()
// R4: Rekord nur mit 3 Einheiten davor, Aufwärmsätze zählen nicht
expect(kraftRekorde([...dreiAlte(100), neu(105)], 'Europe/Berlin', '2026-11-01')[0].werte).toEqual({ kg: 105, vorher: 100 })
expect(kraftRekorde([...zweiAlte(100), neu(105)], 'Europe/Berlin', '2026-11-01')).toEqual([])
expect(kraftRekorde([...dreiAlte(100), neuNurAufwaermen(200)], 'Europe/Berlin', '2026-11-01')).toEqual([])
// Abgleich mit der App
for (const [w, r] of [[100, 1], [100, 5], [80, 12], [80, 13], [0, 5]]) expect(einRM(w, r)).toBe(estimateOneRepMax(w, r))
// analyse: gleiche Daten → gleiche Funde
expect(analysiere(roh, 'Europe/Berlin', '2026-11-02')).toEqual(analysiere(roh, 'Europe/Berlin', '2026-11-02'))
```

- [ ] **Step 2:** `npx vitest run supabase/functions/_shared/erkenntnisse` → FAIL.
- [ ] **Step 3:** Module umsetzen. Testdaten als kleine Fabrikfunktionen im Test (`tag(datum, teil)`), keine Fixture-Dateien.
- [ ] **Step 4:** Tests → PASS. Commit.

### Task 4: Regelwächter

**Files:**
- Create: `supabase/functions/_shared/erkenntnisse/waechter.ts`
- Test: `supabase/functions/_shared/erkenntnisse/waechter.test.ts`

**Interfaces:**
- Consumes: `Fund`, `FundId` (Task 2).
- Produces:
  - `pruefeText(text: string, sprache: 'de' | 'en', fund: Fund | null): { ok: boolean; verstoesse: string[] }` — `verstoesse` enthält Kennungen: `einheit`, `befehl`, `wirkung`, `diagnose`, `kausal`, `alarm`, `zahl:<zahl>`, `pflichtsatz`
  - `PFLICHTSATZ: Record<'de' | 'en', string>` = `{ de: 'Zusammenhang, kein Beweis.', en: 'A connection, not proof.' }` — Pflicht für Funde mit `richtung: 'neutral'`

Regeln (Spec „Regelwächter", Groß/Klein egal, Wortgrenzen):
- `einheit`: Zahl gefolgt von `mg, mcg, µg, ug, ie, iu, ml, einheiten, units`
- `befehl` de: `nimm, nehmen sie, setz … ab, absetzen, erhöh, reduzier, kombinier, starte, dosier`; en: `take, stop taking, increase, reduce, combine, start taking, dose`
- `wirkung` de: `wirkt, hilft, ist gut für, sicher, unbedenklich`; en: `works, helps, is good for, safe`
- `diagnose` de: `mangel, erkrankung, störung, krankheit`; en: `deficiency, disease, disorder`
- `kausal` de: `weil, deshalb, daher, verursacht, führt zu, wegen`; en: `because, therefore, causes, leads to, due to`
- `alarm` de: `achtung, warnung, gefährlich, gefahr`; en: `warning, dangerous, danger, alert`
- `zahl:<z>`: jede Zahl im Text (`\d+([.,]\d+)?`, Komma → Punkt) muss als Zahl in `fund.werte` vorkommen; ohne `fund` sind Zahlen verboten
- `pflichtsatz`: `fund.richtung === 'neutral'` und der Text enthält `PFLICHTSATZ[sprache]` nicht

- [ ] **Step 1: Tests schreiben**

```ts
const f = fund({ richtung: 'neutral', werte: { mittel_a: 470, mittel_b: 420, differenz: 50, grenze: 21 } })
expect(pruefeText('Wenn du vor 21 Uhr trainierst, schläfst du im Schnitt 50 min länger. Zusammenhang, kein Beweis.', 'de', f).ok).toBe(true)
expect(pruefeText('Training vor 21 Uhr hilft deinem Schlaf. Zusammenhang, kein Beweis.', 'de', f).verstoesse).toContain('wirkung')
expect(pruefeText('Du schläfst 50 min länger, weil du früher trainierst. Zusammenhang, kein Beweis.', 'de', f).verstoesse).toContain('kausal')
expect(pruefeText('Du schläfst 55 min länger. Zusammenhang, kein Beweis.', 'de', f).verstoesse).toContain('zahl:55')
expect(pruefeText('Du schläfst 50 min länger.', 'de', f).verstoesse).toContain('pflichtsatz')
expect(pruefeText('Nimm 250 mcg am Abend.', 'de', null).verstoesse).toEqual(expect.arrayContaining(['einheit', 'befehl', 'zahl:250']))
expect(pruefeText('Achtung: Mangel möglich.', 'de', null).verstoesse).toEqual(expect.arrayContaining(['alarm', 'diagnose']))
expect(pruefeText('This works because you train early.', 'en', null).verstoesse).toEqual(expect.arrayContaining(['wirkung', 'kausal']))
expect(pruefeText('Seit dem Start trägst du mehr ein.', 'de', null).ok).toBe(true)   // „Start" ist kein Befehl
expect(pruefeText('Du bist 14 Tage dabei.', 'de', fund({ richtung: 'positiv', werte: { tage: 14 } })).ok).toBe(true)
```

- [ ] **Step 2:** Test → FAIL. **Step 3:** `waechter.ts` umsetzen. **Step 4:** Test → PASS. Commit.

### Task 5: Kern — Auswahl und Abgleich

**Files:**
- Create: `supabase/functions/_shared/erkenntnisse/auswahl.ts`
- Test: `supabase/functions/_shared/erkenntnisse/auswahl.test.ts`

**Interfaces:**
- Consumes: `Fund` (Task 2).
- Produces:
  ```ts
  export interface Gespeichert { id: string; schluessel: string; datenlage: Datenlage; gueltig: boolean; gemeldet_datenlage: Datenlage | null; ausgeblendet: boolean }
  export function abgleich(alt: Gespeichert[], neu: Fund[]): { einfuegen: Fund[]; aktualisieren: { id: string; fund: Fund }[]; ungueltig: string[] }
  export function waehleWoche(kandidaten: { id: string; fund: Fund; gespeichert: Gespeichert }[]): string[]
  export function istSonntagLauf(heute: string): boolean        // wochentag(heute) === 0
  export function sichtbarAb(heute: string, zone: string): string // ISO-Zeitpunkt heute 19:00 lokal
  ```
  - `abgleich`: neuer `schluessel` → einfügen; vorhandener → aktualisieren (immer, Werte können sich ändern; `gueltig` wieder true); vorhanden, aber nicht mehr gefunden und `gueltig` → in `ungueltig`.
  - `waehleWoche`: Kandidat nur, wenn `gueltig`, nicht `ausgeblendet` und (`gemeldet_datenlage` null **oder** `hinweis` → jetzt `deutlich`). Sortiert nach `staerke` absteigend, dann `schluessel`; höchstens 5; höchstens 2 mit `richtung: 'kritisch'`; gibt es einen positiven Kandidaten und keiner ist unter den Gewählten, ersetzt der stärkste positive den letzten Platz (bei 5 Gewählten) bzw. kommt dazu. Weniger als 3 Kandidaten → alle. Rückgabe: Kandidaten-`id`s in Anzeigereihenfolge.

- [ ] **Step 1: Tests schreiben**

```ts
expect(abgleich([g('H1:vor_grenze')], [fund('H1:vor_grenze'), fund('T7:tagebuch:14')]).einfuegen.map(f => f.schluessel)).toEqual(['T7:tagebuch:14'])
expect(abgleich([g('E2:trainingstag')], []).ungueltig).toEqual(['id-E2:trainingstag'])
expect(waehleWoche(sechsNeutraleUndEinPositiver)).toHaveLength(5)
expect(waehleWoche(sechsNeutraleUndEinPositiver)).toContain('id-positiv')
expect(waehleWoche(vierKritische).length).toBe(2)
expect(waehleWoche([k('H1', { gemeldet_datenlage: 'deutlich' })])).toEqual([])
expect(waehleWoche([k('H1', { gemeldet_datenlage: 'hinweis', datenlage: 'deutlich' })])).toEqual(['id-H1'])
expect(waehleWoche([k('H1', { ausgeblendet: true })])).toEqual([])
expect(sichtbarAb('2026-11-01', 'Europe/Berlin')).toBe('2026-11-01T18:00:00.000Z')
```

- [ ] **Step 2:** FAIL. **Step 3:** umsetzen. **Step 4:** PASS. Commit.

### Task 6: Edge Function `erkenntnisse` und Anstoß

**Files:**
- Create: `supabase/functions/erkenntnisse/index.ts`, `supabase/functions/erkenntnisse/laden.ts`
- Test: `supabase/functions/erkenntnisse/laden.test.ts`
- Create: `api/hoku-anstoss.js`, Test `api/hoku-anstoss.test.js`
- Modify: `vercel.json` (zweiter Cron)

**Interfaces:**
- Consumes: `analysiere` (Task 3), `abgleich`, `waehleWoche`, `istSonntagLauf`, `sichtbarAb` (Task 5), `lokalerTag`, `tagePlus`, `tageZwischen` (Task 2), `hatZugang` aus `../coach/prompt.ts`.
- Produces:
  - `laden.ts`: `zuRohdaten(zeilen: { health: unknown[]; daily: unknown[]; effects: unknown[]; food: unknown[]; training: unknown[] }): Rohdaten` — prüft Typen, verwirft kaputte Zeilen, `exercises` defensiv (kein Array → `[]`); `tageMitDaten(roh: Rohdaten, zone: string, von: string, bis: string): number`
  - HTTP: `POST /functions/v1/erkenntnisse`, Header `x-hoku-secret` = Secret `HOKU_ANSTOSS_SECRET`, Body `{ nach?: string }` → `{ bearbeitet: number, weiter: string | null }`. Deploy mit `verify_jwt` aus (wie `login-name`), Region-Header `x-region: eu-west-1` beim Aufruf.
  - `api/hoku-anstoss.js`: Vercel-Handler, prüft `Authorization: Bearer ${CRON_SECRET}` wie Vercel-Cron üblich, ruft die Edge Function in einer Schleife (`nach` = `weiter`) höchstens 20-mal; gibt nur Zähler zurück, keine Inhalte.
  - `vercel.json`: Cron `{ "path": "/api/hoku-anstoss", "schedule": "0 2 * * *" }` zusätzlich.

Ablauf je Aufruf (in `index.ts`): Secret prüfen (sonst 401) → bis zu 50 Profile mit `erkenntnisse_consent_at is not null`, `id > nach`, sortiert nach `id`, Spalten `id, erkenntnisse_consent_at, hoku_zeitzone, pro_until, is_admin`; ohne `hatZugang` oder ohne Zeitzone überspringen → je Nutzer: `heute = lokalerTag(now, zone)`; Daten seit `tagePlus(heute, -91)` laden (`health_daily`, `daily_logs`, `effects`, `food_logs` mit `log_date, protein_g, source`, `training_sessions` mit `started_at, kind, exercises`); **Einwilligung direkt vor dem Schreiben erneut lesen** (Widerruf während des Laufs) → `analysiere` → `abgleich` gegen `hoku_funde` → schreiben; an `istSonntagLauf(heute)` und ohne vorhandene `hoku_wochen`-Zeile für `heute`: `waehleWoche`, Zeile mit `fund_ids`, `tage_eingeflossen = tageMitDaten(…, tagePlus(heute,-7), tagePlus(heute,-1))`, `sichtbar_ab` schreiben und bei den gewählten Funden `gemeldet_am = heute`, `gemeldet_datenlage = datenlage` setzen. Fehler bei einem Nutzer bricht den Lauf nicht ab; geloggt wird nur Nutzer-ID-Präfix und Fehlercode, nie Daten.

- [ ] **Step 1: Tests schreiben** (`laden.test.ts`, `hoku-anstoss.test.js`)

```ts
expect(zuRohdaten({ ...leer, training: [{ started_at: '2026-10-31T17:00:00Z', kind: 'strength', exercises: 'kaputt' }] }).trainings[0].exercises).toEqual([])
expect(zuRohdaten({ ...leer, health: [{ day: '2026-10-31', sleep_min: 'x' }] }).health[0].sleep_min).toBeNull()
expect(tageMitDaten(rohMitDreiTagen, 'Europe/Berlin', '2026-10-25', '2026-10-31')).toBe(3)
```
```js
// hoku-anstoss: ohne Cron-Secret 401; folgt `weiter`, bis null, höchstens 20 Aufrufe
expect((await handler(req({ auth: 'falsch' }))).status).toBe(401)
expect(fetchMock).toHaveBeenCalledTimes(3) // Antworten: weiter 'a' → 'b' → null
```

- [ ] **Step 2:** FAIL. **Step 3:** umsetzen. **Step 4:** PASS, dazu `npx tsc -b` grün. Commit.
- [ ] **Step 5:** **Anhalten** und den Nutzer fragen, ob Secret `HOKU_ANSTOSS_SECRET` (Supabase + Vercel), Deploy der Function und der Cron eingerichtet werden dürfen. Nach Ja: deployen (Dateien `erkenntnisse/index.ts`, `erkenntnisse/laden.ts`, `_shared/erkenntnisse/*.ts`, `coach/prompt.ts`), einmal mit dem Testkonto des Nutzers als einzigem Einwilligenden aufrufen, Logs prüfen; berichten: Anzahl Funde und Arten, ohne Inhalte.

### Task 7: App — Datenzugriff, Einwilligung, Freischaltung

**Files:**
- Create: `src/features/dot/erkenntnisse/erkenntnisseService.ts`, `src/features/dot/erkenntnisse/ErkenntnisseEinwilligung.tsx`
- Test: `src/features/dot/erkenntnisse/erkenntnisseService.test.ts`
- Modify: `src/features/dot/lib/zugang.ts` (Schalter)

**Interfaces:**
- Consumes: `Fund` (Task 2).
- Produces:
  - `zugang.ts`: `export const ERKENNTNISSE_FREI = false` — solange false, sehen nur Tester (`istTester(is_admin, import.meta.env.DEV)`) Seite und Karte. Auf true erst nach Teil R.
  - `erkenntnisseService.ts`:
    - `setzeErkenntnisseEinwilligung(userId: string, an: boolean): Promise<string | null>` — wie `setzeCoachEinwilligung`; bei `an` zusätzlich `hoku_zeitzone = Intl.DateTimeFormat().resolvedOptions().timeZone`
    - `ladeWoche(userId: string, jetzt?: Date): Promise<Woche | null>` — jüngste `hoku_wochen`-Zeile mit `sichtbar_ab <= jetzt`, dazu ihre Funde; `interface Woche { woche: string; tageEingeflossen: number; gelesen: boolean; funde: GespeicherterFund[] }`, `interface GespeicherterFund { id: string; fund: Fund; datenlage: Datenlage }`
    - `ladeFunde(userId: string): Promise<GespeicherterFund[]>` — `gueltig` und nicht ausgeblendet
    - `blendeAus(id: string): Promise<void>`, `markiereGelesen(userId: string, woche: string): Promise<void>`
    - `liesFund(roh: unknown): Fund | null` — prüft das jsonb gegen den Typ (unbekannte `id` → null)
  - `ErkenntnisseEinwilligung`: Sheet nach Mockup-Screen „Push und Einwilligung" (unterer Teil, ohne Push-Vorschau): Titel, vier Punkte, Checkbox „Ich willige ein …(Art. 9 DSGVO)", Knopf „Einverstanden" erst mit Haken aktiv. Props `{ onFertig(zeit: string): void; onAbbrechen(): void }`. Texte aus Task 8 (`vorlagen.ts`-Namensraum).

- [ ] **Step 1: Tests schreiben**

```ts
expect(liesFund({ id: 'H1', schluessel: 'H1:vor_grenze', bezug: null, richtung: 'neutral', datenlage: 'hinweis', staerke: 0.5, zeitraum: { von: 'a', bis: 'b' }, werte: {} })?.id).toBe('H1')
expect(liesFund({ id: 'X9' })).toBeNull()
expect(liesFund(null)).toBeNull()
```

- [ ] **Step 2:** FAIL. **Step 3:** umsetzen (Supabase-Aufrufe wie in `coachService.ts`). **Step 4:** PASS. Commit.

### Task 8: App — Vorlagen und Seite „Erkenntnisse"

**Files:**
- Create: `src/features/dot/erkenntnisse/vorlagen.ts`, `src/features/dot/erkenntnisse/ErkenntnissePage.tsx`, `src/features/dot/erkenntnisse/FundKarte.tsx`, `src/features/dot/erkenntnisse/FundDetail.tsx`, `src/features/dot/erkenntnisse/WochenKarte.tsx`
- Test: `src/features/dot/erkenntnisse/vorlagen.test.ts`
- Modify: `src/App.tsx` (Route `erkenntnisse`), `src/pages/Home.tsx` (Update-Karte)

**Interfaces:**
- Consumes: `pruefeText`, `PFLICHTSATZ` (Task 4), Service (Task 7), `ERKENNTNISSE_FREI`, `istTester` (Task 7).
- Produces:
  - `fundText(fund: Fund, sprache: 'de' | 'en', namen: { uebung(id: string): string }): { titel: string; satz: string; beleg: string }` — `satz` + `beleg` zusammen bestehen `pruefeText`
  - `useErkenntnisseTexte()` — wie `useDotTexte` in `texte.ts`: Tabellen `de`/`en`, andere Sprachen → en, Test auf gleiche Schlüssel und Platzhalter
  - Vorlagen (de, Sinn je Fund; en entsprechend):
    - H1 a=`vor_grenze`: „Wenn du vor {{grenze}} Uhr trainierst, schläfst du in der Nacht danach im Schnitt {{differenz}} min länger." a=`ab_grenze`: „… ab {{grenze}} Uhr …"; Beleg „{{n_a}} gegen {{n_b}} Trainingstage, {{mittel_a}} gegen {{mittel_b}} min. Zusammenhang, kein Beweis."
    - E2: „An Trainingstagen isst du im Schnitt {{differenz}} g mehr/weniger Protein als an Ruhetagen." (Richtung aus dem Vorzeichen, ohne Wertung)
    - W1: „Nach Nächten ab {{grenze}} h trägst du im Schnitt {{differenz}} Punkte mehr Energie ein."
    - Der Beleg von H1, E2 und W1 nennt Tage und Mittel beider Gruppen und endet mit `PFLICHTSATZ[sprache]`.
    - T7: „{{tage}} Tage am Stück Tagebuch geführt."
    - R4: „Neuer Rekord bei {{uebung}}: geschätzt {{kg}} kg (vorher {{vorher}} kg)."
  - `ErkenntnissePage` (`/erkenntnisse`): ohne Freischaltung → Umleitung nach `/`; ohne Einwilligung → Erklärung + Einwilligungs-Sheet; mit Einwilligung → `WochenKarte` (aktuelle Woche; `funde` leer → „Diese Woche nichts Neues. {{tage}} Tage deiner Daten sind eingeflossen."), darunter „Alle Funde" (`FundKarte` je gültigem Fund), Tippen öffnet `FundDetail` (Satz, Beleg, Zeitraum, „Nicht hilfreich" → `blendeAus`), unten „Einwilligung widerrufen" mit Rückfrage. Beim Öffnen: `markiereGelesen`; ändert sich die Gerätezeitzone, `hoku_zeitzone` nachziehen. Aussehen nach Mockup-Screens „Wochen-Update" und „Fund im Detail" (ohne Punktstreifen; die kommen in Teil 2).
  - `Home.tsx`: Karte „Dein Wochen-Update ist da" nur bei Freischaltung, Einwilligung und ungelesener sichtbarer Woche; Tippen → `/erkenntnisse`.

- [ ] **Step 1: Tests schreiben** (`vorlagen.test.ts`)

```ts
// jede Vorlage, beide Sprachen, beide Gruppenreihenfolgen bzw. Vorzeichen, besteht den Wächter
for (const f of BEISPIELFUNDE) for (const s of ['de', 'en'] as const) {
  const t = fundText(f, s, { uebung: () => 'Kniebeuge' })
  expect(pruefeText(`${t.satz} ${t.beleg}`, s, f)).toEqual({ ok: true, verstoesse: [] })
}
expect(fundText(h1VorGrenze, 'de', namen).satz).toBe('Wenn du vor 21 Uhr trainierst, schläfst du in der Nacht danach im Schnitt 50 min länger.')
expect(fundText(e2Weniger, 'de', namen).satz).toContain('weniger Protein')
expect(Object.keys(TEXTE.de).sort()).toEqual(Object.keys(TEXTE.en).sort())
```
`BEISPIELFUNDE` deckt alle `FundId` ab; ein Test prüft das (`new Set(BEISPIELFUNDE.map(f => f.id))` = alle fünf).

- [ ] **Step 2:** FAIL. **Step 3:** `vorlagen.ts` umsetzen, dann die Komponenten. **Step 4:** `npx vitest run`, `npx tsc -b`, `npm run lint` grün. Commit.
- [ ] **Step 5:** Mit dem Skill `run` die App starten, als Tester `/erkenntnisse` öffnen: Einwilligung erteilen, mit per SQL im **Trockenlauf-/Testkonto** angelegter Woche Karte und Detail prüfen, „Nicht hilfreich" und Widerruf prüfen. Screenshot fürs Ergebnis. Kein Eingriff in echte Nutzerdaten.

### Task 9: Abschluss

- [ ] **Step 1:** `graphify update .`, Graph committen.
- [ ] **Step 2:** `code-review` über den Branch; Befunde beheben, erneut testen.
- [ ] **Step 3:** `memory/projects/hoku-erkenntnisse.md`: Stand Teil 1 (was live ist, was nur für Tester), nächster Teil. Commit.
