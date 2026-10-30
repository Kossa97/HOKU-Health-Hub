# Hoku führt durch Anmelden und Registrieren — Bauplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hoku (im Code noch „Dot“) begrüßt, führt bei Untätigkeit zum nächsten Feld oder Knopf und reagiert mit neuen Emotes auf jede Situation der Login-Seite — ohne „Passwort vergessen“.

**Architecture:** Erst ein Mockup aller neuen Emotes, der Nutzer wählt (harte Wartestelle). Danach drei Schichten: reine Zeitlogik für Hinweise (`hinweise.ts`, testbar ohne DOM), neue Gesten in `gesten.ts` plus zwei Engine-Fähigkeiten (zu einem Element schweben und kreisen; klopfen), und die Verdrahtung in `Auth.tsx`.

**Tech Stack:** React 19 + TypeScript, Canvas-Partikel-Engine (`src/features/dot/engine`), Vitest, Playwright (Edge über `PLAYWRIGHT_CHROMIUM_PATH`, Projekte iphone-13, iphone-se, pixel-7).

**Spec:** `docs/superpowers/specs/2026-10-29-hoku-login-fuehrung-design.md` — Nummern wie „#5“ beziehen sich auf die Situationen dort. Abschnitt „Passwort vergessen“ wird **nicht** gebaut.

## Global Constraints

- Hokus Sätze stehen in `src/features/dot/texte.ts` nur in `de` und `en`; höchstens zwei Zeilen, getrennt durch `\n`. Wortlaut exakt aus der Spec.
- Neue Schlüssel in `src/i18n/locales/*.json` (falls nötig) bekommen in den zwölf übrigen Sprachen den englischen Text, sonst nichts.
- Code, Dateien, Typen heißen weiter `dot`/`Dot`; nur sichtbare Texte sagen „Hoku“.
- Bei Fehlern schreibt Hoku keinen Text; die Zeile unter dem Formular bleibt wie heute.
- Hinweise: erster nach 10 s Stille (Startseite: 6 s und weitere 6 s), **ein Hinweis je Stille**, nach 30 s ab Beginn der Stille einmal Klopfen, danach Ruhe. Jede Eingabe/Fokus/Antippen bricht ab und startet die Stille neu.
- Weniger Bewegung: kein Schweben, Klopfen, Emote; Sätze und Hinweise erscheinen als sichtbarer `satz`-Text.
- Nach jeder Codeänderung `graphify update .`, Graph in eigenem Commit; Commit-Trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; Push nur auf `login-dot-wand`. Android-Gradle-Änderungen nicht committen.

## Review Focus

1. **Tippen mitten im Hinweis:** Hoku ist unterwegs zum Feld, die Person tippt → er bricht sofort ab und federt zur Bühne, kein Satz hängt nach. (Task 4, Task 7)
2. **Tastatur offen / Ziel verschoben:** Das Zielfeld liegt hinter der Tastatur oder wurde gescrollt → Hoku kreist um die aktuelle Lage oder lässt den Hinweis aus, wenn das Ziel nicht sichtbar ist. (Task 4)
3. **Ansicht wechselt während Hinweis/Emote** (Zurück-Pfeil, Registrieren): das Ziel-Element verschwindet → kein Fehler, Hoku kehrt zurück, Uhren der alten Ansicht laufen nicht weiter. (Task 7)
4. **Sprache umstellen während Hoku schreibt:** der Satz wird in der neuen Sprache neu geschrieben, kein Mischtext. (Task 7)
5. **Doppeltes Absenden während des Wartens:** kein zweites Warten-Emote, Monde/Variante laufen einmal. (Task 7)

---

## Teil A — Mockup (Wartestelle)

### Task 1: Mockup „Hoku führt“ mit allen neuen Emotes

**Files:**
- Modify: `C:\Users\Devin\AppData\Local\Temp\claude\C--Users-Devin-peptid-tracker\5c33684a-b870-4d37-8bb2-745ef5500c0d\scratchpad\dot-auftritte.html` (vorher Sicherung `dot-auftritte.v7.html`)
- Publish: https://claude.ai/artifact/Ab6uRmqzVNDBHgBDRYbnS5 (gleiche Datei, neue Version)

**Interfaces:**
- Produces: die Wahl des Nutzers je Gruppe, eingetragen in `memory/projects/login.md` und als `[Nutzer]` in der Spec.

