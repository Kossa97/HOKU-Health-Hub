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
(Mittel je Wert → je Bereich → über Bereiche, ohne Deckel) bestätigt.
Schritte [Nutzer]: Methode A (Ø, Richtung hoch, relativ), aber Startwert = Baseline aus den 1–2 Monaten vor dem
Start aus Apple Health / Health Connect, wenn verfügbar (sonst erste 7 Tage).
Nutzer 02.11.: Baseline gilt für ALLE Wearable-Werte (Schlaf, Ruhepuls, kcal, VO2max, Blutdruck); „jetzt“ = letzte 28 Tage.
Nutzer 02.11.: Werte zählen erst mit belastbarer Baseline (Schwellen bestätigt): Wearables ≥14 Tage in 60 Tagen vor
Start, sonst erste 28 Tage nach Start = Baseline, zählt ab Tag 29; Schlaf ≥14 Nächte bzw. 28; Körperwerte ab 2. Messung
≥14 Tage nach der ersten; Blut ab 2. Befund; e1RM ab 3 Einheiten; Workouts/Woche und Adherence ab 4 Wochen.
Kein Fallback „erste 7 Tage“. Untergrenze C verworfen (+600 % ist echter Fortschritt); Start 0 % → Prozentpunkte.
Anteilswerte (Schlaf, Blut) [Nutzer 02.11.]: „Lücke geschlossen“ = (jetzt − Start) ÷ (100 % − Start), −100…+100 %;
übrige Werte relativ ohne Deckel. Darstellung: statt Ring Varianten-Mockup (Leitzahl+Nulllinien-Balken, Zeitreise,
Turm, Höhenprofil); Nutzer 02.11.: Variante 1 (Leitzahl + Balken) als Karte, Antippen öffnet 2 (Zeitreise). Mockup: https://claude.ai/artifact/AiZDk3AGF5PiKcrT2Ztkn7 (scratchpad fortschritt-varianten.html).
Spec `docs/superpowers/specs/2026-11-02-profil-p2b-fortschritt-design.md`, Plan `docs/superpowers/plans/2026-11-02-profil-p2b-fortschritt.md`,
Mockup `docs/profil/mockups/profil-2b.html` — Branch `profil-p2b-fortschritt` (gestapelt auf 2a). Spec/Plan mit allen Entscheidungen nachgezogen; Bau kann starten.
Mockup 2b: https://claude.ai/artifact/RZtNNuUqoV6rfy7U69KSJN (scratchpad profil-2b-mockup.html). Offen [Claude, ungeprüft]:
Start 0 % im Zielbereich → Prozentpunkte; Schlaf = Anteil Nächte 7–9 h; Blutdruck = systolisch runter; Ring füllt bis +100 %.

## Teilprojekt 2b gebaut (02.11.2026, Branch `profil-p2b-fortschritt`, PR https://github.com/Kossa97/HOKU-Health-Hub/pull/128, Basis 2a)
Tasks 1–7 fertig: Migration `supabase-profil-p2b-fortschritt.sql` (progress_settings mit RLS nur Nutzer, Felder
progress/badges, profile_snapshot_clean baut für andere nur Gesamt, fünf Bereiche, since und bekannte Abzeichen-IDs)
— Trockenlauf zweimal im Container, NICHT gegen Produktion (nach 2a, vor dem Merge). Rechnung `progressScore.ts`,
Baseline aus Health beim Setzen des Starts (`progressBaseline.ts`, 60 Tage davor, nur mit health_store_consent_at),
39 Abzeichen (`badges.ts`, „Profil geteilt“ beim Teilen), Karte Gesamtfortschritt + Zeitreise + Aufschlüsselung
(`/profil/fortschritt`), „Alle Abzeichen“ (`/profil/abzeichen`), fremdes Profil ohne Einzelwerte, e2e
`profil-fortschritt.spec.ts`. Task 7: e1RM-Namen in App-Sprache (nie Kennung; auch Bestleistungen/Lieblingsübung aus
dem Schnappschuss), Datenschutz Abschnitt 6 ergänzt (TERMS_VERSION unverändert), Texte de/en gegengelesen,
code-review: Einnahme-/Wiegetage jetzt lokaler Kalendertag, profile_complete nie ohne Prüfpunkte.
security-review 02.11.: keine Funde. Bottom-Nav über „Gesamt“ im Screenshot war nur Artefakt des Ganzseiten-Screenshots.
Offen 2b: Produktivlauf der Migration (Ja nötig, zusammen mit 2a); „Stand“ der
Datenschutzerklärung (Oktober 2026) ggf. anheben; Spec-Wörter „wartet“ (Karte) und „positive Veränderung“ bewusst
gelassen; andere sehen bei Freigabe auch den Starttag (`since`) — so im Datenschutztext; Rechtlich prüfen:
Baseline-Lesen aus Health und Speichern der Baseline (Art. 9) über die bestehende Einwilligung.

