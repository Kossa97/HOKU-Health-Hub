import { addDays, addMonths, differenceInCalendarMonths, differenceInDays, format, parseISO, startOfDay, subDays } from 'date-fns'
import {
  localDateTimeKey,
  localSlotInstant,
  resolveCycleAt,
  type CyclePlanVersion,
  type CycleTimeline,
} from './planTimeline'
import { slotSchluessel } from '../features/routines/lib/slotKey'

// Maps JS getDay() (0 = Sunday) to the German weekday codes stored on cycles.
const WEEKDAYS_DE: Record<number, string> = { 1: 'Mo', 2: 'Di', 3: 'Mi', 4: 'Do', 5: 'Fr', 6: 'Sa', 0: 'So' }
const SLOT_TIMES: Record<string, string> = { morgens: '08:00', mittags: '12:00', abends: '20:00' }
const SLOT_GROUPS = { morgens: 'morning', mittags: 'midday', abends: 'evening' } as const

export type ResolvedRoutineGroup = 'morning' | 'midday' | 'evening'

export interface ResolvedScheduleSlot {
  key: string
  routineGroup: ResolvedRoutineGroup
  time: string
  minutes: number
  /**
   * Die Menge DIESER Einnahme, wenn der Plan sie je Zeitpunkt festhaelt
   * („morgens 1000 mg, abends 500 mg"). null heisst: es gilt die Menge des
   * Zyklus, wie bei jedem Plan mit einer einzigen Zahl.
   */
  dose: number | null
}

export interface ResolvedTimelineIntake extends ResolvedScheduleSlot {
  /** Persisted slot key inside the plan snapshot (for example `morgens`). */
  slotKey: string
  cycleId: string
  stackItemId: string
  planVersionId: string
  dose: number | null
  unit: string | null
  method: string
  localDate: string
  scheduledAt: string
  /** Stable confirmation key: `${cycleId}@${localDate}T${HH:MM}` -- see `slotKey.ts`. */
  routineSlotKey: string
  pendingLogId: string | null
}

export interface ScheduleSegment {
  effective_from: string            // 'yyyy-MM-dd'
  frequency: string
  x_days_interval: number | null
  schedule_days: string[] | null
  intake_time: string | null
  intake_time_custom: string | null
  dose: number | null
  unit: string | null
  /** 'day' | 'week' | 'month' — fehlt bei alten Zyklen, dort sind es Tage. */
  interval_unit?: string | null
  /** Wechselzyklus: X Tage an, Y Tage aus. */
  cycle_on_days?: number | null
  cycle_off_days?: number | null
  /** Menge je Einnahmezeitpunkt, kommagetrennt wie `intake_time`. */
  slot_doses?: string | null
  /**
   * Wochentage je Einnahmezeitpunkt, kommagetrennt wie `intake_time`, die
   * Tage eines Zeitpunkts mit `|`: „Mo|Mi,Mo" heisst morgens an Mo und Mi,
   * abends nur an Mo. Ein leerer Eintrag heisst: an jedem Tag des Rhythmus.
   */
  slot_days?: string | null
}

export interface ScheduleCycle {
  id: string
  stack_item_id: string
  start_date: string
  end_date: string | null
  frequency: string
  x_days_interval: number | null
  schedule_days: string[] | null
  intake_time: string | null
  intake_time_custom: string | null
  dose: number | null
  unit: string | null
  schedule_history: ScheduleSegment[] | null
  interval_unit?: string | null
  cycle_on_days?: number | null
  cycle_off_days?: number | null
  slot_doses?: string | null
  slot_days?: string | null
}

export interface EscalationRow {
  cycle_id: string
  increase_amount: number
  unit: string
  start_type: 'date' | 'after_days' | 'after_weeks'
  start_date: string | null
  start_after_days: number | null
}

export interface EffectiveQuantity {
  dose: number
  unit: string
}

export interface IntakeLog {
  id?: string
  stack_item_id: string
  logged_at: string
  /** true = taken, false = skipped, null = reset. Decided (non-null) logs cover a slot. */
  taken: boolean | null
  cycle_id?: string | null
  plan_version_id?: string | null
  routine_slot_key?: string | null
}

