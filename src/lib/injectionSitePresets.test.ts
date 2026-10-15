// src/lib/injectionSitePresets.test.ts
import { describe, expect, it } from 'vitest'
import { inferBodyRegion, proximityWarning } from './injectionGeometry'
import { INJECTION_MODEL_VERSION } from './injectionModelMaterial'
import { INJECTION_SITE_PRESETS, injectionSitePresetKey, pinDraftFromPreset } from './injectionSitePresets'
import type { InjectionLog3D } from './injectionLogTypes'

describe('INJECTION_SITE_PRESETS', () => {
  it('deckt die ueblichen Stellen beidseitig ab, jede genau einmal', () => {
    const keys = INJECTION_SITE_PRESETS.map(injectionSitePresetKey)
    expect(new Set(keys).size).toBe(keys.length)
    for (const region of ['abdomen', 'thigh', 'deltoid', 'upper_arm', 'glute']) {
      expect(keys).toContain(`${region}_left`)
      expect(keys).toContain(`${region}_right`)
    }
  })

  it.each(INJECTION_SITE_PRESETS.map(preset => ({ key: injectionSitePresetKey(preset), preset })))(
    '$key wird von der Regionserkennung als genau diese Stelle erkannt',
    ({ preset }) => {
      expect(inferBodyRegion(preset.position, preset.normal)).toEqual({ body_region: preset.region, body_side: preset.side })
      expect(Math.hypot(preset.normal.x, preset.normal.y, preset.normal.z)).toBeCloseTo(1, 2)
    },
  )

  it('liegt anatomisch an der benannten Stelle (Modell: Schritt y≈0.2, Hosenbund y≈0.56, Achsel y≈0.94, Knie y≈-0.47)', () => {
    const at = (key: string) => INJECTION_SITE_PRESETS.find(preset => injectionSitePresetKey(preset) === key)!.position
    for (const side of ['left', 'right']) {
      expect(at(`abdomen_${side}`).y).toBeGreaterThan(0.56)
      expect(at(`abdomen_${side}`).y).toBeLessThan(0.94)
      expect(at(`thigh_${side}`).y).toBeLessThan(0.07)
      expect(at(`thigh_${side}`).y).toBeGreaterThan(-0.47)
      expect(at(`glute_${side}`).y).toBeGreaterThan(0.2)
      expect(at(`glute_${side}`).y).toBeLessThan(0.56)
      expect(at(`deltoid_${side}`).y).toBeGreaterThan(0.94)
      expect(at(`upper_arm_${side}`).y).toBeLessThan(at(`deltoid_${side}`).y)
      expect(Math.abs(at(`upper_arm_${side}`).x)).toBeGreaterThan(Math.abs(at(`deltoid_${side}`).x))
    }
  })

  it('Gesaess liegt hinten, alles andere vorn', () => {
    for (const preset of INJECTION_SITE_PRESETS) {
      if (preset.region === 'glute') expect(preset.normal.z).toBeLessThan(-0.35)
      else expect(preset.normal.z).toBeGreaterThan(0.35)
    }
  })
})

describe('pinDraftFromPreset', () => {
  it('liefert einen echten Pin im Koordinatenraum des Modells, ohne die Vorlage zu teilen', () => {
    const preset = INJECTION_SITE_PRESETS[0]
    const pin = pinDraftFromPreset(preset)
    expect(pin).toMatchObject({ model_version: INJECTION_MODEL_VERSION, body_region: preset.region, body_side: preset.side })
    pin.position.x = 99
    expect(preset.position.x).not.toBe(99)
  })

  it('loest die Abstandswarnung aus wie ein Long-Press-Pin an derselben Stelle', () => {
    const pin = pinDraftFromPreset(INJECTION_SITE_PRESETS[0])
    const recent = { ...pin, id: 'l1', logged_at: '2026-10-14T08:00:00Z' } as InjectionLog3D
    expect(proximityWarning(pin, [recent], new Date('2026-10-15T08:00:00Z')).level).toBe('strong')
  })
})
