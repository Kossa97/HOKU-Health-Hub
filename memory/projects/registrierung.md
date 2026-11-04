# Registrierung mit Resend

Plan: `docs/registrierung/PLAN.md` (2026-11-03).

## Entschieden (Nutzer 03.11.2026)
- Bestätigung **nur per 6-stelligem Code**, kein Link — die App läuft künftig nativ, nicht im Browser.
- **Eigene Mails de/en** über Resend: Supabase Send Email Hook → Edge Function `auth-mail` → Resend API.
- **Passwort vergessen** wird gleich mit gebaut (Code mit `type: 'recovery'`).

- Kein echter Kopier-Knopf in Mails möglich (kein JavaScript). Dafür: iOS-Ausfüllen „Aus Mail"
  (Apple Mail, `one-time-code`), Code groß mit `user-select: all`, Einfügen-Knopf in der App.
- Code gilt **15 min**, Uhrzeit in der Mail; ein neuer Code macht alte ungültig.
- **SMS/Telefonnummer erst nach dem Start** (Nutzer). Start: Apple, Google, E-Mail/Benutzername.

## Offen
- Absender und Resend-Domain vom Nutzer bestätigen lassen (Vorschlag `Hoku <hallo@hokuhealth.app>`).
- Passkeys (RP-ID Vercel-Domain) und OAuth-Rücksprung passen nicht zu „nativ" — eigene Aufgabe.

## Geburtsdatum (Nutzer 03.11.2026)
- Pflicht bei der Registrierung, ab 18 (`pruefeGeburtsdatum` in `compliance/lib/consent.ts`), gespeichert in
  `profiles.birth_date` (+ altes `age`) und in den Metadaten; Nutzer: „brauchen wir fürs biologische Alter".
- Zustimmungsseite fragt es nur **zusammen mit der Zustimmung** (Apple/Google, neue Bedingungen), weil man es im
  Körperprofil löschen darf. Bestandskonten werden nicht gezwungen.
- Häkchen „18+" gestrichen (Nutzer 04.11.): das Geburtsdatum belegt das Alter; die Zustimmungsseite verlangt ein Datum ab 18, wenn das Profil keins hat oder es unter 18 liegt.
- Offen: Altersgrenze serverseitig (Trigger/Check auf `profiles` beim Anlegen).

## Code-Eingabe und Passwort vergessen (gebaut 04.11.2026)
- `Auth.tsx`: Ansichten `code`, `vergessen`, `neuesPw`; Logik in `features/auth/lib/code.ts` (verifyOtp `email`/`recovery`,
  resend, resetPasswordForEmail, updateUser). Sechs Ziffern prüfen sich selbst; Einfügen-Knopf; „Neuen Code" 60 s gesperrt.
- Vergebene Adresse = Konto ohne `identities` → `login_err_exists`. Anmelden mit unbestätigter Adresse (nur per E-Mail) →
  neuer Code, Code-Ansicht.
- Nach Recovery-Code: Sitzung gilt bis zum Neustart (`merkeAngemeldetBleiben(false)`), erst das neue Passwort setzt
  „Angemeldet bleiben"; zurück = abmelden.
- „Passwort vergessen?" steht in der Zeile von „Angemeldet bleiben" (iPhone SE: sonst rutscht der Knopf aus dem Bild
  und Hoku zeigt nicht mehr darauf — e2e „Absenden während des Hinweises").
- Offen: Benutzername-Anmeldung bei unbestätigter Adresse (Edge Function `login-name` meldet nur 401).

## Knopf „In Hoku öffnen" (Nutzer 04.11.2026)
- Nutzer wollte „mit einem Tipp kopieren"; geht in Mails nicht (kein JavaScript). Gewählt: Knopf öffnet die App und
  bestätigt mit `token_hash` (`/auth?bestaetigen=…&art=signup|recovery`), Code bleibt darunter.
- Native: `@capacitor/app` (appUrlOpen → `src/lib/appLinks.tsx`), iOS-Entitlements `applinks:hokuhealth.app`, Android
  Intent-Filter `autoVerify`, `public/.well-known/*` mit Platzhaltern `TEAM_ID` / SHA-256 — Nutzer liefert beides
  (docs/registrierung/APP-LINKS.md). `cap sync` hat dabei auch Haptics in die nativen Projekte nachgetragen.
- Mail: Codefeld 52 px, „Tippen und halten zum Kopieren", Gültigkeit groß im Feld; App nennt 15 Minuten.

## Live (04.11.2026)
- PR Kossa97/HOKU-Health-Hub#173 auf main (Nutzer: ohne CI-Ende mergen). auth-mail v1 deployt (verify_jwt aus).
- Team-ID 5K69NY3K6F in AASA und als DEVELOPMENT_TEAM im Xcode-Projekt. Android-SHA-256 fehlt (keine Play Console).
- Nutzer schaltet den Hook im Dashboard ein (EINSTELLUNGEN.md); MacBook kommt, erster Xcode-Start mit Anleitung.
