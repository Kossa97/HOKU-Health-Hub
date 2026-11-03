# Hoku-Erkenntnisse (Stufe 1) — Design

Stand: 2026-11-02 · Status: Entwurf zur Freigabe · Gespräch mit dem Nutzer am selben Tag

Im Gespräch heißt das Maskottchen **Hoku**, im Code heißt es noch **Dot**
(`src/features/dot/`). Beide Namen meinen dasselbe.

## Absicht

Hoku soll im Hintergrund aller Features mitdenken: erkennen, **wie und wann** jemand
trackt, welche **Zusammenhänge** in den eigenen Daten stecken (Substanzen, Ernährung,
Training, Schlaf, Befinden), und dem Nutzer Dinge zeigen, die er selbst nie gesehen
hätte — die kritischen genauso wie die belohnenden. Vorbild sind Apps wie InsideTracker
oder Function Health, die Daten zusammenführen und informieren.

Der Nutzer will dabei **rechtlich sauber** bleiben (EU-MDR, Heilmittelwerbegesetz,
DSGVO, App-Store-Richtlinien) und **kein Geld für eine anwaltliche Prüfung** ausgeben.
Darum ist das Projekt in zwei Stufen geteilt: Stufe 1 (dieses Dokument) bleibt in dem
Bereich, der sich mit guten Gründen als Nicht-Medizinprodukt einordnen lässt. Stufe 2
(Blutwert-Kontext, eigener Zielbereich, Kombinationen aus Studien) wartet auf eine
gründlichere Grundlage.

## Ziele

1. Der Nutzer bekommt **jede Woche** 3–5 Erkenntnisse aus seinen eigenen Daten, die er
   so nicht selbst gesehen hätte — mindestens eine davon belohnend.
2. **Zwischendurch** meldet Hoku sich, wenn etwas Belastbares neu gefunden wurde.
3. Jede Erkenntnis steht **dauerhaft dort, wo sie hingehört** (Substanz-Bilanz in
   My Stack, Schlafmuster bei den Health-Daten usw.).
4. Jede Aussage trägt ihren **Beleg** (wie oft, welcher Zeitraum, Vergleich womit)
   und ist **reproduzierbar**: gleiche Daten → gleiche Erkenntnis.
5. Auf **Substanzen** wird eingegangen — als Protokoll der eigenen Daten, nie als
   Wirkungsaussage.

## Nicht-Ziele (Stufe 1)

- Kein Kontext zu einzelnen Blutwerten, keine Blutwert-Trends, kein eigener
  Zielbereich, keine Kombinationsbewertung aus Studien, keine Blutdruck-Muster (→ Stufe 2).
- Keine KI, die selbst in den Daten sucht.
- Kein Vergleich mit anderen Nutzern.
- Keine Free-Version des Features.

## Anti-Ziele (wäre ein Fehlschlag, auch wenn es technisch läuft)

- Hoku sagt **„X wirkt bei dir"**, **„X ist gut für dich"**, rankt Substanzen
  gegeneinander oder klingt nach „weiter so / mehr davon".
- Hoku nennt eine **Menge mit Einheit** als Empfehlung, rät zu Start, Stopp, Erhöhung,
  Kombination oder Zyklus, oder **diagnostiziert**.
- Hoku **warnt** oder schlägt **Alarm** zu Körperwerten (typisches Merkmal eines
  Medizinprodukts).
- Hoku meldet **Zufallstreffer** als Muster oder nennt einen Zusammenhang „Ursache".
- Hoku lobt ein **Kaloriendefizit** oder kritisiert Essen, obwohl der Nutzer das
  abgeschaltet hat.
- Das Wochen-Update ist mit **Füllstoff** gestreckt, wenn es nichts Neues gibt.

## Randbedingungen

