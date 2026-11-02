import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import type { TrainingSession, TrainingSet } from '../../types'
import { useTrainingText } from '../../i18n'
import type { ActiveWorkout, WorkoutAction } from '../../lib/activeWorkout'
import { afterToggleDone, continuesSuperset, finishWorkout, nextOpenSet, supersetPartnerIndex } from '../../lib/activeWorkout'
import { exerciseInfo, exerciseName, exerciseTracking } from '../../lib/exerciseLookup'
import { formatClock } from '../../lib/format'
import { prefersReducedMotion } from '../../lib/motion'
import { applyRoutineDiff, type RoutineDiff } from '../../lib/routineDiff'
import { previousSets } from '../../lib/stats'
import { buildSuggestFn, routineTemplateFor } from '../../lib/suggest'
import type { TrainingData } from '../../hooks/useTrainingData'
import { ExercisePicker } from '../ExercisePicker'
import { Button, TRAINING_ACCENT } from '../ui'
import { ExerciseBlock } from './ExerciseBlock'
import { FinishSheet } from './FinishSheet'
import { describeNextSet } from './nextSet'
import { RestTimer } from './RestTimer'

/**
 * Das laufende Training im Vollbild. Oben Titel, Dauer und der Hinweis, dass
 * jeder Satz schon auf dem Geraet liegt; darunter die Uebungen mit Vorschlag
 * und Ring am naechsten Satz; unten der Pausen-Timer — der Daumen bleibt im
 * unteren Drittel. Entfernen (Satz, Uebung) laesst sich im Toast rueckgaengig
 * machen; im Supersatz springt die Ansicht nach dem Haken zur Partneruebung.
 */
