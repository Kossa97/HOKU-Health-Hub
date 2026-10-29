# Hoku führt durch Anmelden und Registrieren — Design

Stand 29.10.2026, gemeinsam mit dem Nutzer Schritt für Schritt geplant.
Markierungen: **[Nutzer]** = vom Nutzer so entschieden, **[Claude]** = von Claude
vorgeschlagen und vom Nutzer mit „passt so“ bestätigt, **[offen]** = erst nach
dem Mockup entschieden, **[Bauende]** = bewusst dem Bauenden überlassen.

## Absicht

Das Maskottchen heißt jetzt **Hoku** (früher Dot; Code und Dateinamen heißen noch
`dot`, die Umbenennung im Code ist **nicht** Teil dieses Vorhabens). Auf der
Login-Seite soll Hoku nicht nur begrüßen, sondern die Person **führen**: Er sagt
und zeigt, was als Nächstes zu tun ist, meldet sich, wenn sie hängen bleibt
(z. B. kein Passwort eingibt), und reagiert auf jedes Ergebnis mit einer eigenen
Geste. Dazu kommt die bisher fehlende Funktion **„Passwort vergessen“**.

## Ziele

- Jede Situation auf Startseite, Anmelden, Registrieren und Passwort vergessen hat
  eine festgelegte Aktion und (wo gewollt) einen Text von Hoku.
- Untätigkeit wird erkannt; Hoku schwebt zum Feld oder Knopf, um den es geht.
- Neue Emotes aus Hokus eigenen Partikeln.
- Passwort zurücksetzen per E-Mail-Link funktioniert durchgehend.

## Nicht-Ziele

- Keine Umbenennung von Dot zu Hoku im Code, in Dateinamen oder in der App außerhalb
  der hier genannten Texte.
- Keine weiteren Sprachen als de/en (siehe Randbedingungen).
- Keine Änderung an der Eröffnung (E1/E2/E5) und an S5 selbst, außer dem Übergang
  vom Haken in S5 (siehe „Haken und X“).

## Anti-Ziele (wäre ein Fehlschlag, auch wenn es technisch läuft)

- Hoku nervt: wiederholt sich endlos, spricht beim Nachdenken oder Tippen dazwischen,
  belehrt nach Fehlern.
- Hoku lenkt bei Fehlern mit Text ab — bei Fehlern spricht er **nicht**, die Zeile
  unter dem Formular erklärt **[Nutzer]**.
- Eine laufende Erinnerung blockiert die Person: jede Berührung, jede Eingabe bricht
  sie sofort ab.

## Randbedingungen

- **Texte nur de/en** (CLAUDE.md). Neue Schlüssel bekommen in den zwölf übrigen
  Sprachen den englischen Text als Platzhalter (i18n-Vertrag in
  `src/features/my-stack/lib/i18n.test.ts`), sonst nichts.
- Hoku schreibt mit seinen Partikeln: **höchstens zwei kurze Zeilen**, `/` in den
  Tabellen unten = Zeilenumbruch. Schreiben und Schweben gehen nicht gleichzeitig
  (beim Schreiben besteht er ganz aus Schrift): erst Text, dann Kugel, dann Bewegung.
- Weniger Bewegung (`prefers-reduced-motion`): Hoku schwebt, klopft und zeigt keine
  Emotes; seine Sätze erscheinen wie heute als sichtbarer Text (`satz`), Hinweise
  auf Felder als Zeile. **[Claude]**
- Hokus Sätze gehen wie heute zusätzlich an Screenreader.
- Datenbank wird nicht verändert. Für „Passwort vergessen“ nur Supabase-Auth.

## Bausteine, die es schon gibt (bleiben)

- Eröffnung E1/E2/E5 im Zufall, Gruß F1/F3 (Kegelarm), Herz.
- Fehlergesten **Heute, A, C** im Zufall; Kein-Netz-Gesten **A, B** im Wechsel.
- Erfolg **S5**: Ring → unruhiges Portal → Sammeln in der Mitte → Heimflug.
- Werfen/Antippen: klebt an der Wand, kehrt zur Bühne zurück.
- Zeile unter dem Formular (`meldung`) mit den bestehenden Fehlertexten.

