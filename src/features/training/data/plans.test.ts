import { describe, expect, it } from 'vitest'
import { ROUTINE_FOLDER_MAX } from '../types'
import { EXERCISE_CATALOG } from './exercises'
import { TRAINING_PLANS, createPlanRoutines } from './plans'

const catalogIds = new Set(EXERCISE_CATALOG.map(ex => ex.id))

describe('Trainingsplaene', () => {
  it('verweisen nur auf Uebungen aus dem Katalog', () => {
    for (const plan of TRAINING_PLANS) {
      for (const day of plan.days) {
        for (const ex of day.exercises) {
          expect(catalogIds.has(ex.exerciseId), `${plan.id}/${day.name.de}: ${ex.exerciseId}`).toBe(true)
        }
      }
    }
  })

  it('haben gueltige Wochentage, Satzbereiche und Ordnernamen', () => {
    for (const plan of TRAINING_PLANS) {
      expect(plan.name.de.length).toBeLessThanOrEqual(ROUTINE_FOLDER_MAX)
      expect(plan.name.en.length).toBeLessThanOrEqual(ROUTINE_FOLDER_MAX)
      const days = plan.days.flatMap(d => d.weekdays)
      expect(new Set(days).size).toBe(days.length)
      expect(days.every(d => d >= 1 && d <= 7)).toBe(true)
      for (const day of plan.days) {
        for (const ex of day.exercises) {
          expect(ex.sets.length).toBeGreaterThan(0)
          for (const set of ex.sets) expect((set.repsMin ?? 0) <= (set.repsMax ?? 0)).toBe(true)
        }
      }
    }
    expect(TRAINING_PLANS.map(p => p.days.length)).toEqual([3, 4, 6])
  })

  it('legt je Tag eine Routine im Ordner des Plans an', () => {
    const plan = TRAINING_PLANS.find(p => p.id === 'upper_lower_4')!
    const routines = createPlanRoutines(plan, 'en', 2)
    expect(routines).toHaveLength(4)
    expect(routines.map(r => r.folder)).toEqual(Array(4).fill('Upper/Lower 4×'))
    expect(routines.map(r => r.sortOrder)).toEqual([2, 3, 4, 5])
    expect(routines[0]).toMatchObject({ name: 'Upper A', kind: 'strength', weekdays: [1] })
    // Kopie, nicht die Vorlage selbst
    routines[0].exercises[0].sets.push({ type: 'normal' })
    expect(plan.days[0].exercises[0].sets).toHaveLength(3)
  })
})