// Active schedule segment for a given day. Empty history => flat cycle fields from start_date.
export function scheduleForDay(cycle: ScheduleCycle, day: Date): ScheduleSegment {
  const flat: ScheduleSegment = {
    effective_from: cycle.start_date,
    frequency: cycle.frequency,
    x_days_interval: cycle.x_days_interval,
    schedule_days: cycle.schedule_days,
    intake_time: cycle.intake_time,
    intake_time_custom: cycle.intake_time_custom,
    dose: cycle.dose,
    unit: cycle.unit,
    interval_unit: cycle.interval_unit ?? null,
    cycle_on_days: cycle.cycle_on_days ?? null,
    cycle_off_days: cycle.cycle_off_days ?? null,
    slot_doses: cycle.slot_doses ?? null,
    slot_days: cycle.slot_days ?? null,
  }
  const history = cycle.schedule_history
  if (!history || history.length === 0) return flat
  const dayKey = format(day, 'yyyy-MM-dd')
  const sorted = [...history].sort((a, b) => a.effective_from.localeCompare(b.effective_from))
  let seg = sorted[0]
  for (const s of sorted) {
    if (s.effective_from <= dayKey) seg = s
    else break
  }
  return seg
}

// Effective quantity for a cycle on a given day: segment base + same-unit active adjustments.
export function effectiveQuantity(cycle: ScheduleCycle, day: Date, escalations: EscalationRow[]): EffectiveQuantity | null {
  return effectiveSlotQuantity(cycle, day, escalations, null)
}

/**
 * Dasselbe fuer EINEN Einnahmezeitpunkt.
 *
 * Traegt der Zeitpunkt eine eigene Menge („morgens 1000, abends 500"), gilt
 * sie statt der Zyklusmenge — die Anpassungen kommen wie sonst obendrauf, denn
 * sie gelten fuer den ganzen Plan und nicht fuer einen Zeitpunkt.
 *
 * `slotDose` ist die `dose` aus `resolveScheduleSlots`; null heisst „dieser
 * Zeitpunkt hat keine eigene", und dann ist es genau `effectiveQuantity`.
 */
export function effectiveSlotQuantity(
  cycle: ScheduleCycle,
  day: Date,
  escalations: EscalationRow[],
  slotDose: number | null,
): EffectiveQuantity | null {
  const segment = scheduleForDay(cycle, day)
  const baseDose = slotDose ?? segment.dose
  const baseUnit = segment.unit
  if (baseDose == null || !Number.isFinite(baseDose) || baseDose <= 0 || !baseUnit?.trim()) return null

  const daysFromStart = differenceInDays(day, parseISO(cycle.start_date))
  let total = baseDose
  for (const escalation of escalations.filter(row => row.cycle_id === cycle.id)) {
    const activeByDate = escalation.start_type === 'date'
      && escalation.start_date != null
      && day >= parseISO(escalation.start_date)
    const activeByOffset = escalation.start_type !== 'date'
      && escalation.start_after_days != null
      && daysFromStart >= escalation.start_after_days
    if (activeByDate || activeByOffset) {
      if (
        !Number.isFinite(escalation.increase_amount)
        || !escalation.unit?.trim()
        || escalation.unit !== baseUnit
      ) return null
      total += escalation.increase_amount
    }
  }
  return Number.isFinite(total) && total > 0 ? { dose: total, unit: baseUnit } : null
}

function parsedClock(value: string | undefined): { time: string; minutes: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value?.trim() ?? '')
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (hours > 23 || minutes > 59) return null
  return { time: `${match[1]}:${match[2]}`, minutes: hours * 60 + minutes }
}

function routineGroupForMinutes(minutes: number): ResolvedRoutineGroup {
  const hour = Math.floor(minutes / 60) % 24
  if (hour < 12) return 'morning'
  if (hour < 18) return 'midday'
  return 'evening'
}

/**
 * Die Einnahmezeitpunkte eines Segments. MIT `day` nur die, die an diesem
 * Wochentag stattfinden — „montags zweimal, mittwochs einmal" ist sonst nicht
 * darstellbar. Ohne `day` kommen alle; das braucht nur, wer den Plan als
 * Ganzes ansieht und keinen bestimmten Tag (die PK-Bereitschaft etwa).
 */
