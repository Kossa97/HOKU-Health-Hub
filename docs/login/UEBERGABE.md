# Login mit Dot – Übergabe zur Umsetzung

Stand 27.10.2026. Grundlage ist das Mockup `docs/login/mockup.html`, live unter
https://claude.ai/artifact/Cm88imRAv2u1NKvSc9CKh5. Das Mockup ist die **Referenz für
Verhalten, Zeiten und Werte**, nicht für die Code-Struktur: Es ist eine einzelne
HTML-Datei ohne React und baut die Engine nach. Umgesetzt wird in der
bestehenden Engine (`src/features/dot/engine/dotEngine.ts`) und in `src/pages/Auth.tsx`.

Entscheidungen und offene Punkte stehen kurz in `memory/projects/login.md`.

---

## 1. Was der Nutzer erlebt

### Erster Aufruf (keine Sitzung)
1. **Eröffnung:** Die Partikel liegen auf der abgerundeten Display-Kontur (links, oben,
   rechts, nie unten) und sammeln sich zu Dot. Bei jedem Öffnen kommt eine der vier
   Varianten **Strudel, Galaxie, Implosion, Regen**, nie zweimal dieselbe hintereinander.
2. Dot winkt (Hand), zeigt „Willkommen im Health Hub“ (Text) und dann ein schlagendes Herz.
   Danach ist er wieder die Kugel.
3. Unter Dot stehen nur zwei Knöpfe untereinander: **Anmelden** und **Registrieren**.

### Anmelden (gleitet von rechts herein, Dot zeigt „Willkommen zurück“)
- „Mit Apple fortfahren“, „Mit Google fortfahren“, Trenner „oder“
- Ein Feld **E-Mail oder Benutzername**, darunter das Passwort mit Auge
- Schalter **Angemeldet bleiben** (Standard an), Link „Passwort vergessen?“
- Knopf **Anmelden**, rechts daneben ein Face-ID-Knopf
- Zurück-Pfeil oben links. Er funktioniert immer, auch mitten in einer
  Fehleranimation, und bricht sie ab.

### Registrieren (Dot zeigt „Hey, ich bin Dot“)
- Apple, Google, „oder“
- Benutzername, E-Mail, Passwort (mind. 6 Zeichen), **Passwort wiederholen**
  (das Auge am ersten Feld blendet beide ein)
- Häkchen: Nutzungsbedingungen und Datenschutzerklärung (verlinkt auf `/nutzungsbedingungen`, `/datenschutz`)
- Knopf **Konto erstellen**

### Während Dot arbeitet
- Fokus im Passwortfeld: Dot wird zum Kreis (Zuhören, bestehende Form `circle`).
- Fokus in anderen Feldern: Dot neigt sich leicht zum Formular (10 px).
- Abschicken: Ringe (bestehende Form `rings`, Denken).

### Fehler
| Fall | Erkannt wo | Dot |
|---|---|---|
| Feld leer, E-Mail/Benutzername ungültig, Passwort zu kurz, Wiederholung falsch, Häkchen fehlt | im Gerät | sofort **rotes X + Schütteln**, ohne Ringe |
| Falsche Zugangsdaten | Server | Ringe (0,9 s) → **rotes X + Schütteln** |
| Keine Verbindung | Server/Netz | Ringe (1,4 s) → **Kein-Netz-Symbol in Orange** (WLAN-Bögen, Licht läuft zweimal nach außen, dann zeichnet sich der Schrägstrich) → Knopf heißt „Erneut versuchen“ |

