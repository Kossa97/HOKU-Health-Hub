// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { LOOKS } from '../../../lib/look'
import { HOKU_FARBEN, PALETTEN, STANDARD_JE_LOOK, aktiveHokuFarbe, leseFarbWahl, muster, setzeFarbWahl } from './hokuFarbe'

describe('Hokus Farbe', () => {
  afterEach(() => localStorage.clear())
  it('jedes App-Design hat eine Standardfarbe aus der Auswahl', () => {
    for (const l of LOOKS) expect(HOKU_FARBEN).toContain(STANDARD_JE_LOOK[l])
  })
  it('„Passend zum Design" folgt dem Design, eine eigene Wahl gilt immer', () => {
    expect(aktiveHokuFarbe('nacht', 'auto')).toBe('heute')
    expect(aktiveHokuFarbe('schwarz', 'auto')).toBe('cyanweiss')
    expect(aktiveHokuFarbe('nacht', 'minze')).toBe('minze')
  })
  it('ohne gültige Wahl gilt „Passend zum Design"', () => {
    expect(leseFarbWahl()).toBe('auto')
    localStorage.setItem('tyd.hoku.farbe', 'lila')
    expect(leseFarbWahl()).toBe('auto')
  })
  it('die Wahl wird gemerkt und gemeldet', () => {
    const fn = vi.fn()
    window.addEventListener('tyd-hoku-farbe', fn)
    setzeFarbWahl('sonne')
    expect(leseFarbWahl()).toBe('sonne')
    expect(fn).toHaveBeenCalledTimes(1)
    window.removeEventListener('tyd-hoku-farbe', fn)
  })
  it('jede Farbe hat drei Töne für die Auswahl', () => {
    for (const f of HOKU_FARBEN) expect(muster(f)).toHaveLength(3)
    for (const p of Object.values(PALETTEN)) for (const c of [p.vorn, p.rand, p.hinten, p.schein]) expect(c.every(v => v >= 0 && v <= 255)).toBe(true)
  })
})
