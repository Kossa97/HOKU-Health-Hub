import { describe, expect, it } from 'vitest'
import { referenceBarGeometry } from './referenceBar'

describe('referenceBarGeometry', () => {
  it('gibt null zurück, wenn kein Referenzbereich existiert', () => {
    expect(referenceBarGeometry(500, { min: null, max: null, source: 'none' })).toBeNull()
  })

  it('platziert einen Wert in der Mitte des Referenzbereichs bei 50%', () => {
    const geo = referenceBarGeometry(650, { min: 400, max: 900, source: 'catalog' })!
    expect(geo.valuePercent).toBeCloseTo(50, 1)
  })

  it('legt die grüne Zone innerhalb der Skala an', () => {
    const geo = referenceBarGeometry(650, { min: 400, max: 900, source: 'catalog' })!
    expect(geo.zoneStartPercent).toBeGreaterThan(0)
    expect(geo.zoneEndPercent).toBeLessThan(100)
    expect(geo.zoneEndPercent).toBeGreaterThan(geo.zoneStartPercent)
  })

  it('hält einen weit außerhalb liegenden Wert innerhalb der Skala', () => {
    const geo = referenceBarGeometry(99999, { min: 400, max: 900, source: 'catalog' })!
    expect(geo.valuePercent).toBeLessThanOrEqual(100)
    expect(geo.valuePercent).toBeGreaterThanOrEqual(0)
  })

  it('hält einen weit darunter liegenden Wert innerhalb der Skala', () => {
    const geo = referenceBarGeometry(-500, { min: 400, max: 900, source: 'catalog' })!
    expect(geo.valuePercent).toBeGreaterThanOrEqual(0)
  })

  it('behandelt eine einseitige Obergrenze wie einen Bereich ab 0', () => {
    const einseitig = referenceBarGeometry(0.5, { min: null, max: 1, source: 'catalog' })!
    const beidseitig = referenceBarGeometry(0.5, { min: 0, max: 1, source: 'catalog' })!
    expect(einseitig.zoneStartPercent).toBeCloseTo(beidseitig.zoneStartPercent, 5)
    expect(einseitig.valuePercent).toBeCloseTo(beidseitig.valuePercent, 5)
  })

  it('beginnt links nie unter 0, wenn der Bereich nicht negativ ist', () => {
    const geo = referenceBarGeometry(14, { min: 5, max: 25, source: 'lab' })!
    expect(geo.scaleMin).toBe(0)
    expect(geo.scaleMax).toBe(35)
    expect(geo.zoneStartPercent).toBeCloseTo((5 / 35) * 100, 5)
    expect(referenceBarGeometry(0.5, { min: null, max: 1, source: 'catalog' })!.scaleMin).toBe(0)
  })

  it('gibt null bei einem nicht-numerischen Wert zurück', () => {
    expect(referenceBarGeometry(Number.NaN, { min: 400, max: 900, source: 'catalog' })).toBeNull()
  })

  it('gibt null zurück, wenn nur eine Untergrenze existiert', () => {
    expect(referenceBarGeometry(95, { min: 90, max: null, source: 'catalog' })).toBeNull()
  })
})
