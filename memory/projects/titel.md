# Titel (Profil-Zusatz, nach 2c)

Stand 03.11.2026 · Brainstorm mit dem Nutzer. Mockup Entwurf 1: `docs/profil/mockups/profil-titel.html`, https://claude.ai/artifact/21JomB4qaYMvUkjFXLm3UP. Keine Spec.

## Entschieden [Nutzer]
- **Rang und Prägungen.** Ein Titel ist eine Identität („wer du auf Hoku bist“), genau einer wird getragen, neben dem
  Namen. Abzeichen bleiben Sammelstücke.
- **Einmal erreicht, für immer.** Kein Verlieren, kein Ruhen (wie Abzeichen: Rückschritt nimmt nichts weg).
- **Rang-Namen wie vorgeschlagen** (freundlich, leicht spielerisch).
- **Rang zählt nur Tage mit eigenem Eintrag** (`BadgeFacts.entryDays`), keine automatisch übertragenen Wearable-Tage.
- **Sichtbarkeit (Nutzer 03.11., ersetzt „Web-Schalter“):** Titel ist ein Feld mit Stufe wie in 2a (Nur ich / Freunde /
  Alle), ab Werk **Alle**. Vier Sichten: ich, Freunde, App-Nutzer (angemeldet, nicht befreundet), Web. Web und Link-Karte
  zeigen ihn nur auf „Alle“ + Web-Link an (wie jedes Feld in 2c). Kein eigener Web-Schalter. Mockup Entwurf 2.

- **Getragener Rang steigt von selbst mit** (Nutzer 03.11.: „passt so“); gefragt wird nur, wer gerade eine Prägung trägt.

## Vorschlag [Claude, ungeprüft]
Rangleiter (Tage mit eigenem Eintrag): 1 Neuling/Newcomer · 7 Entdecker/Explorer · 30 Dranbleiber/Committed ·
90 Routinier/Regular · 180 Veteran/Veteran · 365 Legende/Legend.

Prägungen (statt des Rangs wählbar), an bestehende 2b-Abzeichen gekoppelt, damit es keine zweite Logik gibt:
Kraftpaket/Powerhouse (25 Bestleistungen, `prDays`) · Trainingstier/Workhorse (100 Trainings, `sessionDays`) ·
Schrittmacher/Pacesetter (12 Wochen Ø ≥ 10.000 Schritte, `stepWeeks`) · Unaufhaltsam/Unstoppable (100 Tage in Folge) ·
Datenprofi/Data Pro (1.000 Einträge; Zählung kommt für die Link-Karte) · Hybrid-Athlet/Hybrid Athlete (20 Hyrox-Einheiten;
Art der Einheit prüfen) · Motivator/Motivator (5 Freunde).

**Nie als Titel:** Körperwerte, Blutwerte, Gewicht, Einnahmen/Stack (Gesundheitsdatum Art. 9 bzw. Substanzen im Web).

## Offen
- Prägungen-Liste und Schwellen bestätigen.
- Wo man den Titel wählt (Profil-Einstellungen? Sheet am Titel?), Moment beim Erreichen (Feier), Übersicht mit
  „noch 12 Tage bis Routinier“.
- Speicherung: abgeleitet wie Abzeichen (Schnappschuss) + gewählte Prägung im Profil; Web-Schalter.
- Texte nur de/en; übrige 12 Sprachen bekommen für neue Schlüssel den englischen Platzhalter.

## Geparkt
- Prägungen aus Körper-/Blutwerten nur in der App (nicht Web): später prüfen.
- Ruhender Titel nach langer Pause.
