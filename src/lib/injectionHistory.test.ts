import { describe, expect, it } from 'vitest'
import { filterInjectionHistory, formatInjectionSite, isDoseConfirmationOpen } from './injectionHistory'
import type { InjectionLog3D } from './injectionLogTypes'

const log = (overrides: Partial<InjectionLog3D> = {}): InjectionLog3D => ({
  id: overrides.id ?? 'log-1',
  user_id: 'user-1',
  dose_log_id: overrides.dose_log_id ?? null,
  dose_taken: overrides.dose_taken,
  stack_item_id: null,
  cycle_id: null,
  stack_item_name: null,
  cycle_name: null,
  dose: 100,
  unit: 'mcg',
  method: 'Subkutan',
  notes: null,
  logged_at: overrides.logged_at ?? '2026-06-23T20:00:00.000Z',
  created_at: null,
  model_version: overrides.model_version ?? 'placeholder-v1',
  body_region: overrides.body_region ?? 'abdomen',
  body_side: overrides.body_side ?? 'right',
  position: overrides.position ?? { x: 0.32, y: 0.8, z: 0.12 },
  normal: overrides.normal ?? { x: 0.1, y: 0, z: 0.95 },
  uv: null,
  camera_state: null,
  warning_state: null,
})

describe('filterInjectionHistory', () => {
  const logs = [
    log({ id: 'recent', logged_at: '2026-06-23T20:00:00.000Z' }),
    log({ id: 'older', logged_at: '2026-06-10T20:00:00.000Z' }),
  ]

  it('shows the last seven days by default', () => {
    expect(filterInjectionHistory(logs, new Date('2026-06-24T12:00:00.000Z')).map(item => item.id))
      .toEqual(['recent'])
  })

  it('supports wider and unlimited history windows', () => {
    expect(filterInjectionHistory(logs, new Date('2026-06-24T12:00:00.000Z'), 30)).toHaveLength(2)
    expect(filterInjectionHistory(logs, new Date('2026-06-24T12:00:00.000Z'), 'all')).toHaveLength(2)
  })
})

describe('formatInjectionSite', () => {
  it('describes a precise right upper outer abdominal site in German', () => {
    expect(formatInjectionSite(log())).toBe('Bauch rechts · oben außen · Vorderseite')
  })

  it('uses German umlauts for rear and glute labels', () => {
    expect(formatInjectionSite(log({
      body_region: 'glute',
      body_side: 'center',
      position: { x: 0.12, y: 0.42, z: -0.2 },
      normal: { x: 0, y: 0, z: -0.95 },
    }))).toBe('Gesäß mittig · oben innen · Rückseite')
  })

  it('says „mittig“ only once when height and side are both in the middle', () => {
    expect(formatInjectionSite(log({
      body_region: 'thigh',
      body_side: 'right',
      position: { x: 0.2, y: -0.1, z: 0.12 },
      normal: { x: 0, y: -0.2, z: 0.97 },
    }))).toBe('Oberschenkel rechts · mittig · Vorderseite')
  })

  it('does not invent a position for legacy entries', () => {
    expect(formatInjectionSite(log({
      model_version: 'legacy-2d',
      body_region: 'outside_typical',
      body_side: 'center',
      position: { x: 0, y: 0, z: 0 },
    }))).toBe('Alter Eintrag · keine genaue Position')
  })
})

describe('isDoseConfirmationOpen', () => {
  it('marks linked injections with reset dose confirmations as open', () => {
    expect(isDoseConfirmationOpen(log({ dose_log_id: 'dose-1', dose_taken: null }))).toBe(true)
    expect(isDoseConfirmationOpen(log({ dose_log_id: 'dose-1', dose_taken: true }))).toBe(false)
    expect(isDoseConfirmationOpen(log({ dose_log_id: null, dose_taken: null }))).toBe(false)
  })
})
