# Login mit Dot

Idee (Nutzer 26.10.2026): neuer Login-Screen, Maskottchen Dot begrüßt, Animationen
hochwertig, flüssig, physikalisch. Mockup: https://claude.ai/artifact/Cm88imRAv2u1NKvSc9CKh5,
Kopie in `docs/login/mockup.html`, Umsetzung nach `docs/login/UEBERGABE.md`.

## Entschieden (26./27.10.2026)
- App-Name: **Dot: Health Hub** (löst TrackYourDose ab).
- Dot bleibt die 460-Punkte-Kugel der App. Hand, Herz, X und Kein-Netz-Symbol aus denselben
  460 Punkten im selben Stil (zu dichte Formen verworfen). Nur Text bekommt mehr Punkte.
- Start: nur „Anmelden“ und „Registrieren“ untereinander, jeder Knopf öffnet sein Formular.
- Anmelden: E-Mail **oder** Benutzername, Angemeldet bleiben, Face ID, Apple, Google.
- Registrieren: Benutzername, E-Mail, Passwort, Passwort wiederholen, Einwilligung.
- Eröffnung: Partikel von der Display-Kontur (links/oben/rechts), vier Varianten im Wechsel, zufällig.
- Begrüßung: Start = Hand, „Willkommen im Health Hub“, Herz. Anmelden = „Willkommen zurück“.
  Registrieren = „Hey, ich bin Dot“. Text entsteht aus der Mitte.
- Fehler: rotes X + Schütteln für jeden Eingabefehler; kein Netz = eigenes Symbol (WLAN mit Strich), orange.
- Erfolg: Haken → Portal bis an den Display-Rand → Kugeln finden langsam zu Dot → Heimflug
  in die Tab-Leiste. Kein Kreisen am Rand, kein Lichtlauf (Nutzer 27.10.).
- Mit Sitzung öffnet sich der Login nicht mehr („nicht nerven“).
- Dot bleibt beim Ziehen und Werfen ganz im Display und prallt am Rand ab.
- Tuning-Werte des Nutzers stehen in der Übergabe (Abschnitt 2).
- **Ein Dot für Login und App** (Nutzer 27.10.): dieselbe Instanz, DotLayer über den Routen, fliegt nach dem Login ohne Schnitt in die Leiste.
- **Neue Kugelwerte gelten app-weit** (Nutzer 27.10.), außer wenn Dot an der Wand klebt: dort die alten ruhigen Werte.

## Umsetzung (27.10.2026)
- **Engine-Modell (Nutzer):** Die App-Engine hat keine Federn pro Punkt (Punkte gleiten per
  easeIO von Form zu Form). Schritt 2 deshalb im App-Modell; Federn pro Punkt (Nachschwingen,
  Schweife, Eröffnung) kommen gesondert vor Schritt 4.
- Schritt 2 gebaut: `engine/formen.ts` (Abtastung Hand/Herz/X/WLAN, 460 Punkte), `zeigeForm()`
  in der Engine, Fehlerfarbe `--lg-bad`/`--lg-warn`, Schütteln beim X, neue Kugelwerte.
- Kugelwerte an der Wand: dort exakt das bisherige App-Verhalten (Drehung 0,16, Puls 100 %,
  kein Atmen/Lichtschein je Punkt — das gab es vorher nicht), frei 250 %; Überblendung über `B.flat`.
- Schritt 2 auf dem iPhone abgenommen (Nutzer 27.10.).
- **Schritt 3 (27.10.):** DotLayer hängt jetzt über den Routen (`App.tsx`, 3.2 vorgezogen,
  Nutzer); `Layout` meldet nur Leiste/Schnellzugriff an `dotStore`. Betriebsarten `login` /
  `app` / `aus`. Engine-Modus `login` (Nutzer): direkt auf die Bühne, Ziehen/Werfen wie im
  Mockup; in Ruhe scrollt er mit der Bühne (Registrierung ist länger als ein Bildschirm), die
  Grenzen gelten nur gezogen/geworfen. Neue `Auth.tsx` mit Start/Anmelden/Registrieren,
  Prüfung im Gerät (`features/auth/lib/pruefung.ts`), Fehlerfällen, Haptik.
- Registrierung behält die **drei** Haken von `ConsentChecks` (18+, Bedingungen, Art. 9) statt
  des einen im Mockup — sonst fehlte die Gesundheitsdaten-Einwilligung und ConsentGate fragte nach.
- Bewusst auf später: Apple/Google, Face ID, „Angemeldet bleiben", Benutzername-Login,
  Benutzername-Eindeutigkeit vorab (Schritt 6); „Passwort vergessen?" (in keinem Schritt);
  Text-Begrüßungen (Schritt 4); Portal/Heimflug (Schritt 5).
