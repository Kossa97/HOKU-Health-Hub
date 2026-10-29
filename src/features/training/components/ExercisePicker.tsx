import { useMemo, useState } from 'react'
import { Check, Plus, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import type { CustomExercise, ExerciseCategory, MuscleGroup, TrackingMode, TrainingSession } from '../types'
import { useTrainingText, type TrainingTextKey } from '../i18n'
import { allExercises, matchesSearch, type ExerciseInfo } from '../lib/exerciseLookup'
import { Button, Chip, Field, TrainingSheet, inputStyle } from './ui'

/**
 * Uebung waehlen — Suche ueber Deutsch, Englisch und die Schreibweisen aus
 * Hevy/Strong, Filter nach Muskel, zuletzt benutzte oben. Mehrfachauswahl wie
 * bei Hevy: mehrere antippen, einmal hinzufuegen.
 */

const MUSCLE_FILTERS: MuscleGroup[] = [
  'chest', 'upper_back', 'lats', 'front_delts', 'side_delts', 'rear_delts', 'biceps', 'triceps',
  'abs', 'glutes', 'quads', 'hamstrings', 'calves', 'cardio', 'full_body',
]

const TRACKINGS: TrackingMode[] = ['weight_reps', 'bodyweight_reps', 'reps', 'duration', 'distance_duration', 'weight_distance']
const CATEGORIES: ExerciseCategory[] = ['strength', 'cardio', 'hyrox', 'mobility', 'plyometric']

type Filter = 'all' | 'recent' | 'custom' | MuscleGroup

export function ExercisePicker({ sessions, customExercises, onAddCustom, onPick, onClose, multiple = true }: {
  sessions: readonly TrainingSession[]
  customExercises: readonly CustomExercise[]
  onAddCustom: (exercise: Omit<CustomExercise, 'id'>) => Promise<CustomExercise>
  onPick: (exerciseIds: string[]) => void
  onClose: () => void
  multiple?: boolean
}) {
  const { tt, lang } = useTrainingText()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [selected, setSelected] = useState<string[]>([])
  const [creating, setCreating] = useState(false)

  const all = useMemo(() => allExercises(lang, customExercises), [lang, customExercises])

  const recentIds = useMemo(() => {
    const seen: string[] = []
    for (const session of sessions) {
      for (const ex of session.exercises) if (!seen.includes(ex.exerciseId)) seen.push(ex.exerciseId)
      if (seen.length >= 30) break
    }
    return seen
  }, [sessions])

  const visible = useMemo(() => {
    let list: ExerciseInfo[]
    if (filter === 'recent') list = recentIds.map(id => all.find(ex => ex.id === id)).filter((ex): ex is ExerciseInfo => !!ex)
    else if (filter === 'custom') list = all.filter(ex => ex.custom)
    else if (filter === 'all') list = all
    else list = all.filter(ex => ex.primary.includes(filter))
    return list.filter(ex => matchesSearch(ex.id, query, lang, customExercises))
  }, [all, filter, recentIds, query, lang, customExercises])

  const toggle = (id: string) => {
    if (!multiple) { onPick([id]); return }
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  if (creating) {
    return (
      <CustomExerciseForm
        initialName={query}
        onCancel={() => setCreating(false)}
        onSave={async exercise => {
          const saved = await onAddCustom(exercise)
          setCreating(false)
          const id = `custom:${saved.id}`
          if (multiple) setSelected(prev => [...prev, id])
          else onPick([id])
        }}
      />
    )
  }

  return (
    <TrainingSheet
      title={tt('picker_title')}
      onClose={onClose}
      tall
      footer={multiple ? (
        <Button block disabled={selected.length === 0} onClick={() => onPick(selected)}>
          {tt('picker_add_n', { count: selected.length })}
        </Button>
      ) : undefined}
    >
      <div style={{ position: 'sticky', top: 0, zIndex: 1, background: 'var(--lg-sheet-solid)', paddingBottom: 8 }}>
        <div style={{ position: 'relative' }}>
          <Search size={18} aria-hidden="true" style={{ position: 'absolute', left: 12, top: 13, color: 'var(--lg-text-3)' }} />
          <input
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder={tt('picker_search')}
            aria-label={tt('picker_search')}
            enterKeyHint="search"
            autoComplete="off"
            style={{ ...inputStyle, paddingLeft: 38 }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '10px 0 2px', scrollbarWidth: 'none' }}>
          <Chip active={filter === 'all'} onClick={() => setFilter('all')}>{tt('picker_all')}</Chip>
          {recentIds.length > 0 && <Chip active={filter === 'recent'} onClick={() => setFilter('recent')}>{tt('picker_recent')}</Chip>}
          {customExercises.length > 0 && <Chip active={filter === 'custom'} onClick={() => setFilter('custom')}>{tt('picker_custom')}</Chip>}
          {MUSCLE_FILTERS.map(m => (
            <Chip key={m} active={filter === m} onClick={() => setFilter(m)}>{tt(`muscle_${m}` as TrainingTextKey)}</Chip>
          ))}
        </div>
      </div>

      <ul style={{ display: 'flex', flexDirection: 'column' }}>
        {visible.map(ex => {
          const isSelected = selected.includes(ex.id)
          return (
            <li key={ex.id}>
              <button
                type="button"
                onClick={() => toggle(ex.id)}
                aria-pressed={multiple ? isSelected : undefined}
                className="tyd-train-press"
                style={{
                  width: '100%', minHeight: 56, display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 4px', textAlign: 'left', borderBottom: '0.5px solid var(--lg-separator)',
                }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 17, fontWeight: 400, color: 'var(--lg-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.name}</span>
                  <span style={{ display: 'block', fontSize: 13, color: 'var(--lg-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {[...ex.primary.slice(0, 2).map(m => tt(`muscle_${m}` as TrainingTextKey)), tt(`eq_${ex.equipment}` as TrainingTextKey)].join(' · ')}
                  </span>
                </span>
                {multiple && (
                  <span
                    aria-hidden="true"
                    style={{
                      // Auswahlkreis wie in iOS-Listen
                      width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      background: isSelected ? 'var(--lg-accent)' : 'transparent',
                      boxShadow: isSelected ? undefined : 'inset 0 0 0 1.5px var(--lg-text-3)',
                      color: 'var(--accent-contrast)',
                    }}
                  >
                    {isSelected && <Check size={16} strokeWidth={3} />}
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      {visible.length === 0 && (
        <p style={{ padding: '24px 4px', fontSize: 15, color: 'var(--lg-text-3)', textAlign: 'center' }}>{tt('picker_none')}</p>
      )}
      <div style={{ paddingTop: 14 }}>
        <Button tone="ghost" block onClick={() => setCreating(true)}>
          <Plus size={18} aria-hidden="true" /> {tt('picker_create')}
        </Button>
      </div>
    </TrainingSheet>
  )
}

function CustomExerciseForm({ initialName, onSave, onCancel }: {
  initialName: string
  onSave: (exercise: Omit<CustomExercise, 'id'>) => Promise<void>
  onCancel: () => void
}) {
  const { tt } = useTrainingText()
  const [name, setName] = useState(initialName)
  const [tracking, setTracking] = useState<TrackingMode>('weight_reps')
  const [category, setCategory] = useState<ExerciseCategory>('strength')
  const [muscle, setMuscle] = useState<MuscleGroup>('chest')
  const [busy, setBusy] = useState(false)

  const save = async () => {
    if (!name.trim()) return
    setBusy(true)
    try {
      await onSave({ name: name.trim(), tracking, category, equipment: 'other', primary: [muscle], secondary: [] })
    } catch {
      toast.error(tt('save_error'))
      setBusy(false)
    }
  }

  return (
    <TrainingSheet
      title={tt('picker_create')}
      onClose={onCancel}
      busy={busy}
      tall
      footer={<Button block disabled={busy || !name.trim()} onClick={save}>{busy ? tt('saving') : tt('save')}</Button>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field label={tt('custom_name')}>
          <input value={name} onChange={e => setName(e.target.value)} maxLength={80} autoFocus style={inputStyle} />
        </Field>
        <Field group label={tt('custom_tracking')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {TRACKINGS.map(t => (
              <Chip key={t} active={tracking === t} onClick={() => setTracking(t)}>{tt(`tracking_${t}` as TrainingTextKey)}</Chip>
            ))}
          </div>
        </Field>
        <Field group label={tt('custom_category')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {CATEGORIES.map(c => (
              <Chip key={c} active={category === c} onClick={() => setCategory(c)}>{tt(`cat_${c}` as TrainingTextKey)}</Chip>
            ))}
          </div>
        </Field>
        <Field group label={tt('custom_muscle')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {MUSCLE_FILTERS.map(m => (
              <Chip key={m} active={muscle === m} onClick={() => setMuscle(m)}>{tt(`muscle_${m}` as TrainingTextKey)}</Chip>
            ))}
          </div>
        </Field>
      </div>
    </TrainingSheet>
  )
}
