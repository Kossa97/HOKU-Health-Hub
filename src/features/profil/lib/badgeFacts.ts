/**
 * Fakten fuer die Abzeichen aus den eigenen Daten (dieselben wie fuer den
 * Schnappschuss) und dem Ergebnis der Fortschrittsrechnung. Rein.
 */
import { entryDays, type ProfileSnapshotInput } from './profileSnapshot'
import type { BadgeFacts } from './badges'
import { dayOfStamp, type ProgressSetup } from './progressInput'
import { weekOf, type ProgressHistoryEntry, type ProgressResult } from './progressScore'

/** Was es ausser den Schnappschuss-Daten braucht (laedt `progressStore`). */
export interface BadgeExtras {
  /** Ende abgeschlossener Zyklen (`cycles.end_date`). */
  cycleEndDays: string[]
  /** `progress_photos.taken_at` */
  photoDays: string[]
  /** Eigene Erfahrungsberichte (`reviews.created_at`). */
  reviewDays: string[]
  /** `profiles.health_store_consent_at` */
  healthConsentAt: string | null
  /** Profil vollstaendig: je Punkt erfuellt oder nicht. */
  profileChecks: boolean[]
}

const days = (xs: readonly (string | null)[]) => xs.filter((d): d is string => d !== null).sort()

/** Tage neuer Bestleistungen: e1RM ueber allen frueheren derselben Uebung (nicht die erste Einheit). */
export function prDays(e1rm: ProgressSetup['input']['e1rm']): string[] {
  const out: string[] = []
  for (const e of e1rm) {
    const ps = [...e.points].sort((a, b) => a.day.localeCompare(b.day))
    let best = -Infinity
    ps.forEach((p, i) => {
      if (i > 0 && p.value > best) out.push(p.day)
      best = Math.max(best, p.value)
    })
  }
  return out.sort()
}

export function badgeFacts(
  input: ProfileSnapshotInput,
  extras: BadgeExtras,
  setup: ProgressSetup | null,
  result: ProgressResult | null,
  history: readonly ProgressHistoryEntry[],
  today: string,
): BadgeFacts {
  // Einnahmen je Tag: alle faelligen selbst bestaetigt (Auto-Tracking zaehlt hier nicht als bestaetigt)
  const intake = new Map<string, boolean>()
  for (const d of input.doseLogs) {
    if (d.taken == null || !d.stack_item_id) continue
    const day = d.logged_at.slice(0, 10)
    intake.set(day, (intake.get(day) ?? true) && d.taken === true && !d.auto_logged)
  }
  const steps = new Map<string, { sum: number; days: number }>()
  let firstHealth: string | null = null
  for (const r of input.healthDaily) {
    if (r.day > today) continue
    if (firstHealth === null || r.day < firstHealth) firstHealth = r.day
    if (r.steps == null || !Number.isFinite(Number(r.steps))) continue
    const w = steps.get(weekOf(r.day)) ?? { sum: 0, days: 0 }
    w.sum += Number(r.steps)
    w.days++
    steps.set(weekOf(r.day), w)
  }
  const consent = extras.healthConsentAt ? dayOfStamp(extras.healthConsentAt) : null
  const startOn = setup?.startOn ?? today
  const since = <T extends { day: string }>(xs: readonly T[]) => xs.filter(x => x.day >= startOn)
  const rhr = result?.values.find(v => v.id === 'resting_hr')

  return {
    today,
    entryDays: [...entryDays(input)].filter(d => d <= today).sort(),
    sessionDays: days(input.sessions.map(s => dayOfStamp(s.startedAt))),
    weightDays: days(input.weightLogs.map(w => w.logged_at.slice(0, 10))),
    intakeDays: [...intake.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, all]) => ({ day, all })),
    dailyLogDays: days(input.dailyLogs.map(l => l.log_date)),
    measurementDays: days(input.measurements.map(m => m.measured_on)),
    bloodReports: [...(setup?.input.bloodReports ?? [])],
    cycleEndDays: days(extras.cycleEndDays.map(dayOfStamp)).filter(d => d <= today),
    wearableSince: [consent, firstHealth].filter((d): d is string => d !== null).sort()[0] ?? null,
    profileChecks: { have: extras.profileChecks.filter(Boolean).length, need: extras.profileChecks.length },
    photoDays: days(extras.photoDays.map(dayOfStamp)),
    reviewDays: days(extras.reviewDays.map(dayOfStamp)),
    bodyFat: since(setup?.input.bodyFat ?? []),
    weight: since(setup?.input.weight ?? []),
    prDays: prDays(setup?.input.e1rm ?? []),
    restingHr: rhr && rhr.baseline.status === 'counts' && rhr.start !== null && rhr.now !== null ? { start: rhr.start, now: rhr.now } : null,
    stepWeeks: [...steps.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([week, w]) => ({ week, avg: w.sum / w.days, days: w.days })),
    progressTotal: result?.total ?? null,
    history: history.filter(e => e.week >= weekOf(startOn)),
  }
}
