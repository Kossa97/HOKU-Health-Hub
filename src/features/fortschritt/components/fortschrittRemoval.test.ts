import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'

const readSource = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('Fortschritt ohne Substanzen-Fokus', () => {
  test('entfernt die Karte Aktive Substanzen aus dem Dashboard', () => {
    const source = readSource('./FortschrittDashboard.tsx')

    expect(source).not.toContain('ActiveSubstancesSection')
    expect(source).not.toContain('Aktive Substanzen')
  })

  test('rendert Zyklus-Balken ohne Fokus-bedingtes Ausblenden', () => {
    const source = readSource('./verlauf/GlassChart.tsx')

    expect(source).not.toContain('focusId')
    expect(source).not.toContain('faded')
  })
})