- Schritt 3 auf dem iPhone abgenommen (Nutzer 27.10.).
- **Schritt 4 (27.10.):** Federn je Punkt **überall, relativ zu Dot** (Nutzer): Formwechsel in App
  und Login federn mit Nachschwingen, Wirbel und Schweifen; beim Ziehen bewegt sich die Wolke als
  Ganzes. Gerechnet im Formraum, weicher Rand/Flachwerden/Herauskommen unverändert. 460 × 6 =
  2760 Punkte; Kinder rechnen nur während Schrift und Eröffnung (+1,5 s). Texte (`login_hub`,
  `login_zurueck`, `login_hey`) in Dots eigenem `texte.ts`; Schrift wird vor dem Abtasten geladen.
  Eröffnung in vier Varianten über `rahmenPunkt` (geometry.ts). Jeder Satz auch als
  `role="status"`, bei weniger Bewegung sichtbar statt animiert.
- Schritt 4 auf dem iPhone abgenommen (Nutzer 27.10.).
- **Schritt 5 (27.10.):** Erfolg = Haken → Login-Karte blendet 0,45 s aus (Nutzer: statt den
  Login außerhalb des Portals stehen zu lassen) → Route `/` → Engine-Modus `portal`: Ring wächst
  zum Display-Umriss und schneidet `[data-dot-portal]` (Hülle um alles in `Layout`) per
  `clip-path` frei → Ruhe am Rand → weiche Federn (kMul 0,05) → Bogenflug in `[data-tyd-slot="dot"]`
  auf 13 px → `house`, Stoß lässt das Logo hüpfen. Ohne Leiste (Zustimmungsseite) still ins Haus.
  Tempo 0,6 ≈ 9 s ab Tippen. E2E `e2e/login.spec.ts` (Fehler im Gerät, Erfolg bis Landung).
- Schritt 5 auf dem iPhone abgenommen (Nutzer 27.10.).
- **Schritt 6 aufgeteilt (Nutzer 27.10.):** 6a Angemeldet bleiben + Benutzername, 6b Apple/Google,
  6c Face ID. Getestet wird die **Web-App im Safari/PWA**, nicht native → Apple/Google per
  Supabase-OAuth (Knöpfe erst, wenn konfiguriert), Face ID im Web nur per Passkey (6c klären).
- **6a gebaut:** `features/auth/lib/sitzung.ts` (aus = Abmelden beim nächsten Start, Start =
  neuer Lauf ohne sessionStorage-Marke), Feld „E-Mail oder Benutzername", Edge Function
  `login-name` (Name → E-Mail nur serverseitig, 10 Versuche/15 min je Name, gleiche Antwort für
  unbekannt/falsch, Deploy mit `--no-verify-jwt`), RPC `benutzername_frei` vor der Registrierung.
  Migration `supabase-login-name.sql`: Trockenlauf PG 16 (Docker), 2×, Ist-Zustand 14 Konten /
  13 Profile / keine Groß-klein-Doppel → idempotent, Rechte und Limit geprüft.
  **In Produktion (Nutzer 27.10.):** Migration `login_name` angewendet, `login-name` v1 deployt
  (verify_jwt aus). Nachzählung: 14 Konten, 13 Profile unverändert, 3 Funktionen, Versuche leer
  mit RLS; E-Mail-Suche nur service_role. Advisor: `benutzername_frei` für anon (gewollt),
  Versuchstabelle ohne Policy (gewollt); offen: „Leaked Password Protection" im Dashboard aus.
- 6a auf dem iPhone abgenommen (Nutzer 27.10.).
- **6b gebaut:** Apple/Google per `signInWithOAuth`, Rücksprung `/auth?anbieter=…`; Knöpfe nur mit
  `VITE_AUTH_APPLE=1` / `VITE_AUTH_GOOGLE=1` (Build-Variablen, `.env.example`). Rückkehr mit
  Sitzung → Haken, Portal, Heimflug; mit Fehler → X + Satz. Neue OAuth-Konten laufen über die
  Zustimmungsseite (Profil `user_xxxxxxxx`). Anleitung für die Konten: `docs/login/ANBIETER.md`
  (Apple-Schlüssel läuft nach 6 Monaten ab!). Konten noch nicht eingerichtet (Nutzer).
- **6c gebaut (Nutzer 27.10.):** Face ID im Web = **Supabase-Passkeys** (experimentell,
  supabase-js ≥ 2.105, `auth.experimental.passkey` im Client; nur `features/auth/lib/passkey.ts`
  spricht damit). Relying Party ID = **`tyd-track-your-dose.vercel.app`** (Nutzer: jetzige
  Vercel-Domain; Wechsel macht alle Passkeys ungültig, Vorschauen gehen nicht). Nachfrage einmalig
  nach der Landung (Blatt in Layout), Knopf neben „Anmelden" nur mit Passkey auf dem Gerät,
  Verwaltung im Profil. Sichtbar nur mit `VITE_AUTH_PASSKEY=1`. Autofill im Namensfeld noch nicht
  (Bibliothek bietet es nicht direkt). E2E mit virtuellem Authenticator (CDP WebAuthn).
  Dashboard: `docs/login/PASSKEYS.md`. Noch nicht eingeschaltet (Nutzer).
