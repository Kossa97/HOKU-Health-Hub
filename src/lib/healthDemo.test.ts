import { describe, expect, it } from 'vitest'
import { HEALTH_DEMO_SCENARIOS, HEALTH_DEMO_STORAGE_KEY, createHealthDemo, readHealthDemoScenario } from './healthDemo'

// Fester Zeitpunkt: Donnerstag, 5.11.2026, 15:00 (Berlin)
const NOW = new Date(2026, 10, 5, 15, 0, 0)
const clock = () => NOW
const DAY = 24 * 60 * 60 * 1000
const range = (days: number, limit = 0) => ({ startDate: new Date(NOW.getTime() - days * DAY), endDate: NOW, limit })
const today = () => ({ startDate: new Date(2026, 10, 5), endDate: NOW, limit: 0 })

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    map,
  }
}

describe('readHealthDemoScenario', () => {
  it('nimmt das Szenario aus der URL und merkt es sich', () => {
    const storage = memoryStorage()
    expect(readHealthDemoScenario('?healthDemo=extrem', storage)).toBe('extrem')
    expect(storage.map.get(HEALTH_DEMO_STORAGE_KEY)).toBe('extrem')
    expect(readHealthDemoScenario('', storage)).toBe('extrem')
  })

  it('schaltet mit ?healthDemo=aus ab', () => {
    const storage = memoryStorage({ [HEALTH_DEMO_STORAGE_KEY]: 'normal' })
    expect(readHealthDemoScenario('?healthDemo=aus', storage)).toBeNull()
    expect(storage.map.has(HEALTH_DEMO_STORAGE_KEY)).toBe(false)
  })

  it('ignoriert unbekannte Werte und gesperrten Speicher', () => {
    expect(readHealthDemoScenario('?healthDemo=quatsch', memoryStorage())).toBeNull()
    const locked = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') }, removeItem: () => {} }
    expect(readHealthDemoScenario('?healthDemo=normal', locked)).toBe('normal')
    expect(readHealthDemoScenario('', locked)).toBeNull()
    expect(readHealthDemoScenario('', null)).toBeNull()
  })
})

describe('createHealthDemo', () => {
  it('liefert in jedem Szenario nichts aus der Zukunft', () => {
    for (const scenario of HEALTH_DEMO_SCENARIOS) {
      const demo = createHealthDemo(scenario, clock)
      const r = range(30)
      const dates = [
        ...demo.sleep(r).map(s => s.endDate),
        ...demo.heartRate(r).map(s => s.date),
        ...demo.restingHeartRate(r).map(s => s.date),
        ...demo.workouts(r).map(w => w.endDate),
      ]
      for (const d of dates) expect(d.getTime()).toBeLessThanOrEqual(NOW.getTime())
      expect(demo.requestPermissions().granted).toBe(true)
    }
  })

  it('ist deterministisch', () => {
    const a = createHealthDemo('normal', clock)
    const b = createHealthDemo('normal', clock)
    expect(a.steps(today()).count).toBe(b.steps(today()).count)
    expect(a.workouts(range(30))).toEqual(b.workouts(range(30)))
  })

  it('normal: plausible Werte aus allen Bereichen', () => {
    const demo = createHealthDemo('normal', clock)
    expect(demo.platform).toBe('ios')
    expect(demo.weight(range(365))?.valueKg).toBe(82.4)
    // 15 Uhr: 8 von 15 Wachstunden vorbei
    const steps = demo.steps(today()).count
    expect(steps).toBeGreaterThan(6000 * 8 / 15 - 1)
    expect(steps).toBeLessThan(12000 * 8 / 15 + 1)
    const lastNight = demo.sleep(range(1)).filter(s => s.state !== 'InBed')
    expect(lastNight.length).toBe(3)
    const hr = demo.heartRate(range(1, 20))
    expect(hr).toHaveLength(20)
    expect(hr[0].date.getTime()).toBeGreaterThanOrEqual(hr[1].date.getTime())
    expect(demo.restingHeartRate(range(30)).length).toBeGreaterThanOrEqual(29)
    const workouts = demo.workouts(range(30))
    expect(workouts.length).toBeGreaterThan(10)
    expect(new Set(workouts.map(w => w.externalId)).size).toBe(workouts.length)
    expect(demo.activeEnergy(today())).toBeGreaterThan(0)
  })

  it('leer: Erlaubnis, aber keine Daten', () => {
    const demo = createHealthDemo('leer', clock)
    expect(demo.weight(range(365))).toBeNull()
    expect(demo.steps(today()).count).toBe(0)
    expect(demo.sleep(range(30))).toEqual([])
    expect(demo.heartRate(range(1))).toEqual([])
    expect(demo.workouts(range(30))).toEqual([])
    expect(demo.activeEnergy(today())).toBe(0)
  })

  it('luecken: alte Werte, fehlende Messwerte, keine aktiven kcal', () => {
    const demo = createHealthDemo('luecken', clock)
    expect(demo.weight(range(30))).toBeNull()
    expect(demo.weight(range(365))?.valueKg).toBe(79)
    expect(demo.heartRate(range(1, 0)).every(s => NOW.getTime() - s.date.getTime() >= 14 * 60 * 60 * 1000)).toBe(true)
    const bare = demo.workouts(range(30)).find(w => w.activityType === 'Other')
    expect(bare).toMatchObject({ activityId: 79, kcal: null, distanceM: null, avgHr: null })
    expect(demo.activeEnergy(today())).toBeNull()
  })

  it('extrem: Grenzwerte', () => {
    const demo = createHealthDemo('extrem', clock)
    expect(demo.weight(range(1))?.valueKg).toBe(184.7)
    const bpm = demo.heartRate(range(1)).map(s => s.bpm)
    expect(Math.min(...bpm)).toBe(38)
    expect(Math.max(...bpm)).toBe(201)
    expect(demo.workouts(range(2)).length).toBe(12)
  })

  it('android: wie das heutige Plugin ohne Schlaf, Workouts und aktive kcal', () => {
    const demo = createHealthDemo('android', clock)
    expect(demo.platform).toBe('android')
    expect(demo.sleep(range(30))).toEqual([])
    expect(demo.workouts(range(30))).toEqual([])
    expect(demo.activeEnergy(today())).toBeNull()
    expect(demo.steps(today()).count).toBeGreaterThan(0)
  })
})
