// @vitest-environment jsdom

import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DOSAGE_FORMS } from '../../features/my-stack/lib/dosageForms'
import { FORM_UMRISSE } from '../../features/my-stack/stage/formUmrisse'
import { SeitenSilhouette } from './Silhouette'
import { leseStackAnsicht, leseStackBild, merkeStackBild, vergissStackBild, type StackBild } from './silhouettenBild'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

const PEN: StackBild = { form: 'pen', pegel: false, buehne: 3, gesamt: 4 }

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('silhouettenBild', () => {
  it('merkt sich, was zuerst auf der Bühne steht', () => {
    merkeStackBild(PEN)
    expect(leseStackBild()).toEqual(PEN)
  })

  it('vergisst beim Abmelden', () => {
    merkeStackBild(PEN)
    vergissStackBild()
    expect(leseStackBild()).toBeNull()
  })

  it('verwirft Unlesbares und Formen ohne Bühne', () => {
    expect(leseStackBild()).toBeNull()
    localStorage.setItem('tyd_silhouette_stack', '{kaputt')
    expect(leseStackBild()).toBeNull()
    localStorage.setItem('tyd_silhouette_stack', JSON.stringify({ ...PEN, form: 'other' }))
    expect(leseStackBild()).toBeNull()
    localStorage.setItem('tyd_silhouette_stack', JSON.stringify({ ...PEN, gesamt: -1 }))
    expect(leseStackBild()).toBeNull()
  })

  it('ohne Speicher: kein Fehler, allgemeiner Umriss', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('gesperrt') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('gesperrt') })
    expect(() => merkeStackBild(PEN)).not.toThrow()
    expect(leseStackBild()).toBeNull()
    expect(leseStackAnsicht()).toBe('vials')
  })

  it('jede Bühnenform hat einen Umriss', () => {
    for (const form of DOSAGE_FORMS) {
      if (!form.stageRenderer) continue
      expect(FORM_UMRISSE[form.stageRenderer].pfade.length, form.key).toBeGreaterThan(0)
    }
  })
})

describe('Silhouette von My Stack', () => {
  const umrissBox = (container: HTMLElement) => container.querySelector('svg.lg-ph-form')?.getAttribute('viewBox')

  it('zeigt die Form, die beim letzten Besuch vorn stand', () => {
    merkeStackBild(PEN)
    const { container } = render(<SeitenSilhouette art="stack" />)
    expect(umrissBox(container)).toBe(FORM_UMRISSE.pen.viewBox)
    // „+", ein Strich, zwei Punkte, „1 / 3" — und kein Füllstand unter dem Pen
    expect(container.querySelectorAll('.mb-2.mt-1 .lg-ph')).toHaveLength(5)
  })

  it('ohne Gemerktes ein Vial', () => {
    const { container } = render(<SeitenSilhouette art="stack" />)
    expect(umrissBox(container)).toBe(FORM_UMRISSE.vial.viewBox)
  })

  it('in der Listenansicht Zeilen statt Bühne', () => {
    merkeStackBild(PEN)
    localStorage.setItem('tyd_peptide_view', 'list')
    const { container } = render(<SeitenSilhouette art="stack" />)
    expect(umrissBox(container)).toBeUndefined()
    expect(container.querySelectorAll('.lg-skel-card > div')).toHaveLength(4)
  })
  it('nichts auf der Bühne: Reiter und Zeilen, keine Form', () => {
    merkeStackBild({ form: null, pegel: false, buehne: 0, gesamt: 2 })
    const { container } = render(<SeitenSilhouette art="stack" />)
    expect(umrissBox(container)).toBeUndefined()
    expect(container.querySelectorAll('.lg-skel-card > div')).toHaveLength(2)
  })
})
