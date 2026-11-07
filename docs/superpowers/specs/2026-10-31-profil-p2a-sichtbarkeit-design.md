# Profil, Teilprojekt 2a: Sichtbarkeit, neues Profil, Einstellungen, Bild-Check — Design

Stand 31.10.2026, mit dem Nutzer geplant. Gehört zu
`2026-10-31-profil-social-gesamtbild-design.md`; baut auf Teilprojekt 1
(`2026-10-31-profil-p1-datenbasis-design.md`) auf.
Mockup: `docs/profil/mockups/profil-2a.html` (Aufbau aus `profil-v3.html`).
Markierungen wie bisher: **[Nutzer]**, **[Claude]** (vorgeschlagen und bestätigt),
**[Claude, ungeprüft]** (Entscheidung von Claude, dem Nutzer zur Durchsicht genannt),
**[Bauende]**.

## Zuschnitt von Teilprojekt 2 **[Nutzer]**

Drei Schritte, jeder mit eigenem PR:

- **2a (dieses Dokument):** Sichtbarkeit pro Feld, neues Profil, eigener
  Einstellungen-Bildschirm, Bild-Check.
- **2b:** Gesamtfortschritt und Abzeichen.
- **2c:** Web-Vorschau `/u/<name>` in voller Form und Hoku-QR-Code.

## Absicht

Das Profil wird vom Einstellungsformular zum Schaufenster. Jeder Wert hat eine
eigene Sichtbarkeit; ohne bewusste Entscheidung sieht ihn niemand außer dem
Nutzer. Alles Einstellbare zieht auf einen eigenen Bildschirm hinter ⚙︎.

Erfolg: Ein Nutzer sieht sein neues Profil, stellt jeden Wert auf Nur ich,
Freunde oder Alle und prüft mit „Ansehen als …“, was andere sehen. Andere
angemeldete Nutzer sehen unter `/u/<name>` genau die Werte auf „Alle“. Profil-
und Titelbild sieht ein anderer erst nach bestandenem Bild-Check. Ohne
Anmeldung zeigt `/u/<name>` keine Erfahrungsberichte mehr.

## Nicht-Ziele

- Gesamtfortschritt, Abzeichen (2b). Volle Web-Vorschau, QR-Code (2c).
- Freunde, Suche, Anfragen, Story, Chat (Teilprojekte 3 und 4). Die Stufe
  „Freunde“ wird gespeichert, wirkt aber erst mit Teilprojekt 3.
- HRV, VO2max (Schritt 1b). Bis dahin haben diese Felder eine Stufe, aber keinen Wert.
- Kein Löschen der alten Spalten `is_public`, `share_*`; sie verschwinden nur
  aus der Oberfläche.
- Keine weiteren Sprachen als de/en.

## Anti-Ziele

- Ein Wert, der für eine Sicht verborgen ist, kommt **nicht** beim Gerät des
  Betrachters an: gefiltert wird auf dem Server, nicht in der Oberfläche.
- Eine Lücke, ein Platzhalter oder ein Zähler, an dem andere erkennen, dass
  etwas verborgen ist. **[Nutzer]**
- Ein Bild, das andere vor dem Check sehen.
- Substanznamen im Profil, auch für Freunde. **[Nutzer]**

## 1. Felder und Stufen

Drei Stufen: **Nur ich** (Standard), **Freunde**, **Alle** (= angemeldete
Hoku-Nutzer, nicht das Internet). **[Nutzer]** Alle drei sind wählbar und werden
gespeichert. „Freunde“ sieht bis Teilprojekt 3 niemand außer dem Nutzer; die
Oberfläche sagt das. **[Nutzer]**

**Streng pro Feld** **[Nutzer]**, 30 Felder:

| Bereich | Felder |
|---|---|
| Kopf | Titelbild, Geschlecht-Zeichen, Herkunft |
| Kurzinfo | Bio, Ziel-Tags, Streak, Mitglied seit |
| Über mich | Alter, Größe, Gewicht |
| Körper | Körperfett, Muskelmasse, Umfänge |
| Einnahmen | Adherence (mit bestätigt/verpasst), Anzahl Substanzen (mit aktiven Zyklen, nie Namen) |
| Blutwerte | Erfasste Marker, Im Zielbereich |
| Gesundheit & Wearables | Schritte, Ruhepuls, Schlaf, Aktive kcal, SpO2, Blutdruck, HRV, VO2max |
| Training | Workouts getrackt, Aktuelle Routine, Lieblingsübung, Bestleistungen (e1RM) |
| Erfahrungsberichte | Erfahrungsberichte (die einzeln freigegebenen) |

