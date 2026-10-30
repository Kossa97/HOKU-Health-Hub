import { describe, expect, it, vi } from 'vitest'
import { parseWorkoutCsv, type ImportedSession } from '../../lib/csvImport'
import { resolveExerciseName } from '../../lib/exerciseLookup'
import {
  customExerciseDraft,
  ensureCustomExercises,
  exportFileName,
  inferTracking,
  replaceUnknownExercises,
  strongNeedsWeightUnit,
  summarizeImport,
} from './importPlan'

const STRONG = [
  'Date,Workout Name,Duration,Exercise Name,Set Order,Weight,Reps,Distance,Seconds,Notes,Workout Notes,RPE',
  '2026-09-30 18:00:00,Evening,48m,Deadlift (Barbell),1,140,5,,,,,',
  '2026-09-30 18:00:00,Evening,48m,Zercher Carry Spezial,1,60,,20,,,,',
  '2026-10-02 18:00:00,Morning,30m,Mein Spezialsprint,1,,,400,90,,,',
  '2026-10-04 18:00:00,Abend,40m,zercher carry spezial,1,70,,25,,,,',
  '2026-10-04 18:00:00,Abend,40m,Deadlift (Barbell),1,150,kaputt,,,,,',
].join('\n')

function parse(text = STRONG) {
  return parseWorkoutCsv(text, { resolveExercise: name => resolveExerciseName(name, []), weightUnit: 'kg' })
}

function session(exerciseIds: string[]): ImportedSession {
  return {
    kind: 'strength', title: 'T', startedAt: '2026-10-01T10:00:00.000Z', endedAt: null,
    durationS: null, distanceM: null, kcal: null, avgHr: null, rpe: null, notes: null,
    routineId: null, source: 'import_strong', externalId: 'x',
    exercises: exerciseIds.map(exerciseId => ({ exerciseId, sets: [{ type: 'normal', weightKg: 50, reps: 5, done: true }] })),
  }
}

describe('summarizeImport', () => {
  it('zaehlt Einheiten, Saetze, Zeitraum, Meldungen und unbekannte Uebungen je Name nur einmal', () => {
    const result = parse()
    const preview = summarizeImport('strong', result)
    expect(preview.format).toBe('strong')
    expect(preview.sessionCount).toBe(3)
    expect(preview.setCount).toBeGreaterThanOrEqual(5)
    expect(new Date(preview.firstAt!).getDate()).toBe(30)
    expect(new Date(preview.lastAt!).getDate()).toBe(4)
    expect(preview.unknownExercises).toEqual(['Zercher Carry Spezial', 'Mein Spezialsprint'])
    expect(preview.issueCount).toBe(result.errors.length)
    expect(preview.issueCount).toBeGreaterThan(0)
  })

  it('kommt mit einer leeren Datei aus', () => {
    const preview = summarizeImport('hevy', { sessions: [], unknownExercises: [], errors: ['Die Datei ist leer.'] })
    expect(preview).toMatchObject({ sessionCount: 0, setCount: 0, firstAt: null, lastAt: null, issueCount: 1 })
  })
})

describe('strongNeedsWeightUnit', () => {
  it('fragt nur, wenn die Datei keine Einheit nennt', () => {
    expect(strongNeedsWeightUnit(STRONG)).toBe(true)
    expect(strongNeedsWeightUnit('"Date";"Exercise Name";"Set Order";"Weight (kg)";"Reps"\n')).toBe(false)
    expect(strongNeedsWeightUnit('Date,Exercise Name,Set Order,Weight,Weight Unit,Reps\n')).toBe(false)
    expect(strongNeedsWeightUnit('')).toBe(false)
  })
})

describe('inferTracking / customExerciseDraft', () => {
  it('leitet die Erfassungsart aus den Saetzen ab', () => {
    expect(inferTracking([{ type: 'normal', weightKg: 60, reps: 8, done: true }]).tracking).toBe('weight_reps')
    expect(inferTracking([{ type: 'normal', distanceM: 400, durationS: 90, done: true }]))
      .toEqual({ tracking: 'distance_duration', category: 'cardio' })
    expect(inferTracking([{ type: 'normal', weightKg: 60, distanceM: 20, done: true }]).tracking).toBe('weight_distance')
    expect(inferTracking([{ type: 'normal', durationS: 60, done: true }]).tracking).toBe('duration')
    expect(inferTracking([]).tracking).toBe('weight_reps')
  })

  it('baut einen Entwurf: Ausruestung other, Name gekuerzt, Saetze ueber alle Schreibweisen', () => {
    const { sessions } = parse()
    expect(customExerciseDraft('Mein Spezialsprint', sessions)).toEqual({
      name: 'Mein Spezialsprint', category: 'cardio', equipment: 'other',
      tracking: 'distance_duration', primary: [], secondary: [],
    })
    expect(customExerciseDraft('Zercher Carry Spezial', sessions).tracking).toBe('weight_distance')
    expect(customExerciseDraft('  Neu  ')).toMatchObject({ name: 'Neu', tracking: 'weight_reps', category: 'strength', equipment: 'other' })
    expect(customExerciseDraft('x'.repeat(100)).name).toHaveLength(80)
  })
})

describe('ensureCustomExercises', () => {
  it('legt jeden Namen einmal an und ueberspringt bereits angelegte beim zweiten Anlauf', async () => {
    let n = 0
    const create = vi.fn(async (name: string) => {
      if (name === 'Boom' && n++ === 0) throw new Error('offline')
      return { id: `id-${name}` }
    })
    const created = new Map<string, string>()
    await expect(ensureCustomExercises(['Alpha', 'alpha ', 'Boom'], created, create)).rejects.toThrow('offline')
    expect([...created.entries()]).toEqual([['alpha', 'id-Alpha']])

    const result = await ensureCustomExercises(['Alpha', 'Boom'], created, create)
    expect(create.mock.calls.map(([name]) => name)).toEqual(['Alpha', 'Boom', 'Boom'])
    expect(result.get('boom')).toBe('id-Boom')
  })
})

describe('replaceUnknownExercises', () => {
  it('ersetzt unknown:<Name> durch custom:<id>, laesst Katalog und Fehlendes stehen', () => {
    const input = [session(['deadlift_barbell', 'unknown:Zercher Carry', 'unknown:Fehlt']), session(['bench_press_barbell'])]
    const out = replaceUnknownExercises(input, new Map([['zercher carry', 'abc']]))
    expect(out[0].exercises.map(e => e.exerciseId)).toEqual(['deadlift_barbell', 'custom:abc', 'unknown:Fehlt'])
    expect(out[1]).toBe(input[1])
    expect(input[0].exercises[1].exerciseId).toBe('unknown:Zercher Carry')
  })

  it('ergibt nach Anlegen aller Unbekannten keine unknown-Kennungen mehr', async () => {
    const result = parse()
    const preview = summarizeImport('strong', result)
    const ids = await ensureCustomExercises(preview.unknownExercises, new Map(), async name => ({ id: name.length.toString() }))
    const out = replaceUnknownExercises(result.sessions, ids)
    const all = out.flatMap(s => s.exercises.map(e => e.exerciseId))
    expect(all.some(id => id.startsWith('unknown:'))).toBe(false)
    expect(all.filter(id => id.startsWith('custom:'))).toHaveLength(3)
  })
})

describe('exportFileName', () => {
  it('nutzt das lokale Datum', () => {
    expect(exportFileName(new Date(2026, 0, 5, 23, 30))).toBe('HOKU-Training-2026-01-05.csv')
  })
})
