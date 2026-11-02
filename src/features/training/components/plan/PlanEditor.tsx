import { useMemo, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowRightLeft, ArrowUp, CalendarDays, ClipboardPaste, Copy, CopyPlus, Minus, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { EVERY_DAYS_MAX, PER_WEEK_MAX, ROUTINE_FOLDER_MAX, type PlanSchedule, type TrainingRoutine } from '../../types'
import { useTrainingText, type TrainingTextKey } from '../../i18n'
import type { TrainingData } from '../../hooks/useTrainingData'
import { cloneExercise } from '../../lib/exerciseSelection'
import { copyWorkout, useWorkoutClipboard, workoutCopies } from '../../lib/exerciseClipboard'
import { nextInPlan, rotationOrder } from '../../lib/planRotation'
import { DEFAULT_SCHEDULE, scheduleStatus } from '../../lib/planSchedule'
import { Button, TrainingSheet, inputStyle } from '../ui'

/**
 * Ein Plan: Name, Zeitplan (feste Wochentage, X-mal pro Woche, alle X Tage)
 * und seine Workouts in der Reihenfolge, in der sie drankommen. Workouts
 * lassen sich bearbeiten, umsortieren, duplizieren, kopieren (einfuegen in
 * jedem Plan), in einen anderen Plan verschieben und loeschen; der ganze Plan
 * laesst sich duplizieren und loeschen. Name und Zeitplan werden beim
 * Schliessen gespeichert, Aenderungen an Workouts sofort.
 */

type Draft = Omit<TrainingRoutine, 'id'> & { id?: string }
type Mode = PlanSchedule['mode']

const MODES: Mode[] = ['weekdays', 'per_week', 'interval']
const MODE_LABEL: Record<Mode, TrainingTextKey> = { weekdays: 'sched_weekdays', per_week: 'sched_per_week', interval: 'sched_interval' }

/** „PPL (Kopie)", „PPL (Kopie 2)" … — ein Name, den es noch nicht gibt, hoechstens 40 Zeichen. */
function freeName(base: string, taken: ReadonlySet<string>, copyName: (n: string) => string): string {
  for (let i = 1; i < 100; i++) {
    const suffix = i === 1 ? '' : ` ${i}`
    const full = copyName(base) + suffix
    const name = full.length <= ROUTINE_FOLDER_MAX ? full : copyName(base.slice(0, ROUTINE_FOLDER_MAX - (full.length - base.length))) + suffix
    if (!taken.has(name)) return name
  }
  return `${base.slice(0, ROUTINE_FOLDER_MAX - 6)} ${Date.now() % 10000}`
}

export function PlanEditor({ data, planName, now, onClose, onEditWorkout }: {
  data: TrainingData
  planName: string
  now: Date
  onClose: () => void
  /** Workout oeffnen (der Plan-Bildschirm schliesst sich dafuer). */
  onEditWorkout: (workout: Draft) => void
}) {
  const { tt, locale } = useTrainingText()
  const initialSchedule = data.schedules.get(planName) ?? DEFAULT_SCHEDULE
  const [name, setName] = useState(planName)
  const [schedule, setSchedule] = useState<PlanSchedule>(initialSchedule)
  const [busy, setBusy] = useState(false)
  const [menu, setMenu] = useState<TrainingRoutine | null>(null)
  const [moving, setMoving] = useState<TrainingRoutine | null>(null)
  const clip = useWorkoutClipboard()

  const workouts = useMemo(() => data.routines.filter(r => r.folder === planName).sort(rotationOrder), [data.routines, planName])
  const otherPlans = useMemo(() => {
    const names: string[] = []
    for (const r of data.routines) if (r.folder && r.folder !== planName && !names.includes(r.folder)) names.push(r.folder)
    return names.sort((a, b) => a.localeCompare(b))
  }, [data.routines, planName])
  // Belegte Namen: auch Plaene, die nur noch einen Zeitplan haben (keine Workouts)
  const takenNames = useMemo(
    () => new Set([...otherPlans, ...data.plans.map(p => p.name).filter(n => n !== planName)]),
    [otherPlans, data.plans, planName],
  )

  const next = useMemo(
    () => nextInPlan(workouts, data.sessions, now, new Map([[planName, schedule]])),
    [workouts, data.sessions, now, planName, schedule],
  )
  const status = useMemo(() => scheduleStatus(schedule, workouts, data.sessions, now), [schedule, workouts, data.sessions, now])
  const shortDate = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'numeric' }), [locale])

  const summary = (() => {
    if (!next) return null
    if (schedule.mode === 'per_week') {
      const head = tt('sched_week_progress', { done: Math.min(status.doneThisWeek, schedule.perWeek), goal: schedule.perWeek })
      const tail = status.dueToday ? tt('sched_next_today', { name: next.routine.name })
        : status.doneThisWeek >= schedule.perWeek ? tt('sched_goal_reached')
        : tt('sched_next_on', { name: next.routine.name, date: shortDate.format(status.nextDate ?? now) })
      return [head, tail]
    }
    if (schedule.mode === 'interval') {
      const head = tt('sched_interval_value', { count: schedule.everyDays })
      const tail = status.dueToday ? tt('sched_next_today', { name: next.routine.name })
        : tt('sched_next_on', { name: next.routine.name, date: shortDate.format(status.nextDate ?? now) })
      return [status.lastAt ? `${head} · ${tt('sched_last', { date: shortDate.format(status.lastAt) })}` : head, tail]
    }
    return [tt('sched_weekdays_hint'), next.plannedToday ? tt('sched_next_today', { name: next.routine.name }) : null]
  })()

  const setMode = (mode: Mode) => setSchedule(prev => {
    if (prev.mode === mode) return prev
    if (mode === 'per_week') return { mode, perWeek: Math.min(PER_WEEK_MAX, Math.max(1, workouts.length || 3)) }
    if (mode === 'interval') return { mode, everyDays: 2 }
    return { mode }
  })

  // ── Speichern beim Schliessen ─────────────────────────────────────────────

  /** Name und Zeitplan sichern; true, wenn das geklappt hat (dann ist der Bildschirm zu). */
  const save = async (): Promise<string | null> => {
    if (busy) return null
    const trimmed = name.trim().slice(0, ROUTINE_FOLDER_MAX)
    const renamed = trimmed.length > 0 && trimmed !== planName
    if (renamed && takenNames.has(trimmed)) { toast.error(tt('plan_name_taken')); return null }
    const finalName = renamed ? trimmed : planName
    const scheduleChanged = JSON.stringify(schedule) !== JSON.stringify(initialSchedule)
    if (!renamed && !scheduleChanged) { onClose(); return finalName }
    setBusy(true)
    try {
      if (renamed) await data.renamePlan(planName, trimmed)
      if (scheduleChanged) await data.savePlanSchedule(finalName, schedule)
      toast.success(tt('saved'))
      onClose()
      return finalName
    } catch {
      toast.error(tt('save_error'))
      setBusy(false)
      return null
    }
  }
  const close = () => { void save() }

  /** Erst Name und Zeitplan sichern, dann das Workout oeffnen. */
  const openWorkout = async (workout: Draft) => {
    const finalName = await save()
    if (finalName == null) return
    onEditWorkout(workout.folder === planName ? { ...workout, folder: finalName } : workout)
  }

  // ── Workouts ──────────────────────────────────────────────────────────────

  const run = async (action: () => Promise<void>, done?: string) => {
    setBusy(true)
    try { await action(); if (done) toast.success(done) } catch { toast.error(tt('save_error')) } finally { setBusy(false) }
  }
  const nextSortOrder = () => Math.max(-1, ...data.routines.map(r => r.sortOrder)) + 1

  const duplicate = (w: TrainingRoutine) => run(async () => {
    const taken = new Set(data.routines.map(r => r.name))
    await data.saveRoutine({
      name: freeName(w.name, taken, n => tt('workout_copy_name', { name: n })), kind: w.kind, weekdays: [...w.weekdays],
      exercises: w.exercises.map(cloneExercise), folder: planName, sortOrder: nextSortOrder(),
    })
  }, tt('workout_duplicated', { name: w.name }))

  const paste = () => run(async () => {
    let order = nextSortOrder()
    for (const copy of workoutCopies()) {
      await data.saveRoutine({ ...copy, exercises: copy.exercises.map(cloneExercise), folder: planName, sortOrder: order++ })
    }
  }, tt('workout_pasted', { name: clip.map(c => c.name).join(', ') }))

  const moveTo = (w: TrainingRoutine, folder: string | null) => run(async () => {
    await data.saveRoutine({ ...w, folder })
    setMoving(null)
  }, tt('workout_moved', { name: w.name }))

  const remove = (w: TrainingRoutine) => {
    if (!window.confirm(tt('routine_delete_confirm', { name: w.name }))) return
    void run(() => data.removeRoutine(w.id), tt('deleted'))
  }

  // Nachbarn tauschen: beide bekommen ihre Plaetze als sortOrder, eindeutig.
  const shift = (index: number, delta: number) => run(async () => {
    const order = [...workouts]
    const [item] = order.splice(index, 1)
    order.splice(index + delta, 0, item)
    const base = Math.min(...workouts.map(w => w.sortOrder))
    for (const [i, w] of order.entries()) if (w.sortOrder !== base + i) await data.saveRoutine({ ...w, sortOrder: base + i })
  })

  const duplicatePlan = () => run(async () => {
    const taken = new Set([...data.routines.map(r => r.folder).filter((f): f is string => !!f), ...data.plans.map(p => p.name)])
    const copyName = freeName(planName, taken, n => tt('workout_copy_name', { name: n }))
    let order = nextSortOrder()
    for (const w of workouts) {
      await data.saveRoutine({ name: w.name, kind: w.kind, weekdays: [...w.weekdays], exercises: w.exercises.map(cloneExercise), folder: copyName, sortOrder: order++ })
    }
    if (schedule.mode !== 'weekdays') await data.savePlanSchedule(copyName, schedule)
  }, tt('plan_duplicated'))

  const [confirmDelete, setConfirmDelete] = useState(false)
  const deletePlan = () => {
    setBusy(true)
    data.removePlan(planName)
      .then(complete => {
        if (complete) { toast.success(tt('plan_deleted')); onClose(); return }
        // Workouts sind weg, der leere Plan steht noch: Hinweis, Bildschirm bleibt offen
        toast.error(tt('plan_delete_partial'))
        setConfirmDelete(false)
        setBusy(false)
      })
      // Nichts geloescht (alle Workouts oder keins)
      .catch(() => { toast.error(tt('delete_error')); setBusy(false) })
  }

  const weekdayList = (days: number[]) => days.map(d => tt(`weekday_${d}` as TrainingTextKey)).join(', ')

  return (
    <TrainingSheet title={tt('plan_title')} onClose={close} busy={busy} closeLabel={tt('editor_close_save')} tall>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingBottom: 8 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={groupLabel}>{tt('plan_name')}</span>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={ROUTINE_FOLDER_MAX}
            style={{ ...inputStyle, fontWeight: 700, fontSize: 17, minHeight: 48 }}
          />
        </label>

        <section aria-labelledby="plan-schedule" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h3 id="plan-schedule" style={groupLabel}>{tt('plan_schedule')}</h3>
          <div style={{ ...card, padding: 12, gap: 14 }}>
            <div role="radiogroup" aria-labelledby="plan-schedule" style={{ display: 'flex', gap: 2, padding: 2, borderRadius: 11, background: 'var(--lg-fill)' }}>
              {MODES.map(mode => (
                <button
                  key={mode}
                  type="button"
                  role="radio"
                  aria-checked={schedule.mode === mode}
                  onClick={() => setMode(mode)}
                  className="tyd-train-press"
                  style={{
                    flex: 1, minHeight: 36, borderRadius: 9, fontSize: 13, fontWeight: 600, textAlign: 'center', padding: '0 4px',
                    background: schedule.mode === mode ? 'var(--lg-fill-selected, #636366)' : 'transparent',
                    color: schedule.mode === mode ? 'var(--lg-text)' : 'var(--lg-text-2)',
                  }}
                >
                  {tt(MODE_LABEL[mode])}
                </button>
              ))}
            </div>

            {schedule.mode === 'per_week' && (
              <Stepper
                value={schedule.perWeek}
                min={1}
                max={PER_WEEK_MAX}
                label={tt('sched_per_week_value', { count: schedule.perWeek })}
                big={`${schedule.perWeek}×`}
                onChange={perWeek => setSchedule({ mode: 'per_week', perWeek })}
              />
            )}
            {schedule.mode === 'interval' && (
              <Stepper
                value={schedule.everyDays}
                min={1}
                max={EVERY_DAYS_MAX}
                label={tt('sched_interval_value', { count: schedule.everyDays })}
                big={String(schedule.everyDays)}
                onChange={everyDays => setSchedule({ mode: 'interval', everyDays })}
              />
            )}

            {summary && (
              <div aria-live="polite" style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 12px', borderRadius: 10, background: 'color-mix(in srgb, var(--accent) 12%, transparent)' }}>
                <CalendarDays size={18} aria-hidden="true" style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 14, lineHeight: 1.4 }}>
                  <div style={{ fontWeight: 600 }}>{summary[0]}</div>
                  {summary[1] && <div style={{ color: 'var(--lg-text-2)' }}>{summary[1]}</div>}
                </div>
              </div>
            )}
          </div>
        </section>

        <section aria-labelledby="plan-workouts" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <h3 id="plan-workouts" style={groupLabel}>{tt('plan_workouts')} · {workouts.length}</h3>
            {schedule.mode !== 'weekdays' && <span style={{ fontSize: 13, color: 'var(--lg-text-3)' }}>{tt('plan_order_hint')}</span>}
          </div>
          <ol style={{ ...card, listStyle: 'none', margin: 0, padding: 0, gap: 0, overflow: 'hidden' }}>
            {workouts.map((w, index) => {
              const isNext = next?.routine.id === w.id
              return (
                <li key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 60, padding: '6px 4px 6px 12px', borderTop: index === 0 ? undefined : '0.5px solid var(--lg-separator)' }}>
                  <span aria-hidden="true" style={{
                    width: 26, height: 26, borderRadius: 13, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 700,
                    background: isNext ? 'var(--accent)' : 'var(--lg-fill)', color: isNext ? 'var(--accent-contrast)' : 'var(--lg-text-2)',
                  }}>{index + 1}</span>
                  <button type="button" onClick={() => { void openWorkout(w) }} disabled={busy} className="tyd-train-press" style={{ flex: 1, minWidth: 0, minHeight: 48, textAlign: 'left', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <span style={{ fontSize: 17, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.name}</span>
                    <span style={{ fontSize: 13, color: 'var(--lg-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {tt('exercises_count', { count: w.exercises.length })}
                      {schedule.mode === 'weekdays' && w.weekdays.length > 0 && ` · ${weekdayList(w.weekdays)}`}
                      {isNext && ` · ${next.plannedToday ? tt('planned_today') : tt('plan_next_title')}`}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMenu(w)}
                    aria-label={tt('workout_menu', { name: w.name })}
                    className="tyd-train-press"
                    style={{ width: 44, height: 44, flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lg-text-3)' }}
                  >
                    <MoreHorizontal size={20} aria-hidden="true" />
                  </button>
                </li>
              )
            })}
          </ol>

          {clip.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 8px 8px 14px', borderRadius: 14, border: '1px dashed color-mix(in srgb, var(--accent) 55%, transparent)' }}>
              <ClipboardPaste size={18} aria-hidden="true" style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.3 }}>
                <div style={{ fontWeight: 600 }}>{tt('plan_clip_label')}</div>
                <div style={{ color: 'var(--lg-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{clip.map(c => c.name).join(', ')}</div>
              </div>
              <Button disabled={busy} onClick={() => { void paste() }} style={{ minHeight: 40, padding: '0 14px' }}>{tt('plan_paste')}</Button>
            </div>
          )}

          <Button tone="ghost" block disabled={busy} onClick={() => { void openWorkout({ name: '', kind: 'strength', weekdays: [], exercises: [], sortOrder: nextSortOrder(), folder: planName }) }} style={{ minHeight: 48 }}>
            <Plus size={18} aria-hidden="true" /> {tt('plan_new_workout')}
          </Button>
        </section>

        <div style={{ ...card, gap: 0, padding: 0, overflow: 'hidden' }}>
          <RowButton icon={<CopyPlus size={18} aria-hidden="true" />} disabled={busy} onClick={() => { void duplicatePlan() }}>{tt('plan_duplicate')}</RowButton>
          <RowButton icon={<Trash2 size={18} aria-hidden="true" />} disabled={busy} danger onClick={() => setConfirmDelete(true)}>{tt('plan_delete')}</RowButton>
        </div>
      </div>

      {menu && (
        <TrainingSheet title={menu.name} onClose={() => setMenu(null)} zIndex={100} busy={busy}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 8 }}>
            <MenuButton icon={<Pencil size={18} aria-hidden="true" />} onClick={() => { const w = menu; setMenu(null); void openWorkout(w) }}>{tt('workout_edit')}</MenuButton>
            <MenuButton icon={<ArrowUp size={18} aria-hidden="true" />} disabled={workouts[0]?.id === menu.id} onClick={() => { const i = workouts.findIndex(w => w.id === menu.id); setMenu(null); void shift(i, -1) }}>{tt('move_up')}</MenuButton>
            <MenuButton icon={<ArrowDown size={18} aria-hidden="true" />} disabled={workouts.at(-1)?.id === menu.id} onClick={() => { const i = workouts.findIndex(w => w.id === menu.id); setMenu(null); void shift(i, 1) }}>{tt('move_down')}</MenuButton>
            <MenuButton icon={<CopyPlus size={18} aria-hidden="true" />} onClick={() => { const w = menu; setMenu(null); void duplicate(w) }}>{tt('workout_duplicate')}</MenuButton>
            <MenuButton icon={<Copy size={18} aria-hidden="true" />} onClick={() => { copyWorkout(menu); toast.success(tt('workout_copied', { name: menu.name })); setMenu(null) }}>{tt('workout_copy')}</MenuButton>
            <MenuButton icon={<ArrowRightLeft size={18} aria-hidden="true" />} onClick={() => { setMoving(menu); setMenu(null) }}>{tt('workout_move')}</MenuButton>
            <MenuButton icon={<Trash2 size={18} aria-hidden="true" />} danger onClick={() => { const w = menu; setMenu(null); remove(w) }}>{tt('workout_delete')}</MenuButton>
          </div>
        </TrainingSheet>
      )}

      {confirmDelete && (
        <TrainingSheet title={tt('plan_delete_title', { name: planName })} onClose={() => setConfirmDelete(false)} zIndex={100} busy={busy}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 8 }}>
            <p style={{ fontSize: 15, lineHeight: 1.45, color: 'var(--lg-text-2)', margin: 0 }}>
              {workouts.length > 0
                ? tt('plan_delete_body', { count: workouts.length, names: workouts.map(w => w.name).join(', ') })
                : tt('plan_delete_body_empty')}
            </p>
            <p style={{ fontSize: 14, color: 'var(--lg-text-3)', margin: 0 }}>{tt('plan_delete_keeps')}</p>
            <Button tone="danger" block disabled={busy} onClick={deletePlan} style={{ minHeight: 50 }}>
              <Trash2 size={16} aria-hidden="true" /> {workouts.length > 0 ? tt('plan_delete_confirm_button', { count: workouts.length }) : tt('plan_delete')}
            </Button>
            <Button tone="ghost" block disabled={busy} onClick={() => setConfirmDelete(false)}>{tt('cancel')}</Button>
          </div>
        </TrainingSheet>
      )}

      {moving && (
        <TrainingSheet title={tt('workout_move_title', { name: moving.name })} onClose={() => setMoving(null)} zIndex={100} busy={busy}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 8 }}>
            {otherPlans.map(plan => (
              <MenuButton key={plan} icon={<ArrowRightLeft size={18} aria-hidden="true" />} disabled={busy} onClick={() => { void moveTo(moving, plan) }}>{plan}</MenuButton>
            ))}
            <MenuButton icon={<ArrowRightLeft size={18} aria-hidden="true" />} disabled={busy} onClick={() => { void moveTo(moving, null) }}>{tt('routine_folder_none')}</MenuButton>
          </div>
        </TrainingSheet>
      )}
    </TrainingSheet>
  )
}

