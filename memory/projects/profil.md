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

## Teilprojekt 2b geplant (Brainstorming 01.11.2026)
PR für 2a: https://github.com/Kossa97/HOKU-Health-Hub/pull/119 (Basis profil-p1-datenbasis). Nutzer „okay“ zu:
Modell-Ablehnung beim Bild-Check = abgelehnt. NICHT freigegeben: Merge, Produktivlauf, TERMS_VERSION.
Gesamtfortschritt [Nutzer]:
- Prozent der positiven Veränderung vom Start bis jetzt, relativ zum Startwert: Gewicht 120 → 100 kg (Ziel runter)
  = (120 − 100) / 120 = +16,67 %. Schlechter = negativ. Nutzer-Hinweis: Das ist Veränderung des Werts selbst,
  nicht automatisch KFA oder Gesundheit — so soll es in der App auch erklärt werden.
- Werte, die schon Prozent sind (KFA, Adherence): genauso relativ (22 → 18 % = +18,2 %).
- Zielbereichs-Werte (Blutmarker, Schlaf): Anteil im Zielbereich, Start gegen jetzt, relativ (12/24 → 19/24 = +58 %).
- Zusammenrechnen: Mittel je Bereich (Körper, Blut, Training, Einnahmen, Erholung & Fitness), dann Mittel der
  Bereiche, OHNE Deckel.
- Zeitraum: seit Start (erste Messung je Wert), Start neu setzbar, alter Start bleibt im Verlauf.
- Aus Gesamtbild: Richtung je Wert fest/aus Ziel-Tags/Zielbereich, vom Nutzer änderbar oder ausschließbar; Wert zählt
  ab zwei Messungen; Aufschlüsselung im Profil sichtbar.
Abzeichen [Nutzer]: alle Arten (Beständigkeit, Meilensteine, Fortschritt, Gemeinschaft), „erstmal grob alles was zur
App passt“, Feinschliff macht der Nutzer.
Nutzer 02.11.: Schlaf = Methode A (Anteil Nächte 7–9 h im Bereich, Start gegen jetzt, relativ). Gesamtrechnung
(Mittel je Wert → je Bereich → über Bereiche, ohne Deckel) bestätigt. Schritte: Methode noch offen.
Mockup 2b: https://claude.ai/artifact/RZtNNuUqoV6rfy7U69KSJN (scratchpad profil-2b-mockup.html). Offen [Claude, ungeprüft]:
Start 0 % im Zielbereich → Prozentpunkte; Schlaf = Anteil Nächte 7–9 h; Blutdruck = systolisch runter; Ring füllt bis +100 %.

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
- graphify: `graphify update .` lehnt im Cloud-Container ab (10.574 statt 11.095 Knoten, lokale Dateien fehlen).
  Nutzer-Entscheidung 31.10.: nicht erzwingen; Code ohne Graph-Update committen, Nutzer zieht lokal nach.
- 2a Stand: Migration `supabase-profil-p2a-sichtbarkeit.sql` geschrieben und im Container geprüft (3 Läufe,
  Proben bestanden), NICHT gegen Produktion — erst kurz vor dem Merge von 2a laufen lassen (alte App kennt
  die Stufen nicht). Tasks 1–8 gebaut (Stand 31.10.): Schnappschuss, Muskelmasse, neues Profil, Einstellungen,
  fremdes Profil/Web-Link, Bild-Check (Edge Function `profile-image-check`, nicht deployt, braucht ANTHROPIC_API_KEY;
  Tageslimit 20 über `profile_image_checks`). `profile_view` baut fremde Schnappschüsse serverseitig auf die
  bekannte Form neu (echter Schnappschuss: 22/22 Felder kommen an). Offen: Task 9 (Datenschutz, Texte, e2e),
  Task 10 (Gesamtprüfung, security-review, PR). Zu bestätigen: Modell-Ablehnung (refusal) = Bild abgelehnt.
- 2a Task 5+6 gebaut (31.10.): /profil als Schaufenster (ProfilKopf, ProfilKarten, SichtbarkeitsChip,
  Bearbeiten-Sheet), /profil/einstellungen, /profil/sichtbarkeit, /profil/blockiert. Freitext (Routine,
  Lieblingsuebung, e1RM-Namen) filtert profile_view fuer andere mit oeffentlicher_text_fehler (Migration ergaenzt).
  Offen: andere Felder im Schnappschuss sind weiter vom Geraet geschrieben und nur auf Form geprueft.
- 2a Sicherheitsprüfung (31.10.): Bildfreigabe hängt an `storage.objects.id` (`*_object_id`, RPCs
  `profile_media_object_id`/`profile_media_approve` nur Dienstrolle), Update-Policy auf `profile-media` entfällt;
  `display_name` geht an andere nur nach `oeffentlicher_text_fehler`. Vor dem Produktivlauf: Prüfabfrage
  Nutzernamen (Kopf der Migration) zählen, Treffer von Hand klären. Rest: Ein schon ausgestellter signierter
  Link (1 h) liefert nach Löschen + Neuanlegen unter gleichem Namen den neuen Inhalt.
- Kleinere Reste: Über-dich ohne Retry nach Ladefehler, Health-Connect-Seitenlimit 50,
  iOS-Blutdruck nur bei exakt gleicher Zeit, jvmTarget-Block nur mit Java 25 gebaut.
