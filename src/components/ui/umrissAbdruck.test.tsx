// @vitest-environment jsdom

import { render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FORM_UMRISSE } from '../../features/my-stack/stage/formUmrisse'
import { SeitenSilhouette } from './Silhouette'
import {
  abdruckAb, abdruckSchluessel, leseAbdruck, merkeAbdruck, nimmAbdruck, vergissAbdruecke, type Abdruck,
} from './umrissAbdruck'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

const ABDRUCK: Abdruck = { v: 1, breite: 390, inhalt: 366, kaesten: [[0, 0, 200, 32, 9, 't'], [0, 60, 366, 140, 24, 'k'], [150, 220, 43, 332, 0, 'f', 'pen']] }

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 664 })
})

afterEach(() => {
  localStorage.clear()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('Abdruck merken und lesen', () => {
  it('einer je Seite, Kennungen zählen nicht', () => {
    expect(abdruckSchluessel('/my-stack/')).toBe('/my-stack')
    expect(abdruckSchluessel('/')).toBe('/')
    expect(abdruckSchluessel('/lab/study/123456')).toBe('/lab/study/:id')
    expect(abdruckSchluessel('/blutspiegel/3f2b8c1e-9a4d-4e6f-8b2a-1c3d5e7f9a0b')).toBe('/blutspiegel/:id')
  })

  it('liest, was gemerkt wurde — nur bei passender Fensterbreite', () => {
    merkeAbdruck('/my-stack', ABDRUCK)
    expect(leseAbdruck('/my-stack/')).toEqual(ABDRUCK)
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 768 })
    expect(leseAbdruck('/my-stack')).toBeNull()
  })

  it('verwirft Unlesbares und unbekannte Formen', () => {
    localStorage.setItem('tyd_umriss:/x', '{kaputt')
    expect(leseAbdruck('/x')).toBeNull()
    localStorage.setItem('tyd_umriss:/x', JSON.stringify({ ...ABDRUCK, kaesten: [[0, 0, 10, 10, 0, 'f', 'raumschiff']] }))
    expect(leseAbdruck('/x')).toBeNull()
    localStorage.setItem('tyd_umriss:/x', JSON.stringify({ ...ABDRUCK, v: 2 }))
    expect(leseAbdruck('/x')).toBeNull()
  })

  it('ohne Speicher kein Fehler', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('gesperrt') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('gesperrt') })
    expect(() => merkeAbdruck('/', ABDRUCK)).not.toThrow()
    expect(leseAbdruck('/')).toBeNull()
  })

  it('beim Abmelden vergessen, anderes bleibt', () => {
    merkeAbdruck('/', ABDRUCK)
    merkeAbdruck('/kalender', ABDRUCK)
    localStorage.setItem('tyd_peptide_view', 'list')
    vergissAbdruecke()
    expect(leseAbdruck('/')).toBeNull()
    expect(leseAbdruck('/kalender')).toBeNull()
    expect(localStorage.getItem('tyd_peptide_view')).toBe('list')
  })

  it('höchstens 30 Seiten — die ältesten fallen weg', () => {
    for (let i = 0; i < 32; i++) merkeAbdruck(`/lab/peptipedia/stoff-${i}`, { ...ABDRUCK, zeit: i })
    const gemerkt = Object.keys(localStorage).filter(k => k.startsWith('tyd_umriss:'))
    expect(gemerkt).toHaveLength(30)
    expect(leseAbdruck('/lab/peptipedia/stoff-0')).toBeNull()
    expect(leseAbdruck('/lab/peptipedia/stoff-31')).not.toBeNull()
  })

  it('ab einer Stelle: was darunter folgt, auf sie bezogen', () => {
    expect(abdruckAb(ABDRUCK, 0, 60)?.kaesten).toEqual([[0, 0, 366, 140, 24, 'k'], [150, 160, 43, 332, 0, 'f', 'pen']])
    expect(abdruckAb(ABDRUCK, 0, 900)).toBeNull()
  })
})

