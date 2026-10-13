import type { TrackingLevel } from '../types'
import { FEATURES } from '../../../config/features'
import { resolveCycleAt, type CycleTimeline } from '../../../lib/planTimeline'
import {
  effectiveQuantity,
  resolveScheduleSlots,
  scheduleForDay,
  type EscalationRow,
  type ScheduleCycle,
  type ScheduleSegment,
} from '../../../lib/intakeSchedule'

export type PkRequirement = 'complete_tracking' | 'method' | 'dose' | 'unit' | 'time'

export type PkReadiness =
  | { status: 'ready' }
  | { status: 'missing'; missing: PkRequirement[] }
  | { status: 'unsupported'; reason: string }

export interface PkReadinessInput {
  trackingLevel: TrackingLevel
  pkProfileId: string | null
  pkProfileMethod: string | null
  /** Routen, fuer die das Profil gilt (`pk_profiles.routes`); leer = unklar. */
  pkProfileRoutes?: readonly string[] | null
  method: string | null
  dose: number | null
  unit: string | null
  scheduledAt: string | null
  /** IU je Milligramm aus dem PK-Profil; null, wenn die Substanz keinen hat. */
  iuPerMg?: number | null
  /** Milligramm Wirkstoff je Milliliter Loesung; null, wenn keine vorliegt. */
  mgPerMl?: number | null
}

/**
 * Milligramm Wirkstoff je Milliliter — aus der Staerke einer Zutat.
 *
 * Das ist der Rechenschritt, der bei einem aufgeloesten Vial fehlte. So wird
 * ein Peptid wirklich dosiert:
 *
 *     5 mg im Vial  +  2 ml BAC-Wasser   ->  2,5 mg/ml
 *     davon 0,2 ml aufgezogen            ->  0,5 mg
 *
 * Niemand rechnet das im Kopf und traegt dann „500 mcg" in den Plan ein — man
 * zieht auf, was die Spritze zeigt. Und bei einem Kombi-Vial (5 mg CJC UND
 * 5 mg Ipamorelin in derselben Loesung) traegt jede Zutat ihre eigene
 * Konzentration, also auch ihre eigene Dosis aus demselben aufgezogenen Volumen.
 */
export function mgPerMlFromStrength(
  amountValue: number | null,
  amountUnit: string | null,
  basisValue: number | null,
  basisUnit: string | null,
): number | null {
  if (basisUnit?.trim().toLocaleLowerCase() !== 'ml') return null
  if (amountValue == null || !Number.isFinite(amountValue) || amountValue <= 0) return null
  if (basisValue == null || !Number.isFinite(basisValue) || basisValue <= 0) return null

  const proEinheit = toPkMilligrams(amountValue, amountUnit ?? '')
  if (proEinheit == null) return null
  return proEinheit / basisValue
}

export type PkScheduleCycle = ScheduleCycle & { method: string | null; timeline?: CycleTimeline }

export type ResolvedPkSchedule = ScheduleSegment & {
  method: string | null
  scheduledAt: string | null
}

function normalizedText(value: string | null): string {
  return value?.trim().toLocaleLowerCase() ?? ''
}

/**
 * Rechnet eine geplante Menge in Milligramm um — die Waehrung, in der die
 * Blutspiegelkurve rechnet.
 *
 * `mg` und `mcg` gehen immer. **IU geht nur mit Faktor**, denn eine
 * Internationale Einheit ist keine Masse, sondern eine biologische Wirkstaerke:
 * ein Milligramm HGH sind 3 IU, ein Milligramm HCG rund 10.000. Der Faktor
 * gehoert deshalb zur Substanz und steht im PK-Profil (`iu_per_mg`), nicht hier.
 *
 * Ohne Faktor bleibt es bei `null` — und `null` heisst „koennen wir nicht
 * umrechnen", nicht „hat der Nutzer vergessen". Wer das verwechselt, laesst
 * eine Substanz aus der Kurve verschwinden, ohne zu sagen warum.
 */