- Immer sichtbar, sobald jemand das Profil findet: Name, Nickname, Profilbild
  (nach Bild-Check). **[Claude]**
- **Herkunft** steht oben neben dem Namen als Flagge mit Länderkürzel
  (🇩🇪 DE), nicht als Kachel in „Über mich“. **[Nutzer]**
- **Geschlecht** nur als Zeichen neben dem Namen (♂ ♀ ⚧), „keine Angabe“ zeigt
  nichts. **[Nutzer]**
- Zyklus, Blutzucker, Medikamente bleiben immer privat, ohne Stufe. **[Claude]**
- Ein Feld ohne Wert (z. B. HRV vor 1b, Muskelmasse ohne Eintrag) sieht nur
  der Nutzer selbst, mit Strich; andere sehen es gar nicht. **[Claude, ungeprüft]**
- **Muskelmasse** gibt es heute nicht als Eingabe. Sie kommt als Feld in den
  Tageseintrag des Fortschritts neben KFA, mit Verlauf. **[Nutzer]**
- **Lieblingsübung** und **Aktuelle Routine** wählt der Nutzer selbst (unter
  „Bearbeiten“); ohne Auswahl keine Kachel. **[Nutzer]**

## 2. Profil (eigene Ansicht und fremde Ansicht)

Aufbau wie `profil-v3.html` **[Nutzer]**, von oben nach unten:

1. Leiste: eigenes Profil „Profil“ + ⚙︎; fremdes Profil ‹ + `@nick` + ⋯
   (Melden, Blockieren — gibt es heute schon).
2. Titelbild (rechteckig), Profilbild rund, Name + Geschlecht-Zeichen +
   Flagge mit Kürzel, `@nick`.
3. Bio, Ziel-Tags als wischbare Zeile, „🔥 41 Tage Streak · Mitglied seit März 2026“.
4. Zahlenzeile: Workouts · Berichte (Freunde ab Teilprojekt 3).
5. Eigenes Profil: „Profil teilen“ (Link; QR ab 2c) und „Bearbeiten“.
6. Karten: Über mich (3 Kacheln in einer Reihe **[Nutzer]**), Körper,
   Einnahmen, Blutwerte, Gesundheit & Wearables, Training, Erfahrungsberichte.
   Plätze für Gesamtfortschritt (nach Über mich) und Abzeichen (vor
   Erfahrungsberichten) bleiben für 2b frei.

**Chips:** Im eigenen Profil trägt jeder Wert seine Stufe als kleinen Punkt mit
Wort („Nur ich“, „Freunde“, „Alle“), ganz klein in derselben Zeile rechts neben
der Beschriftung (z. B. „Alter · Freunde“), kein Kasten. **[Nutzer]** Tippen
schaltet Nur ich → Freunde → Alle. **[Nutzer, aus v3]** Andere sehen keine Chips.

**Keine Lücke, trotzdem symmetrisch** **[Nutzer]**, Regel **[Claude]**:

- Kacheln je Karte nach Anzahl: 1 → volle Breite; 3 kurze Werte → eine Reihe
  mit drei; sonst zwei Spalten, ein ungerader Rest geht über die volle Breite.
  Lange Textwerte (Umfänge) zählen nie zu einer Dreierreihe.
- Eine Karte mit nur einem sichtbaren Wert wird eine halbe Karte; zwei solche
  hintereinander stehen nebeneinander. Bleibt eine allein, nimmt sie die volle
  Breite.
- Karten ohne sichtbaren Wert fallen weg.
- Zahlenzeile und Meta-Zeile verteilen sich auf die sichtbare Anzahl.
- Verborgenes Titelbild = dieselbe neutrale Fläche wie bei Konten ohne Titelbild.
- Kein Hinweis „x Bereiche nicht freigegeben“ (v3 hatte ihn; entfällt).

