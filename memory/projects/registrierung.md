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
