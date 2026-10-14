// src/components/injection3d/InjectionLogSheet.tsx
import { useEffect, useMemo, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { AlertTriangle, Check, Clock, Info, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { methodLabel } from '../../lib/intakeMethods'
import type { InjectionPinDraft, InjectionProximityWarning } from '../../lib/injectionLogTypes'
import type { OpenInjectionIntake } from '../../lib/injectionPersistence'
import { getOpenInjectionIntakeKey } from '../../lib/injectionDeepLink'
import {
  filterOpenInjectionIntakes,
  type IntakeHistoryDays,
  type IntakeSortOrder,
  type IntakeStatusFilter,
} from '../../lib/openInjectionIntakeFilters'
import {
  areInjectionDetailsLocked,
  INJECTION_METHOD_OPTIONS,
  INJECTION_UNIT_OPTIONS,
  parseInjectionDose,
  replaceTimeInLocalDateTime,
  toLocalDateTimeInput,
} from '../../lib/injectionLogSheetState'
import { denyProps } from '../../lib/denyFeedback'

const UNIT_OPTIONS = INJECTION_UNIT_OPTIONS
const METHOD_OPTIONS = INJECTION_METHOD_OPTIONS

export type InjectionSaveMode = 'intake' | 'manual'

export interface InjectionSaveInput {
  mode: InjectionSaveMode
  intake: OpenInjectionIntake | null
  substanceLabel: string | null
  dose: number | null
  unit: string | null
  method: string | null
  notes: string | null
  loggedAt: string
}

const intakeKey = getOpenInjectionIntakeKey
const toLocalInput = toLocalDateTimeInput

export function InjectionLogSheet({
  pin,
  openIntakes = [],
  warning,
  targetIntakeKey = null,
  onCancel,
  onSave,
}: {
  pin: InjectionPinDraft
  openIntakes?: OpenInjectionIntake[]
  cycles?: readonly unknown[]
  warning: InjectionProximityWarning
  targetIntakeKey?: string | null
  onCancel: () => void
  onSave: (input: InjectionSaveInput) => Promise<void>
}) {
  const { t } = useTranslation()
  const [mode, setMode] = useState<InjectionSaveMode>(targetIntakeKey || openIntakes.length > 0 ? 'intake' : 'manual')
  const [cycleFilter, setCycleFilter] = useState('all')
  const [historyDays, setHistoryDays] = useState<IntakeHistoryDays>(targetIntakeKey ? 'all' : 7)
  const [sortOrder, setSortOrder] = useState<IntakeSortOrder>('newest')
  const [statusFilter, setStatusFilter] = useState<IntakeStatusFilter>('all')
  const [selectedKey, setSelectedKey] = useState(targetIntakeKey ?? '')
  const [substance, setSubstance] = useState('')
  const [dose, setDose] = useState('')
  const [unit, setUnit] = useState('mcg')
  const [method, setMethod] = useState('Subkutan')
  const [notes, setNotes] = useState('')
  const [loggedAt, setLoggedAt] = useState(() => format(new Date(), "yyyy-MM-dd'T'HH:mm"))
  const [saving, setSaving] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const hasFixedTargetIntake = Boolean(targetIntakeKey)

  const overdueLabel = (days: number): string => {
    if (days <= 0) return String(t('injection_due_today', { defaultValue: 'heute fällig' }))
    if (days === 1) return String(t('injection_due_yesterday', { defaultValue: 'gestern fällig' }))
    return String(t('injection_due_days_ago', { days, defaultValue: `vor ${days} Tagen fällig` }))
  }

  const cycleOptions = useMemo(() => Array.from(
    new Map(openIntakes.flatMap(intake => intake.cycleId ? [[
      intake.cycleId,
      { id: intake.cycleId, label: intake.cycleName || intake.stackItemName },
    ] as const] : [])).values(),
  ).sort((a, b) => a.label.localeCompare(b.label, 'de')), [openIntakes])

  const filteredIntakes = useMemo(() => filterOpenInjectionIntakes(openIntakes, {
    cycleId: cycleFilter,
    days: historyDays,
    order: sortOrder,
    status: statusFilter,
  }), [cycleFilter, historyDays, openIntakes, sortOrder, statusFilter])

  const targetIntake = targetIntakeKey
    ? openIntakes.find(i => intakeKey(i) === targetIntakeKey) ?? null
    : null
  const selectedIntake = targetIntake ?? filteredIntakes.find(i => intakeKey(i) === selectedKey) ?? null
  const detailsLocked = areInjectionDetailsLocked(mode, selectedIntake !== null)

  const selectIntake = (i: OpenInjectionIntake) => {
    setSelectedKey(intakeKey(i))
    setDose(String(i.dose))
    setUnit(i.unit)
    setMethod(i.method)
    setLoggedAt(toLocalInput(i.scheduledAt))
  }

  useEffect(() => {
    if (!targetIntakeKey) return
    if (!targetIntake) return
    if (mode !== 'intake') setMode('intake')
    if (selectedKey !== targetIntakeKey || !dose || !unit || !method) selectIntake(targetIntake)
  }, [dose, method, mode, selectedKey, targetIntake, targetIntakeKey, unit])

  const parsedDose = parseInjectionDose(dose)
  const canSave = mode === 'intake'
    ? Boolean(selectedIntake && parsedDose != null && unit && method)
    : Boolean(substance.trim() && parsedDose != null && unit && method)

  const save = async () => {
    if (!canSave) return
    setSaving(true)
    await onSave({
      mode,
      intake: mode === 'intake' ? selectedIntake : null,
      substanceLabel: mode === 'manual' ? substance.trim() : null,
      dose: parsedDose ?? null,
      unit,
      method,
      notes,
      loggedAt: new Date(loggedAt).toISOString(),
    })
    setSaving(false)
  }

  const saveActionLabel = mode === 'intake' && selectedIntake
    ? selectedIntake.status === 'confirmed'
      ? t('injection_add_site_action', { defaultValue: 'Injektionsstelle hinzufügen' })
      : t('injection_save_and_confirm', { defaultValue: 'Speichern & bestätigen' })
    : t('injection_save', { defaultValue: 'Speichern' })
  const selectedIntakeCard = selectedIntake ? (
    <div className="flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-2xl border border-sky-400/30 bg-sky-400/10 p-3 text-left">
      <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sky-400/20 text-sky-300">
        {selectedIntake.status === 'confirmed' ? <Check size={16} aria-hidden="true" /> : <Clock size={16} aria-hidden="true" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-white">{selectedIntake.stackItemName}</p>
        <p className="text-xs text-slate-400">
          <span className={selectedIntake.status === 'confirmed' ? 'text-emerald-300' : 'text-amber-300'}>
            {selectedIntake.status === 'confirmed'
              ? t('injection_already_confirmed', { defaultValue: 'Bereits best\u00e4tigt' })
              : t('injection_status_open', { defaultValue: 'Offen' })}
          </span>
          {' - '}{format(parseISO(selectedIntake.scheduledAt), 'dd.MM. HH:mm')}
          {selectedIntake.status === 'open' ? ` - ${overdueLabel(selectedIntake.daysOverdue)}` : ''}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-bold text-sky-300">{selectedIntake.dose} {selectedIntake.unit}</p>
        <p className="text-[0.62rem] text-slate-500">{methodLabel(t, selectedIntake.method)}</p>
      </div>
    </div>
  ) : null

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/70" />
      <div
        data-app-modal
        data-app-back-dirty-on-interaction
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-[60] flex min-h-dvh flex-col overflow-hidden overflow-x-hidden overscroll-y-contain"
        style={{
          background: 'linear-gradient(180deg, rgba(7,11,24,0.96), var(--surface))',
          overscrollBehaviorY: 'contain',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="shrink-0 overflow-x-hidden border-b border-white/10 px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <h2 className="truncate text-xl font-black text-white">{t('injection_log_title', { defaultValue: 'Injektion speichern' })}</h2>
              <button
                type="button"
                aria-label={String(t('injection_log_help_toggle', { defaultValue: 'Formular erklären' }))}
                aria-expanded={showHelp}
                onClick={() => setShowHelp(value => !value)}
                className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition-colors ${showHelp ? 'border-sky-400/40 bg-sky-400/15 text-sky-300' : 'border-white/10 bg-white/[0.04] text-slate-400'}`}
              >
                <Info size={16} aria-hidden="true" />
              </button>
            </div>
            <button
              type="button"
              aria-label={String(t('injection_position_cancel', { defaultValue: 'Abbrechen' }))}
              onClick={onCancel}
              data-app-back-close
              className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-400"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          {showHelp && (
            <div className="mt-3 rounded-2xl border border-sky-400/20 bg-sky-400/10 p-3 text-sm leading-5 text-slate-200">
              <p className="font-bold text-white">{t('injection_log_help_title', { defaultValue: 'So speicherst du eine Injektion' })}</p>
              <ol className="mt-2 list-decimal space-y-1 pl-4 text-slate-300">
                <li>{t('injection_log_help_step_select', { defaultValue: 'Wähle „Zyklen“, um eine geplante Einnahme zu bestätigen, oder „Manuell“ für einen freien Eintrag.' })}</li>
                <li>{t('injection_log_help_step_details', { defaultValue: 'Wähle die passende Einnahme aus oder trage Substanz, Dosis, Methode und Zeitpunkt ein.' })}</li>
                <li>{t('injection_log_help_step_save', { defaultValue: 'Prüfe die markierte Stelle und speichere die Injektion am Ende des Formulars.' })}</li>
              </ol>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-4 py-3">
          {!hasFixedTargetIntake && (
          <div className="grid min-w-0 grid-cols-2 gap-1 rounded-2xl border border-white/10 p-1" style={{ background: 'var(--surface-input)' }}>
            {(['intake', 'manual'] as InjectionSaveMode[]).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`min-h-11 min-w-0 rounded-xl px-3 py-2 text-sm font-bold transition-colors ${mode === m ? 'bg-sky-400/15 text-sky-300' : 'text-slate-400'}`}
              >
                {m === 'intake'
                  ? t('injection_mode_intake', { defaultValue: 'Zyklen' })
                  : t('injection_mode_manual', { defaultValue: 'Manuell' })}
              </button>
            ))}
          </div>
          )}

          {warning.level !== 'none' && (
            <div className="mt-3 flex gap-2 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-3 text-sm text-amber-200">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p>{warning.level === 'strong'
                ? t('injection_warning_strong', { defaultValue: 'Sehr nahe an einer kürzlichen Injektion.' })
                : t('injection_warning_caution', { defaultValue: 'Nahe an einer Injektion der letzten 7 Tage.' })}</p>
            </div>
          )}

          <div className="mt-3 min-w-0 space-y-4">
            {hasFixedTargetIntake && selectedIntakeCard}
            {mode === 'intake' && !hasFixedTargetIntake && (
              <div className="space-y-2">
                {openIntakes.length > 0 && (
                  <div className="grid min-w-0 grid-cols-2 gap-2">
                    <label className="col-span-2 min-w-0">
                      <span className="label">{t('injection_cycle_label', { defaultValue: 'Zyklus' })}</span>
                      <select className="input" value={cycleFilter} onChange={event => {
                        setCycleFilter(event.target.value)
                        setSelectedKey('')
                      }}>
                        <option value="all">{t('injection_all_cycles', { defaultValue: 'Alle Zyklen' })}</option>
                        {cycleOptions.map(cycle => (
                          <option key={cycle.id} value={cycle.id}>{cycle.label}</option>
                        ))}
                      </select>
                    </label>
                    <div className="col-span-2 min-w-0">
                      <span className="label">{t('injection_status_label', { defaultValue: 'Status' })}</span>
                      <div className="grid min-w-0 grid-cols-3 gap-1 rounded-xl border border-white/10 p-1" style={{ background: 'var(--surface-input)' }}>
                        {([
                          ['all', t('injection_status_all', { defaultValue: 'Alle' })],
                          ['open', t('injection_status_open', { defaultValue: 'Offen' })],
                          ['confirmed', t('injection_status_confirmed', { defaultValue: 'Bestätigt' })],
                        ] as const).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => {
                              setStatusFilter(value)
                              setSelectedKey('')
                            }}
                            className={`min-h-11 min-w-0 rounded-lg px-2 py-2 text-xs font-bold ${statusFilter === value ? 'bg-sky-400/15 text-sky-300' : 'text-slate-400'}`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <label className="min-w-0">
                      <span className="label">{t('injection_history_back', { defaultValue: 'Rückwirkend' })}</span>
                      <select className="input" value={historyDays} onChange={event => {
                        const value = event.target.value
                        setHistoryDays(value === 'all' ? 'all' : Number(value) as IntakeHistoryDays)
                        setSelectedKey('')
                      }}>
                        {[7, 14, 30, 60, 90].map(days => (
                          <option key={days} value={days}>{t('injection_history_days', { days, defaultValue: `${days} Tage` })}</option>
                        ))}
                        <option value="all">{t('injection_history_all', { defaultValue: 'Alle' })}</option>
                      </select>
                    </label>
                    <label className="min-w-0">
                      <span className="label">{t('injection_sort_order', { defaultValue: 'Reihenfolge' })}</span>
                      <select className="input" value={sortOrder} onChange={event => {
                        setSortOrder(event.target.value as IntakeSortOrder)
                        setSelectedKey('')
                      }}>
                        <option value="newest">{t('injection_sort_newest', { defaultValue: 'Neueste zuerst' })}</option>
                        <option value="oldest">{t('injection_sort_oldest', { defaultValue: 'Älteste zuerst' })}</option>
                      </select>
                    </label>
                  </div>
                )}

                {openIntakes.length === 0 ? (
                  <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-sm text-slate-400">
                    {t('injection_no_matching_intakes', { defaultValue: 'Keine passenden Einnahmen. Wechsle zu Manuell.' })}
                  </p>
                ) : filteredIntakes.length === 0 ? (
                  <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-sm text-slate-400">
                    {t('injection_no_filtered_intakes', { defaultValue: 'Keine Einnahmen für diese Filter.' })}
                  </p>
                ) : (
                  <div className="relative">
                    <div className="max-h-[24dvh] space-y-2 overflow-y-auto overflow-x-hidden overscroll-y-contain pr-1 pb-4">
                      {filteredIntakes.map(intake => {
                        const active = intakeKey(intake) === selectedKey
                        return (
                          <button
                            key={intakeKey(intake)}
                            type="button"
                            onClick={() => selectIntake(intake)}
                            className={`flex w-full min-w-0 items-center gap-3 overflow-hidden rounded-2xl border p-3 text-left ${active ? 'border-sky-400/50 bg-sky-400/10' : 'border-white/10 bg-white/[0.03]'}`}
                          >
                            <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${active ? 'bg-sky-400/20 text-sky-300' : 'bg-white/5 text-slate-400'}`}>
                              {intake.status === 'confirmed' ? <Check size={16} aria-hidden="true" /> : <Clock size={16} aria-hidden="true" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-bold text-white">{intake.stackItemName}</p>
                              <p className="text-xs text-slate-400">
                                <span className={intake.status === 'confirmed' ? 'text-emerald-300' : 'text-amber-300'}>
                                  {intake.status === 'confirmed'
                                    ? t('injection_already_confirmed', { defaultValue: 'Bereits bestätigt' })
                                    : t('injection_status_open', { defaultValue: 'Offen' })}
                                </span>
                                {' - '}{format(parseISO(intake.scheduledAt), 'dd.MM. HH:mm')}
                                {intake.status === 'open' ? ` - ${overdueLabel(intake.daysOverdue)}` : ''}
                              </p>
                            </div>
                            <div className="shrink-0 text-right">
                              <p className="text-sm font-bold text-sky-300">{intake.dose} {intake.unit}</p>
                              <p className="text-[0.62rem] text-slate-500">{methodLabel(t, intake.method)}</p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[var(--surface)] to-transparent" />
                  </div>
                )}
              </div>
            )}

            {mode === 'manual' && (
              <label className="block min-w-0">
                <span className="label">{t('injection_substance_label', { defaultValue: 'Substanz' })}</span>
                <input
                  className="input"
                  value={substance}
                  onChange={e => setSubstance(e.target.value)}
                  placeholder={String(t('injection_substance_placeholder', { defaultValue: 'z.B. Testosteron Enantat' }))}
                />
              </label>
            )}

            <div className="space-y-4 pb-2">
              <div className="grid min-w-0 grid-cols-2 gap-3">
                <label className="min-w-0">
                  <span className="label">{t('injection_dose_label', { defaultValue: 'Dosis' })}</span>
                  <input className="input" value={dose} onChange={e => setDose(e.target.value)} inputMode="decimal" disabled={detailsLocked} />
                </label>
                <label className="min-w-0">
                  <span className="label">{t('injection_unit_label', { defaultValue: 'Einheit' })}</span>
                  <select className="input" value={unit} onChange={e => setUnit(e.target.value)} disabled={detailsLocked}>
                    {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </label>
              </div>
              <label className="block min-w-0">
                <span className="label">{t('injection_method_label', { defaultValue: 'Methode' })}</span>
                <select className="input" value={method} onChange={e => setMethod(e.target.value)} disabled={detailsLocked}>
                  {METHOD_OPTIONS.map(m => <option key={m} value={m}>{m}</option>)}
                  {!METHOD_OPTIONS.includes(method) && <option value={method}>{method}</option>}
                </select>
              </label>
              <div className="block min-w-0">
                <span className="label">{t('injection_time_label', { defaultValue: 'Zeitpunkt (rückwirkend möglich)' })}</span>
                {mode === 'intake' && selectedIntake ? (
                  <div className="grid min-w-0 grid-cols-2 gap-3">
                    <label className="min-w-0">
                      <span className="label">{t('injection_date_label', { defaultValue: 'Datum' })}</span>
                      <input className="input opacity-70" type="date" value={loggedAt.slice(0, 10)} readOnly aria-readonly="true" />
                    </label>
                    <label className="min-w-0">
                      <span className="label">{t('injection_clock_label', { defaultValue: 'Uhrzeit' })}</span>
                      <input
                        className="input"
                        type="time"
                        value={loggedAt.slice(11, 16)}
                        onChange={event => setLoggedAt(replaceTimeInLocalDateTime(loggedAt, event.target.value))}
                      />
                    </label>
                  </div>
                ) : (
                  <input className="input" type="datetime-local" value={loggedAt} onChange={event => setLoggedAt(event.target.value)} />
                )}
              </div>
              <label className="block min-w-0">
                <span className="label">{t('injection_notes_label', { defaultValue: 'Notiz optional' })}</span>
                <textarea className="input min-h-16 resize-none" value={notes} onChange={e => setNotes(e.target.value)} />
              </label>
              <p className="text-xs text-slate-500">
                {t('injection_site_label', { defaultValue: 'Stelle' })}: {pin.body_side} - {pin.body_region}
              </p>
              <div className="flex min-w-0 gap-3 border-t border-white/10 pt-4 pb-5">
                <button type="button" className="btn-secondary min-h-11 min-w-0 flex-1" onClick={onCancel}>{t('injection_position_cancel', { defaultValue: 'Abbrechen' })}</button>
                <button type="button" className="btn-primary min-h-11 min-w-0 flex-1" onClick={save} disabled={saving} {...denyProps(!canSave)}>
                  <Check size={14} aria-hidden="true" /> {saveActionLabel}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