## Gemeinsame Regeln

### Hinweise bei Untätigkeit **[Nutzer]**, Details **[Claude]**

- Uhr startet nach Hokus letzter eigener Geste bzw. nach der **letzten Eingabe**
  (Tippen, Fokus, Antippen) — langsames Tippen löst nichts aus.
- Ablauf eines Hinweises: Hoku schreibt den Satz auf der Bühne → wird Kugel →
  schwebt zum Ziel → **eine Runde** um das Ziel, das Ziel leuchtet dabei kurz leise
  auf → zurück zur Bühne.
- Ziel = der **erste leere Teil** des Formulars in Lesereihenfolge; ist alles
  gefüllt, der Absende-Knopf.
- **Ein Hinweis je Stille** (auf der Startseite die beiden aus 2 und 3), nicht alle
  10 s ein neuer. **[Claude]**
- Nach 30 s ohne Eingabe (gerechnet ab Beginn der Stille) einmal **Klopfen**
  (unten). Danach Ruhe, keine weiteren Wiederholungen.
- Jede Eingabe, jeder Fokus, jedes Antippen bricht laufende Hinweise sofort ab
  (auch mitten im Klopfen) und startet die Uhr neu.

### Klopfen „Noch da?“ **[Nutzer]**, Ausführung **[Claude]**

Hoku schwebt nach vorn und wird größer, als käme er an die Scheibe, klopft zwei- bis
dreimal von innen (bei jedem Klopfen kurz platt gedrückt, ein feiner Lichtring läuft
über das Glas, auf dem Handy leichte Vibration), schreibt „Noch / da?“
(en „Still / there?“) und schwebt zurück.

### Haken und X kommen aus Hoku **[Nutzer]**

- Haken (überall) und rotes X (Fehlergeste „Heute“) wachsen aus Hokus eigenen
  Partikeln heraus wie das Herz, stehen kurz vor ihm (Haken wird grün) und sinken
  zurück in ihn. Fehlergesten A und C bleiben unverändert.
- Beim Anmelden und nach neuem Passwort: Haken sinkt zurück, **dann** wird Hoku zum
  Ring und S5 läuft wie heute weiter **[Claude]** (bisher wurde der Haken selbst
  zum Ring).

### Bei Fehlern

Fehlergeste (Heute/A/C im Zufall), **kein Text von Hoku**, Zeile unten wie heute.

## Neue Emotes

| Emote | Wo | Aussehen | Stand |
|---|---|---|---|
| Freude | Formular öffnet (4, 19) | Vorschlag: zweimal hüpfen, beim zweiten Sprung eine Drehung, Funken springen heraus | **[offen]** Varianten im Mockup |
| Augen zuhalten | Passwortfelder (6, 12, 21) | beide Kegelarme vor das „Gesicht“, leicht zur Seite gedreht; bei „Passwort anzeigen“ ganz weggedreht | **[Nutzer]** Idee, Ausführung **[Claude]** |
| Warten | Server prüft (7, 17, 18) | drei kleine Kugeln lösen sich und kreisen schräg wie Monde, Hoku etwas kleiner/dunkler; bei Antwort schnappen sie zurück | **[offen]** Nutzer will die Monde sehen; Alternativen „Lichtwelle“ und „Grübeln“ im Mockup |
| Sanduhr | zu viele Versuche (15) | Sanduhr aus Partikeln, Punkte rieseln | **[Claude]** |
| Briefumschlag | Mail verschickt (11, 23) | Umschlag aus Partikeln fliegt kurz aus dem Bild, Hoku setzt sich neu zusammen | **[Claude]** |
| Schulterzucken | Abbruch beim Anbieter / Face ID (17, 18) | beide Arme kurz hoch, kein Text | **[Claude]** |
| Nicken / Kopfschütteln | Benutzername live (21) | kurzes Nicken bzw. sanftes Schütteln, ohne X | **[Claude]** |
| Traurig | Link abgelaufen (13) | sinkt zusammen, blasser, richtet sich wieder auf | **[Claude]** |
| Klopfen | 30 s Stille | siehe oben | **[Nutzer]** |

