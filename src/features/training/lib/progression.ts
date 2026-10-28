import type { Equipment, RoutineSet, TrackingMode, TrainingSet, WeightUnit } from '../types'
import { LB_PER_KG, fromDisplayWeight } from './stats'

/**
 * Vorschlag fuer die naechste Einheit einer Uebung — Doppelprogression.
 *
 * Der Logger belegt die Saetze damit vor und zeigt die Begruendung in einer
 * Zeile („Letztes Mal 3 × 10 @ 80 kg geschafft → heute 82,5 kg"). Nichts
 * davon ist Pflicht: der Nutzer tippt drueber, und was er getippt hat, bleibt.
 *
 * Regeln (in dieser Reihenfolge, nur Arbeitssaetze = abgehakt, kein Aufwaermsatz):
 * 1. Nur bei Gewicht × Wdh., Koerpergewicht × Wdh., Unterstuetzung × Wdh. und
 *    reinen Wdh. Bei Zeit/Strecke gibt es keinen Vorschlag (null).
 * 2. Wdh.-Bereich: `repsMin`–`repsMax` aus der Routine. Fehlt er, gilt die
 *    Wdh.-Zahl des ersten Arbeitssatzes vom letzten Mal als Ziel — Standard
 *    ist also „letztes Mal schlagen: erst die Wdh. halten, dann mehr Gewicht".
 * 3. Alle Arbeitssaetze haben `repsMax` erreicht und die hoechste RPE war
 *    hoechstens 8,5 (oder fehlt): **Gewicht hoch** um den Schritt des Geraets,
 *    Wdh. zurueck auf `repsMin`. Waere der Schritt mehr als +10 % (5-kg-Hantel
 *    → 7 kg = +40 %): stattdessen **+1 Wdh.** beim selben Gewicht — es sei denn,
 *    die Wdh. liegen schon 2 ueber `repsMax`, dann wird der Sprung trotzdem
 *    gewagt (sonst kaeme man von der 5-kg-Hantel nie weg). Geraete ohne
 *    Gewichtsschritt (Koerpergewicht, Band, Sandsack …): immer +1 Wdh.
 * 4. Mindestens ein Satz am Ziel, aber nicht alle: **Gewicht halten**, die
 *    Saetze darunter bekommen +1 Wdh. (bis `repsMax`).
 * 5. Mindestens zwei Saetze 2+ Wdh. unter `repsMin`, oder ein Satz mit RPE 10
 *    unter `repsMin`: **etwas leichter** — 5 % runter, auf den Geraeteschritt
 *    gerundet, mindestens ein Schritt.
 * 6. Sonst **wie letztes Mal** (z. B. alle Wdh. geschafft, aber RPE 9).
 * 7. Ohne letztes Mal: die Startwerte der Routine (`change: 'none'`); gibt es
 *    auch die nicht, null.
 *
 * Gewichtsschritt je Geraet: Langhantel/Smith/Trap-Bar/SZ-Stange 2,5 kg
 * (5 lb); Kurzhantel/Kettlebell 2 kg (5 lb); Maschine/Kabel 2,5 kg, ab 50 kg
 * 5 kg (5 bzw. 10 lb). Bei Unterstuetzung (assisted_reps) ist weniger Hilfe
 * der Fortschritt: der Schritt geht in die andere Richtung.
 *
 * Gewichte sind intern immer kg; gerundet wird auf ein Viertel der Einheit,
 * die der Nutzer sieht (0,25 kg bzw. 0,25 lb), damit in lb keine krummen
 * Zahlen entstehen. `reasonVars` enthaelt rohe Zahlen (kg, Wdh., Saetze) —
 * formatiert wird in der Oberflaeche mit `formatWeight`/`formatNumber`.
 */

export type SuggestedSet = Pick<TrainingSet, 'type' | 'weightKg' | 'reps' | 'durationS' | 'distanceM'>

export type ProgressionChange = 'weight_up' | 'reps_up' | 'hold' | 'weight_down' | 'none'

export type ProgressionReasonKey =
  | 'progress_up'
  | 'progress_jump_too_big'
  | 'progress_reps_up'
  | 'progress_reps_only'
  | 'progress_back_off'
  | 'progress_hold'
  | 'progress_hold_reps'
  | 'progress_from_template'

export interface Suggestion {
  sets: SuggestedSet[]
  reasonKey: ProgressionReasonKey
  /**
   * Rohwerte fuer den Text: `weight`, `next`, `inc` in kg (Zahl, unformatiert),
   * `reps` und `sets` als ganze Zahlen. Die Oberflaeche formatiert.
   */
  reasonVars: Record<string, string | number>
  change: ProgressionChange
}

