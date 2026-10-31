# Profil, Freunde, Chat

Geplant mit dem Nutzer am 31.10.2026, Mockup unter
`.superpowers/brainstorm/664-1793408697/content/profil-v3.html` (+ `hoku-code.html`).
Specs: `docs/superpowers/specs/2026-10-31-profil-social-gesamtbild-design.md`
(alles Übergreifende) und `…-profil-p1-datenbasis-design.md` (Teilprojekt 1).

## Entschieden (31.10.2026)
- Vier Teilprojekte in Reihenfolge: 1 Datenbasis → 2 Profil → 3 Freunde → 4 Chat, Story, Moderation.
- Sichtbarkeit pro Feld: Nur ich (Standard) / Freunde / Alle (= angemeldete App-Nutzer).
- Substanzen im Profil nur als Anzahl + aktive Zyklen, nie Namen. Im Chat darf alles geteilt werden.
- Web-Link `/u/<name>` nur feste Vorschau ohne Gesundheitswerte, Substanzen, Berichte.
- Gesamtfortschritt gegen eigenen Start; Nutzer legt Richtung je Wert fest oder schließt aus.
- Keine Ende-zu-Ende-Verschlüsselung im Chat, offen kommuniziert; Moderation in 5 Schichten.
- Story: 24 h, immer nur 1 Bild. Profilbild + Titelbild.
- Datenschutz-Einstellungen nach Vorbild sozialer Netzwerke.
- Hoku-Code = echter QR-Code im Hoku-Design (jede Kamera liest ihn); Ring-Code zurückgestellt.

## Teilprojekt 1 gebaut (31.10.2026, Branch `profil-p1-datenbasis`, nicht gemergt)
Umfänge, Ziel-Tags, Land, Profil-Geschlecht (getrennt von bio_sex), Profil-/Titelbild,
Wearable-Tageswerte mit Einwilligung (auch für den Workout-Import), /health-Kacheln,
Android Health Connect (7 Leseberechtigungen, ohne Gewicht).
Entscheidungen beim Bau: Schlaf zählt zur Nacht (Ende ab 18 Uhr → Folgetag), überlappende
Schlafabschnitte vereinigt, Schritte/kcal je Tag nur aus der stärksten Quelle, Server-Policy:
health_daily schreiben nur mit Einwilligung, leere Werte werden nie gesendet.

## Teilprojekt 2 geplant (31.10.2026)
PR #114 (P1) grün, nicht gemergt (wartet auf ausdrückliches „mergen“).
Zuschnitt [Nutzer]: 2a Sichtbarkeit + neues Profil + Einstellungen + Bild-Check; 2b Gesamtfortschritt +
Abzeichen; 2c volle Web-Vorschau + QR — je eigener PR.
Spec `docs/superpowers/specs/2026-10-31-profil-p2a-sichtbarkeit-design.md`, Plan
`docs/superpowers/plans/2026-10-31-profil-p2a-sichtbarkeit.md`, Mockup `docs/profil/mockups/profil-2a.html`
(Aufbau aus profil-v3; als Artefakt https://claude.ai/artifact/FcsYFtHwcXoE6RHkYGN1DJ).
Entschieden [Nutzer]: streng pro Feld (30 Felder), drei Stufen gespeichert („Freunde“ wirkt ab P3),
Chips am Wert, keine Lücke aber symmetrisch (Raster nach Anzahl, Ein-Wert-Karten paarweise), Herkunft als
Flagge + Kürzel oben, Über mich = 3 Kacheln, Bild-Check per Claude auf dem Server, abgelehnt = löschen ohne
Strike, /u/<name> ohne Anmeldung ab 2a ohne Berichte, Bestand: alles Nur ich, is_public behält Bio + Berichte,
Muskelmasse neu im Tageseintrag, Lieblingsübung/Routine selbst wählen. Einstellungen in 2a: privat, Wer sieht
was, Ansehen als, Web-Link, Blockiert.
Vom Nutzer bestätigt: Schnappschuss statt SQL-Rechnung, Web-Link Standard aus (an bei is_public),
Prüffehler = bleibt privat.

## Offen
- Migration `supabase-profil-p1-datenbasis.sql` lief am 31.10.2026 nach Freigabe gegen
  Produktion (Migration `profil_p1_datenbasis`): vorher 0 neue Spalten/Tabellen, 13 Profile;
  nachher 7 Spalten, 2 Tabellen mit RLS, Bucket privat 1 MB JPEG, 4+4 Policies, 13 Profile unverändert.
- Ende-zu-Ende-Test (Wert landet in health_daily) auf iPhone und Android nach dem Produktivlauf;
  echtes Android-Gerät vor Store-Start.
- Divers-Zeichen: ⚧ ist Platzhalter, Bild des Nutzers kam nicht an.
- 1b: HRV, VO2max, Android-Schlaf und Wach-Phasen brauchen Plugin-Wechsel.
- Rechtlich prüfen (für den Nutzer im Kopf behalten, bei jedem Stand erinnern):
  Datenschutzabschnitt „Apple Health und Health Connect“, Daten nach Widerruf;
  Bild-Check über Anthropic (Einwilligung oder berechtigtes Interesse?);
  Erfahrungsberichte mit Substanznamen für angemeldete Nutzer; Web-Vorschau (2c) vor dem Start;
  Moderation/Apple 1.2/EU-DSA (Teilprojekt 4).
- 2a: Durchsicht-Punkte vom Nutzer bestätigt (Schnappschuss, Web-Link Standard aus, Prüffehler = privat).
  Chips: kleiner Punkt + Wort in derselben Zeile neben der Beschriftung. Bau auf Branch
  `profil-p2a-sichtbarkeit` (von profil-p1-datenbasis abgezweigt; nach Merge von #114 auf main umsetzen).
- Kleinere Reste: Über-dich ohne Retry nach Ladefehler, Health-Connect-Seitenlimit 50,
  iOS-Blutdruck nur bei exakt gleicher Zeit, jvmTarget-Block nur mit Java 25 gebaut.
