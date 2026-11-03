# Registrierung mit Resend — Plan

Stand 2026-11-03. Entscheidungen des Nutzers in dieser Sitzung:

- **Nur Code, kein Link.** Die App läuft künftig nativ (nicht mehr im Browser/am Computer).
  Bestätigt wird mit einem 6-stelligen Code, den man in der App eintippt.
- **Eigene Mails, de/en**, verschickt von der App über Resend (nicht die Supabase-Standardtexte).
- **„Passwort vergessen" gleich mit**, über denselben Code-Weg.

Nachtrag (Nutzer 03.11.2026):

- **Kopieren ohne Markieren.** Ein echter Kopier-Knopf geht in Mails nicht: Mail-Apps führen kein
  JavaScript aus. Stattdessen:
  - **Ausfüllen über der Tastatur** („Aus Mail" bzw. „Aus Nachrichten"): iOS ab 17 erkennt Codes aus
    **Apple Mail** wie aus SMS. Voraussetzung: Feld mit `autoComplete="one-time-code"` (geht auch in
    der Capacitor-App) und das Wort „Code" nah an der Zahl, Code auch im Betreff. Mit der Gmail-App
    auf dem iPhone klappt das nicht, Gmail zeigt aber selbst einen Knopf „Kopieren" an.
  - In der Mail steht der Code groß, ohne Leerzeichen und mit `user-select: all`: ein Tipp
    markiert den ganzen Code (hängt von der Mail-App ab, wird auf dem iPhone getestet).
  - In der App: Einfügen-Knopf neben dem Feld und automatisches Prüfen bei 6 Ziffern.