export interface SuggestionInput {
  exerciseId: string
  equipment: Equipment
  tracking: TrackingMode
  /** Abgehakte Saetze der letzten Einheit mit dieser Uebung (`previousSets`), ggf. leer. */
  previous: TrainingSet[]
  template?: RoutineSet[]
  unit: WeightUnit
}

export const KG_PER_LB = 0.45359237

const REP_TRACKING: ReadonlySet<TrackingMode> = new Set(['weight_reps', 'bodyweight_reps', 'assisted_reps', 'reps'])

const BARBELL_LIKE: ReadonlySet<Equipment> = new Set(['barbell', 'smith', 'trap_bar', 'ez_bar'])
const DUMBBELL_LIKE: ReadonlySet<Equipment> = new Set(['dumbbell', 'kettlebell'])
const MACHINE_LIKE: ReadonlySet<Equipment> = new Set(['machine', 'cable'])

/** Gewichtsschritt des Geraets in kg; null, wenn das Geraet keinen hat. */
export function weightIncrementKg(equipment: Equipment, unit: WeightUnit, previousKg: number): number | null {
  const lb = (n: number) => n * KG_PER_LB
  if (BARBELL_LIKE.has(equipment)) return unit === 'lb' ? lb(5) : 2.5
  if (DUMBBELL_LIKE.has(equipment)) return unit === 'lb' ? lb(5) : 2
  if (MACHINE_LIKE.has(equipment)) {
    const heavy = previousKg >= 50
    if (unit === 'lb') return lb(heavy ? 10 : 5)
    return heavy ? 5 : 2.5
  }
  return null
}

/** Auf ein Viertel der Anzeigeeinheit runden, nie unter 0. */
export function roundWeightKg(kg: number, unit: WeightUnit): number {
  const safe = Math.max(0, kg)
  if (unit === 'kg') return Math.round(safe * 4) / 4
  return fromDisplayWeight(Math.round(safe * LB_PER_KG * 4) / 4, 'lb')
}

/** Auf ein Vielfaches des Schritts runden (fuer das Zurueckgehen um 5 %). */
function roundToIncrement(kg: number, increment: number | null, unit: WeightUnit): number {
  if (!increment || increment <= 0) return roundWeightKg(kg, unit)
  return roundWeightKg(Math.round(kg / increment) * increment, unit)
}

const isWorking = (s: TrainingSet) => s.done && s.type !== 'warmup'

function targetRange(template: RoutineSet[] | undefined, firstReps: number): { min: number; max: number } {
  const tpl = template?.find(t => t.type !== 'warmup' && (t.repsMin != null || t.repsMax != null))
  if (tpl) {
    const min = tpl.repsMin ?? tpl.repsMax ?? firstReps
    const max = tpl.repsMax ?? tpl.repsMin ?? firstReps
    return { min: Math.max(1, Math.min(min, max)), max: Math.max(1, Math.max(min, max)) }
  }
  return { min: firstReps, max: firstReps }
}

function fromTemplate(template: RoutineSet[] | undefined): Suggestion | null {
  if (!template?.length) return null
  const sets: SuggestedSet[] = template.map(t => ({
    type: t.type,
    weightKg: t.weightKg ?? null,
    reps: t.reps ?? t.repsMin ?? null,
    durationS: t.durationS ?? null,
    distanceM: t.distanceM ?? null,
  }))
  if (!sets.some(s => s.weightKg != null || s.reps != null)) return null
  return { sets, reasonKey: 'progress_from_template', reasonVars: {}, change: 'none' }
}

