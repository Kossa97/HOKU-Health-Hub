import { describe, expect, it } from 'vitest'
import {
  detectWebPlatform,
  openInHokuTarget,
  smartAppBannerContent,
  storeConfigFromEnv,
  type StoreConfig,
} from './openInHoku'

const PROFILE = 'https://hokuhealth.app/u/anna'
const APP_STORE = 'https://apps.apple.com/app/hoku-health-hub/id1234567890'
const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.trackyourdose.app'
const BOTH: StoreConfig = { appStoreUrl: APP_STORE, playStoreUrl: PLAY_STORE, appStoreId: '1234567890' }

describe('openInHokuTarget', () => {
  it('ohne Store-Adressen: /auth auf allen Plattformen (Entscheidung 2)', () => {
    for (const platform of ['ios', 'android', 'desktop'] as const) {
      expect(openInHokuTarget(platform, PROFILE, {})).toEqual({ kind: 'auth', href: '/auth' })
    }
  })

  it('iOS: App Store', () => {
    expect(openInHokuTarget('ios', PROFILE, BOTH)).toEqual({ kind: 'app-store', href: APP_STORE })
  })

  it('iOS ohne App-Store-Adresse: /auth, auch wenn Play da ist', () => {
    expect(openInHokuTarget('ios', PROFILE, { playStoreUrl: PLAY_STORE })).toEqual({ kind: 'auth', href: '/auth' })
  })

  it('Android: intent:// mit Play Store als Rückfall', () => {
    const target = openInHokuTarget('android', PROFILE, BOTH)
    expect(target).toEqual({
      kind: 'android-intent',
      href: 'intent://hokuhealth.app/u/anna#Intent;scheme=https;package=com.trackyourdose.app;'
        + `S.browser_fallback_url=${encodeURIComponent(PLAY_STORE)};end`,
    })
  })

  it('Android ohne Play-Store-Adresse: /auth', () => {
    expect(openInHokuTarget('android', PROFILE, { appStoreUrl: APP_STORE })).toEqual({ kind: 'auth', href: '/auth' })
  })

  it('Desktop: vorhandene Store-Knöpfe und Hoku-Code', () => {
    expect(openInHokuTarget('desktop', PROFILE, BOTH)).toEqual({
      kind: 'desktop',
      stores: [{ store: 'app-store', href: APP_STORE }, { store: 'play-store', href: PLAY_STORE }],
      showHokuCode: true,
    })
    expect(openInHokuTarget('desktop', PROFILE, { playStoreUrl: PLAY_STORE })).toEqual({
      kind: 'desktop',
      stores: [{ store: 'play-store', href: PLAY_STORE }],
      showHokuCode: true,
    })
  })

  it('falsche Store-Adressen gelten als nicht gesetzt', () => {
    const wrong: StoreConfig = {
      appStoreUrl: 'http://apps.apple.com/app/id1',
      playStoreUrl: 'https://play.google.com.evil.example/x',
    }
    expect(openInHokuTarget('desktop', PROFILE, wrong)).toEqual({ kind: 'auth', href: '/auth' })
    expect(openInHokuTarget('ios', PROFILE, { appStoreUrl: 'javascript:alert(1)' })).toEqual({ kind: 'auth', href: '/auth' })
    expect(openInHokuTarget('ios', PROFILE, { appStoreUrl: '   ' })).toEqual({ kind: 'auth', href: '/auth' })
  })
})

describe('smartAppBannerContent', () => {
  it('nur mit numerischer App-ID', () => {
    expect(smartAppBannerContent(BOTH, PROFILE)).toBe(`app-id=1234567890, app-argument=${PROFILE}`)
    expect(smartAppBannerContent({}, PROFILE)).toBeNull()
    expect(smartAppBannerContent({ appStoreId: 'id123456' }, PROFILE)).toBeNull()
    expect(smartAppBannerContent({ appStoreId: '123' }, PROFILE)).toBeNull()
  })
})

describe('detectWebPlatform', () => {
  it.each([
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15', 0, 'ios'],
    ['Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)', 5, 'ios'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 5, 'ios'],
    ['Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 0, 'desktop'],
    ['Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130 Mobile', 5, 'android'],
    ['Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/130', 0, 'desktop'],
  ] as const)('%s → %s', (ua, touch, expected) => {
    expect(detectWebPlatform(ua, touch)).toBe(expected)
  })
})

describe('storeConfigFromEnv', () => {
  it('liest die drei Variablen, ignoriert Nicht-Texte', () => {
    expect(storeConfigFromEnv({
      VITE_APP_STORE_URL: APP_STORE,
      VITE_PLAY_STORE_URL: PLAY_STORE,
      VITE_APP_STORE_ID: '1234567890',
      DEV: true,
    })).toEqual(BOTH)
    expect(storeConfigFromEnv({})).toEqual({ appStoreUrl: undefined, playStoreUrl: undefined, appStoreId: undefined })
  })
})
