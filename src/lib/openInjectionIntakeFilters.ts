import type { InjectionIntakeStatus, OpenInjectionIntake } from './injectionPersistence'

// 'all' = alles Geladene (INJECTION_INTAKE_LOOKBACK_DAYS).
export const INTAKE_DAY_OPTIONS = [0, 1, 7, 14, 30, 60, 'all'] as const
export type IntakeHistoryDays = typeof INTAKE_DAY_OPTIONS[number]
export type IntakeSortOrder = 'newest' | 'oldest'
export type IntakeStatusFilter = InjectionIntakeStatus | 'all'

export interface OpenIntakeFilterOptions {
  cycleId: string
  /** Substanz (stack_item_id) oder 'all'. */
  stackItemId: string
  days: IntakeHistoryDays
  order: IntakeSortOrder
  status: IntakeStatusFilter
}

const DEFAULT_OPTIONS: OpenIntakeFilterOptions = {
  cycleId: 'all',
  stackItemId: 'all',
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
    .filter(intake => filters.stackItemId === 'all' || intake.stackItemId === filters.stackItemId)
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
