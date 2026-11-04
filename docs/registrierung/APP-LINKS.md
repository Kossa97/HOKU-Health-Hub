# Knopf „In Hoku öffnen" — App-Links einrichten

Der Knopf in der Bestätigungs- und Passwort-Mail führt zu
`https://hokuhealth.app/auth?bestaetigen=…&art=signup|recovery`. Ist die App installiert,
öffnet sich die **App** (Universal Link / App Link) und bestätigt sofort — ohne Tippen,
ohne Kopieren. Ohne App öffnet sich die Web-App, die dasselbe tut.

Gebaut (Claude, 04.11.2026):

| Teil | Datei |
|---|---|
| Knopf in der Mail | `supabase/functions/auth-mail/logik.ts` (`appLink`), `vorlagen.ts` |
| App liest den Link | `src/features/auth/lib/code.ts` (`linkAusAdresse`, `linkPruefen`), `src/pages/Auth.tsx` |
| Native App springt zur Anmeldung | `src/lib/appLinks.tsx` (`@capacitor/app`, `appUrlOpen`) |
| iOS: Domain freigeben | `ios/App/App/App.entitlements` (`applinks:hokuhealth.app`), im Projekt eingetragen |
| iOS: Gegenstück auf der Website | `public/.well-known/apple-app-site-association` |
| Android: Domain freigeben | `android/app/src/main/AndroidManifest.xml` (Intent-Filter, `autoVerify`) |
| Android: Gegenstück auf der Website | `public/.well-known/assetlinks.json` |

## Was nur der Nutzer kann

Bis beide Angaben eingetragen sind und die App neu gebaut ist, öffnet der Knopf die Web-App
statt der App (funktioniert, nur eben im Browser).

1. **Apple Team-ID** — erledigt: `5K69NY3K6F` (Nutzer 04.11.2026), eingetragen in
   `public/.well-known/apple-app-site-association` und als `DEVELOPMENT_TEAM` im Xcode-Projekt.
   Die Fähigkeit *Associated Domains* ist über die Entitlements-Datei gesetzt; beim ersten Start
   in Xcode legt die automatische Signierung sie im Apple-Konto an.
2. **Android-Fingerabdruck** — Google Play Console → App → *Testen und veröffentlichen* →
   *App-Integrität* → *App-Signaturschlüssel-Zertifikat* → *SHA-256-Fingerabdruck*.
   Claude trägt ihn in `public/.well-known/assetlinks.json` ein.

Danach: neue App-Version bauen (Xcode / Android Studio). Die Website-Dateien gehen mit der
nächsten Veröffentlichung auf hokuhealth.app live.

## Prüfen

- iOS: Mail auf dem iPhone öffnen, Knopf antippen → die App öffnet sich (nicht Safari).
  Apple lädt die Freigabe über ein CDN; nach dem ersten Veröffentlichen kann es bis zu
  einem Tag dauern.
- Android: `adb shell pm get-app-links com.kossa97.tyd` zeigt `hokuhealth.app: verified`.

## Hinweise

- Ändert sich die App-ID (`com.kossa97.tyd`, Releaseplan: „App-IDs einheitlich festlegen"),
  müssen beide Dateien unter `.well-known` mitgeändert werden.
- Der Link ist so viel wert wie der Code: einmal gültig, 15 Minuten. Er enthält keine
  E-Mail-Adresse, nur den Prüfwert von Supabase (`token_hash`).
