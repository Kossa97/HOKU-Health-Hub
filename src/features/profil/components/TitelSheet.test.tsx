// @vitest-environment jsdom

import { cleanup, fireEvent, render } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import de from '../../../i18n/locales/de.json'
import en from '../../../i18n/locales/en.json'
import type { BadgeState } from '../lib/badges'
import { BADGE_IDS, type BadgeId } from '../lib/badgeIds'
import { wornTitle, type TitleSettings } from '../lib/titles'
import { TitelSheet, type TitelSheetProps } from './TitelSheet'

const i18n = createInstance()
beforeAll(async () => {
  await i18n.use(initReactI18next).init({ lng: 'de', resources: { de: { translation: de }, en: { translation: en } }, interpolation: { escapeValue: false } })
})
afterEach(cleanup)

function states(earned: BadgeId[], have: Partial<Record<BadgeId, number>> = {}): BadgeState[] {
  return BADGE_IDS.map(id => {
    const e = earned.includes(id)
    return { id, earned: e, on: e ? '2026-09-01' : null, earnedOn: e ? '2026-09-01' : null, have: have[id] ?? 0, need: 10, unit: 'count' }
  })
}

const EARNED: BadgeId[] = ['rank_1', 'rank_2', 'rank_3', 'rank_4', 'run_10', 'run_50', 'streak_100', 'body_fat_5']

function zeige(over: Partial<TitelSheetProps> & { settings?: TitleSettings } = {}) {
  const settings = over.settings ?? { choice: null, personalAllowed: false, consents: {} }
  const props: TitelSheetProps = {
    settings,
    worn: wornTitle(settings, new Set(EARNED)),
    states: states(EARNED, { hike_10: 9 }),
    entryDays: 150,
    visibility: { body_fat: 'friends', title: 'all' },
    onChangeVisibility: vi.fn(),
    onChoose: vi.fn(),
    onPersonalAllowed: vi.fn(),
    onConsent: vi.fn(),
    onClose: vi.fn(),
    ...over,
  }
  const r = render(<I18nextProvider i18n={i18n}><TitelSheet {...props} /></I18nextProvider>)
  return { ...r, props }
}

