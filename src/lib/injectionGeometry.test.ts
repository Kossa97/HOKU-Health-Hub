// src/lib/injectionGeometry.test.ts
import { describe, expect, it } from 'vitest'
import {
  BODY_LANDMARKS,
  filterRecentInjectionLogs,
  inferBodyRegion,
  proximityWarning,
} from './injectionGeometry'
import type { InjectionLog3D, InjectionPinDraft } from './injectionLogTypes'

const baseLog = (overrides: Partial<InjectionLog3D>): InjectionLog3D => ({
  id: overrides.id ?? 'log-1',
  user_id: 'user-1',
  dose_log_id: null,
  stack_item_id: null,
  cycle_id: null,
  stack_item_name: overrides.stack_item_name ?? null,
  cycle_name: overrides.cycle_name ?? null,
  dose: overrides.dose ?? 250,
  unit: overrides.unit ?? 'mcg',
  method: overrides.method ?? 'Subkutan',
  notes: overrides.notes ?? null,
  logged_at: overrides.logged_at ?? '2026-06-17T08:00:00.000Z',
  created_at: overrides.created_at ?? '2026-06-17T08:00:00.000Z',
  model_version: 'placeholder-v1',
  body_region: overrides.body_region ?? 'abdomen',
  body_side: overrides.body_side ?? 'right',
  position: overrides.position ?? { x: 0.22, y: 0.4, z: 0.42 },
  normal: overrides.normal ?? { x: 0, y: 0, z: 1 },
  uv: null,
  camera_state: null,
  warning_state: overrides.warning_state ?? null,
})

const draft = (position: InjectionPinDraft['position']): InjectionPinDraft => ({
  model_version: 'placeholder-v1',
  position,
  normal: { x: 0, y: 0, z: 1 },
  body_region: 'abdomen',
  body_side: 'right',
})

// Punkte auf der Haut des Modells (placeholder-v1, eingepasst wie die Karte),
// Grenzen siehe BODY_LANDMARKS.
const FRONT = { x: 0, y: 0, z: 1 }
const BACK = { x: 0, y: 0, z: -1 }

describe('inferBodyRegion', () => {
  it.each([
    ['Bauch neben dem Nabel', { x: 0.12, y: 0.68, z: 0.16 }, FRONT, 'abdomen', 'right'],
    ['Rippenbogen (frueher: „Bauch“)', { x: 0.15, y: 0.9, z: 0.2 }, FRONT, 'chest', 'right'],
    ['Unterbauch ueber dem Hosenbund', { x: -0.2, y: 0.45, z: 0.12 }, FRONT, 'abdomen', 'left'],
    ['Brust ueber der Achsel', { x: 0.16, y: 1.05, z: 0.2 }, FRONT, 'chest', 'right'],
    ['seitliche Schulter', { x: 0.42, y: 1.1, z: -0.03 }, FRONT, 'deltoid', 'right'],
    ['Oberarm-Mitte', { x: -0.55, y: 0.87, z: -0.09 }, FRONT, 'upper_arm', 'left'],
    ['Unterarm', { x: 0.75, y: 0.5, z: 0 }, FRONT, 'forearm', 'right'],
    ['Oberschenkel oben (frueher: „Bauch“)', { x: -0.2, y: 0.1, z: 0.12 }, FRONT, 'thigh', 'left'],
    ['Oberschenkel Mitte', { x: 0.2, y: -0.2, z: 0.09 }, FRONT, 'thigh', 'right'],
    ['Unterschenkel', { x: 0.2, y: -0.8, z: 0.05 }, FRONT, 'lower_leg', 'right'],
    ['Gesaess oben aussen', { x: 0.17, y: 0.42, z: -0.21 }, BACK, 'glute', 'right'],
    ['Oberschenkel hinten unter der Gesaessfalte', { x: -0.17, y: -0.1, z: -0.1 }, BACK, 'thigh', 'left'],
    ['unterer Ruecken', { x: 0.1, y: 0.75, z: -0.15 }, BACK, 'torso', 'right'],
  ] as const)('%s', (_name, position, normal, region, side) => {
    expect(inferBodyRegion(position, normal)).toEqual({ body_region: region, body_side: side })
  })

  it.each([
    ['Hals', { x: 0.05, y: 1.45, z: 0.05 }],
    ['Leiste', { x: 0.03, y: 0.25, z: 0.1 }],
    ['Hand', { x: 0.88, y: 0.15, z: 0 }],
    ['Fuss', { x: 0.2, y: -1.25, z: 0.1 }],
  ] as const)('%s ist keine uebliche Injektionsstelle', (_name, position) => {
    expect(inferBodyRegion(position, FRONT).body_region).toBe('outside_typical')
  })

  it('unterscheidet Gesaess und Unterbauch nur ueber die Blickrichtung der Haut', () => {
    const point = { x: 0.2, y: 0.4, z: 0 }
    expect(inferBodyRegion(point, FRONT).body_region).toBe('abdomen')
    expect(inferBodyRegion(point, BACK).body_region).toBe('glute')
  })
})

