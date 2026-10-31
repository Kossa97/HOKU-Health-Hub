# Profil, Freunde und Chat — Gesamtbild

Stand 31.10.2026, gemeinsam mit dem Nutzer Schritt für Schritt geplant, mit
klickbarem Mockup (`.superpowers/brainstorm/664-1793408697/content/profil-v3.html`,
Hoku-Code: `hoku-code.html`).
Markierungen: **[Nutzer]** = vom Nutzer so entschieden, **[Claude]** = von Claude
vorgeschlagen und vom Nutzer bestätigt („passt so“, „los geht's“),
**[Bauende]** = bewusst dem Bauenden überlassen.

Dieses Dokument hält fest, was über alle vier Teilprojekte hinweg gilt. Jedes
Teilprojekt bekommt ein eigenes Design-Dokument; das erste ist
`2026-10-31-profil-p1-datenbasis-design.md`.

## Absicht

Hoku ist ein All-in-one-Tracker für Gesundheit, Fitness, Training, Biohacking und
Substanzen. Das Profil soll vom Einstellungsformular zum **Schaufenster** werden:
Nutzer sehen die Profile anderer, teilen ihr eigenes zum Adden, schreiben sich und
tauschen sich aus. **[Nutzer]**

Gleichzeitig liegen in der App Gesundheitsdaten echter Menschen (DSGVO Art. 9).
Deshalb ist jedes Feld standardmäßig privat und wird nur durch eine bewusste
Entscheidung sichtbar. **[Nutzer]**

## Die vier Teilprojekte, in dieser Reihenfolge **[Claude]**

1. **Datenbasis:** was das Profil zeigen soll, aber heute nicht erfasst wird.
2. **Profil:** Sichtbarkeit pro Feld, Gesamtfortschritt, Abzeichen, eigener
   Einstellungen-Bildschirm, neue Web-Vorschau, Hoku-QR-Code, Bild-Check.
3. **Freunde:** Anfragen, Suche, Code, Blockieren/Einschränken/Stummschalten,
   Privatsphäre-Einstellungen.
4. **Chat, Story und Moderation:** 1:1-Chat, 24-h-Story, Filter, Admin-Liste,
   Sperrstufen.

Moderation (Teil von 4) muss stehen, bevor Freunde und Chat live gehen.

## Inhalt des Profils **[Nutzer]**, Ergänzungen **[Claude]**

| Bereich | Inhalt |
|---|---|
| Kopf | Profilbild, Titelbild (oben, rechteckig), 24-h-Story (immer nur 1 Bild, Ring ums Profilbild), Name, Nickname, Land als Flagge |
| Über mich | Alter, Herkunft (Land), Größe, Gewicht. Geschlecht nur als dezentes Zeichen (♂ ♀ ⚧) oben neben dem Namen, keine eigene Karte; „keine Angabe“ zeigt nichts **[Nutzer]** |
| Kurzinfo **[Claude]** | Bio, Ziel-Tags (beliebig viele, wischbare Zeile **[Nutzer]**), Streak, „Mitglied seit“, Zähler Freunde/Workouts/Berichte |
| Gesamtfortschritt | eine Prozentzahl mit Aufschlüsselung je Bereich (siehe unten) |
| Körper | KFA, Muskelmasse, Umfänge, jeweils mit Verlauf seit Start |
| Einnahmen | Adherence in %, bestätigte und verpasste Einnahmen, Anzahl Substanzen, davon aktive Zyklen |
| Blutwerte | Anzahl erfasster Marker, Anzahl im Zielbereich, Verlauf |
| Gesundheit & Wearables | Schritte, Ruhepuls, Schlaf, HRV, VO2max, aktive kcal, SpO2, Blutdruck |
| Training | Workouts getrackt, aktuelle Routine, Lieblingsübung, Bestleistungen (e1RM) **[Claude]** |
| Abzeichen **[Claude]** | z. B. „30 Tage ohne Lücke“, „Erstes Blutbild“ |
| Erfahrungsberichte | nur in der App sichtbar, nie im Web |

**Substanzen:** Im Profil steht nur die Anzahl und wie viele Zyklen aktiv sind,
nie Namen — auch nicht für Freunde. **[Nutzer]** Im Chat dürfen Nutzer dagegen
alles teilen, auch Stack-Einträge. **[Nutzer]**

Zyklus, Blutzucker und Medikamente aus Apple Health bleiben immer privat und
bekommen keine Sichtbarkeitsstufe. **[Claude]**

## Sichtbarkeit **[Nutzer]**

- Drei Stufen pro Feld: **Nur ich** (Standard), **Freunde**, **Alle** (= alle
  angemeldeten App-Nutzer, nicht das Internet).
- Name, Nickname und Profilbild sind immer sichtbar, sobald jemand das Profil
  findet. **[Claude]**
- Datenschutz-Einstellungen nach Vorbild bekannter sozialer Netzwerke: privates
  Profil, „Wer sieht was“, „Profil ansehen als …“, Story für Enge Freunde und
  „ausblenden vor“, wer darf Anfragen senden, wer darf schreiben (Fremde als
  Nachrichtenanfrage), Bilder von Nicht-Freunden unscharf, Freundesliste sichtbar
  für, Online-Status, Lesebestätigungen, Listen für Blockiert / Eingeschränkt /
  Stummgeschaltet. **[Nutzer]**, Auswahl der Punkte **[Claude]**

## Geteilter Link im Web **[Nutzer]**

`/u/<nickname>` zeigt ohne App nur eine feste Vorschau: Titelbild, Profilbild,
Name, Land, Ziel-Tags, Streak, Gesamtfortschritt, Abzeichen — jeweils nur, wenn
das Feld auf „Alle“ steht. Keine Story, keine Gesundheitswerte, keine Substanzen,
keine Erfahrungsberichte, auch keine Anrisse. Dafür ein Knopf „In Hoku öffnen“
und der Hinweis, wie viele Berichte nur in der App sichtbar sind. Der Link lässt
sich in den Einstellungen abschalten.

Grund: Marketing (die Vorschau zeigt die App, der verborgene Teil gibt einen
Grund zum Laden) und Risiko (öffentlich auffindbare Berichte über Peptide
könnten als Werbung für nicht zugelassene Arzneimittel gelten; Apple/Google).
Vor dem Start juristisch prüfen lassen.

## Gesamtfortschritt **[Nutzer]**, Rechenweise **[Claude]**

- Verglichen wird immer mit dem **eigenen Startzustand**, nie mit anderen.
- Jeder Wert hat eine Standardrichtung: fest (KFA runter, Adherence hoch),
  aus den Ziel-Tags abgeleitet (Gewicht, Umfänge) oder ein Zielbereich
  (Blutmarker, Schlaf). **Der Nutzer kann die Richtung pro Wert ändern oder den
  Wert ausschließen.** **[Nutzer]**
- Teilwerte je Bereich (Körper, Blut, Training, Einnahmen, Erholung & Fitness),
  Bereiche zählen gleich viel, ein Wert zählt ab zwei Messungen. Die
  Aufschlüsselung ist im Profil sichtbar. **[Claude]**
- Die genaue Formel für „Score je Wert“ legt Teilprojekt 2 fest.

## Chat und Moderation **[Nutzer]**, Ausgestaltung **[Claude]**

- 1:1-Chat. Teilen ist frei. Sieht eine Nachricht nach Handel mit Substanzen aus,
  blendet Hoku sie aus und warnt („Trotzdem anzeigen“ / „Melden“).
- **Keine Ende-zu-Ende-Verschlüsselung**, sondern verschlüsselte Übertragung und
  Speicherung; die Moderation sieht nur gemeldete oder automatisch markierte
  Nachrichten. Das wird offen erklärt. **[Nutzer]**
- Moderation für einen Solo-Entwickler, in fünf Schichten **[Nutzer]**:
  1. Vorbeugen durch Aufbau: Schreiben standardmäßig nur unter Freunden, neue
     Konten eingeschränkt, Anfrage-Limits, kein öffentlicher Feed, App ab 18.
  2. Automatische Filter: Handels-Signale in Text (de/en), Nacktheits-Check bei
     Profil-, Titel-, Story-Bildern und Bildern von Nicht-Freunden. Baut auf
     `check_public_profile_text` und `features/compliance/lib/moderation.ts` auf.
  3. Meldungen in eine Admin-Liste (Admin-Panel und Melde-RPCs gibt es schon);
     ab drei Meldungen verschiedener Personen vorläufig stummgeschaltet.
  4. Sperrstufen: Handel sofort dauerhaft (mit Gerätesperre), sonst Verwarnung →
     7 Tage Chat-Sperre → dauerhaft.
  5. Pflichten: Apple 1.2 (Filter, Melden, Blockieren, Reaktion in 24 h in den
     Nutzungsbedingungen), EU-DSA (Begründung, Widerspruch). Juristisch prüfen.

## Hoku-Code **[Nutzer]**

Ein echter QR-Code im Hoku-Design: rund gesetzt, Punkte statt Quadrate, Hoku in
der Mitte, Farbverlauf am Rand. Jede Handykamera muss ihn lesen können. Ein
eigener Ring-Code wie bei Snapchat ist zurückgestellt.

## Was heute schon da ist (Bestand 31.10.2026)

- `profiles`: `username`, `display_name`, `public_bio`, `is_public`, `weight_kg`,
  `height_cm`, `birth_date`, `bio_sex`, `is_admin`, dazu alte Spalten `age`,
  `gender`, `notes`.
- `share_peptide`, `share_kalender`, `share_tagebuch`, `share_bewertungen`: Schalter
  im Profil, die **nirgends ausgewertet** werden; `share_peptide` steht
  standardmäßig auf an. Werden in Teilprojekt 2 durch die Sichtbarkeit pro Feld
  ersetzt.
- `/u/:username` (`src/pages/PublicProfile.tsx`) ist heute ohne Anmeldung offen
  und zeigt Erfahrungsberichte mit Substanznamen. Wird in Teilprojekt 2 zur
  Web-Vorschau umgebaut.
- Melden und Blockieren für Profile und Berichte, Textfilter in der Datenbank.
- Gewicht in `weight_logs`, KFA in `daily_logs.body_fat_pct`, Fotos in
  `progress_photos` (privater Bucket). Die Tabelle `body_metrics` existiert, wird
  aber nicht benutzt.
- Wearables werden überwiegend live auf dem Gerät gelesen; nur das Training
  importiert Workouts aus HealthKit (mit kcal und Puls) ins Konto. Android Health
  Connect ist noch nicht eingerichtet (keine Manifest-Berechtigungen).

## Sprachen

Nur `de` und `en` werden geschrieben; neue Schlüssel bekommen in den übrigen
Sprachen den englischen Text als Platzhalter (siehe `CLAUDE.md`).
