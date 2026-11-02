import { expect, test as base } from '@playwright/test'
import { MockSupabase } from './mockSupabase'

/** Fester Zeitpunkt: „Tag 28", „naechste Einnahme" usw. haengen am Datum. */
export const NOW = new Date('2026-09-28T10:00:00+02:00')

/**
 * `mock`: das nachgebildete Supabase, schon im Browser eingehaengt und mit
 * einer angemeldeten Testperson. Vor dem ersten `page.goto` lassen sich
 * Ausgangsdaten anlegen.
 *
 * Nach jedem Test: keine Anfrage, die der Mock nicht kennt, und kein
 * unbehandelter Fehler in der Seite.
 *
 * `dotFrei`: Dot ist für alle frei und käme sonst überall heraus (auf Seiten
 * ohne Leiste von selbst), lüde seinen Kontext und zeichnete die volle
 * Fläche — im Testbrowser ohne Grafikkarte teuer genug, dass Halten und
 * Ziehen zu spät auslösen. Tests, die nicht von Dot handeln, lassen ihn
 * deshalb im Haus; die Dot-Tests setzen `test.use({ dotFrei: true })`.
 */
export const test = base.extend<{ mock: MockSupabase; language: 'de' | 'en'; now: Date; dotFrei: boolean }>({
  language: ['de', { option: true }],
  dotFrei: [false, { option: true }],
  now: [NOW, { option: true }],
  locale: async ({ language }, provide) => {
    await provide(language === 'de' ? 'de-DE' : 'en-GB')
  },
  mock: async ({ page, language, now, dotFrei }, provide) => {
    const mock = new MockSupabase({ now })
    if (!dotFrei) await page.addInitScript(() => { try { localStorage.setItem('tyd.e2e.dot-im-haus', '1') } catch { /* ohne Speicher */ } })
    const pageErrors: string[] = []
    // WebKit meldet Anfragen, die ein Neuladen oder Wegnavigieren abbricht,
    // als Seitenfehler („… due to access control checks.“). Echte CORS-Fehler
    // gibt es hier nicht — jede Anfrage beantwortet der Mock —, also ist das
    // nur der Abbruch und kein Fehler der App.
    page.on('pageerror', error => {
      if (/due to access control checks\.?$/.test(error.message)) return
      pageErrors.push(error.message)
    })
    await page.clock.install({ time: now })
    await mock.install(page, { language })
    await provide(mock)
    expect(mock.unhandled, 'Anfragen ohne Nachbildung').toEqual([])
    expect(pageErrors, 'unbehandelte Fehler in der Seite').toEqual([])
  },
})

export { expect }
