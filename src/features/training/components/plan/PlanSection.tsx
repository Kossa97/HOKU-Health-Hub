import { useCallback, useMemo, useState } from 'react'
import { Moon, Pencil, Play, Plus, Timer } from 'lucide-react'
import toast from 'react-hot-toast'
import type { TrainingRoutine } from '../../types'
import { useTrainingText, type TrainingTextKey } from '../../i18n'
import type { TrainingData } from '../../hooks/useTrainingData'
import { exerciseInfo } from '../../lib/exerciseLookup'
import { formatDate, formatNumber } from '../../lib/format'
import { groupByFolder, type NextInPlan } from '../../lib/planRotation'
import { sortedMuscles } from '../../lib/muscleVolume'
import { setsPerMuscle, startOfWeek } from '../../lib/stats'
import { createPlanRoutines, TRAINING_PLANS, type TrainingPlan } from '../../data/plans'
import { HYROX_DIVISIONS, hyroxRoutine, type HyroxDivisionId } from '../../data/hyrox'
import { Button, Card, Chip, SectionTitle, TrainingSheet, TRAINING_ACCENT } from '../ui'
import { trainingTint } from '../accent'
import { BandLegend, MuscleBars } from './MuscleVolume'

/**
 * Der Plan-Teil von „Heute": die Routinen nach Ordner, Vorlagen zum Anlegen
 * eines ganzen Plans. Die Routine, die heute geplant oder in der Rotation
 * als Naechstes dran ist, steht oben in ihrem Ordner, hervorgehoben und mit
 * grossem Start-Knopf. Ohne Routinen stehen die Vorlagen gross im Bild,
 * sonst als Chip-Zeile.
 */

const DAY_MS = 24 * 60 * 60 * 1000

