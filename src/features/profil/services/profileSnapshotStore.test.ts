// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * Jede Abfrage-Kette wird mitgeschrieben; `await` liefert, was `respond` fuer
 * die Tabelle und die bisherigen Aufrufe zurueckgibt.
 */
const db = vi.hoisted(() => {
  type Call = { table: string; ops: [string, unknown[]][] }
  const state = {
    calls: [] as Call[],
    respond: (() => ({ data: [], error: null })) as (call: Call) => unknown,
  }
  function from(table: string) {
    const entry: Call = { table, ops: [] }
    state.calls.push(entry)
    const chain: unknown = new Proxy({}, {
      get(_, prop: string) {
        if (prop === 'then') {
          const result = state.respond(entry)
          return (resolve: (v: unknown) => void, reject: (e: unknown) => void) => Promise.resolve(result).then(resolve, reject)
        }
        return (...args: unknown[]) => { entry.ops.push([prop, args]); return chain }
      },
    })
    return chain
  }
  return { state, from }
})
vi.mock('../../../lib/supabase', () => ({ supabase: { from: db.from } }))

const training = vi.hoisted(() => ({
  loadSessions: vi.fn(async () => [] as unknown[]),
  loadRoutines: vi.fn(async () => [] as unknown[]),
  loadCustomExercises: vi.fn(async () => [] as unknown[]),
}))
vi.mock('../../training/services/trainingRepo', async importOriginal => ({
  ...(await importOriginal<typeof import('../../training/services/trainingRepo')>()),
  ...training,
}))

import { loadProfileSnapshotInput, SNAPSHOT_REFRESH_MS, snapshotHash, writeProfileSnapshot } from './profileSnapshotStore'

const USER = 'user-1'
const NOW = new Date(2026, 9, 31, 12, 0, 0)
const op = (call: { ops: [string, unknown[]][] }, name: string) => call.ops.filter(([o]) => o === name).map(([, a]) => a)

beforeEach(() => {
  db.state.calls.length = 0
  db.state.respond = () => ({ data: [], error: null })
  localStorage.clear()
})

describe('writeProfileSnapshot', () => {
  it('schreibt per Upsert und nur, wenn sich der Inhalt geaendert hat', async () => {
    const data = { weight: { v: 81, unit: 'kg' as const } }
    expect(await writeProfileSnapshot(USER, data, NOW)).toBe(true)
    expect(db.state.calls).toHaveLength(1)
    const [upsert] = op(db.state.calls[0], 'upsert')
    expect(db.state.calls[0].table).toBe('profile_snapshots')
    expect(upsert[0]).toEqual({ user_id: USER, data, updated_at: NOW.toISOString() })
    expect(upsert[1]).toEqual({ onConflict: 'user_id' })

    expect(await writeProfileSnapshot(USER, { weight: { v: 81, unit: 'kg' } }, new Date(NOW.getTime() + 60_000))).toBe(false)
    expect(db.state.calls).toHaveLength(1)

    expect(await writeProfileSnapshot(USER, { weight: { v: 80.9, unit: 'kg' } }, new Date(NOW.getTime() + 120_000))).toBe(true)
    expect(db.state.calls).toHaveLength(2)
  })

  it('schreibt einmal am Tag auch ohne Aenderung', async () => {
    await writeProfileSnapshot(USER, {}, NOW)
    expect(await writeProfileSnapshot(USER, {}, new Date(NOW.getTime() + SNAPSHOT_REFRESH_MS + 1))).toBe(true)
  })

  it('merkt sich nach einem Fehler nichts — der naechste Lauf versucht es wieder', async () => {
    db.state.respond = () => ({ data: null, error: { code: 'PGRST205', message: 'relation does not exist' } })
    await expect(writeProfileSnapshot(USER, { streak: { days: 3 } }, NOW)).rejects.toThrow()
    db.state.respond = () => ({ data: null, error: null })
    expect(await writeProfileSnapshot(USER, { streak: { days: 3 } }, NOW)).toBe(true)
  })

  it('haelt die Merkzeile je Nutzer getrennt', async () => {
    await writeProfileSnapshot(USER, {}, NOW)
    expect(await writeProfileSnapshot('user-2', {}, NOW)).toBe(true)
  })

  it('bildet einen stabilen, kurzen Fingerabdruck', () => {
    expect(snapshotHash({ streak: { days: 1 } })).toBe(snapshotHash({ streak: { days: 1 } }))
    expect(snapshotHash({ streak: { days: 1 } })).not.toBe(snapshotHash({ streak: { days: 2 } }))
    expect(snapshotHash({}).length).toBeLessThan(20)
  })
})

