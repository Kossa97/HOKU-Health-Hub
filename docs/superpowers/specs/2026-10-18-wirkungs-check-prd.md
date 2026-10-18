# PRD: Wirkungs-Check (Zusammenhänge / N=1)

Stand: 2026-10-18 · Status: Entwurf · Grundlage: Konkurrenzanalyse vom selben Tag

## Problem

Nutzer mit einem Stack (TRT/Hormone, GLP-1, Peptide, Supplements) protokollieren
Einnahmen, lassen Blut abnehmen und tragen Wearables — aber niemand beantwortet die
eigentliche Frage: **„Hat sich seit dem Start von X etwas verändert, und wie sicher
ist das?"** Heute müssen sie Tabellen, Laborbefunde und Wearable-Apps im Kopf
übereinanderlegen.

Keine Konkurrenz löst das: Whoop/Oura kennen keine Dosis und keinen Zyklus, Exist.io
keine Laborwerte, Regimen/Shotsy protokollieren gut, werten aber nichts aus. Bevels
meistgewünschtes Feature (~2,7k Stimmen) ist Supplement-Tracking — die Nachfrage ist da.
Wenn wir es nicht bauen, tut es mittelfristig Oura oder Bevel.

## Personas (gleichwertig)

| | **A: TRT / Stack-Optimierer** | **B: GLP-1-Nutzer** |
|---|---|---|
| Job | „Wenn mein nächstes Blutbild kommt, will ich sehen, ob mein Protokoll passt, damit ich gezielt mit dem Arzt anpassen kann." | „Wenn ich die Dosis steigere, will ich sehen, was mit Gewicht, Appetit und Nebenwirkungen passiert, damit ich nicht blind titriere." |
| Wichtigste Messwerte | Laborwerte (E2, Hämatokrit, SHBG, Lipide), Schlaf, Energie, Libido, HRV | Gewicht, Nebenwirkungen (Übelkeit …), Appetit, Energie, Ruhepuls |
| Datenrhythmus | Labor alle 8–12 Wochen, Tagesbefinden | Gewicht mehrmals pro Woche, Wochen-Injektion |

Gemeinsamer Kern: **Einnahme-Ereignis → Zeitfenster davor/danach → Messwerte vergleichen.**

## Ziele

1. **Nutzerziel:** Ein Nutzer mit ausreichend Daten bekommt zu jedem Stack-Eintrag
   eine verständliche Vorher/Nachher-Auswertung in ≤ 2 Taps von der Stack-Seite.
2. **Ehrlichkeit:** Jede Aussage trägt eine Datenlage-Einstufung (zu wenig / Hinweis /
   deutlich) und benennt Störfaktoren (andere Änderungen im selben Zeitraum).
3. **Bindung:** Nutzer, die einen Wirkungs-Check gesehen haben, protokollieren in den
   folgenden 4 Wochen häufiger als vergleichbare Nutzer ohne.
4. **Umsatz:** Der Wirkungs-Check ist das zentrale Premium-Feature, wenn die Paywall
   (`FEATURES.PAYWALL`) eingeschaltet wird.

## Nicht-Ziele (v1)

- **Keine Dosisempfehlung, keine Handlungsanweisung.** Hält die App außerhalb der
  MDR-Einstufung als Medizinprodukt und von Apple 1.4.2 fern. Wir zeigen Beobachtungen.
- **Keine Kausalaussagen.** „Seit dem Start beobachtet", nie „X bewirkt Y".
- **Kein KI-Chat.** Erst muss die Auswertung selbst stimmen; Chat ohne Quellen wird
  laut Recherche misstraut.
- **Keine neuen Wearable-APIs (Oura, Garmin direkt).** v1 nutzt, was über
  HealthKit/Health Connect und manuelle Einträge schon kommt.
