# Titel (Profil-Zusatz, nach 2c)

Stand 03.11.2026 · Spec `docs/superpowers/specs/2026-11-03-profil-titel-design.md`, Plan `docs/superpowers/plans/2026-11-03-profil-titel.md`. Mockup: `docs/profil/mockups/profil-titel.html`, https://claude.ai/artifact/21JomB4qaYMvUkjFXLm3UP.

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

## Nutzer 03.11. (zweite Runde)
- **Rang zählt Tage mit eigenem Eintrag, zusammengezählt** (nicht „App geöffnet“, nicht „in Folge“).
- **Schwellen: 1 · 10 · 50 · 100 · 200 · 365** (Neuling, Entdecker, Dranbleiber, Routinier, Veteran, Legende) — weg von 7/30,
  damit nichts mit den Serien-Abzeichen „7/30/100/365 Tage ohne Lücke“ verwechselt wird.
- **Prägungen als eigenes Konzept gestrichen** (doppelten sich mit 2b-Abzeichen: Unaufhaltsam = „100 Tage ohne Lücke“,
  Trainingstier = „100 Workouts“ …). Stattdessen **tragbare Abzeichen**: besondere Abzeichen haben einen Titelnamen und
  lassen sich statt des Rangs tragen. Nur Rang + Abzeichen.
- **Sportarten:** Hyrox ja, dazu weitere Sportarten aus `SessionKind` (strength, run, cycle, swim, row, walk, hike, hiit,
  hyrox, yoga, mobility, sport, other). **Aus Apple Health / Health Connect eingeführte Einheiten zählen** für Sportart-Titel
  (der Rang zählt weiter nur eigene Einträge).
- **Einstieg ins Sheet: beides** (Chip im Profil und Profil-Einstellungen › Titel).
- **Sichtbarkeit Standard „Alle“** — abweichend von 2a/2b (dort jedes Feld „Nur ich“): juristisch prüfen (Art. 25 DSGVO,
  datenschutzfreundliche Voreinstellung; Titel ist kein Gesundheitsdatum, solange nur aus unverfänglichen Abzeichen).

## Vorschlag (alt, durch „tragbare Abzeichen“ ersetzt) [Claude]
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

## Nutzer 03.11. (dritte Runde)
- Fragte, warum Körperwerte, Gewicht, Blut, Ruhepuls, Einnahmen, Erfahrungsberichte, Gesamtfortschritt nie tragbar sind.
  Begründung: Titel steht ab Werk auf „Alle“ (auch Web/Karte); diese Daten haben eigene Felder mit Standard „Nur ich“ —
  ein Titel würde sie an der Einstellung vorbei zeigen (Art. 9). Später denkbar: tragbar nur, solange das zugehörige
  Feld selbst auf „Alle“ steht (geparkt).
- Mockup Entwurf 3: tragbare Abzeichen (17, davon 5 aus 2b), Schwellen 1·10·50·100·200·365, offene Liste im Sheet
  zeigt die 5 nächsten.

## Nutzer 04.11.
- Routinier en = **Steady**. Feier auch für neue Abzeichen-Titel: **ja**.
- Wünscht **Stufen je Sportart** (z. B. Amateurwanderer → … ), Vorschlag folgt.
- Fragt: Titel-Standard „Nur ich“ statt „Alle“ (löst Art. 25). Und: **sensible Abzeichen (Körper, Gewicht, Blut,
  Ruhepuls, Einnahmen, Berichte, Gesamtfortschritt) doch tragbar, Standard aus** — Bedingungen in Klärung.
- 04.11. entschieden: **Titel Standard „Nur ich“** (Art. 25 erledigt); **Feier fragt jedes Mal** „Wer soll deinen Titel
  sehen?“. Bestehende-Nutzer-Frage betrifft nur, wer vor dem Titel-Update getrackt hat. **Sportarten mit drei Stufen**
  (Tabelle Spec 3.2). **Persönliche Titel** (Körper, Gewicht, Blut, Ruhepuls, Einnahmen, Zyklen, Berichte,
  Gesamtfortschritt) **tragbar**: Standard aus, Bestätigung je Titel (Einwilligung Art. 9), nie sichtbarer als das
  Quellfeld (serverseitig), neutrale Namen (App-Store-Richtlinien Substanzen). Juristisch prüfen: Bestätigungstext, Namen.
  Mockup Entwurf 4. Routinier en = Steady.
