import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { INJECTION_STUDIO_BACKDROP } from './injectionStudioLook'

describe('Bühne der Injektionskarte', () => {
  it('nutzt in jedem Erscheinungsbild denselben Hintergrund', () => {
    const css = readFileSync(new URL('../styles/liquid-glass.css', import.meta.url), 'utf8')
    expect(INJECTION_STUDIO_BACKDROP).toBe('var(--inj-backdrop)')
    // Genau eine Definition (in :root), kein Look setzt einen eigenen Wert.
    expect(css.match(/--inj-backdrop\s*:/g)).toHaveLength(1)
  })
})