- **Keine Kreuzkorrelation über alle Messwerte („Data Mining").** Viele Vergleiche
  erzeugen Zufallstreffer; v1 vergleicht nur Messwerte, die zum Eintrag passen bzw.
  die der Nutzer gewählt hat.

## User Stories

**Persona A (TRT / Stack)**
- Als TRT-Nutzer will ich mein letztes Blutbild vor Protokollstart mit dem ersten
  danach nebeneinander sehen, damit ich Veränderungen bei E2 und Hämatokrit sofort erkenne.
- Als Stack-Nutzer will ich sehen, ob sich Schlaf, Energie und Libido seit dem Start
  eines Supplements verändert haben, damit ich entscheiden kann, ob ich es weiter nehme.
- Als Stack-Nutzer will ich gewarnt werden, wenn ich im selben Zeitraum mehrere Dinge
  geändert habe, damit ich die Veränderung nicht dem falschen Mittel zuschreibe.

**Persona B (GLP-1)**
- Als GLP-1-Nutzer will ich nach jeder Dosisstufe sehen, wie sich Gewicht und
  Nebenwirkungen entwickelt haben, damit ich das Gespräch mit dem Arzt vorbereiten kann.
- Als GLP-1-Nutzer will ich Nebenwirkungen mit einem Tap erfassen, damit die Auswertung
  genug Daten hat, ohne dass es lästig wird.

**Beide**
- Als Nutzer mit zu wenig Daten will ich erfahren, was noch fehlt („noch 9 Tage
  Tagesbefinden"), statt einer leeren oder irreführenden Grafik.
- Als Nutzer will ich die Auswertung in das bestehende PDF-Protokoll übernehmen,
  damit mein Arzt sie sieht.

## Anforderungen

### P0 — ohne das kein Launch

**P0-1 Vorher/Nachher-Vergleich je Stack-Eintrag**
- Startpunkt = Planstart bzw. Dosisänderung (vorhandene Titrations-/Planhistorie).
- Fenster: Vorher = bis zu 28 Tage vor Start, Nachher = ab Tag 7 nach Start
  (Einschwingzeit; für langsame Wirkstoffe später über Halbwertszeit ableitbar → P1).
- Pro Messwert: Mittelwert vorher/nachher, Differenz absolut und in %, Verlauf als Grafik.
- [ ] Given ≥ 10 Messtage vorher und ≥ 10 nachher, When der Nutzer einen Stack-Eintrag
  öffnet, Then sieht er den Vergleich für alle passenden Messwerte.
- [ ] Given weniger Daten, Then sieht er „zu wenig Daten" plus konkret fehlende Tage —
  keine Zahl.

**P0-2 Datenlage-Einstufung**
- Drei Stufen: *zu wenig Daten* / *Hinweis* / *deutliche Veränderung*. Grundlage:
  Unterschied relativ zur Streuung vorher (z. B. Bootstrap-Konfidenzintervall der
  Differenz); genaue Schwellen klärt Data (offene Frage).
- [ ] Jede Zahl im Feature trägt eine Stufe. Keine Zahl ohne Stufe.

**P0-3 Störfaktor-Hinweis**
- Wenn im Nachher-Fenster (oder 14 Tage davor) ein anderer Stack-Eintrag gestartet,
  beendet oder in der Dosis geändert wurde, erscheint ein Hinweis mit Namen.
- [ ] Given zwei Starts in derselben Woche, Then zeigt die Auswertung beider Einträge
  den Hinweis „gleichzeitig gestartet: …".

**P0-4 Laborwert-Vergleich**
- Letzter Laborwert vor Start vs. erster ≥ 4 Wochen nach Start, je Marker, mit
  Referenzbereich. Nutzt die vorhandenen Blutwert-Daten.
- [ ] Given kein Laborwert vor Start, Then Hinweis „kein Ausgangswert", kein Vergleich.

**P0-5 Schnelles Erfassen von Symptomen/Nebenwirkungen**
- Strukturierte Skala (0–3 oder 1–10) für eine kurze Liste je Kategorie (z. B.
  GLP-1: Übelkeit, Appetit; TRT: Libido, Stimmung), erweiterbar. Baut auf
  `daily_logs` (energie/schlaf/libido) bzw. `effects` auf statt neuer Parallelstruktur.
- [ ] Erfassen eines Tages ≤ 3 Taps, auch aus der Erinnerungs-Benachrichtigung.

**P0-6 Wording & Compliance**
- Feste Formulierungen: „beobachtet seit Start", „keine Aussage über Ursache",
  „keine Dosisempfehlung — sprich mit deinem Arzt". Nur `de`/`en` (CLAUDE.md).
- [ ] Rechtliche Prüfung der Formulierungen vor Launch abgeschlossen.

### P1 — schnell danach

- **Absetz-Phase („ABA"-Experiment):** Nutzer startet bewusst ein Experiment
  (Ausgangswert → Einnahme → Pause) mit geplanten Zeitfenstern und Erinnerung.
- **Fensterlänge aus Halbwertszeit** der vorhandenen PK-Daten ableiten.
- **Externe Störfaktoren:** Alkohol, Krankheit, Trainingslast als Tags im Tagebuch,
  im Vergleich ausblendbar.
- **Nachtest-Erinnerung:** „Dein Protokoll läuft seit 8 Wochen — guter Zeitpunkt
  fürs nächste Blutbild."
- **PDF-Export** der Auswertung im bestehenden Protokoll.

### P2 — Architektur jetzt mitdenken

- Direkte Wearable-APIs (Oura, Garmin, Whoop), CGM-Glukose.
- KI-Erklärung der Auswertung mit Quellen (nur auf Basis der berechneten Zahlen).
- Anonymisierte Vergleichswerte über viele Nutzer („bei anderen mit X …") — nur mit
  ausdrücklicher Einwilligung, DSGVO Art. 9.

**Architektur-Hinweis:** Die Berechnung als reine Funktion (Einnahme-Ereignisse +
Messreihen → Ergebnis) bauen, unabhängig von Quelle und UI. Dann sind neue Messquellen
(P2) und KI-Erklärung nur neue Eingaben bzw. Ausgaben.

## Erfolgsmessung

| Art | Kennzahl | Ziel (Erfolg / Stretch) | Wann |
|---|---|---|---|
| Früh | Anteil aktiver Nutzer mit ≥ 1 auswertbarem Eintrag | 25 % / 40 % | 30 Tage nach Launch |
| Früh | Anteil, der einen Wirkungs-Check öffnet (von berechtigten) | 50 % / 70 % | 30 Tage |
| Früh | Tage mit Tagesbefinden pro aktivem Nutzer und Woche | +1 Tag / +2 Tage | 4 Wochen |
| Spät | 8-Wochen-Retention: gesehen vs. nicht gesehen | +10 pp / +20 pp | 1 Quartal |
| Spät | Konversion zu Premium, wenn Paywall aktiv | 4 % / 8 % | 1 Quartal |

Messung nur aggregiert; keine Inhalte aus Gesundheitsdaten in Analytics-Events.

## Offene Fragen

| Frage | Wer | Blockierend? |
|---|---|---|
| Protokollieren genug Nutzer ≥ 4 Wochen an ≥ 5 Tagen/Woche? (aggregierte Zählung) | Data | **Ja** — riskanteste Annahme |
| Werden HealthKit/Health-Connect-Werte (HRV, Schlaf, Ruhepuls) in Supabase gespeichert oder nur auf dem Gerät gelesen? | Engineering | **Ja** |
| Es gibt zwei Blutwert-Strukturen (`blood_tests`/`blood_values` und `bloodwork`/`bloodwork_reports`). Welche ist führend? | Engineering | Ja |
| Statistische Schwellen für „Hinweis" / „deutlich" | Data | Ja |
| Fällt der Wirkungs-Check mit diesen Formulierungen sicher aus MDR / Apple 1.4.2? | Legal | Ja, vor Launch |
| Welche Symptom-Listen je Kategorie? | Design + Fachlich | Nein |
| Kostenlose Vorschau (z. B. ein Eintrag) vs. komplett Premium? | Stakeholder | Nein |

## Phasen

1. **Grundlagen (vorab):** Datenfragen oben klären, Symptom-Erfassung (P0-5) bauen —
   sie braucht Vorlauf, damit beim Launch genug Daten da sind.
2. **v1:** P0-1 bis P0-4, P0-6 hinter Feature-Flag, interner Test mit eigenen Daten.
3. **v1.1:** P1 (Experimente, Nachtest-Erinnerung, PDF).
4. **Paywall** mit dem Wirkungs-Check als Kern.
