import type {
  RoutineExercise, SessionExercise, SessionKind, SetType, TrainingRoutine, TrainingSession, TrainingSet,
} from '../types'
import type { Suggestion } from './progression'
import { previousSets } from './stats'

/**
 * Das laufende Training.
 *
 * Es lebt nur auf dem Geraet (localStorage) bis „Beenden" — so uebersteht es
 * einen App-Neustart, ein leeres Akku-Ende oder einen Funkloch im Keller-Gym,
 * und in der Datenbank landet nie eine halbe Einheit. Alle Aenderungen laufen
 * ueber `reduceWorkout`, eine reine Funktion, damit jede Bedienung testbar ist.
 */

export interface ActiveWorkout {
  /** Gesetzt, wenn ein gespeichertes Training bearbeitet wird. */
  sessionId: string | null
  kind: SessionKind
  title: string
  startedAt: string
  routineId: string | null
  exercises: SessionExercise[]
  /** Laufende Pause: Ende als Zeitstempel, damit sie auch nach Neustart stimmt. */
  restEndsAt: number | null
  restTotalS: number | null
  notes: string | null
  /** Stand vor dem letzten Entfernen (Satz oder Uebung) — fuer „Rückgängig" im Toast. */
  undo?: { exercises: SessionExercise[]; label: 'set' | 'exercise' } | null
}

/** Vorschlag je Uebung (`suggestNextSets`), vom Aufrufer mit Katalog und Verlauf versorgt. */
export type SuggestFn = (exerciseId: string, template?: RoutineExercise['sets']) => Suggestion | null

export const ACTIVE_WORKOUT_KEY = 'tyd_training_active_v1'

/**
 * Je Konto ein eigener Speicherplatz: meldet sich auf demselben Geraet jemand
 * anderes an, sieht er das offene Training des Vorgaengers nicht und speichert
 * es auch nicht unter seinem Konto.
 */
export function activeWorkoutKey(userId: string): string {
  return `${ACTIVE_WORKOUT_KEY}:${userId}`
}