export function resolveScheduleSlots(
  schedule: Pick<ScheduleSegment, 'intake_time' | 'intake_time_custom'>
    & { slot_doses?: string | null; slot_days?: string | null },
  day?: Date,
): ResolvedScheduleSlot[] {
  const keys = (schedule.intake_time ?? '').split(',').filter(Boolean)
  const exactTimes = (schedule.intake_time_custom ?? '').split(',')
  // Die Mengen stehen in derselben Reihenfolge wie die Tageszeiten, leere
  // Stellen eingeschlossen — sonst verrutscht die Zuordnung.
  const doses = (schedule.slot_doses ?? '').split(',')
  const days = (schedule.slot_days ?? '').split(',')
  const wochentag = day ? WEEKDAYS_DE[day.getDay()] : null

  return keys.flatMap((key, index) => {
    // Leer heisst „an jedem Tag" — so stand es in jedem Plan vor dieser
    // Aenderung, und so bleibt es der Normalfall.
    const tageDesSlots = (days[index] ?? '').split('|').map(tag => tag.trim()).filter(Boolean)
    if (wochentag && tageDesSlots.length > 0 && !tageDesSlots.includes(wochentag)) return []

    const fixedGroup = SLOT_GROUPS[key as keyof typeof SLOT_GROUPS]
    const clock = parsedClock(exactTimes[index]) ?? parsedClock(SLOT_TIMES[key])
    if (!clock) return []
    const menge = Number(doses[index])
    return [{
      key,
      routineGroup: fixedGroup ?? routineGroupForMinutes(clock.minutes),
      dose: (doses[index] ?? '').trim() !== '' && Number.isFinite(menge) && menge > 0 ? menge : null,
      ...clock,
    }]
  }).sort((left, right) => left.minutes - right.minutes)
}

function timelineVersionAsCycle(
  timeline: CycleTimeline,
  version: CyclePlanVersion,
  timeZone: string,
): ScheduleCycle {
  const startedAt = new Date(timeline.cycle.started_at)
  const startDate = timeline.versions.find(version => version.change_kind === 'initial' && version.effective_kind === 'local_date')?.effective_local_date
    ?? timeline.cycle.start_local_date ?? localDateTimeKey(startedAt, timeZone).slice(0, 10)
  return {
    id: timeline.cycle.id,
    stack_item_id: timeline.cycle.stack_item_id,
    start_date: startDate,
    end_date: null,
    frequency: version.frequency,
    x_days_interval: version.x_days_interval,
    schedule_days: version.schedule_days,
    intake_time: version.intake_time,
    intake_time_custom: version.intake_time_custom,
    dose: version.dose,
    unit: version.unit,
    schedule_history: null,
    interval_unit: version.interval_unit,
    cycle_on_days: version.cycle_on_days,
    cycle_off_days: version.cycle_off_days,
    slot_doses: version.slot_doses,
    slot_days: version.slot_days,
  }
}

const resolvedIntakeDayCache = new WeakMap<CycleTimeline, Map<string, ResolvedTimelineIntake[]>>()

export function resolveTimelineIntakesForDay(
  timeline: CycleTimeline,
  localDate: string,
  timeZone: string,
): ResolvedTimelineIntake[] {
  const day = parseISO(localDate)
  if (!Number.isFinite(day.getTime()) || format(day, 'yyyy-MM-dd') !== localDate) {
    throw new Error(`Invalid local intake date: ${localDate}`)
  }

  const cacheKey = `${timeZone}|${localDate}`
  const cachedDays = resolvedIntakeDayCache.get(timeline)
  const cached = cachedDays?.get(cacheKey)
  if (cached) return cached

  const candidates = timeline.versions.flatMap(version => {
    const cycle = timelineVersionAsCycle(timeline, version, timeZone)
    return cycleAppliesToDay(cycle, day) ? resolveScheduleSlots(version, day) : []
  })
  const uniqueCandidates = new Map(
    candidates.map(slot => [`${slot.key}|${slot.time}`, slot]),
  )

  const resolved = [...uniqueCandidates.values()].flatMap(candidate => {
    const instant = localSlotInstant(localDate, candidate.minutes, timeZone)
    const atSlot = resolveCycleAt(timeline, instant, timeZone)
    if (atSlot.status !== 'active' || !atSlot.planVersion) return []

    const activeCycle = timelineVersionAsCycle(timeline, atSlot.planVersion, timeZone)
    if (!cycleAppliesToDay(activeCycle, day)) return []
    const activeSlot = resolveScheduleSlots(atSlot.planVersion, day).find(slot => (
      slot.key === candidate.key && slot.time === candidate.time
    ))
    if (!activeSlot) return []

    const scheduledAt = instant.toISOString()
    const clock = parsedClock(localDateTimeKey(instant, timeZone).slice(11, 16))!
    const routineSlotKey = slotSchluessel(timeline.cycle.id, localDate, candidate.minutes)

    return [{
      ...activeSlot,
      ...clock,
      key: routineSlotKey,
      slotKey: activeSlot.key,
      cycleId: timeline.cycle.id,
      stackItemId: timeline.cycle.stack_item_id,
      planVersionId: atSlot.planVersion.id,
      dose: activeSlot.dose ?? atSlot.planVersion.dose,
      unit: atSlot.planVersion.unit,
      method: atSlot.planVersion.method,
      localDate,
      scheduledAt,
      routineSlotKey,
      pendingLogId: null,
    }]
  })

  const uniqueIntakes = new Map<string, ResolvedTimelineIntake>()
  for (const intake of resolved) {
    const key = intake.routineSlotKey
    if (!uniqueIntakes.has(key)) uniqueIntakes.set(key, intake)
  }
  const intakes = [...uniqueIntakes.values()].sort((left, right) => left.minutes - right.minutes)
  const days = cachedDays ?? new Map<string, ResolvedTimelineIntake[]>()
  days.set(cacheKey, intakes)
  if (!cachedDays) resolvedIntakeDayCache.set(timeline, days)
  return intakes
}

