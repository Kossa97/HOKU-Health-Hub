import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * health.ts liest beim Laden die Plattform. Jeder Test setzt sie über die
 * Mocks und lädt das Modul frisch.
 */
const platformState = vi.hoisted(() => ({ native: false, platform: 'web' }))
const healthKit = vi.hoisted(() => ({
  isAvailable: vi.fn(),
  requestAuthorization: vi.fn(),
  queryHKitSampleType: vi.fn(),
}))
const healthConnect = vi.hoisted(() => ({
  checkAvailability: vi.fn(),
  requestHealthPermissions: vi.fn(),
  readRecords: vi.fn(),
}))

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => platformState.native,
    getPlatform: () => platformState.platform,
  },
}))
vi.mock('@perfood/capacitor-healthkit', () => ({ CapacitorHealthkit: healthKit }))
vi.mock('capacitor-health-connect', () => ({ HealthConnect: healthConnect }))

async function loadAs(platform: 'ios' | 'android' | 'web') {
  platformState.native = platform !== 'web'
  platformState.platform = platform
  vi.resetModules()
  return import('./health')
}

/** HealthKit-Antwort je Sample-Art. */
function healthKitSamples(bySample: Record<string, unknown[]>) {
  healthKit.queryHKitSampleType.mockImplementation(async ({ sampleName }: { sampleName: string }) => ({
    resultData: bySample[sampleName] ?? [],
  }))
}

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Browser', () => {
  it('meldet „nicht verfügbar" und liefert nichts', async () => {
    const health = await loadAs('web')
    expect(health.isNative).toBe(false)
    expect(await health.requestPermissions()).toMatchObject({ available: false, granted: false })
    expect(await health.getWeight()).toBeNull()
    expect(await health.getSteps()).toBeNull()
    expect(await health.getSleep()).toEqual([])
    expect(await health.getWorkouts()).toEqual([])
    expect(await health.getActiveEnergy()).toBeNull()
    expect(healthKit.queryHKitSampleType).not.toHaveBeenCalled()
  })

  it('nutzt mit ?healthDemo die Testdaten statt der Plugins', async () => {
    vi.stubGlobal('location', { search: '?healthDemo=normal' })
    const health = await loadAs('web')
    expect(health.isNative).toBe(true)
    expect(health.isIOS).toBe(true)
    expect(await health.requestPermissions()).toMatchObject({ available: true, granted: true })
    expect((await health.getWeight())?.valueKg).toBe(82.4)
    expect((await health.getWorkouts()).length).toBeGreaterThan(0)
    expect(healthKit.queryHKitSampleType).not.toHaveBeenCalled()
  })

  it('Demo „android" meldet Android', async () => {
    vi.stubGlobal('location', { search: '?healthDemo=android' })
    const health = await loadAs('web')
    expect(health.isAndroid).toBe(true)
    expect(health.isIOS).toBe(false)
    expect(await health.getSleep()).toEqual([])
  })
})

describe('iOS (HealthKit)', () => {
  it('fragt die Leserechte ab und meldet Fehler als nicht verfügbar', async () => {
    const health = await loadAs('ios')
    expect(await health.requestPermissions()).toEqual({ platform: 'ios', available: true, granted: true })
    expect(healthKit.requestAuthorization).toHaveBeenCalledWith(expect.objectContaining({ write: [] }))

    healthKit.isAvailable.mockRejectedValueOnce(new Error('HealthKit not available'))
    expect(await health.requestPermissions()).toMatchObject({ available: false, reason: 'HealthKit not available' })
  })

  it('Gewicht: der neueste Wert, Quelle aus Name oder Bundle-ID', async () => {
    healthKitSamples({
      weight: [
        { value: 80, endDate: '2026-11-01T07:00:00Z', startDate: '2026-11-01T07:00:00Z', sourceBundleId: 'com.withings' },
        { value: 81.5, endDate: '2026-11-04T07:00:00Z', startDate: '2026-11-04T07:00:00Z', source: '', sourceBundleId: 'com.garmin' },
      ],
    })
    const health = await loadAs('ios')
    expect(await health.getWeight()).toEqual({ valueKg: 81.5, date: new Date('2026-11-04T07:00:00Z'), source: 'com.garmin' })
  })

  it('Schritte werden summiert', async () => {
    healthKitSamples({ stepCount: [{ value: 1200 }, { value: 800.5 }] })
    const health = await loadAs('ios')
    expect((await health.getSteps())?.count).toBe(2000.5)
  })

  it('Workouts: Stunden in Sekunden, −1 und 0 als „nicht gemessen", Puls gemittelt', async () => {
    healthKitSamples({
      workoutType: [{
        uuid: 'w1', workoutActivityName: 'Running', workoutActivityId: 37,
        startDate: '2026-11-03T07:00:00Z', endDate: '2026-11-03T07:45:00Z',
        duration: 0.75, totalDistance: -1, totalEnergyBurned: 0, source: 'Apple Watch',
      }],
      heartRate: [{ value: 140 }, { value: 150 }, { value: -1 }],
    })
    const health = await loadAs('ios')
    const [w] = await health.getWorkouts()
    expect(w).toMatchObject({ externalId: 'w1', durationS: 2700, distanceM: null, kcal: null, avgHr: 145, source: 'Apple Watch' })
  })

  it('Workouts: kein Puls-Nachschlagen für bekannte Einheiten', async () => {
    healthKitSamples({
      workoutType: [{ uuid: 'w1', workoutActivityName: 'Yoga', startDate: '2026-11-03T07:00:00Z', endDate: '2026-11-03T07:30:00Z', duration: 0.5 }],
      heartRate: [{ value: 90 }],
    })
    const health = await loadAs('ios')
    const [w] = await health.getWorkouts(undefined, { withHeartRate: () => false })
    expect(w.avgHr).toBeNull()
    expect(healthKit.queryHKitSampleType).toHaveBeenCalledTimes(1)
  })

  it('aktive Energie: negative Werte zählen nicht, Fehler ergibt null', async () => {
    healthKitSamples({ activeEnergyBurned: [{ value: 120.4 }, { value: -1 }, { value: 80.2 }] })
    const health = await loadAs('ios')
    expect(await health.getActiveEnergy()).toBe(201)
    healthKit.queryHKitSampleType.mockRejectedValueOnce(new Error('denied'))
    expect(await health.getActiveEnergy()).toBeNull()
  })
})