export function loadActiveWorkout(userId: string): ActiveWorkout | null {
  try {
    const raw = localStorage.getItem(activeWorkoutKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as ActiveWorkout
    if (!parsed || typeof parsed.startedAt !== 'string' || !Array.isArray(parsed.exercises)) return null
    return parsed
  } catch {
    return null
  }
}

export function storeActiveWorkout(userId: string, workout: ActiveWorkout | null) {
  try {
    if (workout) localStorage.setItem(activeWorkoutKey(userId), JSON.stringify(workout))
    else localStorage.removeItem(activeWorkoutKey(userId))
  } catch {
    // Privater Modus oder voller Speicher: das Training laeuft im Speicher weiter.
  }
}

const emptySet = (type: SetType = 'normal'): TrainingSet => ({ type, done: false })

/**
 * Startwerte fuer eine Uebung: die Saetze vom letzten Mal (Gewicht, Wdh.,
 * Zeit), nicht abgehakt. Gibt es keine, die Vorgabe der Routine, sonst ein
 * leerer Satz.
 */
export function seedSets(
  exerciseId: string,
  history: readonly TrainingSession[],
  template?: RoutineExercise['sets'],
): TrainingSet[] {
  const previous = previousSets(history, exerciseId)
  const count = template?.length || previous.length || 1
  return Array.from({ length: count }, (_, i) => {
    const prev = previous[i] ?? previous[previous.length - 1]
    const tpl = template?.[i]
    return {
      type: tpl?.type ?? prev?.type ?? 'normal',
      weightKg: prev?.weightKg ?? tpl?.weightKg ?? null,
      reps: prev?.reps ?? tpl?.reps ?? null,
      durationS: prev?.durationS ?? tpl?.durationS ?? null,
      distanceM: prev?.distanceM ?? tpl?.distanceM ?? null,
      done: false,
    }
  })
}

/** Saetze aus einem Vorschlag: nicht abgehakt, nicht getippt. */
function setsFromSuggestion(suggestion: Suggestion): TrainingSet[] {
  return suggestion.sets.map(s => ({
    type: s.type,
    weightKg: s.weightKg ?? null,
    reps: s.reps ?? null,
    durationS: s.durationS ?? null,
    distanceM: s.distanceM ?? null,
    done: false,
  }))
}

/** Startwerte: der Vorschlag, wenn es einen gibt, sonst `seedSets`. */
function initialSets(
  exerciseId: string,
  history: readonly TrainingSession[],
  template?: RoutineExercise['sets'],
  suggest?: SuggestFn,
): TrainingSet[] {
  const suggestion = suggest?.(exerciseId, template)
  if (suggestion && suggestion.sets.length > 0) return setsFromSuggestion(suggestion)
  return seedSets(exerciseId, history, template)
}

export function startWorkout(options: {
  kind?: SessionKind
  title?: string
  routine?: TrainingRoutine | null
  history: readonly TrainingSession[]
  suggest?: SuggestFn
  now?: Date
}): ActiveWorkout {
  const routine = options.routine ?? null
  return {
    sessionId: null,
    kind: routine?.kind ?? options.kind ?? 'strength',
    title: routine?.name ?? options.title ?? '',
    startedAt: (options.now ?? new Date()).toISOString(),
    routineId: routine?.id ?? null,
    exercises: (routine?.exercises ?? []).map(ex => ({
      exerciseId: ex.exerciseId,
      supersetGroup: ex.supersetGroup ?? null,
      restS: ex.restS ?? null,
      notes: ex.notes ?? null,
      sets: initialSets(ex.exerciseId, options.history, ex.sets, options.suggest),
    })),
    restEndsAt: null,
    restTotalS: null,
    notes: null,
    undo: null,
  }
}

/** Ein gespeichertes Training zum Bearbeiten oeffnen. */
export function workoutFromSession(session: TrainingSession): ActiveWorkout {
  return {
    sessionId: session.id,
    kind: session.kind,
    title: session.title,
    startedAt: session.startedAt,
    routineId: session.routineId,
    exercises: structuredClone(session.exercises),
    restEndsAt: null,
    restTotalS: null,
    notes: session.notes,
    undo: null,
  }
}

export type WorkoutAction =
  | { type: 'title'; title: string }
  | { type: 'add_exercises'; exerciseIds: string[]; history: readonly TrainingSession[]; suggest?: SuggestFn }
  | { type: 'remove_exercise'; index: number }
  /** Uebung tauschen: Satzzahl, Satzarten, Supersatz, Pause und Notiz bleiben; Werte neu fuer die neue Uebung. */
  | { type: 'replace_exercise'; index: number; exerciseId: string; history: readonly TrainingSession[]; suggest?: SuggestFn }
  /** Stand vor dem letzten `remove_set`/`remove_exercise` zurueckholen. */
  | { type: 'undo' }
  /** Vorschlag in die offenen, nicht getippten Saetze schreiben. */
  | { type: 'apply_suggestion'; index: number; sets: Suggestion['sets'] }
  | { type: 'move_exercise'; index: number; delta: -1 | 1 }
  | { type: 'toggle_superset'; index: number }
  | { type: 'exercise_rest'; index: number; restS: number | null }
  | { type: 'exercise_notes'; index: number; notes: string }
  | { type: 'add_set'; index: number }
  | { type: 'remove_set'; index: number; setIndex: number }
  | { type: 'update_set'; index: number; setIndex: number; patch: Partial<TrainingSet> }
  | { type: 'cycle_set_type'; index: number; setIndex: number }
  | { type: 'toggle_done'; index: number; setIndex: number; defaultRestS: number; now: number }
  | { type: 'rest_adjust'; deltaS: number; now: number }
  | { type: 'rest_skip' }

const SET_TYPE_CYCLE: SetType[] = ['normal', 'warmup', 'drop', 'failure']
const VALUE_KEYS: Array<keyof TrainingSet> = ['weightKg', 'reps', 'durationS', 'distanceM']

function updateExercise(w: ActiveWorkout, index: number, fn: (ex: SessionExercise) => SessionExercise): ActiveWorkout {
  if (!w.exercises[index]) return w
  return { ...w, exercises: w.exercises.map((ex, i) => i === index ? fn(ex) : ex) }
}

function nextSupersetGroup(w: ActiveWorkout): number {
  return w.exercises.reduce((max, ex) => Math.max(max, ex.supersetGroup ?? 0), 0) + 1
}

/** Gehoert die Uebung zu einem Supersatz und ist sie nicht die letzte darin? */
function continuesSuperset(w: ActiveWorkout, index: number): boolean {
  const group = w.exercises[index]?.supersetGroup
  return group != null && w.exercises[index + 1]?.supersetGroup === group
}

export function reduceWorkout(w: ActiveWorkout, action: WorkoutAction): ActiveWorkout {
  switch (action.type) {
    case 'title':
      return { ...w, title: action.title.slice(0, 80) }

    case 'add_exercises':
      return {
        ...w,
        exercises: [
          ...w.exercises,
          ...action.exerciseIds.map(id => ({
            exerciseId: id, supersetGroup: null, restS: null, notes: null,
            sets: initialSets(id, action.history, undefined, action.suggest),
          })),
        ],
      }

    case 'remove_exercise': {
      if (!w.exercises[action.index]) return w
      const exercises = w.exercises.filter((_, i) => i !== action.index)
      return { ...w, exercises: dissolveLoneSupersets(exercises), undo: { exercises: w.exercises, label: 'exercise' } }
    }

    case 'replace_exercise':
      return updateExercise(w, action.index, ex => {
        const fresh = initialSets(action.exerciseId, action.history, undefined, action.suggest)
        return {
          ...ex,
          exerciseId: action.exerciseId,
          sets: ex.sets.map((s, i) => {
            const value = fresh[i] ?? fresh[fresh.length - 1]
            return {
              type: s.type,
              weightKg: value?.weightKg ?? null,
              reps: value?.reps ?? null,
              durationS: value?.durationS ?? null,
              distanceM: value?.distanceM ?? null,
              done: false,
            }
          }),
        }
      })

    case 'undo':
      if (!w.undo) return w
      return { ...w, exercises: w.undo.exercises, undo: null }

    case 'apply_suggestion':
      return updateExercise(w, action.index, ex => ({
        ...ex,
        sets: ex.sets.map((s, i) => {
          const next = action.sets[i]
          if (!next || s.done || s.touched) return s
          return {
            ...s,
            weightKg: next.weightKg ?? null,
            reps: next.reps ?? null,
            durationS: next.durationS ?? null,
            distanceM: next.distanceM ?? null,
          }
        }),
      }))

    case 'move_exercise': {
      const target = action.index + action.delta
      if (target < 0 || target >= w.exercises.length) return w
      const exercises = [...w.exercises]
      ;[exercises[action.index], exercises[target]] = [exercises[target], exercises[action.index]]
      return { ...w, exercises: dissolveLoneSupersets(exercises) }
    }

    case 'toggle_superset': {
      const current = w.exercises[action.index]
      const next = w.exercises[action.index + 1]
      if (!current) return w
      if (current.supersetGroup != null && next?.supersetGroup === current.supersetGroup) {
        // Aufloesen: die Kette ab hier abtrennen.
        const exercises = w.exercises.map((ex, i) => i > action.index && ex.supersetGroup === current.supersetGroup
          ? { ...ex, supersetGroup: null } : ex)
        return { ...w, exercises: dissolveLoneSupersets(exercises) }
      }
      if (!next) return w
      const group = current.supersetGroup ?? next.supersetGroup ?? nextSupersetGroup(w)
      const exercises = w.exercises.map((ex, i) =>
        i === action.index || i === action.index + 1 ? { ...ex, supersetGroup: group } : ex)
      // Zieht `next` aus einem anderen Supersatz herueber, bleibt dort evtl. eine Uebung allein.
      return { ...w, exercises: dissolveLoneSupersets(exercises) }
    }

    case 'exercise_rest':
      return updateExercise(w, action.index, ex => ({ ...ex, restS: action.restS }))

    case 'exercise_notes':
      return updateExercise(w, action.index, ex => ({ ...ex, notes: action.notes.slice(0, 500) || null }))

    case 'add_set':
      return updateExercise(w, action.index, ex => {
        const last = ex.sets[ex.sets.length - 1]
        const set: TrainingSet = last
          ? { type: last.type === 'warmup' ? 'normal' : last.type, weightKg: last.weightKg, reps: last.reps, durationS: last.durationS, distanceM: last.distanceM, done: false }
          : emptySet()
        return { ...ex, sets: [...ex.sets, set] }
      })

    case 'remove_set': {
      if (!w.exercises[action.index]?.sets[action.setIndex]) return w
      const next = updateExercise(w, action.index, ex => ({ ...ex, sets: ex.sets.filter((_, i) => i !== action.setIndex) }))
      return { ...next, undo: { exercises: w.exercises, label: 'set' } }
    }

    case 'update_set': {
      // Getippt hat der Nutzer, wenn ein Wert (nicht nur RPE) im Patch steht.
      const typed = VALUE_KEYS.some(key => key in action.patch)
      return updateExercise(w, action.index, ex => ({
        ...ex,
        sets: ex.sets.map((s, i) => i === action.setIndex ? { ...s, ...action.patch, ...(typed ? { touched: true } : {}) } : s),
      }))
    }

    case 'cycle_set_type':
      return updateExercise(w, action.index, ex => ({
        ...ex,
        sets: ex.sets.map((s, i) => i === action.setIndex
          ? { ...s, type: SET_TYPE_CYCLE[(SET_TYPE_CYCLE.indexOf(s.type) + 1) % SET_TYPE_CYCLE.length] }
          : s),
      }))

    case 'toggle_done': {
      const ex = w.exercises[action.index]
      const set = ex?.sets[action.setIndex]
      if (!ex || !set) return w
      const done = !set.done
      const next = updateExercise(w, action.index, e => ({
        ...e, sets: e.sets.map((s, i) => i === action.setIndex ? { ...s, done } : s),
      }))
      if (!done) return next
      // Einen frueheren Satz nachtraeglich abhaken startet keine neue Pause.
      if (ex.sets.some((s, i) => i > action.setIndex && s.done)) return next
      // Im Supersatz startet die Pause erst nach der letzten Uebung der Runde.
      if (continuesSuperset(w, action.index)) return { ...next, restEndsAt: null, restTotalS: null }
      const restS = ex.restS ?? action.defaultRestS
      if (!restS || restS <= 0) return { ...next, restEndsAt: null, restTotalS: null }
      return { ...next, restEndsAt: action.now + restS * 1000, restTotalS: restS }
    }

    case 'rest_adjust': {
      if (w.restEndsAt == null) return w
      const endsAt = Math.max(action.now, w.restEndsAt + action.deltaS * 1000)
      return { ...w, restEndsAt: endsAt, restTotalS: Math.max(0, (w.restTotalS ?? 0) + action.deltaS) }
    }

    case 'rest_skip':
      return { ...w, restEndsAt: null, restTotalS: null }
  }
}

/** Ein Supersatz mit nur noch einer Uebung ist keiner mehr. */
function dissolveLoneSupersets(exercises: SessionExercise[]): SessionExercise[] {
  return exercises.map((ex, i) => {
    if (ex.supersetGroup == null) return ex
    const neighbour = exercises[i - 1]?.supersetGroup === ex.supersetGroup || exercises[i + 1]?.supersetGroup === ex.supersetGroup
    return neighbour ? ex : { ...ex, supersetGroup: null }
  })
}

/**
 * Aus dem laufenden Training die zu speichernde Einheit machen: nur
 * abgehakte Saetze, Uebungen ohne einen davon fallen weg.
 */
export function finishWorkout(
  w: ActiveWorkout,
  options: { now: Date; rpe: number | null; previous?: TrainingSession | null },
): Omit<TrainingSession, 'id'> & { id?: string } {
  const exercises = w.exercises
    // `touched` ist nur fuer den Logger; gespeichert wird es nicht.
    .map(ex => ({ ...ex, sets: ex.sets.filter(s => s.done).map(stripTouched) }))
    .filter(ex => ex.sets.length > 0)
  const editing = options.previous ?? null
  const endedAt = editing?.endedAt ?? options.now.toISOString()
  const durationS = editing?.durationS
    ?? Math.max(0, Math.round((Date.parse(endedAt) - Date.parse(w.startedAt)) / 1000))
  return {
    ...(w.sessionId ? { id: w.sessionId } : {}),
    kind: w.kind,
    title: w.title.trim(),
    startedAt: w.startedAt,
    endedAt,
    durationS,
    distanceM: editing?.distanceM ?? sumDistance(exercises),
    kcal: editing?.kcal ?? null,
    avgHr: editing?.avgHr ?? null,
    rpe: options.rpe,
    notes: w.notes,
    routineId: w.routineId,
    exercises,
    source: editing?.source ?? 'live',
    externalId: editing?.externalId ?? null,
  }
}

function stripTouched(set: TrainingSet): TrainingSet {
  const copy = { ...set }
  delete copy.touched
  return copy
}

function sumDistance(exercises: SessionExercise[]): number | null {
  const total = exercises.reduce((sum, ex) => sum + ex.sets.reduce((s, set) => s + (set.distanceM ?? 0), 0), 0)
  return total > 0 ? total : null
}

export function countSets(w: Pick<ActiveWorkout, 'exercises'>): { done: number; open: number } {
  let done = 0
  let open = 0
  for (const ex of w.exercises) {
    for (const s of ex.sets) {
      if (s.done) done++
      else open++
    }
  }
  return { done, open }
}

/** Der erste nicht abgehakte Satz in Reihenfolge — bekommt im Logger den Ring. */
export function nextOpenSet(w: Pick<ActiveWorkout, 'exercises'>): { index: number; setIndex: number } | null {
  for (let index = 0; index < w.exercises.length; index++) {
    const setIndex = w.exercises[index].sets.findIndex(s => !s.done)
    if (setIndex >= 0) return { index, setIndex }
  }
  return null
}

/**
 * Die naechste Uebung derselben Supersatz-Gruppe; am Ende der Gruppe wieder
 * die erste. null, wenn die Uebung in keinem Supersatz ist.
 */
export function supersetPartnerIndex(w: Pick<ActiveWorkout, 'exercises'>, index: number): number | null {
  const group = w.exercises[index]?.supersetGroup
  if (group == null) return null
  const members = w.exercises.map((ex, i) => ex.supersetGroup === group ? i : -1).filter(i => i >= 0)
  if (members.length < 2) return null
  const pos = members.indexOf(index)
  return members[(pos + 1) % members.length]
}
