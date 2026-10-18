import { describe, expect, it } from 'vitest'
import type { TrainingSession } from '../types'
import { byInjectionDay, glp1Insight, isGlp1Substance } from './glp1'

const now = new Date('2026-10-18T12:00:00Z')
const daysAgo = (d: number) => new Date(now.getTime() - d * 86400000).toISOString()

function lift(d: number, kg: number): TrainingSession {
  return {
    id: `s${d}`, kind: 'strength', title: '', startedAt: daysAgo(d), endedAt: null, durationS: 3600,
    distanceM: null, kcal: null, avgHr: null, rpe: null, notes: null, routineId: null,
    exercises: [{ exerciseId: 'squat', sets: [{ type: 'normal', weightKg: kg, reps: 5, done: true }] }],
    source: 'live', externalId: null,
  }
}

describe('isGlp1Substance', () => {
  it('erkennt Wirkstoffe und Markennamen', () => {
    for (const name of ['Semaglutid', 'Ozempic 1 mg', 'Tirzepatide', 'Mounjaro', 'Retatrutid', 'Reta', 'CagriSema']) {
      expect(isGlp1Substance(name), name).toBe(true)
    }
    for (const name of ['BPC-157', 'Kreatin', 'Testosteron', 'Retinol', null]) {
      expect(isGlp1Substance(name), String(name)).toBe(false)
    }
  })
})

describe('glp1Insight', () => {
  const weights = [
    ...[55, 54, 53, 52].map(d => ({ date: daysAgo(d), kg: 100 })),
    ...[3, 2, 1].map(d => ({ date: daysAgo(d), kg: 94 })),
  ]

  it('meldet „watch", wenn Kraft mit dem Gewicht sinkt', () => {
    const sessions = [lift(50, 120), lift(40, 120), lift(20, 110), lift(5, 108)]
    const r = glp1Insight({ sessions, weights, injections: [], now })
    expect(r.weightChangePct).toBe(-6)
    expect(r.strengthChangePct).toBeLessThanOrEqual(-5)
    expect(r.status).toBe('watch')
  })

  it('meldet „good", wenn die Kraft haelt', () => {
    const sessions = [lift(50, 120), lift(40, 120), lift(20, 122.5), lift(5, 120)]
    expect(glp1Insight({ sessions, weights, injections: [], now }).status).toBe('good')
  })

  it('sagt „insufficient" ohne Krafttraining', () => {
    expect(glp1Insight({ sessions: [], weights, injections: [], now }).status).toBe('insufficient')
  })

  it('rechnet Protein je kg nur mit Werten aus dem Kalorientracker', () => {
    expect(glp1Insight({ sessions: [], weights, injections: [], now }).proteinPerKg).toBeNull()
    expect(glp1Insight({ sessions: [], weights, injections: [], now, avgProteinG: 141 }).proteinPerKg).toBe(1.5)
  })
})

describe('byInjectionDay', () => {
  it('ordnet Einheiten dem Tag nach der letzten Injektion zu, erst ab 6 Einheiten', () => {
    const from = now.getTime() - 56 * 86400000
    const to = now.getTime()
    const injections = [daysAgo(21), daysAgo(14), daysAgo(7)]
    const few = [lift(20, 100), lift(13, 100)]
    expect(byInjectionDay(few, injections, from, to)).toBeNull()
    const many = [lift(20, 100), lift(19, 100), lift(13, 100), lift(12, 100), lift(6, 100), lift(2, 100)]
    const r = byInjectionDay(many, injections, from, to)
    expect(r?.[1].sessions).toBe(3)
    expect(r?.[2].sessions).toBe(2)
    expect(r?.[5].sessions).toBe(1)
  })
})
