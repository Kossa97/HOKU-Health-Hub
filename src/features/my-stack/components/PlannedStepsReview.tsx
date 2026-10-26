import { Trash2, Undo2 } from 'lucide-react'
import type { PlanScheduleSnapshot } from '../../../lib/planTimeline'
import { formatLocalDay } from '../lib/localDays'
import { planCardSlots, planDisplaySlots, planTage } from '../lib/planCard'
import { routineLabel, weekdayLabel, type Translate } from '../lib/planLabels'
import type { ReviewStep } from '../lib/planAdoption'
import { RoutineIcon, SlotList } from './planCardParts'

export interface ReviewStepErrors {
  date?: string
  amount?: string
}

interface PlannedStepsReviewProps {
  steps: ReviewStep[]
  /** Der neue Plan, der ab `boundary` gilt. */
  newPlan: PlanScheduleSnapshot
  /** `YYYY-MM-DD` oder null fuer „ab sofort". */
  boundary: string | null
  minDate: string
  maxDate: string | null
  errors: Record<string, ReviewStepErrors>
  language: string
  t: Translate
  onChange: (versionId: string, changes: Partial<ReviewStep>) => void
}

/**
 * „Geplante Aenderungen": die Stufen hinter dem gewaehlten Tag, bevor
 * gespeichert wird. Jede steht so da, wie sie mit dem neuen Plan aussaehe —
 * Datum und Mengen lassen sich anpassen, eine Stufe laesst sich entfernen.
 * Gespeichert wird erst mit „Bestaetigen".
 */
export function PlannedStepsReview({
  steps,
  newPlan,
  boundary,
  minDate,
  maxDate,
  errors,
  language,
  t,
  onChange,
}: PlannedStepsReviewProps) {
  return (
    <section data-plan-review className="space-y-5">
      <div>
        <h3 data-field="planReview" tabIndex={-1} className="text-lg font-bold text-white focus-visible:outline-none">
          {String(t('my_stack_plan_review_title', { defaultValue: 'Geplante Änderungen' }))}
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-400">
          {String(t('my_stack_plan_review_intro', {
            defaultValue: 'Nach deinem neuen Plan sind schon Stufen geplant. Prüfe sie: Du kannst Datum und Mengen anpassen oder eine Stufe entfernen.',
          }))}
        </p>
      </div>

      <div className="rounded-2xl border border-sky-400/25 bg-sky-400/[0.05] p-4">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-sky-300">
          {boundary
            ? String(t('my_stack_plan_review_new_from_date', { defaultValue: 'Neuer Plan ab {{date}}', date: formatLocalDay(boundary, language) }))
            : String(t('my_stack_plan_review_new_from_now', { defaultValue: 'Neuer Plan ab jetzt' }))}
        </p>
        <SlotList className="mt-3 space-y-2" slots={planDisplaySlots(newPlan)} planDays={planTage(newPlan)} language={language} t={t} />
      </div>

      {steps.map(step => {
        const stepErrors = errors[step.versionId] ?? {}
        const dateId = `plan-review-date-${step.versionId}`
        return (
          <article
            key={step.versionId}
            data-review-step={step.versionId}
            className={`rounded-2xl border p-4 ${step.removed ? 'border-white/[0.06] bg-transparent' : 'border-white/10 bg-white/[0.03]'}`}
          >
            <div className="flex items-center justify-between gap-3">
              <label htmlFor={dateId} className="text-xs font-semibold text-slate-400">
                {String(t('my_stack_plan_review_starts', { defaultValue: 'Beginnt am' }))}
              </label>
              {(step.adopts || step.ownPlan) && (
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${step.adopts ? 'bg-sky-400/15 text-sky-200' : 'bg-white/[0.06] text-slate-300'}`}>
                  {step.adopts
                    ? String(t('my_stack_plan_review_takes_plan', { defaultValue: 'Mit deinem neuen Plan' }))
                    : String(t('my_stack_plan_review_own_plan', { defaultValue: 'Eigener Plan' }))}
                </span>
              )}
            </div>
            <input
              id={dateId}
              type="date"
              value={step.date}
              min={minDate}
              max={maxDate ?? undefined}
              disabled={step.removed}
              aria-invalid={Boolean(stepErrors.date) || undefined}
              onChange={event => onChange(step.versionId, { date: event.target.value })}
              className="input mt-2 min-h-11 w-full text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-50"
            />
            {stepErrors.date && <p role="alert" className="mt-2 text-sm text-rose-300">{stepErrors.date}</p>}

            {step.removed ? (
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-400 line-through">
                  {String(t('my_stack_plan_review_removed', { defaultValue: 'Wird entfernt' }))}
                </p>
                <button
                  type="button"
                  onClick={() => onChange(step.versionId, { removed: false })}
                  className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-semibold text-sky-300 hover:text-sky-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                >
                  <Undo2 size={16} aria-hidden="true" />
                  {String(t('my_stack_plan_review_undo', { defaultValue: 'Rückgängig' }))}
                </button>
              </div>
            ) : (
              <>
                <ul className="mt-3 space-y-2">
                  {planCardSlots(step.proposed).map(slot => {
                    // Hier bleibt jede gespeicherte Einnahme eine eigene Zeile —
                    // jede hat ihr eigenes Mengenfeld. Damit man weiss, welches
                    // Feld zu welchem Tag gehoert, stehen die Tage mit dabei.
                    const tage = slot.days.map(day => weekdayLabel(day, language)).join(', ')
                    const label = [routineLabel(slot, t), slot.time, tage].filter(Boolean).join(' · ')
                    const isNew = step.newSlotIds.includes(slot.id)
                    return (
                      <li key={slot.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                        <RoutineIcon group={slot.routineGroup} />
                        <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-slate-100">
                          <span>{label}</span>
                          {isNew && (
                            <span className="shrink-0 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-300">
                              {String(t('my_stack_plan_review_new_badge', { defaultValue: 'neu' }))}
                            </span>
                          )}
                        </p>
                        {step.proposed.unit != null ? (
                          <span className="flex items-center gap-1.5">
                            <input
                              type="text"
                              inputMode="decimal"
                              aria-label={label}
                              value={step.amounts[slot.id] ?? ''}
                              aria-invalid={Boolean(stepErrors.amount) || undefined}
                              onChange={event => onChange(step.versionId, {
                                amounts: { ...step.amounts, [slot.id]: event.target.value },
                              })}
                              className="input min-h-11 w-20 text-right text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                            />
                            <span className="text-sm text-slate-400">{step.proposed.unit}</span>
                          </span>
                        ) : <span />}
                      </li>
                    )
                  })}
                </ul>
                {stepErrors.amount && <p role="alert" className="mt-2 text-sm text-rose-300">{stepErrors.amount}</p>}
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => onChange(step.versionId, { removed: true })}
                    className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl px-3 text-sm font-semibold text-rose-300 hover:text-rose-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                  >
                    <Trash2 size={16} aria-hidden="true" />
                    {String(t('my_stack_plan_review_remove', { defaultValue: 'Stufe entfernen' }))}
                  </button>
                </div>
              </>
            )}
          </article>
        )
      })}
    </section>
  )
}
