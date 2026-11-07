import { describe, expect, it } from 'vitest'
import { buildAvailableMetrics } from './metricDefinitions'

describe('buildAvailableMetrics mit Umfängen', () => {
  it('führt eine Stelle mit Punkten direkt nach dem Gewicht auf', () => {
    const metrics = buildAvailableMetrics(new Map([['weight', 2], ['umfang:waist', 1]]), [], new Map())
    expect(metrics.map(m => m.key)).toEqual(['weight', 'umfang:waist'])
    expect(metrics[1]).toMatchObject({ unit: 'cm', isLab: false })
  })

  it('lässt Stellen ohne Punkte weg', () => {
    const metrics = buildAvailableMetrics(new Map([['weight', 2], ['umfang:waist', 0]]), [], new Map())
    expect(metrics.map(m => m.key)).toEqual(['weight'])
  })

  it('setzt Umfänge vor die Laborwerte', () => {
    const metrics = buildAvailableMetrics(
      new Map([['weight', 1], ['body_fat', 1], ['umfang:chest', 1], ['Testosteron', 1]]),
      ['Testosteron'],
      new Map([['Testosteron', 'ng/dL']]),
    )
    expect(metrics.map(m => m.key)).toEqual(['weight', 'body_fat', 'umfang:chest', 'Testosteron'])
  })

  it('fuehrt Muskelmasse mit Punkten direkt nach dem Koerperfett', () => {
    const metrics = buildAvailableMetrics(
      new Map([['weight', 1], ['body_fat', 1], ['muscle_mass', 2], ['umfang:chest', 1]]),
      [],
      new Map(),
    )
    expect(metrics.map(m => m.key)).toEqual(['weight', 'body_fat', 'muscle_mass', 'umfang:chest'])
    expect(metrics[2]).toMatchObject({ unit: 'kg', isLab: false })
  })

  it('laesst Muskelmasse ohne Punkte weg', () => {
    const metrics = buildAvailableMetrics(new Map([['weight', 1], ['muscle_mass', 0]]), [], new Map())
    expect(metrics.map(m => m.key)).toEqual(['weight'])
  })
})
