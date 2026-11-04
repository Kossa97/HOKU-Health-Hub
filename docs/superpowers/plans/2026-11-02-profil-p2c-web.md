# Profil, Teilprojekt 2c: Web-Vorschau, Link-Karte und Hoku-Code — Bauplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/u/<name>` zeigt ohne Anmeldung eine feste Seite mit den Feldern auf „Alle“ (ohne Blut, Einnahmen, Berichte; Bio nur nach Textprüfung), geteilte Links erscheinen im Chat als Karte A/C/neutral, das Profil lässt sich über ein Sheet mit lesbarem Hoku-Code teilen, Abzeichen sind je Abzeichen fürs Web schaltbar, und installierte Apps öffnen den Link direkt.

**Architecture:** Filter nur auf dem Server: `profile_view` bekommt in der Stufe `web` eine feste Feldliste, beschnittene Bereiche, gefilterte Abzeichen (`profiles.web_badges`, Abweichungen vom Standard) und nur die Berichtezahl. Zwei Vercel-Funktionen (`api/u.js` für HTML mit Meta-Tags, `api/og.js` für das 1200×630-Bild) rufen `profile_view` mit dem anon-Schlüssel auf, nie mit der Dienstrolle. Der Hoku-Code ist ein selbst gezeichnetes SVG aus einer QR-Matrix (`qrcode-generator`, Fehlerkorrektur H), gelesen in Tests mit `zxing-wasm`. Deep Links über Universal Links / App Links und `@capacitor/app`.

**Tech Stack:** wie 2a/2b (React 19 + TS, Vitest, Playwright-Mock, Supabase), dazu Vercel Node-Funktionen (`api/`, JS wie `send-reminders.js`), `@resvg/resvg-js` (wird `dependency`), `qrcode-generator`, `zxing-wasm` (vorhanden), `@capacitor/app` (neu).