- **Schritt 7 (Nutzer 27.10.):** code-review (8 Befunde) und security-review (keiner ≥ 8) über alle
  Login-Änderungen; alle 8 behoben. Darunter:
  - Versuchslimit zählt nur noch **Fehlversuche** (unbekannter Name, falsches Passwort); eine
    gelungene Anmeldung setzt den Zähler des Namens zurück. Migration
    `supabase-login-name-fehlversuche.sql` (`login_name_versuch` nur prüfen,
    `login_name_fehlversuch`, `login_name_erfolg`, alle nur service_role), `login-name` v2.
  - **Ein Name, ein Konto auch ohne Groß/klein:** eindeutiger Index `profiles_username_lower_key`
    auf `lower(username)`. Wird der Name zwischen Prüfung und Registrieren vergeben (23505), steht
    das Konto trotzdem; Hinweis `login_name_spaeter`, Name dann im Profil wählen.
  - Trockenlauf PG 16 2× (Verhalten, Rechte, Rollback bei vorhandenen Doppeln), dann Produktion.
    Nachzählung: 14 Konten, 13 Profile, Versuche 0, Index da, Rauchtest (1 Fehlversuch gezählt,
    wieder entfernt).
- **Login-Dot wie in der App (Nutzer 28.10.2026):** Ziehen/Werfen über die App-Physik (`dragTo`,
  `release`, Wände mit Andocken und Abplatten), über das ganze Display inkl. Insel und Ecken.
  Geworfen klebt er an der Wand (1,2 s Ruhe), löst sich langsam (`loesen`, Abplattung baut sich
  mit Tempo 1,4 ab) und federt dann zur Bühne zurück (rueckK 16,2). Ohne Wand nach 0,45 s zurück.
  Eröffnung aus Partikeln bleibt (Nutzer). Würfe ändern seinen App-Platz nicht (`appPlatz`).
  Login-Seite hebt den Safe-Area-Abstand von body auf (stand doppelt, Seite war höher als das
  Display). Dabei gefunden: negativer Bildschritt (rAF-Zeitstempel vor `performance.now()` aus
  `laufen`) ließ Dot unter Last explodieren — dt jetzt ≥ 0. E2E „Wurf" in `e2e/login.spec.ts`.
- **Eröffnung nur oberhalb des Formulars (Nutzer 28.10.):** Partikel kommen von links, oben und
  rechts nur bis zur Unterkante der Bühne. Vollbild: in Safari bleibt die Statusleiste Safaris
  eigener Streifen; ganz bis oben nur als installierte Web-App (Home-Bildschirm).
  Vorschau zum Testen: Branch `login-dot-wand` auf Vercel (geschützt, Vercel-Anmeldung nötig).
- Docker Desktop startete nicht (verwaiste Unix-Sockets in `%LOCALAPPDATA%\Docker\run`, beim
  zweiten Mal auch `%LOCALAPPDATA%\docker-secrets-engine`); Ordner umbenannt (`*.alt*`), danach
  lief es. Docker nach dem Start nicht hart beenden, sonst verwaisen die Sockets wieder.
- Prüfen ohne Fenster: Ausschnitt-Screenshots bei deviceScaleFactor 2 zeigen die WebGL-Ebene falsch
  skaliert (Artefakt von Edge/Playwright, nicht der App). Ganze Seite oder Faktor 1/3 nehmen.

- **Gesten im Raum (Nutzer 28.10.2026):** Auswahl im Gesten-Mockup (Artefakt
  https://claude.ai/artifact/8MhVn2TeEV7YVvEZRZQSvN, Version 6): Begrüßung **D1 (ein Arm winkt)
  und D4 (beide Hände winken) im Wechsel** (`tyd.dot.gruss` im localStorage, auch über Besuche),
  Herz C (Herz in Dot, rosa), Fehler A (Kugel schüttelt sich, rot), Kein Netz B (Dot sucht, Schalen,
  orange), Erfolg A (Haken zeichnet sich, wird grün; auch nach dem Registrieren). Arme: dünne
  Gummiarme mit Comic-Hand (Daumen + drei Finger) aus Dots eigenen 460 Punkten, die Kugel schließt
  sich gleichmäßig darüber (Nutzer verwarf vorher Stummelarme und die flache Hand).
  Code: `engine/gesten.ts` (aus dem Mockup portiert), Engine liest je Bild Lage/Licht/Rosa;
  `formen.ts` nur noch Schrift und Herzschlag. Winken 3,9 s (`GRUSS_DAUER`), Haken 1,2 s.
  Gefunden: die runden Enden des Hakens blieben dunkel (Lauf > 1), behoben.

## Offen
- Gesten auf dem iPhone abnehmen (Fluss des Winkens, Größe der Hand bei Dots kleinen Punkten).
- Dauer des Erfolgs (Tempo 0,6 ≈ 9 s) prüft der Nutzer auf dem Gerät.
- Ecken-Radius pro Gerät (Mockup fest 48 px).
- Offizielle Apple-/Google-Knöpfe, Edge Function für Benutzername-Login, Face-ID-Plugin.