export function toPkMilligrams(
  value: number,
  unit: string,
  iuPerMg: number | null = null,
  mgPerMl: number | null = null,
): number | null {
  if (!Number.isFinite(value)) return null
  const normalizedUnit = unit.trim().toLocaleLowerCase()
  if (normalizedUnit === 'mg') return value
  if (normalizedUnit === 'mcg') return value / 1000
  if (normalizedUnit === 'iu') {
    if (iuPerMg == null || !Number.isFinite(iuPerMg) || iuPerMg <= 0) return null
    return value / iuPerMg
  }
  // Milliliter sind keine Wirkstoffmenge, sondern ein Volumen — sie werden zur
  // Menge erst mit der Konzentration der Loesung. Genau so dosiert man ein
  // aufgeloestes Vial: man zieht Volumen auf, nicht Milligramm.
  if (normalizedUnit === 'ml') {
    if (mgPerMl == null || !Number.isFinite(mgPerMl) || mgPerMl <= 0) return null
    return value * mgPerMl
  }
  return null
}

export function resolvePkScheduleForDay(
  cycle: PkScheduleCycle,
  escalations: EscalationRow[],
  day: Date,
): ResolvedPkSchedule | null {
  if (FEATURES.planTimelineV2) {
    if (!cycle.timeline) throw new Error('Cycle timeline unavailable')
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const resolved = resolveCycleAt(cycle.timeline, day, timeZone)
    if (resolved.status === 'planned') return null
    const version = resolved.planVersion
    if (!version) throw new Error('Cycle plan version unavailable')
    const automatic = resolved.status === 'active' && version.frequency !== 'Bei Bedarf'
    const slot = automatic ? resolveScheduleSlots(version)[0] : null
    return {
      ...version,
      effective_from: version.effective_local_date ?? version.effective_at!,
      dose: slot ? slot.dose ?? version.dose : null,
      scheduledAt: slot?.time ?? null,
    }
  }
  const segment = scheduleForDay(cycle, day)
  const quantity = effectiveQuantity(cycle, day, escalations)
  return {
    ...segment,
    method: cycle.method,
    dose: quantity?.dose ?? null,
    unit: quantity?.unit ?? null,
    scheduledAt: resolveScheduleSlots(segment)[0]?.time ?? null,
  }
}

export type PkRouteStatus =
  /** Keine Route im Plan. */
  | 'no_method'
  /** Das Profil nennt keine Route; der Nutzer hat diese selbst bestaetigt. */
  | 'confirmed'
  /** Das Profil gilt fuer diese Route — keine Rueckfrage noetig. */
  | 'covered'
  /** Das Profil gilt fuer andere Routen; eine Kurve waere falsch. */
  | 'mismatch'
  /** Das Profil nennt keine Route; der Nutzer muss bestaetigen. */
  | 'unconfirmed'

/**
 * Passt die Route im Plan zum Profil?
 *
 * Nennt das Profil Routen, entscheiden allein sie — auch gegen eine fruehere
 * Bestaetigung, denn eine Kurve fuer die falsche Route waere falsch. Die
 * Bestaetigung des Nutzers zaehlt nur, wo das Profil keine Route nennt.
 */
export function pkRouteStatus(
  method: string | null | undefined,
  confirmedMethod: string | null | undefined,
  routes: readonly string[] | null | undefined,
): PkRouteStatus {
  const route = normalizedText(method ?? null)
  if (!route) return 'no_method'
  if (routes?.length) return routes.some(r => normalizedText(r) === route) ? 'covered' : 'mismatch'
  return normalizedText(confirmedMethod ?? null) === route ? 'confirmed' : 'unconfirmed'
}

/** Darf die Kurve fuer diese Route rechnen? */
export const pkRouteAccepted = (status: PkRouteStatus): boolean => status === 'confirmed' || status === 'covered'

export function evaluatePkReadiness(input: PkReadinessInput): PkReadiness {
  if (!input.pkProfileId?.trim()) {
    return { status: 'unsupported', reason: 'no_profile' }
  }

  const missing: PkRequirement[] = []
  if (input.trackingLevel !== 'complete') missing.push('complete_tracking')
  const route = pkRouteStatus(input.method, input.pkProfileMethod, input.pkProfileRoutes)
  // Das Profil gilt fuer andere Routen: keine Angabe kann das beheben.
  if (route === 'mismatch') return { status: 'unsupported', reason: 'route' }
  if (!pkRouteAccepted(route)) missing.push('method')
  if (input.dose == null || !Number.isFinite(input.dose) || input.dose <= 0) missing.push('dose')
  if (!input.unit?.trim()) missing.push('unit')
  if (!input.scheduledAt?.trim()) missing.push('time')

  if (missing.length) return { status: 'missing', missing }
  if (toPkMilligrams(input.dose!, input.unit!, input.iuPerMg ?? null, input.mgPerMl ?? null) == null) {
    return { status: 'unsupported', reason: 'unit_conversion' }
  }

  return { status: 'ready' }
}
