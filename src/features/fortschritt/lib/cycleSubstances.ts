import type { CycleSubstance, DateRange } from '../types'
import { todayIso } from './substances'

/** Eine Substanz mit all ihren Zyklen — ein Chip, mehrere Balken. */
export interface SubstanceCycles {
  id: string
  name: string
  color: string
  cycles: CycleSubstance[]
}

/** Substanzen mit mindestens einem Zyklus im Zeitraum, in Reihenfolge des ersten Starts. */
export function substancesInRange(cycles: CycleSubstance[], range: DateRange): SubstanceCycles[] {
  const today = todayIso()
  const byId = new Map<string, SubstanceCycles>()
  for (const cycle of cycles) {
    const end = cycle.endDate ?? today
    if (cycle.startDate > range.to || end < range.from) continue
    const id = cycle.stackItemId || cycle.name
    const entry = byId.get(id) ?? { id, name: cycle.name, color: cycle.color, cycles: [] }
    entry.cycles.push(cycle)
    byId.set(id, entry)
  }
  return [...byId.values()]
}