Vor dem Bau werden alle neuen Emotes im Mockup „Dots Auftritte“ gezeigt; der Nutzer
wählt dort Freude und Warten aus.

**Wahl des Nutzers (29.10.2026, Mockup Version 8):**
- Freude: F1, F2 und F3 im Wechsel.
- Warten: W2 (Lichtwelle) und W3 (Denkwolken: erst eine kleine, dann eine mittlere,
  dann die große Wolke, im Loop) im Wechsel.
- Augen zuhalten: Arme müssen organisch und physikalisch aus Hokus eigenen
  Partikeln herauswachsen, keine Extra-Objekte.
- Haken: gut, Hoku leuchtet dabei grün auf. X: oben links ausbessern, sonst gut.
- Klopfen: Hoku kommt noch näher an die Scheibe, dann wächst ein Arm aus ihm und
  klopft; deutlicher, aufwändiger, hochwertiger.
- Sanduhr, Briefumschlag: gut.
- Schulterzucken: **gestrichen**. Bei Abbruch (Apple/Google/Face ID) zeigt Hoku
  nichts und wird nur wieder ruhig. **[Claude]**
- Nicken: gut, Hoku leuchtet dabei grün auf. Kopfschütteln: gut, Hoku leuchtet rot auf.
- Startknöpfe K2 (auseinander, „oder“ dazwischen); Hokus Flug um den Knopf freier und
  zufälliger, auch vertikal um den Knopf herum, also zwischen Knopf und Hintergrund
  hindurch (hinter dem Knopf verdeckt).

**Zweite Rückmeldung (29.10.2026, Mockup Version 9 → 10):**
- Augen zuhalten: Arme gut. Beim Einfahren fließt jeder Punkt gestaffelt auf seinen
  eigenen Platz in der Kugel zurück (kein Zusammenziehen zum Strich). Dazu eine
  **Sprechblase**: „Keine Sorge, ich sehe nichts.“ (en: „Don't worry, I can't see a
  thing.“), solange er die Augen zuhält — über die Blase der Engine (`sag`), nicht als
  Partikelschrift.
- Haken und X: nur das Zeichen selbst leuchtet auf (heller, kleiner Schein eng darum),
  nicht Hoku und nicht die Umgebung.
- Nicken / Kopfschütteln: nur Hokus eigene Punkte leuchten grün bzw. rot, kein Schein
  drumherum.
- Klopfen **neu**: kein Arm. Hoku fliegt dreimal ganz nah an die Scheibe, prallt sanft
  dagegen (drückt sich platt, Lichtring auf dem Glas, leichtes Tippen per Vibration),
  federt zurück; dann „Noch da?“.
- Hinweis-Flug K2: physikalisch und organisch statt Ablauf — Federn längs des Knopfs,
  um seine Längsachse und im Abstand jagen unregelmäßig springenden Zielen nach, mit
  wechselnder Steifigkeit und Dämpfung unter 1 (Überschwingen, Tempowechsel,
  gelegentliches Umkehren, hinter dem Knopf verdeckt). Hin- und Rückflug im Bogen mit
  Federn.

## Alle Situationen

### Startseite (Anmelden / Registrieren)

| # | Situation | Aktion | Text de | Text en |
|---|---|---|---|---|
| 1 | Seite öffnet | Eröffnung, winken, Satz, Herz | Hi! Willkommen / bei Hoku | Hi! Welcome / to Hoku |
| 2 | ~6 s nichts angetippt | Satz, schwebt zu **Anmelden**, eine Runde | Melde dich / an! | Sign / in! |
| 3 | weitere ~6 s | Satz, schwebt zu **Registrieren**, eine Runde | Neu? Registrier / dich! | New here? / Sign up! |
| 3b | 30 s Stille | Klopfen | Noch / da? | Still / there? |

