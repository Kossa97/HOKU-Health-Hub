import { useCallback, useMemo, useState } from 'react'
import { ChevronRight, Moon, Pencil, Play, Plus, Timer } from 'lucide-react'
import toast from 'react-hot-toast'
import { ROUTINE_FOLDER_MAX, type TrainingRoutine } from '../../types'
import { useTrainingText, type TrainingTextKey } from '../../i18n'
import type { TrainingData } from '../../hooks/useTrainingData'
import { exerciseInfo } from '../../lib/exerciseLookup'
import { formatDate, formatNumber } from '../../lib/format'
import { groupByFolder, type NextInPlan } from '../../lib/planRotation'
import { sortedMuscles } from '../../lib/muscleVolume'
import { setsPerMuscle, startOfWeek } from '../../lib/stats'
import { createPlanRoutines, TRAINING_PLANS, type TrainingPlan } from '../../data/plans'
import { HYROX_DIVISIONS, hyroxRoutine, type HyroxDivisionId } from '../../data/hyrox'
import { Button, Card, Chip, SectionTitle, TrainingSheet, inputStyle } from '../ui'
import { BandLegend, MuscleBars } from './MuscleVolume'
import { PlanEditor } from './PlanEditor'
import { HokuPlanChat } from './HokuPlanChat'
import { useDotStand } from '../../../dot/dotStore'
import { PRO_PFLICHT } from '../../../dot/lib/zugang'

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
  const [editingPlan, setEditingPlan] = useState<string | null>(null)
  const [newPlan, setNewPlan] = useState<string | null>(null)
  const [hokuChat, setHokuChat] = useState(false)
  const [hokuUpsell, setHokuUpsell] = useState(false)
  // Hoku-Pläne nur mit Pro, sobald Pro gilt (gleicher Schalter wie der Hoku-Chat)
  const darfHoku = useDotStand().darfRaus
  const hokuGesperrt = PRO_PFLICHT && !darfHoku

  // Die hervorgehobene Routine nach oben in ihrem Ordner. Plaene ohne Workout
  // (frisch angelegt) stehen hinter den uebrigen Plaenen, vor „Ohne Plan".
  const groups = useMemo(() => {
    const filled = groupByFolder(data.routines).map(group => ({
      ...group,
      routines: [...group.routines].sort((a, b) => Number(b.id === next?.routine.id) - Number(a.id === next?.routine.id)),
    }))
    const empty = data.plans
      .filter(p => !filled.some(g => g.folder === p.name))
      .map(p => ({ folder: p.name as string | null, routines: [] as TrainingRoutine[] }))
    const loose = filled.filter(g => g.folder == null)
    return [...filled.filter(g => g.folder != null), ...empty, ...loose]
  }, [data.routines, data.plans, next])

  const takenPlanNames = useMemo(
    () => new Set([...data.routines.map(r => r.folder).filter((f): f is string => !!f), ...data.plans.map(p => p.name)]),
    [data.routines, data.plans],
  )
  const newPlanName = (newPlan ?? '').trim().slice(0, ROUTINE_FOLDER_MAX)
  const newPlanTaken = takenPlanNames.has(newPlanName)

  /** Leeren Plan anlegen (nur sein Zeitplan, „Wochentage") und gleich oeffnen. */
  const createEmptyPlan = async () => {
    if (!newPlanName || newPlanTaken) return
    setBusy(true)
    try {
      await data.savePlanSchedule(newPlanName, { mode: 'weekdays' })
      setNewPlan(null)
      setEditingPlan(newPlanName)
    } catch {
      toast.error(tt('save_error'))
    } finally {
      setBusy(false)
    }
  }

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
  /** Wochentage an einem Workout zeigen — nur, wenn sein Plan nach Wochentagen geht. */
  const byWeekdays = (r: TrainingRoutine) => r.folder == null || (data.schedules.get(r.folder)?.mode ?? 'weekdays') === 'weekdays'
  const scheduleLabel = (plan: string) => {
    const schedule = data.schedules.get(plan)
    if (schedule?.mode === 'per_week') return tt('sched_per_week_value', { count: schedule.perWeek })
    if (schedule?.mode === 'interval') return tt('sched_interval_value', { count: schedule.everyDays })
    return null
  }

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

  // Unter der Ueberschrift: zwei gleich breite Knoepfe (neben der Ueberschrift
  // wird es auf dem Handy zu eng)
  const newActions = (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 12 }}>
      <Button tone="ghost" onClick={() => setNewPlan('')} style={{ minHeight: 44, fontSize: '0.9rem', color: 'var(--accent)' }}>
        <Plus size={16} aria-hidden="true" /> {tt('new_plan')}
      </Button>
      <Button tone="ghost" onClick={() => onEditRoutine(null)} style={{ minHeight: 44, fontSize: '0.9rem', color: 'var(--accent)' }}>
        <Plus size={16} aria-hidden="true" /> {tt('new_routine')}
      </Button>
    </div>
  )

  const hyroxLabel = <><Timer size={14} aria-hidden="true" /> {tt('hyrox_template')}</>

  return (
    <>
      <section>
        <SectionTitle>{tt('plans_and_workouts')}</SectionTitle>
        {newActions}
        {data.routines.length === 0 && (
          <p style={{ fontSize: '0.88rem', color: 'var(--lg-text-3)', margin: '0 2px 10px' }}>{tt('routines_empty')}</p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {groups.map(group => (
            <div key={group.folder ?? '\0'} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(groups.length > 1 || group.folder != null) && (
                group.folder != null ? (
                  // Der Kopf eines Plans oeffnet den Plan (Name, Zeitplan, Workouts)
                  <button
                    type="button"
                    onClick={() => setEditingPlan(group.folder)}
                    aria-label={`${tt('plan_heading', { name: group.folder })} – ${tt('plan_edit')}`}
                    className="tyd-train-press"
                    style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 36, margin: '0 2px', textAlign: 'left' }}
                  >
                    <span style={{ flex: 1, minWidth: 0, fontSize: '0.82rem', fontWeight: 800, color: 'var(--lg-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tt('plan_heading', { name: group.folder })}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--lg-text-3)', flexShrink: 0 }}>
                      {scheduleLabel(group.folder) ?? tt('routines_count', { count: group.routines.length })}
                    </span>
                    <ChevronRight size={16} aria-hidden="true" style={{ color: 'var(--lg-text-4)', flexShrink: 0 }} />
                  </button>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, margin: '0 2px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--lg-text)' }}>{tt('routine_folder_none')}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--lg-text-3)', flexShrink: 0 }}>{tt('routines_count', { count: group.routines.length })}</span>
                  </div>
                )
              )}
              {group.routines.length === 0 && group.folder != null && (
                <Card style={{ padding: 14 }}>
                  <p style={{ fontSize: '0.85rem', color: 'var(--lg-text-3)', margin: '0 0 10px' }}>{tt('plan_empty')}</p>
                  <Button
                    block
                    tone="ghost"
                    onClick={() => onEditRoutine({ name: '', kind: 'strength', weekdays: [], exercises: [], sortOrder: data.routines.length, folder: group.folder })}
                  >
                    <Plus size={16} aria-hidden="true" /> {tt('plan_add_workout')}
                  </Button>
                </Card>
              )}
              {group.routines.map(r => r.id === next?.routine.id ? (
                <Card key={r.id} style={{ padding: 14, boxShadow: restDay ? undefined : `var(--lg-surface-shadow), inset 0 0 0 1.5px color-mix(in srgb, var(--accent) 60%, transparent)` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0, fontWeight: 800, fontSize: '1.05rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                    {restDay ? (
                      <span style={{ flexShrink: 0, minHeight: 24, padding: '2px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 750, display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(139,92,246,0.14)', color: '#8b5cf6' }}>
                        <Moon size={12} aria-hidden="true" /> {tt('rest_day')}
                      </span>
                    ) : (
                      <span style={{ flexShrink: 0, minHeight: 24, padding: '2px 10px', borderRadius: 999, fontSize: '0.72rem', fontWeight: 750, display: 'inline-flex', alignItems: 'center', background: 'color-mix(in srgb, var(--accent) 16%, transparent)', color: 'var(--accent)' }}>
                        {next.plannedToday ? tt('planned_today') : tt('plan_next_title')}
                      </span>
                    )}
                    <button type="button" aria-label={`${r.name} – ${tt('edit')}`} onClick={() => onEditRoutine(r)} className="tyd-train-press" style={{ width: 40, height: 40, borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lg-text-3)', flexShrink: 0 }}>
                      <Pencil size={18} aria-hidden="true" />
                    </button>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--lg-text-3)', margin: '2px 0 12px' }}>
                    {restDay && `${tt('plan_next_title')} · `}
                    {tt('exercises_count', { count: r.exercises.length })}
                    {byWeekdays(r) && r.weekdays.length > 0 && ` · ${weekdayList(r.weekdays)}`}
                    {` · ${lastLabel(next.lastTrainedAt)}`}
                  </div>
                  <Button block tone={restDay ? 'ghost' : 'primary'} onClick={() => onStartRoutine(r)} style={{ minHeight: 48 }}>
                    <Play size={16} aria-hidden="true" /> {tt('start_routine', { name: r.name })}
                  </Button>
                </Card>
              ) : (
                <Card key={r.id} style={{ padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--lg-text-3)' }}>
                        {tt('exercises_count', { count: r.exercises.length })}
                        {byWeekdays(r) && r.weekdays.length > 0 && ` · ${weekdayList(r.weekdays)}`}
                      </div>
                    </div>
                    <button type="button" aria-label={`${r.name} – ${tt('edit')}`} onClick={() => onEditRoutine(r)} className="tyd-train-press" style={{ width: 44, height: 44, borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lg-text-3)' }}>
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
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--lg-text-3)', margin: '0 2px' }}>{tt('plan_templates')}</div>
              {TRAINING_PLANS.map(plan => (
                <Card key={plan.id} onClick={() => setTemplate(plan)} style={{ padding: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800 }}>{plan.name[lang]}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--lg-text-3)' }}>
                        {tt('routines_count', { count: plan.days.length })} · {tt('plan_days_per_week', { count: plan.days.length })}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.85rem', fontWeight: 750, color: 'var(--accent)' }}>{tt('plan_create')}</span>
                  </div>
                </Card>
              ))}
              <Button tone="ghost" onClick={() => setHyroxPick(true)} style={{ alignSelf: 'flex-start' }}>{hyroxLabel}</Button>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--lg-text-3)', fontWeight: 650, marginRight: 2 }}>{tt('plan_templates')}</span>
              {TRAINING_PLANS.map(plan => (
                <Chip key={plan.id} active={false} onClick={() => setTemplate(plan)}>{plan.name[lang]}</Chip>
              ))}
              <Chip active={false} onClick={() => setHyroxPick(true)}>{hyroxLabel}</Chip>
            </div>
          )}
          <p style={{ fontSize: '0.75rem', color: 'var(--lg-text-3)', margin: '8px 2px 0' }}>{tt('plan_template_hint')}</p>
        </div>
      </section>

      {newPlan != null && (
        <TrainingSheet
          title={tt('new_plan')}
          onClose={() => setNewPlan(null)}
          busy={busy}
          footer={<Button block disabled={busy || !newPlanName || newPlanTaken} onClick={() => { void createEmptyPlan() }}>{tt('plan_create')}</Button>}
        >
          <form
            onSubmit={event => { event.preventDefault(); void createEmptyPlan() }}
            style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 8 }}
          >
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--lg-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '0 4px' }}>{tt('plan_name')}</span>
              <input
                autoFocus
                value={newPlan}
                onChange={event => setNewPlan(event.target.value)}
                placeholder={tt('routine_folder_placeholder')}
                maxLength={ROUTINE_FOLDER_MAX}
                enterKeyHint="done"
                style={{ ...inputStyle, fontWeight: 700, fontSize: 17, minHeight: 48 }}
              />
            </label>
            {newPlanTaken && newPlanName && <p role="alert" style={{ fontSize: 14, color: 'var(--lg-bad-text)', margin: '0 4px' }}>{tt('plan_name_taken')}</p>}
            <p style={{ fontSize: 14, color: 'var(--lg-text-3)', margin: '0 4px' }}>{tt('plan_new_hint')}</p>
          </form>
          <div aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--lg-text-3)', fontSize: 13, margin: '6px 0 12px' }}>
            <span style={{ flex: 1, height: 0.5, background: 'var(--lg-separator)' }} />{tt('hoku_or')}<span style={{ flex: 1, height: 0.5, background: 'var(--lg-separator)' }} />
          </div>
          <button
            type="button"
            onClick={() => { setNewPlan(null); if (hokuGesperrt) setHokuUpsell(true); else setHokuChat(true) }}
            className="tyd-train-press"
            style={{
              width: '100%', minHeight: 64, borderRadius: 18, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', textAlign: 'left',
              background: 'color-mix(in srgb, var(--accent) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)', marginBottom: 8,
            }}
          >
            <span aria-hidden="true" style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: 'radial-gradient(circle at 35% 30%, #bff3ff 0 8%, #4fd6ff 30%, #6f6cff 70%, #2a1f6b 100%)' }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 17, fontWeight: 700 }}>{tt('hoku_create')}</span>
              <span style={{ display: 'block', fontSize: 13, color: 'var(--lg-text-3)' }}>{tt('hoku_create_hint')}</span>
            </span>
            {hokuGesperrt && <span style={{ fontSize: 12, fontWeight: 800, padding: '4px 8px', borderRadius: 8, background: '#ffd60a', color: '#3a2c00' }}>PRO</span>}
          </button>
        </TrainingSheet>
      )}

      {hokuChat && (
        <HokuPlanChat data={data} onClose={() => setHokuChat(false)} onSaved={() => setHokuChat(false)} />
      )}

      {hokuUpsell && (
        <TrainingSheet title={tt('hoku_upsell_title')} onClose={() => setHokuUpsell(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 8 }}>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45, color: 'var(--lg-text-2)' }}>{tt('hoku_upsell_text')}</p>
            <Button tone="ghost" block onClick={() => { setHokuUpsell(false); setNewPlan('') }}>{tt('new_plan')}</Button>
          </div>
        </TrainingSheet>
      )}

      {editingPlan != null && (
        <PlanEditor
          data={data}
          planName={editingPlan}
          now={now}
          onClose={() => setEditingPlan(null)}
          onEditWorkout={workout => { setEditingPlan(null); onEditRoutine(workout) }}
        />
      )}

      {template && (
        <TrainingSheet
          title={tt('plan_create_title')}
          onClose={() => setTemplate(null)}
          busy={busy}
          footer={<Button block disabled={busy} onClick={createPlan}>{busy ? tt('plan_creating') : tt('plan_create')}</Button>}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 8 }}>
            <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{template.name[lang]}</div>
            <p style={{ fontSize: '0.85rem', color: 'var(--lg-text-3)' }}>{tt('plan_create_hint', { name: template.name[lang], count: template.days.length })}</p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {template.days.map(day => (
                <li key={day.name.en} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 14, background: 'var(--lg-surface-2)', border: '1px solid var(--lg-separator)' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 750 }}>{day.name[lang]}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--lg-text-3)' }}>{tt('exercises_count', { count: day.exercises.length })}</div>
                  </div>
                  <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--accent)' }}>{weekdayList(day.weekdays)}</span>
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
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--lg-text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{tt('muscle_week_title')}</span>
        <BandLegend />
      </div>
      <MuscleBars rows={rows} />
    </Card>
  )
}
