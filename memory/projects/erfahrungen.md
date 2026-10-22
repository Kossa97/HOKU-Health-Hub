# Erfahrungen (Bewertungen) — UI-Überarbeitung

Stand: 2026-10-21. Geplant im Live-Mockup mit dem Nutzer
(https://claude.ai/artifact/H8XhiD53ZGBCFEEHNZFMHh), Grundlage Apple-Design-
und Emil-Kowalski-Skills.

## Entschieden — Übersicht

- **Kein Hinweistext unter dem Titel.** Die Erklärung („keine Empfehlung …")
  steckt im ⓘ neben „Erfahrungen" (kleines Fenster, Tipp daneben/Escape schließt).
  Bewusst weniger sichtbar als vorher; der Text selbst bleibt unverändert.
- **Kein Hinweis „N beendete Zyklen noch ohne Erfahrung".** Erinnert wird nur
  noch einmal beim Plan-Beenden in My Stack („Wie war's?").
- **Suche** volle Breite, daneben **Reihenfolge als Menü** (Knopf „Neueste" /
  „Sterne", Menü mit Häkchen).
- **Datum** in eigener Zeile unten rechts: „geschrieben am TT.MM.JJJJ".
- Kriterien brechen nur zwischen den Angaben.

## Entschieden — Sheet

- Reihenfolge: Substanz + Zyklus (Auswahlzeilen mit `<select>`, iOS-Stil) →
  Wirkung → Verträglichkeit → Wieder nehmen → Notizen (Titel, Notiz,
  Positiv/Negativ in zwei Tabs) → Öffentlich-Schalter → **Fazit** (Sterne).
- **Substanz ist Pflicht und nicht vorbelegt** (außer beim Weg aus My Stack).
  Zyklus erst nach der Substanz wählbar; festgehaltene Zyklen gesperrt.
- **Fazit = Sterne, Pflicht, ganz unten**, mit Wort darunter (Schlecht …
  Sehr gut). Sterne lassen sich seitlich wischen.
- Fehlt beim Speichern etwas: Knopf wackelt (denyFeedback), Hinweis nennt was,
  fehlende Felder werden rot umrandet.
- **Positiv/Negativ** (nicht Vorteile/Nachteile — klingt nach Produkttest).
- **Schließen mit Eingaben:** ✕ fragt sofort „Änderungen verwerfen?"; Tipp
  daneben, Escape oder Herunterziehen am Griff wippen bzw. federn beim 1. Mal,
  fragen ab dem 2. Mal. „Weiter bearbeiten" zählt neu. Ohne Eingaben schließt
  alles sofort. Zurück-Geste tippt aufs ✕ (`data-app-back-self-confirm`).
- Am Griff ziehen: gemeinsamer `SheetGriff`/`useSheetDrag`, neue Option
  `festhalten` (zäh nachgeben, zurückfedern).
- Öffentlich teilen als iOS-Schalter (`components/ui/Schalter.tsx`).

## Offen

- Die Schlüssel `review_unrated_*` sind ungenutzt (in allen 14 Sprachen) und
  könnten beim nächsten Aufräumen raus.
- Der Workout-Tracker hat eine eigene Kopie der Schalter-Optik
  (`training/components/settings/parts.tsx`).