Ersetzt „Willkommen im Health Hub“. **[Nutzer]** (Zeiten ~6 s **[Claude]**)
Die beiden Startknöpfe stehen heute direkt untereinander in voller Breite; sie
werden weiter auseinandergezogen (z. B. „oder“ dazwischen), damit Hokus Runde um
den einen den anderen nicht schneidet. Genaue Gestaltung **[offen]**, im Mockup.

### Anmelden

| # | Situation | Aktion | Text de | Text en |
|---|---|---|---|---|
| 4 | Formular öffnet | Satz per Zufall (nie zweimal hintereinander derselbe), dann Freude | Willkommen / zurück! · Schön, dich / wiederzusehen! · Da bist du / ja wieder! | Welcome / back! · Good to see / you again! · There you / are! |
| 5 | 10 s keine Eingabe, E-Mail leer | Hinweis zum Feld | Hier deine / E-Mail rein | Your email / goes here |
| 5 | … Passwort leer | Hinweis zum Feld | Jetzt noch / dein Passwort | Now your / password |
| 5 | … alles gefüllt | Runde um Anmelden | Tipp auf / Anmelden! | Tap / Sign in! |
| 6 | Fokus im Passwortfeld | Augen zuhalten, solange Fokus; bei „anzeigen“ ganz weg; beim Verlassen Arme zurück | — | — |
| 7 | Server prüft | Warten-Emote; Knopf „Wird angemeldet…“ | nach > 4 s: Einen / Moment… | One / moment… |
| 8 | Passwort falsch | Fehlergeste, danach ruhig | — (Zeile wie heute) | — |
| 9 | 2. Fehlversuch mit derselben Kennung | Fehlergeste, dann Runde um **„Passwort vergessen?“** | Passwort / vergessen? | Forgot your / password? |
| 9 | ab 3. Fehlversuch | Fehlergeste, Runde um den Link, ohne Text | — | — |
| 14 | kein Internet | Kein-Netz A/B, Zeile + „Erneut versuchen“; nach 10 s Runde um den Knopf | — | — |
| 14 | Netz kommt von selbst zurück | leuchtet auf, Satz, Knopf leuchtet auf | Wieder / online! | Back / online! |
| 15 | zu viele Versuche | Sanduhr, Satz, dann Runde um „Passwort vergessen?“; weiteres Abschicken: nur Sanduhr | Kurz / durchatmen | Take a / breather |
| — | Erfolg | Haken aus Hoku, dann S5 | — | — |

Fehlversuch-Zählung nur für dieselbe Kennung (E-Mail/Name), gilt für die offene
Seite. **[Claude]** Kein Countdown bei „zu viele Versuche“ (Server nennt die Dauer
nicht). **[Claude]**

### Apple, Google, Face ID

| # | Situation | Aktion | Text |
|---|---|---|---|
| 16 | Tippen auf Apple/Google | kurz winken (ein Arm), dann zum Anbieter | — |
| 17 | zurück, Sitzung noch nicht da | Warten-Emote | — |
| 17 | Erfolg | Haken, S5 | — |
| 17 | Person hat beim Anbieter abgebrochen | Schulterzucken, **kein X** | — |
| 17 | echter Fehler | Fehlergeste, Zeile „Das hat nicht geklappt…“ | — |
| 18 | Face ID: System fragt | Warten-Emote | — |
| 18 | Erfolg | Haken, S5 | — |
| 18 | Passkey unbekannt | Fehlergeste, Zeile wie heute, dann Runde um das Passwortfeld | — |
| 18 | abgebrochen | Schulterzucken | — |

