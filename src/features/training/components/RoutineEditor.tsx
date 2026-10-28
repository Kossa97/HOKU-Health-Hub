import { useState } from 'react'
import { ArrowDown, ArrowUp, Minus, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import type { RoutineExercise, SessionKind, TrainingRoutine } from '../types'
import { useTrainingText, type TrainingTextKey } from '../i18n'
import type { TrainingData } from '../hooks/useTrainingData'
import { exerciseName } from '../lib/exerciseLookup'
import { ExercisePicker } from './ExercisePicker'
import { Button, Chip, Field, TrainingSheet, inputStyle } from './ui'

/**
 * Routine anlegen oder bearbeiten: Name, Wochentage, Uebungen mit Satzzahl.
 * Gewichte stehen hier nicht — der Logger nimmt die vom letzten Mal.
 */
export function RoutineEditor({ routine, data, onClose }: {
  routine: (Omit<TrainingRoutine, 'id'> & { id?: string }) | null
  data: TrainingData
  onClose: () => void
}) {
  const { tt, lang } = useTrainingText()
  const [name, setName] = useState(routine?.name ?? '')
  const [kind] = useState<SessionKind>(routine?.kind ?? 'strength')
  const [weekdays, setWeekdays] = useState<number[]>(routine?.weekdays ?? [])
  const [exercises, setExercises] = useState<RoutineExercise[]>(routine?.exercises ?? [])
  const [picker, setPicker] = useState(false)
  const [busy, setBusy] = useState(false)

  const setCount = (index: number, delta: number) => setExercises(prev => prev.map((ex, i) => {
    if (i !== index) return ex
    const count = Math.min(20, Math.max(1, ex.sets.length + delta))
    const sets = count > ex.sets.length
      ? [...ex.sets, ...Array.from({ length: count - ex.sets.length }, () => ({ ...(ex.sets[ex.sets.length - 1] ?? { type: 'normal' as const }) }))]
      : ex.sets.slice(0, count)
    return { ...ex, sets }
  }))

  const move = (index: number, delta: -1 | 1) => setExercises(prev => {
    const target = index + delta
    if (target < 0 || target >= prev.length) return prev
    const next = [...prev]
    ;[next[index], next[target]] = [next[target], next[index]]
    return next
  })

  const save = async () => {
    if (!name.trim()) { toast.error(tt('routine_name_required')); return }
    setBusy(true)
    try {
      await data.saveRoutine({
        ...(routine?.id ? { id: routine.id } : {}),
        name: name.trim(),
        kind,
        weekdays,
        exercises,
        sortOrder: routine?.sortOrder ?? data.routines.length,
        folder: routine?.folder ?? null,
      })
      toast.success(tt('saved'))
      onClose()
    } catch {
      toast.error(tt('save_error'))
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!routine?.id || !window.confirm(tt('routine_delete_confirm', { name: routine.name }))) return
    setBusy(true)
    try { await data.removeRoutine(routine.id); onClose() } catch { toast.error(tt('delete_error')); setBusy(false) }
  }

  if (picker) {
    return (
      <ExercisePicker
        sessions={data.sessions}
        customExercises={data.customExercises}
        onAddCustom={data.addCustomExercise}
        onClose={() => setPicker(false)}
        onPick={ids => {
          setExercises(prev => [...prev, ...ids.map(id => ({ exerciseId: id, sets: [{ type: 'normal' as const }, { type: 'normal' as const }, { type: 'normal' as const }] }))])
          setPicker(false)
        }}
      />
    )
  }

  return (
    <TrainingSheet
      title={routine?.id ? tt('routine_title_edit') : tt('routine_title_new')}
      onClose={onClose}
      busy={busy}
      tall
      footer={
        <div style={{ display: 'flex', gap: 8 }}>
          {routine?.id && <Button tone="danger" disabled={busy} onClick={remove} aria-label={tt('delete')}><Trash2 size={18} aria-hidden="true" /></Button>}
          <Button block disabled={busy} onClick={save}>{busy ? tt('saving') : tt('save')}</Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <Field label={tt('routine_name')}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder={tt('routine_name_placeholder')} maxLength={60} style={inputStyle} />
        </Field>
        <Field group label={tt('routine_days')} hint={tt('routine_days_hint')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[1, 2, 3, 4, 5, 6, 7].map(day => (
              <Chip
                key={day}
                active={weekdays.includes(day)}
                onClick={() => setWeekdays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort())}
              >
                {tt(`weekday_${day}` as TrainingTextKey)}
              </Chip>
            ))}
          </div>
        </Field>

        <div>
          {exercises.length === 0 && <p style={{ color: 'var(--text-dim)', padding: '8px 0' }}>{tt('routine_no_exercises')}</p>}
          <ul style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {exercises.map((ex, index) => (
              <li key={`${ex.exerciseId}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 10, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 750, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exerciseName(ex.exerciseId, lang, data.customExercises)}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
                    <IconButton label={`${tt('routine_sets')} −`} onClick={() => setCount(index, -1)}><Minus size={16} /></IconButton>
                    <span style={{ minWidth: 64, textAlign: 'center', fontSize: '0.85rem', fontWeight: 700 }}>{tt('sets_count', { count: ex.sets.length })}</span>
                    <IconButton label={`${tt('routine_sets')} +`} onClick={() => setCount(index, 1)}><Plus size={16} /></IconButton>
                  </div>
                </div>
                <IconButton label={tt('move_up')} onClick={() => move(index, -1)}><ArrowUp size={18} /></IconButton>
                <IconButton label={tt('move_down')} onClick={() => move(index, 1)}><ArrowDown size={18} /></IconButton>
                <IconButton label={tt('remove_exercise')} onClick={() => setExercises(prev => prev.filter((_, i) => i !== index))}><Trash2 size={18} /></IconButton>
              </li>
            ))}
          </ul>
          <div style={{ marginTop: 10 }}>
            <Button tone="ghost" block onClick={() => setPicker(true)}><Plus size={18} aria-hidden="true" /> {tt('add_exercise')}</Button>
          </div>
        </div>
      </div>
    </TrainingSheet>
  )
}

function IconButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="tyd-train-press"
      style={{ width: 40, height: 40, borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-raised)', color: 'var(--text-dim)', flexShrink: 0 }}
    >
      {children}
    </button>
  )
}