describe('TitelSheet', () => {
  it('Rang getragen: Leiter mit aktuellem Rang und Fortschritt zum nächsten', () => {
    const { container } = zeige()
    expect(container.querySelector('[data-title-worn]')!.getAttribute('data-title-worn')).toBe('rank_4')
    expect(container.querySelector('[data-title-option="rank"]')!.getAttribute('aria-checked')).toBe('true')
    expect(container.querySelector('[data-rank-step="rank_4"]')!.getAttribute('data-rank-stage')).toBe('cur')
    expect(container.querySelector('[data-rank-step="rank_3"]')!.getAttribute('data-rank-stage')).toBe('done')
    expect(container.querySelector('[data-rank-progress]')!.textContent).toContain('noch 50 Tage mit Eintrag bis Veteran')
    expect(container.querySelector('[data-title-footnote]')!.textContent).toContain('Einmal erreicht, für immer.')
  })

  it('verdiente Leiter zeigt die höchste Stufe; Wahl speichert die erste', () => {
    const { container, props } = zeige()
    const lauf = container.querySelector<HTMLButtonElement>('[data-title-option="run_10"]')!
    expect(lauf.getAttribute('data-title-shown')).toBe('run_50')
    expect(lauf.textContent).toContain('Läufer')
    expect(lauf.textContent).toContain('Stufe 2 von 3')
    fireEvent.click(lauf)
    expect(props.onChoose).toHaveBeenCalledWith('run_10')
  })

  it('offene: fünf, Rest über „Alle offenen ansehen“; am nächsten dran zuerst', () => {
    const { container } = zeige()
    expect(container.querySelectorAll('[data-title-open]')).toHaveLength(5)
    expect(container.querySelector('[data-title-open]')!.getAttribute('data-title-open')).toBe('hike_10')
    fireEvent.click(container.querySelector('[data-title-open-all]')!)
    expect(container.querySelectorAll('[data-title-open]').length).toBeGreaterThan(5)
  })

  it('persönliche Titel: ab Werk aus, Schalter ruft zurück', () => {
    const { container, props } = zeige()
    const schalter = container.querySelector('[data-title-personal-switch]')!
    expect(schalter.getAttribute('aria-checked')).toBe('false')
    expect(container.querySelector('[data-title-personal-list]')).toBeNull()
    fireEvent.click(schalter)
    expect(props.onPersonalAllowed).toHaveBeenCalledWith(true)
  })

  it('erster Tragen eines persönlichen Titels: Bestätigung nötig, Abbrechen trägt nichts', () => {
    const { container, props } = zeige({ settings: { choice: null, personalAllowed: true, consents: {} } })
    const zeile = container.querySelector('[data-title-personal="body_fat_5"]')!
    expect(zeile.textContent).toContain('höchstens Freunde, wie dein Feld Körperfett')
    fireEvent.click(zeile)
    const dialog = document.querySelector('[data-title-consent="body_fat_5"]')!
    expect(dialog.getAttribute('role')).toBe('alertdialog')
    expect(dialog.textContent).toContain('dass du dein Körperfett um mindestens 5 % gesenkt hast')
    expect(dialog.textContent).toContain('Gesundheitsdatum')
    expect(dialog.textContent).toContain('Körperfett: Freunde')
    fireEvent.click(document.querySelector('[data-title-consent-cancel]')!)
    expect(document.querySelector('[data-title-consent]')).toBeNull()
    expect(props.onChoose).not.toHaveBeenCalled()
    expect(props.onConsent).not.toHaveBeenCalled()

    fireEvent.click(zeile)
    fireEvent.click(document.querySelector('[data-title-consent-ok]')!)
    expect(props.onConsent).toHaveBeenCalledWith('body_fat_5')
  })

  it('schon bestätigt: kein Dialog; getragen auf „Alle“ sagt, wann das Web ihn zeigt', () => {
    const settings: TitleSettings = { choice: 'body_fat_5', personalAllowed: true, consents: { body_fat_5: '2026-09-01' } }
    const { container, props } = zeige({ settings, visibility: { body_fat: 'all', title: 'all' } })
    expect(container.querySelector('[data-title-worn]')!.getAttribute('data-title-worn')).toBe('body_fat_5')
    expect(container.querySelector('[data-title-worn-sight]')!.textContent).toContain('Im Web und auf der Link-Karte nur, wenn auch sein Feld auf „Alle“ steht')
    expect(container.querySelector('[data-title-consented]')).not.toBeNull()
    fireEvent.click(container.querySelector('[data-title-personal="body_fat_5"]')!)
    expect(document.querySelector('[data-title-consent]')).toBeNull()
    expect(props.onChoose).toHaveBeenCalledWith('body_fat_5')
  })

  it('persönlicher Titel mit engerem Quellfeld: Sichtbarkeit folgt dem Feld', () => {
    const settings: TitleSettings = { choice: 'body_fat_5', personalAllowed: true, consents: { body_fat_5: '2026-09-01' } }
    const { container } = zeige({ settings, visibility: { body_fat: 'friends', title: 'all' } })
    expect(container.querySelector('[data-title-worn-sight]')!.textContent).toBe('Steht neben deinem Namen in deinem Profil und bei Freunden.')
  })

  it('Sichtbar für: setzt die Stufe des Felds „title“', () => {
    const { container, props } = zeige()
    const knoepfe = [...container.querySelectorAll<HTMLButtonElement>('[data-title-visibility] button')]
    fireEvent.click(knoepfe.find(b => b.textContent === 'Freunde')!)
    expect(props.onChangeVisibility).toHaveBeenCalledWith('title', 'friends')
  })
})
