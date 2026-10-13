import { supabase } from '../lib/supabase'
import { FEATURES } from '../config/features'
import { loadCycleTimelines } from '../features/my-stack/services/planLifecycle'
import { resolveCycleAt } from '../lib/planTimeline'
import {
  loadDoseHistory,
  calculateHistoryBlutspiegelCurve,
} from './blutspiegelHistory'
import {
  evaluatePkReadiness,
  resolvePkScheduleForDay,
  type PkScheduleCycle,
} from '../features/my-stack/lib/pkReadiness'
import type { TrackingLevel } from '../features/my-stack/types'
import type { EscalationRow } from '../lib/intakeSchedule'

// ── Public types ────────────────────────────────────────────────────────────

export interface ChartPoint {
  timestamp: number   // Unix ms
  level: number       // 0–100 (normalised)
  status: 'actual' | 'planned'
}

export interface DoseMarker {
  timestamp: number
  dose: number
  unit: string
  status: 'taken' | 'skipped'
}

export interface PeakMarker {
  timestamp: number
  level: number
}

export interface CycleChartData {
  cycleId: string
  peptideName: string
  accent: string
  points: ChartPoint[]
  doseMarkers: DoseMarker[]
  peakMarkers: PeakMarker[]
  unit: string
  halfLifeHours: number
  interruptedAt: number | null
}

// ── Internals ───────────────────────────────────────────────────────────────

const CATEGORY_ACCENT: Record<string, string> = {
  peptide: '#00ccf5',
  glp1:    '#10b981',
  hormone: '#f59e0b',
  sarm:    '#a855f7',
  other:   '#94a3b8',
}

interface PkRow {
  half_life_hours: number
  tmax_hours: number
  bioavailability_sc: number
  iu_per_mg: number | null
  category: string
  routes?: string[] | null
}

interface CycleRow extends PkScheduleCycle {
  stack_items: {
    id: string
    display_name: string
    tracking_level: TrackingLevel
    pk_profile_method: string | null
    ingredients: Array<{
      position: number
      substance_catalog: {
        pk_profile_id: string | null
        pk_profiles: PkRow | null
      } | null
    }>
  } | null
}

function linkedProfile(cycle: CycleRow): { id: string; profile: PkRow } | null {
  const links = cycle.stack_items?.ingredients
    .slice()
    .sort((a, b) => a.position - b.position)
    .map(ingredient => ingredient.substance_catalog)
    .filter((catalog): catalog is NonNullable<typeof catalog> => Boolean(catalog)) ?? []
  const link = links.find(catalog => catalog.pk_profile_id && catalog.pk_profiles)
  return link?.pk_profile_id && link.pk_profiles
    ? { id: link.pk_profile_id, profile: link.pk_profiles }
    : null
}

/** Local maxima with level > 20, de-duplicated within 1 h. */
function detectPeaks(pts: ChartPoint[]): PeakMarker[] {
  const peaks: PeakMarker[] = []
  for (let i = 1; i < pts.length - 1; i++) {
    const { level, timestamp } = pts[i]
    if (level > pts[i - 1].level && level > pts[i + 1].level && level > 20) {
      const last = peaks[peaks.length - 1]
      if (!last || timestamp - last.timestamp >= 60 * 60_000) {
        peaks.push({ timestamp, level })
      }
    }
  }
  return peaks
}

// ── Public loader ────────────────────────────────────────────────────────────

/** Shared normalized reader for the chart, simulation page, and carousel. */
export async function loadNormalizedPkCycles(userId: string): Promise<CycleRow[]> {
  const [timelines, metadata] = await Promise.all([
    loadCycleTimelines(supabase as never, userId),
    supabase.from('cycles').select(`id, stack_items (
      id, display_name, tracking_level, pk_profile_method,
      ingredients:stack_item_ingredients ( position, custom_name, amount_value, amount_unit, basis_value, basis_unit,
        substance_catalog ( canonical_name, pk_profile_id,
          pk_profiles ( name, half_life_hours, tmax_hours, bioavailability_sc, iu_per_mg, vd_l_kg, category, routes )
        )
      )
    )`).eq('user_id', userId),
  ])
  if (metadata.error) throw metadata.error
  return timelines.filter(timeline => resolveCycleAt(timeline, new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone).status !== 'ended').map(timeline => {
    const row = metadata.data?.find(candidate => candidate.id === timeline.cycle.id)
    if (!row) throw new Error('PK cycle metadata unavailable')
    return { ...row, ...timeline.cycle, timeline } as unknown as CycleRow
  })
}

