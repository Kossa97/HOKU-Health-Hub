import { findNextTimelineIntake, type ResolvedRoutineGroup } from '../../../lib/intakeSchedule'
import {
  resolveCycleAt,
  type CycleLifecycleStatus,
  type CyclePlanVersion,
  type CycleTimeline,
} from '../../../lib/planTimeline'
import {
  WEEKDAY_KEYS,
  isOnDemandRhythm,
  rhythmSummary,
  rhythmText,
} from './intakeRhythm'
import { legacyFrequency, planDisplaySlots, versionRhythm, type PlanCardSlot } from './planCard'

/**
 * Wie der Plan beschrieben wird — geteilt von der vollen Plan-Uebersicht
 * (`PlanManagementSection`) und der Kurzfassung im Vollbild
 * (`PlanSummaryCard`), damit beide denselben Plan gleich nennen.
 */

export type Translate = (key: string, options?: Record<string, unknown>) => unknown

export { versionRhythm } from './planCard'

export function rhythmLabel(version: CyclePlanVersion, t: Translate): string {
  return rhythmText(rhythmSummary(versionRhythm(version)), t)
}

/** Wochentag eines lokalen Datums (YYYY-MM-DD), ausgeschrieben in der App-Sprache. */
function wochentagLang(localDate: string, language: string): string {
  return new Intl.DateTimeFormat(language, { weekday: 'long', timeZone: 'UTC' })
    .format(new Date(`${localDate.slice(0, 10)}T00:00:00.000Z`))
}

/**
 * Der Rhythmus mit seinem Wochentag: „Jeden Mittwoch“ statt „Jede Woche“.
 * Der Tag kommt aus der naechsten Einnahme — die faellt bei einem
 * Wochenrhythmus immer auf denselben Wochentag, und so rechnet hier niemand
 * den Anker ein zweites Mal aus. Beim Monatsrhythmus nicht: ein Plan vom 31.
 * landet im Februar auf dem 28., der Tag waere dort falsch. Ohne naechste
 * Einnahme bleibt es bei der allgemeinen Fassung.
 */
export function rhythmLabelWithDay(
  version: CyclePlanVersion,
  t: Translate,
  language: string,
  nextLocalDate: string | null | undefined,
): string {
  const rhythmus = versionRhythm(version)
  if (rhythmus.kind !== 'interval' || !nextLocalDate) return rhythmLabel(version, t)
  const n = rhythmus.intervalValue ?? 1
  if (rhythmus.intervalUnit === 'week') {
    const tag = wochentagLang(nextLocalDate, language)
    return String(n === 1
      ? t('my_stack_rhythm_weekly_on', { tag, defaultValue: 'Jeden {{tag}}' })
      : t('my_stack_rhythm_weeks_on', { n, tag, defaultValue: 'Alle {{n}} Wochen am {{tag}}' }))
  }
  return rhythmLabel(version, t)
}

/** Die Zeile unter dem Rhythmus: die Zahl der Einnahmezeiten nur, wenn es mehrere sind. */
export function slotCountSuffix(slots: number, t: Translate): string {
  return slots > 1 ? ` · ${slotCountLabel(slots, t)}` : ''
}

/**
 * Die naechste Einnahme so, wie man sie sagt: „Heute · 08:00“, „Morgen · 08:00“,
 * sonst „Mi., 14.10. · 08:00“ — das Jahr nur, wenn es nicht dieses ist.
 */
export function nextIntakeLabel(
  next: { localDate: string; time: string },
  today: string,
  language: string,
  t: Translate,
): string {
  const tag = next.localDate.slice(0, 10)
  const morgen = new Date(`${today}T00:00:00.000Z`)
  morgen.setUTCDate(morgen.getUTCDate() + 1)
  const datum = tag === today
    ? String(t('my_stack_plan_today', { defaultValue: 'Heute' }))
    : tag === morgen.toISOString().slice(0, 10)
      ? String(t('my_stack_plan_tomorrow', { defaultValue: 'Morgen' }))
      : new Intl.DateTimeFormat(language, {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        ...(tag.slice(0, 4) !== today.slice(0, 4) ? { year: 'numeric' as const } : {}),
        timeZone: 'UTC',
      }).format(new Date(`${tag}T00:00:00.000Z`))
  return `${datum} · ${next.time}`
}

/** „Bei Bedarf" hat keine Einnahmezeiten — die gespeicherte Tageszeit bedeutet dort nichts. */
export function versionSlots(version: CyclePlanVersion): PlanCardSlot[] {
  const rhythmus = versionRhythm(version)
  return isOnDemandRhythm(rhythmus) ? [] : planDisplaySlots(version, rhythmus)
}

export function slotDoseLabel(slot: PlanCardSlot): string | null {
  if (slot.dose == null) return null
  return `${slot.dose} ${slot.unit ?? ''}`.trim()
}

// Ein beliebiger Montag (UTC), um Wochentagsnamen in der App-Sprache zu bilden.
const WEEKDAY_REFERENCE_UTC = Date.UTC(2026, 0, 5)

