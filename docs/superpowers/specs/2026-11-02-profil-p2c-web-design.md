# Profil, Teilprojekt 2c: Web-Vorschau `/u/<name>`, Link-Karte und Hoku-Code — Design

Stand 02.11.2026, mit dem Nutzer geplant (Brainstorming und Mockup am 02.11.).
Gehört zu `2026-10-31-profil-social-gesamtbild-design.md` (Abschnitte „Geteilter
Link im Web“ und „Hoku-Code“); baut auf 2a (`2026-10-31-profil-p2a-sichtbarkeit-design.md`,
Abschnitt 4 „Web-Link, Zwischenstand bis 2c“) und 2b
(`2026-11-02-profil-p2b-fortschritt-design.md`) auf. Branch `profil-p2c-web`,
gestapelt auf `profil-p2b-fortschritt`.
Mockup: `docs/profil/mockups/profil-2c.html` (Artefakt
https://claude.ai/artifact/HVnY3jKnAdFug1uSPU8MSj). Entscheidungen:
`memory/projects/profil.md`, Abschnitt „Teilprojekt 2c geplant“.
Markierungen: **[Nutzer]**, **[Claude]** (vorgeschlagen und bestätigt),
**[Claude, ungeprüft]** (gesammelt unter „Offene Fragen“), **[Bauende]**.

## Absicht

Wer sein Profil teilt, gibt einen Link oder einen Code weiter. Im Chat erscheint
eine Karte, die Leute ohne Hoku neugierig macht. Wer sie öffnet, sieht ohne
Anmeldung eine feste Seite mit dem, was auf „Alle“ steht, und kommt von dort in
die App oder in den Store. Gesundheitswerte, Substanzen und Berichte bleiben in
der App. **[Nutzer]**

Erfolg: Mara teilt ihr Profil in WhatsApp. Die Karte zeigt ihr Bild, ihren Namen,
„trackt 9 Werte“ und „über 30 %“ (Fortschrittskarte, 3.3). Ihr Freund ohne Hoku tippt, sieht die Seite mit
Streak, Ziel-Tags, Gesamtfortschritt (Körper, Training, Erholung & Fitness) und
den fürs Web freigegebenen Abzeichen, liest „Was ist Hoku?“ und lädt die App.
Ein Freund mit Hoku landet direkt in der App auf Maras Profil. Schaltet Mara den
Web-Link aus, sieht dieselbe Adresse aus wie jede unbekannte.

## Nicht-Ziele

- Eigener Scanner in der App für den Hoku-Code (kommt mit Freunden, P3). **[Nutzer]**
- Suchmaschinen-Auffindbarkeit der Profile (das Gegenteil ist gewollt, Abschnitt 7).
- Erfahrungsberichte, Story, Freunde, Gesundheitswerte im Web, auch nicht als Anriss. **[Nutzer]**
- Neue Sichtbarkeitsfelder. 2c nutzt die Felder aus 2a/2b und ihre Stufe „Alle“.
- Ring-Code (zurückgestellt, Gesamtbild). **[Nutzer]**

## 1. Web-Vorschau `/u/<name>` ohne Anmeldung

### 1.1 Was die Seite zeigt **[Nutzer]**

Jedes Feld nur, wenn es auf **„Alle“** steht **und** der Web-Link an ist und das
Profil nicht privat ist:

| Teil | Quelle | Regel |
|---|---|---|
| Titelbild | Feld `cover` | nur geprüftes Bild (`cover_status = approved`) |
| Profilbild, Name, Nickname | immer, sobald das Profil gefunden wird (2a) | Bild nur geprüft; Anzeigename nur nach `oeffentlicher_text_fehler` (2a) |
| Flagge mit Kürzel | Feld `country` | |
| Ziel-Tags | Feld `goals` | feste Liste (`profiles_goals_values`), kein Freitext |
| Streak | Feld `streak` | „🔥 41 Tage in Folge dabei“ |
| Gesamtfortschritt | Feld `progress` | Leitzahl und nur die Bereiche **Körper, Training, Erholung & Fitness**; **Blut und Einnahmen nie im Web** **[Nutzer]** |
| Abzeichen | Feld `badges` **und** je Abzeichen fürs Web freigegeben (Abschnitt 6) | nur verdiente |
| Hinweis auf Berichte | Feld `reviews` auf „Alle“ | nur die Anzahl, ohne Inhalt, Titel oder Substanz **[Claude, ungeprüft]** |
| „In Hoku öffnen“ | immer | Abschnitt 5 |
| „Was ist Hoku?“ | immer (auch auf der 404-Seite) | Abschnitt 1.3 |
| Impressum, Datenschutz, Profil melden | immer | Abschnitt 7 |

**Nie im Web** **[Nutzer]**: Gesundheitswerte, Blutwerte, Körperwerte im Einzelnen,
Substanzen, Stack, Einnahmen, Erfahrungsberichte (auch keine Anrisse oder Titel),
Story, Freunde, die Bereiche Blut und Einnahmen, die Aufschlüsselung je Wert.

Weitere Regeln:

- **Bio fällt im Web weg.** 2a zeigte sie als Zwischenstand bei „Alle“; die Liste
  im Gesamtbild und das Mockup („Zeigt nie: … Bio“) enthalten sie nicht.
  **[Claude, ungeprüft]** (Frage 3)
- **Geschlecht-Zeichen und „Mitglied seit“** erscheinen im Web nicht (nicht in der
  Liste des Gesamtbilds). **[Claude, ungeprüft]**
- **Gesamtfortschritt** im Web wie die 2b-Karte (Variante 1: Leitzahl + Balken um
  die Nulllinie), **ohne Ring** (2b: „Kein Ring“ **[Nutzer]**). Das Mockup zeigt
  noch einen Ring; gebaut wird nach 2b. Die Leitzahl ist dieselbe wie in der App
  (Mittel über alle Bereiche); gezeigt werden darunter nur die drei Web-Bereiche,
  ohne „Mittel aus 5 von 5 Bereichen“. **[Claude, ungeprüft]**
- **Schutzregel Gesamtfortschritt:** Zählt keiner der drei Web-Bereiche (die Zahl
  besteht nur aus Blut und/oder Einnahmen), erscheint der Gesamtfortschritt im Web
  nicht; sonst verriete die Leitzahl den Blut- oder Einnahmeverlauf.
  **[Claude, ungeprüft]** (Frage 5)
- Berichte-Hinweis: „12 Erfahrungsberichte und weitere Werte nur in der App.“ Steht
  `reviews` nicht auf „Alle“ oder ist die Anzahl 0, gibt es keinen Satz über
  Verborgenes (v3: „kein Hinweis auf verborgene Bereiche“). **[Claude, ungeprüft]**
- Angemeldete sehen unter derselben Adresse wie bisher die App-Ansicht (2a). Der
  Eigentümer sieht die Web-Seite über „Ansehen als › Web-Link“ (2a, `?als=web`).
- Seite mit `noindex` (Abschnitt 7).

### 1.2 Nicht gefunden: eine Antwort für drei Fälle **[Nutzer]**

Web-Link aus, Profil privat, Name unbekannt (dazu: von der Moderation
ausgeblendet) ergeben **dieselbe** Antwort: HTTP-Status 404, dieselbe Seite
(„Seite nicht gefunden. Unter dieser Adresse gibt es kein Profil zu sehen. Prüf
den Link oder frag nach einem neuen.“ + „Was ist Hoku?“), dieselben Kopfzeilen
(auch `Cache-Control`) und dieselbe neutrale Link-Karte.

Grenzen, offen benannt **[Claude, ungeprüft]**:

- **Antwortzeit:** Die Fälle laufen durch dieselbe Funktion und denselben
  Datenbankaufruf; „unbekannt“ endet nach einer Zeile weniger als „Web-Link aus“.
  Annahme: Der Unterschied liegt im Mikrosekundenbereich und geht im Netz- und
  Funktionsrauschen (Millisekunden) unter. Kein künstliches Warten.
- **Existenz des Namens** ist schon heute ohne Anmeldung prüfbar
  (`benutzername_frei` für die Registrierung, `supabase-login-name.sql`). Die
  gleiche 404 schützt also vor allem, **ob** jemand den Web-Link an hat oder privat
  ist, nicht, ob es das Konto gibt. Das 2a-Ziel „verrät nicht, dass jemand eine
  Peptid-App nutzt“ hängt deshalb zusätzlich an `noindex` und an kurzen Caches.

### 1.3 „Was ist Hoku?“ **[Claude, ungeprüft]**

Ehrlich, ohne Heilsversprechen, ohne Substanz- oder Peptidnamen, ohne Werbung für
Arzneimittel. Text (de) nach dem Mockup:

> **Was ist Hoku?** Hoku ist ein persönliches Logbuch für Training,
> Körpermessungen, Blutwerte und Einnahmepläne, dazu Daten aus Apple Health oder
> Health Connect. Die App zeigt dir, was sich seit deinem eigenen Start verändert hat.
> - Du entscheidest für jedes Feld, wer es sieht. Ab Werk ist fast alles privat.
> - Kein Vergleich mit anderen. Fortschritt heißt bei Hoku: du gegenüber deinem Start.
> - Hoku stellt keine Diagnosen und ersetzt keine ärztliche Beratung.

Darunter Store-Knöpfe (Abschnitt 5). Keine Zahlen über Nutzer, keine
Erfolgsversprechen („abnehmen“, „gesünder“). Der Text gehört zur juristischen
Prüfung (Abschnitt 7.4).

## 2. Datenmodell

### 2.1 Web-Freigabe je Abzeichen: `profiles.web_badges` **[Claude, ungeprüft]**

`profiles.web_badges jsonb not null default '{}'` — **nur Abweichungen vom
Standard**, je Abzeichen `true` (im Web zeigen) oder `false` (verbergen).
Beispiel: `{"first_bloodwork": true, "workouts_10": false}`.

Standard je Abzeichen aus einer Serverfunktion `profile_badge_web_sensitive()`
(Liste der heiklen IDs, Abschnitt 6.1): heikel = aus, sonst an. Wirksam im Web:
`coalesce((web_badges ->> id)::boolean, not id = any(profile_badge_web_sensitive()))`.

Warum so:

- **Abweichungen statt Liste der eingeschalteten:** Neue Abzeichen (spätere
  Migrationen) bekommen automatisch ihren Standard; „Auf Standard zurücksetzen“ ist
  `'{}'`; Bestandskonten brauchen kein `update`.
- **In `profiles`, neben `field_visibility` und `web_link_enabled`:** Es ist eine
  Sichtbarkeitseinstellung, `profile_view` liest die Zeile ohnehin, und der
  Eigentümer schreibt sie wie die übrigen Profileinstellungen (RLS auf `profiles`).
- **Nicht in `field_visibility`:** Dort gilt Schlüssel = Feld, Wert = Stufe;
  `profile_visibility_ok` prüft genau das. Ein gemischter Schlüssel würde die
  Prüfung aufweichen.
- **Nicht in `progress_settings`:** Die Tabelle ist laut 2b für andere nie sichtbar
  und hält Rechen-Einstellungen, keine Sichtbarkeit.

**Prüfung** (Constraint `profiles_web_badges_check` über
`profile_web_badges_ok(v jsonb)`): JSON-Objekt; jeder Schlüssel aus
`profile_badge_ids()`; jeder Wert `true` oder `false`; höchstens so viele
Schlüssel wie bekannte IDs. Die Liste der heiklen IDs steht zusätzlich als
`BADGES_WEB_SENSITIVE` in `src/features/profil/lib/badgeIds.ts`; ein Test prüft
Gleichheit mit der SQL-Liste (wie `BADGE_IDS`).

### 2.2 `profile_view(…)` in der Stufe `web` **[Claude, ungeprüft]**

Die Filterung geschieht **nur auf dem Server**, in `profile_view` (security
definer), für jede Anfrage ohne Anmeldung und für „Ansehen als Web“. Der Client
und die Vercel-Funktionen zeigen nur, was zurückkommt; sie filtern nichts zusätzlich,
was sicherheitsrelevant wäre.

Änderungen gegenüber 2b:

1. `erlaubt` in der Stufe `web` = Schlüssel mit Wert `all` **∩**
   `profile_web_fields()` = `cover, country, goals, streak, progress, badges, reviews`.
   (Bio entfällt, Frage 3.)
2. Der Zweig `if stufe <> 'web'` entfällt für diese Felder: `cover`, `country`,
   `goals` kommen auch im Web aus `profiles`, `streak`, `progress`, `badges`,
   `reviews` aus dem bereinigten Schnappschuss (`profile_snapshot_clean`).
   `gender`, `member_since` und alle übrigen Schnappschuss-Felder bleiben in `web` aus.
3. **`progress` im Web:** `areas` nur `koerper`, `training`, `erholung`;
   `total` und `since` bleiben. Hat `areas` danach keinen Eintrag, fällt `progress`
   ganz weg (Schutzregel 1.1).
4. **`badges` im Web:** nur IDs, für die die Web-Freigabe (2.1) gilt.
5. **`reviews` im Web:** nur `{count}`, kein `avgRating`.
6. Für den Eigentümer in eigener Sicht zusätzlich `'web_badges'` (für die Einstellung).

`profile_media_visible` wird erweitert: Titelbild auch ohne Anmeldung, wenn
Web-Link an, nicht privat, `cover` auf „Alle“, geprüft und Objekt-ID passt (wie
das Profilbild in 2a).

Grenzen: `web_badges` höchstens so viele Schlüssel wie bekannte Abzeichen;
Schnappschuss-Formen und Größen wie 2a/2b; keine neue Tabelle, keine neue
Lesestelle für `anon` außer der erweiterten Bild-Policy.

### 2.3 Migration `supabase-profil-p2c-web.sql` **[Claude, ungeprüft]**

Additiv und idempotent: `add column if not exists web_badges`, Constraint nur wenn
nicht vorhanden, Funktionen per `create or replace` (`profile_badge_web_sensitive`,
`profile_web_fields`, `profile_web_badges_ok`, `profile_view`,
`profile_media_visible`). Kein `drop`, `delete`, `update`, `truncate`.
Läuft **nach** 2a und 2b; ersetzt `profile_view` und `profile_media_visible` aus
2a/2b (2a und 2b danach nicht erneut laufen lassen, sonst fehlen die Web-Regeln).
Kopf mit Zählungen vor/nach dem Lauf (nur Zahlen, keine Inhalte), wie 2b.

## 3. Link-Karte (Open Graph)

### 3.1 Warum eine Server-Funktion **[Nutzer]**

WhatsApp, iMessage, Telegram, Signal und Slack lesen beim Einfügen eines Links das
HTML und darin `og:`-Meta-Tags. Sie führen kein JavaScript aus; die SPA kann die
Tags also nicht setzen. Deshalb liefert eine Vercel-Funktion für `/u/<name>` das
App-HTML mit den passenden Tags aus, an Bots und Browser gleich (kein Erkennen am
User-Agent). Der Browser startet danach die SPA wie heute.

### 3.2 Aufbau **[Claude, ungeprüft]**

- `vercel.json` (`routes`): vor dem Rückfall auf `/index.html` eine Route
  `/u/([^/]+)/?` → `/api/u?name=$1`.
- **`api/u.js`** (Node): ruft `profile_view(name, null)` **mit dem anon-Schlüssel**
  auf (also genau die Web-Sicht, nie mit Dienstrolle), wählt die Karte (3.3),
  setzt Titel, `og:title`, `og:description`, `og:image` (1200×630, mit
  `og:image:width/height/alt`), `og:url`, `og:site_name`, `twitter:card =
  summary_large_image`, `robots = noindex, nofollow` in das gebaute `index.html`
  ein (wie `scripts/prerender-peptipedia.ts`, mit derselben Escape-Funktion).
  Status 200 bei Treffer, sonst 404 mit neutralen Tags. `index.html` kommt über
  `functions.includeFiles` ins Paket **[Bauende]**.
- **`api/og.js`** (Node): rendert das Vorschaubild. Parameter `name` und `v`
  (Fassung, 3.5). Holt die Daten wieder über `profile_view` als anon und das
  Profilbild über Storage mit dem anon-Schlüssel (die Bild-Policy aus 2a lässt nur
  das geprüfte Bild bei Web-Link an durch). Unbekannt/aus/privat → neutrale Karte.
- Reine Logik (Kartenwahl, Texte, SVG-Aufbau) in `api/_lib/profileCard.js` mit
  `profileCard.test.js` (Konvention wie `api/_lib/planTimeline.js`).
- Der Service Worker (`src/sw.ts`) holt Seitenaufrufe zuerst vom Netz; die
  Server-Antwort mit 404 und Tags kommt also unverändert an.

### 3.3 Welche Karte **[Nutzer, freigegeben 03.11.2026]**

Gestaltung und Texte sind freigegeben. Maßgeblich ist das Mockup
`docs/profil/mockups/profil-2c-karten-auswahl.html`
(Canva-Vorlage: `docs/profil/canva/hoku-link-karten.pptx`). Alle Karten nutzen den Stil
„Hoku-Licht“ (#0f1116, Cyan-Licht von unten) und das Brand-Kit v2. Cyan #00ccf5 steht nur
für Zahlen und „Hoku verbindet.“.

| Lage | Karte | Bild | `og:title` / `og:description` (de) |
|---|---|---|---|
| Web-Link an, Gesamtfortschritt positiv und auf „Alle“ | **Fortschritt** (Hauptlogo Cyan unten Mitte) | links mittig: Profilbild, Name, „Seit 7 Monaten dabei“, „1.240 Einträge“; rechts: „trackt **9** Werte“, Bereiche, „über **30 %**“ mit Trend-Symbol, „positive Veränderung seit März“ | „Mara K. auf Hoku: über 30 % positive Veränderung seit März“ / „Mara trackt 9 Werte mit Hoku: Körper, Training und Erholung & Fitness. Seit 7 Monaten dabei, 1.240 Einträge. Sieh dir Maras Profil an.“ |
| Web-Link an, Fortschritt nicht positiv oder nicht auf „Alle“ | **Rückfall** (B1: Hoku unten rechts angeschnitten, Kompaktlogo weiß oben rechts) | links mittig: Profilbild, Name, „Seit 7 Monaten dabei“, „trackt **9** Werte“; rechts: „ÜBER HOKU“, „Mehr als nur Tracking.“, „Du trackst. / **Hoku verbindet.**“, kursiv „Hokus intelligente Engine legt deine Werte übereinander und kann Muster finden, die du allein nicht gesehen hättest.“, Knopf „Profil ansehen“ | „Mara K. auf Hoku · Mehr als nur Tracking.“ / „Mara trackt 9 Werte mit Hoku. Du trackst. Hoku verbindet. Hokus intelligente Engine …“ |
| Web-Link aus, privat, unbekannt, ausgeblendet | **Neutral** (B3: Hoku links angeschnitten, Hauptlogo weiß) | Hauptlogo 480 px und Slogan „Sieh, wer du wirst.“ mittig auf Höhe der Pupille, Adresse darunter | „Hoku Health Hub“ / „Sieh, wer du wirst. Du trackst. Hoku verbindet. …“ |

EN: „More than just tracking.“ / „You track. Hoku connects.“ / „Hoku’s smart engine layers your
data and can find patterns you’d never have spotted on your own.“ / Slogan „See who you’re becoming.“

Regeln **[Nutzer]**:

- **Profilbild:** gezeigt, sobald der Web-Link an und das Profil nicht privat ist (2a hat keine
  eigene Stufe für Bild und Name). Nur das geprüfte Bild aus dem Bild-Check; sonst die Initiale
  im Kreis, keine neutrale Karte.
- **Fortschritt** rechnet über alle Bereiche wie im Profil (auch Blut und Einnahmen), gezeigt nur
  grob in Stufen (über 10/20/30/50/75/100 %, abgerundet) und nie je Bereich.
- **„trackt N Werte“** zählt einzelne Werte nur aus den fürs Web gewählten Bereichen
  („Was du trackst“: Körper, Training, Erholung & Fitness; Blut und Einnahmen nie).
- **„Seit … dabei“** = Mitgliedschaft: unter einem Monat in Tagen, unter einem Jahr in Monaten,
  danach in Jahren, immer abgerundet.
- **Einträge** = Zahl aller Einträge, ohne Aufschlüsselung nach Bereichen. Varianten für später:
  Abzeichen statt Einträge; ein **Titel**, den man sich verdienen muss (eigenes Vorhaben, noch ohne Spec).
- **Rückfall-Text nur mit Musterfunktion:** „kann Muster finden“ geht erst zusammen mit der
  Musterfunktion live (eigenes Vorhaben, zum Start geplant; Muster über Training, Ernährung, Schlaf,
  Körper; keine Kausalaussagen). Bis dahin Ersatz: „… legt deine Werte übereinander und zeigt dir,
  was sich seit deinem Start verändert hat.“
- **Logofarbe:** Steht Hoku groß im Bild, ist das kleine Logo monochrom weiß; auf der Fortschrittskarte Cyan.
- **Brand-Guide:** Anschnitt der Bildmarke an der Bildkante für B1 und B3 freigegeben; Pupille und
  heller Rand bleiben ganz im Bild.
- **Wortwahl:** nicht „überwacht“, „erkennt Krankheiten“, „warnt“, „optimiert Gesundheit“.

Präzisierungen **[Claude, ungeprüft]**:

- Sprache der Karte: `Accept-Language` des Abrufers (de, sonst en), Antwort mit
  `Vary: Accept-Language`. Messenger-Bots senden oft keine Sprache, dann en. (Frage 9)
- Meta-Description und Bild enthalten nie mehr als die Karte selbst: keine Ziel-Tags, keine
  einzelnen Werte, keine Aufschlüsselung des Fortschritts.
- Schriften im Renderer: Space Grotesk, Inter (mit Kursiv), IBM Plex Mono, Michroma nur in den
  Logo-Dateien.

### 3.4 Bild rendern: Optionen **[Claude, ungeprüft]**

| Option | Wie | Für | Gegen |
|---|---|---|---|
| **A `@vercel/og`** | JSX → Satori → PNG, Node oder Edge | Vercel-Standard, Textumbruch und Flexbox geschenkt | neue Abhängigkeit, CSS-Teilmenge (Überraschungen bei Verläufen/Schrift), Emoji nur über nachgeladene Bilder |
| **B eigenes SVG → PNG mit `@resvg/resvg-js`** | Funktion baut ein SVG (wie der Hoku-Code), resvg rastert, Schriften als Dateien im Paket | `@resvg/resvg-js` ist schon im Repo (devDependency), gleiche Technik wie der QR-Lesetest, volle Kontrolle, in Vitest prüfbar | Textlänge selbst kürzen (ein Name, eine Zeile: machbar), native Binärdatei im Funktionspaket |
| C Bild vom Gerät hochladen | App rendert die Karte, lädt sie hoch | keine Server-Rechenzeit | Gerät ist nicht vertrauenswürdig, umgeht `profile_view`, bei jeder Änderung neu — **verworfen** |

**Empfehlung: B** (resvg wird dafür `dependency`). Schriften: die App-Schriften als
TTF/OTF im Funktionspaket, Lizenz (OFL o. Ä.) prüfen **[Bauende]**.
Lizenzen von resvg-js und ggf. Satori beim Bau prüfen und in die Lizenzliste
aufnehmen **[Bauende]**.

**Kosten:** Jeder nicht zwischengespeicherte Abruf ist ein Funktionsaufruf (HTML
wenige ms Rechenzeit plus ein Supabase-Aufruf; Bild grob 50–200 ms). Die CDN-Caches
(3.5) fangen Wiederholungen ab; bei heutiger Nutzerzahl im enthaltenen Kontingent.
Konkrete Preise beim Bau in der Vercel-Doku nachsehen **[Bauende]**.

### 3.5 Caching und Änderungen **[Claude, ungeprüft]**

- **HTML `/u/<name>`:** `Cache-Control: public, max-age=0, s-maxage=60,
  stale-while-revalidate=60`. Nach „Web-Link aus“ ist die Seite spätestens nach
  rund 2 Minuten überall 404.
- **Bild:** URL `/api/og?name=<name>&v=<fassung>`; `fassung` = kurzer Hash über
  Kartenart, Anzeigename, Bild-Objekt-ID, gerundete Leitzahl, Zahl der
  Web-Abzeichen, Sprache. Ändert sich etwas, zeigt das HTML auf eine neue URL;
  Messenger laden die neue Karte beim nächsten Einfügen. Das Bild selbst:
  `s-maxage=600`. Passt `v` nicht mehr zum aktuellen Stand, liefert die Funktion die
  neutrale Karte (alte Bild-URLs werden so innerhalb von 10 Minuten wertlos).
- **Kein aktives Löschen** im CDN in 2c (bräuchte Datenbank-Trigger → Webhook →
  Vercel-API-Schlüssel). Kurze Zeiten reichen; Cache-Tags + Purge sind ein späterer
  Schritt, falls nötig.
- **Messenger speichern Vorschauen selbst** (WhatsApp, iMessage, Telegram), oft
  ohne Ablauf. Darauf hat Hoku keinen Einfluss. Deshalb steht im Teilen-Sheet:
  „Messenger speichern die Vorschau. Was du später änderst oder ausschaltest,
  erreicht schon gesendete Vorschauen nicht.“ **[Nutzer: Hinweis gewünscht]**,
  Wortlaut **[Claude, ungeprüft]**

## 4. Hoku-Code

### 4.1 Inhalt und Bibliothek

- Ein echter QR-Code mit `https://<domain>/u/<name in Kleinbuchstaben>`
  (`profileUrl`), Fehlerkorrektur **H**. **[Nutzer]** Domain: Frage 1.
- Bibliothek nur für die Matrix; gezeichnet wird selbst. **[Claude, ungeprüft]**

| Bibliothek | Lizenz | Größe | Stand |
|---|---|---|---|
| **`qrcode-generator`** (Kazuhiko Arase) | MIT | klein, ohne Abhängigkeiten, Typen dabei | im Mockup benutzt und dort mit jsQR und ZXing gelesen |
| `uqr` (unjs, Port von Nayukis Generator) | MIT | sehr klein, ESM | jünger, weniger verbreitet |
| `qrcode` (node-qrcode) | MIT | größer (Renderer für Canvas/Terminal dabei) | verbreitet |

**Empfehlung: `qrcode-generator`**, Version exakt festgelegt, Pflege- und
Lizenzstand beim Bau prüfen **[Bauende]**. Ein Test vergleicht die Matrix für eine
feste Adresse mit einem gespeicherten Abdruck, damit ein Bibliothekswechsel auffällt.

### 4.2 Zeichnen (wie im Mockup) **[Nutzer: Look]**, Maße **[Claude, ungeprüft]**

`src/features/profil/lib/hokuCode.ts` baut aus der Matrix ein SVG; eine Komponente
`HokuCode` zeigt es an.

- Datenmodule als Punkte; die drei Suchmarken als abgerundete Ringe mit Kern.
- Rund gesetzt: um das Quadrat ein Modul frei, dahinter helle Füllpunkte im
  Hoku-Verlauf bis zum Kreisrand. Sie tragen keine Daten und sind so hell, dass
  Kameras sie als Hintergrund lesen; Muster deterministisch aus der Adresse.
- Mitte: Hoku-App-Symbol in einer Aussparung von etwa 7 % der Fläche (H gleicht bis
  30 % aus).
- **Immer dunkel auf hell**, auch im dunklen Sheet.
- Barrierefrei: `role="img"`, `aria-label` „Hoku-Code für hoku.app/u/mara“.

### 4.3 Lesetest als automatisierter Test **[Claude, ungeprüft]**

- **Vitest** (`hokuCode.read.test.ts`): SVG mit `@resvg/resvg-js` rastern, mit
  **`zxing-wasm`** (schon Abhängigkeit für den Substanz-Scanner) dekodieren, Inhalt
  muss exakt die Adresse sein. Fälle: 124 px (Sheet), 300 px (Vollbild), halbe
  Auflösung, weichgezeichnet (SVG-Filter), ±10° gedreht; Namen: kürzester, längster
  erlaubter, mit Punkt/Unterstrich/Ziffern. Lädt `zxing-wasm` in Node nicht sauber,
  läuft derselbe Test im Browser über Playwright **[Bauende]**.
- **Playwright** (`profil-teilen.spec.ts`): Sheet öffnen, Bildschirmfoto des Codes,
  dekodieren, Adresse vergleichen; Vollbild ebenso.
- 17° Drehung las im Mockup nur jsQR, nicht ZXing: kein Testfall; vor dem Start am
  echten iPhone und Android mit der normalen Kamera prüfen (Frage 12).

### 4.4 Sheet „Profil teilen“ und Vollbild **[Nutzer]**

Der Knopf „Profil teilen“ im eigenen Profil (heute direkt `navigator.share`,
`src/pages/Profil.tsx`) öffnet ein Sheet:

- Titel „Profil teilen“, Untertitel „Wer den Link öffnet, sieht deine Felder auf
  ‚Alle‘.“
- Kleiner Hoku-Code (124 px), „Antippen zum Vorzeigen“ → **Vollbild**: Code
  300 px, Name, @nick, „Mit der Handykamera scannen. Öffnet das Profil in Hoku oder
  im Browser.“, Knöpfe „Teilen …“ und „Link kopieren“, Schließen.
- „Teilen …“ (`navigator.share`, sonst Kopieren) und „Link kopieren“; die Zeile mit
  der Adresse und „Kopieren“. Beide vergeben „Profil geteilt“ (wie heute).
- Statuszeile: „Web-Link an · Karte mit Bild und Name · Ändern ›“ (öffnet
  Einstellungen › Web-Link). Die Kartenart (A/C) nennt die Zeile mit.
- Hinweis zum Zwischenspeichern der Messenger (3.5).
- **Helligkeit:** Im Repo gibt es kein Capacitor-Plugin dafür
  (`package.json`: nur `@capacitor/haptics`). 2c setzt die Helligkeit deshalb
  **nicht** hoch und zeigt keinen Knopf „Helligkeit hoch“; der Code ist dunkel auf
  weiß im Vollbild. **[Claude, ungeprüft]** (Frage 11)

### 4.5 Web-Link aus **[Nutzer]**

Teilen geht trotzdem: Link und Code funktionieren für angemeldete App-Nutzer
(App-Ansicht), im Browser ohne Anmeldung kommt die 404. Das Sheet zeigt statt der
Statuszeile: „Dein Web-Link ist aus. Nur angemeldete Hoku-Nutzer sehen dein
Profil; im Browser erscheint ‚Seite nicht gefunden‘.“ und einen Schalter
„Web-Link einschalten“ (schreibt `web_link_enabled`, Ergebnis sofort im Sheet).
Ist das Profil privat, sagt der Hinweis das statt des Web-Links.

## 5. „In Hoku öffnen“

### 5.1 Verhalten **[Nutzer]**, Umsetzung **[Claude, ungeprüft]**

Ist Hoku installiert, öffnet ein Tipp auf den geteilten Link (aus WhatsApp,
Messages, Kamera) **direkt die App** auf dem Profil; sonst öffnet sich die
Web-Seite mit Store-Knöpfen.

- **iOS Universal Links:** Datei `/.well-known/apple-app-site-association`
  (`public/.well-known/`, ohne Endung, `Content-Type: application/json`, ohne
  Weiterleitung, über HTTPS):
  `{"applinks":{"details":[{"appIDs":["<TEAM_ID>.com.kossa97.tyd"],"components":[{"/":"/u/*"}]}]}}`.
  In der App: Entitlement „Associated Domains“ mit `applinks:<domain>` (heute gibt
  es **keine** `.entitlements`-Datei und kein `DEVELOPMENT_TEAM` im Projekt).
- **Android App Links:** `/.well-known/assetlinks.json` mit Paket
  `com.trackyourdose.app` und den SHA-256-Fingerabdrücken; in
  `AndroidManifest.xml` an `MainActivity` ein `intent-filter
  android:autoVerify="true"` mit `VIEW`, `DEFAULT`, `BROWSABLE`, `https`, Host,
  `pathPrefix="/u/"` (heute nicht vorhanden).
- **Routing in der App:** `@capacitor/app` (offizielles Plugin, MIT; heute nicht im
  Projekt) meldet `appUrlOpen`; die App navigiert **nur** bei Pfaden `/u/<name>`
  (Zeichen wie Nutzernamen) auf diese Route, alles andere wird ignoriert. Angemeldet
  App-Ansicht, sonst Web-Ansicht mit „Anmelden“.
- **Tipp auf der Web-Seite selbst:** Universal Links greifen in Safari nicht bei
  Links auf dieselbe Domain. Deshalb auf iOS ein Smart-App-Banner (`apple-itunes-app`
  mit `app-argument` = Profiladresse) und der Knopf führt in den App Store; auf
  Android ein `intent://…#Intent;scheme=https;package=com.trackyourdose.app;S.browser_fallback_url=<Play-Store>;end`.
- **Desktop:** „In Hoku öffnen“ zeigt Store-Knöpfe und den Hoku-Code zum Scannen mit
  dem Handy. **[Claude, ungeprüft]** (Claude-Standard aus dem Brainstorming)
- **Store-Adressen** kommen aus Umgebungsvariablen; fehlen sie (Apps noch nicht
  veröffentlicht), führt der Knopf zu `/auth` („Im Browser öffnen“).

### 5.2 Was der Nutzer selbst tun muss (offene Punkte)

- Domain festlegen und auf das Vercel-Projekt zeigen lassen (Frage 1).
- Apple **Team-ID** liefern; in Xcode die Fähigkeit „Associated Domains“
  einschalten (Provisioning-Profil neu).
- **SHA-256 des App-Signaturzertifikats** aus der Play Console (App-Signatur durch
  Google Play) liefern, dazu den des Upload-/Debug-Schlüssels für Tests.
- App-Store- und Play-Store-Adressen (bzw. App-ID für das Smart-App-Banner).
- **App-Update** in beide Stores: Entitlement, Intent-Filter, `@capacitor/app`.
  Ohne Update öffnen Links weiter die Web-Seite; nichts geht kaputt.
- Nach dem Deploy prüfen: Apple-CDN-Abruf der AASA-Datei, Googles
  „Statement List Tester“ bzw. `adb shell pm get-app-links`.

## 6. Einstellung „Abzeichen im Web“

### 6.1 Standard **[Nutzer]**

Ab Werk **an**: Beständigkeit, Training, Gemeinschaft und Meilensteine ohne
Gesundheitsbezug. Ab Werk **aus** mit dem Hinweis „verrät Gesundheitsdaten“
(Einordnung aus dem Mockup):

| Bezug | Abzeichen |
|---|---|
| Blut | `first_bloodwork`, `bloodwork_3`, `all_markers_in_range` |
| Zyklen | `first_cycle_done` |
| Einnahmen | `intake_all_30` |
| Körperwerte | `body_fat_5`, `body_fat_10`, `body_fat_20`, `weight_5`, `resting_hr_5` |

Grenzfälle, im Mockup **an** **[Claude, ungeprüft]** (Frage 7): `weighed_weeks_8`
(sagt „wiegt sich“, keinen Wert), `first_measurement`, `first_progress_photo`,
`wearable_connected`, `steps_week_10k`, `progress_10/25/50`.

### 6.2 Bildschirm (Mockup Abschnitt 3) **[Nutzer]**

Profil › ⚙︎ › Web-Link › **Abzeichen im Web** (`/profil/web-abzeichen`):

- Einleitung: „Gilt für hoku.app/u/<name> und die Link-Karte im Chat. Abzeichen,
  die etwas über Blut, Zyklen, Einnahmen oder Körperwerte verraten, sind ab Werk aus.“
- Zähler „Im Web sichtbar 7 von 21 verdienten“.
- Je Gruppe (Beständigkeit, Meilensteine, Fortschritt, Gemeinschaft) „n/m an“ und je
  Abzeichen eine Zeile: Symbol, Name, ggf. „verrät Gesundheitsdaten“, „verdient“ /
  „noch nicht verdient“ (grau), Schalter. Noch nicht verdiente lassen sich vorab
  einstellen und erscheinen erst, wenn sie verdient sind.
- „Auf Standard zurücksetzen“ mit Erklärung; setzt `web_badges = {}`.
- Kasten „Was die Schalter nicht ändern“: Freunde und angemeldete Nutzer sehen
  Abzeichen weiter nach der Stufe im Profil (2b); die Schalter gelten nur für die
  Seite ohne Anmeldung und die Link-Karte.
- Steht `badges` nicht auf „Alle“ oder ist der Web-Link aus, oben ein Hinweis mit
  Sprung zur passenden Einstellung („Im Web erscheinen keine Abzeichen, weil …“).
  **[Claude, ungeprüft]**
- Speichern bei jedem Tipp, in Tipp-Reihenfolge (wie die Sichtbarkeit in 2a);
  Fehler setzt den Schalter zurück und meldet sich.

## 7. Sicherheit und Recht

### 7.1 Was ins Web darf

- Nur Felder auf „Alle“ bei Web-Link an und nicht privat; gefiltert in
  `profile_view` (2.2). Funktionen und Seite bekommen nichts anderes.
- **Kein Leck über Bild und Meta-Tags:** Beide werden ausschließlich aus der
  `profile_view`-Antwort der Web-Stufe gebaut (anon-Schlüssel, keine Dienstrolle in
  `api/u.js`/`api/og.js`). Ein Test prüft: Ein Profil mit allen Feldern auf
  „Freunde“ ergibt die neutrale bzw. Einladungskarte, ohne Zahl.
- Anzeigename nur nach Textfilter (2a); Ziel-Tags sind eine feste Liste.
- Nutzername in HTML und SVG immer maskiert (Escape wie im Peptipedia-Prerender);
  `name`-Parameter auf das Nutzernamen-Zeichenset begrenzt, sonst sofort 404.

### 7.2 Suchmaschinen, Caching, Abfragen in Masse

- `<meta name="robots" content="noindex, nofollow">` und `X-Robots-Tag: noindex`
  auf `/u/*` und `/api/og`. Messenger-Vorschauen funktionieren trotzdem.
  **[Claude, ungeprüft]**
- Kurze CDN-Zeiten (3.5).
- **Enumeration:** `profile_view` ist schon heute ohne Anmeldung über die
  Supabase-API aufrufbar; die Funktionen öffnen also keinen neuen Weg, sondern
  denselben über Vercel. Schutz: identische 404 (1.2), keine Liste aller Profile,
  Rate-Limit.
- **Rate-Limit** **[Claude, ungeprüft]** (Frage 10): Regel in der Vercel-Firewall
  (z. B. 60 Anfragen/Minute je IP auf `/u/*` und `/api/og`), im Dashboard vom Nutzer
  anzulegen. Ohne Regel bleibt nur der CDN-Cache als Bremse.

### 7.3 Datenschutzerklärung und App-Texte

Abschnitt zum Web-Link ergänzen: was öffentlich sichtbar ist, dass Vercel die
Vorschau erzeugt, Zwischenspeicher (CDN bis wenige Minuten, Messenger ohne
Einfluss), `noindex`. Ob `TERMS_VERSION` steigen muss: Frage 13.

### 7.4 Offen für die juristische Prüfung (vor dem Start)

1. **Web-Vorschau insgesamt** vor dem Start prüfen lassen (Gesamtbild).
2. **Art. 9 DSGVO:** Gesamtfortschritt, Streak und Abzeichen können
   Gesundheitsdaten sein. Reicht die Freigabe „Alle“ + Web-Link als ausdrückliche
   Einwilligung bzw. als „offensichtlich öffentlich gemacht“? Auch für die
   Baseline aus Health (2b).
3. **Heilmittelwerbung/AMG:** Profile hängen an einer App, in der Peptide getrackt
   werden. „Was ist Hoku?“ und der Berichte-Hinweis (Anzahl) dürfen nicht als
   Werbung für nicht zugelassene Arzneimittel lesbar sein.
4. **Apple** (1.2 nutzergenerierte Inhalte, 5.1.1/5.1.3 Gesundheitsdaten, keine
   Weitergabe von HealthKit-Daten) und **Google Play** (Richtlinie zu Health
   Connect, nutzergenerierte Inhalte): Werte, die teils aus Apple Health / Health
   Connect stammen, erscheinen auf Wunsch des Nutzers im offenen Web.
5. **DSA Art. 16:** Jede Person muss Inhalte melden können, auch ohne Konto.
   „Profil melden“ im Web braucht einen Weg ohne Anmeldung (Formular oder Adresse
   aus dem Impressum). (Frage 8)
6. **Impressum** auf den Web-Seiten (vorhanden über `LegalLinks`).
7. **Minderjährige:** öffentliche Profile Minderjähriger (Altersgrenze der App prüfen).

## 8. Texte, Tests, Migration

### 8.1 Texte **[Nutzer: nur de/en]**

Neue Schlüssel (u. a. Web-Seite, 404, „Was ist Hoku?“, Store-Knöpfe, Teilen-Sheet,
Vollbild, Web-Link-aus-Hinweis, Messenger-Hinweis, „Abzeichen im Web“, Meta-Texte
der Karten) in **de und en** geschrieben und gegengelesen; in den übrigen zwölf
Sprachen der englische Text als Platzhalter (`i18n.test.ts`). Meta-Texte der
Vercel-Funktionen stehen in `api/_lib/profileCard.js` (de/en) und folgen
denselben Wortlauten.

### 8.2 Tests **[Claude, ungeprüft]**

- **Unit (Vitest):** `profile_web_badges`-Logik und Parität `BADGES_WEB_SENSITIVE`
  ↔ SQL; Kartenwahl A/C/neutral inkl. negativ, 0 Abzeichen, kein Bild,
  Schutzregel; Meta-Texte ohne verbotene Inhalte; Fassungs-Hash; Escape von Namen;
  Hoku-Code-Matrix und Lesetest (4.3).
- **e2e (Playwright, Supabase-Mock wie die bestehenden `profil-*.spec.ts`):**
  Web-Seite zeigt nur Web-Felder, keine Bereiche Blut/Einnahmen, keine Bio; 404
  gleich für aus/privat/unbekannt; „Abzeichen im Web“ schaltet und wirkt auf die
  Seite; Teilen-Sheet mit Code, Vollbild, Web-Link-aus-Hinweis und Schalter;
  Lesetest im Browser.
- **Funktionen:** `api/u.js` und `api/og.js` mit gemocktem `profile_view`: Status,
  Kopfzeilen, Tags, PNG 1200×630.
- **SQL (Trockenlauf):** Proben als `anon` (aus/privat/unbekannt → `null`; an →
  nur Web-Schlüssel; `progress.areas` ohne `blut`/`einnahmen`; Schutzregel; heikle
  Abzeichen ab Werk weg, Abweichung wirkt; `reviews` nur `count`; Titelbild-Policy).

### 8.3 Migration und Reihenfolge **[Nutzer: CLAUDE.md]**

`supabase-profil-p2c-web.sql` als Datei; Trockenlauf mit Postgres 16 im Container
(unter `/var/tmp/…`, Ist-Zustand nach 2a + 2b nachgebaut) **zweimal**, nachzählen.
Produktivlauf **nur nach ausdrücklichem Ja**, in der Reihenfolge 2a → 2b → 2c
(keiner der drei lief bisher gegen Produktion), danach dieselbe Zählung und
Ergebnis berichten.

## Offene Fragen

Alles mit **[Claude, ungeprüft]**, nummeriert, je mit Empfehlung:

1. **Domain: entschieden** — `hokuhealth.app` (Vercel; `meethoku.com` leitet weiter). Offen bleibt nur
   die Passkey-RP-ID (heute `tyd-track-your-dose.vercel.app`, `memory/projects/login.md`).
2. **Ohne Store-Einträge:** Solange die Apps nicht in den Stores sind, führt
   „In Hoku öffnen“ zu `/auth`. Empfehlung: so lassen.
3. **Bio im Web:** wegfallen lassen (Gesamtbild-Liste, Mockup) statt wie im
   2a-Zwischenstand zeigen. Empfehlung: weglassen.
4. **„Bild und Name auf ‚Alle‘“** = Web-Link an; ohne geprüftes Bild Initiale statt
   neutraler Karte. Empfehlung: so.
5. **Schutzregel:** Gesamtfortschritt nicht im Web, wenn nur Blut/Einnahmen ihn
   tragen. Empfehlung: so.
6. **Negativer Gesamtfortschritt** → Karte C. Empfehlung: so.
7. **Grenzfälle der Abzeichen** (`weighed_weeks_8`, `first_measurement`,
   `first_progress_photo`, `wearable_connected`, `steps_week_10k`, `progress_*`)
   ab Werk an. Empfehlung: so, wie im Mockup.
8. **„Profil melden“ ohne Konto:** einfaches Formular mit Grund und optionaler
   E-Mail, landet in der bestehenden Moderation. Empfehlung: Formular.
9. **Sprache der Karte:** `Accept-Language`, sonst Englisch. Alternative: Sprache
   des Profilinhabers speichern. Empfehlung: erst `Accept-Language`, ansehen.
10. **Rate-Limit** über die Vercel-Firewall (60/min je IP). Empfehlung: anlegen.
11. **Helligkeit im Vollbild:** ohne Plugin weglassen; mit einem Community-Plugin
    (Kompatibilität mit Capacitor 8 prüfen) später. Empfehlung: weglassen.
12. **Lesetest am Gerät:** iPhone- und Android-Kamera mit Code im Sheet und
    Vollbild vor dem Start. Empfehlung: Nutzer prüft einmal.
13. **`TERMS_VERSION`** nach der Datenschutzergänzung anheben? Empfehlung: anheben,
    weil neu Daten ins offene Web gehen.
14. **Rendern der Karte:** eigenes SVG mit resvg (B) statt `@vercel/og`.
    Empfehlung: B.
15. **QR-Bibliothek:** `qrcode-generator`. Empfehlung: so.
16. **Datenmodell:** `profiles.web_badges` als Abweichungen vom Standard.
    Empfehlung: so.
17. **Cache-Zeiten:** HTML 60 s, Bild 10 min, kein aktives Löschen. Empfehlung: so.
18. **`noindex`** für alle Profilseiten. Empfehlung: so.
19. **Adresse = echter Nickname** (`/u/mara`, kein Zufallskürzel). Empfehlung: so;
    ein Zufallskürzel wäre schwerer zu erraten, aber nicht merkbar.
20. **Berichte-Hinweis** nur bei Feld Erfahrungsberichte auf „Alle“ und Anzahl > 0,
    sonst kein Satz über Verborgenes. Empfehlung: so.
21. **Desktop:** „In Hoku öffnen“ zeigt Store-Knöpfe und den Hoku-Code. Empfehlung: so.
22. **Geschlecht-Zeichen** nicht im Web. **„Seit … dabei“ (Mitgliedschaft) jetzt doch im Web**: steht seit
   der Freigabe der Link-Karten (03.11.) auf Fortschritts- und Rückfall-Karte; die Web-Seite zeigt es
   deshalb auch. Empfehlung: so.
23. **`@capacitor/app`** für das Routing der Links in der App. Empfehlung: so.

## Randbedingungen

- Datenbank nach `CLAUDE.md`: Migration als Datei, Trockenlauf zweimal,
  Produktivlauf nur nach Ja, danach nachzählen und berichten. Kein `drop`,
  `truncate`, `delete`/`update` ohne `where`.
- Texte nur de/en; neue Schlüssel in den übrigen zwölf Sprachen englisch.
- Look wie profil-v3 / 2a / 2b (Soft Dark); Code immer dunkel auf hell.
- Nach Codeänderungen `code-review` und `security-review` (Web ist eine
  Sicherheitsgrenze); `graphify update .` zieht der Nutzer lokal nach.
- Kein Deploy, keine Domain-, DNS- oder Firewall-Änderung ohne den Nutzer.

## Dem Bauenden überlassen

- Paketierung von `index.html` und Schriften in die Funktionen (`includeFiles`).
- Exakte Maße des Hoku-Codes und der Karte, solange der Lesetest besteht.
- Ob die Web-Seite eigene Bausteine bekommt oder `FortschrittKarte` und
  `AbzeichenKarte` mit einer Web-Variante nutzt.
- Fassungs-Hash (Algorithmus, Länge).