**Spec:** `docs/superpowers/specs/2026-11-02-profil-p2c-web-design.md`. Mockup: `docs/profil/mockups/profil-2c.html` (Web-Vorschau und 404; „Abzeichen im Web“; Hoku-Code im Sheet und Vollbild). Link-Karten freigegeben 03.11.2026: `docs/profil/mockups/profil-2c-karten-auswahl.html` (Spec 3.3), Canva-Vorlage `docs/profil/canva/hoku-link-karten.pptx`. Entscheidungen: `memory/projects/profil.md`, „Teilprojekt 2c geplant“. Baut auf 2b (PR #128) und 2a (PR #119) auf.

## Global Constraints

- Migration als Datei `supabase-profil-p2c-web.sql`, additiv und idempotent; Trockenlauf mit Postgres 16 unter `/var/tmp/…` als `postgres`, Ist-Zustand nach 2a + 2b nachgebaut, **zweimal** laufen lassen, nachzählen. Produktivlauf **nur nach ausdrücklichem Ja**, Reihenfolge 2a → 2b → 2c. Kein `drop`, `truncate`, `delete`/`update` ohne `where`.
- Sichtbarkeit ist eine Sicherheitsgrenze: Web-Inhalte kommen **nur** aus `profile_view` (Stufe `web`). Vercel-Funktionen benutzen nur den anon-Schlüssel; kein `SUPABASE_SERVICE_ROLE_KEY` in `api/u.js`/`api/og.js`.
- Nie im Web, auch nicht in Bild oder Meta-Tags: Gesundheitswerte, Bereiche Blut/Einnahmen, Substanzen, Berichte-Inhalte, Story, Freunde. Bio nur bei „Alle“ und bestandener Textprüfung (`oeffentlicher_text_fehler`).
- 404 identisch für Web-Link aus / privat / unbekannt / ausgeblendet (Status, HTML, Kopfzeilen, Karte).
- Texte nur de/en, übrige zwölf Locales englischer Platzhalter, `i18n.test.ts` grün.
- Nichts deployen, keine Domain-/DNS-/Firewall-Änderung, keine Store-Einreichung ohne den Nutzer.
- Offene Fragen der Spec (Abschnitt „Offene Fragen“) gelten mit ihrer Empfehlung, bis der Nutzer anders entscheidet; Abweichungen im PR nennen.
- Commit-Trailer wie gehabt; `graphify update .` macht der Nutzer lokal.

## Review Focus

1. **Leck Web-Stufe:** Als `anon` liefert `profile_view` in `fields` nur `cover, country, goals, bio, streak, progress, badges, reviews` (je nur bei „Alle“; `profile_web_fields()` hat 8 Einträge, `bio` nur nach `oeffentlicher_text_fehler`, Entscheidung 04.11.) plus Name/Nickname/Bild; `progress` nur `{tier}` (10/20/30/50/75/100, abgerundet; kein `total`, keine `areas`, kein `since`), ohne Web-Bereich oder unter 10 % gar kein `progress`; `badges` nach Web-Freigabe; `reviews` nur `count`. Dazu ein eigenes Objekt `card` (nicht in `fields`): `member_since` nur als Dauer `{unit, n}`, `web_value_count` (beide immer bei Web-Link an), `entry_count` nur mit `progress.tier` und Blut/Einnahmen nur bei `markers`/`adherence` auf „Alle“; dazu `web_indexable`. (Task 1, 2)
2. **Gleiche 404:** aus / privat / unbekannt / ausgeblendet ergeben byte-gleiche Antworten von `api/u.js` und dieselbe neutrale Karte von `api/og.js`. (Task 6)
3. **Keine Dienstrolle, kein zweiter Filter:** Bild und Meta-Tags entstehen nur aus der anon-`profile_view`-Antwort; Profil mit allem auf „Freunde“ → Karte C ohne Fortschritt und ohne Einträge, mit „Seit … dabei“ und „trackt N Werte“ (Entscheidung 04.11.). (Task 6)
4. **Hoku-Code liest:** Adresse dekodiert exakt bei 124 px, 300 px, halber Auflösung, Weichzeichnung, ±10°; längster erlaubter Name. (Task 5)
5. **Deep-Link-Routing:** Die App folgt nur `/u/<name>` mit Nutzernamen-Zeichen; alles andere wird ignoriert. (Task 7)
6. **Escape:** Nutzername/Anzeigename in HTML-Attributen und SVG maskiert; `name`-Parameter außerhalb des Zeichensets → sofort 404. (Task 6)

---

### Task 1: Migration und Trockenlauf (`supabase-profil-p2c-web.sql`)

- [ ] Kopf wie 2b: Zweck, „setzt 2a + 2b voraus“, „2a/2b danach nicht erneut laufen lassen“, Zählungen vor/nach (nur Zahlen).
- [ ] `profiles.web_indexable boolean not null default false` (Spec 7.2, Entscheidung 04.11.).
- [ ] `profiles.web_badges jsonb not null default '{}'` (`add column if not exists`); Grenzfall-Abzeichen (Spec 6.1) ab Werk aus, als eigene Liste `profile_badge_web_borderline()` (8 IDs) neben `profile_badge_web_sensitive()` (10 IDs aus Spec 6.1) — Task 2 braucht deshalb zwei Paritätslisten (`BADGES_WEB_SENSITIVE`, `BADGES_WEB_BORDERLINE`); `profile_web_badges_ok(v)` + Constraint `profiles_web_badges_check` nur wenn nicht vorhanden; `profile_web_fields()` (8, mit `bio`).
- [ ] `profile_view` neu: Stufe `web` mit fester Feldliste, `cover/country/goals/bio` aus `profiles` (`bio` nur nach Textprüfung), `streak/progress/badges/reviews` aus dem bereinigten Schnappschuss; `progress` nur `{tier}` (Stufe abgerundet, in SQL), ohne Web-Bereich oder unter 10 % kein `progress`; `badges` nach `web_badges`/Standard; `reviews` nur `count`; `card` (`member_since` als Dauer, `web_value_count`, `entry_count`) und `web_indexable`; Eigentümer erhält `web_badges` und `web_indexable`.
- [ ] `profile_media_visible`: Titelbild für `anon` bei Web-Link an, nicht privat, `cover = all`, geprüft, Objekt-ID passt.
- [ ] Trockenlauf: Postgres 16 als `postgres` unter `/var/tmp/p2c-…`; Schema aus Basis + P1 + 2a + 2b nachbauen; Probezeilen (Web-Link aus, privat, unbekannt, an mit allem auf „Alle“, an mit allem auf „Freunde“, nur Blut-Bereich, heikle Abzeichen mit und ohne Abweichung); Datei **zweimal** laufen lassen; Proben als `anon` (`set role anon`, leere JWT-Claims) zu Review Focus 1; Zählungen gleich nach beiden Läufen; ungültige `web_badges` (fremde ID, Nicht-Bool) werden abgewiesen.
- [ ] Ergebnis (Zahlen, Proben) im Commit und im Projektgedächtnis. **Anhalten** für das Ja zum Produktivlauf (zusammen mit 2a und 2b, vor dem Merge).

### Task 2: Lib und Filter auf dem Gerät (`badgeIds.ts`, `profileView.ts`)

- [ ] `BADGES_WEB_SENSITIVE` in `src/features/profil/lib/badgeIds.ts`; Paritätstest gegen die SQL-Liste (wie `BADGE_IDS`).
- [ ] `webBadgeEnabled(id, overrides)` und `webBadgeOverrides(set)` (Abweichungen vom Standard bilden, „zurücksetzen“ = `{}`), mit Tests.
- [ ] `parseProfileView` versteht `web_badges`/`web_indexable` (nur Eigentümer) und die Web-Formen (`reviews.count`, `progress.tier`, `card`); unbekannte Schlüssel weiter ignorieren.
- [ ] Schnappschuss schreibt `progress.counts` (Werte je Bereich, die in den Fortschritt eingehen); Grundlage von `card.web_value_count`.
- [ ] Speichern von `web_badges` im Profildienst (Tipp-Reihenfolge wie die Sichtbarkeit aus 2a, Rücksetzen bei Fehler).

### Task 3: Einstellung „Abzeichen im Web“ (`/profil/web-abzeichen`)

- [ ] Eintrag unter Einstellungen › Web-Link; Bildschirm nach Mockup Abschnitt 3: Einleitung, Zähler „Im Web sichtbar x von y verdienten“, Gruppen mit „n/m an“, Zeilen mit Symbol, Name, „verrät Gesundheitsdaten“, verdient/noch nicht, Schalter; „Auf Standard zurücksetzen“; Kasten „Was die Schalter nicht ändern“.
- [ ] Hinweis oben, wenn `badges` nicht auf „Alle“ oder Web-Link aus, mit Sprung zur Einstellung.
- [ ] Komponententest: Standard (heikle aus), Abweichung, Zurücksetzen, Zähler.

### Task 4: Web-Seite `/u/<name>` (`src/pages/PublicProfile.tsx`, `WebAnsicht`)

- [ ] Aufbau nach Spec 1.1 und Mockup: Titelbild, Profilbild, Name, Flagge + Kürzel, @nick, Ziel-Tags, Streak, „In Hoku öffnen“, Berichte-Hinweis (nur `reviews.count > 0`), Gesamtfortschritt nur als „über X %“ aus `progress.tier` (keine Bereiche, kein Ring, keine genaue Zahl; Entscheidung 04.11.), „Seit … dabei“ aus `card.member_since`, Web-Abzeichen, „Was ist Hoku?“, Store-Knöpfe, Impressum/Datenschutz/Profil melden. Bio bei „Alle“, wenn `profile_view` sie liefert (Textprüfung auf dem Server).
- [ ] 404-Seite: „Seite nicht gefunden“ + „Was ist Hoku?“, gleich für alle drei Fälle; angemeldet bleibt die bisherige App-Meldung.
- [ ] „Ansehen als › Web-Link“ zeigt dieselbe Seite.
- [ ] „Profil melden“ ohne Konto nach Entscheidung zu Spec-Frage 8 (Empfehlung: kleines Formular in die bestehende Moderation); bis dahin Link auf die Kontaktadresse im Impressum.
- [ ] e2e (`profil-web.spec.ts`, Supabase-Mock): nur Web-Felder, Bio nur nach Textprüfung, Fortschritt nur als Stufe, keine Bereiche, Abzeichen folgen `web_badges`, 404 gleich.

### Task 5: Hoku-Code und Sheet „Profil teilen“

- [ ] `qrcode-generator` mit exakter Version; `src/features/profil/lib/hokuCode.ts` (Matrix → SVG: Punkte, runde Suchmarken, Aussparung mit App-Symbol ≈ 7 %, Füllpunkte im Verlauf, deterministisch) + Komponente `HokuCode` (`role="img"`, `aria-label`), immer dunkel auf hell.
- [ ] `hokuCode.read.test.ts`: resvg rastert, `zxing-wasm` dekodiert; 124/300 px, halbe Auflösung, Weichzeichnung, ±10°, kürzester/längster Name, Sonderzeichen; Matrix-Abdruck für eine feste Adresse.
- [ ] `src/pages/Profil.tsx`: „Profil teilen“ öffnet das Sheet (Code klein → Vollbild, „Teilen …“, „Link kopieren“, Adresszeile, Statuszeile mit Kartenart und „Ändern ›“, Messenger-Hinweis); „Profil geteilt“ wie bisher.
- [ ] Web-Link aus: Hinweis und Schalter „Web-Link einschalten“; privat: eigener Hinweis.
- [ ] Kein Helligkeits-Knopf (kein Plugin, Spec-Frage 11).
- [ ] e2e (`profil-teilen.spec.ts`): Sheet, Vollbild, Bildschirmfoto dekodieren, Web-Link-aus-Schalter.

### Task 6: Link-Karte (Vercel-Funktionen)

- [ ] `api/_lib/profileCard.js` (+ `.test.js`): Kartenwahl Fortschritt / Rückfall / neutral nach Spec 3.3 (nicht positiv → Rückfall, kein geprüftes Bild → Initiale), „Seit … dabei“ aus `card.member_since` (Dauer kommt fertig aus SQL, nur noch Text bilden), Einträge mit Tausenderpunkt, Fortschrittsstufe aus `progress.tier` (rundet SQL; `progress.tier` da → Fortschrittskarte, sonst Rückfall), Texte de/en für Titel/Beschreibung/Bild, Rückfall-Text per Schalter: Musterfunktion live → „kann Muster finden“, sonst Ersatztext; Fassungs-Hash, Escape, Zeichensatz-Prüfung für `name`, SVG 1200×630 der drei Karten wie im freigegebenen Mockup (Logos weiß neben großem Hoku).
- [x] `profile_view` Stufe `web` liefert dafür zusätzlich `card`: `member_since` als Dauer `{unit, n}`, `web_value_count` (beide immer bei Web-Link an), `entry_count` (nur mit `progress.tier`; Blut/Einnahmen nur bei `markers`/`adherence` auf „Alle“). In Task 1 gebaut (Entscheidungen 04.11.). `web_value_count` braucht `progress.counts` im Schnappschuss (Task 2).
- [ ] `api/u.js`: anon-`profile_view`, gebautes `index.html` (über `functions.includeFiles`) mit Titel, `og:*`, `twitter:card`, `robots noindex` außer bei `web_indexable` (dann ohne); 200/404; `Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=60`, `Vary: Accept-Language`, `X-Robots-Tag: noindex`.
- [ ] `api/og.js`: anon-`profile_view` + Profilbild über Storage (anon), SVG → PNG mit `@resvg/resvg-js` (Schriften im Paket, Lizenz geprüft), `v` veraltet → neutrale Karte, `s-maxage=600`.
- [ ] `vercel.json`: Route `/u/([^/]+)/?` → `/api/u?name=$1` vor dem Rückfall; `functions`-Eintrag für `includeFiles`. `@resvg/resvg-js` nach `dependencies`.
- [ ] Tests der Funktionen mit gemocktem Supabase: byte-gleiche 404 für die vier Fälle (Review Focus 2), „alles auf Freunde“ → C ohne Zahl (Review Focus 3), PNG-Maße, Escape.
- [ ] Datenschutz-Hinweis im Sheet (Messenger speichern Vorschauen) ist in Task 5 drin; hier nur prüfen, dass Meta-Texte und Bild nie mehr als die Karte enthalten.

### Task 7: „In Hoku öffnen“ (Universal Links / App Links)

- [ ] `public/.well-known/apple-app-site-association` und `public/.well-known/assetlinks.json` mit Platzhaltern `<TEAM_ID>` und `<SHA256>` (Werte liefert der Nutzer); `vercel.json`-Route mit `Content-Type: application/json` für die AASA-Datei.
- [ ] iOS: `App.entitlements` mit `com.apple.developer.associated-domains` = `applinks:<domain>`, im Xcode-Projekt eingetragen. Android: `intent-filter android:autoVerify="true"` (`VIEW`, `DEFAULT`, `BROWSABLE`, `https`, Host, `pathPrefix="/u/"`) an `MainActivity`.
- [ ] `@capacitor/app`: `appUrlOpen` → nur `/u/<name>` navigieren (Test für erlaubte und abgewiesene Adressen).
- [ ] Web-Seite: iOS Smart-App-Banner (`apple-itunes-app`, nur wenn App-ID gesetzt), Android-`intent://`-Knopf mit Store-Rückfall, Desktop Store-Knöpfe + Hoku-Code; ohne Store-Adressen → `/auth`.
- [ ] Liste für den Nutzer im PR: Domain, Team-ID, SHA-256 (Play-App-Signatur + Upload/Debug), Store-Adressen, Xcode-Fähigkeit, App-Update in beide Stores, Prüfung nach Deploy (Apple-CDN, `adb shell pm get-app-links`).

### Task 8: Texte, Datenschutz, Tests, Review, PR

- [ ] de/en für alle neuen Schlüssel geschrieben und gegengelesen; zwölf Locales englischer Platzhalter; `i18n.test.ts` grün.
- [ ] Datenschutzerklärung: Abschnitt Web-Link (was öffentlich ist, Vorschau durch Vercel, CDN-Zeiten, Messenger-Zwischenspeicher, `noindex`); `TERMS_VERSION` nach Spec-Frage 13.
- [ ] `npm run lint`, `npm test`, `npm run test:e2e`, `npm run build` grün; `run`-Skill: Web-Seite, 404, Sheet, Vollbild im Browser ansehen; Lesetest einmal mit echtem Handy durch den Nutzer (Spec-Frage 12).
- [ ] `code-review`, `security-review` (Web-Stufe, Funktionen, Deep Links), Befunde beheben.
- [ ] `memory/projects/profil.md` nachziehen (Stand, offene Punkte, juristische Liste aus Spec 7.4).
- [ ] PR gegen `profil-p2b-fortschritt` mit Nutzer-Aufgabenliste (Task 7) und Hinweis: Produktivlauf 2a → 2b → 2c nur nach Ja; kein Merge ohne ausdrückliches „mergen“.