// ─── Bausteine ──────────────────────────────────────────────────────────────

const groupLabel = { margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--lg-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '0 4px' } as const
const card = {
  display: 'flex', flexDirection: 'column', borderRadius: 16,
  background: 'var(--lg-surface-2)', border: '1px solid var(--lg-separator)',
} as const

function Stepper({ value, min, max, label, big, onChange }: { value: number; min: number; max: number; label: string; big: string; onChange: (v: number) => void }) {
  const { tt } = useTrainingText()
  const btn = { width: 44, height: 44, borderRadius: 22, background: 'var(--lg-fill)', color: 'var(--lg-text)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' } as const
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
      <button type="button" aria-label={tt('sched_fewer')} disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} className="tyd-train-press" style={{ ...btn, opacity: value <= min ? 0.35 : 1 }}>
        <Minus size={18} aria-hidden="true" />
      </button>
      <div role="status" aria-label={label} style={{ minWidth: 120, textAlign: 'center' }}>
        <div aria-hidden="true" style={{ fontFamily: 'var(--lg-display)', fontSize: 32, fontWeight: 700, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{big}</div>
        <div aria-hidden="true" style={{ fontSize: 13, color: 'var(--lg-text-3)' }}>{label}</div>
      </div>
      <button type="button" aria-label={tt('sched_more')} disabled={value >= max} onClick={() => onChange(Math.min(max, value + 1))} className="tyd-train-press" style={{ ...btn, opacity: value >= max ? 0.35 : 1 }}>
        <Plus size={18} aria-hidden="true" />
      </button>
    </div>
  )
}

function RowButton({ icon, children, onClick, disabled, danger }: { icon: ReactNode; children: ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="tyd-train-press"
      style={{
        minHeight: 50, display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px', textAlign: 'left', fontSize: 17,
        color: danger ? 'var(--lg-bad-text)' : 'var(--lg-text)', opacity: disabled ? 0.4 : 1,
        borderTop: '0.5px solid var(--lg-separator)', marginTop: -0.5,
      }}
    >
      {icon}{children}
    </button>
  )
}

function MenuButton({ icon, children, onClick, disabled, danger }: { icon: ReactNode; children: ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="tyd-train-press"
      style={{
        minHeight: 50, display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '0 16px', borderRadius: 14,
        fontSize: 17, background: 'var(--lg-surface-2)', color: danger ? 'var(--lg-bad-text)' : 'var(--lg-text)', opacity: disabled ? 0.4 : 1,
      }}
    >
      {icon}{children}
    </button>
  )
}
