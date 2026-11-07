import { beforeEach, describe, expect, it, vi } from 'vitest'

/** Supabase-Attrappe nur fuer `delete`: merkt sich die Tabellen-Reihenfolge, Fehler je Tabelle. */
const fake = vi.hoisted(() => {
  const state = { calls: [] as string[], errors: {} as Record<string, { code?: string; message?: string } | null> }
  const supabase = {
    from: (table: string) => ({
      delete: () => {
        const q = {
          eq: () => q,
          then: (resolve: (v: unknown) => void) => { state.calls.push(table); resolve({ error: state.errors[table] ?? null }) },
        }
        return q
      },
    }),
  }
  return { state, supabase }
})

vi.mock('../../../lib/supabase', () => ({ supabase: fake.supabase }))

const { deletePlan } = await import('./trainingRepo')

describe('deletePlan', () => {
  beforeEach(() => { fake.state.calls = []; fake.state.errors = {} })

  it('loescht erst die Workouts, dann den Zeitplan', async () => {
    await expect(deletePlan('u', 'PPL')).resolves.toEqual({ workoutsDeleted: true, scheduleDeleted: true })
    expect(fake.state.calls).toEqual(['training_routines', 'training_plans'])
  })

  it('scheitern die Workouts, bleibt alles stehen (kein Zeitplan geloescht)', async () => {
    fake.state.errors.training_routines = { message: 'offline' }
    await expect(deletePlan('u', 'PPL')).rejects.toMatchObject({ message: 'offline' })
    expect(fake.state.calls).toEqual(['training_routines'])
  })

  it('scheitert nur der Zeitplan, meldet es (der leere Plan bleibt sichtbar)', async () => {
    fake.state.errors.training_plans = { message: 'offline' }
    await expect(deletePlan('u', 'PPL')).resolves.toEqual({ workoutsDeleted: true, scheduleDeleted: false })
  })

  it('ohne Zeitplan-Tabelle gilt der Plan als ganz geloescht', async () => {
    fake.state.errors.training_plans = { code: '42P01' }
    await expect(deletePlan('u', 'PPL')).resolves.toEqual({ workoutsDeleted: true, scheduleDeleted: true })
  })
})