export function findNextTimelineIntake(
  timeline: CycleTimeline,
  after: Date,
  timeZone: string,
  lookaheadDays = 366,
): ResolvedTimelineIntake | null {
  if (!Number.isInteger(lookaheadDays) || lookaheadDays < 1) {
    throw new Error(`Invalid timeline lookahead: ${lookaheadDays}`)
  }

  const afterKey = localDateTimeKey(after, timeZone)
  const firstDate = parseISO(afterKey.slice(0, 10))
  for (let offset = 0; offset < lookaheadDays; offset += 1) {
    const localDate = format(addDays(firstDate, offset), 'yyyy-MM-dd')
    const next = resolveTimelineIntakesForDay(timeline, localDate, timeZone)
      .find(intake => new Date(intake.scheduledAt) > after)
    if (next) return next
  }
  return null
}

export function effectiveDose(cycle: ScheduleCycle, day: Date, escalations: EscalationRow[]): number | null {
  return effectiveQuantity(cycle, day, escalations)?.dose ?? null
}

export interface OverdueIntake {
  time: string
  substance: string | null
  daysOverdue: number
  /** yyyy-MM-dd of the overdue intake's scheduled day. */
  dateKey: string
  /** id of the cycle this overdue intake belongs to. */
  cycleId: string
  planVersionId?: string
  routineSlotKey?: string
  scheduledAt?: string
}

// Single source of truth — Dashboard.tsx imports this instead of duplicating it.
export function cycleAppliesToDay(cycle: ScheduleCycle, day: Date): boolean {
  const start = parseISO(cycle.start_date)
  const end = cycle.end_date ? parseISO(cycle.end_date) : null
  if (day < start) return false
  if (end && day > end) return false

  const seg = scheduleForDay(cycle, day)
  const freq = seg.frequency
  const dayOfWeek = WEEKDAYS_DE[day.getDay()]
  const diff = differenceInDays(day, start)
  const hasDayFilter = (seg.schedule_days ?? []).length > 0

  // „Bei Bedarf" ist kein Plan: kein Tag ist faellig, nichts kann verpasst
  // werden, nichts wird automatisch als ausgelassen geloggt. Eingetragen wird
  // die Einnahme, wenn sie stattgefunden hat.
  if (freq === 'Bei Bedarf') return false

  // Die vier Formen, die das Formular schreibt. Danach die alten Texte, die in
  // bestehenden Zyklen stehen und weiter gelten muessen.
  if (freq === 'Täglich' || freq === '2x täglich' || freq === '3x täglich')
    return hasDayFilter ? (seg.schedule_days ?? []).includes(dayOfWeek) : true

  if (freq === 'Alle X Tage') {
    const einheit = seg.interval_unit ?? 'day'
    const n = seg.x_days_interval
    if (n == null || !Number.isFinite(n) || !Number.isInteger(n) || n < 1) return false
    if (einheit === 'month') {
      if (n > 12) return false
      return trifftMonatsabstand(start, day, n)
    }
    const schritt = einheit === 'week' ? n * 7 : n
    if (schritt > 366) return false
    const intervalOk = diff % schritt === 0
    return intervalOk && (hasDayFilter ? (seg.schedule_days ?? []).includes(dayOfWeek) : true)
  }

  if (freq === 'Im Wechsel') {
    const an = seg.cycle_on_days
    const aus = seg.cycle_off_days
    if (an == null || aus == null || !Number.isInteger(an) || !Number.isInteger(aus)) return false
    if (an < 1 || aus < 1 || an > 90 || aus > 90) return false
    return diff % (an + aus) < an
  }

  if (freq === 'Wochentage wählen') {
    const days = seg.schedule_days ?? []
    if (days.length === 0 || new Set(days).size !== days.length || days.some(day => !Object.values(WEEKDAYS_DE).includes(day))) {
      return false
    }
    return days.includes(dayOfWeek)
  }

  // ── Alte Frequenztexte. Sie stehen in bestehenden Zyklen; das Formular
  // schreibt sie nicht mehr, aber sie bedeuten unveraendert dasselbe.
  if (freq === 'Jeden 2. Tag') return diff % 2 === 0
  if (freq === '5 Tage an / 2 aus') return diff % 7 < 5
  if (freq === 'Mo-Fr') return day.getDay() >= 1 && day.getDay() <= 5
  if (freq === 'Wöchentlich') return diff % 7 === 0
  return false
}

