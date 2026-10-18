import { describe, expect, it } from 'vitest'
import type { TrainingSession, TrainingSet } from '../types'
import {
  detectRecords, estimateOneRepMax, exerciseHistory, fromDisplayWeight, platesPerSide,
  previousSets, sessionVolumeKg, setsPerMuscle, startOfWeek, toDisplayWeight, weekSummary,
} from './stats'

const set = (weightKg: number, reps: number, extra: Partial<TrainingSet> = {}): TrainingSet =>
  ({ type: 'normal', weightKg, reps, done: true, ...extra })

function session(id: string, startedAt: string, exercises: TrainingSession['exercises'], extra: Partial<TrainingSession> = {}): TrainingSession {
  return {
    id, kind: 'strength', title: '', startedAt, endedAt: null, durationS: 3600, distanceM: null,
    kcal: null, avgHr: null, rpe: null, notes: null, routineId: null, exercises,
    source: 'live', externalId: null, ...extra,
  }
}

describe('estimateOneRepMax', () => {
  it('rechnet Epley und gibt bei 1 Wdh. das Gewicht zurueck', () => {
    expect(estimateOneRepMax(100, 1)).toBe(100)
    expect(estimateOneRepMax(100, 5)).toBe(116.7)
  })
  it('fuehrt keinen Wert ueber 12 Wdh. oder ohne Gewicht', () => {
    expect(estimateOneRepMax(50, 15)).toBeNull()
    expect(estimateOneRepMax(0, 5)).toBeNull()
    expect(estimateOneRepMax(null, 5)).toBeNull()
  })
})

describe('Volumen', () => {
  it('zaehlt nur abgehakte Arbeitssaetze', () => {
    const s = session('a', '2026-10-01T10:00:00Z', [{
      exerciseId: 'bench', sets: [set(40, 10, { type: 'warmup' }), set(80, 5), set(80, 5, { done: false })],
    }])
    expect(sessionVolumeKg(s)).toBe(400)
  })
})

describe('Verlauf und Rekorde', () => {
  const s1 = session('s1', '2026-10-01T10:00:00Z', [{ exerciseId: 'bench', sets: [set(80, 5), set(80, 5)] }])
  const s2 = session('s2', '2026-10-04T10:00:00Z', [{ exerciseId: 'bench', sets: [set(82.5, 5)] }])
  const s3 = session('s3', '2026-10-08T10:00:00Z', [
    { exerciseId: 'bench', sets: [set(85, 3)] },
    { exerciseId: 'pullup', sets: [{ type: 'normal', reps: 12, done: true }] },
  ])

  it('baut einen Punkt je Einheit, aelteste zuerst', () => {
    const h = exerciseHistory([s3, s1, s2], 'bench')
    expect(h.map(p => p.sessionId)).toEqual(['s1', 's2', 's3'])
    expect(h[0].volumeKg).toBe(800)
    expect(h[2].maxWeightKg).toBe(85)
  })

  it('nimmt fuer „Vorher" die letzte Einheit vor dem Zeitpunkt', () => {
    expect(previousSets([s1, s2, s3], 'bench', '2026-10-08T00:00:00Z')).toEqual([set(82.5, 5)])
    expect(previousSets([s1], 'squat')).toEqual([])
  })

  it('meldet Gewichtsrekord, aber keinen e1RM-Rekord, wenn der e1RM nicht steigt', () => {
    const records = detectRecords(s3, [s1, s2, s3])
    const bench = records.filter(r => r.exerciseId === 'bench').map(r => r.kind)
    expect(bench).toContain('weight')
    // 85×3 → 93,5; 82,5×5 → 96,3: kein e1RM-Rekord.
    expect(bench).not.toContain('e1rm')
  })

  it('waehlt als besten Satz den mit e1RM vor einem Satz mit vielen Wdh.', () => {
    const s = session('b', '2026-10-09T10:00:00Z', [{ exerciseId: 'bench', sets: [set(100, 5), set(40, 15)] }])
    expect(exerciseHistory([s], 'bench')[0].bestSet).toEqual(set(100, 5))
  })

  it('meldet bei Unterstuetzung keinen Gewichtsrekord fuer mehr Hilfe, nur Wdh.', () => {
    const a = session('a1', '2026-10-01T10:00:00Z', [{ exerciseId: 'assisted', sets: [set(20, 8)] }])
    const b = session('a2', '2026-10-05T10:00:00Z', [{ exerciseId: 'assisted', sets: [set(30, 10)] }])
    const records = detectRecords(b, [a, b], () => 'assisted_reps')
    expect(records.map(r => r.kind)).toEqual(['reps'])
  })

  it('setzt bei der ersten Einheit einer Uebung keinen Rekord', () => {
    expect(detectRecords(s3, [s1, s2, s3]).some(r => r.exerciseId === 'pullup')).toBe(false)
    expect(detectRecords(s1, [s1])).toEqual([])
  })
})

describe('Woche', () => {
  it('beginnt am Montag', () => {
    const monday = startOfWeek(new Date(2026, 9, 18, 12)) // Sonntag 18.10.
    expect(monday.getDay()).toBe(1)
    expect(monday.getDate()).toBe(12)
  })

  it('zaehlt Einheiten der Woche und die Serie erreichter Ziele', () => {
    const at = (d: number) => new Date(2026, 9, d, 18).toISOString()
    const sessions = [
      // Woche 28.9.–4.10.: 2
      session('a', new Date(2026, 8, 29, 18).toISOString(), []), session('b', at(1), []),
      // Woche 5.–11.10.: 2
      session('c', at(6), []), session('d', at(9), []),
      // laufende Woche 12.–18.10.: 1
      session('e', at(13), [], { kcal: 300 }),
    ]
    const s = weekSummary(sessions, new Date(2026, 9, 15, 12), 2, x => x.kcal ?? 0)
    expect(s.sessions).toBe(1)
    expect(s.kcal).toBe(300)
    // laufende Woche noch offen → zaehlt nicht, die zwei Vorwochen schon
    expect(s.streakWeeks).toBe(2)
  })
})

describe('Muskeln', () => {
  it('zaehlt primaer voll und sekundaer halb', () => {
    const s = session('a', '2026-10-01T10:00:00Z', [{ exerciseId: 'bench', sets: [set(80, 5), set(80, 5)] }])
    const map = setsPerMuscle([s], () => ({ primary: ['chest'], secondary: ['triceps'] }))
    expect(map.get('chest')).toBe(2)
    expect(map.get('triceps')).toBe(1)
  })
})

describe('Scheiben und Einheiten', () => {
  it('legt Scheiben je Seite und meldet den Rest', () => {
    expect(platesPerSide(100, 20, [25, 20, 15, 10, 5, 2.5, 1.25])).toEqual({ plates: [25, 15], restKg: 0 })
    expect(platesPerSide(61, 20, [20, 10, 5, 2.5, 1.25])).toEqual({ plates: [20], restKg: 1 })
    expect(platesPerSide(15, 20, [20])).toEqual({ plates: [], restKg: 0 })
  })

  it('rechnet kg und lb hin und zurueck', () => {
    expect(toDisplayWeight(100, 'lb')).toBe(220.5)
    expect(fromDisplayWeight(225, 'lb')).toBeCloseTo(102.058, 2)
    expect(toDisplayWeight(82.5, 'kg')).toBe(82.5)
  })
})