export function PlanSection({ data, next, restDay, now, onStartRoutine, onEditRoutine }: {
  data: TrainingData
  /** Heute geplant oder als Naechstes in der Rotation (`nextInPlan`). */
  next: NextInPlan | null
  /** Heute ist laut Plan frei: die naechste Routine steht ruhiger da. */
  restDay: boolean
  now: Date
  onStartRoutine: (routine: TrainingRoutine) => void
  onEditRoutine: (routine: (Omit<TrainingRoutine, 'id'> & { id?: string }) | null) => void
}) {
  const { tt, lang, locale } = useTrainingText()
  const [template, setTemplate] = useState<TrainingPlan | null>(null)
  const [hyroxPick, setHyroxPick] = useState(false)
  const [busy, setBusy] = useState(false)

  // Die hervorgehobene Routine nach oben in ihrem Ordner.
  const groups = useMemo(() => groupByFolder(data.routines).map(group => ({
    ...group,
    routines: [...group.routines].sort((a, b) => Number(b.id === next?.routine.id) - Number(a.id === next?.routine.id)),
  })), [data.routines, next])

  // „zuletzt Freitag" fuer die letzten sechs Tage, davor mit Datum.
  const lastLabel = (iso: string | null) => {
    if (!iso) return tt('plan_never')
    const ageDays = (now.getTime() - Date.parse(iso)) / DAY_MS
    const day = ageDays < 6
      ? new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(new Date(iso))
      : formatDate(iso, locale)
    return tt('plan_last', { day })
  }

  const weekdayList = (days: number[]) => days.map(d => tt(`weekday_${d}` as TrainingTextKey)).join(', ')

  const createPlan = async () => {
    if (!template) return
    setBusy(true)
    try {
      for (const routine of createPlanRoutines(template, lang, data.routines.length)) await data.saveRoutine(routine)
      toast.success(tt('plan_created'))
      setTemplate(null)
    } catch {
      toast.error(tt('save_error'))
    } finally {
      setBusy(false)
    }
  }

  const newRoutineAction = (
    <button type="button" onClick={() => onEditRoutine(null)} className="tyd-train-press" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 36, color: TRAINING_ACCENT, fontWeight: 500, fontSize: 15 }}>
      <Plus size={16} aria-hidden="true" /> {tt('new_routine')}
    </button>
  )

  const hyroxLabel = <><Timer size={14} aria-hidden="true" /> {tt('hyrox_template')}</>

  return (
    <>
      <section>
        <SectionTitle action={newRoutineAction}>{tt('routines')}</SectionTitle>
        {data.routines.length === 0 && (
          <p style={{ fontSize: 15, color: 'var(--lg-text-2)', margin: '0 4px 12px' }}>{tt('routines_empty')}</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {groups.map(group => (
            <div key={group.folder ?? '\0'} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(groups.length > 1 || group.folder != null) && (
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, margin: '0 4px' }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--lg-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {group.folder != null ? tt('plan_heading', { name: group.folder }) : tt('routine_folder_none')}
                  </span>
                  <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--lg-text-3)', flexShrink: 0 }}>{tt('routines_count', { count: group.routines.length })}</span>
                </div>
              )}
              {group.routines.map(r => r.id === next?.routine.id ? (
                <Card key={r.id} style={{ padding: 16, boxShadow: restDay ? undefined : `var(--lg-surface-shadow), inset 0 0 0 1px ${trainingTint(60)}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0, fontWeight: 500, fontSize: 17, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                    {restDay ? (
                      <span style={{ flexShrink: 0, minHeight: 24, padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4, background: 'var(--lg-fill)', color: 'var(--lg-text-2)' }}>
                        <Moon size={12} aria-hidden="true" /> {tt('rest_day')}
                      </span>
                    ) : (
                      <span style={{ flexShrink: 0, minHeight: 24, padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 500, display: 'inline-flex', alignItems: 'center', background: trainingTint(14), color: TRAINING_ACCENT }}>
                        {next.plannedToday ? tt('planned_today') : tt('plan_next_title')}
                      </span>
                    )}
                    <button type="button" aria-label={`${r.name} – ${tt('edit')}`} onClick={() => onEditRoutine(r)} className="tyd-train-press" style={{ width: 40, height: 40, borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lg-text-3)', flexShrink: 0 }}>
                      <Pencil size={18} aria-hidden="true" />
                    </button>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--lg-text-3)', margin: '4px 0 12px' }}>
                    {restDay && `${tt('plan_next_title')} · `}
                    {tt('exercises_count', { count: r.exercises.length })}
                    {r.weekdays.length > 0 && ` · ${weekdayList(r.weekdays)}`}
                    {` · ${lastLabel(next.lastTrainedAt)}`}
                  </div>
                  <Button block tone={restDay ? 'ghost' : 'primary'} onClick={() => onStartRoutine(r)} style={{ minHeight: 48 }}>
                    <Play size={16} aria-hidden="true" /> {tt('start_routine', { name: r.name })}
                  </Button>
                </Card>
              ) : (
                <Card key={r.id} style={{ padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0, paddingLeft: 4 }}>
                      <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--lg-text-3)' }}>
                        {tt('exercises_count', { count: r.exercises.length })}
                        {r.weekdays.length > 0 && ` · ${weekdayList(r.weekdays)}`}
                      </div>
                    </div>
                    <button type="button" aria-label={`${r.name} – ${tt('edit')}`} onClick={() => onEditRoutine(r)} className="tyd-train-press" style={{ width: 44, height: 44, borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lg-text-3)' }}>
                      <Pencil size={18} aria-hidden="true" />
                    </button>
                    <Button onClick={() => onStartRoutine(r)} aria-label={`${r.name} – ${tt('start')}`} style={{ padding: '0 16px' }}>
                      <Play size={16} aria-hidden="true" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          ))}
        </div>

        <div style={{ marginTop: data.routines.length === 0 ? 0 : 12 }}>
          {data.routines.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--lg-text-3)', margin: '0 4px' }}>{tt('plan_templates')}</div>
              {TRAINING_PLANS.map(plan => (
                <Card key={plan.id} onClick={() => setTemplate(plan)} style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500 }}>{plan.name[lang]}</div>
                      <div style={{ fontSize: 13, color: 'var(--lg-text-3)' }}>
                        {tt('routines_count', { count: plan.days.length })} · {tt('plan_days_per_week', { count: plan.days.length })}
                      </div>
                    </div>
                    <span style={{ fontSize: 15, fontWeight: 500, color: TRAINING_ACCENT }}>{tt('plan_create')}</span>
                  </div>
                </Card>
              ))}
              <Button tone="ghost" onClick={() => setHyroxPick(true)} style={{ alignSelf: 'flex-start' }}>{hyroxLabel}</Button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--lg-text-3)', fontWeight: 500, margin: '0 4px' }}>{tt('plan_templates')}</span>
              {TRAINING_PLANS.map(plan => (
                <Chip key={plan.id} active={false} onClick={() => setTemplate(plan)}>{plan.name[lang]}</Chip>
              ))}
              <Chip active={false} onClick={() => setHyroxPick(true)}>{hyroxLabel}</Chip>
            </div>
          )}
          <p style={{ fontSize: 13, color: 'var(--lg-text-3)', margin: '8px 4px 0' }}>{tt('plan_template_hint')}</p>
        </div>
      </section>

      {template && (
        <TrainingSheet
          title={tt('plan_create_title')}
          onClose={() => setTemplate(null)}
          busy={busy}
          footer={<Button block disabled={busy} onClick={createPlan}>{busy ? tt('plan_creating') : tt('plan_create')}</Button>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 8 }}>
            <div style={{ fontSize: 17, fontWeight: 500 }}>{template.name[lang]}</div>
            <p style={{ fontSize: 15, color: 'var(--lg-text-2)' }}>{tt('plan_create_hint', { name: template.name[lang], count: template.days.length })}</p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {template.days.map(day => (
                <li key={day.name.en} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderRadius: 14, background: 'var(--lg-surface-2)', border: '1px solid var(--lg-separator)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 500 }}>{day.name[lang]}</div>
                    <div style={{ fontSize: 13, color: 'var(--lg-text-3)' }}>{tt('exercises_count', { count: day.exercises.length })}</div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--lg-text-2)' }}>{weekdayList(day.weekdays)}</span>
                </li>
              ))}
            </ul>
          </div>
        </TrainingSheet>
      )}

      {hyroxPick && (
        <TrainingSheet title={tt('hyrox_pick_division')} onClose={() => setHyroxPick(false)}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingBottom: 8 }}>
            {(Object.keys(HYROX_DIVISIONS) as HyroxDivisionId[]).map(id => (
              <Chip
                key={id}
                active={false}
                onClick={() => {
                  setHyroxPick(false)
                  onEditRoutine({
                    name: `${tt('hyrox_template')} · ${HYROX_DIVISIONS[id].name[lang]}`,
                    kind: 'hyrox',
                    weekdays: [],
                    exercises: hyroxRoutine(id),
                    sortOrder: data.routines.length,
                    folder: null,
                  })
                }}
              >
                {HYROX_DIVISIONS[id].name[lang]}
              </Chip>
            ))}
          </div>
        </TrainingSheet>
      )}
    </>
  )
}

/** Arbeitssaetze je Muskel in der laufenden Woche — kompakt, die sechs groessten. */
export function WeeklyMuscleCard({ data, now }: { data: TrainingData; now: Date }) {
  const { tt, lang, locale } = useTrainingText()
  const muscleOf = useCallback((id: string) => exerciseInfo(id, lang, data.customExercises), [lang, data.customExercises])
  const rows = useMemo(() => {
    const weekStart = startOfWeek(now).getTime()
    const inWeek = data.sessions.filter(s => Date.parse(s.startedAt) >= weekStart)
    return sortedMuscles(setsPerMuscle(inWeek, muscleOf), 6)
      .map(row => ({ muscle: row.muscle, week: row.sets, label: formatNumber(row.sets, locale, 1) }))
  }, [data.sessions, now, muscleOf, locale])

  if (rows.length === 0) return null
  return (
    <Card>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--lg-text-3)' }}>{tt('muscle_week_title')}</span>
        <BandLegend />
      </div>
      <MuscleBars rows={rows} />
    </Card>
  )
}
