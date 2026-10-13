import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays, Clock, Flag, Pause, Pencil, Play, Plus, RotateCcw, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import {
  localDateTimeKey,
  resolveCycleAt,
  type CyclePlanVersion,
  type CycleTimeline,
} from '../../../lib/planTimeline'
import { planVersionSegments } from '../lib/planSegments'
import { isOnDemandRhythm } from '../lib/intakeRhythm'
import { laterLocalDay, shiftLocalDay } from '../lib/localDays'
import { cyclePeriod, inclusiveDayCount, planStepRows } from '../lib/planCard'
import { CurrentSlotRow, StepSlotRow, SyringeNote } from './planCardParts'
import type { SpritzenRechnung, StueckRechnung } from '../lib/bestand'
import {
  dateLabel,
  durationLabel,
  rhythmLabel,
  nextIntakeLabel,
  rhythmLabelWithDay,
  slotCountSuffix,
  stepKindLabel,
  nextIntakeFor,
  versionRhythm,
  versionSlots,
} from '../lib/planLabels'
import { denyProps } from '../../../lib/denyFeedback'
import { useMinuteClock } from '../lib/useMinuteClock'

export interface PlanManagementSectionProps {
  timeline: CycleTimeline
  /** Fester Zeitpunkt (Tests); sonst eine Uhr, die jede Minute weiterspringt. */
  now?: Date
  timeZone: string
  onAdjustPlan(version: CyclePlanVersion): void
  /**
   * Neue Stufe hinter der letzten. `version` ist die letzte Stufe (Vorlage),
   * `minDate` der fruehestmoegliche Tag, `defaultDate` der Vorschlag.
   */
  onAddStep(version: CyclePlanVersion, dates: { minDate: string; maxDate: string | null; defaultDate: string }): void
  onEditFuture(version: CyclePlanVersion): void
  onRemoveFuture(version: CyclePlanVersion): Promise<void>
  onPause(endsAt: string | null): Promise<void>
  onSetPauseEnd(endsAt: string | null): Promise<void>
  onResume(): Promise<void>
  onEnd(): Promise<void>
  onRestart(sourceCycleId: string): Promise<void>
  needsReview?: boolean
  onResolveConflict?(): Promise<void>
  /** Angemischtes Vial: je Einnahme die Einheiten auf der Spritze. */
  syringe?: SpritzenRechnung | null
  /** Was man zaehlt (Spray, Tablette …): je Einnahme die Stueckzahl. */
  stueck?: StueckRechnung | null
}

type DialogState =
  | { kind: 'pause' }
  | { kind: 'pause_end' }
  | { kind: 'remove'; version: CyclePlanVersion }
  | { kind: 'end' }