Immer zusätzlich: Das betroffene Feld bekommt einen roten Rand, darunter steht ein
Satz (`role="alert"`, Feld mit `aria-invalid` und `aria-describedby`). Dot allein reicht nicht.
Rot = `--lg-bad` (#ff453a), Orange = `--lg-warn` (#ff9f0a).

### Erfolg: Portal + Heimweg
1. Ringe (1 s) → Haken (bestehende Form `check`, steht 0,8 s).
2. **Portal:** Dots Ring aus seinen 460 Punkten wächst vom Kreis zu einem abgerundeten
   Rechteck, bis die Kugeln am Rand des Displays liegen. Innerhalb genau dieser Form wird die
   Startseite sichtbar (`clip-path: inset(... round r)`, mitwachsend). **Kein Kreisen, kein Lichtlauf.**
3. Die Kugeln bleiben kurz am Rand, dann **finden sie langsam zu Dot zusammen**
   (sehr weiche Federn, die sich zurück auf normal steigern, versetzte Starts).
4. **Heimweg:** Dot fliegt im Bogen in seinen Platz in der Tab-Leiste
   (`[data-tyd-slot="dot"]`), schrumpft dabei auf Logo-Größe, das Logo landet mit Hüpfer
   (bestehende Klasse `tyd-dot-huepf`).

Tempo-Wert des Nutzers ist 0,6. Das ergibt rund 9 Sekunden ab Antippen (Denken 1 s + Haken 0,8 s + Portal 2 s + Zusammenfinden 3,8 s + Heimflug 1,5 s). **Auf dem Gerät
prüfen** und mit Devin besprechen, ob es dort zu lang wirkt.

### Wiederkehrender Nutzer
**Mit gültiger Sitzung öffnet sich der Login gar nicht.** Die App startet direkt auf der
Startseite, ohne Eröffnung und ohne Gruß. „Angemeldet bleiben“ aus heißt: beim nächsten
App-Start wieder Login. Registrieren, Apple, Google und Face ID gelten als „angemeldet bleiben“.

### Dot ziehen
Wie in der App: ziehen, werfen, prallt am Rand ab, kehrt nach 450 ms Ruhe langsam auf seine
Bühne zurück. **Er bleibt vollständig im Display:** Seine Mitte hält einen vollen Radius
Abstand zu jedem Rand. Gegen den Rand gedrückt plattet er sich ab statt hinauszugehen.
Kein Partikel verlässt das Display, auch nicht in den runden Ecken.

---

## 2. Formen und Werte

### Grundsatz: Dots Stil bleibt
Dot ist die **460-Punkte-Kugel** aus der Engine (`PUNKTE = 460`), mit Farben, Neigung und
Glanz wie bisher. Hand, Herz, X und Kein-Netz-Symbol bestehen aus **denselben 460 Punkten in
derselben Punktgröße**, gleichmäßig verteilt (Sechseck-Gitter über der Silhouette, Abstand so
gewählt, dass höchstens 460 Punkte hineinpassen; übrige Punkte unsichtbar).

**Nur die Schrift braucht mehr Punkte.** Im Mockup trägt jeder der 460 Punkte fünf
„Kinder“ (insgesamt 2760). Die Kinder sitzen unsichtbar in ihrem Elternpunkt und treten nur
für Text und für die Eröffnung heraus. Folge für die Engine: Der GL-Puffer
(`GLD = new Float32Array(900 * 7)`) muss auf **2760 × 2 × 7** wachsen (×2 wegen der
Bewegungsschweife).

### Neue Formen in der Engine
| Form | Aufbau | Bewegung |
|---|---|---|
| `hand` | gezeichnete offene Hand (Handfläche, Daumenballen, 4 Finger mit 3 Gliedern, Daumen), Gitter mit 460 Punkten | dreht um das Handgelenk, `sin(2π · 1,44 Hz · t)`, Ausschlag 19°, kein Nachpeitschen, leichtes Rollen |
| `text_*` | Space Grotesk 700, Gitter Abstand 5,5 (im 640er-Raster), Punktgröße 1,6 | entsteht **aus der Mitte** nach außen, Lichtlauf 100 %, Flackern 40 %, keine Welle |
| `heart` | gefülltes Herz (klassische Herzkurve), Gitter mit 460 Punkten | Lub-Dub 72 bpm, Schlagstärke 30 %, bei jedem Schlag Lichtwelle 150 % vom Kern zum Rand |
| `cross` | zwei abgerundete Balken (160 × 36), Gitter mit 460 Punkten | rot, Schütteln 24 px, 3,5 Schwingungen gedämpft, Dauer 1,3 s |
| `wifi` | drei Bögen + Punkt, Schrägstrich mit Lücke, Gitter mit 460 Punkten | orange; Licht läuft 2× durch die Bögen, ab 1,0 s zeichnet sich der Strich, danach etwas dunkler |
| `frame` | abgerundetes Rechteck, das vom Kreis (Dots Box) zur Display-Kontur wächst | für das Portal, siehe Erfolg |

Texte (de/en): „Willkommen im Health Hub“ / „Welcome to Health Hub“, „Willkommen zurück“ /
„Welcome back“, „Hey, ich bin Dot“ / „Hey, I'm Dot“.

### Eingestellte Werte (vom Nutzer im Mockup getunt)
```json
{
 "intro":  { "v": "zufall", "dauer": 1, "wirbel": 1, "groesse": 2 },
 "kugel":  { "drehung": 0.6, "atmen": 2.5, "licht": 2.5, "puls": 2.5 },
 "trans":  { "tempo": 1, "nachschwingen": 0.6, "staffel": 0.35, "wirbel": 1, "ablauf": 1 },
 "hand":   { "v": "winken", "freq": 1.44, "ausschlag": 19, "peitsche": 0, "dauer": 2.6 },
 "text":   { "v": "mitte", "dauer": 2.2, "licht": 1, "welle": 0, "funkeln": 0.4, "dichte": 5.5, "groesse": 1.6 },
 "herz":   { "v": "gefuellt", "bpm": 72, "schlag": 0.3, "licht": 1.5, "dauer": 2.4 },
 "ziehen": { "rueckkehr": 1, "warten": 450, "abprall": 0.42, "gelee": 2 },
 "fehler": { "v": "schuetteln", "dauer": 1.3, "staerke": 24, "rot": 1 },
 "erfolg": { "v": "portalheim", "denken": 1, "haken": 0.8, "tempo": 0.6 }
}
```
Wie jeder Wert wirkt, steht im Mockup in `updateTargets`, `physics` und `body`.
**Kugelwerte (entschieden, Nutzer 27.10.):** Drehung 0,6, Atmen/Licht/Puls 250 % gelten
**überall in der App**, nicht nur im Login. **Ausnahme:** Klebt Dot an einer Wand oder Ecke
(angeheftet wie in der App, `B.flat`/Andock-Zustand), gelten dort die bisherigen ruhigen
Werte (Drehung 0,16, Atmen/Licht/Puls 100 %). Zwischen beiden weich überblenden, im selben
Maß, in dem er sich an die Wand anlegt.

---

## 3. Umsetzung in der App

### 3.1 Engine (`src/features/dot/engine/dotEngine.ts`)
- Neue Formen aus Abschnitt 2 in `shapeTarget` ergänzen. Die Silhouetten werden einmal auf
  einer Offscreen-Canvas gezeichnet und abgetastet (Mockup: `sampleShape`, `drawHand`,
  `drawHeart`, `drawWifiOff`, `drawLines`). Ergebnis cachen, bei Sprachwechsel Text neu bauen.
- Kind-Punkte für Text und Eröffnung (siehe 2.), Puffer vergrößern.
- Fehlerfarbe: ein Mischwert `tint` (0…1) zur Farbe `BAD` oder `WARN`, auch für das Glühen.
- Schütteln als seitlicher Versatz aller Ziele (`shakeX`).
- Eröffnung: Startpunkte auf der Display-Kontur, vier Varianten (Freigabe-Reihenfolge,
  Startgeschwindigkeit, Wirbelkraft, Schwerkraft bei Regen), siehe `startIntro` und `physics`.
- Portal: Form `frame` plus `clip-path` auf dem App-Container, synchron pro Frame.
- Heimflug: Es gibt schon `heimgehen()`. Prüfen, ob sich der Bogenflug mit Schrumpfen
  (Mockup: `B.mode = 'fly'`) dort als neue Eintritts-Art einhängen lässt, statt einen zweiten
  Weg zu bauen.
- Rand: Ecken-Rundung beim Begrenzen der Punkte (Mockup: in `physics`, `cornRad`).

### 3.2 Ein Dot für Login und App (entschieden, Nutzer 27.10.)
**Der Dot im Login ist derselbe Dot wie in der App.** Es gibt keine zweite Instanz.
Heute hängt `DotLayer` in `Layout` (nur mit Nutzer, nur unter `/`). Er wandert deshalb
**über die Routen**, in `App.tsx` neben `<Routes>`, und lebt auch auf `/auth`:
- Auf `/auth` steht Dot auf seiner Login-Bühne über dem Formular (`oeffneBuehne(el)` gibt es
  schon). `leiste()` liefert dort `null`, die Engine muss das vertragen.
- Ohne Nutzer: kein Chat, kein Auto-Tracking, kein Kontext-Laden. Die Hooks in `DotLayer`
  brauchen dafür eine Login-Betriebsart (`useAuth().user` ist dort `null`).
- Erfolg: Haken → Portal → Zusammenfinden passieren auf `/auth`. Dann `navigate('/')`, die
  Startseite mit Leiste erscheint, und **dieselbe Instanz** fliegt ohne Schnitt in ihren Platz
  in der Leiste (`[data-tyd-slot="dot"]`). Danach gilt er als „drinnen“ (`dotStore`).
- Der Routenwechsel darf die Engine nicht neu anlegen (Effekt in `DotLayer` läuft heute
  einmal pro Mount, das bleibt so, solange der Layer oberhalb der Routen hängt).
- Abmelden: Dot verlässt die Leiste wieder und geht auf die Login-Bühne.

### 3.3 `src/pages/Auth.tsx`
- Drei Ansichten: `start`, `login`, `register`, mit Übergang (von rechts hinein, zurück von links).
- Validierung im Gerät wie in Abschnitt 1 (Regeln: `^[A-Za-z0-9._]{3,20}$` für Benutzernamen;
  mit `@` muss es eine gültige E-Mail sein).
- Supabase:
  - E-Mail + Passwort: `supabase.auth.signInWithPassword` (wie heute).
  - **Benutzername + Passwort:** Supabase meldet nur per E-Mail an. Dafür eine **Edge
    Function**, die Benutzername und Passwort annimmt, die E-Mail serverseitig nachschlägt und
    die Sitzung zurückgibt (Client: `supabase.auth.setSession`). **Keine** offene Abfrage
    „Benutzername → E-Mail“, das würde E-Mail-Adressen preisgeben. Bei unbekanntem Namen
    dieselbe Antwort wie bei falschem Passwort.
  - Registrieren: `supabase.auth.signUp`, Benutzername wie heute in `profiles` speichern.
    Benutzername vorher auf Eindeutigkeit prüfen.
  - Apple: nativer Login per Capacitor-Plugin, dann `supabase.auth.signInWithIdToken({ provider: 'apple', … })`.
  - Google: entsprechend mit `provider: 'google'`.
  - **Apple- und Google-Knöpfe nach den offiziellen Vorgaben** (Logo, Text, Farben). Im
    Mockup sind es Platzhalter ohne Logos. Wer Google anbietet, muss für den App Store auch
    Apple anbieten.
- Fehler zuordnen: ungültige Zugangsdaten → `falsch`; Netzfehler (`navigator.onLine === false`,
  `AuthRetryableFetchError`, fehlgeschlagener `fetch`) → `netz`; alles im Gerät → `leer`.
- **Angemeldet bleiben:** Wert speichern. Ist er aus, beim nächsten App-Start
  `supabase.auth.signOut({ scope: 'local' })`, bevor die Route entschieden wird.
- **Face ID:** Nur anzeigen, wenn es eingerichtet ist. Einrichten nach dem ersten normalen
  Login (Nachfrage), Refresh-Token sicher im Schlüsselbund ablegen (Biometrie-Plugin für
  Capacitor). Antippen: Face ID → Token holen → `setSession` → derselbe Erfolgsablauf.
- Login nur ohne Sitzung: `/auth` leitet mit Sitzung sofort auf `/` um.
  `ProtectedRoute` und `ConsentGate` prüfen, ob das schon so ist.
  Die Einwilligung beim Registrieren ersetzt `ConsentGate` nicht; Doppelabfrage vermeiden.
- Haptik: Erfolg und Fehler mit `Haptics.notification` (`@capacitor/haptics` ist installiert,
  `src/lib/haptics.ts` hat `hapticTick`).

### 3.4 Texte
**Nur `de` und `en` bearbeiten** (Regel in `CLAUDE.md`). Neue Schlüssel bekommen in den
zwölf anderen Sprachen den englischen Text als Platzhalter, sonst schlägt der i18n-Test fehl.
Alle Texte stehen im Mockup im Objekt `i18n` (de und en).

### 3.5 Bewegung reduzieren
Bei `prefers-reduced-motion`: keine Eröffnung, keine Partikelflüge. Dot steht still als
Kugel, Formwechsel ohne Flug, Fehler nur Farbe ohne Schütteln, Erfolg als schlichter
Seitenwechsel. Die Sätze unter den Feldern bleiben.

---

## 4. Reihenfolge

1. `graphify query` zur Orientierung (Engine, DotLayer, Auth, Routing).
2. Engine: Formen hand, heart, cross, wifi (nur 460 Punkte) und Fehlerfarbe. Auf dem Gerät prüfen.
3. Login-Bühne + neue `Auth.tsx` (Ansichten, Validierung, Fehlerfälle) mit E-Mail-Login.
4. Kind-Punkte, Text-Formen, Eröffnung.
5. DotLayer über die Routen heben (3.2), dann Erfolg: Haken → Portal → Zusammenfinden → Heimflug derselben Instanz.
6. Sitzung merken, Benutzername-Login (Edge Function), Apple, Google, Face ID.
7. Prüfen: `code-review`, `security-review` (Auth!), `graphify update .`.

**Auf einem echten iPhone testen**, vor allem: flüssig bei 2760 Punkten, Ecken-Radius
(im Mockup fest 48 px), Dauer des Erfolgs, Tastatur über dem Formular.

Passende Skills im Repo: `animate`, `emil-design-eng`, `animation-performance`,
`mobile-native`, `break-ui` (lange Benutzernamen, kleine Displays).

---

## 5. Prompt für Claude Code

> Setz den neuen Login nach `docs/login/UEBERGABE.md` um. Das Verhalten steht in
> `docs/login/mockup.html` (im Browser öffnen, unten „Feinschliff“ zeigt jede Animation
> einzeln). Arbeite die Reihenfolge aus Abschnitt 4 ab und halte nach jedem Schritt an,
> damit ich auf dem iPhone teste. Wenn etwas in der Engine anders gebaut ist, als die
> Übergabe annimmt (z. B. Bühne ohne Leiste, Heimflug), fragst du mich, bevor du umbaust.
