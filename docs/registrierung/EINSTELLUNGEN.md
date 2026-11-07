# Mailversand einschalten — Klickanleitung

Für den Nutzer. **Schritte 1 und 2 gehen sofort.** Die Schritte 3 bis 5 erst, wenn Claude
meldet, dass die App die Code-Eingabe hat — sonst bekäme man einen Code, könnte ihn aber
nirgends eingeben. Bis Schritt 4 aktiv ist, bleibt alles, wie es ist.

Projekt: **peptid-tracker** (supabase.com → Dashboard).

## 1. Schlüssel bei Resend anlegen

1. resend.com → **API Keys** → **Create API Key**.
2. Name: `hoku-auth-mail`, Permission: **Sending access**, Domain: **hokuhealth.app**.
3. Den Schlüssel kopieren (er wird nur einmal angezeigt). Nicht in einen Chat einfügen.

## 2. Schlüssel bei Supabase hinterlegen

Edge Functions → **Secrets** → **Add new secret**:

| Name | Wert |
|---|---|
| `RESEND_API_KEY` | der Schlüssel aus Schritt 1 |
| `MAIL_FROM` | `Hoku <hallo@hokuhealth.app>` |
| `MAIL_REPLY_TO` | Adresse, an der Antworten wirklich ankommen (leer lassen = an den Absender) |

## 3. Code-Einstellungen

Authentication → **Sign In / Providers** → **Email**:

- **Confirm email**: an
- **Secure email change**: an
- **Email OTP Length**: 6
- **Email OTP Expiration**: 900 (Sekunden = 15 Minuten). Wird das je geändert, das Secret `OTP_MINUTEN` passend setzen — sonst nennt die Mail eine falsche Gültigkeit.

Authentication → **Attack Protection** (bzw. Passwords):

- **Leaked password protection**: an

## 4. Hook einschalten

Erst wenn Claude gemeldet hat, dass die Function `auth-mail` bereitsteht.

1. Authentication → **Hooks** → **Add hook** → **Send Email hook**.
2. Typ **HTTPS**, URL: `https://xcskcojakolphtbuqfbw.supabase.co/functions/v1/auth-mail`
3. **Generate secret** → den angezeigten Wert (`v1,whsec_…`) kopieren.
4. Zurück zu Edge Functions → Secrets: `SEND_EMAIL_HOOK_SECRET` = dieser Wert.
5. Hook speichern und **Enable** einschalten.

## 5. Rate Limits

Authentication → **Rate Limits**: „Rate limit for sending emails" auf etwa **100 pro Stunde**
(mit eigenem Versand lässt es sich anheben; Standard ist sehr niedrig).

## 6. Test

In der App mit einer eigenen Adresse registrieren → Mail mit Code kommt von Hoku. Klappt es
nicht: Claude Bescheid geben, die Logs der Function zeigen den Grund.

## Apple: „E-Mail verbergen"

Damit Mails an versteckte Apple-Adressen (`…@privaterelay.appleid.com`) ankommen:
developer.apple.com → Certificates, Identifiers & Profiles → **Services** →
**Sign in with Apple for Email Communication** → Domain `hokuhealth.app` und Absender
`hallo@hokuhealth.app` eintragen. Apple prüft dabei SPF — Resend hat es beim Einrichten
der Domain schon gesetzt.
