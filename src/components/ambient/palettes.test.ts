import { describe, expect, it } from 'vitest'
import { DEFAULT_PALETTE, ambientForPath } from './palettes'

describe('ambientForPath', () => {
  it('Startseite und unbekannte Pfade: die Grundbühne', () => {
    expect(ambientForPath('/').palette).toEqual(DEFAULT_PALETTE)
    expect(ambientForPath('/irgendwas').palette).toEqual(DEFAULT_PALETTE)
  })

  it('jeder Bereich hat seine Farbe oben; Unterseiten erben sie', () => {
    expect(ambientForPath('/blutwerte').palette.top).toBe('#ff375f')
    expect(ambientForPath('/simulation/neu').palette.top).toBe(ambientForPath('/simulation').palette.top)
  })

  it('der längste passende Pfad gewinnt, ohne Teilwort-Treffer', () => {
    expect(ambientForPath('/lab/peptipedia/bpc-157').palette).toEqual(ambientForPath('/lab/peptipedia').palette)
    expect(ambientForPath('/lab/peptipedia').palette).not.toEqual(ambientForPath('/lab').palette)
    expect(ambientForPath('/labor').palette).toEqual(DEFAULT_PALETTE)
  })

  it('Arbeitsseiten sind leiser als Übersichten', () => {
    expect(ambientForPath('/rechner').level).toBeLessThan(ambientForPath('/progress').level)
    expect(ambientForPath('/profil').level).toBeLessThan(ambientForPath('/').level)
  })
})