Heute wird ein Abbruch wie ein Fehler behandelt; Abbruch und Fehler werden
getrennt **[Claude]**. Wie ein Abbruch erkannt wird (OAuth-Rückgabe
`error=access_denied` o. ä., Passkey-`NotAllowedError`), **[Bauende]**.

### Passwort vergessen (neue Funktion) — **später** **[Nutzer, 29.10.2026]**

Wird erst in einem späteren Schritt gebaut; offen sind dafür noch: Code zum
Abtippen statt/zusätzlich zum Link (iPhone-Home-Bildschirm-App und Android öffnen
Mail-Links im Browser), eigener Mailversand (SMTP) in Supabase, Einstellung
„E-Mail bestätigen“. Bis dahin entfallen die Hinweise auf den Link in 9 und 15:
beim 2. Fehlversuch nur die Fehlergeste, bei „zu viele Versuche“ nur Sanduhr und
Satz. **[Claude]** Der Rest dieses Abschnitts bleibt als Plan für später.

Eigene Ansicht, schiebt herein wie Anmelden/Registrieren (Standard großer Apps,
gut für Passwort-Manager) **[Nutzer, nach Empfehlung]**. Link „Passwort vergessen?“
im Anmeldeformular unter dem Passwortfeld (genaue Stelle **[Bauende]**).

| # | Situation | Aktion | Text de | Text en |
|---|---|---|---|---|
| 10 | Ansicht öffnet; E-Mail aus dem Anmeldefeld übernommen, falls dort eine E-Mail stand | kurzes Nicken, Satz | Kein Problem, / ich helf dir! | No problem, / I'll help! |
| 10 | 10 s nichts | Hinweis zum Feld / Knopf | Hier deine / E-Mail rein · Tipp auf / Link senden! | Your email / goes here · Tap / Send link! |
| 11 | Link verschickt | Briefumschlag, Satz; Zeile „Wir haben dir einen Link geschickt. Er gilt eine Stunde.“ | Schau in / dein Postfach! | Check your / inbox! |
| 12 | Link in der Mail geöffnet → Ansicht „Neues Passwort“ (zwei Felder) | einmal hüpfen, Satz | Fast / geschafft! | Almost / there! |
| 12 | 10 s nichts | Hinweis zum Feld / Knopf | Dein neues / Passwort · Noch einmal / zur Sicherheit | Your new / password · Once more, / to be safe |
| 12 | Tippen | Augen zuhalten in beiden Feldern | — | — |
| 12 | zu kurz / ungleich | Fehlergeste, Zeile (bestehende Texte) | — | — |
| 12 | gespeichert | Haken, S5 — Person ist direkt angemeldet in der App | — | — |
| 13 | Link abgelaufen oder schon benutzt | traurig, Satz, dann Runde um „Neuen Link senden“ (E-Mail vorbefüllt, wenn bekannt) | Der Link ist / abgelaufen | This link has / expired |