describe('filterRecentInjectionLogs', () => {
  it('keeps logs inside the requested day window', () => {
    const now = new Date('2026-06-17T12:00:00.000Z')
    const logs = [
      baseLog({ id: 'recent', logged_at: '2026-06-15T12:00:00.000Z' }),
      baseLog({ id: 'old', logged_at: '2026-06-01T12:00:00.000Z' }),
    ]
    expect(filterRecentInjectionLogs(logs, now, 7).map(log => log.id)).toEqual(['recent'])
  })
})

describe('proximityWarning', () => {
  it('returns none when no recent pin is nearby', () => {
    const now = new Date('2026-06-17T12:00:00.000Z')
    const logs = [baseLog({ position: { x: 0.8, y: 0.8, z: 0.8 } })]
    expect(proximityWarning(draft({ x: 0.1, y: 0.1, z: 0.1 }), logs, now).level).toBe('none')
  })

  it('returns caution for a nearby pin from the last seven days', () => {
    const now = new Date('2026-06-17T12:00:00.000Z')
    // 6 days ago: within the 7-day recent window but older than the 3-day strong window.
    const logs = [baseLog({ logged_at: '2026-06-11T12:00:00.000Z', position: { x: 0.11, y: 0.1, z: 0.1 } })]
    const result = proximityWarning(draft({ x: 0.1, y: 0.1, z: 0.1 }), logs, now)
    expect(result.level).toBe('caution')
    expect(result.nearestLogId).toBe('log-1')
  })

  it('returns strong for a very nearby pin from the last three days', () => {
    const now = new Date('2026-06-17T12:00:00.000Z')
    const logs = [baseLog({ logged_at: '2026-06-16T12:00:00.000Z', position: { x: 0.105, y: 0.1, z: 0.1 } })]
    expect(proximityWarning(draft({ x: 0.1, y: 0.1, z: 0.1 }), logs, now).level).toBe('strong')
  })
})

describe('BODY_LANDMARKS und supabase-injection-regions-v2.sql', () => {
  it('rechnen mit denselben Grenzen (gespeicherte Pins werden in SQL nachgerechnet)', async () => {
    const { readFileSync } = await import('node:fs')
    const sql = readFileSync(new URL('../../supabase-injection-regions-v2.sql', import.meta.url), 'utf8')
    const L = BODY_LANDMARKS
    for (const fragment of [
      `y > ${L.neckY} and ax < ${L.neckHalfWidth}`,
      `when y > ${L.armpitY} then case when ax > ${L.chestHalfWidth}`,
      `when ax > ${L.armHalfWidth} then case when y > ${L.elbowY}`,
      `when y > ${L.wristY} then 'forearm'`,
      `when y > ${L.ribY} then case when back then 'torso' else 'chest' end`,
      `when y > ${L.hipY} then`,
      `when y > ${L.crotchY} then`,
      `ax < ${L.groinHalfWidth} and y < ${L.groinY}`,
      `back and y > ${L.gluteFoldY}`,
      `when y > ${L.kneeY} then 'thigh'`,
      `when y > ${L.ankleY} then 'lower_leg'`,
      `< ${L.backNormalZ} as back`,
      `> 0.06 then 'right'`,
      `< -0.06 then 'left'`,
    ]) expect(sql).toContain(fragment)
    // Reihenfolge der Faelle wie in regionFromPoint (der erste Treffer zaehlt).
    const order = ['neckHalfWidth', 'armpitY', 'armHalfWidth', 'ribY', 'hipY', 'crotchY', 'gluteFoldY', 'kneeY', 'ankleY'] as const
    const fn = sql.slice(sql.indexOf('create or replace function pg_temp.injection_region_v2'))
    const positions = order.map(key => fn.indexOf(String(L[key])))
    expect(positions.every(position => position >= 0)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
  })
})