export async function loadAllCycleChartData(userId: string): Promise<CycleChartData[]> {
  const [{ data: cycles }, { data: escalationRows }] = FEATURES.planTimelineV2
    ? [{ data: await loadNormalizedPkCycles(userId) }, { data: [] }]
    : await Promise.all([
    supabase
      .from('cycles')
      .select(`id, stack_item_id, start_date, end_date, dose, unit, method,
        frequency, x_days_interval, interval_unit, cycle_on_days, cycle_off_days, slot_doses, slot_days, schedule_days, intake_time, intake_time_custom, schedule_history,
        stack_items ( id, display_name, tracking_level, pk_profile_method,
          ingredients:stack_item_ingredients ( position,
            substance_catalog ( pk_profile_id,
              pk_profiles ( half_life_hours, tmax_hours, bioavailability_sc, iu_per_mg, category, routes )
            )
          )
        )`)
      .eq('user_id', userId)
      .eq('active', true),
    supabase
      .from('dose_escalations')
      .select('cycle_id, increase_amount, unit, start_type, start_date, start_after_days')
      .eq('user_id', userId),
  ])

  if (!cycles?.length) return []

  const results: CycleChartData[] = []
  const escalations = (escalationRows ?? []) as EscalationRow[]
  const now = new Date()

  await Promise.all(
    (cycles as unknown as CycleRow[]).map(async cycle => {
      const linked = linkedProfile(cycle)
      const cycleEscalations = escalations.filter(row => row.cycle_id === cycle.id)
      const schedule = resolvePkScheduleForDay(cycle, cycleEscalations, now)
      if (!schedule) return
      const readiness = evaluatePkReadiness({
        trackingLevel: cycle.stack_items?.tracking_level ?? 'intake_only',
        pkProfileId: linked?.id ?? null,
        pkProfileMethod: cycle.stack_items?.pk_profile_method ?? null,
        pkProfileRoutes: linked?.profile.routes ?? null,
        method: schedule.method,
        dose: schedule.dose,
        unit: schedule.unit,
        scheduledAt: schedule.scheduledAt,
      })
      if (readiness.status !== 'ready' || !linked) return
      const pk = linked.profile

      const { events, interruptedAt } = await loadDoseHistory(cycle.id)
      if (!events.some(e => e.status === 'taken')) return

      // 15-min resolution for smooth canvas rendering
      const curveRaw = calculateHistoryBlutspiegelCurve(
        events,
        pk.half_life_hours,
        pk.tmax_hours,
        pk.bioavailability_sc,
        15,
        interruptedAt ? new Date(interruptedAt) : null,
        { iuPerMg: pk.iu_per_mg },
      )
      const points: ChartPoint[] = curveRaw.map(p => ({
        timestamp: p.time.getTime(),
        level:     p.level,
        status:    p.status,
      }))

      const doseMarkers: DoseMarker[] = events.map(ev => ({
        timestamp: ev.timestamp.getTime(),
        dose:      ev.dose,
        unit:      ev.unit,
        status:    ev.status === 'skipped' ? 'skipped' : 'taken',
      }))

      results.push({
        cycleId:      cycle.id,
        peptideName:  cycle.stack_items?.display_name ?? '?',
        accent:       CATEGORY_ACCENT[pk.category] ?? '#94a3b8',
        points,
        doseMarkers,
        peakMarkers:  detectPeaks(points),
        unit:         schedule.unit!,
        halfLifeHours: pk.half_life_hours,
        interruptedAt: interruptedAt ? new Date(interruptedAt).getTime() : null,
      })
    }),
  )

  return results
}