## Teilprojekt 2c geplant (Brainstorming 02.11.2026)
Entschieden [Nutzer]:
- Link-Karte (WhatsApp/iMessage, nur bei Web-Link an): Profilbild + Name (nur wenn auf „Alle“, sonst neutrale
  Hoku-Karte) PLUS etwas, das Nicht-Nutzer neugierig macht / zum Ansehen oder Laden animiert. Braucht Server-Funktion
  auf Vercel (Meta-Tags + Vorschaubild), die SPA kann das nicht.
- Abzeichen im Web: Standard nur unbedenkliche (Beständigkeit, Training, Gemeinschaft); Nutzer kann je Abzeichen
  ein- und ausschalten (auch heikle freigeben oder unbedenkliche verbergen).
- Hoku-Code: im „Profil teilen“-Sheet, Antippen = Vollbild zum Vorzeigen; Scannen mit normaler Kamera; eigener
  Scanner erst mit Freunden (P3).
- „In Hoku öffnen“: Universal Links (iOS) / App Links (Android) — App öffnet das Profil, sonst Store. Braucht
  apple-app-site-association + assetlinks.json auf hoku.app und ein App-Update.
Mockup 2c: `docs/profil/mockups/profil-2c.html` (Branch `profil-p2c-web`), Artefakt
https://claude.ai/artifact/HVnY3jKnAdFug1uSPU8MSj. Nutzer 02.11. nach Mockup:
- Link-Karte = Variante A (Gesamtfortschritt groß + Zahl der Web-Abzeichen); fällt auf C (Einladung, nur Bild+Name)
  zurück, wenn Gesamtfortschritt nicht auf „Alle“; ohne Bild/Name auf „Alle“ neutrale Karte.
- Web: Bereiche Blut und Einnahmen nie im Web (nur Gesamt + Körper, Training, Erholung & Fitness); App wie 2b.
- Abzeichen zu Körperwerten (KFA, Gewicht, Ruhepuls) ab Werk wie Blut/Zyklen/Einnahmen aus.
- Web-Link aus: Teilen geht trotzdem (nur App-Nutzer sehen das Profil), Hinweis + Schalter „Web-Link einschalten“.
Domains (Vercel, Nutzer): **hokuhealth.app** (Haupt, live) und **meethoku.com** (308 → hokuhealth.app);
Profil-Links = `hokuhealth.app/u/<name>`. Passkey-RP-ID ist noch `tyd-track-your-dose.vercel.app` (Wechsel = alle Passkeys neu).
Nutzer 02.11. zum Mockup v1:
- Karte A: Gesamtfortschritt nur, wenn positiv; dazu, wie viele Dinge der Nutzer mit Hoku trackt und aus welchen
  Bereichen (nicht im Detail); Ziel-Tags „super“; Abzeichen auf der Karte unsicher („hm“).
