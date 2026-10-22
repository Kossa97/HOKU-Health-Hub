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

- **Augen verworfen** (Nutzer 22.10.: „mit Augen ist komisch“). Mockup v2 unter
  derselben Adresse zeigt sechs Darstellungen mit denselben Zuständen: A Punkt-Kugel,
  B Plasma-Glas (WebGL, fließendes Licht in einer Glaskugel), C Punkte formen
  (Kugel → zwei Ringe beim Denken → Welle beim Sprechen → Haken bei Freude),
  D Flüssiges Chrom (WebGL, schillernder Tropfen), E Lichtwellen (Siri bis iOS 13),
  F Lichtring. Dazu Randleuchten am Bildschirmrand beim Denken/Sprechen
  (Apple-Intelligence-Stil, abschaltbar). Standard im Mockup: B.

- **Gewählt (Nutzer 22.10.): Mischung aus A und C** — Punkt-Kugel in Ruhe, dieselben
  Punkte werden beim Denken zu Ringen, beim Sprechen zur Welle, bei Freude zum Haken.
- **Dot schwebt frei über der App (Nutzer 22.10.):** klebt an Kante oder Ecke, lässt sich
  überall hinstellen, Größe ziehbar mit Grenzen, Verformung je nach Rand und Aufprall,
  „organisch und physikalisch“. Mockup v3 unter derselben Adresse:
  - Ziehen 1:1 mit Griffpunkt, gegen den Rand gedrückt quetscht er sich (Gummiband).
  - Loslassen: Endpunkt nach Apples Projektion (Verzögerung 0,996); schneller Wurf
    (> 900 px/s) fliegt bis zur Kante in Wurfrichtung. Nah an einer Kante → klebt dort,
    nah an zwei → Ecke, langsam in der Mitte → bleibt frei stehen.
  - Grenzen: unter der Statusleiste, über der Tab-Leiste, 4 px vom Bildschirmrand.
  - Feder je Achse (Dämpfung 0,8), Kante als harte Feder; Aufprall stößt eine
    Form-Feder an (quer platt, längs breit) → Nachwackeln, Funken an der Kontaktstelle.
    Im Flug längs gestreckt. An der Kante abgeflacht (klebt), oben hängt er als Tropfen,
    seitlich sackt er leicht, unten sitzt er auf.
  - Größe: Rand ziehen, zwei Finger oder Mausrad, Durchmesser 48–168 px, darüber
    Gummiband und Zurückfedern. Ring zeigt beim Ziehen die Grenzen.
  - Antippen: Coach öffnet, Dot fliegt in die Bühne oben (Durchmesser 132), beim
    Schließen zurück an seinen Platz. Platz und Größe gemerkt (localStorage im Mockup).
  - Regler „Weichheit“ (fest ↔ weich) zum Abstimmen; Standard 0,55.
  - In der App dazu: Haptik nach Aufprallstärke, Ausweichen vor der Tastatur.

- **Weicher Körper mit Formgedächtnis (Nutzer 22.10.: „noch weicher, organischer,
  unregelmäßiger; aus der Ecke erst eckig, dann nach und nach rund; Wackeln je nach
  Tempo und Richtung; erholt sich, wenn er langsamer wird oder steht“).** Mockup v4:
  - Rand aus 72 Punkten (Auslenkung, Geschwindigkeit), gekoppelt über Spannung →
    Wellen laufen um den Rand; innere Reibung dämpft feine Wellen schneller als grobe.
  - Trägheit: Beschleunigung (beim Ziehen aus der Hand, sonst aus der Physik) staucht
    die Vorderseite und lässt die Rückseite nachquellen; im Flug längs gestreckt.
  - Unregelmäßig: jede Stelle eigene Steifigkeit und Trägheit, dazu leises Atmen aus
    drei überlagerten Wellen.
  - Wände begrenzen jeden Randpunkt einzeln (echte flache Seite, Ecke = eckig), Fläche
    bleibt erhalten (quillt an freien Stellen heraus).
  - Gedächtnis: an der Wand nimmt Dot die Form an (Ecke prägt sich ein), harte
    Stauchung hinterlässt Dellen. Erholung nur in Ruhe: Tempo unter ~380 px/s, an der
    Wand kaum, beim Ziehen halb; Ecken runden sich zuerst (Diffusion). Heilende Stellen
    leuchten leise auf.
  - Regler Standard 0,72 (Stufen fest / mittel / weich / Gelee).

## Offen
- Weichheit festlegen; Randleuchten behalten?; Name bestätigen.
- Ausweichen „wo er gerade nicht stört“: weiter als Tastatur? (z. B. vor Knöpfen,
  die unter ihm liegen, oder beim Scrollen kleiner werden)

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
