// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { HealthDailyRow } from '../../wearables/lib/healthDaily'

const health = vi.hoisted(() => ({
  isNative: true, isIOS: true, isAndroid: false,
  requestPermissions: vi.fn(),
  getStepsByDay: vi.fn(),
  getRestingHeartRate: vi.fn(),
  getSleep: vi.fn(),
  getActiveEnergy: vi.fn(),
  getOxygenSaturation: vi.fn(),
  getRespiratoryRate: vi.fn(),
  getBloodPressure: vi.fn(),
}))
vi.mock('../../../lib/health', () => health)

const consent = vi.hoisted(() => ({ loadHealthStoreConsent: vi.fn() }))
vi.mock('../../wearables/services/healthStore', () => consent)

/** Jede Abfrage-Kette wird mitgeschrieben; `await` liefert, was `respond` fuer die Tabelle zurueckgibt. */
const db = vi.hoisted(() => {
  type Call = { table: string; ops: [string, unknown[]][] }
  const state = {
    calls: [] as Call[],
    stored: [] as unknown[],
  }
  function from(table: string) {
    const entry: Call = { table, ops: [] }
    state.calls.push(entry)
    const chain: unknown = new Proxy({}, {
      get(_, prop: string) {
        if (prop === 'then') {
          const result = table === 'health_daily' ? { data: state.stored, error: null } : { data: null, error: null }
          return (resolve: (v: unknown) => void) => resolve(result)
        }
        return (...args: unknown[]) => { entry.ops.push([prop, args]); return chain }
      },
    })
    return chain
  }
  return { state, from }
})
vi.mock('../../../lib/supabase', () => ({ supabase: { from: db.from } }))

import { baselineWindow, computeBaselines, mergeRows, readStartBaseline } from './progressBaseline'
import { addDays } from '../lib/progressScore'

const START = '2026-03-14'
const row = (day: string, x: Partial<HealthDailyRow>): HealthDailyRow => ({
  day, steps: null, resting_hr: null, sleep_min: null, active_kcal: null, spo2_pct: null, resp_rate: null, bp_sys: null, bp_dia: null, ...x,
})
/** Tage relativ zum Start (−1 = Vortag). */
const days = (from: number, to: number, x: (d: number) => Partial<HealthDailyRow>) =>
  Array.from({ length: to - from + 1 }, (_, i) => row(addDays(START, from + i), x(from + i)))

const upserts = () => db.state.calls.filter(c => c.table === 'progress_settings').map(c => c.ops.find(([op]) => op === 'upsert')![1])

beforeEach(() => {
  db.state.calls = []
  db.state.stored = []
  health.isNative = true
  for (const fn of [health.getStepsByDay, health.getRestingHeartRate, health.getSleep, health.getActiveEnergy, health.getBloodPressure]) {
    fn.mockResolvedValue([])
  }
  consent.loadHealthStoreConsent.mockResolvedValue('2026-03-01T10:00:00.000Z')
})

afterEach(() => vi.clearAllMocks())

describe('computeBaselines (rein)', () => {
  it('Fenster = die 60 Tage vor dem Start, ohne den Starttag', () => {
    expect(baselineWindow(START)).toEqual({ from: '2026-01-13', to: '2026-03-13' })
  })

  it('ab 14 Tagen Daten: Startwert = Mittel; darunter die 28-Tage-Regel', () => {
    const rows = [
      ...days(-14, -1, () => ({ steps: 6000, resting_hr: 60 })), // 14 Tage
      ...days(-30, -18, () => ({ active_kcal: 400 })), // 13 Tage
      row(START, { steps: 99999, active_kcal: 9999 }), // Starttag zaehlt nicht
      row(addDays(START, -61), { active_kcal: 400 }), // vor dem Fenster
    ]
    const b = computeBaselines(rows, START)
    expect(b.steps).toEqual({ source: 'before', on: START, value: 6000, days: 14 })
    expect(b.resting_hr).toEqual({ source: 'before', on: START, value: 60, days: 14 })
    expect(b.active_kcal).toEqual({ source: 'after_start', on: START, days: 13 })
    expect(b.bp_sys).toEqual({ source: 'after_start', on: START, days: 0 })
    expect(b).not.toHaveProperty('hrv')
    expect(b).not.toHaveProperty('vo2max')
  })

  it('Schlaf: ab 14 Naechten Anteil mit 7–9 h', () => {
    const b = computeBaselines(days(-28, -1, d => ({ sleep_min: d % 14 === 0 ? 450 : 360 })), START)
    expect(b.sleep_nights).toEqual({ source: 'before', on: START, value: 0.071, days: 28 })
  })

  it('Android ohne Zusatzberechtigung: nur 30 Tage lesbar — reicht ab 14 Tagen, sonst 28-Tage-Regel', () => {
    expect(computeBaselines(days(-30, -1, () => ({ steps: 7000 })), START).steps?.source).toBe('before')
    expect(computeBaselines(days(-10, -1, () => ({ steps: 7000 })), START).steps)
      .toEqual({ source: 'after_start', on: START, days: 10 })
  })

  it('mergeRows: frisch gelesen vor gespeichert, je Spalte', () => {
    const merged = mergeRows(
      [row('2026-03-01', { steps: 5000 }), row('2026-03-03', { steps: 3000 })],
      [row('2026-03-01', { steps: 1, resting_hr: 58 }), row('2026-03-02', { steps: 2000 })],
    )
    expect(merged.map(r => [r.day, r.steps, r.resting_hr])).toEqual([
      ['2026-03-01', 5000, 58], ['2026-03-02', 2000, null], ['2026-03-03', 3000, null],
    ])
  })
})