/**
 * Trifft der Tag einen Monatsabstand ab dem Start? Gerechnet wird ueber
 * Kalendermonate, nicht ueber 30 Tage: „alle 3 Monate ab dem 31. Januar" ist
 * der 30. April, nicht der 1. Mai. `addMonths` kappt dabei auf den letzten Tag
 * des Zielmonats — dieselbe Regel, die auch ein Kalender anwendet.
 */
function trifftMonatsabstand(start: Date, day: Date, monate: number): boolean {
  const abstand = differenceInCalendarMonths(day, start)
  if (abstand < 0 || abstand % monate !== 0) return false
  return format(addMonths(start, abstand), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd')
}

// All scheduled slots of a cycle ON a given day, sorted by time (segment-resolved).
// MIT der Menge des Zeitpunkts: „morgens 1000, abends 500" sind zwei Slots mit
// zwei Zahlen, und wer sie spaeter protokolliert, braucht die richtige.
function cycleDaySlots(c: ScheduleCycle, day: Date): { min: number; time: string; dose: number | null }[] {
  const seg = scheduleForDay(c, day)
  return resolveScheduleSlots(seg, day).map(slot => ({ min: slot.minutes, time: slot.time, dose: slot.dose }))
}

/**
 * Walk backwards over the last `lookbackDays` and return the OLDEST scheduled
 * intake slot not yet covered by a decided log. Per peptide and day, the decided
 * logs (taken === true/false) cover the earliest scheduled slots in time order;
 * the first uncovered slot whose time has passed counts as overdue. This keeps
 * multiple intakes per day (e.g. "2x täglich") tracked independently.
 */
export function findOldestOverdueIntake(
  cycles: ScheduleCycle[],
  logs: IntakeLog[],
  stackItemNameById: Map<string, string>,
  now: Date = new Date(),
  lookbackDays = 90,
): OverdueIntake | null {
  // Count decided logs per peptide per day — that many earliest slots are covered.
  const decidedByDay = new Map<string, number>()
  for (const l of logs) {
    if (l.taken == null) continue
    const key = `${l.stack_item_id}|${format(parseISO(l.logged_at), 'yyyy-MM-dd')}`
    decidedByDay.set(key, (decidedByDay.get(key) ?? 0) + 1)
  }

  const nowMin = now.getHours() * 60 + now.getMinutes()
  const todayKey = format(now, 'yyyy-MM-dd')

  for (let back = lookbackDays; back >= 0; back--) {
    const day = startOfDay(subDays(now, back))
    const dayKey = format(day, 'yyyy-MM-dd')
    const isToday = dayKey === todayKey

    // Collect each peptide's scheduled slots for this day across all applicable cycles.
    const slotsByStackItem = new Map<string, { min: number; time: string; cycleId: string }[]>()
    for (const c of cycles) {
      if (!cycleAppliesToDay(c, day)) continue
      for (const s of cycleDaySlots(c, day)) {
        const arr = slotsByStackItem.get(c.stack_item_id) ?? []
        arr.push({ min: s.min, time: s.time, cycleId: c.id })
        slotsByStackItem.set(c.stack_item_id, arr)
      }
    }

    let candidate: { min: number; time: string; substance: string | null; cycleId: string } | null = null
    for (const [stackItemId, slots] of slotsByStackItem) {
      const ordered = [...slots].sort((a, b) => a.min - b.min)
      const covered = decidedByDay.get(`${stackItemId}|${dayKey}`) ?? 0
      for (const slot of ordered.slice(covered)) {
        if (isToday && slot.min > nowMin) break // earliest uncovered slot still upcoming → none overdue
        if (!candidate || slot.min < candidate.min) {
          candidate = { min: slot.min, time: slot.time, substance: stackItemNameById.get(stackItemId) ?? null, cycleId: slot.cycleId }
        }
        break // only the earliest uncovered slot per peptide matters
      }
    }
    if (candidate) {
      return { time: candidate.time, substance: candidate.substance, daysOverdue: differenceInDays(now, day), dateKey: dayKey, cycleId: candidate.cycleId }
    }
  }
  return null
}

/** Marker in dose_logs.notes für automatisch als „verpasst" eingetragene Einnahmen. */
export const AUTO_MISSED_NOTE = 'auto-missed'

/**
 * Marker in dose_logs.notes für selbst übersprungene Einnahmen. Übersprungen
 * (grau) ist nur, was jemand bewusst übersprungen hat; jede andere nicht
 * genommene Einnahme gilt als verpasst (rot) — auch ältere ohne Marker.
 */
export const MANUAL_SKIP_NOTE = 'skipped'

/** Die Marker sind keine Notizen der Nutzer: nirgends anzeigen, beim Wiederöffnen leeren. */
export function istSystemNotiz(notes: string | null | undefined): boolean {
  return notes === AUTO_MISSED_NOTE || notes === MANUAL_SKIP_NOTE
}

export interface MissedIntake {
  cycleId: string
  stackItemId: string
  /** yyyy-MM-dd des geplanten Tages. */
  dateKey: string
  /** Minuten seit Mitternacht (Slot-Zeit). */
  minutes: number
  /**
   * Die eigene Menge dieses Zeitpunkts, falls der Plan sie je Zeitpunkt
   * festhaelt. null heisst: es gilt die Menge des Zyklus.
   */
  slotDose: number | null
  planVersionId?: string
  routineSlotKey?: string
  scheduledAt?: string
  unit?: string | null
  method?: string
}

interface TimelineLogMatch {
  intake: ResolvedTimelineIntake
  log: IntakeLog
}

function timelineIntakesForDate(
  timelines: CycleTimeline[],
  localDate: string,
  timeZone: string,
): ResolvedTimelineIntake[] {
  return timelines
    .flatMap(timeline => resolveTimelineIntakesForDay(timeline, localDate, timeZone))
    .sort((left, right) => (
      left.scheduledAt.localeCompare(right.scheduledAt)
      || left.stackItemId.localeCompare(right.stackItemId)
      || left.cycleId.localeCompare(right.cycleId)
    ))
}

function logLocalDate(log: IntakeLog, timeZone: string): string | null {
  const instant = new Date(log.logged_at)
  return Number.isFinite(instant.getTime())
    ? localDateTimeKey(instant, timeZone).slice(0, 10)
    : null
}

function matchTimelineLogs(
  intakes: ResolvedTimelineIntake[],
  logs: IntakeLog[],
  localDate: string,
  timeZone: string,
): TimelineLogMatch[] {
  const orderedLogs = [...logs]
    .sort((left, right) => left.logged_at.localeCompare(right.logged_at))
  const keyedLogs = orderedLogs.filter(log => Boolean(log.routine_slot_key))
  const dayLogs = orderedLogs
    .filter(log => !log.routine_slot_key)
    .filter(log => logLocalDate(log, timeZone) === localDate)
  const usedIntakes = new Set<number>()
  const matches: TimelineLogMatch[] = []
  const explicitLogs = [
    ...keyedLogs,
    ...dayLogs.filter(log => Boolean(log.cycle_id) || Boolean(log.plan_version_id)),
  ]
  const legacyLogs = dayLogs.filter(log => (
    !log.cycle_id && !log.plan_version_id
  ))

  for (const log of explicitLogs) {
    const index = intakes.findIndex((intake, candidateIndex) => (
      !usedIntakes.has(candidateIndex)
      && intake.stackItemId === log.stack_item_id
      && (!log.routine_slot_key || intake.routineSlotKey === log.routine_slot_key)
      && (!log.cycle_id || intake.cycleId === log.cycle_id)
      && (Boolean(log.routine_slot_key) || !log.plan_version_id || intake.planVersionId === log.plan_version_id)
    ))
    if (index < 0) continue
    usedIntakes.add(index)
    matches.push({ intake: intakes[index], log })
  }

  // Pre-cutover rows have no stable provenance. Keep their fallback bounded
  // to one remaining slot of the same stack item and local calendar day.
  for (const log of legacyLogs) {
    const index = intakes.findIndex((intake, candidateIndex) => (
      !usedIntakes.has(candidateIndex) && intake.stackItemId === log.stack_item_id
    ))
    if (index < 0) continue
    usedIntakes.add(index)
    matches.push({ intake: intakes[index], log })
  }

  return matches
}

function collectOpenTimelineIntakesForDate(
  timelines: CycleTimeline[],
  logs: IntakeLog[],
  localDate: string,
  timeZone: string,
): ResolvedTimelineIntake[] {
  const intakes = timelineIntakesForDate(timelines, localDate, timeZone)
  const matches = matchTimelineLogs(intakes, logs, localDate, timeZone)
  const matchByKey = new Map(matches.map(match => [match.intake.routineSlotKey, match.log]))
  return intakes.flatMap(intake => {
    const log = matchByKey.get(intake.routineSlotKey)
    if (log?.taken !== null && log?.taken !== undefined) return []
    return [{ ...intake, pendingLogId: log?.id ?? null }]
  })
}

export function collectOpenTimelineIntakes(
  timelines: CycleTimeline[],
  logs: IntakeLog[],
  day: Date,
  timeZone: string,
): ResolvedTimelineIntake[] {
  const localDate = localDateTimeKey(day, timeZone).slice(0, 10)
  return collectOpenTimelineIntakesForDate(timelines, logs, localDate, timeZone)
}

export function collectMissedTimelineIntakes(
  timelines: CycleTimeline[],
  logs: IntakeLog[],
  now: Date,
  timeZone: string,
  lookbackDays = 90,
  lookbackEndDays = 1,
): MissedIntake[] {
  if (!Number.isInteger(lookbackDays) || lookbackDays < 0) {
    throw new Error(`Invalid timeline lookback: ${lookbackDays}`)
  }
  if (!Number.isInteger(lookbackEndDays) || lookbackEndDays < 1) {
    throw new Error(`Invalid timeline lookback end: ${lookbackEndDays}`)
  }
  const todayKey = localDateTimeKey(now, timeZone).slice(0, 10)
  const today = parseISO(todayKey)
  const missed: MissedIntake[] = []

  for (let back = lookbackDays; back >= lookbackEndDays; back -= 1) {
    const localDate = format(subDays(today, back), 'yyyy-MM-dd')
    const intakes = timelineIntakesForDate(timelines, localDate, timeZone)
    const coveredKeys = new Set(
      matchTimelineLogs(intakes, logs, localDate, timeZone)
        .map(match => match.intake.routineSlotKey),
    )
    for (const intake of intakes) {
      if (coveredKeys.has(intake.routineSlotKey)) continue
      missed.push({
        cycleId: intake.cycleId,
        stackItemId: intake.stackItemId,
        planVersionId: intake.planVersionId,
        routineSlotKey: intake.routineSlotKey,
        scheduledAt: intake.scheduledAt,
        dateKey: localDate,
        minutes: intake.minutes,
        slotDose: intake.dose,
        unit: intake.unit,
        method: intake.method,
      })
    }
  }
  return missed
}

export function findOldestOverdueTimelineIntake(
  timelines: CycleTimeline[],
  logs: IntakeLog[],
  stackItemNameById: Map<string, string>,
  now: Date,
  timeZone: string,
  lookbackDays = 90,
): OverdueIntake | null {
  if (!Number.isInteger(lookbackDays) || lookbackDays < 0) {
    throw new Error(`Invalid timeline lookback: ${lookbackDays}`)
  }
  const todayKey = localDateTimeKey(now, timeZone).slice(0, 10)
  const today = parseISO(todayKey)

  for (let back = lookbackDays; back >= 0; back -= 1) {
    const localDate = format(subDays(today, back), 'yyyy-MM-dd')
    const intake = collectOpenTimelineIntakesForDate(timelines, logs, localDate, timeZone)
      .find(candidate => new Date(candidate.scheduledAt) <= now)
    if (!intake) continue
    return {
      time: intake.time,
      substance: stackItemNameById.get(intake.stackItemId) ?? null,
      daysOverdue: differenceInDays(today, parseISO(localDate)),
      dateKey: localDate,
      cycleId: intake.cycleId,
      planVersionId: intake.planVersionId,
      routineSlotKey: intake.routineSlotKey,
      scheduledAt: intake.scheduledAt,
    }
  }
  return null
}

/**
 * Alle geplanten Slots VOR heute über die gesamte Länge der Zyklen (ab dem frühesten
 * start_date), die nicht durch einen vorhandenen Log fuer denselben Slot gedeckt
 * sind. Frist = Tagesende: heutige Slots werden bewusst ausgelassen (sie bleiben bis
 * Mitternacht bestätigbar). Optional begrenzt `since` den Rückblick (kein rückwirkendes
 * Backfill vor dem Aktivierungszeitpunkt). Das Ergebnis wird vom Aufrufer als „verpasst"
 * (taken=false) in dose_logs geschrieben. cycleAppliesToDay begrenzt jeden Zyklus auf
 * sein eigenes start_date/end_date.
 */
export function collectMissedIntakes(
  cycles: ScheduleCycle[],
  logs: IntakeLog[],
  now: Date = new Date(),
  since?: Date,
): MissedIntake[] {
  const loggedByDay = new Map<string, number>()
  for (const l of logs) {
    const key = `${l.stack_item_id}|${format(parseISO(l.logged_at), 'yyyy-MM-dd')}`
    loggedByDay.set(key, (loggedByDay.get(key) ?? 0) + 1)
  }

  // Rückblick = vom frühesten Zyklus-Start bis gestern (gesamte Zyklus-Länge).
  let earliest: Date | null = null
  for (const c of cycles) {
    const s = startOfDay(parseISO(c.start_date))
    if (!earliest || s < earliest) earliest = s
  }
  if (!earliest) return []
  // Nicht vor den Aktivierungszeitpunkt zurückgehen (kein rückwirkendes Backfill).
  if (since) {
    const s = startOfDay(since)
    if (s > earliest) earliest = s
  }

  const out: MissedIntake[] = []
  for (let back = differenceInDays(startOfDay(now), earliest); back >= 1; back--) {  // back >= 1 → nur Tage vor heute
    const day = startOfDay(subDays(now, back))
    const dayKey = format(day, 'yyyy-MM-dd')

    const slotsByStackItem = new Map<string, { min: number; cycleId: string; dose: number | null }[]>()
    for (const c of cycles) {
      if (!cycleAppliesToDay(c, day)) continue
      for (const s of cycleDaySlots(c, day)) {
        const arr = slotsByStackItem.get(c.stack_item_id) ?? []
        arr.push({ min: s.min, cycleId: c.id, dose: s.dose })
        slotsByStackItem.set(c.stack_item_id, arr)
      }
    }

    for (const [stackItemId, slots] of slotsByStackItem) {
      const ordered = [...slots].sort((a, b) => a.min - b.min)
      const covered = loggedByDay.get(`${stackItemId}|${dayKey}`) ?? 0
      for (const slot of ordered.slice(covered)) {
        out.push({ cycleId: slot.cycleId, stackItemId, dateKey: dayKey, minutes: slot.min, slotDose: slot.dose })
      }
    }
  }
  return out
}

export interface OpenIntake {
  cycleId: string
  stackItemId: string
  /** yyyy-MM-dd des geplanten Tages. */
  dateKey: string
  /** Minuten seit Mitternacht (Slot-Zeit). */
  minutes: number
  /**
   * Die eigene Menge dieses Zeitpunkts, falls der Plan sie je Zeitpunkt
   * festhaelt. null heisst: es gilt die Menge des Zyklus.
   */
  slotDose: number | null
}

/**
 * Alle geplanten, noch nicht entschiedenen Einnahme-Slots vom Rückblickfenster bis
 * einschließlich heute (heutige Slots nur, wenn ihre Zeit schon vorbei ist) — also
 * „offene" (fällige oder überfällige) Einnahmen, bereit zum Bestätigen/Loggen.
 * Ältester zuerst. Der Aufrufer filtert auf injizierbare Zyklen.
 */
export function collectOpenIntakes(
  cycles: ScheduleCycle[],
  logs: IntakeLog[],
  now: Date = new Date(),
  lookbackDays = 90,
): OpenIntake[] {
  const decidedByDay = new Map<string, number>()
  for (const l of logs) {
    if (l.taken == null) continue
    const key = `${l.stack_item_id}|${format(parseISO(l.logged_at), 'yyyy-MM-dd')}`
    decidedByDay.set(key, (decidedByDay.get(key) ?? 0) + 1)
  }

  const nowMin = now.getHours() * 60 + now.getMinutes()
  const todayKey = format(now, 'yyyy-MM-dd')
  const out: OpenIntake[] = []

  for (let back = lookbackDays; back >= 0; back--) {
    const day = startOfDay(subDays(now, back))
    const dayKey = format(day, 'yyyy-MM-dd')
    const isToday = dayKey === todayKey

    const slotsByStackItem = new Map<string, { min: number; cycleId: string; dose: number | null }[]>()
    for (const c of cycles) {
      if (!cycleAppliesToDay(c, day)) continue
      for (const s of cycleDaySlots(c, day)) {
        const arr = slotsByStackItem.get(c.stack_item_id) ?? []
        arr.push({ min: s.min, cycleId: c.id, dose: s.dose })
        slotsByStackItem.set(c.stack_item_id, arr)
      }
    }

    for (const [stackItemId, slots] of slotsByStackItem) {
      const ordered = [...slots].sort((a, b) => a.min - b.min)
      const covered = decidedByDay.get(`${stackItemId}|${dayKey}`) ?? 0
      for (const slot of ordered.slice(covered)) {
        if (isToday && slot.min > nowMin) continue // heute noch nicht fällig
        out.push({ cycleId: slot.cycleId, stackItemId, dateKey: dayKey, minutes: slot.min, slotDose: slot.dose })
      }
    }
  }
  return out
}
