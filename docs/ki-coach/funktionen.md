# Dot – Funktionsumfang (Spezifikation)

Stand 24.10.2026. Grundlage: Nachricht des Nutzers vom 23.10. (acht Punkte, alle
übernommen). Preis, Paywall und Abo-Modell werden **an anderer Stelle** entschieden
und sind hier ausgeklammert.

## Problem

Wer Peptide, Medikamente oder Hormone nach Plan nimmt, trägt jeden Tag mehrfach
dasselbe ein, übersieht Leeres, Abgelaufenes und Tippfehler und merkt Veränderungen
an Blutwerten erst spät. Heute ist Dot ein Maskottchen mit Chat. Er soll den
Nutzern **Arbeit abnehmen und aufpassen**.

## Ziele

1. Eintragen kostet im Alltag höchstens eine Nachricht pro Tag, statt ein Tipp je Einnahme.
2. Fehler werden aufgefangen, bevor sie im Protokoll stehen (Tippfehler, leeres Vial, abgelaufenes Vial).
3. Veränderungen an den eigenen Werten fallen auf, ohne dass der Nutzer danach suchen muss.
4. Neue Nutzer finden jede Funktion der App, ohne Hilfe von außen.
5. Dot ist ein Begleiter, den man behalten will (Lob, Kritik, Persönlichkeit, später Aussehen).

## Was Dot nie tut (gilt für alle Punkte)

- **Keine Dosisempfehlung**, keine Empfehlung zu Start, Stopp, Kombination oder Zyklus.
- **Keine Diagnose**, keine Bewertung „gefährlich für dich", keine Deutung von Symptomen.
- **Nur Fakten aus den eigenen Daten**: Vergleich mit dem eigenen Plan, dem eigenen Ziel,
  dem Referenzbereich des Labors oder dem eigenen früheren Wert.
- Alles, was nach Medizinprodukt (EU-MDR) riecht, geht vor dem Bau durch eine
  rechtliche Prüfung (siehe offene Fragen).

## Die acht Punkte

### 1. Hinweise bei sehr hohen Eingaben (nur wo erlaubt)

- **Kalorien:** Liegt der Tag deutlich über dem eigenen Ziel (`nutrition_goals`), sagt
  Dot es, sachlich, mit Zahl. Ebenso bei einzelnen Einträgen, die ungewöhnlich groß sind
  (z. B. eine Mahlzeit mit mehr als dem halben Tagesziel).
- **Plausibilität beim Eintragen:** Weicht eine eingetragene Menge stark vom **eigenen**
  Plan ab (z. B. Faktor 10, falsche Einheit mg/mcg), fragt Dot nach: „Dein Plan sagt
  200 mcg, du hast 2000 eingetragen – Tippfehler?" Er schlägt keine andere Menge vor,
  er zeigt nur den Plan.
- Akzeptanz: Der Hinweis erscheint vor dem Speichern bzw. direkt danach mit „Rückgängig";
  bestätigt der Nutzer, wird nicht erneut gefragt.

### 2. Lob und Kritik

- **Lob für:** Streaks (Tage in Folge alle Einnahmen erledigt), Einnahmetreue der Woche,
  Kalorienziel eingehalten, eigene Ziele erreicht (z. B. Gewicht), Bewegung.
- **Kritik:** ehrlich, nicht verletzend, z. B. „Diese Woche dreimal Ipamorelin vergessen."
- **Ton einstellbar:** „Kumpel" (nur Lob, milde Hinweise) bis „Ehrlich" (direkte Kritik).
  Standard ist mild. Kritik an Essen ist abschaltbar (Rücksicht auf Essstörungen).
- **Bewegung** braucht Daten, die es noch nicht gibt (Apple Health / Health Connect,
  siehe Punkt 6 und Abhängigkeiten).

### 3. Dot nimmt die Arbeit ab (automatisches Tracking)

- **Einstellung je Substanz bzw. Plan:** „Dot trägt automatisch als erledigt ein" an/aus.
- Zur geplanten Zeit (plus Puffer) gilt eine Einnahme als erledigt, wenn der Nutzer
  nichts anderes sagt.
- **Der Nutzer meldet nur Ausnahmen**, per Satz im Chat:
  „GHK heute vergessen", „Tesa heute erst um 22 Uhr", „Tesa ab jetzt immer 21 Uhr".
  Dot setzt das um und bestätigt in einem Satz, mit „Rückgängig".
- Automatisch eingetragene Einträge sind **sichtbar markiert** (Kalender, Export, PDF),
  damit das Protokoll für den Arzt ehrlich bleibt.
- Auch umgekehrt per Satz: „BPC gerade gespritzt, Bauch links" trägt Einnahme,
  Einstichstelle (3D-Tracker) und Bestand ein.
- Akzeptanz: Jede Änderung durch Dot ist im Verlauf nachvollziehbar und einzeln
  rückgängig zu machen. Eine Zeitänderung „ab jetzt" ändert den Plan erst nach Bestätigung.

### 4. Überwachung: Abweichungen an Werten

- **Blutwerte:** außerhalb des Referenzbereichs des Labors, oder deutliche Änderung
  zum eigenen letzten Wert (Prozent), oder ein Trend über mehrere Messungen.
  Formulierung immer als Fakt: „ALT liegt bei 62, der Bereich deines Labors ist bis 50;
  im Juni lag er bei 38." Dazu der Satz, dass das ein Arzt einordnen sollte.
