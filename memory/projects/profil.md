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

## Offen
- **Migration `supabase-profil-p1-datenbasis.sql` gegen Produktion erst nach Freigabe**, vorher
  prüfen, dass keine der 7 Spalten existiert; muss vor dem Merge laufen.
- Ende-zu-Ende-Test (Wert landet in health_daily) auf iPhone und Android nach dem Produktivlauf;
  echtes Android-Gerät vor Store-Start.
- Divers-Zeichen: ⚧ ist Platzhalter, Bild des Nutzers kam nicht an.
- 1b: HRV, VO2max, Android-Schlaf und Wach-Phasen brauchen Plugin-Wechsel.
- Rechtlich prüfen: Datenschutzabschnitt „Apple Health und Health Connect“, Daten nach Widerruf.
- Kleinere Reste: Über-dich ohne Retry nach Ladefehler, Health-Connect-Seitenlimit 50,
  iOS-Blutdruck nur bei exakt gleicher Zeit, jvmTarget-Block nur mit Java 25 gebaut.
