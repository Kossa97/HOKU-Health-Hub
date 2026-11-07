# Profil, Teilprojekt 2b: Gesamtfortschritt und Abzeichen — Bauplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das Profil zeigt den Gesamtfortschritt als Prozent der positiven Veränderung seit dem eigenen Start, mit Aufschlüsselung, änderbarer Richtung je Wert, neuem Start und Abzeichen; andere sehen beides nur nach Freigabe.

**Architecture:** Reine, getestete Module rechnen auf dem Gerät (`progressScore.ts`, `badges.ts`); Einstellungen in `progress_settings`; Ergebnis in den Schnappschuss aus 2a, `profile_view` filtert und baut die Form neu. Baseline der Wearable-Werte wird beim Setzen des Starts einmal aus Apple Health / Health Connect gelesen.

**Tech Stack:** wie 2a (React 19 + TS, Vitest, Playwright-Mock, Supabase, Capacitor-Health).

**Spec:** `docs/superpowers/specs/2026-11-02-profil-p2b-fortschritt-design.md`. Mockups: `docs/profil/mockups/profil-2b.html`, `docs/profil/mockups/profil-2b-varianten.html` (Variante 1 als Karte, 2 als Detail). Baut auf 2a (PR #119) auf.

## Global Constraints

- Wie 2a: Migration als Datei (`supabase-profil-p2b-fortschritt.sql`), Trockenlauf zweimal, Produktivlauf nur nach Ja; kein `drop`/`delete` ohne `where`.
- Rechnung exakt nach Spec Abschnitt 1 (relativ zum Start, Mittel je Bereich, Mittel der Bereiche, kein Deckel).
- Texte de/en, übrige Locales englischer Platzhalter, `i18n.test.ts` grün.
- Commit-Trailer wie gehabt; `graphify update .` macht der Nutzer lokal.

## Review Focus

1. **Rechnung:** 120 → 100 kg runter = +16,67 %; KFA 19,4 → 15,8 = +18,6 %; Anteilswerte als geschlossene Lücke: 12/24 → 19/24 = +58,3 %, 2/28 → 14/28 = +46,2 %, Start 100 % und gleich geblieben = 0 %; Bereich ohne Werte fällt aus dem Mittel; kein Deckel. (Task 2)
2. **Baseline:** Schwellen aus Spec Abschnitt 2 (60 Tage vor Start ≥ 14 Tage, sonst erste 28 Tage, zählt ab Tag 29; Körperwerte ab 2. Messung ≥ 14 Tage später; Blut ab 2. Befund; e1RM ab 3 Einheiten; Workouts/Adherence ab 4 Wochen); „jetzt“ = letzte 28 Tage. (Task 2, Task 3)
3. **Leck:** Andere sehen bei `progress` nur Gesamt und Bereichswerte, nie Einzelwerte; `badges` nur verdiente, nur bekannte Schlüssel. (Task 1)
4. **Neuer Start:** alter Start bleibt in `previous_starts` und ist wiederherstellbar. (Task 4)

---

### Task 1: Migration und Trockenlauf
- [ ] `progress_settings` (RLS eigener Nutzer), Feldliste um `progress` und `badges` erweitern, `profile_snapshot_clean` um beide Formen ergänzen (Gesamt: Zahl; Bereiche: fünf bekannte Schlüssel mit Zahl; Badges: Liste bekannter IDs).
- [ ] Trockenlauf zweimal, Proben zu Review Focus 3. **Anhalten** für das Ja zum Produktivlauf (zusammen mit 2a).

### Task 2: Rechnung (`src/features/profil/lib/progressScore.ts` + Test)
- [ ] Werteliste, Standardrichtungen (fest / aus Ziel-Tags / Zielbereich), Überschreiben und Ausschließen, Formeln, Bereichsmittel, Gesamt; Beispiele aus der Spec als Tests.

### Task 3: Baseline aus Health (`src/features/profil/services/progressBaseline.ts` + Test)
- [ ] Beim Setzen des Starts 60 Tage davor lesen (Schritte, kcal, Ruhepuls, Blutdruck, Schlaf, später HRV/VO2max), Schwelle 14 Tage, Fallback; speichern in `progress_settings.baselines`. Nie selbst nach Berechtigungen fragen.

### Task 4: Aufschlüsselung und Start (`/profil/fortschritt`)
- [ ] Bildschirm nach Mockup: Bereiche, Werte Start → jetzt, Richtungswahl, „Neuen Start setzen“, vorherigen Start wählen, Erklärtext (Hinweis des Nutzers wörtlich sinngemäß).

### Task 5: Abzeichen (`src/features/profil/lib/badges.ts` + Datei mit der Liste)
- [ ] 39 Abzeichen aus der Spec als Daten (ID, Gruppe, Symbol, Bedingung), Auswertung aus vorhandenen Daten, einmal verdient = bleibt (Zeitpunkt speichern). Seite „Alle Abzeichen“, Zeile im Profil.

### Task 6: Profilkarte, Zeitreise, Schnappschuss, fremde Ansicht
- [ ] Karte „Gesamtfortschritt“ (Leitzahl + Balken um die Nulllinie, Variante 1), Antippen öffnet die Zeitreise (Variante 2, Wochenreihe, Wischen + Pfeiltasten, Abzeichen-Punkte) und „Abzeichen“ im eigenen Profil mit Chips; in den Schnappschuss; fremdes Profil zeigt beides nur bei Freigabe; Layoutregel aus 2a gilt.

### Task 7: Texte, Datenschutz, Tests, Abschluss
- [ ] de/en, Datenschutz-Satz zur Baseline (aus Health gelesen, im Konto gespeichert), e2e (Richtung ändern rechnet neu, neuer Start, fremdes Profil ohne Einzelwerte), `code-review`, `security-review`, Projektgedächtnis, PR.
