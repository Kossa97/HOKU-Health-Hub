import { useCallback, useMemo, useState } from 'react'
import { Moon, Pencil, Play, Plus, Timer } from 'lucide-react'
import toast from 'react-hot-toast'
import type { TrainingRoutine } from '../../types'
import { useTrainingText, type TrainingTextKey } from '../../i18n'
import type { TrainingData } from '../../hooks/useTrainingData'
import { exerciseInfo } from '../../lib/exerciseLookup'
import { formatDate, formatNumber } from '../../lib/format'
import { groupByFolder, nextInPlan } from '../../lib/planRotation'
import { sortedMuscles } from '../../lib/muscleVolume'
import { setsPerMuscle, startOfWeek } from '../../lib/stats'
import { createPlanRoutines, TRAINING_PLANS, type TrainingPlan } from '../../data/plans'
import { HYROX_DIVISIONS, hyroxRoutine, type HyroxDivisionId } from '../../data/hyrox'
import { Button, Card, Chip, SectionTitle, TrainingSheet, TRAINING_ACCENT } from '../ui'
import { BandLegend, MuscleBars } from './MuscleVolume'

/**
 * Der Plan-Teil von „Heute": die naechste Routine aus der Rotation, die
 * Routinen nach Ordner, Vorlagen zum Anlegen eines ganzen Plans. Ohne
 * Routinen stehen die Vorlagen gross im Bild, sonst als Chip-Zeile.
 */

const DAY_MS = 24 * 60 * 60 * 1000

