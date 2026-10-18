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

## Offen

| Punkt | Stand |
|---|---|
| Kalorientracker | nicht im Repo gefunden; GLP-1-Protein und Trainings-kcal brauchen ihn — Schnittstelle `trainingEnergyForDay` steht bereit |
| Live Activity / Apple Watch | braucht nativen Swift-Code, v2 |
| Auto-Progression / Deload-Vorschlag | v2 |
