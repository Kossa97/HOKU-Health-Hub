import { useMemo, type ReactNode } from 'react'
import { useMinuteClock } from '../lib/useMinuteClock'
import { ChevronRight, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { localDateTimeKey, type CycleTimeline } from '../../../lib/planTimeline'
import { planVersionSegments } from '../lib/planSegments'
import { cyclePeriod, inclusiveDayCount, planStepRows } from '../lib/planCard'
import {
  dateLabel,
  durationLabel,
  nextIntakeFor,
  orderTimelines,
  nextIntakeLabel,
  rhythmLabelWithDay,
  slotCountSuffix,
  slotDoseLabel,
  stepKindLabel,
  versionSlots,
  type Translate,
} from '../lib/planLabels'
import { CurrentSlotRow, SyringeNote } from './planCardParts'
import { aufzuziehendeEinheiten, stueckZahl, type SpritzenRechnung, type StueckRechnung } from '../lib/bestand'
import { formatAmount, stockAmountLabel } from '../lib/bestandLabels'

export interface PlanSummaryCardProps {
  timelines: CycleTimeline[]
  /** Fest vorgegeben nur in Tests; sonst laeuft die Karte mit der Uhr. */
  now?: Date
  timeZone: string
  /** Solange die Plaene laden oder nicht geladen werden konnten, sagt die Karte das — statt „kein Zyklus". */
  loadState?: 'ready' | 'loading' | 'error'
  needsReview?: boolean
  /** Angemischtes Vial: je Einnahme die Einheiten auf der Spritze. */
  syringe?: SpritzenRechnung | null
  /** Was man zaehlt (Spray, Tablette …): je Einnahme die Stueckzahl. */
  stueck?: StueckRechnung | null
  /** Oeffnet die volle Plan-Uebersicht (Zyklusverwalter). */
  onOpen(): void
  onStartNew(): void
}

const OPEN_BUTTON = 'flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-3 text-sm font-semibold text-cyan-100 transition-colors hover:bg-cyan-300/15'
const QUIET_BUTTON = 'flex min-h-11 items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 px-3 text-sm font-semibold text-slate-300 transition-colors hover:text-white'
const TONE = {
  active: 'border-emerald-400/35 bg-emerald-950/20',
  neutral: 'border-white/10 bg-slate-900/55',
  empty: 'border-dashed border-slate-500/30 bg-slate-900/40',
  warning: 'border-amber-300/25 bg-amber-300/5',
} as const

/**
 * Der Plan in Kurzform, oben im Vollbild: was gerade gilt, wann die naechste
 * Einnahme ist und ob eine Stufe ansteht. Alles Weitere — Verlauf, Pause,
 * Aendern — steht in der vollen Uebersicht, ein Tipp entfernt.
 */
export function PlanSummaryCard({
  timelines,
  now: fixedNow,
  timeZone,
  loadState = 'ready',
  needsReview = false,
  syringe = null,
  stueck = null,
  onOpen,
  onStartNew,
}: PlanSummaryCardProps) {
  const { t, i18n } = useTranslation()
  const language = i18n?.language || 'de'
  const tr = t as Translate
  const now = useMinuteClock(fixedNow)
  const minute = now.getTime()

  // Alles, was sich nur mit Plan und Minute aendert, einmal je Minute —
  // die naechste Einnahme sucht bis zu einem Jahr voraus.
  const plan = useMemo(() => {
    const at = new Date(minute)
    const best = orderTimelines(timelines, at, timeZone)[0] ?? null
    if (!best || best.resolved.status === 'ended') return { kind: 'none' as const, best }
    const segments = planVersionSegments(best.timeline, at, timeZone)
    const version = best.resolved.planVersion ?? segments.find(segment => segment.status === 'future')?.version ?? null
    if (!version) return { kind: 'none' as const, best }
    const slots = versionSlots(version)
    const nextStep = segments.find(segment => segment.status === 'future' && segment.version.id !== version.id) ?? null
    return {
      kind: 'running' as const,
      status: best.resolved.status,
      timeline: best.timeline,
      version,
      slots,
      nextStep,
      // Nur Einnahmen, deren MENGE sich aendert. Eine verschobene Uhrzeit
      // bei gleicher Menge ist keine neue Dosis.
      nextStepSlots: nextStep
        ? planStepRows(nextStep.version, version)
          .filter(row => row.change === 'new' || (row.previous !== null && row.change !== 'removed'
            && slotDoseLabel(row.previous) !== slotDoseLabel(row.slot)))
          .map(row => row.slot)
          .filter(slot => slotDoseLabel(slot) !== null)
        : null,
      nextIntake: slots.length > 0 ? nextIntakeFor(best.timeline, best.resolved.status, at, timeZone) : null,
    }
  }, [timelines, minute, timeZone])

  const title = String(t('my_stack_plan_management', { defaultValue: 'Einnahmeplan' }))
  const openButton = (
    <button type="button" onClick={onOpen} className={OPEN_BUTTON}>
      {t('my_stack_plan_open_overview', { defaultValue: 'Plan & Verlauf öffnen' })}
      <ChevronRight size={16} aria-hidden="true" />
    </button>
  )
  const card = (state: string, tone: keyof typeof TONE, body: ReactNode) => (
    <section data-plan-summary={state} aria-label={title} className={`mx-1 mt-2 flex flex-col gap-3 rounded-2xl border p-3.5 ${TONE[tone]}`}>
      {body}
    </section>
  )
  const kicker = (
    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-cyan-300">{title}</p>
  )

  if (loadState !== 'ready') {
    return card(loadState, loadState === 'error' ? 'warning' : 'empty', (
      <>
        {kicker}
        <p role={loadState === 'error' ? 'alert' : 'status'} className="text-sm text-slate-300">
          {loadState === 'error'
            ? t('my_stack_plan_load_error', { defaultValue: 'Die Einnahmepläne konnten nicht geladen werden. Deine übrigen Daten bleiben verfügbar.' })
            : t('my_stack_plan_loading', { defaultValue: 'Einnahmeplan wird geladen …' })}
        </p>
      </>
    ))
  }

  // Ein Plan im Konflikt oder mit offener Zeitzone: die Uebersicht klaert
  // das zuerst; bis dahin sind Einnahmen gesperrt — die Karte nennt keine.
  const timezoneReview = timelines.some(timeline => timeline.cycle.timezone_review_required)
  if (needsReview || timezoneReview) {
    return card('review', 'warning', (
      <>
        <p className="text-sm font-bold text-amber-100">
          {needsReview
            ? t('my_stack_plan_conflict_title', { defaultValue: 'Welcher Plan läuft wirklich?' })
            : t('my_stack_course_timezone_review', { defaultValue: 'Die ursprünglichen Start- und Enddaten benötigen eine Zeitzone. Bis zur Bestätigung bleiben Einnahmen und Erinnerungen gesperrt.' })}
        </p>
        {openButton}
      </>
    ))
  }

  if (plan.kind === 'none') {
    const period = plan.best ? cyclePeriod(plan.best.timeline, timeZone) : null
    return card('none', 'empty', (
      <>
        <div>
          {kicker}
          <p className="mt-1 text-sm font-semibold text-white">
            {plan.best
              ? t('kein_aktiver_zyklus', { defaultValue: 'Kein aktiver Zyklus' })
              : t('noch_kein_zyklus', { defaultValue: 'Noch kein Zyklus' })}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {period?.last && period.last >= period.first
              ? t('my_stack_plan_last_period', {
                defaultValue: 'Zuletzt: {{period}}',
                period: `${dateLabel(`${period.first}|00:00:00`, language, timeZone)} – ${dateLabel(`${period.last}|00:00:00`, language, timeZone)} · ${durationLabel(inclusiveDayCount(period.first, period.last), tr)}`,
              })
              : !plan.best && t('noch_kein_zyklus_desc', { defaultValue: 'Lege einen Zyklus an, um Dosis, Frequenz und Reminder für diese Substanz zu planen.' })}
          </p>
        </div>
        <div className={`grid gap-2 ${plan.best ? 'grid-cols-2' : 'grid-cols-1'}`}>
          <button type="button" onClick={onStartNew} className={OPEN_BUTTON}>
            {t('my_stack_plan_start_new', { defaultValue: 'Neuen Zyklus starten' })}
          </button>
          {plan.best && (
            <button type="button" onClick={onOpen} className={QUIET_BUTTON}>
              {t('my_stack_plan_view_history', { defaultValue: 'Verlauf ansehen' })}
            </button>
          )}
        </div>
      </>
    ))
  }

  const { status, timeline, version, slots, nextStep, nextStepSlots, nextIntake } = plan
  const nextStepDoses = nextStepSlots ? new Set(nextStepSlots.map(slot => slotDoseLabel(slot))) : null
  // Beim angemischten Vial auch hier die Einheiten: „2 mg · 6 E".
  const nextStepUnits = syringe && nextStepSlots?.[0] && nextStepDoses?.size === 1
    ? aufzuziehendeEinheiten(nextStepSlots[0].dose, nextStepSlots[0].unit, syringe)
    : null
  // Bei allem, was man zaehlt, die Stueckzahl: „600 mcg · 2 Sprühstöße".
  const nextStepStueck = stueck && nextStepSlots?.[0] && nextStepDoses?.size === 1
    ? stueckZahl(nextStepSlots[0].dose, nextStepSlots[0].unit, stueck)
    : null
  const period = cyclePeriod(timeline, timeZone)
  const today = localDateTimeKey(now, timeZone).slice(0, 10)
  // Was die naechste Stufe aendert, in einem Wort: die neue Menge, wenn es
  // genau eine ist — sonst die Art der Stufe.
  const nextStepText = nextStep && nextStepDoses
    ? nextStepDoses.size === 1
      ? [
        [...nextStepDoses][0],
        nextStepUnits != null ? String(tr('my_stack_plan_units_short', { units: formatAmount(nextStepUnits, language) })) : null,
        nextStepStueck != null && stueck ? stockAmountLabel(tr, nextStepStueck, stueck.stueck, language) : null,
      ].filter(Boolean).join(' · ')
      : stepKindLabel(nextStep.version, tr)
    : null
  const isActive = status === 'active'
  const statusLabel = {
    active: t('aktiver_zyklus', { defaultValue: 'Aktiver Zyklus' }),
    paused: t('my_stack_plan_status_paused', { defaultValue: 'Pausiert' }),
    planned: t('my_stack_plan_status_planned', { defaultValue: 'Geplant' }),
  }[status]

  return card(status, isActive ? 'active' : 'neutral', (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold ${isActive
          ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-200'
          : 'border-cyan-300/25 bg-cyan-300/10 text-cyan-100'}`}>
          {isActive && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
          {statusLabel}
        </span>
        <span className="text-xs text-slate-400">
          {status === 'planned' || today < period.first
            ? t('my_stack_plan_from_date', { defaultValue: 'Ab {{date}}', date: dateLabel(`${period.first}|00:00:00`, language, timeZone) })
            : t('my_stack_plan_since_day', {
              defaultValue: 'seit {{date}} · Tag {{day}}',
              date: dateLabel(`${period.first}|00:00:00`, language, timeZone),
              day: inclusiveDayCount(period.first, today),
            })}
        </span>
      </div>

      <div>
        <p className="text-xs text-slate-400">
          {rhythmLabelWithDay(version, tr, language, nextIntake?.localDate)}
          {slotCountSuffix(slots.length, tr)}
        </p>
        {slots.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {slots.map(slot => <CurrentSlotRow key={slot.id} slot={slot} language={language} t={tr} syringe={syringe} stueck={stueck} />)}
          </ul>
        )}
        {slots.length > 0 && syringe && <div className="mt-2"><SyringeNote syringe={syringe} language={language} t={tr} /></div>}
      </div>

      <div className={`grid gap-2 ${nextStepText ? 'grid-cols-2' : 'grid-cols-1'}`}>
        {status === 'paused' ? (
          <p className="rounded-xl border border-amber-300/20 bg-amber-300/5 px-3 py-2 text-xs text-amber-100">
            {t('my_stack_plan_pause_neutral', { defaultValue: 'Während der Pause ist keine Einnahme fällig.' })}
          </p>
        ) : (
          <div className="min-w-0 rounded-xl border border-slate-700/70 bg-slate-900/70 px-3 py-2">
            <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <Clock size={12} aria-hidden="true" />
              {t('my_stack_plan_next_intake', { defaultValue: 'Nächste Einnahme' })}
            </p>
            <p className="mt-0.5 text-sm font-semibold text-slate-100">
              {nextIntake
                ? nextIntakeLabel(nextIntake, today, language, tr)
                : t('my_stack_plan_next_intake_none', { defaultValue: 'Keine feste Einnahme geplant' })}
            </p>
          </div>
        )}
        {nextStep && nextStepText && (
          <div className="min-w-0 rounded-xl border border-violet-300/25 bg-violet-300/5 px-3 py-2">
            <p className="text-[11px] text-slate-500">{t('my_stack_plan_next_step', { defaultValue: 'Nächste Stufe' })}</p>
            <p className="mt-0.5 text-sm font-semibold text-violet-100">
              {dateLabel(nextStep.effectiveFrom, language, timeZone)} · {nextStepText}
            </p>
          </div>
        )}
      </div>

      {openButton}
    </>
  ))
}
