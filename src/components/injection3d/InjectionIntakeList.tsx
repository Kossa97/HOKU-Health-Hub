// src/components/injection3d/InjectionIntakeList.tsx
//
// Einnahmen ohne Injektionsstelle (offen und schon bestaetigt). Dieselbe
// Liste fuer beide Wege: erst Einnahme, dann Stelle (Tracker-Knopf
// „Einnahmen“) und erst Stelle, dann Einnahme (nach „Position uebernehmen“).
import { useMemo, useState, type ReactNode } from 'react'
import { format, parseISO } from 'date-fns'
import { Check, CheckCircle2, Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { methodLabel } from '../../lib/intakeMethods'
import type { OpenInjectionIntake } from '../../lib/injectionPersistence'
import { getOpenInjectionIntakeKey } from '../../lib/injectionDeepLink'
import {
  filterOpenInjectionIntakes,
  INTAKE_DAY_OPTIONS,
  type IntakeHistoryDays,
} from '../../lib/openInjectionIntakeFilters'

type Translate = ReturnType<typeof useTranslation>['t']

export function InjectionIntakeList({
  intakes,
  onSelect,
  footer,
}: {
  intakes: OpenInjectionIntake[]
  onSelect: (intake: OpenInjectionIntake) => void
  footer?: ReactNode
}) {
  const { t } = useTranslation()
  const [substanceId, setSubstanceId] = useState('all')
  const [days, setDays] = useState<IntakeHistoryDays>(7)

  const substances = useMemo(() => Array.from(
    new Map(intakes.map(intake => [intake.stackItemId, intake.stackItemName] as const)),
    ([id, label]) => ({ id, label }),
  ).sort((a, b) => a.label.localeCompare(b.label)), [intakes])

  // Verschwindet die gewaehlte Substanz aus der Liste, gilt wieder „Alle“.
  const activeSubstanceId = substances.some(item => item.id === substanceId) ? substanceId : 'all'
  const visible = useMemo(() => filterOpenInjectionIntakes(intakes, {
    stackItemId: activeSubstanceId,
    days,
    order: 'newest',
    status: 'all',
  }), [activeSubstanceId, days, intakes])

  return (
    <div className="space-y-3">
      {substances.length > 1 && (
        <div
          role="group"
          aria-label={String(t('injection_filter_substance', { defaultValue: 'Substanz' }))}
          className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1"
        >
          {[{ id: 'all', label: String(t('injection_filter_all', { defaultValue: 'Alle' })) }, ...substances].map(item => {
            const active = item.id === activeSubstanceId
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => setSubstanceId(item.id)}
                className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-bold transition-transform active:scale-[0.97] ${active ? 'border-sky-300/40 bg-sky-400/15 text-sky-200' : 'border-white/10 bg-white/[0.04] text-slate-300'}`}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      )}

      <label className="flex items-center justify-between gap-3">
        <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-400">
          {t('injection_filter_period', { defaultValue: 'Zeitraum' })}
        </span>
        <select
          className="h-10 rounded-xl border border-white/10 bg-black/20 px-2.5 text-sm font-bold text-slate-200 outline-none"
          value={days}
          onChange={event => {
            const value = event.target.value
            setDays(value === 'all' ? 'all' : Number(value) as IntakeHistoryDays)
          }}
        >
          {INTAKE_DAY_OPTIONS.map(option => (
            <option key={option} value={option}>{periodLabel(option, t)}</option>
          ))}
        </select>
      </label>

      {visible.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
          <CheckCircle2 size={22} className="mx-auto mb-2 text-emerald-300" aria-hidden="true" />
          <p className="text-sm font-black text-white">{t('injection_intakes_empty_title', { defaultValue: 'Keine Einnahmen ohne Stelle' })}</p>
          <p className="mt-1 text-xs leading-5 text-slate-400">{t('injection_intakes_empty_body', { defaultValue: 'In diesem Zeitraum hat jede Einnahme schon eine Stelle.' })}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map(intake => (
            <li key={getOpenInjectionIntakeKey(intake)}>
              <InjectionIntakeRow intake={intake} onSelect={() => onSelect(intake)} />
            </li>
          ))}
        </ul>
      )}

      {footer}
    </div>
  )
}

export function InjectionIntakeSummary({ intake }: { intake: OpenInjectionIntake }) {
  const { t } = useTranslation()
  const confirmed = intake.status === 'confirmed'
  return (
    <div className="flex w-full min-w-0 items-center gap-3 overflow-hidden text-left">
      <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${confirmed ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-300'}`}>
        {confirmed ? <Check size={16} aria-hidden="true" /> : <Clock size={16} aria-hidden="true" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-white">{intake.stackItemName}</p>
        <p className="text-xs text-slate-400">
          <span className={confirmed ? 'text-emerald-300' : 'text-amber-300'}>
            {confirmed
              ? t('injection_status_confirmed', { defaultValue: 'Bestätigt' })
              : t('injection_status_open', { defaultValue: 'Offen' })}
          </span>
          {' · '}{format(parseISO(intake.scheduledAt), 'dd.MM. HH:mm')}
          {!confirmed ? ` · ${dueLabel(intake.daysOverdue, t)}` : ''}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-bold text-sky-300">{intake.dose} {intake.unit}</p>
        <p className="text-[0.62rem] text-slate-500">{methodLabel(t, intake.method)}</p>
      </div>
    </div>
  )
}

function InjectionIntakeRow({ intake, onSelect }: { intake: OpenInjectionIntake; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full rounded-2xl border border-white/10 bg-white/[0.03] p-3 transition-transform active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
    >
      <InjectionIntakeSummary intake={intake} />
    </button>
  )
}

function periodLabel(days: IntakeHistoryDays, t: Translate): string {
  if (days === 'all') return String(t('injection_history_all', { defaultValue: 'Alle' }))
  if (days === 0) return String(t('injection_history_today', { defaultValue: 'Heute' }))
  if (days === 1) return String(t('injection_history_yesterday', { defaultValue: 'Gestern' }))
  return String(t('injection_history_days', { days, defaultValue: `${days} Tage` }))
}

function dueLabel(days: number, t: Translate): string {
  if (days <= 0) return String(t('injection_due_today', { defaultValue: 'heute fällig' }))
  if (days === 1) return String(t('injection_due_yesterday', { defaultValue: 'gestern fällig' }))
  return String(t('injection_due_days_ago', { days, defaultValue: `vor ${days} Tagen fällig` }))
}
