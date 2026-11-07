import { useMemo, useState } from 'react'
import { ArrowRightLeft, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { ROUTINE_FOLDER_MAX } from '../../types'
import { useTrainingText, type TrainingTextKey } from '../../i18n'
import type { TrainingData } from '../../hooks/useTrainingData'
import { allExercises, exerciseInfo } from '../../lib/exerciseLookup'
import { entwurfZuWorkouts, type HokuPlan } from '../../lib/hokuPlan'
import { ExercisePicker } from '../ExercisePicker'
import { Button, TrainingSheet, inputStyle } from '../ui'

/**
 * Vorschau eines Plans, den Hoku entworfen hat. Noch ist nichts gespeichert:
 * Name ändern, Übungen tauschen oder entfernen, dann „Übernehmen" — erst dann
 * entstehen Plan (mit Zeitplan) und Workouts. Übungen, die die App nicht kennt,
 * sind markiert und müssen getauscht oder entfernt werden.
 */
export function HokuPlanPreview({ data, plan: start, onClose, onSaved, onAskChange }: {
  data: TrainingData
  plan: HokuPlan
  onClose: () => void
  /** Nach dem Speichern, mit dem Namen des neuen Plans. */
  onSaved: (planName: string) => void
  /** Zurück ins Gespräch mit Hoku (nur, wenn es eins gibt). */
  onAskChange?: (plan: HokuPlan) => void
}) {
  const { tt, lang } = useTrainingText()
  const [plan, setPlan] = useState(start)
  const [name, setName] = useState(start.name)
  const [swap, setSwap] = useState<{ w: number; e: number } | null>(null)
  const [busy, setBusy] = useState(false)

  const known = useMemo(() => new Set(allExercises(lang, data.customExercises).map(ex => ex.id)), [lang, data.customExercises])
  const info = (id: string) => exerciseInfo(id, lang, data.customExercises)
  const unknownLeft = plan.workouts.some(w => w.exercises.some(ex => !known.has(ex.id)))
  const empty = plan.workouts.every(w => w.exercises.length === 0)

  const takenNames = useMemo(
    () => new Set([...data.routines.map(r => r.folder).filter((f): f is string => !!f), ...data.plans.map(p => p.name)]),
    [data.routines, data.plans],
  )
  const trimmed = name.trim().slice(0, ROUTINE_FOLDER_MAX)
  const nameTaken = takenNames.has(trimmed)

  const scheduleText = plan.schedule.mode === 'per_week' ? tt('sched_per_week_value', { count: plan.schedule.perWeek })
    : plan.schedule.mode === 'interval' ? tt('sched_interval_value', { count: plan.schedule.everyDays })
    : tt('sched_weekdays')

  const setsText = (ex: HokuPlan['workouts'][number]['exercises'][number]) => {
    const amount = ex.durationS != null ? tt('preview_seconds', { s: ex.durationS })
      : ex.repsMin != null && ex.repsMax != null && ex.repsMin !== ex.repsMax ? `${ex.repsMin}–${ex.repsMax}`
      : ex.repsMin ?? ex.repsMax ?? null
    return amount != null ? `${ex.sets} × ${amount}` : tt('sets_count', { count: ex.sets })
  }

  const replaceExercise = (w: number, e: number, id: string | null) => setPlan(prev => ({
    ...prev,
    workouts: prev.workouts.map((wo, wi) => wi !== w ? wo : {
      ...wo,
      exercises: id == null ? wo.exercises.filter((_, ei) => ei !== e) : wo.exercises.map((ex, ei) => (ei === e ? { ...ex, id } : ex)),
    }),
  }))

  const accept = async () => {
    if (busy || !trimmed || nameTaken || unknownLeft || empty) return
    setBusy(true)
    const order = Math.max(-1, ...data.routines.map(r => r.sortOrder)) + 1
    const workouts = entwurfZuWorkouts(plan, trimmed, order, info, n => tt('routine_default_name', { n }))
    let saved = 0
    try {
      await data.savePlanSchedule(trimmed, plan.schedule)
      for (const w of workouts) { await data.saveRoutine(w); saved++ }
      toast.success(tt('preview_saved', { name: trimmed }))
      onSaved(trimmed)
    } catch {
      toast.error(saved > 0 ? tt('preview_partial') : tt('save_error'))
      if (saved > 0) onSaved(trimmed)
      else setBusy(false)
    }
  }

  if (swap) {
    return (
      <ExercisePicker
        sessions={data.sessions}
        customExercises={data.customExercises}
        favorites={data.settings.favoriteExercises}
        onToggleFavorite={data.toggleFavorite}
        onAddCustom={data.addCustomExercise}
        multiple={false}
        onClose={() => setSwap(null)}
        onPick={ids => { if (ids[0]) replaceExercise(swap.w, swap.e, ids[0]); setSwap(null) }}
      />
    )
  }

  return (
    <TrainingSheet
      title={tt('preview_title')}
      onClose={onClose}
      busy={busy}
      tall
      zIndex={100}
      footer={(
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Button block disabled={busy || !trimmed || nameTaken || unknownLeft || empty} onClick={() => { void accept() }} style={{ minHeight: 52 }}>
            {busy ? tt('preview_saving') : tt('preview_accept')}
          </Button>
          {onAskChange && <Button tone="ghost" block disabled={busy} onClick={() => onAskChange(plan)}>{tt('preview_change')}</Button>}
        </div>
      )}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 8 }}>
        <span style={{ alignSelf: 'flex-start', fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 999, background: 'rgba(255,214,10,0.16)', color: '#ffd60a' }}>
          {tt('preview_unsaved')}
        </span>

        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={groupLabel}>{tt('plan_name')}</span>
          <input value={name} onChange={e => setName(e.target.value)} maxLength={ROUTINE_FOLDER_MAX} style={{ ...inputStyle, fontWeight: 700, fontSize: 17, minHeight: 48 }} />
          {nameTaken && trimmed && <span role="alert" style={{ fontSize: 14, color: 'var(--lg-bad-text)', padding: '0 4px' }}>{tt('plan_name_taken')}</span>}
          <span style={{ fontSize: 14, color: 'var(--lg-text-3)', padding: '0 4px' }}>
            {scheduleText} · {tt('routines_count', { count: plan.workouts.length })}
          </span>
        </label>

        {plan.workouts.map((w, wi) => (
          <section key={wi} aria-label={w.name || tt('routine_default_name', { n: wi + 1 })} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <h3 style={groupLabel}>
              {w.name || tt('routine_default_name', { n: wi + 1 })}
              {plan.schedule.mode === 'weekdays' && w.weekdays.length > 0 && ` · ${w.weekdays.map(d => tt(`weekday_${d}` as TrainingTextKey)).join(', ')}`}
            </h3>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, borderRadius: 14, background: 'var(--lg-surface-2)', border: '1px solid var(--lg-separator)', overflow: 'hidden' }}>
              {w.exercises.map((ex, ei) => {
                const exInfo = known.has(ex.id) ? info(ex.id) : null
                const exName = exInfo?.name ?? ex.id.replace(/_/g, ' ')
                return (
                  <li key={`${ex.id}-${ei}`} style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 56, padding: '6px 4px 6px 14px', borderTop: ei === 0 ? undefined : '0.5px solid var(--lg-separator)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: exInfo ? 'var(--lg-text)' : 'var(--lg-bad-text)' }}>{exName}</div>
                      <div style={{ fontSize: 13, color: exInfo ? 'var(--lg-text-3)' : 'var(--lg-bad-text)' }}>
                        {exInfo ? setsText(ex) : tt('preview_unknown')}
                      </div>
                    </div>
                    <button type="button" onClick={() => setSwap({ w: wi, e: ei })} aria-label={tt('preview_swap', { name: exName })} className="tyd-train-press" style={iconButton}>
                      <ArrowRightLeft size={18} aria-hidden="true" />
                    </button>
                    {!exInfo && (
                      <button type="button" onClick={() => replaceExercise(wi, ei, null)} aria-label={tt('preview_remove', { name: exName })} className="tyd-train-press" style={{ ...iconButton, color: 'var(--lg-bad-text)' }}>
                        <Trash2 size={18} aria-hidden="true" />
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}

        <p style={{ margin: 0, padding: '0 4px', fontSize: 13, lineHeight: 1.4, color: 'var(--lg-text-3)' }}>{tt('preview_note')}</p>
      </div>
    </TrainingSheet>
  )
}

const groupLabel = { margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--lg-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '0 4px' } as const
const iconButton = { width: 44, height: 44, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)' } as const
