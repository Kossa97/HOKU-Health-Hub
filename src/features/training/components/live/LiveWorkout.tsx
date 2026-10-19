import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import type { TrainingSession, TrainingSet } from '../../types'
import { useTrainingText } from '../../i18n'
import type { ActiveWorkout, WorkoutAction } from '../../lib/activeWorkout'
import { finishWorkout } from '../../lib/activeWorkout'
import { exerciseInfo, exerciseName, exerciseTracking } from '../../lib/exerciseLookup'
import { formatClock } from '../../lib/format'
import { previousSets } from '../../lib/stats'
import type { TrainingData } from '../../hooks/useTrainingData'
import { ExercisePicker } from '../ExercisePicker'
import { Button, TRAINING_ACCENT } from '../ui'
import { ExerciseBlock } from './ExerciseBlock'
import { FinishSheet } from './FinishSheet'
import { RestTimer } from './RestTimer'

/**
 * Das laufende Training im Vollbild. Oben Dauer und „Beenden", darunter die
 * Uebungen, unten der Pausen-Timer — der Daumen bleibt im unteren Drittel.
 */
export function LiveWorkout({ workout, dispatch, data, onMinimize, onDiscard, onSaved }: {
  workout: ActiveWorkout
  dispatch: (action: WorkoutAction) => void
  data: TrainingData
  onMinimize: () => void
  onDiscard: () => void
  onSaved: (session: TrainingSession) => void
}) {
  const { tt, lang } = useTrainingText()
  const [picker, setPicker] = useState(false)
  const [finishing, setFinishing] = useState(false)

  // Beim Bearbeiten ist „Vorher" das Training davor, nicht das bearbeitete selbst.
  const history = useMemo(
    () => data.sessions.filter(s => s.id !== workout.sessionId),
    [data.sessions, workout.sessionId],
  )
  const nameOf = useCallback((id: string) => exerciseName(id, lang, data.customExercises), [lang, data.customExercises])
  const trackingOf = useCallback((id: string) => exerciseTracking(id, data.customExercises), [data.customExercises])
  const editing = workout.sessionId != null
  // „Vorher" je Uebung einmal aus dem Verlauf holen, nicht bei jeder Satzeingabe neu.
  const exerciseKey = workout.exercises.map(ex => ex.exerciseId).join('|')
  const previousById = useMemo(() => {
    const map = new Map<string, TrainingSet[]>()
    for (const id of exerciseKey ? exerciseKey.split('|') : []) {
      if (!map.has(id)) map.set(id, previousSets(history, id, editing ? workout.startedAt : undefined))
    }
    return map
  }, [history, exerciseKey, editing, workout.startedAt])

  const save = async (rpe: number | null) => {
    const previous = workout.sessionId ? data.sessions.find(s => s.id === workout.sessionId) ?? null : null
    try {
      const saved = await data.saveSession(finishWorkout(workout, { now: new Date(), rpe, previous }))
      toast.success(tt('saved'))
      onSaved(saved)
    } catch {
      toast.error(tt('save_error'))
    }
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
          display: 'flex', alignItems: 'center', gap: 10,
          padding: 'calc(8px + env(safe-area-inset-top, 0px)) 12px 8px',
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
          {!editing && <ElapsedClock startedAt={workout.startedAt} />}
        </div>
        <Button onClick={() => setFinishing(true)} style={{ minHeight: 44, flexShrink: 0 }}>
          {editing ? tt('save') : tt('finish')}
        </Button>
      </header>

      <main style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: '12px 10px 24px' }}>
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
              supersetNext={exercise.supersetGroup != null && workout.exercises[index + 1]?.supersetGroup === exercise.supersetGroup}
              onSetChange={(setIndex, patch) => dispatch({ type: 'update_set', index, setIndex, patch })}
              onCycleType={(setIndex, type) => dispatch({ type: 'update_set', index, setIndex, patch: { type } })}
              onToggleDone={setIndex => dispatch({ type: 'toggle_done', index, setIndex, defaultRestS: data.settings.defaultRestS, now: Date.now() })}
              onRemoveSet={setIndex => dispatch({ type: 'remove_set', index, setIndex })}
              onAddSet={() => dispatch({ type: 'add_set', index })}
              onRemove={() => dispatch({ type: 'remove_exercise', index })}
              onMove={delta => dispatch({ type: 'move_exercise', index, delta })}
              onToggleSuperset={() => dispatch({ type: 'toggle_superset', index })}
              onRest={restS => dispatch({ type: 'exercise_rest', index, restS })}
              onNotes={notes => dispatch({ type: 'exercise_notes', index, notes })}
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
        <div style={{ padding: '8px 10px calc(8px + env(safe-area-inset-bottom, 0px))', borderTop: '0.5px solid var(--lg-separator)', background: 'var(--lg-sheet-solid)' }}>
          <div style={{ maxWidth: 640, margin: '0 auto' }}>
            <RestTimer
              endsAt={workout.restEndsAt}
              totalS={workout.restTotalS ?? 0}
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
          onAddCustom={data.addCustomExercise}
          onClose={() => setPicker(false)}
          onPick={ids => {
            dispatch({ type: 'add_exercises', exerciseIds: ids, history })
            setPicker(false)
          }}
        />
      )}

      {finishing && (
        <FinishSheet
          workout={workout}
          history={data.sessions}
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
    <div style={{ fontSize: 13, color: TRAINING_ACCENT, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
      {formatClock(Math.max(0, (now - Date.parse(startedAt)) / 1000))}
    </div>
  )
}
