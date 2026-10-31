import { Moon, Sun, Sunrise } from 'lucide-react'
import type { ResolvedRoutineGroup } from '../../../lib/intakeSchedule'
import { WEEKDAY_KEYS } from '../lib/intakeRhythm'
import type { PlanCardSlot, PlanStepRow } from '../lib/planCard'
import { aufzuziehendeEinheiten, stueckZahl, type SpritzenRechnung, type StueckRechnung } from '../lib/bestand'
import { formatAmount, stockAmountLabel } from '../lib/bestandLabels'
import {
  chipLabels,
  routineLabel,
  slotDoseLabel,
  weekdayLabel,
  type Translate,
} from '../lib/planLabels'

/** Bausteine der Plan-Darstellung, geteilt von Plan-Uebersicht und Kurzfassung. */

export function RoutineIcon({ group }: { group: ResolvedRoutineGroup }) {
  if (group === 'morning') return <Sunrise size={16} aria-hidden="true" className="shrink-0 text-[var(--lg-text-3)]" />
  if (group === 'midday') return <Sun size={16} aria-hidden="true" className="shrink-0 text-[var(--lg-text-3)]" />
  return <Moon size={16} aria-hidden="true" className="shrink-0 text-[var(--lg-text-3)]" />
}

export function DayChips({ days, language }: { days: string[]; language: string }) {
  const labels = chipLabels(language)
  return (
    <span aria-hidden="true" className="mt-1.5 flex flex-wrap gap-0.5">
      {WEEKDAY_KEYS.map((day, index) => {
        const active = days.includes(day)
        return (
          <span
            key={day}
            className={`grid h-5 min-w-5 place-items-center rounded-md px-0.5 text-[11px] font-medium ${active
              ? 'bg-sky-300/15 text-sky-100'
              : 'border border-white/10 text-slate-600'}`}
          >
            {labels[index]}
          </span>
        )
      })}
    </span>
  )
}

/** Einheiten auf der Spritze fuer diese Einnahme, als Zahl-Text — oder null. */
function drawUnits(slot: PlanCardSlot, syringe: SpritzenRechnung | null | undefined, language: string): string | null {
  if (!syringe) return null
  const units = aufzuziehendeEinheiten(slot.dose, slot.unit, syringe)
  return units == null ? null : formatAmount(units, language)
}

/**
 * Was die Menge einer Einnahme praktisch heisst: beim angemischten Vial die
 * Einheiten auf der Spritze („= 6 E aufziehen"), bei allem, was man zaehlt,
 * die Stueckzahl („= 2 Sprühstöße", „= 1 Tablette"). `kurz` fuer die
 * Stufen-Zeilen: „6 E", „2 Sprühstöße".
 */
function einnahmeHinweis(
  slot: PlanCardSlot,
  syringe: SpritzenRechnung | null | undefined,
  stueck: StueckRechnung | null | undefined,
  t: Translate,
  language: string,
  kurz: boolean,
): string | null {
  const units = drawUnits(slot, syringe, language)
  if (units) return String(t(kurz ? 'my_stack_plan_units_short' : 'my_stack_plan_draw_units', { units }))
  if (!stueck) return null
  const anzahl = stueckZahl(slot.dose, slot.unit, stueck)
  if (anzahl == null) return null
  const text = stockAmountLabel(t, anzahl, stueck.stueck, language)
  return kurz ? text : `= ${text}`
}

/**
 * Woraus die Spritzeneinheiten berechnet sind — damit „3 E" nachpruefbar ist:
 * „aus 50 mg auf 1,5 ml (33,3 mg/ml)".
 */
export function SyringeNote({ syringe, language, t }: { syringe: SpritzenRechnung; language: string; t: Translate }) {
  return (
    <p className="text-[11px] text-slate-500">
      {String(t('my_stack_plan_units_note', {
        amount: `${formatAmount(syringe.imVial, language)} ${syringe.einheit}`,
        ml: formatAmount(syringe.ml, language),
        perMl: `${new Intl.NumberFormat(language, { maximumFractionDigits: 1 }).format(syringe.proMl)} ${syringe.einheit}`,
      }))}
    </p>
  )
}

