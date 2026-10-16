import type { RoutineGroup, TrackingLevel } from '../my-stack/types'

export interface RoutineIntake {
  key: string
  cycleId: string
  planVersionId: string | null
  pendingLogId: string | null
  stackItemId: string
  stackItemName: string
  trackingLevel: TrackingLevel
  group: RoutineGroup
  scheduledAt: string
  dose: number | null
  unit: string | null
  method: string
  injectable: boolean
}

export interface RoutineConfirmationEntry extends RoutineIntake {
  selected: boolean
  actualDose: number | null
  actualUnit: string | null
  /** Editable confirmation time; scheduledAt remains the occurrence identity. */
  actualLoggedAt?: string
}

export interface RoutineGroupModel {
  key: RoutineGroup
  items: RoutineIntake[]
  /** Eigener Name, etwa der eines selbst angelegten Bündels. */
  label?: string
}

const ROUTINE_GROUP_ORDER: RoutineGroup[] = ['morning', 'midday', 'evening']

export function routineGroupFromMinutes(minutes: number): RoutineGroup {
  const hour = Math.floor(minutes / 60) % 24
  if (hour < 12) return 'morning'
  if (hour < 18) return 'midday'
  return 'evening'
}

export function groupRoutineIntakes(intakes: RoutineIntake[]): RoutineGroupModel[] {
  return ROUTINE_GROUP_ORDER.flatMap(key => {
    const items = intakes
      .filter(intake => intake.group === key)
      .sort((left, right) => left.scheduledAt.localeCompare(right.scheduledAt))
    return items.length > 0 ? [{ key, items }] : []
  })
}

export function buildConfirmationEntry(intake: RoutineIntake): RoutineConfirmationEntry {
  const tracksAmount = intake.trackingLevel !== 'intake_only'
  return {
    ...intake,
    selected: true,
    actualDose: tracksAmount ? intake.dose : null,
    actualUnit: tracksAmount ? intake.unit : null,
  }
}
