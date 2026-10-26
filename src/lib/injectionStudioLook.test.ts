import { describe, expect, it } from 'vitest'
import { INJECTION_STUDIO_LIGHTS, injectionStudioLightsFor } from './injectionStudioLook'

describe('Studio-Licht je Erscheinungsbild', () => {
  it('bleibt außer bei Nacht das Studio-Licht', () => {
    for (const look of ['schwarz', 'satin', 'licht'] as const) {
      expect(injectionStudioLightsFor(look)).toBe(INJECTION_STUDIO_LIGHTS)
    }
  })

  it('tönt bei Nacht nur die Kantenlichter, links cyan, rechts violett', () => {
    const nacht = injectionStudioLightsFor('nacht')
    expect(nacht.key).toEqual(INJECTION_STUDIO_LIGHTS.key)
    expect(nacht.fill).toEqual(INJECTION_STUDIO_LIGHTS.fill)
    expect(nacht.environmentIntensity).toBe(INJECTION_STUDIO_LIGHTS.environmentIntensity)
    expect(nacht.rimLeft.position).toEqual(INJECTION_STUDIO_LIGHTS.rimLeft.position)
    expect(nacht.rimRight.position).toEqual(INJECTION_STUDIO_LIGHTS.rimRight.position)
    expect(nacht.rimLeft.color).toBe('#7fe3ff')
    expect(nacht.rimRight.color).toBe('#b7a3ff')
  })
})