- [ ] **Step 1:** Neue Gruppe „Hoku führt“ im Mockup, gleiche Bühnen (390×844, Login-Hintergrund), gleiche Hilfen (`kugel`, `haken`, `misch`, `einaus`). Kacheln:
  - Freude **F1** zweimal hüpfen, Drehung, Funken · **F2** Freudensprung mit Strecken (Kugel wird kurz Ellipse) · **F3** Funkenregen aus der Oberseite
  - Warten **W1** drei Monde schräg im Orbit, Hoku etwas kleiner/dunkler, bei „Antwort“ schnappen sie zurück · **W2** Lichtwelle läuft um die Oberfläche · **W3** Grübeln: leichtes Neigen, Punktwolke steigt und sinkt
  - Augen zuhalten (zwei Kegelarme vors „Gesicht“, leicht gedreht) mit Umschalter „Passwort anzeigen“ → ganz weggedreht
  - Haken aus Hoku (wächst heraus wie das Herz, wird grün, sinkt zurück, danach Ring → Portal wie S5)
  - X aus Hoku (gleich, rot)
  - Klopfen „Noch da?“ (nach vorn, größer, 2–3 Klopfer mit Plattdrücken und Lichtring)
  - Sanduhr „Kurz durchatmen“, Briefumschlag „Schau in dein Postfach!“, Schulterzucken, Nicken, Kopfschütteln
  - Hinweis: Satz → Kugel → eine Runde um einen Knopf, Knopf leuchtet → zurück; zweimal gezeigt mit Startknöpfen **K1** heute (untereinander) und **K2** auseinander mit „oder“
- [ ] **Step 2:** Im Edge mit gepausierter Uhr je Kachel ein Bild an zwei Zeitpunkten ansehen (Skript wie `mock-s5.cjs`), keine Konsolenfehler.
- [ ] **Step 3:** Veröffentlichen, dem Nutzer den Link und je Gruppe die Frage geben. **Hier anhalten, bis der Nutzer gewählt hat.** Wahl in Spec und `memory/projects/login.md` eintragen, committen.

---

## Teil B — Bau (erst nach der Wahl)

### Task 2: Hokus Sätze

**Files:**
- Modify: `src/features/dot/texte.ts` (Block „Anmeldung“, de ~Z. 67, en ~Z. 179)
- Test: `src/features/dot/texte.test.ts`

**Interfaces:**
- Produces: `DotTextKey`s `login_hub` (neu formuliert), `login_hey` (neu formuliert), `login_zurueck_1|2|3`, `login_start_anmelden`, `login_start_registrieren`, `login_noch_da`, `login_moment`, `login_online`, `login_durchatmen`, `login_postfach`, `login_tipp_email`, `login_tipp_passwort`, `login_tipp_anmelden`, `login_tipp_name`, `login_tipp_reg_email`, `login_tipp_reg_passwort`, `login_tipp_passwort2`, `login_tipp_zustimmung`, `login_tipp_konto`. `login_zurueck` entfällt (ersetzt durch `_1`).

