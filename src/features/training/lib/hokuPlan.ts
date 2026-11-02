import type { CustomExercise, PlanSchedule, RoutineExercise, RoutineSet, TrainingRoutine } from '../types'
import { allExercises, type ExerciseInfo } from './exerciseLookup'

/**
 * Ein Plan, den Hoku entworfen hat (Werkzeug `plan_entwerfen` der Edge Function
 * `coach`). Hier: was die App dafür mitschickt (der Übungskatalog), wie sie die
 * Antwort liest, und wie aus dem Entwurf beim „Übernehmen" Workouts werden.
 * Gespeichert wird erst dort, nach dem Tipp des Nutzers.
 */

export interface HokuPlanExercise {
  id: string
  sets: number
  repsMin: number | null
  repsMax: number | null
  durationS: number | null
  restS: number | null
}

export interface HokuPlanWorkout {
  name: string
  /** 1 = Montag … 7 = Sonntag; nur bei Zeitplan „Wochentage". */
  weekdays: number[]
  exercises: HokuPlanExercise[]
}

export interface HokuPlan {
  name: string
  schedule: PlanSchedule
  workouts: HokuPlanWorkout[]
}

const TAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const zahl = (v: unknown, lo: number, hi: number) =>
  typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : null

/**
 * Nimmt vom Server (oder aus dem gesicherten Chat-Verlauf) nur, was die Form
 * hat. Geprüft hat der Server schon; hier zählen Typen und Grenzen.
 */
export function liesPlaene(roh: unknown): HokuPlan[] {
  if (!Array.isArray(roh)) return []
  return roh.flatMap((p): HokuPlan[] => {
    if (!p || typeof p !== 'object') return []
    const x = p as Record<string, unknown>
    const anzahl = x.anzahl
    const schedule: PlanSchedule =
      x.zeitplan === 'pro_woche' && zahl(anzahl, 1, 7) ? { mode: 'per_week', perWeek: anzahl as number }
      : x.zeitplan === 'alle_x_tage' && zahl(anzahl, 1, 14) ? { mode: 'interval', everyDays: anzahl as number }
      : { mode: 'weekdays' }
    const workouts = (Array.isArray(x.workouts) ? x.workouts : []).flatMap((w): HokuPlanWorkout[] => {
      if (!w || typeof w !== 'object') return []
      const y = w as Record<string, unknown>
      const exercises = (Array.isArray(y.uebungen) ? y.uebungen : []).flatMap((u): HokuPlanExercise[] => {
        if (!u || typeof u !== 'object') return []
        const z = u as Record<string, unknown>
        if (typeof z.id !== 'string' || !z.id) return []
        return [{
          id: z.id, sets: zahl(z.saetze, 1, 10) ?? 3,
          repsMin: zahl(z.wdhMin, 1, 100), repsMax: zahl(z.wdhMax, 1, 100),
          durationS: zahl(z.sekunden, 5, 3600), restS: zahl(z.pauseS, 15, 600),
        }]
      })
      if (exercises.length === 0) return []
      const weekdays = schedule.mode === 'weekdays' && Array.isArray(y.wochentage)
        ? TAGE.flatMap((t, i) => ((y.wochentage as unknown[]).includes(t) ? [i + 1] : []))
        : []
      return [{ name: typeof y.name === 'string' && y.name.trim() ? y.name.trim().slice(0, 60) : '', weekdays, exercises }]
    })
    if (workouts.length === 0) return []
    const name = typeof x.name === 'string' && x.name.trim() ? x.name.trim().slice(0, 40) : workouts[0].name.slice(0, 40)
    return [{ name, schedule, workouts }]
  })
}

/** Ein Plan aus dem gesicherten Chat-Verlauf (schon in App-Form). Ungültiges: undefined. */
export function liesGesichertenPlan(roh: unknown): HokuPlan | undefined {
  if (!roh || typeof roh !== 'object') return undefined
  const p = roh as Partial<HokuPlan>
  const s = p.schedule as Partial<PlanSchedule & { perWeek: number; everyDays: number }> | undefined
  const planOk = !!s && typeof s === 'object' && (s.mode === 'weekdays'
    || (s.mode === 'per_week' && zahl(s.perWeek, 1, 7) != null)
    || (s.mode === 'interval' && zahl(s.everyDays, 1, 14) != null))
  const ok = typeof p.name === 'string' && planOk && Array.isArray(p.workouts)
    && p.workouts.every(w => w && typeof w.name === 'string' && Array.isArray(w.weekdays) && Array.isArray(w.exercises)
      && w.exercises.every(e => e && typeof e.id === 'string' && typeof e.sets === 'number'))
  return ok ? (p as HokuPlan) : undefined
}

/**
 * Was Hoku über das Training wissen muss, um einen Plan zu entwerfen: der
 * Katalog kompakt als „id|Name|Gerät|Muskeln" (eigene Übungen zuerst), die
 * Namen der vorhandenen Pläne (damit er keinen doppelt benennt) und die
 * Gewichtseinheit. Keine Gesundheits- oder Verlaufsdaten.
 */
export function trainingKontext(lang: 'de' | 'en', custom: readonly CustomExercise[], plaene: readonly string[], einheit: 'kg' | 'lb') {
  return {
    katalog: allExercises(lang, custom).map(ex => `${ex.id}|${ex.name}|${ex.equipment}|${ex.primary.slice(0, 2).join(',')}`),
    vorhandene_plaene: [...plaene].slice(0, 30),
    einheit,
  }
}

/** Übungen im Entwurf, die es in der App nicht gibt (Hoku hat sich vertan): als `workout:index`. */
export function unbekannteUebungen(plan: HokuPlan, bekannt: ReadonlySet<string>): string[] {
  return plan.workouts.flatMap((w, wi) => w.exercises.flatMap((ex, ei) => (bekannt.has(ex.id) ? [] : [`${wi}:${ei}`])))
}

/** Satzzeilen einer Übung: leer bis auf Wdh.-Bereich bzw. Dauer — Gewichte trägt man im Training ein. */
function saetze(ex: HokuPlanExercise): RoutineSet[] {
  return Array.from({ length: ex.sets }, (): RoutineSet => ({
    type: 'normal',
    ...(ex.repsMin != null ? { repsMin: ex.repsMin } : {}),
    ...(ex.repsMax != null ? { repsMax: ex.repsMax } : {}),
    ...(ex.durationS != null ? { durationS: ex.durationS } : {}),
  }))
}

/** Aus dem Entwurf die Workouts zum Speichern (nur bekannte Übungen), alle im Plan `planName`. */
export function entwurfZuWorkouts(
  plan: HokuPlan,
  planName: string,
  ersteReihenfolge: number,
  info: (id: string) => ExerciseInfo | null,
  fallbackName: (n: number) => string,
): Array<Omit<TrainingRoutine, 'id'>> {
  return plan.workouts.flatMap((w, i) => {
    const exercises: RoutineExercise[] = w.exercises
      .filter(ex => info(ex.id))
      .map(ex => ({ exerciseId: ex.id, sets: saetze(ex), ...(ex.restS != null ? { restS: ex.restS } : {}) }))
    if (exercises.length === 0) return []
    return [{
      name: (w.name || fallbackName(i + 1)).slice(0, 60),
      kind: 'strength' as const,
      exercises,
      weekdays: plan.schedule.mode === 'weekdays' ? w.weekdays : [],
      sortOrder: ersteReihenfolge + i,
      folder: planName,
    }]
  })
}