describe('readStartBaseline', () => {
  it('ohne Einwilligung: liest nichts, fragt nie nach Berechtigungen, leert die alte Baseline', async () => {
    consent.loadHealthStoreConsent.mockResolvedValue(null)
    const r = await readStartBaseline('u1', START)
    expect(r).toEqual({ status: 'no_consent', baselines: {} })
    expect(health.getStepsByDay).not.toHaveBeenCalled()
    expect(health.requestPermissions).not.toHaveBeenCalled()
    expect(db.state.calls.some(c => c.table === 'health_daily')).toBe(false)
    expect(upserts()).toEqual([[{ user_id: 'u1', baselines: {}, updated_at: expect.any(String) }, { onConflict: 'user_id', defaultToNull: false }]])
  })

  it('mit Einwilligung: liest die 60 Tage davor einmal vom Geraet, fragt nie nach Berechtigungen, speichert', async () => {
    health.getStepsByDay.mockResolvedValue(
      Array.from({ length: 20 }, (_, i) => ({ start: new Date(2026, 2, 13 - i), count: 6140, source: 'watch' })),
    )
    const r = await readStartBaseline('u1', START)
    expect(health.requestPermissions).not.toHaveBeenCalled()
    expect(health.getStepsByDay).toHaveBeenCalledTimes(1)
    const options = health.getStepsByDay.mock.calls[0][0] as { startDate: Date; endDate: Date }
    expect(options.startDate).toEqual(new Date(2026, 0, 12)) // Vortag des Fensters (Schlaf)
    expect(options.endDate).toEqual(new Date(2026, 2, 14)) // bis Mitternacht des Starttags
    expect(r.status).toBe('saved')
    expect(r.baselines.steps).toEqual({ source: 'before', on: START, value: 6140, days: 20 })
    expect(r.baselines.resting_hr).toEqual({ source: 'after_start', on: START, days: 0 })
    const [[payload]] = upserts() as [[{ baselines: unknown }]]
    expect(payload.baselines).toEqual(r.baselines)
  })

  it('eine scheiternde Abfrage (fehlende Berechtigung) faellt auf die 28-Tage-Regel, die anderen zaehlen', async () => {
    health.getStepsByDay.mockRejectedValue(new Error('not authorized'))
    health.getRestingHeartRate.mockResolvedValue(
      Array.from({ length: 15 }, (_, i) => ({ date: new Date(2026, 2, 13 - i, 7), bpm: 61 })),
    )
    const r = await readStartBaseline('u1', START)
    expect(r.baselines.steps).toEqual({ source: 'after_start', on: START, days: 0 })
    expect(r.baselines.resting_hr).toEqual({ source: 'before', on: START, value: 61, days: 15 })
    expect(health.requestPermissions).not.toHaveBeenCalled()
  })

  it('zaehlt auch schon abgeglichene Tage aus health_daily (eigene Zeilen im Fenster)', async () => {
    db.state.stored = days(-20, -1, () => ({ bp_sys: 128 }))
    const r = await readStartBaseline('u1', START)
    expect(r.baselines.bp_sys).toEqual({ source: 'before', on: START, value: 128, days: 20 })
    const abfrage = db.state.calls.find(c => c.table === 'health_daily')!
    expect(abfrage.ops).toEqual(expect.arrayContaining([
      ['eq', ['user_id', 'u1']], ['gte', ['day', '2026-01-13']], ['lte', ['day', '2026-03-13']],
    ]))
  })

  it('im Web: nur die gespeicherten Tage, kein Lesen vom Geraet', async () => {
    health.isNative = false
    db.state.stored = days(-14, -1, () => ({ steps: 5000 }))
    const r = await readStartBaseline('u1', START)
    expect(health.getStepsByDay).not.toHaveBeenCalled()
    expect(r.baselines.steps?.source).toBe('before')
  })

  it('Widerruf waehrend des Lesens: nichts aus Health speichern', async () => {
    consent.loadHealthStoreConsent.mockResolvedValueOnce('2026-03-01T10:00:00.000Z').mockResolvedValueOnce(null)
    db.state.stored = days(-14, -1, () => ({ steps: 5000 }))
    const r = await readStartBaseline('u1', START)
    expect(r).toEqual({ status: 'no_consent', baselines: {} })
    const [[payload]] = upserts() as [[{ baselines: unknown }]]
    expect(payload.baselines).toEqual({})
  })
})
