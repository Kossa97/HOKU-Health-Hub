import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { loadDateLocale } from './dateLocales'

// Zum Start nur Deutsch und Englisch. Die übrigen Locale-Dateien bleiben im
// Repo, sind aber nicht wählbar, bis jemand mit der Sprache drübergelesen hat.
export const LANGUAGES = [
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
] as const

export type LanguageCode = (typeof LANGUAGES)[number]['code']

// RTL-Sprachen
export const RTL_LANGUAGES = ['ar']

// Locale-JSONs als Lazy-Chunks: Es werden nur aktive Sprache + Fallback (en)
// geladen statt aller Bundles im Haupt-Bundle.
const localeModules = import.meta.glob<{ default: Record<string, unknown> }>('./locales/*.json')

const lazyJsonBackend = {
  type: 'backend' as const,
  init() {},
  read(lng: string, _ns: string, callback: (err: unknown, data?: unknown) => void) {
    const loader = localeModules[`./locales/${lng}.json`]
    if (!loader) {
      callback(new Error(`Kein Locale-Bundle für "${lng}"`))
      return
    }
    loader().then(m => callback(null, m.default)).catch(err => callback(err))
  },
}

/** Resolves, sobald aktive Sprache + Fallback + date-fns-Locale geladen sind. */
export const i18nReady = i18n
  .use(lazyJsonBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    // Alles, was weder Deutsch noch Englisch ist (auch ein früher gespeichertes
    // 'fr'), landet auf Englisch.
    fallbackLng: 'en',
    supportedLngs: LANGUAGES.map(l => l.code),
    nonExplicitSupportedLngs: true,
    load: 'languageOnly',            // 'de-DE' → Bundle 'de'
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'tyd_lang',
    },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },   // Bundles laden asynchron; kein Suspense nötig
  })
  .then(() => loadDateLocale(i18n.language))
  // Auch wenn ein Bundle nicht lädt: <html lang/dir> passend zur Sprache setzen.
  .finally(() => applyDirection(i18n.language ?? 'en'))

// Bei Sprachwechsel passende date-fns-Locale nachziehen. Das erneute Emit stößt
// ein Re-Render der useTranslation-Komponenten an, sobald die Locale da ist;
// beim zweiten Durchlauf ändert sich nichts mehr (loadDateLocale → false).
i18n.on('languageChanged', lng => {
  void loadDateLocale(lng).then(changed => {
    if (changed) i18n.emit('languageChanged', lng)
  })
})

// RTL-Richtung setzen
export function applyDirection(lang: string) {
  const dir = RTL_LANGUAGES.includes(lang.split('-')[0]) ? 'rtl' : 'ltr'
  document.documentElement.setAttribute('dir', dir)
  document.documentElement.setAttribute('lang', lang)
}

/** Sprache wechseln und für den nächsten Start merken. */
export function setLanguage(code: LanguageCode) {
  void i18n.changeLanguage(code)
  localStorage.setItem('tyd_lang', code)
  applyDirection(code)
}

export default i18n
