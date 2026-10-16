// src/lib/injectionSave.test.ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

const persistence = vi.hoisted(() => ({
  assertInjectionProSchema: vi.fn(),
  confirmIntakeDoseLog: vi.fn(),
  confirmIntakeWithInjection: vi.fn(),
  saveInjectionLog: vi.fn(),
}))
vi.mock('./injectionPersistence', async importOriginal => ({
  ...(await importOriginal<typeof import('./injectionPersistence')>()),
  ...persistence,
}))

import { persistInjectionSave, type InjectionSaveInput } from './injectionSave'
import type { OpenInjectionIntake } from './injectionPersistence'

const supabase = {} as never
const pin = { model_version: 'placeholder-v1', position: { x: 0.12, y: 0.68, z: 0.16 }, normal: { x: 0, y: 0, z: 1 },
  body_region: 'abdomen' as const, body_side: 'right' as const, uv: null, camera_state: null }
const openIntake: OpenInjectionIntake = {
  cycleId: 'c1', planVersionId: 'v1', routineSlotKey: 'c1@2026-10-16T08:00', stackItemId: 's1',
  stackItemName: 'BPC-157', cycleName: 'Zyklus', dose: 250, unit: 'mcg', method: 'Subkutan',
  scheduledAt: '2026-10-16T06:00:00.000Z', daysOverdue: 0, status: 'open', doseLogId: null,
}
const input = (over: Partial<InjectionSaveInput> = {}): InjectionSaveInput => ({
  mode: 'intake', intake: openIntake, substanceLabel: null, dose: null, unit: null, method: null,
  notes: null, loggedAt: '2026-10-16T06:10:00.000Z', ...over,
})

describe('persistInjectionSave', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    persistence.assertInjectionProSchema.mockResolvedValue(undefined)
    persistence.saveInjectionLog.mockResolvedValue('i1')
    persistence.confirmIntakeDoseLog.mockResolvedValue('d-two-step')
  })

  it('offene Einnahme: ein atomarer Aufruf, danach Bestand -- kein zweiter Insert', async () => {
    persistence.confirmIntakeWithInjection.mockResolvedValue({ doseLogId: 'd1', injectionLogId: 'i1' })
    const debitStock = vi.fn()
    await persistInjectionSave(supabase, { userId: 'u', input: input(), pin, warningLevel: 'caution', planTimelineV2: true, debitStock })
    expect(persistence.confirmIntakeWithInjection).toHaveBeenCalledWith(supabase,
      expect.objectContaining({ userId: 'u', cycleId: 'c1', dose: 250, unit: 'mcg', debitVialStock: false }),
      { notes: null, warningState: 'caution', substanceLabel: null, pin })
    expect(debitStock).toHaveBeenCalledWith('d1')
    expect(persistence.confirmIntakeDoseLog).not.toHaveBeenCalled()
    expect(persistence.saveInjectionLog).not.toHaveBeenCalled()
  })

  it('Datenbank ohne die Funktion: zwei Schritte wie bisher', async () => {
    persistence.confirmIntakeWithInjection.mockResolvedValue(null)
    const debitStock = vi.fn()
    await persistInjectionSave(supabase, { userId: 'u', input: input(), pin, warningLevel: 'none', planTimelineV2: true, debitStock })
    expect(persistence.confirmIntakeDoseLog).toHaveBeenCalledTimes(1)
    expect(debitStock).toHaveBeenCalledWith('d-two-step')
    expect(persistence.saveInjectionLog).toHaveBeenCalledWith(supabase, expect.objectContaining({
      doseLogId: 'd-two-step', stackItemId: 's1', cycleId: 'c1', warningState: null, pin }))
  })

  it('bestaetigte Einnahme: Werte aus der Einnahme, nichts neu bestaetigt', async () => {
    const confirmed = { ...openIntake, status: 'confirmed' as const, doseLogId: 'd9', dose: 5, unit: 'mg' }
    const debitStock = vi.fn()
    await persistInjectionSave(supabase, {
      userId: 'u', input: input({ intake: confirmed, dose: 1, unit: 'IU' }), pin, warningLevel: 'none', planTimelineV2: true, debitStock,
    })
    expect(persistence.confirmIntakeWithInjection).not.toHaveBeenCalled()
    expect(persistence.confirmIntakeDoseLog).not.toHaveBeenCalled()
    // Bestand: der Aufruf ist fuer eine schon gebuchte Einnahme ein No-op (apply_inventory_confirmation).
    expect(debitStock).toHaveBeenCalledWith('d9')
    expect(persistence.saveInjectionLog).toHaveBeenCalledWith(supabase, expect.objectContaining({
      doseLogId: 'd9', dose: 5, unit: 'mg', loggedAt: confirmed.scheduledAt }))
  })

  it('manuell: nur der Insert, ohne Einnahme und ohne Bestand', async () => {
    const debitStock = vi.fn()
    await persistInjectionSave(supabase, {
      userId: 'u', input: input({ mode: 'manual', intake: null, dose: 2, unit: 'mg', substanceLabel: 'X' }),
      pin, warningLevel: 'none', planTimelineV2: true, debitStock,
    })
    expect(debitStock).not.toHaveBeenCalled()
    expect(persistence.saveInjectionLog).toHaveBeenCalledWith(supabase, expect.objectContaining({
      doseLogId: null, stackItemId: null, dose: 2, unit: 'mg', substanceLabel: 'X' }))
  })

  it('ohne Planversionen nie atomar', async () => {
    const debitStock = vi.fn()
    await persistInjectionSave(supabase, { userId: 'u', input: input(), pin, warningLevel: 'none', planTimelineV2: false, debitStock })
    expect(persistence.confirmIntakeWithInjection).not.toHaveBeenCalled()
    expect(persistence.confirmIntakeDoseLog).toHaveBeenCalledTimes(1)
  })

  it('fehlende Spalten: Abbruch vor jedem Schreiben', async () => {
    const error = { code: '42703', message: 'column missing' }
    persistence.assertInjectionProSchema.mockRejectedValue(error)
    await expect(persistInjectionSave(supabase, {
      userId: 'u', input: input(), pin, warningLevel: 'none', planTimelineV2: true, debitStock: vi.fn(),
    })).rejects.toBe(error)
    expect(persistence.confirmIntakeWithInjection).not.toHaveBeenCalled()
    expect(persistence.saveInjectionLog).not.toHaveBeenCalled()
  })
})
