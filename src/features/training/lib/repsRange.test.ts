import { describe, expect, it } from 'vitest'
import { migrateRepsRange } from './repsRange'

describe('migrateRepsRange', () => {
  it('uebernimmt die v1-Wdh. in beide Grenzen, wenn sie noch fehlen', () => {
    expect(migrateRepsRange({ type: 'normal', reps: 10 })).toEqual({ repsMin: 10, repsMax: 10 })
    // eine Grenze schon gesetzt: nur die andere kommt aus `reps`
    expect(migrateRepsRange({ type: 'normal', reps: 10, repsMin: 8 })).toEqual({ repsMin: 8, repsMax: 10 })
    // ohne alles: leer, aber ausdruecklich
    expect(migrateRepsRange({ type: 'normal' })).toEqual({ repsMin: null, repsMax: null })
  })

  it('verliert beim Setzen einer Grenze die andere nicht', () => {
    const set = { type: 'normal' as const, reps: 10 }
    const next = { ...set, ...migrateRepsRange(set), repsMax: 12, reps: null }
    expect(next).toEqual({ type: 'normal', reps: null, repsMin: 10, repsMax: 12 })
  })
})
