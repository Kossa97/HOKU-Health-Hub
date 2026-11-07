import type { CustomExercise, TrainingSession, TrainingSet, WeightUnit } from '../../types'
import type { TrainingTextKey } from '../../i18n'
import type { ActiveWorkout, SuggestFn, WorkoutAction } from '../../lib/activeWorkout'
import { allExercises, exerciseName, exerciseTracking, normalizeName, usesDistance, usesDuration, usesReps, usesWeight } from '../../lib/exerciseLookup'
import { formatClock, formatNumber, formatWeight } from '../../lib/format'
import { lastDoneBefore, parseCommand, planSet, voiceTarget } from '../../lib/voiceCommand'

/**
 * Führt einen gesprochenen oder getippten Befehl im laufenden Training aus:
 * liefert die Bedienungen (als ein `batch`, also mit einem Rückgängig) und die
 * Rückmeldung für den Hinweis unten. Ohne React, damit jede Antwort testbar ist.
 */

export interface VoiceContext {
  workout: ActiveWorkout
  /**
   * Ab welcher Übung der nächste Eintrag landet („nächste Übung"), als Position.
   * Der Logger merkt sich die Übung selbst (`focusId`), damit Verschieben oder
   * Entfernen den Fokus nicht auf eine andere Übung lenkt.
   */
  focus: number
  lang: 'de' | 'en'
  locale: string
  unit: WeightUnit
  customExercises: readonly CustomExercise[]
  defaultRestS: number
  now: number
  history: readonly TrainingSession[]
  suggest: SuggestFn
}

export type VoiceMessage = { key: TrainingTextKey; vars?: Record<string, string | number> }

export type VoiceResult =
  /** Eintragen; `undoable` heißt: im Hinweis steht „Rückgängig". */
  | { type: 'actions'; actions: WorkoutAction[]; message: VoiceMessage; focusId?: string; scrollTo?: number }
  | { type: 'undo'; id: number; message: VoiceMessage }
  | { type: 'focus'; focusId: string; scrollTo: number; message: VoiceMessage }
  | { type: 'none'; message: VoiceMessage }

const none = (key: TrainingTextKey, vars?: VoiceMessage['vars']): VoiceResult => ({ type: 'none', message: { key, vars } })

/** „80 kg × 8", „45 s", „1000 m · 4:05" — mit Einheit, für den Hinweis. */
export function setValueLabel(set: TrainingSet, tracking: ReturnType<typeof exerciseTracking>, unit: WeightUnit, locale: string): string {
  const mode = tracking ?? 'weight_reps'
  const parts: string[] = []
  if (usesWeight(mode) && set.weightKg != null) parts.push(formatWeight(set.weightKg, unit, locale))
  if (usesReps(mode) && set.reps != null) parts.push(String(set.reps))
  if (usesDistance(mode) && set.distanceM != null) parts.push(`${formatNumber(set.distanceM, locale, 0)} m`)
  if (usesDuration(mode) && set.durationS != null) parts.push(formatClock(set.durationS))
  return parts.join(' × ')
}

/** Übung zum gesagten Namen: genauer Name, dann schon trainiert, dann kürzester Name. */
export function findExercise(
  query: string,
  lang: 'de' | 'en',
  custom: readonly CustomExercise[],
  history: readonly TrainingSession[],
): string | null {
  const words = normalizeName(query).split(' ').filter(Boolean)
  if (words.length === 0) return null
  // Mehrzahl und Endungen: „Klimmzüge" → „klimmzug", „squats" → „squat"
  const stems = words.map(w => (w.length > 4 ? w.replace(/(en|e|n|s)$/, '') : w))
  const list = allExercises(lang, custom).map(ex => ({ id: ex.id, name: ex.name, key: normalizeName(ex.name) }))
  const exact = list.find(ex => ex.key === words.join(' '))
  if (exact) return exact.id
  const hits = list.filter(ex => stems.every(s => ex.key.includes(s)))
  if (hits.length === 0) return null
  const used = new Map<string, number>()
  history.forEach((s, i) => s.exercises.forEach(e => { if (!used.has(e.exerciseId)) used.set(e.exerciseId, i) }))
  return [...hits].sort((a, b) =>
    (used.get(a.id) ?? Infinity) - (used.get(b.id) ?? Infinity) || a.name.length - b.name.length)[0].id
}

