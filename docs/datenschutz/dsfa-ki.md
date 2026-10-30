# Datenschutz-Folgenabschätzung (Art. 35 DSGVO): KI-Funktionen und Dot

Stand: 28.10.2026 · **Entwurf** — vor dem Start von einer Person mit
Datenschutz-Fachkunde prüfen und vom Verantwortlichen freigeben lassen.

Verantwortlich: [[Name bzw. Firma laut Impressum]]

## 1. Warum eine Folgenabschätzung

TYD verarbeitet Gesundheitsdaten (Art. 9 DSGVO) und gibt sie für KI-Funktionen an
einen Anbieter in den USA. Die Kriterien der Aufsichtsbehörden (WP 248, DSK-Liste
„Muss-Liste“) sind mehrfach erfüllt: besondere Kategorien, neue Technologie (KI),
Übermittlung in ein Drittland, potenziell viele Betroffene. Die Folgenabschätzung
ist deshalb Pflicht, nicht nur ratsam.

## 2. Beschreibung der Verarbeitung

| Funktion | Was übertragen wird | Empfänger | Was zurückkommt | Was TYD speichert |
|---|---|---|---|---|
| Befund-Import | Foto/PDF eines Laborbefunds | Anthropic (Claude), USA | erkannte Laborwerte | nur die vom Nutzer übernommenen Werte; Zeitpunkt der Anfrage (Limit) |
| Etikett lesen (My Stack) | Foto eines Etiketts | Anthropic | Name, Form, Stärke | nur, was der Nutzer speichert |
| Dot erkennt dein Essen | verkleinertes Foto und/oder Notiz | Anthropic | Name des Gerichts, mögliche Zutaten | Zeitpunkt der Anfrage (Limit) |
| Dot (Chat) | Frage + Zusammenfassung: Stack, Plan und Einträge der letzten 7 Tage, letzte Blutwerte, heutige Ernährung | Anthropic | Antwort, ggf. vorbereitete Einträge/Anlage | Anzahl Fragen pro Tag (`coach_usage`, ohne Inhalt); Verlauf nur auf dem Gerät |
| Spracheingabe bei Dot | Sprache | Apple bzw. Google (Spracherkennung des Browsers/Systems) | Text | nichts |

Technik: Die App ruft Supabase-Edge-Functions auf (`bloodwork-extract`,
`label-extract`, `food-photo`, `coach`); nur diese sprechen mit der Anthropic-API.
Der API-Schlüssel liegt nur dort. Die Functions laufen fest in `eu-west-1`
(Irland, `FUNKTIONS_REGION` in `src/lib/supabase.ts`), die Vercel-Funktionen in
`dub1` (Irland). Einträge, die Dot vorbereitet, schreibt die App
selbst mit der Sitzung des Nutzers (Zeilenrechte/RLS), nicht der Server.

Modelle: Claude Opus 5.5 (Dot, Ausweichmodelle bei Ablehnung: Opus 5 bzw. 4.8),
Claude Haiku 5.5 (Essen, Etikett), Claude Haiku 4.5 (Befund). Keines davon ist ein
„Covered Model“ mit Pflicht-Aufbewahrung von 30 Tagen.

## 3. Rechtsgrundlage

- Art. 6 Abs. 1 lit. a und **Art. 9 Abs. 2 lit. a DSGVO: ausdrückliche Einwilligung**,
  je Funktion getrennt: `profiles.ai_import_consent_at` (Befund, Etikett),
  `profiles.ai_food_consent_at` (Essen), `profiles.coach_consent_at` (Dot).
- Die Edge Functions prüfen die Einwilligung serverseitig und senden ohne sie nichts
  (`consent_required`, 403).
- Widerruf jederzeit: Profil bzw. im Chat; danach geht nichts mehr an Anthropic.
- Die Einwilligungstexte nennen: KI, Anthropic, USA, welche Daten, dass es
  Gesundheitsdaten sind, Widerruf.
- Ohne Einwilligung bleibt die App voll nutzbar (Kopplungsverbot, Art. 7 Abs. 4).

## 4. Notwendigkeit und Verhältnismäßigkeit