/**
 * „Abends" oder „Abends · 20:00" — die Uhrzeit nur, wenn der Plan eine eigene
 * hat. Vorher stand immer eine da (die Standardzeit der Tageszeit), auch wenn
 * man bewusst nur „Abends" gewaehlt hatte.
 */
function zeitLabel(slot: PlanCardSlot, t: Translate): string {
  return slot.customTime ? `${routineLabel(slot, t)} · ${slot.time}` : routineLabel(slot, t)
}

export function CurrentSlotRow({ slot, language, t, syringe, stueck }: { slot: PlanCardSlot; language: string; t: Translate; syringe?: SpritzenRechnung | null; stueck?: StueckRechnung | null }) {
  const dose = slotDoseLabel(slot)
  const hinweis = einnahmeHinweis(slot, syringe, stueck, t, language, false)
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl bg-[var(--lg-fill)] px-4 py-3">
      <RoutineIcon group={slot.routineGroup} />
      <div className="min-w-0">
        <p className="text-[15px] font-medium text-[var(--lg-text)]">
          {zeitLabel(slot, t)}
        </p>
        {slot.days.length > 0 && (
          <span className="sr-only">{slot.days.map(day => weekdayLabel(day, language)).join(', ')}</span>
        )}
      </div>
      {dose && (
        <p className="flex flex-col items-end whitespace-nowrap">
          <span className="text-[17px] font-medium tabular-nums text-[var(--lg-text)]">{dose}</span>
          {hinweis && <span data-einnahme-hinweis className="text-[13px] font-medium text-[var(--lg-accent-text)]">{hinweis}</span>}
        </p>
      )}
      {slot.days.length > 0 && (
        <div className="col-span-2 col-start-2 -mt-1.5">
          <DayChips days={slot.days} language={language} />
        </div>
      )}
    </li>
  )
}

export function ChangeMarker({ change, t }: { change: PlanStepRow['change']; t: Translate }) {
  if (change === 'initial') return null
  if (change === 'same') {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-slate-500/25 px-1.5 py-px text-[11px] font-medium text-slate-400">
        <span aria-hidden="true" className="text-xs leading-none">=</span>
        {String(t('my_stack_plan_change_same', { defaultValue: 'gleich' }))}
      </span>
    )
  }
  const copy = {
    increased: { text: t('my_stack_plan_change_increased', { defaultValue: 'erhöht' }), arrow: '↑', tone: 'bg-emerald-400/15 text-emerald-200' },
    decreased: { text: t('my_stack_plan_change_decreased', { defaultValue: 'reduziert' }), arrow: '↓', tone: 'bg-amber-300/15 text-amber-100' },
    changed: { text: t('my_stack_plan_change_changed', { defaultValue: 'geändert' }), arrow: '', tone: 'bg-white/[0.08] text-slate-200' },
    new: { text: t('my_stack_plan_change_new', { defaultValue: 'neu' }), arrow: '', tone: 'bg-sky-300/15 text-sky-100' },
    removed: { text: t('my_stack_plan_change_removed', { defaultValue: 'entfällt' }), arrow: '', tone: 'bg-rose-300/10 text-rose-200' },
  }[change]
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-px text-[11px] font-medium ${copy.tone}`}>
      {copy.arrow && <span aria-hidden="true">{copy.arrow}</span>}
      {String(copy.text)}
    </span>
  )
}

export function StepSlotRow({ row, language, t, syringe, stueck }: { row: PlanStepRow; language: string; t: Translate; syringe?: SpritzenRechnung | null; stueck?: StueckRechnung | null }) {
  const { slot, previous, change } = row
  const hinweis = change === 'removed' ? null : einnahmeHinweis(slot, syringe, stueck, t, language, true)
  const quiet = change === 'same' || change === 'removed'
  const dose = slotDoseLabel(slot)
  const previousDose = previous ? slotDoseLabel(previous) : null
  const doseMoved = previous != null && change !== 'removed' && previousDose !== dose
  const timeMoved = previous != null && change !== 'removed' && previous.time !== slot.time
  const days = slot.days.map(day => weekdayLabel(day, language)).join(', ')
  return (
    <li
      className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-3 py-2 ${quiet
        ? 'border-white/[0.04]'
        : 'border-white/[0.08] bg-white/[0.045]'}`}
    >
      <RoutineIcon group={slot.routineGroup} />
      <div className="min-w-0">
        <p className={`text-[13px] font-medium ${quiet ? 'text-slate-400' : 'text-slate-100'}`}>
          {routineLabel(slot, t)} · {timeMoved && <span className="font-medium text-slate-500">{previous.time} → </span>}{slot.time}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
          {days && <span>{days}</span>}
          <ChangeMarker change={change} t={t} />
        </p>
      </div>
      {dose && (
        <p className={`flex flex-col items-end whitespace-nowrap text-sm font-medium tabular-nums ${quiet ? 'text-slate-400' : 'text-white'} ${change === 'removed' ? 'line-through' : ''}`}>
          {doseMoved && previousDose && (
            <span className="text-[11px] tabular-nums text-slate-500">{previousDose} →</span>
          )}
          <span>{dose}{hinweis && <span className="font-medium text-sky-300"> · {hinweis}</span>}</span>
        </p>
      )}
    </li>
  )
}

