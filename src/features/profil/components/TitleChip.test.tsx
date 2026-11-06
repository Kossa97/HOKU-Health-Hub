// @vitest-environment jsdom

import { cleanup, fireEvent, render } from '@testing-library/react'
import { createInstance } from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import type { ReactNode } from 'react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import de from '../../../i18n/locales/de.json'
import en from '../../../i18n/locales/en.json'

vi.mock('../services/profileMedia', () => ({ signedMediaUrl: vi.fn(async () => null) }))

import { RangHinweis, TitleChip } from './TitleChip'
import { ProfilKopf } from './ProfilKopf'

const i18n = createInstance()
beforeAll(async () => {
  await i18n.use(initReactI18next).init({ lng: 'de', resources: { de: { translation: de }, en: { translation: en } }, interpolation: { escapeValue: false } })
})
afterEach(cleanup)
const mit = (node: ReactNode) => render(<I18nextProvider i18n={i18n}>{node}</I18nextProvider>)

describe('TitleChip', () => {
  it('andere ohne Titel: nichts, kein Platzhalter', () => {
    const { container } = mit(<TitleChip title={null} />)
    expect(container.innerHTML).toBe('')
  })

  it('andere: Antippen erklärt den Rang (Tage mit Eintrag)', () => {
    const { container } = mit(<TitleChip title={{ kind: 'rank', id: 'rank_4' }} />)
    const chip = container.querySelector<HTMLButtonElement>('[data-title-chip="rank_4"]')!
    expect(chip.textContent).toBe('Routinier')
    const erklaerung = container.querySelector<HTMLElement>('[data-title-meaning]')!
    expect(erklaerung.hidden).toBe(true)
    fireEvent.click(chip)
    expect(erklaerung.hidden).toBe(false)
    expect(erklaerung.textContent).toBe('Routinier · Rang ab 100 Tagen mit eigenem Eintrag. Einmal erreicht, für immer.')
    expect(chip.getAttribute('aria-expanded')).toBe('true')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(erklaerung.hidden).toBe(true)
  })

  it('andere: Abzeichen-Titel nennt das Abzeichen', () => {
    const { container } = mit(<TitleChip title={{ kind: 'badge', id: 'run_50' }} />)
    fireEvent.click(container.querySelector('[data-title-chip]')!)
    expect(container.querySelector('[data-title-meaning]')!.textContent).toContain('Titel aus dem Abzeichen „50 Läufe“.')
  })

  it('eigene Sicht: Pfeil öffnet das Sheet, Sichtbarkeits-Chip daneben; ohne Titel „Noch kein Titel“', () => {
    const onOpen = vi.fn()
    const { container, rerender } = mit(<TitleChip title={{ kind: 'badge', id: 'streak_100' }} own={{ onOpen, visibilityChip: <span data-test-vis /> }} />)
    const chip = container.querySelector<HTMLButtonElement>('[data-title-chip="streak_100"]')!
    expect(chip.textContent).toBe('Unaufhaltsam')
    expect(chip.getAttribute('aria-haspopup')).toBe('dialog')
    fireEvent.click(chip)
    expect(onOpen).toHaveBeenCalledOnce()
    expect(container.querySelector('[data-test-vis]')).not.toBeNull()
    rerender(<I18nextProvider i18n={i18n}><TitleChip title={null} own={{ onOpen, visibilityChip: null }} /></I18nextProvider>)
    expect(container.querySelector('[data-title-chip="none"]')!.textContent).toBe('Noch kein Titel')
  })
})

describe('RangHinweis', () => {
  it('nur der nächste Schritt, Einzahl und Höchststufe', () => {
    const { container, rerender } = mit(<RangHinweis entryDays={12} />)
    expect(container.textContent).toBe('Rang: noch 38 Tage mit Eintrag bis Dranbleiber')
    rerender(<I18nextProvider i18n={i18n}><RangHinweis entryDays={9} /></I18nextProvider>)
    expect(container.textContent).toBe('Rang: noch 1 Tag mit Eintrag bis Entdecker')
    rerender(<I18nextProvider i18n={i18n}><RangHinweis entryDays={0} /></I18nextProvider>)
    expect(container.textContent).toBe('Dein erster Eintrag macht dich zum Neuling.')
    rerender(<I18nextProvider i18n={i18n}><RangHinweis entryDays={400} /></I18nextProvider>)
    expect(container.textContent).toBe('Höchster Rang erreicht: Legende.')
  })
})

describe('ProfilKopf mit Titel', () => {
  it('eigene Sicht: lokaler Titel statt Server, Stufen-Chip „title“, Hinweis darunter', () => {
    const { container } = mit(
      <ProfilKopf name="Mara" username="mara" avatarPath={null} fields={{ title: { kind: 'rank', id: 'rank_1' } }}
        visibility={{}} onChangeVisibility={vi.fn()}
        ownTitle={{ title: { kind: 'rank', id: 'rank_2' }, entryDays: 12, onOpen: vi.fn() }} />,
    )
    expect(container.querySelector('[data-title-chip]')!.getAttribute('data-title-chip')).toBe('rank_2')
    expect(container.querySelector('[data-vis-chip="title"]')!.getAttribute('data-vis')).toBe('me')
    expect(container.querySelector('[data-rank-hint]')!.textContent).toContain('38 Tage')
  })

  it('fremde Sicht: Titel vom Server, ohne Hinweis und ohne Chip', () => {
    const { container } = mit(<ProfilKopf name="Max" username="max" avatarPath={null} fields={{ title: { kind: 'badge', id: 'hyrox_20' } }} />)
    expect(container.querySelector('[data-title-chip]')!.textContent).toBe('Hybrid-Athlet')
    expect(container.querySelector('[data-rank-hint]')).toBeNull()
    expect(container.querySelector('[data-vis-chip]')).toBeNull()
  })
})
