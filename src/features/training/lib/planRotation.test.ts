import { describe, expect, it } from 'vitest'
import type { TrainingRoutine, TrainingSession } from '../types'
import { groupByFolder, nextInPlan } from './planRotation'

const routine = (id: string, folder: string | null, sortOrder: number, weekdays: number[] = []): TrainingRoutine => ({
  id, name: id, kind: 'strength', exercises: [], weekdays, sortOrder, folder,
})

const session = (routineId: string | null, startedAt: string): TrainingSession => ({
  id: `s-${routineId}-${startedAt}`, kind: 'strength', title: '', startedAt, endedAt: null, durationS: null,
  distanceM: null, kcal: null, avgHr: null, rpe: null, notes: null, routineId, exercises: [], source: 'live', externalId: null,
})

// Dienstag, 27.10.2026
const tuesday = new Date(2026, 9, 27, 18, 0)

const ppl = [routine('push', 'PPL', 0, [1]), routine('pull', 'PPL', 1, [3]), routine('legs', 'PPL', 2, [5])]

describe('groupByFolder', () => {
  it('gruppiert nach Ordner in Reihenfolge des ersten Auftretens, „Ohne Plan" zuletzt', () => {
    const groups = groupByFolder([routine('x', null, 0), routine('b', 'B', 1), routine('a', 'A', 2), routine('c', 'B', 3)])
    expect(groups.map(g => g.folder)).toEqual(['B', 'A', null])
    expect(groups[0].routines.map(r => r.id)).toEqual(['b', 'c'])
  })
})

describe('nextInPlan', () => {
  it('ist null ohne Routinen', () => {
    expect(nextInPlan([], [], tuesday)).toBeNull()
  })

  it('nimmt ohne Verlauf die erste Routine des ersten Ordners', () => {
    const next = nextInPlan(ppl, [], tuesday)
    expect(next?.routine.id).toBe('push')
    expect(next?.folder).toBe('PPL')
    expect(next?.rotation.map(r => r.id)).toEqual(['push', 'pull', 'legs'])
    expect(next?.lastTrainedAt).toBeNull()
    expect(next?.plannedToday).toBe(false)
  })

  it('setzt die Rotation nach der zuletzt trainierten Routine fort und springt am Ende an den Anfang', () => {
    const afterPull = nextInPlan(ppl, [session('push', '2026-10-19T17:00:00.000Z'), session('pull', '2026-10-21T17:00:00.000Z')], tuesday)
    expect(afterPull?.routine.id).toBe('legs')
    const afterLegs = nextInPlan(ppl, [session('legs', '2026-10-23T17:00:00.000Z'), session('push', '2026-10-19T17:00:00.000Z')], tuesday)
    expect(afterLegs?.routine.id).toBe('push')
    expect(afterLegs?.lastTrainedAt).toBe('2026-10-19T17:00:00.000Z')
  })

  it('bevorzugt die fuer heute geplante Routine, solange sie heute noch nicht trainiert wurde', () => {
    const plan = [routine('push', 'PPL', 0, [1]), routine('pull', 'PPL', 1, [2]), routine('legs', 'PPL', 2, [5])]
    const next = nextInPlan(plan, [session('pull', '2026-10-20T17:00:00.000Z')], tuesday)
    expect(next?.routine.id).toBe('pull')
    expect(next?.plannedToday).toBe(true)
    // heute schon gemacht → weiter in der Rotation
    const done = nextInPlan(plan, [session('pull', '2026-10-27T10:00:00.000Z')], tuesday)
    expect(done?.routine.id).toBe('legs')
    expect(done?.plannedToday).toBe(false)
  })

  it('waehlt den Ordner der zuletzt trainierten Routine', () => {
    const routines = [...ppl, routine('fb-a', 'Ganzkörper', 10), routine('fb-b', 'Ganzkörper', 11)]
    const next = nextInPlan(routines, [session('fb-a', '2026-10-25T09:00:00.000Z'), session('push', '2026-10-01T09:00:00.000Z')], tuesday)
    expect(next?.folder).toBe('Ganzkörper')
    expect(next?.routine.id).toBe('fb-b')
  })

  it('zaehlt Einheiten ohne Routine nicht', () => {
    const next = nextInPlan(ppl, [session(null, '2026-10-26T09:00:00.000Z')], tuesday)
    expect(next?.routine.id).toBe('push')
  })
})
