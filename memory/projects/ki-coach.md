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

- **Runde 5 (Nutzer 22.10.):** Mockup v5.
  - **Ganz weich gewählt** (Regler „Gelee“ = 1 als Standard).
  - **Randleuchten bleibt**, wird später noch angepasst.
  - **Chat öffnet sich von Dots Platz aus** (Kreis wächst per `clip-path` von Dots
    Mitte, 560 ms, iOS-Kurve) und schließt sich zu dem Platz, an den er zurückfliegt.
  - **Zucken in der Ecke behoben.** Ursachen: ungeglättete Beschleunigung aus dem
    Flattern der Mitte an zwei Wänden, Flächenausgleich als harter Sprung. Jetzt:
    Beschleunigung ~30 ms geglättet, Wand kritisch gedämpft, Flächenausgleich als
    sanfte Kraft, Anzeige ~25 ms geglättet, 96 Randpunkte. Gemessen in beiden Ecken
    höchstens 0,13 px Änderung je Bild (nur das Atmen).
  - **Anziehung gedämpft:** Projektion 0,993 statt 0,996, Fangbereich max(34, 0,9 r)
    statt max(64, 1,5 r), Durchwurf bis zur Kante erst ab 1500 px/s, weichere Feder
    (90 statt 150), weniger platt an der Kante.
  - **Zoomen nur mit zwei Fingern** (der zweite darf irgendwo landen), am Rechner
    Mausrad. Kein Größe-Ziehen am Rand mehr. Per Befehl im Chat: „Mach dich größer“,
    „kleiner“, „so groß/klein wie möglich“ (später auch per Sprache).
  - **Tab-Leiste = Dots Haus:** einziges Ding, gegen das er prallt (Oberkante
    leuchtet, wo er sie berührt). Mitte ist eine Tür; über der Tür öffnet sie sich
    beim Ziehen, fest hineingedrückt oder hineingeworfen geht er hinein (sichtbar nur
    über der Leiste und in der Tür) und schläft dort klein. Tür antippen schickt ihn
    heim; ist er drin, wird sie zur **Klingel** („Ding-dong“) und er springt oben
    heraus zurück an seinen Platz. Chat-Befehl „Geh in dein Haus“.

- **Runde 6 (Nutzer 22.10.):** eigene Leiste mit Haustür bleibt als **Variante**:
  https://claude.ai/artifact/1gDYarWaYbiC1ond9Xhrhb. Hauptfassung (v6, gleiche
  Adresse) nutzt die **echte Leiste der App** (`LiquidGlassTabBar`: Glas-Kapsel 56 px,
  nur Symbole Home / My Stack / Kalender / Profil, aktive Pille, daneben runder
  Plus-Knopf) mit **Dot als Logo in der Mitte der Kapsel** (Punkt-Kugel als SVG).
  - Eingang: über dem Logo ein cyanfarbener Lichtschein aus der Kapselkante, so breit
    wie der Eingang (Spalt auf der Kante, weiche Säule, aufsteigende Lichtpunkte).
    Bleibt offen, solange Dot draußen ist; wird heller, wenn er sich nähert.
  - Herausklettern (Logo antippen, beim Start automatisch): Tür öffnet sich (0,3 s),
    Kopf kommt hoch, zwei „Hände“ (Randbeulen unten links/rechts) greifen die Kante,
    er zieht sich gestreckt hoch, Absprung (vy −520) und fliegt an seinen Platz.
  - Hineingehen: Wurf, dessen Bahn die Kante im Eingangsbereich trifft; im Schein
    loslassen; mit dem Finger von oben hineindrücken/-wischen; Aufprall auf die Kante
    über dem Eingang. Er wird hineingesogen (unten tropfenförmig, seitlich schmal),
    nur über der Kante sichtbar, Tür schließt sich, Logo macht einen kleinen Hüpfer.
  - Zu Hause: Logo pulsiert (1,7 s), leuchtet (Schein cyan/violett) und wackelt
    unregelmäßig (2,3 s). Ein Tipp darauf ist die Klingel. Draußen schickt ein Tipp
    aufs Logo ihn heim.
  - **Eingang dezent (Nutzer 22.10.: „Tür viel zu extrem“):** keine Lichtsäule mehr.
    Der Lichtrand der Kapsel öffnet sich oben in Eingangsbreite (Lücke wächst mit
    `easeOut3`), die beiden Enden biegen sich ~2 px auf und fangen Licht; darüber
    nur ein leiser Schein (~26 px hoch, Alpha 0,16) und fünf feine, leicht
    schwankende Strahlen (1 px, Alpha 0,2). Nähert sich Dot, etwas heller.
  - Für die App: die mittlere Schaltfläche (`art: 'aktion'`) ist im Code schon
    vorgesehen (`LiquidGlassTabBar`); dort käme das Logo hin.

- **Persönlichkeit (Nutzer 22.10. gewählt), Mockup v9:** Sprechblase (Glas, kurz,
  wächst aus Dots Richtung, über ihm, sonst darunter).
  - Begrüßung nach dem ersten Herausklettern: winkt (Randbeule oben zur
    Bildschirmmitte, schwingt) + Tageszeit-Gruß mit dem, was heute ansteht.
  - Müde: nach 12 s ohne Berührung (in der App länger, z. B. 60 s) gähnt er (2,4 s:
    streckt sich hoch, atmet breit aus), dann dösen: dunkler, dreht langsamer, sackt,
    tiefes Atmen, drei Schlafpünktchen steigen schräg auf. Wecken durch Berührung,
    Scrollen, Chat, Logo: kurzes Zucken + „Oh! Bin wach.“ (Scrollen).
  - Kitzeln: ≥ 4 Richtungswechsel in 1 s auf < 80 px → zappelt 1,4 s, flackert,
    „Hihi, das kitzelt!“, 3 s Pause bis zum nächsten Mal.
  - Schwindelig: ≥ 4 Richtungswechsel über > 130 px beim Ziehen → nach dem Loslassen
    3,2 s taumeln (Mitte kreist), Rand eiert, Farben drehen sich, „Uff … alles dreht
    sich.“
  - Neugierig: Scrollen lässt ihn in Scrollrichtung lehnen und kurz nachschwingen.
  - Knöpfe im Mockup zum Auslösen (Begrüßen, Müde werden, Kitzeln, Schwindelig).

## Name der App (Überlegung, 22.10.2026)
- Nutzer überlegt, die App „Dot“ zu nennen; Idee „Meet Dot“. Websuche (keine
  Registerprüfung, Register im Container gesperrt): USA „DOT“ Nr. 4860730, Klasse 9,
  Fruchtbarkeits-App von Cycle Technologies (eingetragen 2015); USA „DOT.“ Anmeldung
  97923907, Klasse 42 (Labor/Gesundheitsakten). DPMA/EUIPO: nichts gefunden, nicht
  geprüft. Vor einer Entscheidung: TMview-Suche + Ähnlichkeitsrecherche (Markenrecht).
  Maskottchenname „Dot“ ist davon unberührt.

## Offen
- Randleuchten anpassen (wie genau: offen). Name „Dot“ bestätigen.
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