export function weekdayLabel(day: string, language: string): string {
  const index = WEEKDAY_KEYS.indexOf(day as (typeof WEEKDAY_KEYS)[number])
  if (index < 0) return day
  return new Intl.DateTimeFormat(language, { weekday: 'short', timeZone: 'UTC' })
    .format(new Date(WEEKDAY_REFERENCE_UTC + index * 86_400_000))
    .replace(/\.$/, '')
}

export const ROUTINE_LABEL: Record<ResolvedRoutineGroup, { key: string; defaultValue: string }> = {
  morning: { key: 'my_stack_routine_morning', defaultValue: 'Morgens' },
  midday: { key: 'my_stack_routine_midday', defaultValue: 'Mittags' },
  evening: { key: 'my_stack_routine_evening', defaultValue: 'Abends' },
}

export function routineLabel(slot: PlanCardSlot, t: Translate): string {
  const label = ROUTINE_LABEL[slot.routineGroup]
  return String(t(label.key, { defaultValue: label.defaultValue }))
}


export function timelineForIntakeResolution(timeline: CycleTimeline): CycleTimeline {
  return {
    ...timeline,
    versions: timeline.versions.map(version => ({ ...version, frequency: legacyFrequency(version.frequency) })),
  }
}

const STATUS_PRIORITY: Record<CycleLifecycleStatus, number> = { active: 0, paused: 1, planned: 2, ended: 3 }

/**
 * Die Zyklen einer Substanz in der Reihenfolge, in der Uebersicht und
 * Plan-Karte sie zeigen: laufend, pausiert, geplant, beendet; darin der
 * neueste zuerst, bei Gleichstand nach Kennung.
 */
export function orderTimelines(timelines: CycleTimeline[], now: Date, timeZone: string) {
  return timelines
    .map(timeline => ({ timeline, resolved: resolveCycleAt(timeline, now, timeZone) }))
    .sort((left, right) => (
      STATUS_PRIORITY[left.resolved.status] - STATUS_PRIORITY[right.resolved.status]
      || String(right.timeline.cycle.started_at ?? '').localeCompare(String(left.timeline.cycle.started_at ?? ''))
      || right.timeline.cycle.id.localeCompare(left.timeline.cycle.id)
    ))
}

/** Die naechste Einnahme — nur fuer laufende und geplante Zyklen. */
export function nextIntakeFor(timeline: CycleTimeline, status: CycleLifecycleStatus, now: Date, timeZone: string) {
  return status === 'active' || status === 'planned'
    ? findNextTimelineIntake(timelineForIntakeResolution(timeline), now, timeZone)
    : null
}

export function dateLabel(value: string, language: string, timeZone: string): string {
  const instant = value.includes('|')
    ? new Date(`${value.slice(0, 10)}T00:00:00.000Z`)
    : new Date(value)
  return new Intl.DateTimeFormat(language, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: value.includes('|') ? 'UTC' : timeZone,
  }).format(instant)
}


// Einzahl und Mehrzahl waehlt der Code, nicht i18next: Sprachen mit mehr
// Pluralformen (ru, ar) faenden sonst keinen Schluessel und zeigten ihn roh.
export function durationLabel(days: number, t: Translate): string {
  return String(days === 1
    ? t('my_stack_plan_duration_single', { days, defaultValue: '{{days}} Tag' })
    : t('my_stack_plan_duration_multiple', { days, defaultValue: '{{days}} Tage' }))
}

export function slotCountLabel(slots: number, t: Translate): string {
  return String(slots === 1
    ? t('my_stack_plan_slot_count_single', { slots, defaultValue: '{{slots}} Einnahmezeit' })
    : t('my_stack_plan_slot_count_multiple', { slots, defaultValue: '{{slots}} Einnahmezeiten' }))
}

export function stepKindLabel(version: CyclePlanVersion, t: Translate): string {
  const copy = {
    initial: { key: 'my_stack_plan_step_start', defaultValue: 'Start' },
    dose: { key: 'my_stack_plan_step_dose', defaultValue: 'Dosis' },
    schedule: { key: 'my_stack_plan_step_schedule', defaultValue: 'Plan' },
    titration: { key: 'my_stack_plan_step_titration', defaultValue: 'Titration' },
  }[version.change_kind]
  return String(t(copy.key, { defaultValue: copy.defaultValue }))
}

/**
 * Kurze Beschriftung fuer die Tages-Chips. Zwei Zeichen der Kurzform, solange
 * das die Tage unterscheidet („Mo", „Di"); sonst die schmale Form — im
 * Arabischen etwa beginnt jeder Kurzname mit demselben Artikel.
 */
export function chipLabels(language: string): string[] {
  const kurz = WEEKDAY_KEYS.map(day => weekdayLabel(day, language).slice(0, 2))
  if (new Set(kurz).size === kurz.length) return kurz
  const schmal = new Intl.DateTimeFormat(language, { weekday: 'narrow', timeZone: 'UTC' })
  return WEEKDAY_KEYS.map((_, index) => schmal.format(new Date(WEEKDAY_REFERENCE_UTC + index * 86_400_000)))
}

