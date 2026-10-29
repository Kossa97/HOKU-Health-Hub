# Face ID (Passkeys) einschalten

Stand 27.10.2026. Face ID in der Web-App läuft über **Passkeys** (WebAuthn) von Supabase Auth.
Auf dem iPhone liegt der Passkey im iCloud-Schlüsselbund, iOS fragt beim Anmelden mit Face ID;
derselbe Passkey gilt auch auf Mac und iPad mit demselben Apple-Account.

Supabase nennt die Passkey-Schnittstelle **experimentell**; in der App spricht nur
`src/features/auth/lib/passkey.ts` mit ihr.

## 1. Supabase-Dashboard

**Authentication → Passkeys** → *Enable Passkey authentication* einschalten:

| Feld | Wert |
|---|---|
| Relying Party Display Name | `Dot: Health Hub` |
| Relying Party ID | `tyd-track-your-dose.vercel.app` |
| Relying Party Origins | `https://tyd-track-your-dose.vercel.app,http://localhost:5175` |

**Die Relying Party ID nicht mehr ändern**, sobald jemand einen Passkey eingerichtet hat: jeder
Passkey ist an sie gebunden und wird bei einer Änderung unbrauchbar. Kommt später eine eigene
Domain, müssen alle ihren Passkey neu einrichten.

Vercel-Vorschauen (`tyd-track-your-dose-git-…vercel.app`) gehören nicht zu dieser ID — dort
funktionieren Passkeys nicht, nur in Produktion und am Rechner unter `localhost`.

## 2. Einschalten in der App

Wie bei Apple/Google erst, wenn Schritt 1 erledigt ist:

- **Vercel**: Environment Variable `VITE_AUTH_PASSKEY` = `1` (Production), neu deployen.
- **Am Rechner**: `VITE_AUTH_PASSKEY=1` in `.env.local`.

## 3. Was dann passiert

1. Nach einer Anmeldung mit Passwort, Benutzername, Apple oder Google fragt die App **einmal**,
   nachdem Dot in der Leiste gelandet ist: „Nächstes Mal mit Face ID anmelden?"
   („Später" fragt nicht wieder.)
2. Danach steht im Login rechts neben „Anmelden" ein Face-ID-Knopf — nur auf Geräten, auf denen
   ein Passkey eingerichtet oder benutzt wurde.
3. Antippen → Face ID → Haken, Portal, Heimflug wie gewohnt. Face ID bleibt immer angemeldet.
4. Im **Profil** unter „Face ID und Passkeys": eingerichtete Passkeys sehen, weitere hinzufügen,
   einzelne entfernen.

Wurde ein Passkey anderswo gelöscht, sagt der Login „Diesen Passkey kennen wir nicht mehr" und
der Knopf verschwindet auf dem Gerät.

## Noch nicht dabei

Safari kann einen Passkey schon im Feld „E-Mail oder Benutzername" vorschlagen (Autofill). Die
Passkey-Anmeldung von supabase-js bietet das (Stand 2.105) nicht direkt an; dafür bräuchte es die
zweistufige Schnittstelle mit eigenem WebAuthn-Aufruf.