export function LiveWorkout({ workout, dispatch, data, onMinimize, onDiscard, onSaved }: {
  workout: ActiveWorkout
  dispatch: (action: WorkoutAction) => void
  data: TrainingData
  onMinimize: () => void
  onDiscard: () => void
  onSaved: (session: TrainingSession) => void
}) {
  const { tt, lang, locale } = useTrainingText()
  const [picker, setPicker] = useState(false)
  // Index der Uebung, die getauscht wird (Einzelauswahl in der Uebungsliste).
  const [replacing, setReplacing] = useState<number | null>(null)
  const [finishing, setFinishing] = useState(false)
  const mainRef = useRef<HTMLElement>(null)

  // Beim Bearbeiten ist „Vorher" das Training davor, nicht das bearbeitete selbst.
  const history = useMemo(
    () => data.sessions.filter(s => s.id !== workout.sessionId),
    [data.sessions, workout.sessionId],
  )
  const nameOf = useCallback((id: string) => exerciseName(id, lang, data.customExercises), [lang, data.customExercises])
  const trackingOf = useCallback((id: string) => exerciseTracking(id, data.customExercises), [data.customExercises])
  const editing = workout.sessionId != null
  const routine = useMemo(
    () => (workout.routineId ? data.routines.find(r => r.id === workout.routineId) ?? null : null),
    [data.routines, workout.routineId],
  )
  // „Vorher" je Uebung einmal aus dem Verlauf holen, nicht bei jeder Satzeingabe neu.
  const exerciseKey = workout.exercises.map(ex => ex.exerciseId).join('|')
  const previousById = useMemo(() => {
    const map = new Map<string, TrainingSet[]>()
    for (const id of exerciseKey ? exerciseKey.split('|') : []) {
      if (!map.has(id)) map.set(id, previousSets(history, id, editing ? workout.startedAt : undefined))
    }
    return map
  }, [history, exerciseKey, editing, workout.startedAt])

  const suggest = useMemo(
    () => buildSuggestFn({ history, unit: data.settings.unit, customExercises: data.customExercises, beforeIso: editing ? workout.startedAt : undefined }),
    [history, data.settings.unit, data.customExercises, editing, workout.startedAt],
  )
  // Vorschlag je Uebung — haengt nur an Kennungen, Vorlage und Verlauf, nicht an jeder Eingabe.
  const suggestions = useMemo(() => {
    const ids = exerciseKey ? exerciseKey.split('|') : []
    return ids.map((id, index) => suggest(id, routineTemplateFor(ids, routine, index)))
  }, [suggest, routine, exerciseKey])

  const next = nextOpenSet(workout)
  const nextInfo = describeNextSet(workout, lang, locale, data.settings.unit, data.customExercises)

  // Der Toast zeigt den Text der Bedienung (Satz/Uebung entfernt, Uebung getauscht); die
  // Kennung des Schnappschusses kommt aus dem Zustand, sobald der Reducer ihn gesetzt hat.
  const undoTextRef = useRef<string | null>(null)
  // Ein Schnappschuss, der beim Oeffnen schon da ist (minimiert, Neustart), bekommt keinen Toast.
  const shownUndoRef = useRef<number | null>(workout.undo?.id ?? null)
  const undoId = workout.undo?.id ?? null
  useEffect(() => {
    if (undoId == null || shownUndoRef.current === undoId) return
    shownUndoRef.current = undoId
    const text = undoTextRef.current ?? tt(workout.undo?.label === 'set' ? 'set_removed' : 'exercise_removed')
    undoTextRef.current = null
    toast(t => (
      <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ flex: 1, fontWeight: 700 }}>{text}</span>
        <button
          type="button"
          className="tyd-train-press"
          onClick={() => { dispatch({ type: 'undo', id: undoId }); toast.dismiss(t.id) }}
          style={{ minHeight: 36, padding: '0 8px', borderRadius: 10, fontWeight: 800, color: TRAINING_ACCENT }}
        >
          {tt('undo')}
        </button>
      </span>
    ), { id: 'training-undo', duration: 5000 })
  }, [undoId, workout.undo?.label, dispatch, tt])

  const withUndoToast = (text: string, action: WorkoutAction) => {
    undoTextRef.current = text
    dispatch(action)
  }

  const toggleDone = (index: number, setIndex: number, now: number) => {
    // Dieselbe Regel wie im Reducer: nur wenn der Haken die Runde im Supersatz fortsetzt, springt die Ansicht.
    const follow = afterToggleDone(workout, index, setIndex)
    dispatch({ type: 'toggle_done', index, setIndex, defaultRestS: data.settings.defaultRestS, now })
    if (follow !== 'partner') return
    const partner = supersetPartnerIndex(workout, index)
    if (partner == null) return
    requestAnimationFrame(() => {
      const target = mainRef.current?.querySelector<HTMLElement>(`[data-exercise-index="${partner}"]`)
      target?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
    })
  }

  const save = async (rpe: number | null, diff: RoutineDiff | null) => {
    const previous = workout.sessionId ? data.sessions.find(s => s.id === workout.sessionId) ?? null : null
    let saved: TrainingSession
    try {
      saved = await data.saveSession(finishWorkout(workout, { now: new Date(), rpe, previous }))
    } catch {
      toast.error(tt('save_error'))
      return
    }
    // Die Einheit ist gesichert; die Routine nachzuziehen darf scheitern, ohne das zu gefaehrden.
    if (diff && routine) {
      try {
        await data.saveRoutine(applyRoutineDiff(routine, diff))
        toast.success(tt('saved_routine_updated'))
      } catch {
        toast.error(tt('routine_update_error'))
      }
    } else {
      toast.success(tt('saved'))
    }
    onSaved(saved)
  }

  return createPortal(
    <div
      data-app-modal
      role="dialog"
      aria-modal="true"
      aria-label={workout.title || tt('workout')}
      // Vollbild auf reinem Schwarz wie die Seiten der App
      className="lg-backdrop"
      style={{
        position: 'fixed', inset: 0, zIndex: 85, color: 'var(--lg-text)',
        display: 'flex', flexDirection: 'column', height: '100dvh',
      }}
    >
      <header
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: 'calc(8px + env(safe-area-inset-top, 0px)) calc(12px + env(safe-area-inset-right, 0px)) 8px calc(12px + env(safe-area-inset-left, 0px))',
          borderBottom: '0.5px solid var(--lg-separator)',
        }}
      >
        <button
          type="button"
          onClick={onMinimize}
          aria-label={tt('back')}
          className="lg-glass lg-icon-btn lg-press"
          style={{ flexShrink: 0 }}
        >
          <ChevronDown size={22} aria-hidden="true" />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            value={workout.title}
            onChange={e => dispatch({ type: 'title', title: e.target.value })}
            placeholder={tt('workout_title_placeholder')}
            aria-label={tt('workout_title_placeholder')}
            maxLength={80}
            className="tyd-train-input rounded-md"
            style={{ width: '100%', background: 'transparent', border: 'none', color: 'var(--lg-text)', fontSize: 17, fontWeight: 600, padding: 0 }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: '0.75rem', fontVariantNumeric: 'tabular-nums', minWidth: 0 }}>
            {!editing && <ElapsedClock startedAt={workout.startedAt} />}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--lg-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              <Check size={12} strokeWidth={3} aria-hidden="true" style={{ color: '#10b981', flexShrink: 0 }} />
              {tt('saved_on_device')}
            </span>
          </div>
        </div>
        <Button onClick={() => setFinishing(true)} style={{ minHeight: 44, flexShrink: 0 }}>
          {editing ? tt('save') : tt('finish')}
        </Button>
      </header>

      <main ref={mainRef} style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: '12px 10px 24px' }}>
        <div style={{ maxWidth: 640, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {workout.exercises.length === 0 && (
            <p style={{ textAlign: 'center', fontSize: 15, color: 'var(--lg-text-3)', padding: '32px 16px 8px' }}>{tt('empty_workout_hint')}</p>
          )}
          {workout.exercises.map((exercise, index) => (
            <ExerciseBlock
              key={`${exercise.exerciseId}-${index}`}
              exercise={exercise}
              info={exerciseInfo(exercise.exerciseId, lang, data.customExercises)}
              index={index}
              total={workout.exercises.length}
              previous={previousById.get(exercise.exerciseId) ?? []}
              settings={data.settings}
              suggestion={suggestions[index] ?? null}
              nextSetIndex={next?.index === index ? next.setIndex : null}
              supersetNext={continuesSuperset(workout.exercises, index)}
              onSetChange={(setIndex, patch) => dispatch({ type: 'update_set', index, setIndex, patch })}
              onCycleType={(setIndex, type) => dispatch({ type: 'update_set', index, setIndex, patch: { type } })}
              onToggleDone={setIndex => toggleDone(index, setIndex, Date.now())}
              onRemoveSet={setIndex => withUndoToast(tt('set_removed'), { type: 'remove_set', index, setIndex })}
              onAddSet={() => dispatch({ type: 'add_set', index })}
              onRemove={() => withUndoToast(tt('exercise_removed'), { type: 'remove_exercise', index })}
              onReplace={() => setReplacing(index)}
              onMove={delta => dispatch({ type: 'move_exercise', index, delta })}
              onToggleSuperset={() => dispatch({ type: 'toggle_superset', index })}
              onRest={restS => dispatch({ type: 'exercise_rest', index, restS })}
              onNotes={notes => dispatch({ type: 'exercise_notes', index, notes })}
              onApplySuggestion={sets => dispatch({ type: 'apply_suggestion', index, sets })}
            />
          ))}

          <Button tone="ghost" block onClick={() => setPicker(true)} style={{ minHeight: 50 }}>
            <Plus size={18} aria-hidden="true" /> {tt('add_exercise')}
          </Button>
          <Button
            tone="danger"
            block
            onClick={() => { if (editing || window.confirm(tt('discard_confirm'))) onDiscard() }}
            style={{ marginTop: 12 }}
          >
            {editing ? tt('cancel') : tt('discard')}
          </Button>
        </div>
      </main>

      {workout.restEndsAt != null && (
        <div
          className="tyd-train-pop"
          style={{
            padding: '8px calc(10px + env(safe-area-inset-right, 0px)) calc(8px + env(safe-area-inset-bottom, 0px)) calc(10px + env(safe-area-inset-left, 0px))',
            borderTop: '0.5px solid var(--lg-separator)', background: 'var(--lg-sheet-solid)',
          }}
        >
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <RestTimer
              endsAt={workout.restEndsAt}
              totalS={workout.restTotalS ?? 0}
              next={nextInfo}
              sound={data.settings.restSound}
              notify={data.settings.restNotify}
              onAdjust={deltaS => dispatch({ type: 'rest_adjust', deltaS, now: Date.now() })}
              onSkip={() => dispatch({ type: 'rest_skip' })}
            />
          </div>
        </div>
      )}

      {picker && (
        <ExercisePicker
          sessions={data.sessions}
          customExercises={data.customExercises}
          favorites={data.settings.favoriteExercises}
          onToggleFavorite={data.toggleFavorite}
          onAddCustom={data.addCustomExercise}
          onClose={() => setPicker(false)}
          onPick={ids => {
            dispatch({ type: 'add_exercises', exerciseIds: ids, history, suggest })
            setPicker(false)
          }}
        />
      )}

      {replacing != null && (
        <ExercisePicker
          sessions={data.sessions}
          customExercises={data.customExercises}
          favorites={data.settings.favoriteExercises}
          onToggleFavorite={data.toggleFavorite}
          onAddCustom={data.addCustomExercise}
          multiple={false}
          onClose={() => setReplacing(null)}
          onPick={ids => {
            if (ids[0]) withUndoToast(tt('exercise_replaced'), { type: 'replace_exercise', index: replacing, exerciseId: ids[0], history, suggest })
            setReplacing(null)
          }}
        />
      )}

      {finishing && (
        <FinishSheet
          workout={workout}
          history={data.sessions}
          routine={routine}
          settings={data.settings}
          nameOf={nameOf}
          trackingOf={trackingOf}
          onClose={() => setFinishing(false)}
          onSave={save}
        />
      )}
    </div>,
    document.body,
  )
}

/**
 * Laufende Dauer im Kopf. Eigene Komponente, damit der Sekundentakt nur diese
 * Zeile neu zeichnet und nicht alle Uebungen samt Saetzen.
 */
function ElapsedClock({ startedAt }: { startedAt: string }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  return (
    <span style={{ fontSize: 13, color: TRAINING_ACCENT, fontWeight: 600, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
      {formatClock(Math.max(0, (now - Date.parse(startedAt)) / 1000))}
    </span>
  )
}