- Karte C: gut, aber anderer Text — wofür nutzt der Nutzer Hoku?
- Neutrale Karte: „sehr gut“, nur besseres Logo (Brand-Kit) und ein Slogan (gibt es noch nicht).
- Web: Bio zeigen, wenn auf „Alle“.
- Gesamtfortschritt zeigt im Web zu viel → mehr teasern (Frage, ob strategisch sinnvoll).
Nutzer 02.11. zu Mockup v2: „trackt N“ = einzelne Werte zählen (nur erlaubte Bereiche), Bereiche wählt der
Nutzer selbst aus; Zahl hervorheben; Zahlen und Karten marketingorientiert einfärben/gestalten (Psychologie).
Ziel-Tag „Blutwerte optimieren“ so lassen (im Web/Karte A sichtbar, nur Karte C filtert). Fortschritts-Abzeichen
(+10/+25 %) ab Werk an lassen. Wahl von Teaser/A1-A2/C-Text/Slogan erst nach Überarbeitung (Mockup v3).
Nutzer 02.11. zu Mockup v3: Karte **A1** (mit Abzeichen) gefällt am besten, aber zu viele Tags/Chips an derselben
Stelle; insgesamt zu viel Farbe → dezenter, seriöser, hochwertiger. Slogans „geht so“ → mehr Vorschläge (Idee Nutzer:
„Du im Vergleich zum besseren Dir“). Web-Abzeichen: nur eine Reihe, die seltensten/schwersten zuerst, 3 zeigen,
das letzte weichgezeichnet + „+x“ für den Rest. Teaser T1–T3 noch offen.
Nutzer 02.11. zu Mockup v4: Teaser **T1** (Stufe). Rückfall **Karte C Text 1** („Wofür nutzt Mara Hoku?“ —
Thema vom Nutzer, Formulierung als Frage von Claude). A1-Aufbau (Zonen) gut, Optik wieder im Stil wie vorher →
mehrere Stile zur Wahl. Neutrale Karten: aktuelle + vorherige behalten, mehr Möglichkeiten. Für alle Karten
**Brand-Kit v2** (`docs/logo/hoku/brand-kit-v2/` auf main) für Logos/Icons; Logo hochwertig einbauen.
Web-Vorschau gefällt, Farben im App-Stil, Grün für Fortschrittszahlen erlaubt.
Nutzer 02.11. zu Mockup v5: neutrale Karte = **Fassung 2 (Hoku-Licht)**, aber nur Cyan-Licht von unten (kein
Violett). Dazu passende Link-Karte A1 und Rückfall C im selben Stil; Logo an verschiedenen Stellen/Anordnungen als
Varianten → eigenes neues Mockup `docs/profil/mockups/profil-2c-karten.html`.
Nutzer 02.11. zu Karten-Mockup (`profil-2c-karten.html`): neutrale Karte = **H (Hauptlogo Mitte)**, A1 und C =
**H (Hauptlogo unten Mitte)**; zusätzlich für alle drei mehr Varianten „Bildmarke angeschnitten“ (B) zeigen.
Fortschrittsfarbe **Cyan**. Karte C: „Wofür nutzt Mara Hoku?“ unsicher → lieber direkt grob sagen, was Hoku kann und
macht, auf den Nutzer bezogen; Hoku ist viel mehr als Health/Fitness/Erholung — klarstellen, Interesse wecken.
Neuer, richtig guter Slogan gesucht (gern tiefgründig, psychologisch).
Claude-Standard (ungeprüft, im Spec markiert): Adresse = echter Nickname; Berichte-Hinweis nur, wenn Feld
Erfahrungsberichte auf „Alle“; Desktop: „In Hoku öffnen“ zeigt Store-Knöpfe + QR; neutrale Karte ohne Personen-Neugier.

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
  Moderation/Apple 1.2/EU-DSA (Teilprojekt 4);
  2b: Baseline aus Health über bestehende Einwilligung (Art. 9); freigegebener Bereichswert mit nur einem
  Wert verrät dessen Verlauf (z. B. Blut), freigegebene Abzeichen-IDs verraten Gesundheitsfakten
  (first_bloodwork, all_markers_in_range, first_cycle_done) — nur nach Freigabe, Standard „Nur ich“.
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

### Canva-Vorlage (03.11.)
Nutzer bearbeitet die Karten selbst in Canva. `docs/profil/canva/hoku-link-karten.pptx`
(20 Folien 1200 × 630, aus Karten-Mockup Fassung 2, Elemente einzeln). Skripte in
`docs/profil/canva/quelle/`. Canva-Verbindung im Container nicht erreichbar, daher Datei-Import.

### Nutzer 03.11. zu den Karten — Auswahl (Fassung 3)
Mockup `docs/profil/mockups/profil-2c-karten-auswahl.html`, https://claude.ai/artifact/9dsm9rL8JLVzYMw5KVL4cy.
- **Slogan entschieden: „Sieh, wer du wirst.“ / “See who you’re becoming.”**
- **Fortschritt (A1) = H**: Profil mittig im linken Teil, „trackt 9 Werte“ (9 in Cyan) + Bereiche OBEN, darunter „über 30 %“.
- **Rückfall (C) = B1** (Nutzer korrigiert 03.11.: nicht B3): Hoku unten rechts angeschnitten (504 px), Kompaktlogo oben
  rechts; Profil mittig im linken Teil wie A1, 9 in Cyan, Trennlinie, Text über Hoku davor. Alle sechs Texte passen.
- **Neutral = B3**: Hoku links aus der Kante, Hauptlogo 480 px + Slogan mittig rechts auf Pupillenhöhe, Adresse darunter.
- C-Text: Nutzer will beschreiben, was Hoku alles kann + die „Engine“ dahinter, kurz; C1–C6 „so lala“. Neue Texte T1–T6
  (Empfehlung T1 „Du trackst. Hoku verbindet.“). Wahl offen.
- Offen: Web-Fortschritt nur aus den freigegebenen Bereichen rechnen (sonst passt „trackt 9 Werte“ über dem Ergebnis nicht,
  und die Zahl verrät etwas über Blut/Einnahmen). Brand-Guide-Freigabe für B1 und B3 (Anschnitt).
- Recht: in Werbetexten nicht „überwacht“, „erkennt“, „warnt“, „optimiert Gesundheit“ (Medizinprodukt-Anschein, Irreführung).
- Archiv: Fassung 2 (B1–B6, C1–C6, alle Slogans) in `profil-2c-karten.html` und Canva-Vorlage `docs/profil/canva/` bleiben.