- [ ] **Step 1: Failing test** `'Hokus Login-Sätze: höchstens zwei Zeilen, de und en vollständig'` — für jeden Schlüssel, der mit `login_` beginnt: `dotText('de', k).split('\n').length <= 2`, ebenso `en`, und `Object.keys(DOT_TEXTE.de)` gleich `Object.keys(DOT_TEXTE.en)`; dazu `expect(dotText('de','login_hub')).toBe('Hi! Willkommen\nbei Hoku')`, `expect(dotText('en','login_hey')).toBe("Hey, I'm\nHoku!")`.
- [ ] **Step 2:** `npx vitest run src/features/dot/texte.test.ts` → FAIL.
- [ ] **Step 3:** Texte eintragen, Wortlaut je Schlüssel aus den Tabellen der Spec (#1, 2, 3, 3b, 4, 5, 7, 14, 15, 19, 20, 23); `/` der Spec = `\n`. Beispiel `login_zurueck_2`: de `'Schön, dich\nwiederzusehen!'`, en `'Good to see\nyou again!'`. `Auth.tsx` auf neue Schlüssel umstellen (`SAETZE` um alle neuen Sätze erweitern, damit `bereiteTexte` sie vorab abtastet).
- [ ] **Step 4:** Test → PASS; `npx tsc --noEmit -p tsconfig.app.json` ohne Fehler.
- [ ] **Step 5:** Commit „Login: Hokus Sätze“.

### Task 3: Zeitlogik der Hinweise

**Files:**
- Create: `src/features/auth/lib/hinweise.ts`
- Test: `src/features/auth/lib/hinweise.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type HinweisZiel = 'start-anmelden' | 'start-registrieren' | LoginFeld | RegFeld | 'absenden'
  export type HinweisSchritt = { art: 'hinweis'; ziel: HinweisZiel; text: DotTextKey } | { art: 'klopfen' }
  export interface Stille { ansicht: 'start' | 'login' | 'register'; seit: number; gezeigt: number; geklopft: boolean }
  /** Was jetzt fällig ist (oder null) — `jetzt` und `seit` in ms. */
  export function faellig(s: Stille, jetzt: number, leer: HinweisZiel | null): HinweisSchritt | null
  export const HINWEIS_MS = { start: [6000, 12000], form: 10000, klopfen: 30000 }
  /** Erstes leeres Ziel in Lesereihenfolge, sonst 'absenden'. */
  export function erstesLeeres(felder: Partial<Record<LoginFeld | RegFeld, boolean>>, reihenfolge: (LoginFeld | RegFeld)[]): HinweisZiel
  ```
  Aufrufer erhöht `gezeigt` bzw. setzt `geklopft` nach jedem gelieferten Schritt; jede Eingabe setzt `seit = jetzt, gezeigt = 0, geklopft = false`.

- [ ] **Step 1: Failing tests**
  - `'Start: Anmelden nach 6 s, Registrieren nach 12 s, Klopfen nach 30 s, dann nichts'`: `faellig({ansicht:'start',seit:0,gezeigt:0,geklopft:false}, 5999, null)` → `null`; `…, 6000` → `{art:'hinweis', ziel:'start-anmelden', text:'login_start_anmelden'}`; mit `gezeigt:1` bei 12000 → `ziel:'start-registrieren'`; mit `gezeigt:2` bei 29999 → `null`, bei 30000 → `{art:'klopfen'}`; mit `geklopft:true` bei 600000 → `null`.
  - `'Formular: genau ein Hinweis je Stille'`: login, `gezeigt:0`, 10000, leer `'passwort'` → `text:'login_tipp_passwort'`; `gezeigt:1` bei 25000 → `null`; bei 30000 → `klopfen`.
  - `'Registrieren: Text je Ziel'`: `benutzer`→`login_tipp_name`, `email`→`login_tipp_reg_email`, `passwort`→`login_tipp_reg_passwort`, `passwort2`→`login_tipp_passwort2`, `zustimmung`→`login_tipp_zustimmung`, `absenden`→`login_tipp_konto`.
  - `'erstesLeeres folgt der Lesereihenfolge'`: `erstesLeeres({kennung:true,passwort:false},['kennung','passwort'])` → `'passwort'`; alle gefüllt → `'absenden'`.
- [ ] **Step 2:** `npx vitest run src/features/auth/lib/hinweise.test.ts` → FAIL.
- [ ] **Step 3:** Implementieren (reine Funktionen, keine Uhr, kein DOM).
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5:** Commit „Login: Zeitlogik der Hinweise“.

### Task 4: Engine — zu einem Element schweben und kreisen, klopfen

**Files:**
- Modify: `src/features/dot/engine/dotEngine.ts` (Interface `DotApi` ~Z. 55, Login-Modus `B.login`, `portalSchritt` als Vorbild für Skriptbewegung)
- Modify: `src/features/dot/dotStore.ts` nur falls die API dort durchgereicht wird
- Test: `e2e/login.spec.ts`

**Interfaces:**
- Produces in `DotApi`:
  ```ts
  /** Schwebt als Kugel zu `el`, eine Runde um dessen Rechteck (Abstand 14 px), zurück zur Bühne. Resolved true, wenn die Runde fertig war, false bei Abbruch/Ziel unsichtbar. */
  umkreise(el: HTMLElement): Promise<boolean>
  /** Nach vorn, größer, 2–3 Klopfer gegen die Scheibe, zurück. */
  klopfe(): Promise<boolean>
  /** Bricht umkreise/klopfe sofort ab; Hoku federt zur Bühne. */
  stoppeAuftritt(): void
  ```
  Während des Kreisens setzt die Engine `el.dataset.dotZiel = 'an'` (Leuchten per CSS in Task 8) und entfernt es am Ende.
- Werte: Hinweg 0,55 s, Runde 1,1 s, Rückweg wie `LOGIN.rueckK`-Feder; Klopfen: Weg nach vorn 0,4 s, Größe ×1,6, drei Klopfer im Abstand 0,28 s, je Klopfer Plattdrücken 0,12 s und Lichtring (Kreis, 0,5 s auslaufend). Vibration: leichter Impuls je Klopfer über das Modul, aus dem `Auth.tsx` `hapticErgebnis` holt; fehlt dort ein leichter Impuls, dort `hapticTipp(): Promise<void>` ergänzen.
- Produces in `geometry.ts`: `umkreisBahn(rect: {l:number;t:number;r:number;b:number}, abstand: number, u: number): [number, number]` — Punkt der Runde bei `u ∈ [0,1]`, Start/Ende oben in der Mitte.

- [ ] **Step 1: Failing test** in `src/features/dot/engine/geometry.test.ts`: `'umkreisBahn: geschlossen, 14 px Abstand zum Rechteck'` — `umkreisBahn(r,14,0)` gleich `umkreisBahn(r,14,1)` (±0,01); für u in 0…1 (Schritt 0,05) ist der Abstand zum Rechteck `rahmenAbstand`-artig gemessen 14 ± 1,5.
- [ ] **Step 2:** `npx vitest run src/features/dot/engine/geometry.test.ts` → FAIL.
- [ ] **Step 3:** Implementieren: `umkreisBahn`; neuer Login-Unterzustand `'auftritt'` mit Hinweg (Bézier), Runde (`umkreisBahn` um das bei jedem Bild neu gemessene `getBoundingClientRect()`), Rückweg; liegt das Rechteck außerhalb des sichtbaren Bereichs (Viewport bzw. hinter der Tastatur, `ueberTastatur()`), sofort `false`; ist `el` nicht mehr im Dokument, abbrechen mit `false`. `stoppeAuftritt` auch bei Ziehen/Werfen (#27). `klopfe` analog.
- [ ] **Step 4:** Test → PASS; `npx tsc --noEmit -p tsconfig.app.json` sauber. (Das Verhalten in der Seite prüfen die E2E-Tests in Task 7.)
- [ ] **Step 5:** Commit „Login-Dot: zu Knöpfen schweben und kreisen, klopfen“.

### Task 5: Haken und X wachsen aus Hoku

**Files:**
- Modify: `src/features/dot/engine/gesten.ts` (Haken), `src/features/dot/engine/dotEngine.ts` (flaches X `kreuzFlach`, `erfolg()` Anfang)
- Test: `src/features/dot/engine/gesten.test.ts`

**Interfaces:**
- Consumes: Herz-Ablauf in `gesten.ts` (`wachsen`, `rein`) als Vorbild.
- Produces: `HAKEN_GRUEN` bleibt exportiert; neue Konstante `export const HAKEN_ZURUECK = 0.45` (s, Zurücksinken); `erfolg()` beginnt mit Phase `'ring'` erst, nachdem der Haken zurückgesunken ist (Auth wartet wie heute `ZEIGEN.haken`, plus `HAKEN_ZURUECK * 1000`).

- [ ] **Step 1: Failing test** `'Haken wächst aus Dot und sinkt zurück'`: bei t=0 alle Punkte innerhalb Radius 1,05; bei t=HAKEN_GRUEN.ab+HAKEN_GRUEN.dauer ein Teil (≥ 40 %) außerhalb Radius 1,05 nach vorn (z > 0); am Ende (Gestendauer) wieder alle innerhalb 1,05.
- [ ] **Step 2:** `npx vitest run src/features/dot/engine/gesten.test.ts` → FAIL.
- [ ] **Step 3:** Haken und flaches X wie das Herz aufbauen (aus der Kugel heraus nach vorn, Farbe wie heute, zurück in die Kugel). Fehler A und C unverändert.
- [ ] **Step 4:** Test → PASS; e2e `login.spec.ts` (alle drei Projekte) grün, Zeit im Erfolgstest ggf. anpassen.
- [ ] **Step 5:** Commit „Login-Dot: Haken und X wachsen aus ihm heraus“.

### Task 6: Neue Emotes

**Files:**
- Modify: `src/features/dot/engine/gesten.ts` (`DotForm`, `gestenBild`, Aufwärmen), `src/features/dot/engine/dotEngine.ts` (`FORM_LOOK`, Dauer je Form)
- Test: `src/features/dot/engine/gesten.test.ts`

**Interfaces:**
- Produces: `DotForm` erweitert um `'freude' | 'augen' | 'augenWeg' | 'warten' | 'sanduhr' | 'brief' | 'zucken' | 'nicken' | 'schuetteln'`. `'augen'`/`'augenWeg'`/`'warten'` laufen, bis `zeigeForm(null)` oder eine andere Form kommt; die übrigen haben feste Dauer `export const FORM_DAUER: Partial<Record<DotForm, number>>` (s). Ausführung je Emote genau nach der Wahl aus Task 1. `'warten'` mit `zeigeForm(null)` beendet: Monde schnappen in 0,2 s zurück (falls W1 gewählt).

- [ ] **Step 1: Failing tests** je Form: `'<form>: alle Punkte endlich, innerhalb Radius 3, Ende = Kugel'` — `gestenBild(form, t, out, wahl)` für t in 0…Dauer, alle Werte `Number.isFinite`, `Math.hypot(x,y) < 3`; für Formen mit fester Dauer bei t=Dauer Abstand zu `KUGEL_FEST` < 0,05 je Punkt.
- [ ] **Step 2:** Test → FAIL.
- [ ] **Step 3:** Formen implementieren; Kegelarme aus `einArm`/`beideArme` wiederverwenden (Augen, Zucken); Partikel aus `flaechenPunkte` (Sanduhr, Brief).
- [ ] **Step 4:** Test → PASS; Aufwärmen baut alle neuen Formen vorab.
- [ ] **Step 5:** Commit „Login-Dot: Freude, Augen zu, Warten, Sanduhr, Brief, Schulterzucken, Nicken“.

### Task 7: Verdrahtung in der Anmeldung

**Files:**
- Modify: `src/pages/Auth.tsx`, `src/features/auth/lib/anbieter.ts` (`Rueckkehr`), `e2e/login.spec.ts`
- Test: `src/features/auth/lib/anbieter.test.ts` (anlegen, falls nicht vorhanden), `e2e/login.spec.ts`

**Interfaces:**
- Consumes: Task 2 (Schlüssel), Task 3 (`faellig`, `erstesLeeres`, `HINWEIS_MS`), Task 4 (`umkreise`, `klopfe`, `stoppeAuftritt`), Task 5, Task 6 (Formen).
- Produces: `Rueckkehr { anbieter; fehler: boolean; abgebrochen: boolean }` — `abgebrochen` bei `error=access_denied` (Query oder Hash), dann `fehler: false`.

- [ ] **Step 1: Failing tests**
  - Unit `'rueckkehr: access_denied ist Abbruch, kein Fehler'`: `rueckkehr('?anbieter=apple&error=access_denied','')` → `{anbieter:'apple', fehler:false, abgebrochen:true}`; `error=server_error` → `fehler:true, abgebrochen:false`.
  - E2E (iphone-13), je mit `page.clock`:
    - `'Start: Begrüßung, dann Hinweise auf Anmelden und Registrieren, Klopfen nach 30 s'` (`data-dot-ziel="an"` erst an `[data-auth-start-login]`, dann an `[data-auth-start-register]`, danach jeweils wieder entfernt; Status-Text `role=status` enthält „Noch da?“ nach 30 s)
    - `'Hinweis bricht ab, wenn die Person tippt'` (Review Focus 1: während `data-dot-ziel="an"` auf `#auth-kennung` tippen → Attribut innerhalb von 200 ms weg)
    - `'Ansicht wechseln während des Hinweises'` (Review Focus 3: Zurück-Pfeil während der Runde → keine Konsolenfehler, kein Hinweis der alten Ansicht danach)
    - `'Doppeltes Absenden zeigt Warten nur einmal'` (Review Focus 5)
    - `'Anmelden: nach 10 s Hinweis aufs leere Passwortfeld, Tippen bricht ab'`
    - `'Anmelden: zweiter Fehlversuch nur Fehlergeste, Zeile wie heute'`
    - `'Registrieren: Name frei → nicken, vergeben → Zeile ohne Absenden'` (Attrappe `mock` liefert vergeben/frei)
    - `'Sprache umstellen schreibt den Satz neu'` (Status-Text wechselt von de nach en)
- [ ] **Step 2:** Tests → FAIL.
- [ ] **Step 3:** Implementieren:
  - Eine Stille-Uhr je Ansicht (`useRef<Stille>`), ein `setInterval` 250 ms ruft `faellig`; Hinweis = `schreibe(satz)` → `umkreise(ziel)`; Klopfen = `klopfe()` → `schreibe('login_noch_da')`. Jede Eingabe (`tippe`, Fokus, Klick, Ziehen) setzt die Stille zurück und ruft `stoppeAuftritt()`.
  - #4: Satz per Zufall aus `login_zurueck_1..3`, nie zweimal derselbe, dann `zeigeForm('freude')`. #19: `login_hey`, dann Freude.
  - #6/#21: Fokus im Passwortfeld → `zeigeForm(zeigePw ? 'augenWeg' : 'augen')`, Verlassen → `zeigeForm(null)` (ersetzt `setStimmung('listen')`).
  - #7: beim Absenden `zeigeForm('warten')`; nach 4 s ohne Antwort `schreibe('login_moment')`; Antwort → `zeigeForm(null)`, dann wie heute.
  - #14: `online`-Ereignis, solange die Kein-Netz-Meldung steht → `schreibe('login_online')`, Knopf `data-dot-ziel` kurz an.
  - #15: `viele` → `zeigeForm('sanduhr')` + `login_durchatmen` beim ersten Mal, danach nur Sanduhr.
  - #16: Apple/Google → `zeigeForm('hand')` 0,6 s, dann `mitAnbieter`. #17/#18: `abgebrochen` → `zeigeForm('zucken')`, keine Meldung.
  - #21: Name live: 500 ms nach letztem Tastendruck, nur wenn `BENUTZERNAME.test(name)`, `benutzernameFrei(name)` → `true` nicken, `false` schütteln + Zeile `login_err_user_taken` (Feld `benutzer`), `'netz'`/`null` nichts. Antwort verwerfen, wenn der Name sich inzwischen geändert hat.
  - #22: `login_err_exists` → danach `umkreise` um den Weg zum Anmelden (Zurück-Pfeil bzw. Tab).
  - #23: Haken, dann `zeigeForm('brief')` + `login_postfach`.
  - #25: `wechsle` setzt die Stille der neuen Ansicht neu. #26: `useEffect` auf `i18n.language`: steht gerade ein Satz, `dot()?.zeigeText(dt(satz))` neu.
  - Weniger Bewegung: statt `umkreise`/`klopfe` nur `setSatz(key)`.
- [ ] **Step 4:** Unit + `npx playwright test e2e/login.spec.ts --project=iphone-13 --project=iphone-se --project=pixel-7` → alles grün (bestehende 27 Tests eingeschlossen).
- [ ] **Step 5:** Commit „Login: Hoku führt (Hinweise, Emotes, Abbruch statt Fehler, Name live)“.

### Task 8: Startknöpfe und Leuchten

**Files:**
- Modify: `src/features/auth/auth.css` (`.tyd-auth-knopf` ~Z. 63), `src/pages/Auth.tsx` (Startansicht ~Z. 402)

- [ ] **Step 1:** Abstand der Startknöpfe nach Wahl K1/K2 aus Task 1; `[data-dot-ziel='an']` leuchtet leise (Rand/Schein in den bestehenden Login-Farben, 0,2 s ein, 0,4 s aus, `prefers-reduced-motion`: ohne Übergang).
- [ ] **Step 2:** Bilder im iPhone-13- und iPhone-SE-Format (temporäre Spec wie `zz-s5.tmp.spec.ts`, danach löschen) ansehen: Hokus Runde schneidet den anderen Knopf nicht.
- [ ] **Step 3:** Commit „Login: Startknöpfe auseinander, Ziel leuchtet“.

### Task 9: Abschluss

- [ ] `npx vitest run` komplett grün, `npx eslint` auf geänderten Dateien sauber.
- [ ] `/code-review` auf den Branch, Befunde beheben.
- [ ] `memory/projects/login.md`: Stand „Hoku führt“ eintragen, „Passwort vergessen“ als offenen Punkt mit den drei offenen Fragen (Code statt Link, SMTP, E-Mail-Bestätigung).
- [ ] `graphify update .`, Graph-Commit, Push auf `login-dot-wand`; dem Nutzer berichten mit Bildern der wichtigsten Momente.
