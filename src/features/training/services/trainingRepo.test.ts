import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../lib/supabase', () => ({ supabase: {} }))

const { MAX_DISMISSED, isMissingTable, normalizeFolder, normalizeSettings, routineFromRow, sessionFromRow } = await import('./trainingRepo')

describe('trainingRepo', () => {
  it('fuellt fehlende Einstellungen mit Standardwerten und verwirft Unsinn', () => {
    const s = normalizeSettings({ unit: 'lb', defaultRestS: -5, weeklyGoal: 99, platesKg: [5, 'x'], glp1Mode: 'ja' })
    expect(s.unit).toBe('lb')
    expect(s.defaultRestS).toBe(90)
    expect(s.weeklyGoal).toBe(3)
    expect(s.platesKg[0]).toBe(25)
    expect(s.glp1Mode).toBeNull()
    expect(s.dismissedExternalIds).toEqual([])
    // v1-Einstellungen ohne die Pausen-Schalter: beide an
    expect(s.restSound).toBe(true)
    expect(s.restNotify).toBe(true)
    expect(normalizeSettings({ restSound: false, restNotify: false }).restSound).toBe(false)
    expect(normalizeSettings({ restSound: false, restNotify: false }).restNotify).toBe(false)
  })

  it('liest den Ordner einer Routine, auch wenn die Spalte noch fehlt', () => {
    const base = { id: 'r', name: 'Push', kind: 'strength' as const, exercises: null, weekdays: null, sort_order: 2 }
    expect(routineFromRow(base).folder).toBeNull()
    expect(routineFromRow({ ...base, folder: '  PPL ' }).folder).toBe('PPL')
    expect(routineFromRow({ ...base, folder: '   ' }).folder).toBeNull()
    expect(normalizeFolder('x'.repeat(50))).toHaveLength(40)
    expect(normalizeFolder(7)).toBeNull()
  })

  it('behaelt nur die letzten geloeschten Uhr-Workouts', () => {
    const ids = Array.from({ length: MAX_DISMISSED + 20 }, (_, i) => `hk-${i}`)
    const s = normalizeSettings({ dismissedExternalIds: [...ids, 42] })
    expect(s.dismissedExternalIds).toHaveLength(MAX_DISMISSED)
    expect(s.dismissedExternalIds.at(-1)).toBe(`hk-${MAX_DISMISSED + 19}`)
  })

  it('liest numerische Spalten als Zahl und erkennt fehlende Tabellen', () => {
    const s = sessionFromRow({
      id: 'a', kind: 'run', title: '', started_at: '2026-10-01T00:00:00Z', ended_at: null, duration_s: 60,
      distance_m: '5200.0', kcal: null, avg_hr: null, rpe: '7.5', notes: null, routine_id: null,
      exercises: null, source: 'manual', external_id: null,
    })
    expect(s.distanceM).toBe(5200)
    expect(s.rpe).toBe(7.5)
    expect(s.exercises).toEqual([])
    expect(isMissingTable({ code: 'PGRST205' })).toBe(true)
    expect(isMissingTable({ code: '23505' })).toBe(false)
  })
})
