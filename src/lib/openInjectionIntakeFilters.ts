import type { InjectionIntakeStatus, OpenInjectionIntake } from './injectionPersistence'

// Offene Einnahmen reichen nur INJECTION_INTAKE_LOOKBACK_DAYS zurueck; 'all' = alles Geladene.
export type IntakeHistoryDays = 0 | 1 | 7 | 14 | 'all'
export type IntakeSortOrder = 'newest' | 'oldest'
export type IntakeStatusFilter = InjectionIntakeStatus | 'all'

export interface OpenIntakeFilterOptions {
  cycleId: string
  days: IntakeHistoryDays
  order: IntakeSortOrder
  status: IntakeStatusFilter
}

const DEFAULT_OPTIONS: OpenIntakeFilterOptions = {
  cycleId: 'all',
  days: 7,
  order: 'newest',
  status: 'all',
}

export function filterOpenInjectionIntakes(
  intakes: OpenInjectionIntake[],
  options: Partial<OpenIntakeFilterOptions> = {},
): OpenInjectionIntake[] {
  const filters = { ...DEFAULT_OPTIONS, ...options }

  return intakes
    .filter(intake => filters.cycleId === 'all' || intake.cycleId === filters.cycleId)
    .filter(intake => filters.status === 'all' || intake.status === filters.status)
    .filter(intake => {
      if (filters.days === 'all') return true
      if (filters.days === 0 || filters.days === 1) return intake.daysOverdue === filters.days
      return intake.daysOverdue <= filters.days
    })
    .sort((a, b) => {
      const difference = new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
      return filters.order === 'newest' ? difference : -difference
    })
}