Zeile zu 11: neuer Text, auch en: „We sent you a link. It's valid for one hour.“
Ob die Mail bei unbekannter E-Mail-Adresse trotzdem „verschickt“ meldet (damit
niemand ausprobieren kann, welche Adressen ein Konto haben): ja, immer dieselbe
Meldung **[Claude]**. Bewusst in Kauf genommen: #22 („E-Mail hat schon ein Konto“,
gibt es heute schon) und die Live-Namensprüfung (#21) verraten, ob eine Adresse bzw.
ein Name vergeben ist — der Nutzer will beides. **[Claude]**

Technik: Supabase `resetPasswordForEmail` mit Rückkehr-Adresse, Ereignis
`PASSWORD_RECOVERY`, `updateUser({ password })`. Rückkehr in Web und Android-App
(Capacitor) analog zur bestehenden Anbieter-Rückkehr (`rueckkehr`) **[Bauende]**.
Die Rückkehr-Adresse muss in Supabase unter den erlaubten Redirect-URLs stehen und
die Mailvorlage passen — das ist Projekteinstellung, kein Code; der Bauende listet
die nötigen Einstellungen auf, der Nutzer setzt sie (Zustimmung je Änderung).

### Registrieren

| # | Situation | Aktion | Text de | Text en |
|---|---|---|---|---|
| 19 | Formular öffnet | Satz, dann Freude | Hey, ich bin / Hoku! | Hey, I'm / Hoku! |
| 20 | 10 s nichts, erster leerer Teil: Benutzername | Hinweis | Wie soll ich / dich nennen? | What should / I call you? |
| 20 | … E-Mail | Hinweis | Deine / E-Mail bitte | Your email, / please |
| 20 | … Passwort | Hinweis | Denk dir ein / Passwort aus | Pick a / password |
| 20 | … Passwort wiederholen | Hinweis | Noch einmal / zur Sicherheit | Once more, / to be safe |
| 20 | … Zustimmungen | Hinweis | Hier noch / zustimmen | Just agree / here |
| 20 | … alles fertig | Runde um den Knopf | Tipp auf / Konto erstellen! | Tap / Create account! |
| 21 | Passwortfelder | Augen zuhalten | — | — |
| 21 | Benutzername: 0,5 s nach letztem Tastendruck gültig und frei | Nicken | — | — |
| 21 | … vergeben | sanftes Kopfschütteln, Zeile „schon vergeben“, verschwindet beim Weitertippen | — | — |
| 21 | … ungültig | nichts; Meldung erst beim Abschicken | — | — |
| 22 | Fehler beim Abschicken | Fehlergeste, Zeile | — | — |
| 22 | E-Mail hat schon ein Konto | zusätzlich Runde um den Weg zum Anmelden | — | — |
| 23 | Konto erstellt, Bestätigung nötig | Haken, dann Briefumschlag | Schau in / dein Postfach! | Check your / inbox! |
| 24 | Konto erstellt und gleich angemeldet | Haken, S5 | — | — |

Live-Prüfung des Namens ist neu (heute erst beim Abschicken) **[Nutzer]**.
Abfragehäufigkeit/Entprellen und Verhalten ohne Netz **[Bauende]**; die Prüfung beim
Abschicken bleibt maßgeblich.

### Übergreifend

| # | Situation | Aktion |
|---|---|---|
| 25 | Zurück-Pfeil zur Startseite | kein Text; Startseiten-Hinweise (2, 3, 3b) beginnen neu |
| 26 | Sprache umstellen | der gerade gezeigte Satz wird sofort in der neuen Sprache neu geschrieben |
| 27 | Hoku werfen / antippen | wie heute; bricht laufende Hinweise ab |

## Mockup vor dem Bau

Im Mockup „Dots Auftritte“ (https://claude.ai/artifact/Ab6uRmqzVNDBHgBDRYbnS5)
werden gezeigt und vom Nutzer gewählt bzw. abgenommen: Freude (Varianten), Warten
(Monde, Lichtwelle, Grübeln), Augen zuhalten, Haken und X aus Hoku, Klopfen,
Sanduhr, Briefumschlag, Schulterzucken, Hinweis mit Runde um einen Knopf, Abstand
der Startknöpfe. Keines dieser Emotes ist dort bisher enthalten; das Mockup ist der
**erste Teil** dieses Vorhabens, und der Bau der Engine-Emotes wartet auf die Wahl
des Nutzers. Erst danach wird gebaut.

## Dem Bauenden überlassen

- Aufteilung in Schritte/Commits, Zustandsmodell der Hinweise, Engine-API für
  „schwebe zu Element und kreise“.
- Leuchten der Ziele (Gestaltung im Rahmen der bestehenden Login-Optik).
- Erkennung von Abbrüchen, Live-Namensprüfung, Rückkehr vom Reset-Link.
- Tests: bestehende E2E-Login-Tests erweitern (Untätigkeit, Fehlversuche,
  Passwort vergessen), Unit-Tests für Zeitlogik.