- **Zweckbindung:** nur die jeweilige Funktion; kein Training (Commercial Terms von
  Anthropic: „Anthropic may not train models on Customer Content from Services.“),
  keine Werbung, kein Profiling.
- **Datenminimierung:** Dot bekommt eine Zusammenfassung, nicht die Datenbank; Fotos
  werden verkleinert; der Befund-Import empfiehlt, Name und Anschrift abzudecken.
- **Speicherbegrenzung:** TYD speichert keine Fragen, Antworten, Fotos oder Dateien
  auf dem Server. `coach_usage` wird beim Löschen des Kontos mitgelöscht
  (`on delete cascade`).
- **Transparenz:** Datenschutzerklärung Abschnitt 5 nennt jede Funktion einzeln.
- **Betroffenenrechte:** Export, Löschen, Widerruf in der App.

## 5. Risiken für Betroffene

| Risiko | Eintritt | Schwere | Maßnahmen | Restrisiko |
|---|---|---|---|---|
| Zugriff US-Behörden auf übertragene Daten (FISA 702) | gering | hoch | SCC im Auftragsverarbeitungsvertrag; minimierte Daten; kurze Aufbewahrung bzw. ZDR beantragen | mittel, bis ZDR bestätigt |
| Speicherung bei Anthropic länger als nötig | mittel | mittel | ZDR beantragen; sonst Standardfrist; Missbrauchsfälle bis 2 Jahre | gering bis mittel |
| Falsche KI-Auskunft führt zu Gesundheitsschaden | mittel | hoch | Dot gibt keine Dosis- oder Planempfehlung, keine Diagnose, verweist an Arzt/Apotheke, Notfallhinweis 112; Befund- und Essenserkennung schlagen nur vor, der Nutzer bestätigt | gering bis mittel |
| Falscher Eintrag durch Dot (Einnahme, Substanz) | mittel | gering | Karte mit Rückgängig; Anlage nur vorbefüllt, Speichern durch den Nutzer | gering |
| Dritte Personen auf Fotos / Daten auf Befund | mittel | mittel | Hinweise in der App; keine Speicherung | gering |
| Sprache geht an Apple/Google | sicher bei Nutzung | mittel | nur auf Tippen; in der Datenschutzerklärung genannt; Tastatur als Alternative | mittel (siehe offene Punkte) |
| Unbefugter Zugriff auf Konto/Funktionen | gering | hoch | Anmeldung, RLS, Schlüssel nur serverseitig, Tageslimits | gering |
| Prompt-Injection über eigene Daten | gering | gering | Dot sieht nur Daten des Nutzers selbst; Werkzeuge sind eng gefasst und werden in der App validiert | gering |

## 6. Medizinprodukte (MDR)

Dot erklärt, erinnert und vergleicht einen Wert nur mit dem Referenzbereich, den
das Labor auf den Befund gedruckt hat. Keine Diagnose, keine persönliche
Gefährlichkeitsbewertung, keine Dosis- oder Therapieempfehlung (Systemprompt,
`supabase/functions/coach/prompt.ts`). Damit fehlt nach unserer Einschätzung die
medizinische Zweckbestimmung (Art. 2 Nr. 1 MDR, MDCG 2019-11). **Jede neue Funktion,
die Werte bewertet oder Hinweise gibt („Blutwerte-Hinweise“), vorher neu prüfen.**

## 7. Offene Punkte vor Freigabe

1. **Zero Data Retention** bei Anthropic beantragen (Vertrieb) oder die Standardfrist
   schriftlich festhalten; danach den Platzhalter in Abschnitt 5 der
   Datenschutzerklärung füllen.
2. **Auftragsverarbeitungsverträge** bestätigen: Anthropic (über die Commercial
   Terms einbezogen), Supabase (im Dashboard abschließen), Vercel, Sentry. Bei
   Vercel prüfen, ob der Tarif gewerbliche Nutzung erlaubt.
3. **Spracheingabe:** entscheiden, ob vor dem ersten Mikrofon-Tippen ein kurzer
   Hinweis („Die Erkennung macht Apple bzw. Google“) erscheinen soll.
4. Diese Folgenabschätzung prüfen lassen, freigeben, bei Änderungen fortschreiben.

Freigabe: ____________________ Datum: __________
