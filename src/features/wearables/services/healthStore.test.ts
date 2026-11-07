import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Jede Abfrage-Kette wird mitgeschrieben; `await` liefert das naechste Ergebnis aus `results`. */
const db = vi.hoisted(() => {
  const state = {
    calls: [] as { table: string; ops: [string, unknown[]][] }[],
    results: [] as unknown[],
  }
  function from(table: string) {
    const entry = { table, ops: [] as [string, unknown[]][] }
    state.calls.push(entry)
    const chain: unknown = new Proxy({}, {
      get(_, prop: string) {
        if (prop === 'then') {
          const next = state.results.length ? state.results.shift() : { data: null, error: null }
          return (resolve: (v: unknown) => void, reject: (e: unknown) => void) => Promise.resolve(next).then(resolve, reject)
        }
        return (...args: unknown[]) => { entry.ops.push([prop, args]); return chain }
      },
    })
    return chain
  }
  return { state, from }
})
vi.mock('../../../lib/supabase', () => ({ supabase: { from: db.from } }))

import type { HealthDailyRow } from '../lib/healthDaily'
import {
  countHealthDaily, deleteHealthDaily, loadHealthStoreConsent, setHealthStoreConsent, syncWindow, upsertHealthDaily,
} from './healthStore'

const row = (day: string): HealthDailyRow => ({
  day, steps: 1000, resting_hr: null, sleep_min: null, active_kcal: null,
  spo2_pct: null, resp_rate: null, bp_sys: null, bp_dia: null,
})

beforeEach(() => {
  db.state.calls.length = 0
  db.state.results.length = 0
})

describe('syncWindow', () => {
  it('liest ohne Stand 30 Tage zurueck', () => {
    expect(syncWindow(null, '2026-10-31')).toEqual({ from: '2026-10-01', to: '2026-10-31' })
  })

  it('beginnt mit Stand am Tag davor, damit ein angefangener Tag nachgezogen wird', () => {
    expect(syncWindow('2026-10-29', '2026-10-31')).toEqual({ from: '2026-10-28', to: '2026-10-31' })
    expect(syncWindow('2026-10-31', '2026-10-31')).toEqual({ from: '2026-10-30', to: '2026-10-31' })
  })

  it('rechnet ueber Monats- und Jahresgrenzen', () => {
    expect(syncWindow(null, '2026-03-15')).toEqual({ from: '2026-02-13', to: '2026-03-15' })
    expect(syncWindow('2027-01-01', '2027-01-02')).toEqual({ from: '2026-12-31', to: '2027-01-02' })
  })

  it('liest hoechstens 30 Tage zurueck, auch bei sehr altem Stand', () => {
    expect(syncWindow('2026-01-01', '2026-10-31')).toEqual({ from: '2026-10-01', to: '2026-10-31' })
  })

  it('liest nie in die Zukunft, wenn der Stand nach heute liegt (Uhr verstellt)', () => {
    expect(syncWindow('2026-11-05', '2026-10-31')).toEqual({ from: '2026-10-31', to: '2026-10-31' })
  })
})

describe('Einwilligung (profiles.health_store_consent_at)', () => {
  it('liest den Zeitpunkt aus dem eigenen Profil', async () => {
    db.state.results.push({ data: { health_store_consent_at: '2026-10-30T10:00:00Z' }, error: null })
    await expect(loadHealthStoreConsent('u1')).resolves.toBe('2026-10-30T10:00:00Z')
    expect(db.state.calls[0]).toEqual({
      table: 'profiles',
      ops: [['select', ['health_store_consent_at']], ['eq', ['id', 'u1']], ['maybeSingle', []]],
    })
  })

  it('liefert null ohne Einwilligung und wirft bei Lesefehlern', async () => {
    db.state.results.push({ data: { health_store_consent_at: null }, error: null })
    await expect(loadHealthStoreConsent('u1')).resolves.toBeNull()
    db.state.results.push({ data: null, error: { message: 'offline' } })
    await expect(loadHealthStoreConsent('u1')).rejects.toEqual({ message: 'offline' })
  })

  it('erteilt mit Zeitstempel und widerruft mit null', async () => {
    db.state.results.push({ data: [{ health_store_consent_at: '2026-10-31T08:00:00Z' }], error: null })
    await expect(setHealthStoreConsent('u1', true)).resolves.toBe('2026-10-31T08:00:00Z')
    const [update, eq, select] = db.state.calls[0].ops
    expect(update[0]).toBe('update')
    expect(typeof (update[1][0] as { health_store_consent_at: unknown }).health_store_consent_at).toBe('string')
    expect(eq).toEqual(['eq', ['id', 'u1']])
    expect(select).toEqual(['select', ['health_store_consent_at']])

    db.state.results.push({ data: [{ health_store_consent_at: null }], error: null })
    await expect(setHealthStoreConsent('u1', false)).resolves.toBeNull()
    expect(db.state.calls[1].ops[0]).toEqual(['update', [{ health_store_consent_at: null }]])
  })

  it('wertet ein Update ohne Profilzeile als Fehler', async () => {
    db.state.results.push({ data: [], error: null })
    await expect(setHealthStoreConsent('u1', true)).rejects.toThrow('profil_fehlt')
  })
})