**Privates Profil:** Andere sehen Bild, Name, Nickname und die Karte
„Privates Profil“. Das ist der übliche, erwartete Hinweis und keine Lücke.

## 3. Einstellungen

Eigener Bildschirm hinter ⚙︎ (`/profil/einstellungen`), Aufbau wie v3. **[Nutzer]**
Inhalt in 2a:

- **Profil & Sichtbarkeit:** Privates Profil (Hauptschalter; die Einzelstufen
  bleiben gespeichert) · Wer sieht was (alle 30 Werte als Liste mit
  Dreier-Schalter, je Bereich „Alle auf Ich“ / „Alle auf Alle“ **[Nutzer]**) ·
  Profil ansehen als … (Freund, App-Nutzer, Web-Link) · Neue Felder
  standardmäßig: Nur ich · Web-Link an/aus. **[Nutzer]**
- **Kontrolle:** Blockiert (Liste mit Entsperren; heute in `AccountSection`). **[Nutzer]**
- **Datenquellen, Konto & App:** alles, was heute auf der langen Profilseite
  steht (Biologisches Profil, Einwilligungen, Sprache, Erscheinungsbild,
  Passkey, Benachrichtigungen, Konto löschen, Abmelden), zieht hierher.
- Spätere Punkte (Suche, Story, Nachrichten, Eingeschränkt, Stummgeschaltet)
  kommen mit ihren Teilprojekten.

## 4. Web-Link ohne Anmeldung (Zwischenstand bis 2c)

`/u/<name>` ohne Anmeldung zeigt ab 2a nur: Profilbild (nach Check), Name,
Nickname, die Bio bei „Alle“ und „In Hoku öffnen“, dazu den Hinweis, dass
Profil, Werte und Berichte nur in der App sichtbar sind. **Keine
Erfahrungsberichte mehr ohne Anmeldung.** **[Nutzer]** Angemeldete sehen unter
derselben Adresse das Profil in der App-Ansicht.

Ist der Web-Link aus oder das Profil privat: „Seite nicht gefunden“, ohne zu
verraten, dass es das Konto gibt.

Standard: Web-Link **aus** für neue Konten; **an** für Konten mit heute
`is_public = true`. **[Claude, vom Nutzer bestätigt]** Grund: Eine erratbare Adresse
`/u/<name>` verrät sonst, dass jemand eine Peptid-App nutzt.

## 5. Bestehende Konten **[Nutzer]**

- Alle Felder starten auf „Nur ich“.
- Wer heute `is_public = true` hat, behält Name und Bio sichtbar (Bio → „Alle“)
  und seine einzeln freigegebenen Erfahrungsberichte (Feld Erfahrungsberichte →
  „Alle“, sichtbar nur noch angemeldet in der App). Web-Link an.
- `share_peptide`, `share_kalender`, `share_tagebuch`, `share_bewertungen` und
  der Schalter „öffentliches Profil“ verschwinden aus der Oberfläche; die Spalten
  bleiben.

## 6. Bild-Check **[Nutzer]**

- Hochladen wie in Teilprojekt 1 (privater Bucket `profile-media`, Zuschnitt,
  ohne EXIF). Danach Status **wird geprüft**.
- Eine Supabase-Funktion `profile-image-check` (wie `food-photo`) lädt das Bild
  mit Dienstrechten, fragt Claude (`claude-haiku-5-5`) „zeigbar ja/nein“ und
  setzt den Status. Nur diese Funktion darf „freigegeben“ setzen; der Client
  kann es nicht. **[Claude, ungeprüft]**
- **Freigegeben:** andere dürfen das Bild über einen signierten Link laden.
- **Abgelehnt:** Datei und Pfad werden gelöscht, der Nutzer sieht „Dieses Bild
  können wir nicht zeigen“ und wählt ein anderes. Keine Verwarnung, keine
  Meldung an die Moderation. **[Nutzer]**
- Fehler beim Prüfen (Netz, Dienst): Status bleibt „wird geprüft“, andere sehen
  Initialen; beim nächsten Öffnen des Profils wird erneut geprüft. Lieber zu
  lange privat als ungeprüft öffentlich. **[Claude, ungeprüft]**
