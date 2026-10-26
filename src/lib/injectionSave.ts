// src/lib/injectionSave.ts
//
// Speichern eines neuen Pins: welche Datenbankaufrufe in welcher Reihenfolge.
// Ohne Toasts und Seitenzustand -- das bleibt in InjektionsTracker.tsx.
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  assertInjectionProSchema,
  confirmIntakeDoseLog,
  confirmIntakeWithInjection,
  resolveInjectionDoseLogId,
  saveInjectionLog,
  type OpenInjectionIntake,
} from './injectionPersistence'
import type { InjectionPinDraft, InjectionProximityWarning } from './injectionLogTypes'

export type InjectionSaveMode = 'intake' | 'manual'

export interface InjectionSaveInput {
  mode: InjectionSaveMode
  intake: OpenInjectionIntake | null
  substanceLabel: string | null
  dose: number | null
  unit: string | null
  method: string | null
  notes: string | null
  loggedAt: string
}

export interface PersistInjectionSaveRequest {
  userId: string
  input: InjectionSaveInput
  pin: InjectionPinDraft
  warningLevel: InjectionProximityWarning['level']
  planTimelineV2: boolean
  /** Bestand ist ein getrennt wiederholbarer Nachlauf zur gespeicherten Einnahme; wirft nicht. */
  debitStock: (committedDoseLogId: string) => Promise<void>
}

export async function persistInjectionSave(
  supabase: SupabaseClient,
  { userId, input, pin, warningLevel, planTimelineV2, debitStock }: PersistInjectionSaveRequest,
): Promise<void> {
  await assertInjectionProSchema(supabase)

  const warningState = warningLevel === 'none' ? null : warningLevel

  const openIntake = input.mode === 'intake' && input.intake?.status === 'open' ? input.intake : null
  const confirmInput = openIntake ? {
    userId,
    stackItemId: openIntake.stackItemId,
    dose: input.dose ?? openIntake.dose,
    unit: input.unit ?? openIntake.unit,
    method: input.method ?? openIntake.method,
    loggedAt: input.loggedAt,
    doseLogId: openIntake.doseLogId,
    cycleId: openIntake.cycleId,
    planVersionId: openIntake.planVersionId,
    routineSlotKey: openIntake.routineSlotKey,
    scheduledAt: openIntake.scheduledAt,
    debitVialStock: false,
  } : null

  // Offene Einnahme: bestaetigen und Stelle speichern in einer
  // Transaktion. `null` heisst, die Datenbank kennt die Funktion noch
  // nicht -- dann der bisherige Weg in zwei Schritten. Der alte Zweig
  // ohne Planversionen (planTimelineV2 aus) bleibt zweistufig; die
  // Datenbankfunktion braucht Zyklus und Planversion.
  const atomic = planTimelineV2 && confirmInput
    ? await confirmIntakeWithInjection(supabase, confirmInput, {
      notes: input.notes, warningState, substanceLabel: input.substanceLabel, pin,
    })
    : null

  if (atomic) {
    await debitStock(atomic.doseLogId)
    return
  }

  let doseLogId: string | null = null
  let stackItemId: string | null = null
  let cycleId: string | null = null

  if (input.mode === 'intake' && input.intake) {
    const intake = input.intake
    stackItemId = intake.stackItemId
    cycleId = intake.cycleId
    doseLogId = await resolveInjectionDoseLogId(intake, () => {
      if (!confirmInput) throw new Error('Open intake is missing its confirmation input')
      return confirmIntakeDoseLog(supabase, confirmInput)
    })
    await debitStock(doseLogId)
  }

  const confirmedSnapshot = planTimelineV2 && input.mode === 'intake' && input.intake?.status === 'confirmed'
    ? input.intake : null
  await saveInjectionLog(supabase, {
    userId,
    doseLogId,
    stackItemId,
    cycleId,
    dose: confirmedSnapshot?.dose ?? input.dose,
    unit: confirmedSnapshot?.unit ?? input.unit,
    method: confirmedSnapshot?.method ?? input.method,
    notes: input.notes,
    loggedAt: confirmedSnapshot?.scheduledAt ?? input.loggedAt,
    warningState,
    substanceLabel: input.substanceLabel,
    pin,
  })
}