- **Code läuft ab:** **15 Minuten** (Supabase-Einstellung), in der Mail mit Uhrzeit genannt
  („gültig bis 11:35"). Ein benutzter Code und jeder ältere Code gelten nicht mehr, sobald ein
  neuer angefordert ist.
- **SMS erst nach dem Start** (eigener Schritt): Resend verschickt keine SMS, dafür bräuchte es einen
  zweiten Anbieter (Twilio o. ä.), Kosten pro SMS, Länderfilter und Bot-Prüfung gegen SMS-Betrug.
- **Anmeldewege zum Start:** Apple, Google, E-Mail **oder** Benutzername mit Passwort; Code per Mail
  beim Registrieren und bei „Passwort vergessen". Telefonnummer später (s. o.).

## Anmeldewege in der nativen App

- **Apple/Google** sind gebaut (6b), aber noch als Web-Rücksprung. In der App gehören die
  nativen Fenster dazu (Apple-Blatt, Google-Auswahl, über ein Capacitor-Plugin) und
  `signInWithIdToken` statt Weiterleitung. Apple verlangt „Mit Apple anmelden", sobald Google
  angeboten wird — beides ist geplant.
- **„E-Mail verbergen" bei Apple:** Apple gibt dann eine Weiterleitungsadresse
  (`…@privaterelay.appleid.com`). Mails dorthin kommen nur an, wenn `hokuhealth.app` und der
  Absender im Apple-Entwicklerkonto beim „Private Email Relay" eingetragen sind (Nutzer).
- Gleiche bestätigte E-Mail bei Apple/Google und Passwort-Konto → Supabase verknüpft die Konten.

## Ist-Zustand

- Formular steht (`src/pages/Auth.tsx`, `registrieren()`): Benutzername, E-Mail, Passwort ×2,
  drei Zustimmungen. `signUp` legt Name und Zustimmung in die Konto-Metadaten.
- Ohne Sitzung zeigt Hoku Haken → Brief → „Schau in dein Postfach!" — danach passiert nichts:
  kein Code-Feld, kein „erneut senden", kein Weg zurück in die App.
- `ConsentGate` übernimmt Name und Zustimmung beim ersten Start aus den Metadaten (bleibt so).
- Supabase-Logs: bisher keine Registrierung über Mail sichtbar; ob SMTP/Resend im Dashboard
  schon eingetragen ist, lässt sich von hier nicht lesen.
- Kein `resetPasswordForEmail`, kein `verifyOtp` im Code.

## Aufbau

```
App ── signUp / resend / resetPasswordForEmail ──▶ Supabase Auth
                                                    │ Send Email Hook (HTTPS, signiert)
                                                    ▼
                                    Edge Function `auth-mail`
                                    prüft Signatur, wählt de/en,
                                    baut HTML + Text
                                                    │ Resend API
                                                    ▼
                                           Postfach (Code 123456)
App ◀── verifyOtp({ email, token, type }) → Sitzung → Haken, Portal, Heimflug
```

### 1. Edge Function `auth-mail` (Send Email Hook)

- `supabase/functions/auth-mail/index.ts`, Deploy mit `--no-verify-jwt` (Supabase ruft sie auf,
  geschützt über die Hook-Signatur, Standard Webhooks, Secret `SEND_EMAIL_HOOK_SECRET`).
- Secrets: `RESEND_API_KEY` (nur Sende-Recht, nur Domain hokuhealth.app), `SEND_EMAIL_HOOK_SECRET`,
  `MAIL_FROM` (Vorschlag `Hoku <hallo@hokuhealth.app>`).
- Sprache: `user.user_metadata.sprache` (`de` | `en`), sonst `de` (Konten ohne Angabe stammen aus der Zeit vor dem Start und sind deutsch). Zusätzlich `zeitzone` für die Uhrzeit „gültig bis".
- Alle Arten bedienen, sonst brechen sie still: `signup`, `recovery`, `email_change`,
  `reauthentication`, `magiclink` (Fallback-Text). Jede Mail: Betreff mit Code, großer Code,
  Gültigkeit, „Nicht du? Ignorieren", Text- und HTML-Teil, keine Links außer Impressum/Datenschutz.
- Vorlagen als reine TS-Funktionen in `_shared/` → testbar ohne Netz.
- Fehler von Resend → Antwort 5xx mit Fehlertext, damit Supabase den Fehler an die App gibt.
- Keine Gesundheitsdaten, nur E-Mail, Code, Sprache.

### 2. Supabase-Einstellungen (Dashboard, macht der Nutzer nach Anleitung)

- Authentication → Sign In / Providers → Email: **Confirm email an**, **Secure email change an**.
- Email OTP: Länge **6**, Ablauf **15 min** (900 s).
- Auth Hooks → **Send Email Hook** → HTTPS → URL der Function, Secret erzeugen.
- Rate Limits: Mails/Stunde passend setzen (Hook statt Supabase-Mail hebt das Standardlimit auf).
- **Leaked Password Protection an** (steht seit 6a offen).
- Anleitung dazu: `docs/registrierung/EINSTELLUNGEN.md` (Schritt 2).

### 3. App: Code nach dem Registrieren

- `signUp` schickt zusätzlich `sprache` (App-Sprache, de/en) und `zeitzone` in den Metadaten; Sprachwechsel in der App aktualisiert `sprache` im Konto.
- Ohne Sitzung neue Ansicht **`code`** statt nur Postfach-Hinweis: ein Feld,
  `inputMode="numeric"`, `autoComplete="one-time-code"` (iOS schlägt den Code aus Mail vor),
  Einfügen aus der Zwischenablage, Prüfung bei 6 Ziffern automatisch.
- `verifyOtp({ email, token, type: 'email' })` → Sitzung → derselbe Erfolg wie beim Anmelden.
- Fehler: falsch → X + Schütteln; abgelaufen → Satz + „Neuen Code senden"; zu viele → Sanduhr;
  kein Netz → WLAN-Symbol.
- **„Code erneut senden"** → `auth.resend({ type: 'signup', email })`, 60 s Sperre mit Countdown.
- **„E-Mail ändern"** → zurück ins Formular (Eingaben bleiben).
- App zwischendurch geschlossen: Anmelden mit unbestätigter Adresse liefert
  `email_not_confirmed` → direkt in die Code-Ansicht, neuer Code wird geschickt.
- **Adresse hat schon ein Konto:** Mit „Confirm email" meldet Supabase keinen Fehler, sondern ein
  Konto ohne `identities`. Das wird erkannt und wie heute `login_err_exists` gezeigt, dazu
  „Passwort vergessen?". (Die App verrät vorhandene Namen/Adressen schon heute; bleibt konsistent.)
- Hoku: Brief beim Wechsel in die Code-Ansicht, hört beim Tippen zu, Haken bei Erfolg —
  vorhandene Gesten, keine neuen.

### 4. Passwort vergessen

- Link „Passwort vergessen?" unter dem Passwortfeld → Ansicht `vergessen`: E-Mail
  (Benutzername später, bräuchte die Namenssuche serverseitig).
- `resetPasswordForEmail(email)` → immer dieselbe Antwort („Wenn es ein Konto gibt, kommt ein Code").
- Code-Ansicht (wiederverwendet) mit `type: 'recovery'` → Sitzung → neues Passwort ×2
  (`pruefung.ts`-Regeln) → `updateUser({ password })` → Erfolg wie beim Anmelden.
- Abbruch nach dem Code: Sitzung besteht, Hinweis im Profil nicht nötig (Passwort unverändert).

### 5. Texte (nur de/en, 12 Sprachen bekommen englische Platzhalter)

Neue Schlüssel u. a.: `login_code_titel`, `login_code_hinweis`, `login_code_falsch`,
`login_code_abgelaufen`, `login_code_neu`, `login_code_neu_in`, `login_email_aendern`,
`login_vergessen`, `login_vergessen_hinweis`, `login_neues_pw`, `login_pw_geaendert`.
Mailtexte liegen in der Function, nicht in `locales/`.

### 6. Prüfung

- Unit: Mail-Vorlagen (de/en, alle Arten, kein Code fehlt), Signaturprüfung, Code-Prüfung im Gerät.
- E2E (`e2e/login.spec.ts`): Registrieren → Code-Ansicht → Code (Supabase gemockt) → Landung;
  falscher Code; erneut senden mit Sperre; Passwort vergessen bis Landung.
- Trockenlauf der Function lokal mit `supabase functions serve` und Test-Payload; Resend im
  Testmodus an `delivered@resend.dev`.
- `code-review` und `security-review`, dann iPhone-Test durch den Nutzer.

## Reihenfolge

| Schritt | Inhalt | wer |
|---|---|---|
| 1 | Function `auth-mail` + Vorlagen + Tests | Claude |
| 2 | Anleitung Dashboard; Secrets und Hook eintragen | Claude schreibt, Nutzer klickt |
| 3 | Code-Ansicht, erneut senden, `email_not_confirmed`, vorhandenes Konto | Claude |
| 4 | Passwort vergessen | Claude |
| 5 | Texte de/en | Claude |
| 6 | Reviews, Deploy der Function, iPhone-Test | Claude / Nutzer |

Keine Datenbank-Migration nötig (Sprache steht in den Konto-Metadaten).

## Vom Nutzer gebraucht

- Absenderadresse bestätigen (Vorschlag `Hoku <hallo@hokuhealth.app>`) und ob die Domain in
  Resend `hokuhealth.app` ist (DNS grün).
- In Resend einen API-Schlüssel nur zum Senden anlegen und selbst in Supabase als Secret
  `RESEND_API_KEY` eintragen (nicht in den Chat).
- Im Apple-Entwicklerkonto `hokuhealth.app` und den Absender beim „Private Email Relay" eintragen.
- Datenschutzerklärung: Resend als Dienstleister für den Mailversand nennen; Vertrag zur
  Auftragsverarbeitung (DPA) bei Resend abschließen.

## Folgen der Entscheidung „nativ"

Nicht Teil dieser Arbeit, aber festgehalten: Passkeys hängen an der Domain
`tyd-track-your-dose.vercel.app` (6c) und Apple/Google-Rücksprünge an `/auth?anbieter=…` (6b).
In einer nativen Hülle müssen beide neu gedacht werden.