- Bilder aus Teilprojekt 1 haben noch keinen Status und gelten als
  „wird geprüft“; sie werden beim nächsten Öffnen des eigenen Profils geprüft.
- Datenschutzerklärung (de/en): Profil- und Titelbild gehen zur Prüfung an
  Anthropic (USA). Ob dafür eine Einwilligung nötig ist, gehört zur
  juristischen Prüfung. **[Claude, ungeprüft]**

## 7. Technik **[Claude, ungeprüft]**

- **Sichtbarkeit:** `profiles.field_visibility jsonb not null default '{}'`.
  Fehlender Schlüssel = Nur ich, so starten neue Felder automatisch privat.
  Prüfung: Schlüssel aus der Feldliste, Werte `friends` oder `all`. Dazu
  `profiles.profile_private boolean`, `profiles.web_link_enabled boolean`.
- **Werte für andere:** Das Gerät des Nutzers berechnet seine Profilwerte mit
  der vorhandenen App-Logik (Adherence, e1RM, Referenzbereiche, Tageswerte) und
  legt sie als Schnappschuss in `profile_snapshots` ab (eigene Zeile, RLS nur
  für den Nutzer), neu nach dem Öffnen der App und nach eigenen Einträgen.
  Grund: eine Rechenweise statt einer zweiten in SQL. Folge: Andere sehen den
  Stand vom letzten Öffnen; das Profil zeigt „Stand …“ nicht an.
- **Lesen fremder Profile:** nur über eine Datenbankfunktion
  `profile_view(p_username, p_as)` (security definer). Sie prüft Blockieren in
  beide Richtungen, Moderations-Ausblendung, privates Profil und die Stufe des
  Betrachters und gibt **nur** freigegebene Felder zurück. Der Eigentümer kann
  mit `p_as` (`friends`, `all`, `web`) sehen, was eine andere Stufe sieht
  („Ansehen als“). `public_profile_reviews` liefert Berichte nur noch
  angemeldet und nur bei Feld Erfahrungsberichte auf „Alle“.
- **Bilder anderer:** Storage-Policy für `select` auf `profile-media`, die über
  eine Funktion prüft: Pfad ist das freigegebene Profilbild (bzw. Titelbild mit
  passender Stufe) eines Profils, das der Betrachter sehen darf. Ohne Anmeldung
  nur das Profilbild bei eingeschaltetem Web-Link.
- **Textfilter:** `check_public_profile_text` greift für die Bio, sobald sie
  nicht auf „Nur ich“ steht (heute: nur bei `is_public`).
- **Muskelmasse:** `daily_logs.muscle_mass_kg numeric(4,1)` mit plausiblen Grenzen.
- **Training:** `profiles.favorite_exercise text` und
  `profiles.profile_routine_id uuid` (auf `training_routines`, bei Löschen null).

## Randbedingungen

- Datenbank nach `CLAUDE.md`: eine Migration `supabase-profil-p2a-sichtbarkeit.sql`,
  Trockenlauf mit Postgres 16 (zweimal, nachzählen), Produktivlauf erst nach
  ausdrücklichem Ja, danach nachzählen und berichten.
- Texte nur de/en; neue Schlüssel in den übrigen zwölf Sprachen mit englischem
  Platzhalter.
- Look: Soft Dark, vorhandene Bausteine; Chips, Kacheln und Karten wie in `profil-v3.html`.
- Nach Codeänderungen `graphify update .`, dann `code-review` und `security-review`
  (Sichtbarkeit ist eine Sicherheitsgrenze).

## Offen für die juristische Prüfung

- Bild-Check über Anthropic: Einwilligung oder berechtigtes Interesse?
- Erfahrungsberichte für angemeldete Nutzer mit Substanznamen (wie heute, nur
  nicht mehr im Web).

## Dem Bauenden überlassen

- Wie oft der Schnappschuss neu geschrieben wird (Entprellung).
- Die genaue Formulierung der Prüfanfrage an Claude und die Grenzfälle
  (Oberkörper beim Training ja, Nacktheit nein).
- Ob „Ansehen als“ eine eigene Route oder ein Zustand der Profilseite ist.
