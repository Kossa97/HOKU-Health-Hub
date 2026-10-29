# Apple und Google einrichten

Stand 27.10.2026. Die App meldet in der Web-Version (Safari, Home-Bildschirm) über
**Supabase-OAuth** an: Weiterleitung zum Anbieter, zurück auf `/auth?anbieter=…`. Die Knöpfe
erscheinen erst, wenn das Build es weiß (Schritt 4). Bis dahin steht im Login kein toter Knopf.

Supabase-Projekt: `xcskcojakolphtbuqfbw`
Rückruf-Adresse für beide Anbieter (überall gleich):

```
https://xcskcojakolphtbuqfbw.supabase.co/auth/v1/callback
```

Statt `<deine-domain>` unten die Adresse der Web-App eintragen (die Vercel-Domain bzw. die
eigene Domain).

---

## 1. Supabase: erlaubte Rücksprung-Adressen

Supabase-Dashboard → **Authentication → URL Configuration**

1. **Site URL**: `https://<deine-domain>`
2. **Redirect URLs** hinzufügen:
   - `https://<deine-domain>/**`
   - zum Testen am Rechner zusätzlich `http://localhost:5175/**`

Ohne diesen Eintrag landet man nach Apple/Google auf der Site URL statt auf `/auth`, und Dot
zeigt keinen Erfolg.

---

## 2. Google

### 2.1 Google Cloud Console

1. <https://console.cloud.google.com/> öffnen, ein Projekt anlegen oder wählen.
2. **APIs & Dienste → OAuth-Zustimmungsbildschirm** → *Get started*:
   - App-Name: `Dot: Health Hub`, Support-E-Mail, Kontakt-E-Mail.
   - Zielgruppe: **Extern**.
   - Unter *Autorisierte Domains*: `supabase.co` und deine Domain.
   - Bereiche (Scopes): `openid`, `email`, `profile` — mehr nicht.
3. **APIs & Dienste → Anmeldedaten → Anmeldedaten erstellen → OAuth-Client-ID**:
   - Anwendungstyp: **Webanwendung**.
   - *Autorisierte JavaScript-Quellen*: `https://<deine-domain>`
   - *Autorisierte Weiterleitungs-URIs*: `https://xcskcojakolphtbuqfbw.supabase.co/auth/v1/callback`
   - **Client-ID** und **Clientschlüssel** kopieren.
4. Solange die App im Status *Testing* ist, können sich nur eingetragene Testnutzer anmelden.
   Für alle: Zustimmungsbildschirm → **App veröffentlichen**.

### 2.2 Supabase

Dashboard → **Authentication → Sign In / Providers → Google** → aktivieren, Client-ID und
Clientschlüssel eintragen, speichern.

---

## 3. Apple

Braucht eine bezahlte Mitgliedschaft im Apple Developer Program.

### 3.1 Apple Developer Console (<https://developer.apple.com/account>)

1. **Team ID** notieren (10 Zeichen, oben rechts im Konto).
2. **App ID** (Identifiers → App IDs): die App-ID der App (`com.kossa97.tyd`) öffnen oder
   anlegen, unter *Capabilities* **Sign in with Apple** einschalten. Server-zu-Server-
   Benachrichtigungen leer lassen (unterstützt Supabase nicht).
3. **Services ID** (Identifiers → Services IDs → +), z. B. `com.kossa97.tyd.web`:
   - **Sign in with Apple** einschalten → *Configure*:
     - Primary App ID: `com.kossa97.tyd`
     - **Domains and Subdomains**: `xcskcojakolphtbuqfbw.supabase.co`
     - **Return URLs**: `https://xcskcojakolphtbuqfbw.supabase.co/auth/v1/callback`
4. **Key** (Keys → +): Name z. B. `Supabase Sign in with Apple`, **Sign in with Apple**
   anhaken, Primary App ID wählen, anlegen. Die Datei **`AuthKey_XXXXXXXXXX.p8`** herunterladen
   (geht nur einmal!) und sicher aufbewahren, **Key ID** notieren. Die Datei nie ins Repo legen.
5. Wenn Nutzer „E-Mail verbergen" wählen, schickt Apple Mails an eine Relay-Adresse weiter, aber
   nur von registrierten Absendern: Services → **Sign in with Apple for Email Communication** →
   die Absender-Domain bzw. -Adresse der Supabase-Mails eintragen (die eigene SMTP-Domain, falls
   eingerichtet).

### 3.2 Geheimschlüssel erzeugen

Apple will für die Web-Anmeldung einen signierten Schlüssel (JWT) statt eines festen Passworts.
Auf der Supabase-Seite *Login with Apple* gibt es dafür einen Generator: Team ID, Key ID,
Services ID und den Inhalt der `.p8` eingeben → Schlüssel kopieren.
Die Seite: <https://supabase.com/docs/guides/auth/social-login/auth-apple>

**Wichtig:** Dieser Schlüssel läuft nach **6 Monaten** ab. Danach scheitert die Apple-Anmeldung,
bis ein neuer eingetragen ist. Gleich eine Erinnerung im Kalender anlegen (alle 5 Monate).

### 3.3 Supabase

Dashboard → **Authentication → Sign In / Providers → Apple** → aktivieren:
- **Client IDs**: die Services ID (`com.kossa97.tyd.web`) als **erster** Eintrag. Kommt später
  die native App dazu, deren App-ID dahinter.
- **Secret Key (for OAuth)**: der Schlüssel aus 3.2.

---

## 4. Die Knöpfe einschalten

Die App zeigt einen Knopf nur, wenn beim Bauen die passende Variable gesetzt ist:

| Variable | Wert | Wirkung |
|---|---|---|
| `VITE_AUTH_APPLE` | `1` | „Mit Apple fortfahren" |
| `VITE_AUTH_GOOGLE` | `1` | „Mit Google fortfahren" |

- **Vercel**: Project → Settings → Environment Variables → für *Production* (und *Preview*)
  anlegen, dann **neu deployen** (die Werte stecken im Build).
- **Am Rechner**: in `.env.local` eintragen, Dev-Server neu starten.

Erst einschalten, wenn der Anbieter in Supabase fertig eingerichtet ist (Schritt 2 bzw. 3).
Apple und Google gehören zusammen: Bietet die App später nativ Google an, verlangt der App Store
auch Apple (Richtlinie 4.8).

---

## 5. Prüfen

1. Abgemeldet `/auth` öffnen → Anmelden: oben „Mit Apple fortfahren" und „Mit Google fortfahren".
2. Google antippen → Google-Anmeldung → zurück in der App: Dot denkt, Haken, Portal, Heimflug.
3. Dasselbe mit Apple (auch mit „E-Mail verbergen").
4. Beim Anbieter abbrechen → zurück im Login: rotes X, „Das hat nicht geklappt."
5. **Neues Konto** über Apple/Google: nach dem Portal kommt zuerst die Zustimmungsseite (18+,
   Bedingungen, Gesundheitsdaten). Das Profil bekommt den Namen `user_xxxxxxxx`; ändern geht im
   Profil. Apple liefert im Web-Ablauf keinen Namen mit.

Apple, Google (und später Face ID) bleiben immer angemeldet, „Angemeldet bleiben" gilt nur für
E-Mail/Benutzername.