describe('loadProfileSnapshotInput', () => {
  it('liest nur eigene Zeilen und vom Stack nur die Anzahl', async () => {
    await loadProfileSnapshotInput(USER, NOW, 'de')
    const tables = db.state.calls.map(c => c.table).sort()
    expect(tables).toEqual([
      'bloodwork', 'body_measurements', 'cycles', 'daily_logs', 'dose_logs', 'health_daily',
      'profiles', 'reviews', 'stack_items', 'weight_logs',
    ])
    for (const call of db.state.calls) {
      const eq = op(call, 'eq')
      const own = call.table === 'profiles' ? ['id', USER] : ['user_id', USER]
      expect(eq, call.table).toContainEqual(own)
    }
    const stack = db.state.calls.find(c => c.table === 'stack_items')!
    expect(op(stack, 'select')[0]).toEqual(['id', { count: 'exact', head: true }])
    const reviews = db.state.calls.find(c => c.table === 'reviews')!
    expect(op(reviews, 'eq')).toEqual(expect.arrayContaining([['is_public', true], ['hidden_by_moderation', false]]))
    expect(training.loadSessions).toHaveBeenCalledWith(USER)
  })

  it('liest vor der Migration ohne die neuen Spalten weiter', async () => {
    const missing = { data: null, error: { code: '42703', message: 'column does not exist' } }
    db.state.respond = call => {
      const columns = String(op(call, 'select')[0]?.[0] ?? '')
      if (/favorite_exercise|muscle_mass_kg|auto_logged/.test(columns)) return missing
      if (call.table === 'profiles') return { data: { birth_date: '1990-01-01', height_cm: 180 }, error: null }
      if (call.table === 'daily_logs') return { data: [{ log_date: '2026-10-30', body_fat_pct: '16.5' }], error: null }
      return { data: [], error: null, count: 0 }
    }
    const input = await loadProfileSnapshotInput(USER, NOW, 'de')
    expect(input.profile).toMatchObject({ birthDate: '1990-01-01', heightCm: 180, favoriteExercise: null, routineId: null })
    expect(input.dailyLogs).toEqual([expect.objectContaining({ log_date: '2026-10-30', body_fat_pct: 16.5, muscle_mass_kg: null })])
    const profileSelects = db.state.calls.filter(c => c.table === 'profiles').map(c => op(c, 'select')[0][0])
    expect(profileSelects).toEqual([
      'birth_date, bio_sex, height_cm, weight_kg, favorite_exercise, profile_routine_id',
      'birth_date, bio_sex, height_cm, weight_kg',
    ])
  })

  it('bricht ab, wenn eine Abfrage scheitert, statt einen halben Schnappschuss zu liefern', async () => {
    db.state.respond = call => call.table === 'bloodwork'
      ? { data: null, error: { code: '500', message: 'boom' } }
      : { data: [], error: null }
    await expect(loadProfileSnapshotInput(USER, NOW, 'de')).rejects.toThrow(/bloodwork/)
  })

  it('kommt ohne Tabelle health_daily aus', async () => {
    db.state.respond = call => call.table === 'health_daily'
      ? { data: null, error: { code: 'PGRST205', message: 'schema cache' } }
      : { data: [], error: null }
    const input = await loadProfileSnapshotInput(USER, NOW, 'de')
    expect(input.healthDaily).toEqual([])
  })
})