describe('nimmAbdruck', () => {
  // jsdom misst nichts: jedes Element bekommt seinen Kasten aus data-kasten
  function kaesten() {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const [x, y, w, h] = (this.getAttribute('data-kasten') ?? '0,0,0,0').split(',').map(Number)
      return { left: x, top: y, width: w, height: h, right: x + w, bottom: y + h, x, y, toJSON: () => ({}) } as DOMRect
    })
  }

  it('Karten, Knöpfe, Bühnenformen; Symbole, Ausgeblendetes und Feststehendes nicht', () => {
    kaesten()
    document.body.innerHTML = `
      <main data-kasten="0,0,390,664" style="padding: 16px 12px">
        <div data-kasten="12,16,366,200" style="background-color: rgb(20, 20, 20); border-top-left-radius: 24px">
          <button data-kasten="24,28,120,40" style="background-color: rgb(40, 40, 40); border-top-left-radius: 999px"><svg data-kasten="30,36,18,18"></svg></button>
          <div data-umriss-form="pen" data-kasten="180,40,43,160"><div data-kasten="180,40,43,160" style="background-color: red"></div></div>
          <img data-kasten="24,90,100,100">
        </div>
        <div data-kasten="12,230,366,40" style="display: none; background-color: red"></div>
        <div data-umriss-aus data-kasten="12,230,366,40" style="background-color: red"></div>
        <nav data-kasten="0,600,390,64" style="position: fixed; background-color: red"></nav>
        <div data-kasten="12,900,366,40" style="background-color: red"></div>
      </main>`
    const abdruck = nimmAbdruck(document.querySelector('main')!)
    expect(abdruck?.breite).toBe(390)
    expect(abdruck?.kaesten).toEqual([
      [0, 0, 366, 200, 24, 'k'],
      [12, 12, 120, 40, 20, 'p'],
      [168, 24, 43, 160, 0, 'f', 'pen'],
      [12, 74, 100, 100, 0, 'p'],
    ])
  })
})

describe('nimmAbdruck in Scrollflächen', () => {
  it('zählt wie ungescrollt: ein Element 100 px weiter oben steht an seinem Platz', () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const [x, y, w, h] = (this.getAttribute('data-kasten') ?? '0,0,0,0').split(',').map(Number)
      return { left: x, top: y, width: w, height: h, right: x + w, bottom: y + h, x, y, toJSON: () => ({}) } as DOMRect
    })
    document.body.innerHTML = `
      <main data-kasten="0,0,390,664">
        <div id="flaeche" data-kasten="0,100,390,400" style="overflow-y: auto">
          <div data-kasten="0,50,390,40" style="background-color: red"></div>
        </div>
      </main>`
    Object.defineProperty(document.getElementById('flaeche')!, 'scrollTop', { value: 100 })
    expect(nimmAbdruck(document.querySelector('main')!)?.kaesten).toEqual([[0, 150, 390, 40, 0, 'p']])
  })
})

describe('Silhouette mit Abdruck', () => {
  it('zeigt den Abdruck der Seite statt des gezeichneten Umrisses', () => {
    merkeAbdruck('/my-stack', ABDRUCK)
    const { container } = render(<SeitenSilhouette art="stack" pfad="/my-stack" />)
    expect(container.querySelector('svg.lg-ph-form')?.getAttribute('viewBox')).toBe(FORM_UMRISSE.pen.viewBox)
    expect(container.querySelectorAll('.lg-skel-card')).toHaveLength(1)
  })

  it('ohne Abdruck der gezeichnete Umriss', () => {
    const { container } = render(<SeitenSilhouette art="stack" pfad="/my-stack" />)
    expect(container.querySelector('svg.lg-ph-form')?.getAttribute('viewBox')).toBe(FORM_UMRISSE.vial.viewBox)
  })
})

describe('useAbdruckNehmen', () => {
  it('nimmt nach Ruhe ab, nicht bei Fehlern, und nichts mehr nach dem Seitenwechsel', async () => {
    vi.useFakeTimers()
    const { renderHook } = await import('@testing-library/react')
    const { useAbdruckNehmen } = await import('./umrissAbdruck')
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const [x, y, w, h] = (this.getAttribute('data-kasten') ?? '0,0,0,0').split(',').map(Number)
      return { left: x, top: y, width: w, height: h, right: x + w, bottom: y + h, x, y, toJSON: () => ({}) } as DOMRect
    })
    document.body.innerHTML = `<main data-kasten="0,0,390,664"><div data-kasten="0,10,200,40" style="background-color: red"></div></main>`
    const ref = { current: document.querySelector('main') }
    const { rerender, unmount } = renderHook(({ pfad }) => useAbdruckNehmen(ref, pfad), { initialProps: { pfad: '/a' } })
    await vi.advanceTimersByTimeAsync(1500)
    expect(leseAbdruck('/a')).not.toBeNull()

    // Fehlermeldung auf der Seite: der Stand wird nicht gemerkt
    rerender({ pfad: '/b' })
    ref.current!.insertAdjacentHTML('beforeend', '<p data-umriss-nicht-merken>Fehler</p>')
    await vi.advanceTimersByTimeAsync(1500)
    expect(leseAbdruck('/b')).toBeNull()

    // Seitenwechsel, bevor die Ruhe um ist: nichts unter dem alten Pfad
    ref.current!.querySelector('[data-umriss-nicht-merken]')!.remove()
    rerender({ pfad: '/c' })
    unmount()
    await vi.advanceTimersByTimeAsync(1500)
    expect(leseAbdruck('/c')).toBeNull()
    vi.useRealTimers()
  })
})
