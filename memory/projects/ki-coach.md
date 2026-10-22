# KI-Coach (Maskottchen)

Idee (Nutzer 22.10.2026): ein über KI laufendes Maskottchen, „ähnlich wie Siri,
vom Style her auch wie Siri, passend zur App“.

## Entschieden (22.10.2026)
- **Figur:** Punkt-Kugel aus der Engine der Kalorien-Kugel (`ernaehrung/lib/orbEngine.ts`,
  `orbDraw.ts`). Ob mit oder ohne Augen, wird am Mockup entschieden (beide Varianten).
- **Erste Version nur Text.** Sprache (Erkennung auf dem Gerät, Systemstimme) ist ein
  eigener Schritt danach.
- **Rechte in der ersten Version:** lesen, erklären **und eintragen** (Einnahme,
  Mahlzeit), jedes Eintragen nur über eine Bestätigungskarte in der App.
- **Start mit Mockup** (Artefakt): Kugel in allen Zuständen plus Chatansicht.
  Mockup v1 (22.10.): https://claude.ai/artifact/XmhHdoejzBKy37MK5czPSB — Startseite
  mit schwebender Mini-Kugel, Coach-Blatt mit fünf Beispielfragen (Dosis, Eintragen,
  Mahlzeit, Blutwert, Dosis-Frage abgelehnt), Bestätigungskarte mit Ändern und
  Rückgängig, Vergleich A/B, Schalter für Zustände und Look (Schwarz/Nacht).

## Offen
- Am Mockup wählen: A (Kugel) oder B (Kugel mit Augen); Name bestätigen.

## Vorschlag (noch nicht bestätigt)
- Name „Dot“ (passt zu „1 Punkt = 1 kcal“, de/en gleich).
- Zustände: Ruhe (Drehen, Atmen), Zuhören, Denken (Wirbeln), Sprechen (Pulsieren),
  Freude (Aufleuchten beim Eintragen). Kein Rot.
- Ort: kleine Kugel schwebt über der Tab-Leiste, Antippen öffnet die Vollansicht.
- Technik: Edge Function `coach` (Streaming, Tool-Use). Lese-Tools mit dem JWT des
  Nutzers (RLS), Schreib-Tools liefern nur einen Vorschlag, die App bestätigt.
  Haiku 5.5 für den Chat, Sonnet 5.5 für schwere Fragen (Blutwerte), Prompt-Caching,
  Tageslimit je Nutzer. Verlauf in `coach_messages` (RLS, löschbar), Migration nach
  CLAUDE.md-Ablauf.
- Grenzen: keine Dosisempfehlung, keine Diagnose, keine Bezugsquellen (EU-MDR,
  App Store 1.4.1). Eigene Einwilligung (Art. 9 DSGVO) wie `ai_import_consent_at`,
  geprüft in der Edge Function.
- Reihenfolge: Mockup → MVP (Text, Lesen, Eintragen mit Bestätigung, Einwilligung,
  Limit) → Sprache → von sich aus (Push, Tagesrückblick, Datenlicht).
