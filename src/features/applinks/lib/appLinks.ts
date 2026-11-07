import { BENUTZERNAME } from '../../auth/lib/pruefung'

/**
 * „In Hoku öffnen“ (Profil 2c, Spec 5.1): iOS Universal Links und Android App
 * Links. Die Werte hier müssen zu den nativen Projekten und den Dateien unter
 * `public/.well-known/` passen; `scripts/applinks.test.ts` prüft das.
 */

/** Domain der geteilten Profile (Spec 2c, Frage 1: entschieden). */
export const APP_LINK_HOST = 'hokuhealth.app'
export const APP_LINK_ORIGIN = `https://${APP_LINK_HOST}`

/** Bundle-ID der iOS-App (Xcode `PRODUCT_BUNDLE_IDENTIFIER`, `capacitor.config.ts`). */
export const IOS_BUNDLE_ID = 'com.kossa97.tyd'
/** Paketname der Android-App (`applicationId` in `android/app/build.gradle`). */
export const ANDROID_PACKAGE = 'com.trackyourdose.app'

const PROFILE_PATH = /^\/u\/([^/]+)\/?$/

/**
 * Adresse, mit der das System die App geöffnet hat → Route in der App.
 *
 * Nur `https://hokuhealth.app/u/<name>` mit einem Namen aus dem
 * Nutzernamen-Zeichensatz wird zur Route `/u/<name klein>`; Abfrage und Anker
 * fallen weg. Alles andere (fremde Hosts, andere Pfade, Ports, Zugangsdaten in
 * der Adresse, andere Schemata) ergibt `null` und wird ignoriert.
 */
export function appLinkRoute(url: string): string | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:') return null
  if (parsed.hostname !== APP_LINK_HOST || parsed.port !== '') return null
  if (parsed.username !== '' || parsed.password !== '') return null

  const match = PROFILE_PATH.exec(parsed.pathname)
  if (!match) return null
  let name: string
  try {
    name = decodeURIComponent(match[1])
  } catch {
    return null
  }
  if (!BENUTZERNAME.test(name)) return null
  return `/u/${encodeURIComponent(name.toLowerCase())}`
}
