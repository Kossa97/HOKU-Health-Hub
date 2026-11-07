# „In Hoku öffnen“ einrichten (Universal Links / App Links)

Stand 04.11.2026, Profil 2c, Spec `docs/superpowers/specs/2026-11-02-profil-p2c-web-design.md`
Abschnitt 5. Ist Hoku installiert, öffnet ein Tipp auf `https://hokuhealth.app/u/<name>`
direkt die App auf dem Profil; sonst die Web-Seite.

Im Repo ist alles vorbereitet bis auf die Werte, die nur der Nutzer hat. Solange
Platzhalter drin sind, scheitert `npm run applinks:check` (der normale Testlauf nicht).
Ohne App-Update öffnen Links weiter die Web-Seite; nichts geht kaputt.

| Was | Bundle/Paket |
|---|---|
| iOS | `com.kossa97.tyd` |
| Android | `com.trackyourdose.app` |
| Domain | `hokuhealth.app` (ohne `www`) |

---

## 1. Platzhalter ersetzen

### `TEAMID_PLATZHALTER` — Apple Team-ID

Datei `public/.well-known/apple-app-site-association`, in `appIDs`:

```
"appIDs": ["TEAMID_PLATZHALTER.com.kossa97.tyd"]
```

`TEAMID_PLATZHALTER` durch die 10-stellige Team-ID ersetzen (Großbuchstaben/Ziffern, z. B.
`AB12CD34EF`). Zu finden unter <https://developer.apple.com/account> → *Membership details* →
*Team ID*. Der Punkt und `com.kossa97.tyd` bleiben stehen.

### `SHA256_PLATZHALTER_PLAY_APP_SIGNING` und `SHA256_PLATZHALTER_UPLOAD` — Android-Fingerabdrücke

Datei `public/.well-known/assetlinks.json`, in `sha256_cert_fingerprints`:

- `SHA256_PLATZHALTER_PLAY_APP_SIGNING` → Play Console → App → *Test und veröffentlichen* →
  *App-Integrität* → *App-Signatur* → **Zertifikat des App-Signaturschlüssels**, SHA-256.
  Das ist der Schlüssel, mit dem Google die Store-Version signiert.
- `SHA256_PLATZHALTER_UPLOAD` → auf derselben Seite **Zertifikat des Uploadschlüssels**,
  SHA-256 (für selbst installierte Release-Builds). Zum Testen mit Debug-Builds zusätzlich
  den Debug-Schlüssel als dritten Eintrag:
  `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android`
  (oder `cd android && ./gradlew signingReport`).

Format: 32 Paare in Großbuchstaben mit Doppelpunkt, `AB:CD:…:EF`. Nicht benötigte Einträge
löschen, Platzhalter nicht stehen lassen.

Danach:

```
npm run applinks:check
```

muss „alles eingetragen und stimmig“ melden.

## 2. Vercel: AASA-Datei als JSON ausliefern

Apple verlangt `Content-Type: application/json`; die Datei hat keine Endung. In
`vercel.json` unter `routes` **vor** `{ "handle": "filesystem" }` eintragen:

```json
{ "src": "/.well-known/apple-app-site-association", "headers": { "Content-Type": "application/json" }, "continue": true },
```

`assetlinks.json` bekommt den Typ über die Endung. Beide Dateien kopiert Vite aus `public/`
unverändert nach `dist/.well-known/`.

Außerdem: `hokuhealth.app` darf nicht auf `www.` (oder umgekehrt) weiterleiten, und
Vercel-Zugriffsschutz darf Production nicht sperren — Apple und Google rufen die Dateien
ohne Anmeldung und ohne Weiterleitung ab.

## 3. Stores (Web-Knopf „In Hoku öffnen“)

In Vercel als Umgebungsvariablen (Production) setzen, sobald die Apps veröffentlicht sind
(siehe `.env.example`). Fehlen sie, führt der Knopf zu `/auth` (Entscheidung 2):

- `VITE_APP_STORE_URL` — `https://apps.apple.com/app/…/id<Zahl>`
- `VITE_PLAY_STORE_URL` — `https://play.google.com/store/apps/details?id=com.trackyourdose.app`
- `VITE_APP_STORE_ID` — nur die Zahl aus der App-Store-Adresse (Smart-App-Banner)

## 4. Apps neu bauen und hochladen

1. `npm install`, `npm run build`, `npx cap sync` (trägt `@capacitor/app` in die nativen
   Projekte ein; dabei kommen auch bisher fehlende Plugins wie `@capacitor/haptics` dazu).
2. **Xcode**: Target *App* → *Signing & Capabilities* → Team wählen. Die Fähigkeit
   *Associated Domains* mit `applinks:hokuhealth.app` ist über `App/App.entitlements`
   schon eingetragen; mit automatischer Signierung legt Xcode das Provisioning-Profil neu an.
   Erscheint sie nicht: *+ Capability* → *Associated Domains* → `applinks:hokuhealth.app`.
3. **Android**: Intent-Filter mit `android:autoVerify="true"` steht in `AndroidManifest.xml`.
4. Update in beide Stores.

## 5. Nach dem Deploy prüfen

- `npm run applinks:check -- --live` — beide Dateien: Status 200, keine Weiterleitung,
  `application/json`, Inhalt wie im Repo.
- Apple-CDN (kann bis zu einem Tag dauern):
  `curl -s https://app-site-association.cdn-apple.com/a/v1/hokuhealth.app`
- Google: *Statement List Tester* auf
  <https://developers.google.com/digital-asset-links/tools/generator>
  (Domain `hokuhealth.app`, Paket `com.trackyourdose.app`, Fingerabdruck).
- Android-Gerät: `adb shell pm verify-app-links --re-verify com.trackyourdose.app`, dann
  `adb shell pm get-app-links com.trackyourdose.app` → `hokuhealth.app: verified`.
- iPhone: Link in Notizen oder Nachrichten antippen (nicht in Safari eintippen) → Hoku öffnet
  das Profil.