- **Bestand und Ablauf:** Vial reicht noch X Tage; angesetztes Vial seit N Tagen offen.
- **Einstichstellen:** dieselbe Stelle mehrmals hintereinander.
- **Einnahmetreue:** wiederkehrend verpasste Einnahmen (Muster, z. B. immer abends).
- Akzeptanz: Jeder Hinweis nennt die Quelle (welcher Wert, welches Datum, welcher Bereich).

### 5. Erinnern auf Zuruf

- „Erinner mich Freitag an die Blutabnahme", „in 2 Stunden ans Essen", „jeden Sonntag
  ans Vial ansetzen". Dot bestätigt Zeitpunkt und Text; Liste und Löschen im Chat.
- Braucht **Mitteilungen aufs Handy** (heute nicht vorhanden: Capacitor Local
  Notifications einbauen). Ohne das erinnert Dot nur bei offener App.

### 6. Workout: Stoppuhr, Übungen, Motivation

- **Stoppuhr und Pausentimer** auf Zuruf („90 Sekunden Pause"); Dot zählt sichtbar runter
  (Animation passt zu seiner Form), Signal am Ende.
- **Übungen erklären:** Ablauf, worauf achten, häufige Fehler – allgemeines Wissen,
  keine Trainingspläne mit Gewichten/Lasten als „Empfehlung für dich".
- **Motivation** während des Workouts (kurze Sätze, Satz-Zähler).
- Abgrenzung: TYD wird keine Workout-App. Erste Version ohne Trainingsplanung und ohne
  Speicherung von Workouts; später optional Anbindung an Apple Health.

### 7. FAQ und Führung durch die App

- Dot beantwortet jede Frage zur App („Wie lege ich ein Vial an?").
- **Zeigen statt erklären:** Dot fliegt zur Stelle, hebt den Knopf hervor und erklärt ihn
  („Hier trägst du Blutwerte ein"). Auf Wunsch eine geführte Tour je Bereich.
- Wissensbasis: eine gepflegte Liste der Funktionen (de/en), die Dot mitbekommt;
  gleichzeitig Grundlage für die Markierungen, denen Dot ausweicht (`data-dot-avoid`).

### 8. Skins, Effekte, Emotes, Battle Pass

- **Skins:** Farben/Materialien der Punktwolke (Engine kann Farbe und Licht je Punkt).
- **Effekte:** Spuren beim Werfen, andere Funken, eigene Arten herauszukommen.
- **Emotes:** neue Gesten und Gesichter (Jubeln, Tanz, Schlafen in Varianten).
- **Battle Pass:** Saison mit Stufen, freigeschaltet durch **Einnahmetreue und Streaks**,
  nicht durch Zusatzaufgaben – damit niemand Einnahmen abhakt, nur um Punkte zu sammeln.

## Reihenfolge (Vorschlag)

| Phase | Inhalt | Warum zuerst |
|---|---|---|
| 1 | 3 Automatisches Tracking + Eintragen per Satz, 1 Plausibilität und Kalorien, 4 Bestand/Ablauf/Einstichstellen | größter täglicher Nutzen, nur vorhandene Daten |
| 2 | 4 Blutwert-Abweichungen, 7 FAQ und Führung, 2 Lob/Kritik (ohne Bewegung) | braucht rechtliche Klärung bzw. Wissensbasis |
| 3 | 5 Erinnerungen (Mitteilungen), 6 Workout-Modus | neue native Technik |
| 4 | 8 Skins, Effekte, Emotes, Battle Pass; 2 Bewegung (Health-Anbindung) | lohnt sich, wenn der Kern trägt |

## Messgrößen

- Anteil der Einnahmen, die automatisch oder per Satz eingetragen werden (Ziel Phase 1: > 60 % bei Nutzern mit Auto-Tracking).
- Rückgängig-Quote bei Dot-Einträgen (< 5 %; höher heißt: Dot versteht falsch).
- Aufgefangene Plausibilitätsfehler pro 100 Einträge.
- Wöchentlich aktive Dot-Nutzer, Bindung nach 30 Tagen im Vergleich zu Nutzern ohne Dot.

## Offene Fragen

- **Recht (blockierend für 4):** Sind Hinweise zu Blutwerten außerhalb des Laborbereichs
  ein Medizinprodukt nach EU-MDR? Gleiche Frage für Plausibilität gegen den eigenen Plan.
- **Recht:** Automatisch eingetragene Einnahmen im Protokoll – reicht die Markierung?
- **Technik:** Mitteilungen (Capacitor Local/Push Notifications) und Health-Anbindung
  (HealthKit, Health Connect) – Aufwand, App-Store-Freigaben.
- **Technik:** Eintragen per Satz – Claude mit Werkzeugen (Tool Use) über die Edge Function,
  Schreibrechte nur auf die eigenen Zeilen, Bestätigung vor jeder Planänderung.
- **Produkt:** Welche Punkte kostenlos, welche Pro (wird an anderer Stelle entschieden).
- **Daten:** Zählt der Battle Pass Streaks aus automatisch eingetragenen Einnahmen mit?
