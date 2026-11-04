// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { afterEach, describe, expect, it } from 'vitest'
import de from '../../../i18n/locales/de.json'
import en from '../../../i18n/locales/en.json'
import { hokuCodeUrl } from '../lib/hokuCode'
import { HokuCode } from './HokuCode'

afterEach(cleanup)

async function i18nIn(lng: 'de' | 'en') {
  const i18n = createInstance()
  await i18n.use(initReactI18next).init({
    lng, resources: { de: { translation: de }, en: { translation: en } }, interpolation: { escapeValue: false },
  })
  return i18n
}

describe('HokuCode', () => {
  it.each([
    ['de', 'Hoku-Code für hokuhealth.app/u/mara'],
    ['en', 'Hoku code for hokuhealth.app/u/mara'],
  ] as const)('Bild mit Beschriftung (%s)', async (lng, label) => {
    const i18n = await i18nIn(lng)
    const { getByRole } = render(
      <I18nextProvider i18n={i18n}><HokuCode url={hokuCodeUrl('Mara')} className="h-[124px] w-[124px]" /></I18nextProvider>,
    )
    const img = getByRole('img', { name: label })
    expect(img.querySelector('svg')).not.toBeNull()
    expect(img.className).toContain('h-[124px]')
  })

  it('zwei Codes auf einer Seite teilen sich keine IDs', async () => {
    const i18n = await i18nIn('de')
    const url = hokuCodeUrl('mara')
    const { container } = render(
      <I18nextProvider i18n={i18n}><HokuCode url={url} /><HokuCode url={url} /></I18nextProvider>,
    )
    const ids = [...container.querySelectorAll('[id]')].map(e => e.id)
    expect(ids).toHaveLength(4)
    expect(new Set(ids).size).toBe(4)
  })
})