function wallClockToIso(value: string, timeZone: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) throw new Error('Invalid local date-time')
  const [, yearText, monthText, dayText, hourText, minuteText] = match
  const year = Number(yearText)
  const month = Number(monthText)
  const day = Number(dayText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const calendarCheck = new Date(Date.UTC(year, month - 1, day, hour, minute))
  if (
    calendarCheck.getUTCFullYear() !== year
    || calendarCheck.getUTCMonth() !== month - 1
    || calendarCheck.getUTCDate() !== day
    || hour > 23
    || minute > 59
  ) {
    throw new Error('Invalid local date-time')
  }

  const formatter = new Intl.DateTimeFormat('en-CA-u-ca-iso8601-nu-latn', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const target = `${yearText}-${monthText}-${dayText}T${hourText}:${minuteText}`
  const guess = Date.UTC(year, month - 1, day, hour, minute)
  for (let candidate = guess - 16 * 60 * 60_000; candidate <= guess + 16 * 60 * 60_000; candidate += 60_000) {
    const parts = new Map(formatter.formatToParts(new Date(candidate)).map(part => [part.type, part.value]))
    const candidateWallClock = `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}T${parts.get('hour')}:${parts.get('minute')}`
    if (candidateWallClock === target) return new Date(candidate).toISOString()
  }
  throw new Error(`Local date-time does not exist in ${timeZone}`)
}

export function PlanManagementSection({
  timeline,
  now: fixedNow,
  timeZone,
  onAdjustPlan,
  onAddStep,
  onEditFuture,
  onRemoveFuture,
  onPause,
  onSetPauseEnd,
  onResume,
  onEnd,
  onRestart,
  needsReview = false,
  onResolveConflict,
  syringe = null,
  stueck = null,
}: PlanManagementSectionProps) {
  const { t, i18n } = useTranslation()
  const language = i18n.language || 'de'
  // Wie PlanSummaryCard: eine Uhr je Minute, und die Rechnung dahinter —
  // die naechste Einnahme sucht bis zu einem Jahr voraus — laeuft nur neu,
  // wenn sich Plan, Zeitzone oder die Minute aendern, nicht bei jedem Rendern
  // der Seite (etwa jedem Tastendruck in der Suche).
  const now = useMinuteClock(fixedNow)
  const minute = now.getTime()
  const { resolved, segments, nextIntake } = useMemo(() => {
    const at = new Date(minute)
    const resolvedNow = resolveCycleAt(timeline, at, timeZone)
    return {
      resolved: resolvedNow,
      segments: planVersionSegments(timeline, at, timeZone),
      nextIntake: nextIntakeFor(timeline, resolvedNow.status, at, timeZone),
    }
  }, [timeline, minute, timeZone])
  const currentVersion = resolved.planVersion
  const futureSegments = segments.filter(segment => segment.status === 'future')
  const displayVersion = currentVersion ?? futureSegments[0]?.version ?? null
  const isEnded = resolved.status === 'ended'
  const period = cyclePeriod(timeline, timeZone)
  // Ein beendeter Zyklus zeigt nur, was wirklich galt: eine Stufe ab dem Ende
  // wurde nie erreicht — auch nicht, wenn ihr Datum inzwischen vorbei ist.
  // Und nichts an ihm „gilt jetzt".
  const steps = isEnded
    ? segments
      .filter(segment => period.endKey === null || segment.effectiveFrom < period.endKey)
      .map(segment => ({ ...segment, status: 'past' as const }))
    : segments
  const panelVersion = isEnded ? steps[steps.length - 1]?.version ?? null : displayVersion
  const panelSlots = panelVersion ? versionSlots(panelVersion) : []
  const currentSegment = segments.find(segment => segment.status === 'current') ?? null
  // Eine einzige Stufe steht schon oben — der Verlauf lohnt erst ab zwei. Eine
  // geplante Stufe zeigt er immer, denn nur dort laesst sie sich bearbeiten.
  const showHistory = steps.length >= 2 || steps.some(segment => segment.status === 'future')
  const today = localDateTimeKey(now, timeZone).slice(0, 10)
  // Eine neue Stufe kommt hinter die letzte — geplant oder laufend — und
  // beginnt fruehestens morgen: am Tag einer bestehenden Stufe kann keine
  // zweite anfangen. Vorgeschlagen wird eine Woche nach der letzten.
  const lastStep = steps[steps.length - 1] ?? null
  // Ein festes Ende begrenzt sie: eine Stufe ab dem Ende wuerde nie gelten.
  const addStep = !isEnded && lastStep
    ? (() => {
      const lastDay = lastStep.effectiveFrom.slice(0, 10)
      const minDate = laterLocalDay(shiftLocalDay(lastDay, 1), shiftLocalDay(today, 1))
      if (period.last !== null && minDate > period.last) return null
      const proposed = laterLocalDay(shiftLocalDay(laterLocalDay(lastDay, today), 7), minDate)
      const defaultDate = period.last !== null && proposed > period.last ? period.last : proposed
      return { version: lastStep.version, dates: { minDate, maxDate: period.last, defaultDate } }
    })()
    : null
  // Vor dem Start beendet: der Zyklus lief nie, es gibt keinen Zeitraum.
  const neverRan = period.last !== null && period.last < period.first
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const [pauseEnd, setPauseEnd] = useState('')
  const [pending, setPending] = useState(false)
  const [inlineError, setInlineError] = useState<string | null>(null)
  const pendingRef = useRef(false)
  const dialogRef = useRef<HTMLDivElement>(null)
  const pauseInputRef = useRef<HTMLInputElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)
  const changePending = (value: boolean) => {
    pendingRef.current = value
    setPending(value)
  }

  const statusCopy = {
    planned: t('my_stack_plan_status_planned', { defaultValue: 'Geplant' }),
    active: t('aktiver_zyklus', { defaultValue: 'Aktiver Zyklus' }),
    paused: t('my_stack_plan_status_paused', { defaultValue: 'Pausiert' }),
    ended: t('my_stack_plan_status_ended', { defaultValue: 'Beendet' }),
  }[resolved.status]
  const isActive = resolved.status === 'active'

  const openDialog = (next: DialogState) => {
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null
    setInlineError(null)
    if (next.kind === 'pause_end') {
      const currentEnd = resolved.pause?.ends_at
      setPauseEnd(currentEnd
        ? localDateTimeKey(new Date(currentEnd), timeZone).replace('|', 'T').slice(0, 16)
        : '')
    } else {
      setPauseEnd('')
    }
    setDialog(next)
  }

  const closeDialog = () => {
    if (pendingRef.current) return
    setPauseEnd('')
    setInlineError(null)
    setDialog(null)
  }

  useEffect(() => {
    if (!dialog) return
    const overlay = dialogRef.current?.parentElement
    const background = [...document.body.children].filter(element => element !== overlay)
    const previous = background.map(element => ({
      element: element as HTMLElement,
      inert: (element as HTMLElement).inert,
      ariaHidden: element.getAttribute('aria-hidden'),
    }))
    for (const entry of previous) {
      entry.element.inert = true
      entry.element.setAttribute('aria-hidden', 'true')
    }

    const initialFocus = pauseInputRef.current
      ?? dialogRef.current?.querySelector<HTMLElement>('button:not([disabled])')
      ?? dialogRef.current
    initialFocus?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (!pendingRef.current) closeDialog()
        return
      }
      if (event.key !== 'Tab') return
      const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [])]
      if (focusable.length === 0) {
        event.preventDefault()
        dialogRef.current?.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      for (const entry of previous) {
        entry.element.inert = entry.inert
        if (entry.ariaHidden === null) entry.element.removeAttribute('aria-hidden')
        else entry.element.setAttribute('aria-hidden', entry.ariaHidden)
      }
      previousFocusRef.current?.focus()
    }
  }, [dialog])

  const submitDialog = async () => {
    if (!dialog) return
    changePending(true)
    setInlineError(null)
    try {
      if (dialog.kind === 'pause' || dialog.kind === 'pause_end') {
        const pauseEndInstant = pauseEnd ? wallClockToIso(pauseEnd, timeZone) : null
        if (dialog.kind === 'pause') await onPause(pauseEndInstant)
        else await onSetPauseEnd(pauseEndInstant)
      }
      if (dialog.kind === 'remove') await onRemoveFuture(dialog.version)
      if (dialog.kind === 'end') await onEnd()
      setPauseEnd('')
      setDialog(null)
    } catch {
      setInlineError(String(t('my_stack_plan_action_error', {
        defaultValue: 'Die Änderung konnte nicht gespeichert werden. Bitte versuche es erneut.',
      })))
    } finally {
      changePending(false)
    }
  }

  const resume = async () => {
    changePending(true)
    setInlineError(null)
    try {
      await onResume()
    } catch {
      setInlineError(String(t('my_stack_plan_action_error', {
        defaultValue: 'Die Änderung konnte nicht gespeichert werden. Bitte versuche es erneut.',
      })))
    } finally {
      changePending(false)
    }
  }

  const restart = async () => {
    changePending(true)
    setInlineError(null)
    try {
      await onRestart(timeline.cycle.id)
    } catch {
      setInlineError(String(t('my_stack_plan_restart_error', {
        defaultValue: 'Der Plan konnte nicht neu gestartet werden. Bitte versuche es erneut.',
      })))
    } finally {
      changePending(false)
    }
  }

  const resolveConflict = async () => {
    if (!onResolveConflict) return
    changePending(true)
    setInlineError(null)
    try {
      await onResolveConflict()
    } catch {
      setInlineError(String(t('my_stack_plan_conflict_error', {
        defaultValue: 'Der Konflikt konnte nicht aufgelöst werden. Bitte versuche es erneut.',
      })))
    } finally {
      changePending(false)
    }
  }

  const dialogTitle = dialog?.kind === 'pause'
    ? t('my_stack_plan_pause_title', { defaultValue: 'Plan pausieren' })
    : dialog?.kind === 'pause_end'
      ? t('my_stack_plan_pause_end_title', { defaultValue: 'Pausenende festlegen' })
      : dialog?.kind === 'remove'
        ? t('my_stack_plan_remove_future_title', { defaultValue: 'Geplante Änderung entfernen' })
        : t('my_stack_plan_end_title', { defaultValue: 'Plan beenden' })

  const confirmLabel = dialog?.kind === 'pause'
    ? t('my_stack_plan_pause_confirm', { defaultValue: 'Pause bestätigen' })
    : dialog?.kind === 'pause_end'
      ? t('my_stack_plan_pause_end_confirm', { defaultValue: 'Pausenende speichern' })
      : dialog?.kind === 'remove'
        ? t('my_stack_plan_remove_future_confirm', { defaultValue: 'Änderung entfernen' })
        : t('my_stack_plan_end_confirm', { defaultValue: 'Plan beenden' })

  if (needsReview) {
    return (
      <section
        data-testid={`plan-management-${timeline.cycle.id}`}
        className="rounded-2xl border border-amber-300/25 bg-amber-300/5 p-4 shadow-[0_18px_60px_rgba(2,6,23,0.28)]"
      >
        <p className="text-sm font-bold text-amber-100">
          {t('my_stack_plan_conflict_title', { defaultValue: 'Welcher Plan läuft wirklich?' })}
        </p>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          {t('my_stack_plan_conflict_copy', {
            defaultValue: 'Wähle den Plan, der gerade tatsächlich läuft. Deine bisherigen Einnahmen und der gesamte Verlauf bleiben erhalten.',
          })}
        </p>
        <p className="mt-3 text-xs font-semibold text-slate-400">
          {t('my_stack_plan_conflict_started', {
            defaultValue: 'Gestartet am {{date}}',
            date: dateLabel(timeline.cycle.started_at, language, timeZone),
          })}
        </p>
        <button
          type="button"
          disabled={pending || !onResolveConflict}
          onClick={() => void resolveConflict()}
          className="mt-4 min-h-11 w-full rounded-xl border border-amber-300/30 bg-amber-300/10 px-4 text-sm font-bold text-amber-100 disabled:opacity-50"
        >
          {t('my_stack_plan_conflict_keep', { defaultValue: 'Diesen laufenden Plan behalten' })}
        </button>
        {inlineError && <p role="alert" className="mt-3 text-sm text-rose-200">{inlineError}</p>}
      </section>
    )
  }

  return (
    <section
      data-testid={`plan-management-${timeline.cycle.id}`}
      data-cycle-status={resolved.status}
      className={`rounded-2xl border p-4 backdrop-blur-xl ${isActive
        ? 'border-emerald-400/35 bg-emerald-950/20 shadow-[0_18px_60px_rgba(16,185,129,0.10)]'
        : 'border-white/10 bg-slate-900/55 shadow-[0_18px_60px_rgba(2,6,23,0.28)]'}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${isActive ? 'text-emerald-300' : 'text-cyan-300'}`}>
            {t('my_stack_plan_management', { defaultValue: 'Einnahmeplan' })}
          </p>
          <span
            role="status"
            aria-label={String(statusCopy)}
            className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${isActive
              ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-200'
              : 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100'}`}
          >
            {isActive && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.75)]" />}
            {statusCopy}
          </span>
        </div>
      </div>

      {!isEnded && !displayVersion ? null : (
        <>
          <div className="mt-4 flex items-center gap-2.5">
            <CalendarDays size={16} aria-hidden="true" className={`shrink-0 ${isActive ? 'text-emerald-300' : 'text-cyan-300'}`} />
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-white">
                {dateLabel(`${period.first}|00:00:00`, language, timeZone)}
                {!neverRan && ' – '}
                {neverRan
                  ? null
                  : period.last
                    ? dateLabel(`${period.last}|00:00:00`, language, timeZone)
                    : t('my_stack_plan_open_end', { defaultValue: 'Ende offen' })}
              </p>
              {neverRan ? null : isEnded && period.last ? (
                <p className="mt-0.5 text-xs text-slate-400">
                  {durationLabel(Math.max(1, inclusiveDayCount(period.first, period.last)), t)}
                </p>
              ) : !isEnded && today >= period.first ? (
                <p className="mt-0.5 text-xs text-slate-400">
                  {period.last
                    ? t('my_stack_plan_day_of', {
                      day: Math.min(inclusiveDayCount(period.first, today), inclusiveDayCount(period.first, period.last)),
                      total: inclusiveDayCount(period.first, period.last),
                      defaultValue: 'Tag {{day}} von {{total}}',
                    })
                    : t('my_stack_plan_day', {
                      day: inclusiveDayCount(period.first, today),
                      defaultValue: 'Tag {{day}}',
                    })}
                </p>
              ) : null}
            </div>
          </div>

          {panelVersion && (
            <div className="mt-4 rounded-2xl border border-cyan-300/20 bg-slate-950/45 p-4">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-bold text-white">
                  {isEnded
                    ? t('my_stack_plan_last_plan', { defaultValue: 'Zuletzt' })
                    : resolved.status === 'planned'
                      ? t('my_stack_plan_from_date', {
                        date: dateLabel(`${period.first}|00:00:00`, language, timeZone),
                        defaultValue: 'Ab {{date}}',
                      })
                      : t('my_stack_plan_now', { defaultValue: 'Jetzt' })}
                </h3>
                {!isEnded && currentSegment && (
                  <p className="text-xs text-slate-400">
                    {t('my_stack_plan_valid_since', {
                      date: dateLabel(currentSegment.effectiveFrom, language, timeZone),
                      defaultValue: 'gilt seit {{date}}',
                    })}
                  </p>
                )}
              </div>
              <p className="mt-2 text-[13px] text-slate-300">
                {rhythmLabelWithDay(panelVersion, t, language, !isEnded ? nextIntake?.localDate : null)}
                {slotCountSuffix(panelSlots.length, t)}
              </p>
              {panelSlots.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {panelSlots.map(slot => (
                    <CurrentSlotRow key={slot.id} slot={slot} language={language} t={t} syringe={syringe} stueck={stueck} />
                  ))}
                </ul>
              )}
              {panelSlots.length > 0 && syringe && <div className="mt-2"><SyringeNote syringe={syringe} language={language} t={t} /></div>}

              {isEnded ? null : resolved.status === 'paused' ? (
                <p className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/5 px-3 py-2.5 text-sm text-amber-100">
                  {t('my_stack_plan_pause_neutral', { defaultValue: 'Während der Pause ist keine Einnahme fällig.' })}
                </p>
              ) : (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-slate-700/70 bg-slate-900/70 px-3 py-2.5">
                  <Clock size={15} className="mt-0.5 shrink-0 text-cyan-300" />
                  <div>
                    <p className="text-xs text-slate-500">{t('my_stack_plan_next_intake', { defaultValue: 'Nächste Einnahme' })}</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-100">
                      {nextIntake
                        ? nextIntakeLabel(nextIntake, today, language, t)
                        : t('my_stack_plan_next_intake_none', { defaultValue: 'Keine feste Einnahme geplant' })}
                    </p>
                  </div>
                </div>
              )}

              {!isEnded && currentVersion && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onAdjustPlan(currentVersion)}
                  className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-3 text-sm font-semibold text-cyan-100 disabled:opacity-50"
                >
                  <Pencil size={14} aria-hidden="true" />
                  {t('my_stack_plan_adjust_schedule', { defaultValue: 'Plan anpassen' })}
                </button>
              )}
            </div>
          )}

          {showHistory && (
            <div className="mt-5">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-bold text-white">
                  {t('my_stack_plan_dose_history', { defaultValue: 'Dosisverlauf' })}
                </h3>
                {futureSegments.length > 0 && !isEnded && (
                  <p className="text-[11.5px] text-slate-500">
                    {t('my_stack_plan_planned_count', {
                      planned: futureSegments.length,
                      defaultValue: '{{planned}} geplant',
                    })}
                  </p>
                )}
              </div>
              <ol className="mt-3">
                {steps.map((segment, index) => {
                  const previous = steps[index - 1]?.version ?? null
                  const effectiveDate = dateLabel(segment.effectiveFrom, language, timeZone)
                  const isLast = index === steps.length - 1
                  // Die erste oder einzige Stufe traegt den Plan — ohne sie bliebe keiner.
                  const removable = segment.version.change_kind !== 'initial' && timeline.versions.length > 1
                  const rhythm = rhythmLabel(segment.version, t)
                  const previousRhythm = previous ? rhythmLabel(previous, t) : null
                  const rows = isOnDemandRhythm(versionRhythm(segment.version))
                    ? []
                    : planStepRows(segment.version, previous && !isOnDemandRhythm(versionRhythm(previous)) ? previous : null)
                  const actions = segment.status === 'future' && (
                    <div className="-my-2.5 -mr-1 flex shrink-0">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => onEditFuture(segment.version)}
                        aria-label={String(t('my_stack_plan_edit_future', {
                          defaultValue: 'Geplante Änderung vom {{date}} bearbeiten',
                          date: effectiveDate,
                        }))}
                        className="grid h-11 w-11 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-violet-200 disabled:opacity-50"
                      >
                        <Pencil size={15} />
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        {...denyProps(!removable, String(t('my_stack_plan_remove_locked', {
                          defaultValue: 'Diese Stufe trägt den Plan und lässt sich nicht entfernen.',
                        })))}
                        onClick={() => { if (removable) openDialog({ kind: 'remove', version: segment.version }) }}
                        aria-label={String(t('my_stack_plan_remove_future', {
                          defaultValue: 'Geplante Änderung vom {{date}} entfernen',
                          date: effectiveDate,
                        }))}
                        className="grid h-11 w-11 place-items-center rounded-lg text-slate-400 hover:bg-rose-400/10 hover:text-rose-200 disabled:opacity-50 aria-disabled:opacity-50 aria-disabled:hover:bg-transparent aria-disabled:hover:text-slate-400"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )
                  const header = (
                    <>
                      <div className="flex items-start gap-2">
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                          <p className={`text-[13px] font-bold ${segment.status === 'future' ? 'text-violet-100' : segment.status === 'current' ? 'text-white' : 'text-slate-300'}`}>
                            {effectiveDate} · {stepKindLabel(segment.version, t)}
                          </p>
                          {segment.status === 'current' && (
                            <span className="rounded-full bg-emerald-400/15 px-2 py-px text-[11px] font-bold text-emerald-200">
                              {t('my_stack_plan_step_current', { defaultValue: 'gilt jetzt' })}
                            </span>
                          )}
                          {segment.status === 'future' && (
                            <span className="rounded-full bg-violet-300/15 px-2 py-px text-[11px] font-bold text-violet-200">
                              {t('my_stack_plan_step_planned', { defaultValue: 'geplant' })}
                            </span>
                          )}
                        </div>
                        {actions}
                      </div>
                      {(previousRhythm === null || previousRhythm !== rhythm) && (
                        <p className="mt-1 text-[11.5px] text-slate-400">
                          {previousRhythm !== null && <span className="text-slate-500">{previousRhythm} → </span>}
                          {rhythm}
                        </p>
                      )}
                      {rows.length > 0 && (
                        <ul className="mt-2 space-y-1.5">
                          {rows.map(row => (
                            <StepSlotRow key={`${row.change}-${row.slot.id}`} row={row} language={language} t={t} syringe={syringe} stueck={stueck} />
                          ))}
                        </ul>
                      )}
                    </>
                  )
                  return (
                    <li key={segment.version.id} className="flex gap-3">
                      <div aria-hidden="true" className="flex w-4 shrink-0 flex-col items-center">
                        {segment.status === 'current' ? (
                          <span className="mt-0.5 h-3.5 w-3.5 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.18)]" />
                        ) : segment.status === 'future' ? (
                          <span className="mt-1 h-3 w-3 rounded-full border-2 border-dashed border-violet-300" />
                        ) : (
                          <span className="mt-1 h-3 w-3 rounded-full border-2 border-slate-500" />
                        )}
                        {!isLast && <span className={`w-0.5 flex-1 ${steps[index + 1]?.status === 'future' ? 'bg-violet-300/35' : 'bg-slate-400/25'}`} />}
                      </div>
                      {segment.status === 'future' ? (
                        <div className={`-mt-1.5 min-w-0 flex-1 rounded-xl border border-violet-300/20 bg-violet-300/5 p-2.5 pl-3 ${isLast ? '' : 'mb-4'}`}>
                          {header}
                        </div>
                      ) : (
                        <div className={`min-w-0 flex-1 ${isLast ? '' : 'pb-4'}`}>{header}</div>
                      )}
                    </li>
                  )
                })}
              </ol>
            </div>
          )}

          {addStep && (
            <button
              type="button"
              disabled={pending}
              onClick={() => onAddStep(addStep.version, addStep.dates)}
              className={`${showHistory ? 'ml-7 mt-3 w-[calc(100%-1.75rem)]' : 'mt-4 w-full'} flex min-h-11 items-center justify-center gap-2 rounded-xl border border-dashed border-violet-300/30 px-3 text-sm font-semibold text-violet-100 transition-colors hover:border-violet-300/50 hover:bg-violet-300/5 disabled:opacity-50`}
            >
              {t('my_stack_plan_add_step', { defaultValue: 'Stufe hinzufügen' })}
              <Plus size={15} aria-hidden="true" />
            </button>
          )}

          {isEnded ? (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => void restart()}
                className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 text-sm font-bold text-cyan-100 transition-colors hover:bg-cyan-300/15"
              >
                <RotateCcw size={15} /> {t('my_stack_plan_restart', { defaultValue: 'Neu starten' })}
              </button>
              {inlineError && <p role="alert" className="mt-3 text-sm text-rose-200">{inlineError}</p>}
            </>
          ) : (
            <>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                {resolved.status === 'paused' ? (
                  <>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => void resume()}
                      className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-3 text-sm font-semibold text-emerald-100 disabled:opacity-50"
                    >
                      <Play size={14} /> {t('my_stack_plan_resume', { defaultValue: 'Fortsetzen' })}
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => openDialog({ kind: 'pause_end' })}
                      className="min-h-10 flex-1 rounded-xl border border-amber-300/25 bg-amber-300/10 px-3 text-sm font-semibold text-amber-100 disabled:opacity-50"
                    >
                      {t('my_stack_plan_pause_end', { defaultValue: 'Pausenende festlegen' })}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => openDialog({ kind: 'pause' })}
                    className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-amber-300/25 bg-amber-300/10 px-3 text-sm font-semibold text-amber-100 disabled:opacity-50"
                  >
                    <Pause size={14} /> {t('my_stack_plan_pause', { defaultValue: 'Pausieren' })}
                  </button>
                )}
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => openDialog({ kind: 'end' })}
                  className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-rose-300/25 bg-rose-300/10 px-3 text-sm font-semibold text-rose-100 disabled:opacity-50"
                >
                  <Flag size={14} /> {t('my_stack_plan_end', { defaultValue: 'Beenden' })}
                </button>
              </div>
              {inlineError && !dialog && <p role="alert" className="mt-3 text-sm text-rose-200">{inlineError}</p>}
            </>
          )}
        </>
      )}

      {dialog && createPortal((
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/75 p-4 sm:items-center" data-app-modal>
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={String(dialogTitle)}
            tabIndex={-1}
            className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-950 p-4 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="text-base font-bold text-white">{dialogTitle}</h3>
              <button
                type="button"
                disabled={pending}
                onClick={closeDialog}
                data-app-back-close
                aria-label={String(t('close', { defaultValue: 'Schließen' }))}
                className="grid h-9 w-9 place-items-center rounded-lg text-slate-400 hover:bg-white/5 hover:text-white disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </div>

            {(dialog.kind === 'pause' || dialog.kind === 'pause_end') && (
              <label className="mt-4 block text-sm text-slate-300">
                {dialog.kind === 'pause'
                  ? t('my_stack_plan_pause_until_optional', { defaultValue: 'Pausieren bis (optional)' })
                  : t('my_stack_plan_pause_until', { defaultValue: 'Pausieren bis' })}
                <input
                  ref={pauseInputRef}
                  type="datetime-local"
                  value={pauseEnd}
                  disabled={pending}
                  onChange={event => setPauseEnd(event.target.value)}
                  className="input mt-2 w-full"
                />
              </label>
            )}

            {dialog.kind === 'end' && (
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                {t('my_stack_plan_end_copy', { defaultValue: 'Der Plan endet jetzt. Sein Verlauf bleibt erhalten.' })}
              </p>
            )}

            {dialog.kind === 'remove' && (
              <p className="mt-3 text-sm leading-relaxed text-slate-300">
                {t('my_stack_plan_remove_future_copy', { defaultValue: 'Diese geplante Änderung wird entfernt. Der aktuelle Plan bleibt unverändert.' })}
              </p>
            )}

            {inlineError && <p role="alert" className="mt-3 text-sm text-rose-200">{inlineError}</p>}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={closeDialog}
                className="min-h-11 flex-1 rounded-xl border border-slate-700 px-3 text-sm font-semibold text-slate-300 disabled:opacity-50"
              >
                {t('cancel', { defaultValue: 'Abbrechen' })}
              </button>
              <button
                type="button"
                disabled={pending}
                {...denyProps(dialog.kind === 'pause_end' && !pauseEnd)}
                onClick={() => { if (dialog.kind !== 'pause_end' || pauseEnd) void submitDialog() }}
                className="min-h-11 flex-1 rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-3 text-sm font-bold text-cyan-100 disabled:opacity-50 aria-disabled:opacity-50"
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ), document.body)}
    </section>
  )
}