describe('health_daily', () => {
  it('schreibt in Bloecken zu 100 per Upsert auf (user_id, day), mit Quelle', async () => {
    const rows = Array.from({ length: 250 }, (_, i) => row(`2026-01-${String((i % 28) + 1).padStart(2, '0')}-${i}`))
    await upsertHealthDaily('u1', rows, 'healthkit')
    expect(db.state.calls).toHaveLength(3)
    const sizes = db.state.calls.map(c => (c.ops[0][1][0] as unknown[]).length)
    expect(sizes).toEqual([100, 100, 50])
    for (const call of db.state.calls) {
      expect(call.table).toBe('health_daily')
      expect(call.ops[0][0]).toBe('upsert')
      expect(call.ops[0][1][1]).toEqual({ onConflict: 'user_id,day', defaultToNull: false })
    }
    const first = (db.state.calls[0].ops[0][1][0] as Record<string, unknown>[])[0]
    expect(first).toMatchObject({ ...rows[0], user_id: 'u1', source: 'healthkit' })
    expect(typeof first.updated_at).toBe('string')
  })

  it('schickt nur die Spalten, die in den Zeilen stehen', async () => {
    await upsertHealthDaily('u1', [{ day: '2026-10-30', steps: 5000 }], 'healthkit')
    const sent = (db.state.calls[0].ops[0][1][0] as Record<string, unknown>[])[0]
    expect(Object.keys(sent).sort()).toEqual(['day', 'source', 'steps', 'updated_at', 'user_id'])
  })

  it('schreibt Zeilen mit verschiedenen Spalten in getrennten Upserts mit einheitlichen Spalten', async () => {
    // postgrest-js bildet `columns` aus der Vereinigung aller Schluessel: gemischt in einem
    // Aufruf wuerde eine fehlende Spalte trotz defaultToNull: false auf NULL gesetzt.
    await upsertHealthDaily('u1', [
      { day: '2026-10-29', steps: 7000, resting_hr: 60 },
      { day: '2026-10-30', steps: 8000 },
      { day: '2026-10-31', resting_hr: 57, steps: 3000 },
    ], 'healthkit')
    expect(db.state.calls).toHaveLength(2)
    const sent = db.state.calls.map(c => c.ops[0][1][0] as Record<string, unknown>[])
    for (const chunk of sent) {
      const keySets = new Set(chunk.map(r => Object.keys(r).sort().join(',')))
      expect(keySets.size).toBe(1)
    }
    expect(sent.map(chunk => chunk.map(r => r.day))).toEqual([['2026-10-29', '2026-10-31'], ['2026-10-30']])
  })

  it('schreibt ohne Zeilen nichts', async () => {
    await upsertHealthDaily('u1', [], 'health_connect')
    expect(db.state.calls).toHaveLength(0)
  })

  it('bricht beim ersten Fehler ab', async () => {
    db.state.results.push({ error: { message: 'kaputt' } })
    await expect(upsertHealthDaily('u1', Array.from({ length: 150 }, (_, i) => row(`d${i}`)), 'healthkit'))
      .rejects.toEqual({ message: 'kaputt' })
    expect(db.state.calls).toHaveLength(1)
  })

  it('loescht nur die eigenen Zeilen (immer mit where user_id)', async () => {
    await deleteHealthDaily('u1')
    expect(db.state.calls[0]).toEqual({ table: 'health_daily', ops: [['delete', []], ['eq', ['user_id', 'u1']]] })
    db.state.results.push({ error: { message: 'nein' } })
    await expect(deleteHealthDaily('u1')).rejects.toEqual({ message: 'nein' })
  })

  it('zaehlt gespeicherte Tage, ohne Inhalte zu lesen', async () => {
    db.state.results.push({ count: 12, error: null })
    await expect(countHealthDaily('u1')).resolves.toBe(12)
    expect(db.state.calls[0]).toEqual({
      table: 'health_daily',
      ops: [['select', ['day', { count: 'exact', head: true }]], ['eq', ['user_id', 'u1']]],
    })
  })
})