export function suggestNextSets(input: SuggestionInput): Suggestion | null {
  if (!REP_TRACKING.has(input.tracking)) return null
  const { template, unit } = input
  const working = input.previous.filter(s => isWorking(s) && s.reps != null && s.reps > 0)
  if (working.length === 0) return fromTemplate(template)

  const first = working[0]
  const firstReps = Math.round(first.reps ?? 0)
  const range = targetRange(template, firstReps)
  const prevWeight = input.tracking === 'reps' ? null : first.weightKg ?? null
  const hasWeight = prevWeight != null && prevWeight > 0
  // Bei Unterstuetzung ist weniger Hilfe der Fortschritt.
  const dir = input.tracking === 'assisted_reps' ? -1 : 1
  const increment = hasWeight ? weightIncrementKg(input.equipment, unit, prevWeight) : null
  const maxRpe = working.reduce<number | null>((max, s) => s.rpe == null ? max : Math.max(max ?? 0, s.rpe), null)

  const reached = working.map(s => (s.reps ?? 0) >= range.max)
  const allReached = reached.every(Boolean)
  const anyReached = reached.some(Boolean)
  const missedByTwo = working.filter(s => (s.reps ?? 0) <= range.min - 2).length
  const failedAtTen = working.some(s => s.rpe != null && s.rpe >= 10 && (s.reps ?? 0) < range.min)

  // Layout der Saetze: Vorlage, sonst wie letztes Mal (inkl. Aufwaermsaetze).
  const layout: Array<{ type: TrainingSet['type']; tpl?: RoutineSet; prev?: TrainingSet }> = template?.length
    ? template.map((t, i) => ({ type: t.type, tpl: t, prev: input.previous[i] }))
    : input.previous.map(s => ({ type: s.type, prev: s }))

  let change: ProgressionChange = 'hold'
  let reasonKey: ProgressionReasonKey = hasWeight ? 'progress_hold' : 'progress_hold_reps'
  let reasonVars: Record<string, string | number> = hasWeight
    ? { sets: working.length, reps: firstReps, weight: prevWeight }
    : { sets: working.length, reps: firstReps }
  // Wie ein Arbeitssatz aus seinem Vorgaenger entsteht.
  let nextWorking = (prev: TrainingSet): { weightKg: number | null; reps: number } => ({
    weightKg: prev.weightKg ?? null, reps: prev.reps ?? firstReps,
  })

  if (allReached && (maxRpe == null || maxRpe <= 8.5)) {
    const jumpTooBig = increment != null && hasWeight && increment > prevWeight * 0.1 && firstReps < range.max + 2
    if (increment != null && hasWeight && !jumpTooBig) {
      const next = roundWeightKg(prevWeight + dir * increment, unit)
      change = 'weight_up'
      reasonKey = 'progress_up'
      reasonVars = { sets: working.length, reps: range.max, weight: prevWeight, next }
      const resetReps = range.min < range.max ? range.min : range.max
      nextWorking = prev => ({
        weightKg: prev.weightKg == null ? null : roundWeightKg(prev.weightKg + dir * increment, unit),
        reps: resetReps,
      })
    } else if (increment != null && hasWeight) {
      change = 'reps_up'
      reasonKey = 'progress_jump_too_big'
      reasonVars = { inc: increment, reps: firstReps + 1, weight: prevWeight }
      nextWorking = prev => ({ weightKg: prev.weightKg ?? null, reps: (prev.reps ?? firstReps) + 1 })
    } else {
      change = 'reps_up'
      reasonKey = 'progress_reps_only'
      reasonVars = { sets: working.length, reps: firstReps + 1 }
      nextWorking = prev => ({ weightKg: prev.weightKg ?? null, reps: (prev.reps ?? firstReps) + 1 })
    }
  } else if (anyReached && !allReached) {
    change = 'reps_up'
    reasonKey = 'progress_reps_up'
    reasonVars = { reps: range.max }
    nextWorking = prev => {
      const reps = prev.reps ?? firstReps
      return { weightKg: prev.weightKg ?? null, reps: reps >= range.max ? reps : Math.min(range.max, reps + 1) }
    }
  } else if ((missedByTwo >= 2 || failedAtTen) && hasWeight) {
    const stepped = roundToIncrement(prevWeight * 0.95, increment, unit)
    const next = Math.max(0, Math.min(stepped, roundWeightKg(prevWeight - (increment ?? 0), unit)))
    const nextOf = (kg: number) => dir < 0
      ? roundWeightKg(kg + (prevWeight - next), unit)
      : roundWeightKg(kg - (prevWeight - next), unit)
    change = 'weight_down'
    reasonKey = 'progress_back_off'
    reasonVars = { weight: nextOf(prevWeight) }
    nextWorking = prev => ({
      weightKg: prev.weightKg == null ? null : nextOf(prev.weightKg),
      reps: Math.max(range.min, prev.reps ?? firstReps),
    })
  }

  let workIndex = 0
  const sets: SuggestedSet[] = layout.map(slot => {
    if (slot.type === 'warmup') {
      const src = slot.prev?.type === 'warmup' ? slot.prev : slot.tpl
      return {
        type: 'warmup',
        weightKg: src?.weightKg ?? null,
        reps: src?.reps ?? null,
        durationS: src?.durationS ?? null,
        distanceM: src?.distanceM ?? null,
      }
    }
    const prev = working[Math.min(workIndex, working.length - 1)]
    workIndex++
    const next = nextWorking(prev)
    return {
      type: slot.type,
      weightKg: next.weightKg == null ? null : Math.max(0, next.weightKg),
      reps: Math.max(1, Math.round(next.reps)),
      durationS: null,
      distanceM: null,
    }
  })

  return { sets, reasonKey, reasonVars, change }
}