export function runVoiceCommand(text: string, ctx: VoiceContext): VoiceResult {
  const cmd = parseCommand(text)
  if (!cmd) return none('voice_not_understood')
  const { workout: w } = ctx
  const nameOf = (index: number) => exerciseName(w.exercises[index].exerciseId, ctx.lang, ctx.customExercises)

  switch (cmd.kind) {
    case 'undo':
      return w.undo ? { type: 'undo', id: w.undo.id, message: { key: 'voice_undone' } } : none('voice_nothing_to_undo')

    case 'skip_rest':
      if (w.restEndsAt == null) return none('voice_no_rest')
      return { type: 'actions', actions: [{ type: 'rest_skip' }], message: { key: 'voice_rest_skipped' } }

    case 'rest': {
      const target = voiceTarget(w.exercises, ctx.focus)
      const seconds = cmd.seconds ?? (target ? w.exercises[target.index].restS : null) ?? ctx.defaultRestS
      if (!(seconds > 0)) return none('voice_missing')
      return {
        type: 'actions',
        actions: [{ type: 'rest_start', seconds, now: ctx.now }],
        message: { key: 'voice_rest_started', vars: { time: formatClock(seconds) } },
      }
    }

    case 'next_exercise': {
      const current = voiceTarget(w.exercises, ctx.focus)?.index ?? ctx.focus
      const next = current + 1
      if (next >= w.exercises.length) return none('voice_no_next')
      return { type: 'focus', focusId: w.exercises[next].exerciseId, scrollTo: next, message: { key: 'voice_next_exercise', vars: { exercise: nameOf(next) } } }
    }

    case 'add_exercise': {
      const id = findExercise(cmd.query, ctx.lang, ctx.customExercises, ctx.history)
      if (!id) return none('voice_no_exercise', { name: cmd.query })
      const index = w.exercises.length
      return {
        type: 'actions',
        actions: [{ type: 'add_exercises', exerciseIds: [id], history: ctx.history, suggest: ctx.suggest }],
        message: { key: 'voice_exercise_added', vars: { exercise: exerciseName(id, ctx.lang, ctx.customExercises) } },
        focusId: id, scrollTo: index,
      }
    }

    case 'add_set': {
      const target = voiceTarget(w.exercises, ctx.focus)
      // Ohne offenen Satz: an die Übung, an der zuletzt gearbeitet wurde
      const index = target?.index ?? Math.min(Math.max(ctx.focus, lastWorkedIndex(w)), w.exercises.length - 1)
      if (index < 0 || !w.exercises[index]) return none('voice_no_open_set')
      return {
        type: 'actions',
        actions: [{ type: 'add_set', index }],
        message: { key: 'voice_set_added', vars: { exercise: nameOf(index), n: w.exercises[index].sets.length + 1 } },
        focusId: w.exercises[index].exerciseId,
      }
    }

    case 'same':
    case 'set': {
      const target = voiceTarget(w.exercises, ctx.focus)
      if (!target) return none('voice_no_open_set')
      const exercise = w.exercises[target.index]
      const current = exercise.sets[target.setIndex]
      const tracking = exerciseTracking(exercise.exerciseId, ctx.customExercises) ?? 'weight_reps'
      let patch: Partial<TrainingSet>
      if (cmd.kind === 'same') {
        const source = lastDoneBefore(exercise, target.setIndex)
        if (!source) return none('voice_nothing_to_repeat')
        patch = { weightKg: source.weightKg ?? null, reps: source.reps ?? null, durationS: source.durationS ?? null, distanceM: source.distanceM ?? null }
      } else {
        const planned = planSet(cmd, tracking, current, ctx.unit)
        if (!planned.ok) return none(planned.reason === 'missing' ? 'voice_missing' : 'voice_implausible')
        patch = planned.patch
      }
      const value = setValueLabel({ ...current, ...patch }, tracking, ctx.unit, ctx.locale)
      return {
        type: 'actions',
        actions: [
          { type: 'update_set', index: target.index, setIndex: target.setIndex, patch },
          { type: 'toggle_done', index: target.index, setIndex: target.setIndex, defaultRestS: ctx.defaultRestS, now: ctx.now },
        ],
        message: { key: 'voice_set_done', vars: { exercise: nameOf(target.index), n: target.setIndex + 1, value } },
        focusId: exercise.exerciseId,
      }
    }
  }
}

/** Die letzte Übung mit einem abgehakten Satz (sonst die letzte überhaupt). */
function lastWorkedIndex(w: ActiveWorkout): number {
  for (let i = w.exercises.length - 1; i >= 0; i--) if (w.exercises[i].sets.some(s => s.done)) return i
  return w.exercises.length - 1
}