- **Recht:** Grenze aus `docs/ki-coach/funktionen.md` („Was Dot nie tut") gilt
  unverändert. Bisherige Linie in `src/features/blutwerte/lib/markerGuidance.ts`
  (Ursachen nie nach dem eigenen Wert auswählen) bleibt in Stufe 1 unangetastet.
- **Sprachen:** nur `de`/`en` (CLAUDE.md). Texte im eigenen Namensraum von Dot
  (`src/features/dot/texte.ts` oder daneben), Locale-Dateien unberührt.
- **Datenbank:** jede Migration als `supabase-*.sql`, Trockenlauf PG 16 (2×), dann
  Produktion, dann Nachzählung (CLAUDE.md). Keine Nutzerzeilen in Antworten, Commits,
  Artefakten.
- **Gesundheitsdaten bleiben in der EU:** Analyse läuft in Supabase (`eu-west-1`) bzw.
  dort, wo die Daten liegen. Vercel (`dub1`) darf höchstens **anstoßen**, nicht
  rechnen — der AV-Vertrag mit Vercel ist laut `memory/projects/ki-coach.md` noch offen.
- **Zugang:** Bezahl-Feature. Läuft über denselben Schalter wie Dot
  (`src/features/dot/lib/zugang.ts` + Server-Gegenstück, heute `PRO_PFLICHT = false`).

## Entscheidungen des Nutzers (02.11.2026)

1. Hoku knüpft an eigene Daten an, **auch an Substanzen** — aber als Protokoll, nicht
   als Wirkungsaussage.
2. **Keine anwaltliche Prüfung.** Rechtlich prüft die KI gründlich anhand der
   Primärquellen; deshalb **Stufe 1 zuerst**, Blutwert-Kontext in Stufe 2.
3. **Feste Engine** findet die Muster, immer gleich; die KI macht nur, was sie darf
   (formulieren, Rückfragen beantworten).
4. **Alle S1- und S1v-Funde** aus dem Gespräch kommen rein, dazu die **belohnende
   Richtung**.
5. **Rhythmus:** wöchentliches Update, dazu zwischendurch bei Signifikantem.
6. **Kein Free:** das Feature gehört zum Bezahlumfang.
7. Substanz-Bilanz zeigt **beide Richtungen**, nennt **gleichzeitige Änderungen**,
   fragt nach der **eigenen Zufriedenheit**, und Hoku kann einen **Selbstversuch
   begleiten**.
8. **Nativer Push** (iOS/Android) für die Store-App wird in diesem Projekt gebaut.

Ergänzt am 03.11.2026:

9. **Alles Erlaubte wird paarweise verglichen**, auch wenn ein Nutzer nur wenige Dinge
   trackt (Beispiel des Nutzers: nur Schritte und Schlaf) → **Paar-Vergleiche**.
10. **Echte Ausreißer zählen**, besonders aus verifizierter Quelle. Ein einzelner
    PR-Test oder ein ungewöhnlich langer Lauf wird berücksichtigt und gefeiert →
    **Datenqualität**.
11. **Unnatürliche manuelle Eingaben**, auch übertriebene Dosen, verfälschen keine
    Funde. Dosen werden dabei nie fachlich bewertet → **Datenqualität**, Absatz
    Substanzen.

## Aufbau

```
Daten (Supabase, RLS)          Engine (fest, getestet)              Ausgabe
─────────────────────          ───────────────────────              ───────
dose_logs, cycles, …   ──►  1 Detektoren  → Fund (Zahlen, keine Sätze)
effects, daily_logs    ──►  2 Datenlage   → zu wenig / Hinweis / deutlich
health_daily           ──►  3 Auswahl     → neu? stark? Mischung?
training_sessions      ──►  4 Text        → feste Vorlage de/en (+ opt. KI-Ton)
food_logs, weight_logs ──►  5 Regelwächter→ durch? sonst Vorlage / verwerfen
bloodwork_reports      ──►  6 Speichern    → Wochen-Update · Push · im Feature
```

### 1. Detektoren

Ein Detektor beantwortet **genau eine vorab festgelegte Frage** (Katalog unten). Er ist
eine **reine Funktion** (Daten rein → Fund raus), unabhängig von Quelle und UI — so wie
im Architektur-Hinweis des Wirkungs-Check-PRD. Ergebnis ist ein strukturierter Fund,
z. B.:

```
{ art: 'schlaf_trainingszeit', richtung: 'positiv',
  gruppeA: { label: 'Training vor 21 Uhr', n: 11, mittel: 431 },
  gruppeB: { label: 'Training ab 21 Uhr', n: 9, mittel: 396 },
  differenz: 35, einheit: 'min', zeitraum: ['2026-09-21','2026-11-01'],
  datenlage: 'deutlich' }
```

Detektoren sind **richtungsneutral**: derselbe Detektor findet „besser" wie „schlechter".

### 2. Datenlage (Statistik)

- Drei Stufen wie im Wirkungs-Check-PRD: **zu wenig Daten / Hinweis / deutlich**.
  Gemeldet werden nur *Hinweis* und *deutlich*; Push nur bei *deutlich*.
- Grundlage: Unterschied relativ zur Streuung (Permutationstest oder
  Bootstrap-Intervall der Differenz), dazu **Mindestanzahl** (Richtwert ≥ 8 je Gruppe)
  und **Mindesteffekt** je Detektor (z. B. Schlaf ≥ 15 min).
- **Viele Tests → Zufallstreffer:** Je Lauf und Nutzer laufen viele Detektoren. Die
  Schwellen gelten deshalb nach einer Korrektur über alle Tests des Laufs
  (z. B. Benjamini-Hochberg). Messwerte werden nicht frei gegeneinander durchsucht,
  sondern nach festen Regeln paarweise verglichen (siehe **Paar-Vergleiche** unten;
  ersetzt am 03.11.2026 das frühere „nur der feste Katalog").
- Tage werden in der **Zeitzone des Nutzers** geschnitten.
- **Zeitversatz ist fest je Detektor** (z. B. V1: +1 und +2 Tage), nie frei über viele
  Verschiebungen gesucht. Jede geprüfte Verschiebung zählt als eigener Test in der
  Korrektur.
- **Schwellen (SW)** werden nicht frei gesucht: Der Detektor vergleicht feste Gruppen
  (z. B. Drittel der eigenen Tage) und nennt die Grenze gerundet („ab etwa 8.000").
  Jede Kandidaten-Grenze zählt als Test; beide Seiten brauchen die Mindestanzahl.
- Mit der Erweiterung laufen über 100 Fundarten. Die Korrektur über alle Tests eines
  Laufs ist deshalb Pflicht, nicht Kür; Fundarten, deren Daten fehlen, laufen nicht
  und zählen nicht mit.

### Datenqualität: fehlende, falsche und echte Ausreißer (Nutzer, 03.11.2026)

Grundsatz: **Ungewöhnlich ist nicht falsch.** Ein PR-Test, ein Lauf doppelt so lang wie
sonst oder eine Nacht mit 11 Stunden Schlaf nach einer Reise sind echt und zählen. Die
Engine unterscheidet deshalb Tippfehler von echten Ausnahmen, statt Ausreißer
pauschal zu streichen. Jeder Wert fällt in eine von drei Klassen:

| Klasse | Woran erkannt | Was die Engine tut |
|---|---|---|
| **fehlt** | kein Wert; 0, wo 0 nicht gemeint sein kann (0 Schritte, 0 min Schlaf = Uhr nicht getragen); Essen ohne Menge | zählt nicht, auch nicht als 0 |
| **unmöglich** | außerhalb fester Grenzen je Messwert (Tabelle unten) | zählt nicht; bei manuellen Einträgen leiser Hinweis „Eintrag prüfen" am Eintrag und im Beleg, nie im Wochen-Update, nie per Push |
| **ungewöhnlich** | innerhalb der Grenzen, aber weit weg vom eigenen Verlauf (robuster Abstand zum eigenen Median der letzten 90 Tage, Richtwert mehr als 5 MAD) | zählt mit; wie, hängt von **Quelle** und **Fundart** ab (unten) |

**Feste Grenzen (meine Wahl, Richtwerte).** Absichtlich weit: Sie fangen Komma-,
Einheiten- und Tippfehler, nie eine echte Leistung. Der Bauende prüft jede Grenze gegen
bekannte Rekorde und schreibt sie als Daten in den Katalog.

| Messwert | gültig |
|---|---|
| Schlaf je Nacht | über 0 bis 18 h |
| Schritte je Tag | über 0 bis 150.000 |
| Ruhepuls | 25–150 /min |
| Aktive kcal je Tag | bis 15.000 |
| Protein je Tag | bis 800 g |
| Körpergewicht | 25–400 kg |
| Satz im Krafttraining | Gewicht bis 600 kg, 1–100 Wiederholungen |
| Ausdauer-Einheit | Dauer bis 24 h; Strecke je Sportart (Lauf bis 350 km, Rad bis 1.000 km) |

**Die Quelle entscheidet, wie sehr einem ungewöhnlichen Wert geglaubt wird.**

- **Verifizierte Quelle** (Apple Health / Health Connect, Uhr- und Geräte-Import;
  erkennbar an `health_daily.source`, `training_sessions.source` / `external_id`): nur
  die festen Grenzen. Ein ungewöhnlicher Wert zählt **voll**, er wurde gemessen und
  nicht getippt. Einzige Ausnahme sind technische Doppelungen: Derselbe Tag oder
  dieselbe Einheit aus zwei Quellen zählt einmal (feste Rangfolge der Quellen, wählt
  der Bauende).
- **Manuell eingetragen:** Grenzen **und** Abgleich mit dem eigenen Verlauf. Ist ein
  manueller Wert ungewöhnlich, fragt die App beim Speichern einmal nach („Ungewöhnlich
  hoch für dich: 1.500 g Protein. Stimmt das?" → „Ja, stimmt" / „Korrigieren").
  **Bestätigt** zählt er wie ein verifizierter Wert. **Nicht bestätigt** (Frage
  weggeklickt) bleibt er gespeichert und sichtbar, zählt aber in keinem Muster. Wo die
  Frage beim Speichern nicht möglich ist (ältere Einträge), steht sie leise am Eintrag
  und im Beleg. Die Bestätigung wird am Eintrag gespeichert (Ablage wählt der Bauende).

**Wie ungewöhnliche Werte in die Funde eingehen** hängt davon ab, ob der Fund ein
Muster beschreibt oder einen einzelnen Bestwert feiert:

- **Muster** (Katalog-Vergleiche, Paar-Vergleiche, Schwellen, Verläufe): robust
  gerechnet, mit **Medianen statt Mittelwerten** und einem Test auf Rängen bzw. Mediane
  (Verfahren wählt der Bauende). Ein echter Ausnahmetag bleibt drin, kann aber **allein
  kein Muster tragen**. Dazu die **Einzeltag-Probe:** Ein Fund wird verworfen, wenn er
  ohne seinen stärksten Einzeltag nicht mehr wenigstens „Hinweis" wäre. Verläufe (R6)
  nehmen je Woche den besten Wert; ein Testtag verschiebt den Trend nicht allein.
- **Bestwerte und Rekorde** (R4, Lauf-Bestleistungen, L-Funde): Hier **ist** der
  Ausnahmetag der Fund. Ein PR-Test zählt sofort und wird gefeiert. Ein Einer
  (1 Wiederholung) zählt direkt mit seinem Gewicht. Der längste Lauf zählt ebenso. Das
  gilt, wenn
  - die Quelle verifiziert ist, **oder**
  - der manuelle Wert nicht ungewöhnlich ist, **oder**
  - der Nutzer ihn bestätigt hat.

  Bei einem **großen Sprung in einem manuellen Eintrag** kommt statt des Funds erst
  die Rückfrage. Richtwerte: mehr als 25 % über dem bisherigen Bestwert
  (geschätztes Einer-Maximum), oder mehr als doppelt so weit bzw. so lang wie die
  bisher längste Einheit derselben Sportart. Nach „Ja, stimmt" ist es ein Rekord.
  Bleibt die Frage unbeantwortet, gibt es keinen Rekord und **keine neue Bestmarke**.
  So blockiert ein Tippfehler nie spätere echte Rekorde.
- Korrigiert der Nutzer später einen Eintrag, prüft der nächste Nachtlauf neu; ein
  Fund, den die Daten nicht mehr tragen, wird ungültig (`gueltig = false`, gibt es seit
  Teil 1).

**Substanzen und Dosen.** Hier gibt es bewusst **keine Grenzen aus Fachwissen**: Eine
Dosis „zu hoch" zu nennen oder mit Normdosen zu vergleichen, wäre eine
Dosisbewertung (Anti-Ziel, MDR). Geprüft wird nur die **Eingabe**, und zwar
ausschließlich gegen die eigenen Angaben des Nutzers:

- Weicht eine manuell eingetragene Dosis um **Faktor 10 oder mehr** vom geplanten Wert
  derselben Substanz ab, fragt die App beim Speichern neutral nach. Ohne Plan zählt
  der Median der eigenen bisherigen Dosen dieser Substanz. Faktor 10 ist das typische
  Muster bei mg/mcg-Verwechslung und Kommafehlern. Beispiel: „Geplant sind 250 mcg,
  eingetragen sind 2.500 mcg. Stimmt das?" → „Ja, stimmt" / „Korrigieren". Die Frage
  hat keinen Warnton, nennt keine Risiken und gibt keine Empfehlung. Bei der ersten
  Dosis einer Substanz ohne Plan gibt es nichts zum Vergleichen, also keine Frage.
- **In der Engine** gilt eine unbestätigte Abweichung um Faktor 10 nicht als
  Dosisänderung: S7 beginnt keinen neuen Zeitraum, die Substanz-Bilanz zählt sie
  nicht. Bestätigt ist sie eine echte Änderung. Die Dosis selbst nennt Hoku weiterhin
  nie (S7).
- **Kein Dosis-Wirkungs-Vergleich:** Die Engine stellt nie „mehr Dosis → mehr oder
  weniger X" auf. Sie vergleicht nur Zeiträume vor und nach einer Änderung (S1, S7).
  Die Dosishöhe ist deshalb auch in den Paar-Vergleichen kein Messwert.
- Auch eine extreme Eingabe löst **keine Warnung** aus (Anti-Ziel Alarm). Die Frage
  betrifft nur die Eingabe. Ob es bei sehr großen Abweichungen zusätzlich einen festen
  allgemeinen Hinweis (Arzt, Giftnotruf) geben soll, ist offen (Offene Punkte).

### Paar-Vergleiche (Nutzer, 03.11.2026)

Ziel: Jeder Nutzer bekommt Funde aus dem, was er tatsächlich trackt, **auch wenn es nur
zwei Messreihen sind** (z. B. nur Schritte und Schlaf von der Uhr). Dafür werden alle
erlaubten Paare von Messreihen nach **festen Regeln** verglichen; nichts wird frei
gesucht.

- **Messreihen:** eine feste, versionierte Liste von Tageswerten im Katalog. Startliste
  (meine Wahl): Schlaf, Schritte, Ruhepuls, aktive kcal (Uhr); Trainingstag ja/nein,
  Trainingsdauer, Kraft- bzw. Ausdauerleistung (Training); Energie, Stimmung und weitere
  Skalen aus dem Tagebuch; kcal, Protein, Wasser, Koffein-Getränke (Ernährung); Gewicht.
- **Nie in Paaren:** Blutwerte und Blutdruck (Stufe 2), SpO₂ und Atemfrequenz (meine
  Wahl: zu nah an Körperwert-Bewertung), Dosen und Substanzen (laufen nur über S1/S7).
- **Selbstverständliche Paare ausgeschlossen** (feste Liste im Katalog), z. B.
  Schritte ↔ aktive kcal, Trainingsdauer ↔ aktive kcal, kcal ↔ Protein am selben Tag.
- **Form:** Für ein Paar (A, B) werden die eigenen Tage nach A geteilt: obere gegen
  untere Hälfte am eigenen Median, bei Ja/Nein-Reihen die beiden Werte. Verglichen wird B
  am **selben Tag** und am **Folgetag**. Der Folgetag wird in beide Richtungen geprüft
  (A → B und B → A). Je Paar höchstens drei Tests, keine anderen Versätze, keine frei
  gesuchten Grenzen.
- **Statistik:** wie oben. Mindestens 8 Tage je Gruppe; „deutlich" ab 12 Tagen je Gruppe
  und q ≤ 0,05 nach Benjamini-Hochberg über **alle** Tests des Laufs (Katalog und Paare
  zusammen). Dazu Mindesteffekt je Messreihe, robuste Rechnung und Einzeltag-Probe aus
  **Datenqualität**. Eine Reihe ohne Streuung läuft nicht.
- **Vorrang:** Deckt ein Katalog-Detektor dasselbe Paar ab (z. B. H1, W1), läuft das Paar
  nicht zusätzlich.
- **Text:** eine neutrale Vorlage je Form mit Pflichtsatz („Zusammenhang, kein Beweis."),
  Richtung immer neutral, keine Wertung „besser". Beispiel: „An Tagen mit mehr
  Schritten (über 8.400) hast du in der Nacht danach im Schnitt 24 min länger geschlafen
  (19 gegen 21 Tage). Zusammenhang, kein Beweis." Läuft durch den Regelwächter wie
  jede Vorlage.
- **Erwartung:** Mit wenigen Messreihen kommen Funde schnell. Mit vielen braucht es
  länger, weil die Korrektur strenger wird: grob 2–3 Monate bis „deutlich". Das sagt
  T6 („noch 9 Nächte") ehrlich.
- Unverändert gilt: Die Paare sind Teil des Katalogs, nicht zur Laufzeit änderbar, und
  **keine KI sucht selbst** in den Daten (Nicht-Ziel).

### Katalog als Daten (meine Wahl)

Die meisten neuen Fundarten haben dieselbe Form: **Messwert A gegen Messwert B oder
Gruppierung, mit Zeitversatz, Mindestanzahl, Mindesteffekt, Vorlage**. Sie werden
deshalb nicht einzeln programmiert, sondern als Einträge in einer festen,
versionierten Katalogdatei beschrieben, die eine allgemeine Vergleichsfunktion
ausführt. Eigenen Code bekommen nur Detektoren mit anderer Form (Substanz-Bilanz,
Streaks, Plateaus, Kraftverlauf, Vorboten, Rückblicke). Der Katalog ist Teil des Codes,
nicht zur Laufzeit änderbar, und jede Vorlage darin läuft durch den Regelwächter-Test.

### 3. Auswahl

- Je Fund ein Schlüssel (Art + betroffene Substanz/Übung + Richtung). Schon gemeldete
  Funde werden nicht wiederholt, außer die Datenlage steigt (Hinweis → deutlich) oder
  die Richtung kippt.
- Wochen-Update: **3–5 Funde**, **mindestens 1 belohnend**, **höchstens 2 kritisch**,
  stärkste zuerst. Gibt es nichts: ehrlicher Satz („Diese Woche nichts Neues — 6 Tage
  deiner Daten sind eingeflossen").
- **Positiv formulieren, wo es geht:** Hat ein Fund eine gute Seite, wird sie zuerst
  genannt („Wenn du vor 21 Uhr trainierst, schläfst du 35 min länger").

### 4. Text

- **Jede Fundart hat feste Vorlagen** in de/en mit Platzhaltern, in Hokus Stimme.
  Vorlagen werden einmal geschrieben, geprüft und getestet.
- **KI (Claude über die Edge Function `coach`) darf:**
  - einen kurzen Einleitungssatz des Wochen-Updates in Hokus Ton schreiben,
  - im Chat Rückfragen beantworten („Wie kommst du darauf?") — mit dem Fund als
    Grundlage, nicht mit Rohdaten.
- **KI darf nicht:** Funde erzeugen, Zahlen erfinden oder ändern.
- **Einwilligung und Weg (meine Wahl):** KI-Text nur bei Nutzern, die **zusätzlich**
  die Chat-Einwilligung (`coach_consent_at`) gegeben haben; sonst nur feste Vorlagen.
  Der Aufruf geht wie heute **von der App aus**, wenn sie geöffnet wird (Funde als
  Kontext an `coach`), nicht aus dem Nachtlauf ohne Sitzung des Nutzers.

### 5. Regelwächter

Läuft über **jeden** Text, der angezeigt wird (Vorlagen im Test, KI-Text zur Laufzeit):

- verboten: Mengen mit Einheit, die eine Einnahme betreffen können (mg, mcg, µg, IE,
  IU, ml, Einheiten …; bei Substanzen und Koffein jede Mengenangabe). Erlaubt sind
  Einheiten von Gewohnheiten und Körperwerten (min, h, Schritte, kg, g Protein, l Wasser),
  wenn der Wert so im Fund steht. Ebenfalls verboten: Befehle zu
  Einnahme (nimm, setz ab, erhöhe, reduziere, kombiniere, starte … und Englisch),
  Wirkungsurteile (wirkt, hilft, ist gut für, sicher, unbedenklich), Diagnosewörter
  (Mangel, Erkrankung, Störung …), Kausalwörter für Funde (weil, deshalb, verursacht),
  Alarmwörter (Achtung, Warnung, gefährlich);
- jede Zahl im Satz muss im Fund vorkommen;
- Pflichtsätze, wo die Fundart es verlangt („Zusammenhang, kein Beweis",
  „Mit deinem Arzt besprechen").

Fällt KI-Text durch → feste Vorlage. Fällt eine Vorlage durch → Test rot, Build
schlägt fehl. Der Wächter ist **eine** Funktion, die App, Server und Tests teilen.

### 6. Ausgabe

- **Wochen-Update:** Sonntagabend (Zeitzone des Nutzers). Ort und Gestaltung folgen im
  Mockup (siehe offene Punkte).
- **Push zwischendurch:** neutral, nie warnend: „Hoku hat etwas Neues zu deinem
  Schlaf gefunden." Inhalt erst in der App. **Höchstens 1 pro Tag**, Ruhezeiten
  beachten, je Art abschaltbar. Anlass: Fund erreicht *deutlich*, Meilenstein,
  Blutabnahme eingetragen (Messkontext, siehe M-Funde).
- **Im Feature:** Funde hängen an ihrem Ort (Tabelle unten, Spalte „Ort") und bleiben
  dort sichtbar, solange sie gelten.
- **Rückmeldung:** Nutzer kann einen Fund ausblenden („nicht hilfreich"); das zählt
  aggregiert, nie mit Inhalt.

### Wo es läuft

- Nachtlauf je Nutzer mit Einwilligung, dazu ein Lauf bei neuen Blutabnahme-Daten.
- Rechnen dort, wo die Daten liegen (Supabase, EU). Der Zeitplan kann von Vercel Cron
  (wie `api/send-reminders.js`) oder `pg_cron` kommen — er stößt nur an.
- **Nativer Push gehört zu diesem Projekt** (Nutzer, 02.11.2026). Heute gibt es nur
  Web-Push (`push_subscriptions`, `api/send-reminders.js`,
  `src/lib/usePushNotifications.ts`); die Store-App (iOS/Android über Capacitor)
  bekommt damit nichts. Neu: Push über APNs (iOS) und FCM (Android) für die Store-App,
  samt Geräte-Token, Schlüsseln und Store-Angaben; Web-Push bleibt für die
  Browser-Version. Push-Text enthält **keine Gesundheitsdaten**.

## Fundkatalog

**S1** = Stufe 1 · **S1v** = Stufe 1, besonders vorsichtig formuliert (immer
„in diesem Zeitraum", beide Richtungen, gleichzeitige Änderungen nennen).
**Richtung:** ± = findet beides, + = nur belohnend, − = nur kritisch.

### T — Tracking-Verhalten (Quelle: `dose_logs`, Plan, `effects`)

| ID | Frage | Richtung | Stufe | Ort |
|---|---|---|---|---|
| T1 | Einnahmetreue je Substanz, Wochentag, Tageszeit (inkl. „beste Treue seit Monaten") | ± | S1 | Kalender, My Stack |
| T2 | Einnahmezeit rutscht (z. B. Wochenende +2 h) / so stabil wie nie | ± | S1 | Kalender |
| T3 | Abstand zwischen Einnahmen schwankt stärker als der Plan | ± | S1 | My Stack |
| T4 | Einträge abends gesammelt nachgetragen → Uhrzeiten unsicher | − | S1 | Kalender |
| T5 | Tagebuch-Einträge werden weniger / mehr | ± | S1 | Tagebuch |
| T6 | Welche fehlenden Daten eine Auswertung blockieren („noch 9 Nächte") | − | S1 | dort, wo die Auswertung fehlt |
| T7 | Streaks (Einnahmen, Tagebuch), Woche ohne Lücken | + | S1 | Home |
| T8 | Meilensteine (100 Einnahmen, 30 Tage Tagebuch, 1 Jahr Hoku, erstes vollständiges Wochenbild) | + | S1 | Home |

### B — Bestand und Einstichstellen (Quelle: Bestand, `injection_logs`, `effect_symptoms`)

| ID | Frage | Richtung | Stufe | Ort |
|---|---|---|---|---|
| B1 | Vial reicht noch X Tage; Verbrauch passt nicht zum Plan | − | S1 | My Stack |
| B2 | Angesetztes Vial seit N Tagen offen / alle Vials rechtzeitig angesetzt | ± | S1 | My Stack |
| B3 | Einstichstellen gehäuft / schön gleichmäßig verteilt | ± | S1 | Injektionen |
| B4 | Tagebuch-Chip (z. B. Rötung) häuft sich an einer Stelle | − | S1v | Injektionen |

### S — Substanzen (Quelle: Plan/Titration/Zyklen, alle Messreihen, `pk_profiles`)

| ID | Frage | Richtung | Stufe | Ort |
|---|---|---|---|---|
| S1 | **Substanz-Bilanz:** je Substanz/Dosisänderung vorher vs. nachher über alle passenden Messwerte, beide Richtungen, mit „gleichzeitig geändert: …" | ± | S1v | My Stack (Substanz) |
| S2 | Zyklus: On-Phasen vs. Off-Phasen | ± | S1v | My Stack |
| S3 | Kombination aus eigenen Daten: Zeitraum „nur A" vs. „A + B" | ± | S1v | My Stack |
| S4 | Tagebuch-Einträge relativ zum Einnahmezeitpunkt / geschätzten Spiegel („häufen sich 2–4 h danach"); getrennt von Verknüpfungen des Nutzers (siehe „Verknüpfte Tagebuch-Einträge") | ± | S1v | Tagebuch, Blutspiegel |
| S5 | **Eigene Zufriedenheit:** nach einigen Wochen fragt Hoku „Wie zufrieden bist du mit X?" — steht in der Bilanz als Einschätzung des Nutzers | — | S1 | My Stack |
| S6 | **Selbstversuch:** Nutzer legt Start und beobachtete Bereiche fest; Hoku meldet nach 2, 4, 8 Wochen den Stand | ± | S1v | My Stack, Wochen-Update |

S1 ist inhaltlich der **Wirkungs-Check** aus `docs/superpowers/specs/2026-10-18-wirkungs-check-prd.md`
(P0-1 bis P0-3, P0-5, P0-6); dessen Fenster, Datenlage-Stufen und Störfaktor-Regel
gelten. Dessen **P0-4 (Laborwert-Vergleich) gehört zu Stufe 2**. S6 entspricht dem
dortigen P1 „Absetz-Experiment" in einfacher Form.

### H — Schlaf und Erholung (Quelle: `health_daily`; nur mit verbundenem Apple Health / Health Connect)

| ID | Frage | Richtung | Stufe | Ort |
|---|---|---|---|---|
| H1 | Schlafdauer vs. Trainingszeit | ± | S1 | Health |
| H2 | Schlafdauer vs. Kalorienanteil von Abendessen und Snacks (`food_logs.meal`; es gibt keine Essenszeit, darum nie „spät" sagen) | ± | S1 | Health, Ernährung |
| H3 | Schlafdauer vs. Einnahmezeitpunkt einer Substanz | ± | S1v | Health, My Stack |
| H4 | Schlafdauer nach Wochentag | ± | S1 | Health |
| H5 | Ruhepuls nach harten Trainingstagen | ± | S1v | Health, Training |
| H6 | Ruhepuls-Trend vs. Trainingsvolumen | ± | S1v | Health |
| H7 | Rekorde: Schritte, längste Serie > 7 h Schlaf, niedrigster Ruhepuls-Schnitt 30 Tage | + | S1 / S1v (Puls) | Health |

`health_daily` hat Schlaf nur als Minuten je Tag (keine Einschlafzeit, keine HRV).
Funde, die eine Schlafenszeit bräuchten, entfallen.

### R — Training (Quelle: `training_sessions`)

| ID | Frage | Richtung | Stufe | Ort |
|---|---|---|---|---|
| R1 | Leistung vs. Schlaf der Vornacht, Kalorien/Protein am Vortag | ± | S1 | Training |
| R2 | Plateau bei Übung X / Plateau durchbrochen | ± | S1 | Training |
| R3 | Trainingshäufigkeit nimmt ab / höchste seit Monaten | ± | S1 | Training |
| R4 | Persönlicher Rekord, Volumen-Rekord der Woche | + | S1 | Training |
| R5 | Comeback nach Pause | + | S1 | Training |

### E — Ernährung (Quelle: `food_logs`, `nutrition_goals`, `weight_logs`)

| ID | Frage | Richtung | Stufe | Ort |
|---|---|---|---|---|
| E1 | Kalorien-/Proteinziel getroffen nach Wochentag | ± | S1 | Ernährung |
| E2 | Protein an Trainingstagen vs. Ruhetagen | ± | S1 | Ernährung |
| E3 | Gewichtstrend vs. Kalorienbilanz | ± | S1 | Ernährung, Fortschritt |
| E4 | Ziele der Woche erreicht, bestes Wochenende seit Wochen | + | S1 | Ernährung |

Kritik an Essen entfällt, wenn der Nutzer sie abgeschaltet hat; ein Kaloriendefizit
wird nie gelobt.

### W — Befinden (Quelle: `daily_logs`, `effects`, `effect_symptoms`)

| ID | Frage | Richtung | Stufe | Ort |
|---|---|---|---|---|
| W1 | Stimmung, Energie, Libido vs. Schlaf, Training, Ernährung | ± | S1 | Tagebuch |
| W2 | Wirkungen/Nebenwirkungen im Tagebuch über die Zeit | ± | S1v | Tagebuch |

### F — Übergreifend

| ID | Frage | Richtung | Stufe | Ort |
|---|---|---|---|---|
| F1 | **Erfolgsformel:** was die besten Tage (Trainingsleistung, Energie) gemeinsam haben — nur über eine **feste, kleine Faktorliste** (Schlaf, Protein, Kalorien, Trainingszeit, Ruhetag davor) | + | S1 | Wochen-Update |
| F2 | Diese Woche vs. eigene Durchschnittswoche („besser in 4 von 5 Bereichen") | ± | S1 | Wochen-Update |

### M — Rund um die Blutabnahme (Quelle: `bloodwork_reports`/`bloodwork`, Training, Ernährung, Stack, `pk_profiles`)

Unabhängig davon, wie die Werte ausfallen — Hoku bewertet keinen Wert.

`tested_at` ist heute nur ein Datum. **Meine Wahl:** Beim Eintragen des Befunds kommt
ein **optionales Feld „Uhrzeit der Abnahme"** dazu (Migration nach CLAUDE.md-Ablauf).
Ohne Uhrzeit rechnet M4 in Tagen, M2 entfällt für diese Abnahme.

| ID | Frage | Richtung | Stufe | Ort |
|---|---|---|---|---|
| M1 | Training am Vortag / in den 2 Tagen davor | − | S1 | Blutwerte (Abnahme) |
| M2 | Mahlzeit vor der Abnahme eingetragen | − | S1 | Blutwerte |
| M3 | Stoffe im Stack, die Labortests beeinflussen können (feste, belegte Liste, z. B. Biotin, Kreatin) → „der Praxis nennen" | − | S1 | Blutwerte, vor geplanter Abnahme |
| M4 | Abstand der Abnahme zur letzten Einnahme je Substanz („18 h nach X") | — | S1 | Blutwerte |
| M5 | Abnahme komplett dokumentiert | + | S1 | Blutwerte |

### Erweiterung aus der Abhak-Liste (Nutzer, 02.11.2026)

Der Nutzer hat in der Abhak-Liste (https://claude.ai/artifact/U4kzrmarXzaSag9D4AhjzQ)
**alle 53** vorgeschlagenen Fundarten gewählt. Die Beispielsätze zeigen die Art des
Fundes, nicht den endgültigen Vorlagentext. Wo eine Gruppe zu einer bestehenden passt,
läuft die Nummer dort weiter (E, H, S); sonst hat sie eine eigene Gruppe.

#### V — Zeitversatz (Folgetag, 2–3 Tage später)

| ID | Frage | Beispiel | Richtung | Stufe | Ort |
|---|---|---|---|---|---|
| V1 | Hartes Training → Energie 1–2 Tage später | „Nach Beintraining ist deine Energie 2 Tage später am niedrigsten." | ± | S1 | Training, Tagebuch |
| V2 | Kurzer Schlaf → Stimmung am Folgetag | „Nach Nächten unter 6 h ist deine Stimmung am nächsten Tag niedriger." | ± | S1 | Health, Tagebuch |
| V3 | Viele Schritte → Schlaf in der Nacht danach | „An Tagen mit über 10.000 Schritten schläfst du 25 min länger." | ± | S1 | Health |
| V4 | Wenig Wasser → Energie und Tagebuch am Folgetag | „Nach Tagen unter deinem Wasserziel ist deine Energie am nächsten Tag niedriger." | ± | S1 | Ernährung, Tagebuch |
| V5 | Großer Abendanteil der Kalorien → Ruhepuls in der Nacht | „Nach Tagen mit viel Abendessen liegt dein Ruhepuls höher." | ± | S1v | Health, Ernährung |
| V6 | Trainingspause → Stimmung und Energie | „In Wochen ohne Training ist deine Energie im Schnitt niedriger." | ± | S1 | Training, Tagebuch |

#### VB — Vorboten (was war an den 1–3 Tagen davor anders?)

| ID | Frage | Beispiel | Richtung | Stufe | Ort |
|---|---|---|---|---|---|
| VB1 | Vor Tagebuch-Einträgen (Kopfschmerz, Müdigkeit, Unruhe …) | „Vor Kopfschmerz-Tagen hattest du meist unter 6 h Schlaf und wenig Wasser." | − | S1v | Tagebuch |
| VB2 | Vor Tagen mit hoher Energie | „Deinen energiereichsten Tagen ging meist ein Ruhetag voraus." | + | S1 | Tagebuch, Wochen-Update |
| VB3 | Vor schwachen Trainings | „Vor deinen schwächsten Trainings hast du am Vortag wenig gegessen." | − | S1 | Training |
| VB4 | Vor vergessenen Einnahmen | „Einnahmen fehlen meist am Wochenende oder nach spätem Training." | − | S1 | Kalender |

VB1 betrachtet nur Gewohnheiten (Schlaf, Wasser, Training, Ernährung) als Vorboten,
**keine Substanzen**; der Blick auf Substanzen läuft über S4 und die Bilanz.

#### SW — Schwellen bei Gewohnheiten

| ID | Frage | Beispiel | Richtung | Stufe | Ort |
|---|---|---|---|---|---|
| SW1 | Schritte-Schwelle für Schlaf | „Ab etwa 8.000 Schritten schläfst du spürbar länger." | ± | S1 | Health |
| SW2 | Schlaf-Schwelle für Leistung und Energie | „Unter 6 h 30 sinkt deine Trainingsleistung deutlich." | ± | S1 | Health, Training |
| SW3 | Protein-Schwelle für Leistung am Folgetag | „Ab etwa 130 g Protein am Vortag trainierst du stärker." | ± | S1 | Ernährung, Training |
| SW4 | Wasser-Schwelle für Energie | „Ab etwa 2,5 l Wasser ist deine Energie höher." | ± | S1 | Ernährung |
| SW5 | Trainingstage pro Woche: eigener Sweet Spot | „Mit 4 Trainingstagen ist deine Stimmung am besten, mit 6 sinkt sie wieder." | ± | S1 | Training |

Schwellen **nur bei Gewohnheiten, nie bei Substanzen oder Koffein** — dort wäre es eine
Mengenaussage. Der Regelwächter erlaubt Einheiten wie g, l, Schritte, h hier, weil sie
im Fund stehen und keine Einnahme betreffen; Einheiten von Substanzen (mg, mcg, IE …)
bleiben verboten.

#### WA — Wasser (wird erfasst, bisher nicht ausgewertet)

| ID | Frage | Beispiel | Richtung | Stufe | Ort |
|---|---|---|---|---|---|
| WA1 | Wasserziel nach Wochentag | „Am Wochenende erreichst du dein Wasserziel nur halb so oft." | ± | S1 | Ernährung |
| WA2 | Wasser an Trainingstagen gegen Ruhetage | „An Trainingstagen trinkst du kaum mehr als an Ruhetagen." | ± | S1 | Ernährung, Training |
| WA3 | Wasser gegen Energie am selben Tag | „An Tagen mit mehr Wasser trägst du höhere Energie ein." | ± | S1 | Ernährung, Tagebuch |

#### K — Körper (Quelle: `weight_logs`, `body_measurements`, `health_daily`)

| ID | Frage | Beispiel | Richtung | Stufe | Ort |
|---|---|---|---|---|---|
| K1 | Körpermaße gegen Kalorienbilanz | „Dein Bauchumfang sinkt, obwohl das Gewicht gleich bleibt." | ± | S1 | Fortschritt |
| K2 | Körpermaße gegen Training | „Seit du 4× pro Woche trainierst, steigt dein Oberarmumfang." | ± | S1 | Fortschritt, Training |
| K3 | Gewichtsschwankung nach Wochentag | „Montags wiegst du im Schnitt 0,8 kg mehr als freitags." | ± | S1 | Fortschritt |
| K4 | Gewicht gegen Kalorien am Vortag | „Nach kalorienreichen Tagen springt dein Gewicht kurz hoch und fällt in 2 Tagen zurück." | ± | S1 | Fortschritt, Ernährung |
| K5 | Langfristige Trends: Ruhepuls, Schritte | „Dein Ruhepuls ist über 3 Monate um 5 Schläge gesunken." | ± | S1v | Health |

K5 beschreibt nur den eigenen Verlauf, ohne Einordnung als gut/schlecht für die
Gesundheit und ohne Normwerte.

#### E (Fortsetzung) — Ernährung, genauer

| ID | Frage | Beispiel | Richtung | Stufe | Ort |
|---|---|---|---|---|---|
| E5 | Protein-Verteilung über die Mahlzeiten (`food_logs.meal`) | „70 % deines Proteins isst du abends." | ± | S1 | Ernährung |
| E6 | Snack-Anteil gegen Energie | „An Tagen mit vielen Snacks trägst du weniger Energie ein." | ± | S1 | Ernährung, Tagebuch |
| E7 | Ausgelassenes Frühstück gegen Energie und Training | „Ohne Frühstück trainierst du schwächer." | ± | S1 | Ernährung, Training |
| E8 | Makro-Verhältnis an den besten Trainingstagen | „Deine besten Tage hatten mehr Kohlenhydrate am Vortag." | + | S1 | Ernährung, Training |

E6/E7 fallen unter „Kritik an Essen" und entfallen, wenn der Nutzer sie abgeschaltet hat.

#### RY — Rhythmen und Rückblicke

| ID | Frage | Beispiel | Richtung | Stufe | Ort |
|---|---|---|---|---|---|
| RY1 | Wochentagsprofil für Energie und Stimmung | „Montags ist deine Energie am niedrigsten, donnerstags am höchsten." | ± | S1 | Tagebuch |
| RY2 | Monatsvergleich | „Oktober gegen September: besser in Schlaf und Treue, schlechter beim Wasser." | ± | S1 | Wochen-Update (erste Woche im Monat) |
| RY3 | Jahresrückblick „Dein Jahr mit Hoku" | „312 Tage dabei, 41 Rekorde, längste Serie 58 Tage." | + | S1 | eigener Rückblick |
| RY4 | Jahreszeit | „Im Winter schläfst du im Schnitt 20 min länger." | ± | S1 | Health |
| RY5 | „Vor einem Jahr" | „Vor einem Jahr lag dein Kniebeuge-Rekord 20 kg niedriger." | ± | S1 | Training, Fortschritt |

RY4 und RY5 brauchen mindestens ein Jahr Daten und bleiben bis dahin still.

#### G — Regelmäßigkeit (nicht wie viel, sondern wie gleichmäßig)

| ID | Frage | Beispiel | Richtung | Stufe | Ort |
|---|---|---|---|---|---|
| G1 | Feste gegen schwankende Einnahmezeit | „In Wochen mit fester Einnahmezeit schwankt deine Energie weniger." | ± | S1v | Kalender, My Stack |
| G2 | Gleichmäßige Schlafdauer | „Wenn dein Schlaf gleichmäßig ist, ist deine Stimmung stabiler." | ± | S1 | Health |
| G3 | Regelmäßiges Training gegen Leistung | „Mit festen Trainingstagen steigst du schneller." | ± | S1 | Training |

#### C — Gewohnheitsketten und Tracking

| ID | Frage | Beispiel | Richtung | Stufe | Ort |
|---|---|---|---|---|---|
| C1 | Morgentraining → vollständigeres Essens-Tracking | „An Tagen mit Morgentraining trägst du dein Essen fast immer vollständig ein." | ± | S1 | Ernährung |
| C2 | Vollständiges Tracking gegen Zielerreichung | „In Wochen mit lückenlosem Tracking erreichst du deine Ziele öfter." | ± | S1 | Wochen-Update |
| C3 | Tagebuch eher an schlechten Tagen? | „Du trägst vor allem an schlechten Tagen ein. Dein Tagebuch wirkt dadurch negativer, als deine Wochen sind." | ± | S1 | Tagebuch |
| C4 | Automatisch gegen selbst eingetragen (`dose_logs.auto_logged`) | „Seit Hoku einträgt, hast du keine Einnahme mehr nachtragen müssen." | + | S1 | Kalender |

C3 ist ein Hinweis zur Aussagekraft der eigenen Daten, keine Stimmungsdeutung.

#### S (Fortsetzung) — Substanzen, weitere Blickwinkel

Gleiche Regeln wie S1–S6: Protokoll der eigenen Daten, beide Richtungen,
gleichzeitige Änderungen, nie „wirkt", feste Messwertliste.

| ID | Frage | Beispiel | Richtung | Stufe | Ort |
|---|---|---|---|---|---|
| S7 | Dosisänderung als Startpunkt (Plan-/Titrationshistorie) | „Seit der Änderung am 3. Okt.: Schlaf +15 min, Appetit-Einträge weniger." — **die Dosis selbst nennt Hoku nicht** | ± | S1v | My Stack (Substanz) |
| S8 | Gleiche Substanz morgens gegen abends eingenommen | „In Wochen mit Einnahme am Abend war dein Schlaf kürzer." | ± | S1v | My Stack, Health |
| S9 | Vergessene Einnahmen → Befinden an den Folgetagen | „Nach ausgelassenen Einnahmen trägst du an den beiden Folgetagen weniger Energie ein." | ± | S1v | My Stack, Tagebuch |
| S10 | Tag im Einnahme-Intervall (z. B. Wochen-Injektion) | „Am Tag 1–2 nach der Injektion trägst du weniger Appetit ein, ab Tag 5 mehr." | ± | S1v | My Stack, Tagebuch |
| S11 | Zu viele Änderungen auf einmal | „Du hast in 4 Wochen 3 Substanzen gestartet. Was womit zusammenhängt, lässt sich so nicht trennen." | − | S1 | My Stack |
| S12 | Verbrauch pro Woche im Trend | „Dein Verbrauch ist seit 3 Wochen höher als der Plan vorsieht." | ± | S1 | My Stack |

S8 beschreibt, was war, und schlägt **keinen Einnahmezeitpunkt vor**. S11 rät nicht,
weniger zu ändern; er erklärt nur, warum die Bilanz unscharf ist.

#### H (Fortsetzung) — Erholung (ohne Begriffe wie „Übertraining")

| ID | Frage | Beispiel | Richtung | Stufe | Ort |
|---|---|---|---|---|---|
| H8 | Tage, bis der Ruhepuls wieder beim eigenen Schnitt ist | „Nach harten Einheiten ist dein Ruhepuls nach 2 Tagen zurück auf deinem Schnitt." | ± | S1v | Training, Health |
| H9 | Schlaf nach Trainingstag gegen Ruhetag | „Nach Trainingstagen schläfst du 18 min länger." | ± | S1 | Health |
| H10 | Sprung im Trainingsvolumen | „Diese Woche 35 % mehr Volumen als im 4-Wochen-Schnitt. Dein Schlaf war dabei kürzer." | ± | S1v | Training |

#### L — Mehr Belohnendes

| ID | Frage | Beispiel | Richtung | Stufe | Ort |
|---|---|---|---|---|---|
| L1 | Persönliche Bestwoche über alle Bereiche | „Deine beste Woche seit Beginn: Schlaf, Treue und Protein gleichzeitig vorn." | + | S1 | Wochen-Update |
| L2 | Tage, an denen alles erfasst ist | „Heute ist alles eingetragen. Das hattest du diesen Monat schon 18×." | + | S1 | Home |
| L3 | Serien bei Wasser und Protein | „7 Tage am Stück dein Proteinziel getroffen." | + | S1 | Ernährung |
| L4 | Monats-Abzeichen für Beständigkeit | „Oktober: alle Einnahmen, kein Tag ohne Eintrag." | + | S1 | Home |
| L5 | Verbesserung gegenüber dem eigenen Start | „Seit du Hoku nutzt: 40 min mehr Schlaf im Schnitt, 2 Trainings mehr pro Woche." | + | S1 | Wochen-Update, Fortschritt |

L5 nennt die Zeit „seit du Hoku nutzt" und sagt nie, Hoku oder eine Substanz habe das
bewirkt.

### Eigene Ideen des Nutzers (02.11.2026)

#### R (Fortsetzung) — Kraftverlauf

Quelle: Sätze in `training_sessions` (Gewicht × Wiederholungen); geschätztes
Maximalgewicht wie heute in `src/features/training/lib/stats.ts`
(`estimateOneRepMax`). Gilt für Kraftübungen mit genug Einheiten.

| ID | Frage | Beispiel | Richtung | Stufe | Ort |
|---|---|---|---|---|---|
| R6 | Kraftverlauf je Übung über 4 / 8 / 12 Wochen, **steigend wie fallend** | „Bankdrücken: +6 % in 8 Wochen." / „Kreuzheben ist seit 4 Wochen um 5 % gesunken." | ± | S1 | Training |
| R7 | Kraftverlauf gegen Schlaf, Protein, Kalorienbilanz und Trainingshäufigkeit im selben Zeitraum | „In den Wochen, in denen deine Kraft stieg, hattest du im Schnitt 40 min mehr Schlaf." | ± | S1 | Training, Wochen-Update |

R6 unterscheidet sich von R2 (Plateau) und R4 (Rekord) dadurch, dass er den
**Verlauf** zeigt, auch nach unten. Die Kraft je Substanz-Zeitraum steckt schon in der
Substanz-Bilanz (S1, Messwert „Trainingsleistung"). Ein Rückgang wird nie als Folge
eines Defizits gedeutet; ein Defizit wird nie gelobt, auch nicht als „Kraft gehalten
trotz Defizit". Neutral bleibt erlaubt: „Dein Gewicht sank, deine Kraft blieb gleich."

#### KO — Koffein (aus dem Ernährungstracker)

**Wie Koffein erkannt wird (meine Wahl):** `food_logs` hat heute kein Koffein-Feld und
keine Uhrzeit. Ein Eintrag zählt als **koffeinhaltiges Getränk**, wenn das Lebensmittel
auf einer festen, gepflegten Liste steht (Kaffee, Espresso, Cappuccino, Schwarz-/Grüntee,
Mate, Cola, Energy-Drink, Pre-Workout …; Abgleich über Name und, wo vorhanden, BLS-Code
oder die Koffein-Angabe von Open Food Facts). Gezählt wird die **Anzahl Getränke pro
Tag**, nie Milligramm: Eine Menge mit Einheit würde der Regelwächter zu Recht sperren,
und die Werte wären ohnehin geschätzt. Entkoffeiniertes zählt nicht.

| ID | Frage | Beispiel | Richtung | Stufe | Ort |
|---|---|---|---|---|---|
| KO1 | Koffein-Getränke gegen Schlafdauer der Nacht danach | „An Tagen mit 3 oder mehr Kaffees schläfst du im Schnitt 30 min kürzer." | ± | S1 | Health, Ernährung |
| KO2 | Koffein-Getränke gegen Energie und Stimmung am selben Tag und am Folgetag | „Am Tag nach viel Koffein trägst du weniger Energie ein." | ± | S1 | Tagebuch |
| KO3 | Trainingstage mit gegen ohne Koffein-Getränk | „An Trainingstagen mit Kaffee war deine Leistung im Schnitt gleich wie ohne." | ± | S1 | Training |
| KO4 | Koffein nach Wochentag und im Verlauf | „Seit 3 Wochen trinkst du mehr Kaffee als sonst." | ± | S1 | Ernährung |
| KO5 | Koffein-Getränke gegen Ruhepuls | „An Tagen mit viel Koffein liegt dein Ruhepuls höher." | ± | S1v | Health |

Koffein ist ein Lebensmittel, wird aber wie die Substanzen behandelt: **keine Schwelle
„ab X Tassen"** (SW-Gruppe gilt nicht), kein Rat zu weniger oder mehr, nur Vergleich
von Tagesgruppen (keins / 1–2 / 3+).

**Optionale Uhrzeit (Nutzer, 02.11.2026).** Beim Eintragen bekommt ein Getränk ein
optionales Feld „Uhrzeit". Umsetzung (meine Wahl):

- Neue Spalte `food_logs.consumed_time` (`time`, null erlaubt, lokale Uhrzeit des
  Nutzers), Migration nach CLAUDE.md-Ablauf. Die Spalte gilt technisch für jeden
  Eintrag; **angeboten** wird sie in der Oberfläche bei Getränken, deutlich bei
  Getränken der Koffein-Liste.
- Trägt der Nutzer für **heute** ein, ist die Uhrzeit mit „jetzt" vorbelegt und lässt
  sich ändern oder löschen. Für andere Tage bleibt sie leer.
- Schnelleinträge und ältere Einträge haben keine Uhrzeit; sie zählen nur in den
  Tagesvergleichen KO1–KO5.

Damit kommen dazu:

| ID | Frage | Beispiel | Richtung | Stufe | Ort |
|---|---|---|---|---|---|
| KO6 | Uhrzeit des letzten Koffein-Getränks gegen Schlafdauer | „An Tagen, an denen dein letzter Kaffee nach 15 Uhr war, schläfst du im Schnitt 25 min kürzer." | ± | S1 | Health, Ernährung |
| KO7 | Koffein-Getränk vor dem Training (Uhrzeit vor Trainingsbeginn) gegen Trainingsleistung | „Mit Kaffee in der Stunde vor dem Training war deine Leistung im Schnitt gleich wie ohne." | ± | S1 | Training |
| KO8 | Uhrzeit des letzten Koffein-Getränks gegen Einschlafzeit und Wachphasen (erst mit HS) | „Nach Kaffee nach 15 Uhr schläfst du laut deiner Uhr 30 min später ein." | ± | S1v | Health |

KO6–KO8 laufen nur über Tage, an denen eine Uhrzeit eingetragen ist, und brauchen
dafür die Mindestanzahl. Die Uhrzeit-Gruppen sind **fest** (vor 12 Uhr / 12–15 Uhr /
nach 15 Uhr), nicht frei gesucht. Hoku nennt die konkrete Uhrzeit der Gruppe, nie
„spät", und leitet keine Uhrzeit ab, bis zu der man trinken sollte.

#### HS — Schlaf genauer (Schlafphasen)

**Daten heute:** `health_daily` hat nur `sleep_min`. Das iOS-Plugin meldet alles außer
„im Bett" als „schläft" (siehe `src/features/wearables/lib/healthDaily.ts`), Android
liefert noch gar keinen Schlaf. Schlafphasen kommen erst mit dem **Plugin-Wechsel aus
Profil P1, Schritt 1b** (`docs/superpowers/specs/2026-10-31-profil-p1-datenbasis-design.md`).
Diese Gruppe **hängt an 1b** und wird danach gebaut; bis dahin bleibt sie still.

Neu in `health_daily` (Migration nach CLAUDE.md-Ablauf, meine Wahl der Felder):
`deep_min`, `rem_min`, `light_min`, `awake_min`, dazu Einschlaf- und Aufwachzeit
(`sleep_start`, `sleep_end`, lokale Zeit). Damit werden auch Funde möglich, die bisher
an der fehlenden Einschlafzeit scheiterten.

| ID | Frage | Beispiel | Richtung | Stufe | Ort |
|---|---|---|---|---|---|
| HS1 | Tief- und REM-Schlaf gegen Training, Trainingszeit, Kalorien am Abend, Koffein, Wasser | „Nach Trainingstagen hast du laut deiner Uhr 12 min mehr Tiefschlaf." | ± | S1v | Health |
| HS2 | Wachphasen in der Nacht gegen dieselben Gewohnheiten | „Nach Tagen mit viel Abendessen bist du nachts öfter wach." | ± | S1v | Health |
| HS3 | Einschlafzeit: Regelmäßigkeit und Zusammenhang mit Energie, Stimmung, Leistung | „In Wochen mit fester Einschlafzeit ist deine Energie höher." | ± | S1 | Health, Tagebuch |
| HS4 | Schlafphasen je Substanz-Zeitraum (als Messwert der Substanz-Bilanz S1) | „Seit Start von X: REM-Anteil +4 Prozentpunkte. Gleichzeitig geändert: …" | ± | S1v | My Stack (Substanz) |
| HS5 | Rekorde und Serien bei Schlafphasen und Einschlafzeit | „Längste Serie mit fester Einschlafzeit: 12 Tage." | + | S1 | Health |

Schlafphasen sind **Schätzungen der Uhr** und werden auch so benannt („laut deiner
Uhr"). Hoku vergleicht nur mit den eigenen Nächten, nie mit Normwerten, und sagt nie
„zu wenig Tiefschlaf" (das wäre eine Bewertung nah an einer Diagnose). HS4 erweitert
die feste Messwertliste der Bilanz um Schlafphasen, sobald es sie gibt.

## Leitplanken für Substanzen und Lob

- **Lob gilt dem Verhalten, nie der Substanz.** „Du warst 30 Tage dran", „In diesem
  Zeitraum stieg deine Energie" — nie „X wirkt".
- **Substanz-Bilanz zeigt immer beide Richtungen** und die gleichzeitigen Änderungen.
- **Kein Ranking** von Substanzen gegeneinander.
- **Gleiche Messwerte für jede Substanz (meine Wahl):** S1–S3 vergleichen für jede
  Substanz dieselbe feste Liste (Schlaf, Ruhepuls, Schritte, Gewicht, Stimmung, Energie,
  Libido, Trainingsleistung, Tagebuch-Chips) — **keine Zuordnung je Substanzklasse**
  („GLP-1 → Gewicht" würde eine Wirkung unterstellen). Ohne Blutwerte und Blutdruck.
- **Ton und Essenskritik (meine Wahl, gehört zu diesem Projekt):** Beide Einstellungen
  gibt es im Code noch nicht. Sie werden hier gebaut, beim Nutzer gespeichert (der
  Nachtlauf muss sie lesen) und in Hokus Menü angeboten. Ton „Kumpel" bis „Ehrlich",
  Standard mild; „Kritik an Essen" Standard an, abschaltbar (wie `funktionen.md`
  Punkt 2). Müssen vor den E-Funden stehen.

## Verknüpfte Tagebuch-Einträge und Nebenwirkungen

Hängt der Nutzer einen Tagebuch-Eintrag (z. B. Chip „Kopfschmerz") selbst an eine
Substanz, gibt es zwei verschiedene Dinge. Hoku hält sie getrennt (Nutzer, 02.11.2026):

1. **Eigene Zuordnung des Nutzers.** Die Verknüpfung ist seine Aussage, nicht Hokus.
   Sie wird nur gezählt und als solche gezeigt: „Du hast ‚Kopfschmerz' 3× mit BPC-157
   verknüpft." In der Substanz-Bilanz (S1) unter **„von dir verknüpft"**.
2. **Zeitliche Häufung aus der Engine (S4).** Unabhängig von der Verknüpfung prüft S4,
   ob sich Einträge zeitlich um die Einnahmen häufen. Steht in der Bilanz getrennt unter
   **„zeitlich gehäuft"**, mit Beleg wie jeder Fund. Die Verknüpfung des Nutzers fließt
   **nicht** in S4 ein und hebt dessen Datenlage nicht an.

Dabei gilt:

- Hoku bestätigt **nie eine Ursache** („X verursacht bei dir Kopfschmerzen") und rät nie
  zu Absetzen oder Ändern (Regelwächter wie oben).
- Nebenwirkungen werden **nicht kleingeredet oder ausgeblendet**: Sie stehen immer in
  der Bilanz, auch bei mildem Ton oder abgeschalteter Essenskritik. Die
  Auswahl-Regel „höchstens 2 kritisch" gilt nur fürs Wochen-Update, nicht für die
  Bilanz.
- **Gelobt wird das ehrliche Eintragen, nie das Symptom:** „Danke, dass du das
  festhältst. Genau so wird deine Bilanz ehrlich." Nichts darf Nutzer davon abhalten,
  Beschwerden einzutragen.
- **Fester Sicherheitshinweis bei bestimmten Chips.** Wählt der Nutzer einen Chip aus
  einer festen Liste (z. B. Brustschmerz, Atemnot, allergische Reaktion, Ohnmacht),
  erscheint sofort und immer gleich: „Bei starken oder ungewöhnlichen Beschwerden
  ärztlich abklären, im Notfall 112." (en: 112/örtliche Notrufnummer). Ausgelöst durch
  die **Auswahl des Chips**, nicht durch eine Analyse, ohne Bezug auf Werte oder
  Substanz — allgemeine Information, keine Überwachung. Kein Push, kein Wochen-Update.
  Die Chip-Liste wird in der Einstufungsbegründung einzeln begründet. Der Satz ist eine
  feste Vorlage und läuft wie jede andere durch den Regelwächter.
- **Meldeweg (optional):** In der Bilanz kann ein Link zur Nebenwirkungsmeldung beim
  BfArM stehen, als Information, ohne Aufforderung. Ob das Portal auch für nicht
  zugelassene Stoffe passt, ist offen (siehe unten); bis dahin entfällt der Link bei
  Substanzen ohne Zulassung.

## Datenschutz

- **Eigene Einwilligung** für die Hintergrundanalyse (Profiling von Gesundheitsdaten,
  DSGVO Art. 9), getrennt von Chat (`coach_consent_at`), Befund-KI und Health-Store,
  jederzeit widerrufbar. Ohne Einwilligung läuft kein Detektor für diesen Nutzer.
- **Widerruf:** Analyse stoppt, gespeicherte Funde werden gelöscht.
- Datenschutzerklärung de/en und Folgenabschätzung (`docs/datenschutz/dsfa-ki.md`)
  ergänzen.
- Analytics nur aggregiert, keine Inhalte aus Gesundheitsdaten.

## Rechtliche Begründung (Teil der Lieferung)

Vor dem Start schreibt die KI eine **Einstufungsbegründung** als Datei ins Repo
(Vorschlag: `docs/recht/hoku-erkenntnisse-einstufung.md`), gestützt auf die
Primärquellen: MDR Anhang VIII Regel 11, MDCG 2019-11, BfArM-Orientierungshilfe
Medical Apps, HWG, Apple App Review Guidelines (1.4.1, 1.4.3, 5.1.3), Google Play
Richtlinie für Gesundheits-Apps. **Jede Fundart und jede Vorlage** wird darin einzeln
begründet. Die Begründung ist keine Rechtsberatung und sagt das auch. Optional und
kostenlos: Vorlage beim BfArM-Innovationsbüro (vor Stufe 2 empfohlen).

## Verhältnis zu Bestehendem

- **`docs/ki-coach/funktionen.md`:** Punkt 2 (Lob und Kritik) und der nicht-Blutwert-Teil
  von Punkt 4 (Bestand, Einstichstellen, Einnahmetreue) gehen in diesem Design auf.
  Blutwert-Teil von Punkt 4 bleibt Stufe 2.
- **Wirkungs-Check-PRD:** wird hier als S1 umgesetzt. Sein Nicht-Ziel „kein KI-Chat"
  ist überholt (Dot-Chat existiert), gilt aber sinngemäß: Die KI erklärt nur berechnete
  Funde.
- **`markerGuidance.ts`:** bleibt allgemein und unverändert.

## Stufe 2 (nicht in diesem Projekt)

Kontext zu einzelnen Blutwerten (Muster aus dem Gespräch: „Rund um diese Messung in
deinen Daten …", bei jeder Messung, „kann/bekannt ist", immer Arzt), Blutwert-Trends,
Laborwert-Vergleich vor/nach Substanz, eigener Zielbereich als zweiter Balken mit
Quelle, Kombinationen und Synergien aus Studien mit Quelle, Blutdruck-Muster.
Voraussetzung: Einstufungsbegründung für Stufe 2, möglichst BfArM-Innovationsbüro.

## Dem Bauenden überlassen

- Tabellen- und Spaltennamen (Code heißt noch Dot), Ablage der Funde.
- Statistikverfahren im Detail und genaue Schwellen je Detektor, innerhalb der
  Vorgaben oben.
- Zeitplan-Mechanik (Vercel Cron oder `pg_cron`), solange gerechnet wird, wo die Daten
  liegen.
- Reihenfolge des Baus (Vorschlag: Engine + Regelwächter + Katalog-Format +
  T/B/R/E/W/F → Wochen-Update + Push → V/VB/SW/WA/K/RY/G/C/H/L → S-Funde und
  Substanz-Bilanz → KO → M-Funde → Selbstversuch → HS nach Profil P1, Schritt 1b).
- Die gepflegte Koffein-Liste (Namen, BLS-Codes) und wie Open-Food-Facts-Angaben
  einbezogen werden.
- Ob vorhandene Teile aus Dot-Phase 1 (Bestand, Einstichstellen) schon existieren und
  wiederverwendet werden.

## Offene Punkte

- **Gestaltung** von Wochen-Update, Fund-Karten im Feature und Substanz-Bilanz:
  per Mockup (Artefakt) mit dem Nutzer, bevor UI gebaut wird.
- **Meldeweg für Nebenwirkungen:** prüfen, ob das BfArM-Meldeportal auch Stoffe ohne
  Zulassung (viele Peptide) annimmt, und welche Chips genau den Sicherheitshinweis
  auslösen. Beides gehört in die Einstufungsbegründung.
- **Gestaltung des Uhrzeit-Felds** bei Getränken (Ernährung): per Mockup, bevor UI
  gebaut wird.
- **Schlafphasen** hängen am Plugin-Wechsel aus Profil P1, Schritt 1b; der ist noch
  nicht gebaut.
- **Rückfrage bei ungewöhnlichen Eingaben** (Ernährung, Training, Gewicht, Dosen): Text
  und Gestaltung per Mockup, bevor UI gebaut wird. Sie berührt mehrere Features.
- **Hinweis bei sehr großen Dosis-Abweichungen:** Soll es zusätzlich zur neutralen
  Eingabe-Frage einen festen allgemeinen Hinweis geben (Arzt, Giftnotruf)? Entscheidung
  des Nutzers, rechtlich in der Einstufungsbegründung zu prüfen.
- **Teil 1 nachrüsten:** R4 kennt weder feste Grenzen noch die Rückfrage bei großen
  Sprüngen. Ein manueller Tippfehler kann heute einen falschen Rekord und eine
  falsche Bestmarke setzen. Das wird vor der Freischaltung (`ERKENNTNISSE_FREI`)
  behoben, mindestens die festen Grenzen.
