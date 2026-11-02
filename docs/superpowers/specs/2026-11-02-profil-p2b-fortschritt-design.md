# Profil, Teilprojekt 2b: Gesamtfortschritt und Abzeichen — Design

Stand 02.11.2026, mit dem Nutzer geplant. Gehört zu
`2026-10-31-profil-social-gesamtbild-design.md`; baut auf 2a
(`2026-10-31-profil-p2a-sichtbarkeit-design.md`, PR #119) auf.
Mockups: `docs/profil/mockups/profil-2b.html` (Aufschlüsselung, Abzeichen) und
`docs/profil/mockups/profil-2b-varianten.html` (Darstellung, Variante 1 + 2 gewählt).
Markierungen: **[Nutzer]**, **[Claude]** (vorgeschlagen und bestätigt),
**[Claude, ungeprüft]**, **[Bauende]**.

## Absicht

Das Profil zeigt in einer Zahl, wie weit man seit dem eigenen Start gekommen ist,
und darunter, woraus sie sich zusammensetzt. Abzeichen belohnen Beständigkeit,
Meilensteine und Fortschritt. Verglichen wird nie mit anderen. **[Nutzer]**

Erfolg: Ein Nutzer sieht im Profil „+28,3 % positive Veränderung seit 14.03.2026“,
tippt darauf, versteht jeden Teilwert, ändert eine Richtung oder schließt einen
Wert aus, und die Zahl rechnet sofort neu. Verdiente Abzeichen erscheinen im Profil.

## Nicht-Ziele

- Vergleich mit anderen, Ranglisten.
- Abzeichen, die Freunde brauchen (kommen mit Teilprojekt 3).
- HRV und VO2max als Messwerte (Schritt 1b); sie haben einen Platz in der Rechnung,
  zählen aber erst, wenn es Messungen gibt.
- Medizinische Bewertung („gesund“, „ungesund“).

## 1. Rechnung **[Nutzer]**

**Je Wert:** Prozent der positiven Veränderung vom Start bis jetzt, relativ zum Startwert.

| Richtung | Formel | Beispiel |
|---|---|---|
| runter | (Start − jetzt) ÷ Start | Gewicht 120 → 100 kg = +16,67 % |
| hoch | (jetzt − Start) ÷ Start | Kreuzheben e1RM 120 → 142 kg = +18,3 % |
| Zielbereich (Anteil) | **Lücke zum Ziel geschlossen:** (jetzt − Start) ÷ (100 % − Start) | Marker 12/24 → 19/24 = +58,3 %; Schlaf 2/28 → 14/28 Nächte = +46,2 % |

- Schlechter wird negativ. Werte, die schon Prozent sind (KFA, Adherence), rechnen
  genauso relativ: 19,4 → 15,8 % KFA = +18,6 %. **[Nutzer]**
- Erklärung in der App, nach dem Hinweis des Nutzers: „Die Prozent gelten für den
  Wert selbst, nicht automatisch für dein Körperfett oder deine Gesundheit.“ **[Nutzer]**
- Anteilswerte (Schlaf, Blut) haben ein natürliches Ziel (100 % im Bereich) und
  rechnen deshalb als geschlossene Lücke, −100 … +100 %. Relativ zum Start ergäben
  kleine Startanteile riesige Zahlen (2/28 → 14/28 = +600 %), die alles andere
  überstrahlen. **[Nutzer]**, Vorschlag **[Claude]**
- Eine Untergrenze für kleine Startwerte gibt es nicht: echte große Fortschritte
  bei relativen Werten zählen voll. **[Nutzer]**
- Ein Wert zählt erst mit belastbarer Baseline (Abschnitt 2). **[Nutzer]**

**Zusammenrechnen** **[Nutzer]:** Mittel der Werte je Bereich, dann Mittel der
Bereiche. Fünf Bereiche zählen gleich viel: Körper, Blut, Training, Einnahmen,
Erholung & Fitness. Bereiche ohne Wert fallen heraus. **Kein Deckel.**

**Zeitraum** **[Nutzer]:** seit Start = erste Messung je Wert. Der Nutzer kann einen
neuen Start setzen (neue Phase); der alte bleibt im Verlauf und lässt sich wieder nutzen.

## 2. Werte, Richtung und Quelle

| Bereich | Wert | Richtung (Standard) |
|---|---|---|
| Körper | Gewicht | aus den Ziel-Tags: Fettabbau → runter, Muskelaufbau → hoch, Recomp/sonst → aus **[Claude]** |
| | Körperfett | runter (fest) |
| | Muskelmasse | hoch (fest) |
| | Umfänge je Stelle | Taille, Bauch, Hüfte runter; Oberarm, Brust, Oberschenkel, Wade hoch bei Muskelaufbau/Kraft, sonst runter; Hals, Unterarm aus **[Claude, ungeprüft]** |
| Blut | Marker im Zielbereich | Zielbereich (Anteil) |
| Training | Workouts pro Woche, e1RM je Übung der Top 3 | hoch |
| Einnahmen | Adherence | hoch |
| Erholung & Fitness | Schritte, aktive kcal, VO2max | hoch |
| | Ruhepuls, Blutdruck (oberer Wert) | runter **[Claude, ungeprüft]** |
| | Schlaf | Zielbereich: Anteil der Nächte mit 7–9 h **[Nutzer: Methode A]** |
| | HRV | hoch (zählt ab 1b) |

Der Nutzer kann jede Richtung ändern oder den Wert ausschließen. **[Nutzer]**

**Belastbare Baseline** **[Nutzer]**, Schwellen **[Claude, vom Nutzer bestätigt]**

| Wert | zählt, wenn … | sonst |
|---|---|---|
| Schritte, kcal, Ruhepuls, Blutdruck, HRV, VO2max | ≥ 14 Tage Daten in den 60 Tagen vor dem Start (Apple Health / Health Connect); Startwert = deren Durchschnitt | die ersten 28 Tage nach dem Start werden die Baseline, der Wert zählt ab Tag 29 |
| Schlaf | ≥ 14 Nächte in den 60 Tagen vor dem Start; Startwert = Anteil der Nächte mit 7–9 h | wie oben, 28 Nächte |
| Gewicht, KFA, Muskelmasse, Umfänge | erste Messung + eine zweite mindestens 14 Tage später | zählt noch nicht |
| Blutwerte | ab dem zweiten Befund | zählt noch nicht |
| e1RM je Übung | ab 3 Einheiten mit der Übung | zählt noch nicht |
| Workouts pro Woche, Adherence | ab 4 Wochen Daten | zählt noch nicht |

Bis dahin zeigt die eigene Aufschlüsselung „sammelt Baseline: 9 von 14 Tagen“;
andere sehen den Wert nicht. Es gibt keinen Rückfall auf „erste 7 Tage“.
- „Jetzt“ = Durchschnitt bzw. Anteil der **letzten 28 Tage**. **[Nutzer]**
- Die Baseline wird beim Setzen des Starts einmal auf dem Gerät gelesen und
  gespeichert (sie ändert sich danach nicht mehr).
- Android liest ohne die Zusatzberechtigung `READ_HEALTH_DATA_HISTORY` nur bis
  30 Tage vor der Freigabe. 2b fragt diese Berechtigung nicht an; die Baseline
  ist dort dann kürzer oder fällt auf die ersten 7 Tage zurück. **[Claude, ungeprüft]**

## 3. Darstellung (Mockup `profil-2b.html`)

- **Kein Ring:** Ein Ring bedeutet „Anteil an einem Ganzen“ und endet bei 100 %;
  der Gesamtfortschritt geht realistisch darüber und kann negativ sein. **[Nutzer]**
- **Profil, Karte „Gesamtfortschritt“** (Variante 1) **[Nutzer]**: große Leitzahl
  mit Vorzeichen („+28,3 %“, „positive Veränderung“, „seit 14.03.2026 · Mittel aus
  5 von 5 Bereichen“), darunter die fünf Bereiche als Balken um eine Nulllinie
  (rechts besser, links schlechter), Skala wächst mit, jeder Balken mit Zahl.
  Antippen eines Bereichs klappt seine Werte auf; Werte ohne Baseline mit „wartet“.
- **Antippen der Karte öffnet die Zeitreise** (Variante 2) **[Nutzer]**: Verlauf
  des Gesamtwerts seit Start; mit dem Finger über die Linie fahren setzt Zahl und
  die fünf Bereichswerte auf diesen Tag; Abzeichen als Punkte am Tag des Erhalts;
  mit Pfeiltasten bedienbar. Darunter die Aufschlüsselung je Wert (Start → jetzt,
  Prozent, Richtungswahl ↓/↑/Zielbereich/aus), „Neuen Start setzen“, vorheriger
  Start wieder wählbar, Erklärung der Rechnung.
- Farben der Bereiche aus der dataviz-Referenzpalette (dunkel, Slots 1–5), gegen den
  Kartenhintergrund geprüft; jede Farbe trägt zusätzlich ihre Zahl und ihren Namen.
- **Abzeichen:** Zeile im Profil (zuletzt verdiente), Seite „Alle Abzeichen“ nach
  Gruppen. Nicht verdiente zeigt nur der Nutzer selbst, grau mit Stand („41/100“).
- Neue Sichtbarkeitsfelder `progress` (Gesamtfortschritt samt Aufschlüsselung je
  Bereich) und `badges` (verdiente Abzeichen), Standard „Nur ich“ wie alle Felder.
  Andere sehen nie die Einzelwerte der Aufschlüsselung, sondern nur Gesamt und
  Bereichsbalken; Einzelwerte folgen ihren eigenen Feldern. **[Claude, ungeprüft]**

## 4. Abzeichen **[Nutzer: alle Arten, grob; Feinschliff macht der Nutzer]**

Erster Satz (39), zum Feinschliff durch den Nutzer:

- **Beständigkeit:** 7 / 30 / 100 / 365 Tage ohne Lücke; 4 / 12 / 52 Wochen
  Training in Folge; 30 Tage alle Einnahmen bestätigt; 8 Wochen jede Woche gewogen.
- **Meilensteine:** erster Tageseintrag, erste Umfangsmessung, erstes Blutbild,
  3 Blutbilder, 10 / 50 / 100 / 250 Workouts, erster Zyklus abgeschlossen,
  Wearable verbunden, Profil vollständig, erstes Fortschrittsfoto.
- **Fortschritt:** −5 / −10 / −20 % Körperfett (relativ, wie die Rechnung),
  −5 % Gewicht, neue Bestleistung, 3 Bestleistungen in einem Monat, alle
  Blutwerte im Zielbereich, Ruhepuls −5 bpm, eine Woche Ø 10.000 Schritte,
  Gesamtfortschritt +10 / +25 / +50 %.
- **Gemeinschaft:** erster / 5 / 25 Erfahrungsberichte, Profil geteilt;
  erster Freund und 10 Freunde erst mit Teilprojekt 3.

Abzeichen werden einmal verdient und bleiben (kein Verlust bei Rückschritt).
**[Claude, ungeprüft]** Die Liste steht in einer Datei, damit der Nutzer sie
pflegen kann (Name, Symbol, Bedingung, Gruppe).

## 5. Technik **[Claude, ungeprüft]**

- Rechnung als reine, getestete Funktion auf dem Gerät (wie der Schnappschuss in 2a).
- Für die Zeitreise speichert das Gerät eine Wochenreihe von Gesamt und Bereichen
  (`progress_settings.history` oder im Schnappschuss, höchstens 104 Wochen).
- Neue Tabelle `progress_settings(user_id, start_on, previous_starts, directions,
  excluded, baselines, updated_at)`, RLS nur für den Nutzer.
- Gesamt, Bereichswerte und verdiente Abzeichen kommen in den Schnappschuss
  (`progress`, `badges`); `profile_view` filtert nach Sichtbarkeit und baut die
  Form neu (Zahlen, bekannte Bereichs- und Abzeichen-Schlüssel), wie in 2a.
- Migration erweitert die Feldliste von `profile_visibility_ok` und
  `PROFILE_FIELDS` um `progress` und `badges`.

## Randbedingungen

- Datenbank nach `CLAUDE.md`: Migration als Datei, Trockenlauf mit Postgres 16
  (zweimal, nachzählen), Produktivlauf nur nach ausdrücklichem Ja.
- Texte nur de/en; neue Schlüssel in den übrigen zwölf Sprachen mit englischem Platzhalter.
- Look wie profil-v3 / 2a. Nach Codeänderungen `code-review`; `graphify update .`
  zieht der Nutzer lokal nach (im Cloud-Container nicht möglich).

## Dem Bauenden überlassen

- Symbole der Abzeichen (bis der Nutzer eigene liefert).
- Wie oft Gesamt und Abzeichen neu gerechnet werden (mit dem Schnappschuss).
- Darstellung, wenn noch kein Bereich zwei Messungen hat („Noch zu wenig Daten“).