/**
 * Die Einnahmen eines Plans. Unterscheiden sich die Tage — „Montag abends,
 * Freitag morgens" —, steht je Tag eine Zeile, der Tag vorn. Vorher kam die
 * Tageszeit zuerst und der Tag als Leiste darunter; man musste sich den Plan
 * aus zwei Zeilen zusammensetzen.
 *
 * `planDays`: die Tage des Rhythmus bei „bestimmte Wochentage", sonst null.
 */
export function SlotList({ slots, planDays, language, t, syringe, stueck, className = 'space-y-1.5' }: {
  slots: PlanCardSlot[]
  planDays: readonly string[] | null
  language: string
  t: Translate
  syringe?: SpritzenRechnung | null
  stueck?: StueckRechnung | null
  className?: string
}) {
  // Nur bei „bestimmte Wochentage": bei taeglich mit einer Ausnahme
  // („abends nur Mo, Mi, Fr") staenden sonst sieben Zeilen da.
  // Je Tag nur, wenn jede Einnahme an einem der Plantage liegt — sonst fiele
  // eine (veraltete) Einnahme an einem anderen Tag stillschweigend weg.
  const jeTag = planDays != null && planDays.length > 0 && slots.some(slot => slot.days.length > 0)
    && slots.every(slot => slot.days.length === 0 || slot.days.some(tag => planDays.includes(tag)))
  if (!jeTag) {
    return (
      <ul className={className}>
        {slots.map(slot => <CurrentSlotRow key={slot.id} slot={slot} language={language} t={t} syringe={syringe} stueck={stueck} />)}
      </ul>
    )
  }
  const tage = WEEKDAY_KEYS
    .filter(tag => planDays.includes(tag))
    .map(tag => ({ tag, slots: slots.filter(slot => slot.days.length === 0 || slot.days.includes(tag)) }))
    .filter(eintrag => eintrag.slots.length > 0)
  return (
    <ul data-plan-days className={className}>
      {tage.map(({ tag, slots: amTag }) => (
        <li key={tag} data-plan-day={tag} className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-start gap-3 rounded-2xl bg-[var(--lg-fill)] px-4 py-3">
          <span className="pt-0.5 text-[15px] font-medium text-[var(--lg-text)]">{weekdayLabel(tag, language)}</span>
          <div className="min-w-0 space-y-2">
            {amTag.map(slot => {
              const dose = slotDoseLabel(slot)
              const hinweis = einnahmeHinweis(slot, syringe, stueck, t, language, false)
              return (
                <div key={slot.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                  <RoutineIcon group={slot.routineGroup} />
                  <p className="min-w-0 truncate text-[15px] font-medium text-[var(--lg-text)]">{zeitLabel(slot, t)}</p>
                  {dose && (
                    <p className="flex flex-col items-end whitespace-nowrap">
                      <span className="text-[17px] font-medium tabular-nums text-[var(--lg-text)]">{dose}</span>
                      {hinweis && <span data-einnahme-hinweis className="text-[13px] font-medium text-[var(--lg-accent-text)]">{hinweis}</span>}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </li>
      ))}
    </ul>
  )
}
