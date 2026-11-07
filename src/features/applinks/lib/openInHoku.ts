import { ANDROID_PACKAGE } from './appLinks'

/**
 * Wohin „In Hoku öffnen“ auf der Web-Seite `/u/<name>` führt (Spec 5.1).
 *
 * Universal Links greifen in Safari nicht bei Links auf dieselbe Domain; ein Tipp
 * auf der Seite selbst öffnet die App deshalb nie direkt:
 * - iOS: Knopf in den App Store; dazu das Smart-App-Banner (`apple-itunes-app`),
 *   das bei installierter App „Öffnen“ zeigt.
 * - Android: `intent://…` öffnet die App, sonst den Play Store.
 * - Desktop: Store-Knöpfe und der Hoku-Code zum Scannen mit dem Handy.
 * - Fehlt die Store-Adresse für die Plattform (Apps noch nicht veröffentlicht):
 *   `/auth`, „Im Browser öffnen“ (Entscheidung 2).
 *
 * Nur die Wahl des Ziels; die Seite selbst baut Task 4.
 */

export type WebPlatform = 'ios' | 'android' | 'desktop'

export interface StoreConfig {
  /** `https://apps.apple.com/…` */
  appStoreUrl?: string
  /** `https://play.google.com/store/apps/details?id=…` */
  playStoreUrl?: string
}

export type StoreLink = { store: 'app-store' | 'play-store'; href: string }

export type OpenInHokuTarget =
  | { kind: 'auth'; href: '/auth' }
  | { kind: 'app-store'; href: string }
  | { kind: 'android-intent'; href: string }
  | { kind: 'desktop'; stores: StoreLink[]; showHokuCode: true }

export const AUTH_TARGET = { kind: 'auth', href: '/auth' } as const

const APP_STORE_HOST = 'apps.apple.com'
const PLAY_STORE_HOST = 'play.google.com'

/** Nur echte Store-Adressen über HTTPS; alles andere gilt als „nicht gesetzt“. */
function storeUrl(value: string | undefined, host: string): string | null {
  const raw = value?.trim()
  if (!raw) return null
  try {
    const url = new URL(raw)
    if (url.protocol !== 'https:' || url.hostname !== host) return null
    if (url.username !== '' || url.password !== '' || url.port !== '') return null
    return url.toString()
  } catch {
    return null
  }
}

/** Store-Adressen aus den Umgebungsvariablen (`.env.example`). */
export function storeConfigFromEnv(env: Record<string, string | boolean | undefined> = import.meta.env): StoreConfig {
  const text = (key: string) => (typeof env[key] === 'string' ? (env[key] as string) : undefined)
  return {
    appStoreUrl: text('VITE_APP_STORE_URL'),
    playStoreUrl: text('VITE_PLAY_STORE_URL'),
  }
}

/** Plattform aus dem User-Agent; iPadOS meldet sich als Mac mit Touch. */
export function detectWebPlatform(userAgent: string, maxTouchPoints = 0): WebPlatform {
  if (/android/i.test(userAgent)) return 'android'
  if (/iPhone|iPad|iPod/.test(userAgent)) return 'ios'
  if (/Macintosh/.test(userAgent) && maxTouchPoints > 1) return 'ios'
  return 'desktop'
}

/** `intent://` für Chrome auf Android: App öffnen, sonst `fallbackUrl`. */
export function androidIntentUrl(profileUrl: string, fallbackUrl: string): string {
  const url = new URL(profileUrl)
  return `intent://${url.host}${url.pathname}#Intent;scheme=https;package=${ANDROID_PACKAGE};`
    + `S.browser_fallback_url=${encodeURIComponent(fallbackUrl)};end`
}

/** Ziel von „In Hoku öffnen“ für Plattform, Profiladresse und Store-Adressen. */
export function openInHokuTarget(platform: WebPlatform, profileUrl: string, config: StoreConfig): OpenInHokuTarget {
  const appStore = storeUrl(config.appStoreUrl, APP_STORE_HOST)
  const playStore = storeUrl(config.playStoreUrl, PLAY_STORE_HOST)

  if (platform === 'ios') return appStore ? { kind: 'app-store', href: appStore } : AUTH_TARGET
  if (platform === 'android') {
    return playStore ? { kind: 'android-intent', href: androidIntentUrl(profileUrl, playStore) } : AUTH_TARGET
  }
  const stores: StoreLink[] = []
  if (appStore) stores.push({ store: 'app-store', href: appStore })
  if (playStore) stores.push({ store: 'play-store', href: playStore })
  return stores.length ? { kind: 'desktop', stores, showHokuCode: true } : AUTH_TARGET
}