export function PlanSection({ data, onStartRoutine, onEditRoutine }: {
  data: TrainingData
  onStartRoutine: (routine: TrainingRoutine) => void
  onEditRoutine: (routine: (Omit<TrainingRoutine, 'id'> & { id?: string }) | null) => void
}) {
  const { tt, lang } = useTrainingText()
  const [template, setTemplate] = useState<TrainingPlan | null>(null)
  const [hyroxPick, setHyroxPick] = useState(false)
  const [busy, setBusy] = useState(false)

  const groups = useMemo(() => groupByFolder(data.routines), [data.routines])

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
    <button type="button" onClick={() => onEditRoutine(null)} className="tyd-train-press" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 36, color: TRAINING_ACCENT, fontWeight: 750, fontSize: '0.85rem' }}>
      <Plus size={16} aria-hidden="true" /> {tt('new_routine')}
    </button>
  )

  const hyroxLabel = <><Timer size={14} aria-hidden="true" /> {tt('hyrox_template')}</>

  return (
    <>
      <section>
        <SectionTitle action={newRoutineAction}>{tt('routines')}</SectionTitle>
        {data.routines.length === 0 && (
          <p style={{ fontSize: '0.88rem', color: 'var(--text-dim)', margin: '0 2px 10px' }}>{tt('routines_empty')}</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {groups.map(group => (
            <div key={group.folder ?? '\0'} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(groups.length > 1 || group.folder != null) && (
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, margin: '0 2px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {group.folder != null ? tt('plan_heading', { name: group.folder }) : tt('routine_folder_none')}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>{tt('routines_count', { count: group.routines.length })}</span>
                </div>
              )}
              {group.routines.map(r => (
                <Card key={r.id} style={{ padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                        {tt('exercises_count', { count: r.exercises.length })}
                        {r.weekdays.length > 0 && ` · ${weekdayList(r.weekdays)}`}
                      </div>
                    </div>
                    <button type="button" aria-label={`${r.name} – ${tt('edit')}`} onClick={() => onEditRoutine(r)} className="tyd-train-press" style={{ width: 44, height: 44, borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
                      <Pencil size={18} aria-hidden="true" />
                    </button>
                    <Button onClick={() => onStartRoutine(r)} aria-label={`${r.name} – ${tt('start')}`} style={{ padding: '10px 14px' }}>
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
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-dim)', margin: '0 2px' }}>{tt('plan_templates')}</div>
              {TRAINING_PLANS.map(plan => (
                <Card key={plan.id} onClick={() => setTemplate(plan)} style={{ padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800 }}>{plan.name[lang]}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>
                        {tt('routines_count', { count: plan.days.length })} · {tt('plan_days_per_week', { count: plan.days.length })}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 750, color: TRAINING_ACCENT }}>{tt('plan_create')}</span>
                  </div>
                </Card>
              ))}
              <Button tone="ghost" onClick={() => setHyroxPick(true)} style={{ alignSelf: 'flex-start' }}>{hyroxLabel}</Button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', fontWeight: 650, marginRight: 2 }}>{tt('plan_templates')}</span>
              {TRAINING_PLANS.map(plan => (
                <Chip key={plan.id} active={false} onClick={() => setTemplate(plan)}>{plan.name[lang]}</Chip>
              ))}
              <Chip active={false} onClick={() => setHyroxPick(true)}>{hyroxLabel}</Chip>
            </div>
          )}
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '8px 2px 0' }}>{tt('plan_template_hint')}</p>
        </div>
      </section>

      {template && (
        <TrainingSheet
          title={tt('plan_create_title')}
          onClose={() => setTemplate(null)}
          busy={busy}
          footer={<Button block disabled={busy} onClick={createPlan}>{busy ? tt('plan_creating') : tt('plan_create')}</Button>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 8 }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{template.name[lang]}</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-dim)' }}>{tt('plan_create_hint', { name: template.name[lang], count: template.days.length })}</p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {template.days.map(day => (
                <li key={day.name.en} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 750 }}>{day.name[lang]}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-dim)' }}>{tt('exercises_count', { count: day.exercises.length })}</div>
                  </div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: TRAINING_ACCENT }}>{weekdayList(day.weekdays)}</span>
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

/**
 * „Als Naechstes im Plan": die Routine aus der Rotation (oder die fuer heute
 * geplante), mit Start-Knopf und der Rotation des Ordners als Chip-Zeile.
 */
export function NextInPlanCard({ data, now, onStartRoutine }: {
  data: TrainingData
  now: Date
  onStartRoutine: (routine: TrainingRoutine) => void
}) {
  const { tt, locale } = useTrainingText()
  const next = useMemo(() => nextInPlan(data.routines, data.sessions, now), [data.routines, data.sessions, now])
  if (!next) return null
  const hasPlan = data.routines.some(r => r.weekdays.length > 0)
  const doneToday = data.sessions.some(s => new Date(s.startedAt).toDateString() === now.toDateString())
  const restDay = hasPlan && !next.plannedToday && !doneToday

  // „zuletzt Freitag" fuer die letzten sechs Tage, davor mit Datum.
  const lastLabel = (iso: string | null) => {
    if (!iso) return tt('plan_never')
    const ageDays = (now.getTime() - Date.parse(iso)) / DAY_MS
    const day = ageDays < 6
      ? new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(new Date(iso))
      : formatDate(iso, locale)
    return tt('plan_last', { day })
  }

  return (
    <Card accent={TRAINING_ACCENT} style={{ background: `radial-gradient(140% 120% at 0% 0%, ${TRAINING_ACCENT}24 0%, var(--surface) 60%)` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: TRAINING_ACCENT, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {next.plannedToday ? tt('planned_today') : tt('plan_next_title')}
        </span>
        {restDay && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.72rem', fontWeight: 700, color: '#8b5cf6' }}>
            <Moon size={12} aria-hidden="true" /> {tt('rest_day')}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{next.routine.name}</div>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-dim)' }}>
            {tt('exercises_count', { count: next.routine.exercises.length })} · {lastLabel(next.lastTrainedAt)}
          </div>
        </div>
        <Button onClick={() => onStartRoutine(next.routine)} style={{ minHeight: 50, padding: '0 18px' }}>
          <Play size={16} aria-hidden="true" /> {tt('start')}
        </Button>
      </div>
      {next.rotation.length > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, overflowX: 'auto', scrollbarWidth: 'none' }}>
          <span style={{ fontSize: '0.72rem', color: 'var(--text-dim)', fontWeight: 650, flexShrink: 0 }}>{next.folder ?? tt('plan_rotation')}</span>
          {next.rotation.map(r => {
            const active = r.id === next.routine.id
            return (
              <span
                key={r.id}
                aria-current={active ? 'true' : undefined}
                style={{
                  flexShrink: 0, minHeight: 26, padding: '2px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center',
                  background: active ? `${TRAINING_ACCENT}22` : 'var(--surface-raised)',
                  border: `1px solid ${active ? `${TRAINING_ACCENT}66` : 'var(--border)'}`,
                  color: active ? TRAINING_ACCENT : 'var(--text-dim)',
                }}
              >
                {r.name}
              </span>
            )
          })}
        </div>
      )}
    </Card>
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
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{tt('muscle_week_title')}</span>
        <BandLegend />
      </div>
      <MuscleBars rows={rows} />
    </Card>
  )
}
