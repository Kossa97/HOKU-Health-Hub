import { describe, expect, it } from 'vitest'
import { UNTERSTUETZT } from './detektoren.ts'
// Einzige Ausnahme von „nur relative Importe“: pinnt die Liste an den Katalog der App.
import { EXERCISE_CATALOG } from '../../../../src/features/training/data/exercises'

describe('erkenntnisse: Übungen mit Unterstützung stimmen mit dem Katalog der App überein', () => {
  it('UNTERSTUETZT enthält genau die Katalogübungen mit Erfassung assisted_reps', () => {
    const katalog = EXERCISE_CATALOG.filter((e) => e.tracking === 'assisted_reps').map((e) => e.id).sort()
    expect(katalog.length).toBeGreaterThan(0)
    expect([...UNTERSTUETZT].sort()).toEqual(katalog)
  })
})