describe('Android (Health Connect)', () => {
  it('meldet fehlendes Health Connect und fehlende Rechte', async () => {
    const health = await loadAs('android')
    healthConnect.checkAvailability.mockResolvedValueOnce({ availability: 'NotInstalled' })
    expect(await health.requestPermissions()).toMatchObject({ available: false, reason: 'Health Connect is NotInstalled.' })

    healthConnect.checkAvailability.mockResolvedValueOnce({ availability: 'Available' })
    healthConnect.requestHealthPermissions.mockResolvedValueOnce({ hasAllPermissions: false, grantedPermissions: ['Steps'] })
    expect(await health.requestPermissions()).toMatchObject({ available: true, granted: false, grantedPermissions: ['Steps'] })
  })

  it('Puls: Serien werden zu einzelnen Messungen, neueste zuerst', async () => {
    healthConnect.readRecords.mockResolvedValueOnce({
      records: [{
        metadata: { dataOrigin: 'com.samsung.health' },
        samples: [
          { beatsPerMinute: 70, time: '2026-11-05T08:00:00Z' },
          { beatsPerMinute: 75, time: '2026-11-05T09:00:00Z' },
        ],
      }],
    })
    const health = await loadAs('android')
    const hr = await health.getHeartRate()
    expect(hr.map(s => s.bpm)).toEqual([75, 70])
    expect(hr[0].source).toBe('com.samsung.health')
  })

  it('Gewicht und Schritte', async () => {
    const health = await loadAs('android')
    healthConnect.readRecords.mockResolvedValueOnce({
      records: [{ weight: { value: 77.2 }, time: '2026-11-04T06:00:00Z', metadata: { dataOrigin: 'com.withings' } }],
    })
    expect((await health.getWeight())?.valueKg).toBe(77.2)
    healthConnect.readRecords.mockResolvedValueOnce({ records: [{ count: 3000 }, { count: 1500 }] })
    expect((await health.getSteps())?.count).toBe(4500)
  })

  it('Schlaf, Workouts und aktive kcal fragt das alte Plugin gar nicht erst', async () => {
    const health = await loadAs('android')
    expect(await health.getSleep()).toEqual([])
    expect(await health.getWorkouts()).toEqual([])
    expect(await health.getActiveEnergy()).toBeNull()
    expect(healthConnect.readRecords).not.toHaveBeenCalled()
  })
})

describe('AndroidManifest', () => {
  // Health Connect erteilt nur, was auch im Manifest steht.
  const MANIFEST_NAME: Record<string, string> = {
    Weight: 'READ_WEIGHT',
    Steps: 'READ_STEPS',
    HeartRateSeries: 'READ_HEART_RATE',
    RestingHeartRate: 'READ_RESTING_HEART_RATE',
  }

  it('erklärt genau die Leserechte, die health.ts anfragt', async () => {
    const { readFileSync } = await import('node:fs')
    const manifest = readFileSync(new URL('../../android/app/src/main/AndroidManifest.xml', import.meta.url), 'utf8')
    const declared = [...manifest.matchAll(/android\.permission\.health\.(\w+)/g)].map(m => m[1]).sort()
    const { ANDROID_READ_PERMISSIONS } = await loadAs('android')
    const requested = ANDROID_READ_PERMISSIONS.map(type => MANIFEST_NAME[type] ?? `unbekannt:${type}`).sort()
    expect(declared).toEqual(requested)
    expect(manifest).toContain('androidx.health.ACTION_SHOW_PERMISSIONS_RATIONALE')
    expect(manifest).toContain('android.intent.category.HEALTH_PERMISSIONS')
  })
})
