// src/components/injection3d/InjectionLogSheet.tsx
//
// Nach „Position übernehmen“. Drei Ansichten:
// - pick:    welche Einnahme? (dieselbe Liste wie der Tracker-Knopf „Einnahmen“)
// - confirm: Einnahme steht fest -- nur noch bestätigen. Dosis, Einheit und
//            Methode kommen aus dem Plan; Uhrzeit, einmalige Dosisänderung
//            und Notiz sind eingeklappt.
// - manual:  „Ohne Plan eintragen“, das freie Formular.
import { useEffect, useState, type ReactNode } from 'react'
import { format, parseISO } from 'date-fns'
import { AlertTriangle, ArrowLeft, Check, ChevronDown, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { methodLabel } from '../../lib/intakeMethods'
import type { InjectionPinDraft, InjectionProximityWarning } from '../../lib/injectionLogTypes'
import type { OpenInjectionIntake } from '../../lib/injectionPersistence'
import { getOpenInjectionIntakeKey } from '../../lib/injectionDeepLink'
import {
  INJECTION_METHOD_OPTIONS,
  INJECTION_UNIT_OPTIONS,
  parseInjectionDose,
  replaceTimeInLocalDateTime,
  toLocalDateTimeInput,
} from '../../lib/injectionLogSheetState'
import { denyProps } from '../../lib/denyFeedback'
import type { InjectionSaveInput } from '../../lib/injectionSave'
import { InjectionIntakeList, InjectionIntakeSummary } from './InjectionIntakeList'

type SheetView = 'pick' | 'confirm' | 'manual'

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
  const targetIntake = targetIntakeKey
    ? openIntakes.find(intake => getOpenInjectionIntakeKey(intake) === targetIntakeKey) ?? null
    : null

  const [view, setView] = useState<SheetView>(() => targetIntake ? 'confirm' : openIntakes.length > 0 ? 'pick' : 'manual')
  const [intake, setIntake] = useState<OpenInjectionIntake | null>(targetIntake)
  const [saving, setSaving] = useState(false)

  // Bestätigen
  const [time, setTime] = useState(() => targetIntake ? format(parseISO(targetIntake.scheduledAt), 'HH:mm') : '')
  const [timeOpen, setTimeOpen] = useState(false)
  const [doseChanged, setDoseChanged] = useState(false)
  const [changedDose, setChangedDose] = useState(() => targetIntake ? String(targetIntake.dose) : '')
  const [changedUnit, setChangedUnit] = useState(() => targetIntake?.unit ?? '')
  const [notesOpen, setNotesOpen] = useState(false)
  const [notes, setNotes] = useState('')

  // Manuell
  const [substance, setSubstance] = useState('')
  const [dose, setDose] = useState('')
  const [unit, setUnit] = useState('mcg')
  const [method, setMethod] = useState('Subkutan')
  const [loggedAt, setLoggedAt] = useState(() => format(new Date(), "yyyy-MM-dd'T'HH:mm"))

  const chooseIntake = (next: OpenInjectionIntake) => {
    setIntake(next)
    setTime(format(parseISO(next.scheduledAt), 'HH:mm'))
    setTimeOpen(false)
    setDoseChanged(false)
    setChangedDose(String(next.dose))
    setChangedUnit(next.unit)
    setView('confirm')
  }

  // Direktlink: die Einnahme kann erst nach dem Laden bekannt werden.
  useEffect(() => {
    if (targetIntake && !intake) chooseIntake(targetIntake)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetIntake])

  const siteText = String(t('injection_site_option', {
    region: t(`injection_region_${pin.body_region}`, { defaultValue: pin.body_region }),
    side: t(`injection_side_${pin.body_side}`, { defaultValue: pin.body_side }),
    defaultValue: '{{region}} {{side}}',
  }))

  const open = intake?.status === 'open'
  const parsedChangedDose = parseInjectionDose(changedDose)
  const parsedManualDose = parseInjectionDose(dose)
  const canSave = view === 'confirm'
    ? Boolean(intake) && (!open || /^\d{2}:\d{2}$/.test(time))
      && (!doseChanged || (parsedChangedDose != null && Boolean(changedUnit)))
    : view === 'manual'
      ? Boolean(substance.trim() && parsedManualDose != null && unit && method)
      : false

  const save = async () => {
    if (!canSave || saving) return
    setSaving(true)
    try {
      if (view === 'confirm' && intake) {
        const plannedLocal = toLocalDateTimeInput(intake.scheduledAt)
        await onSave({
          mode: 'intake',
          intake,
          substanceLabel: null,
          dose: doseChanged && parsedChangedDose != null ? parsedChangedDose : intake.dose,
          unit: doseChanged ? changedUnit : intake.unit,
          method: intake.method,
          notes: notes.trim() ? notes : null,
          loggedAt: new Date(open ? replaceTimeInLocalDateTime(plannedLocal, time) : plannedLocal).toISOString(),
        })
      } else {
        await onSave({
          mode: 'manual',
          intake: null,
          substanceLabel: substance.trim(),
          dose: parsedManualDose ?? null,
          unit,
          method,
          notes: notes.trim() ? notes : null,
          loggedAt: new Date(loggedAt).toISOString(),
        })
      }
    } finally {
      setSaving(false)
    }
  }

  const title = view === 'pick'
    ? t('injection_intakes_pick_title', { defaultValue: 'Zu welcher Einnahme?' })
    : t('injection_log_title', { defaultValue: 'Injektion speichern' })
  const saveLabel = view === 'confirm'
    ? open
      ? t('injection_save_and_confirm', { defaultValue: 'Speichern & bestätigen' })
      : t('injection_add_site_action', { defaultValue: 'Injektionsstelle hinzufügen' })
    : t('injection_save', { defaultValue: 'Speichern' })
  const unitOptions = changedUnit && !INJECTION_UNIT_OPTIONS.includes(changedUnit)
    ? [...INJECTION_UNIT_OPTIONS, changedUnit]
    : INJECTION_UNIT_OPTIONS

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/70" />
      <div
        data-app-modal
        data-app-back-dirty-on-interaction
        role="dialog"
        aria-modal="true"
        aria-labelledby="injection-log-title"
        className="fixed inset-0 z-[60] flex min-h-dvh flex-col overflow-hidden overflow-x-hidden overscroll-y-contain"
        style={{
          background: 'linear-gradient(180deg, rgba(7,11,24,0.96), var(--surface))',
          overscrollBehaviorY: 'contain',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
          <h2 id="injection-log-title" className="truncate text-xl font-black text-white">{title}</h2>
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

        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-y-contain px-4 py-3">
          {warning.level !== 'none' && (
            <div className="mb-3 flex gap-2 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-3 text-sm text-amber-200">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p>{warning.level === 'strong'
                ? t('injection_warning_strong', { defaultValue: 'Sehr nahe an einer kürzlichen Injektion.' })
                : t('injection_warning_caution', { defaultValue: 'Nahe an einer Injektion der letzten 7 Tage.' })}</p>
            </div>
          )}

          {view === 'pick' && (
            <InjectionIntakeList
              intakes={openIntakes}
              onSelect={chooseIntake}
              footer={(
                <button
                  type="button"
                  onClick={() => setView('manual')}
                  className="mt-1 min-h-11 w-full rounded-xl text-sm font-bold text-sky-300"
                >
                  {t('injection_manual_entry', { defaultValue: 'Ohne Plan eintragen' })}
                </button>
              )}
            />
          )}

          {view === 'confirm' && intake && (
            <div className="space-y-3">
              <div className="rounded-2xl border border-sky-400/30 bg-sky-400/10 p-3">
                <InjectionIntakeSummary intake={intake} />
              </div>

              <dl className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.03] px-3">
                <div className="flex min-h-11 items-center justify-between gap-3">
                  <dt className="text-sm text-slate-400">{t('injection_site_heading', { defaultValue: 'Stelle' })}</dt>
                  <dd className="text-sm font-bold text-white">{siteText}</dd>
                </div>
                <div className="flex min-h-11 items-center justify-between gap-3">
                  <dt className="text-sm text-slate-400">{t('injection_clock_label', { defaultValue: 'Uhrzeit' })}</dt>
                  <dd className="flex items-center gap-2">
                    {open && timeOpen ? (
                      <input
                        className="input h-9 w-28 py-0"
                        type="time"
                        value={time}
                        onChange={event => setTime(event.target.value)}
                        aria-label={String(t('injection_clock_label', { defaultValue: 'Uhrzeit' }))}
                        autoFocus
                      />
                    ) : (
                      <span className="text-sm font-bold text-white">
                        {format(parseISO(intake.scheduledAt), 'dd.MM.')} {open ? time : format(parseISO(intake.scheduledAt), 'HH:mm')}
                      </span>
                    )}
                    {open && !timeOpen && (
                      <button type="button" onClick={() => setTimeOpen(true)} className="min-h-11 px-1 text-sm font-bold text-sky-300">
                        {t('injection_time_change', { defaultValue: 'Uhrzeit ändern' })}
                      </button>
                    )}
                  </dd>
                </div>
              </dl>

              {open && (
                <Disclosure
                  open={doseChanged}
                  onToggle={() => setDoseChanged(value => !value)}
                  label={String(t('injection_dose_changed_toggle', { defaultValue: 'Hat sich deine Dosis geändert?' }))}
                >
                  <div className="grid min-w-0 grid-cols-2 gap-3">
                    <label className="min-w-0">
                      <span className="label">{t('injection_dose_label', { defaultValue: 'Dosis' })}</span>
                      <input
                        className="input"
                        value={changedDose}
                        onChange={event => setChangedDose(event.target.value)}
                        inputMode="decimal"
                        aria-invalid={parsedChangedDose == null}
                      />
                    </label>
                    <label className="min-w-0">
                      <span className="label">{t('injection_unit_label', { defaultValue: 'Einheit' })}</span>
                      <select className="input" value={changedUnit} onChange={event => setChangedUnit(event.target.value)}>
                        {unitOptions.map(option => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </label>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">{t('injection_dose_changed_hint', { defaultValue: 'Gilt nur für diese Einnahme.' })}</p>
                </Disclosure>
              )}

              <NotesField open={notesOpen} onOpen={() => setNotesOpen(true)} notes={notes} onChange={setNotes} />

              <button type="button" onClick={() => setView('pick')} className="flex min-h-11 items-center gap-1.5 text-sm font-bold text-slate-400">
                <ArrowLeft size={14} aria-hidden="true" /> {t('injection_back_to_intakes', { defaultValue: 'Andere Einnahme wählen' })}
              </button>
            </div>
          )}

          {view === 'manual' && (
            <div className="space-y-4">
              <label className="block min-w-0">
                <span className="label">{t('injection_substance_label', { defaultValue: 'Substanz' })}</span>
                <input
                  className="input"
                  value={substance}
                  onChange={event => setSubstance(event.target.value)}
                  placeholder={String(t('injection_substance_placeholder', { defaultValue: 'z.B. Testosteron Enantat' }))}
                />
              </label>
              <div className="grid min-w-0 grid-cols-2 gap-3">
                <label className="min-w-0">
                  <span className="label">{t('injection_dose_label', { defaultValue: 'Dosis' })}</span>
                  <input className="input" value={dose} onChange={event => setDose(event.target.value)} inputMode="decimal" />
                </label>
                <label className="min-w-0">
                  <span className="label">{t('injection_unit_label', { defaultValue: 'Einheit' })}</span>
                  <select className="input" value={unit} onChange={event => setUnit(event.target.value)}>
                    {INJECTION_UNIT_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                  </select>
                </label>
              </div>
              <label className="block min-w-0">
                <span className="label">{t('injection_method_label', { defaultValue: 'Methode' })}</span>
                <select className="input" value={method} onChange={event => setMethod(event.target.value)}>
                  {INJECTION_METHOD_OPTIONS.map(option => <option key={option} value={option}>{methodLabel(t, option)}</option>)}
                </select>
              </label>
              <label className="block min-w-0">
                <span className="label">{t('injection_time_label', { defaultValue: 'Zeitpunkt (rückwirkend möglich)' })}</span>
                <input className="input" type="datetime-local" value={loggedAt} onChange={event => setLoggedAt(event.target.value)} />
              </label>
              <p className="text-sm text-slate-400">
                {t('injection_site_heading', { defaultValue: 'Stelle' })}: <span className="font-bold text-white">{siteText}</span>
              </p>
              <NotesField open={notesOpen} onOpen={() => setNotesOpen(true)} notes={notes} onChange={setNotes} />
              {openIntakes.length > 0 && (
                <button type="button" onClick={() => setView('pick')} className="flex min-h-11 items-center gap-1.5 text-sm font-bold text-slate-400">
                  <ArrowLeft size={14} aria-hidden="true" /> {t('injection_tab_intakes', { defaultValue: 'Einnahmen' })}
                </button>
              )}
            </div>
          )}
        </div>

        {view !== 'pick' && (
          <div className="flex min-w-0 shrink-0 gap-3 border-t border-white/10 px-4 pt-3 pb-4">
            <button type="button" className="btn-secondary min-h-11 min-w-0 flex-1" onClick={onCancel}>
              {t('injection_position_cancel', { defaultValue: 'Abbrechen' })}
            </button>
            <button type="button" className="btn-primary min-h-11 min-w-0 flex-1" onClick={save} disabled={saving} {...denyProps(!canSave)}>
              <Check size={14} aria-hidden="true" /> {saveLabel}
            </button>
          </div>
        )}
      </div>
    </>
  )
}

function Disclosure({
  open,
  onToggle,
  label,
  children,
}: {
  open: boolean
  onToggle: () => void
  label: string
  children: ReactNode
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03]">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex min-h-11 w-full items-center justify-between gap-3 px-3 text-left text-sm font-bold text-slate-200"
      >
        {label}
        <ChevronDown size={16} aria-hidden="true" className={`shrink-0 text-slate-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  )
}

function NotesField({
  open,
  onOpen,
  notes,
  onChange,
}: {
  open: boolean
  onOpen: () => void
  notes: string
  onChange: (value: string) => void
}) {
  const { t } = useTranslation()
  if (!open) {
    return (
      <button type="button" onClick={onOpen} className="min-h-11 text-sm font-bold text-sky-300">
        + {t('injection_notes_add', { defaultValue: 'Notiz hinzufügen' })}
      </button>
    )
  }
  return (
    <label className="block min-w-0">
      <span className="label">{t('injection_notes_label', { defaultValue: 'Notiz optional' })}</span>
      <textarea className="input min-h-16 resize-none" value={notes} onChange={event => onChange(event.target.value)} autoFocus />
    </label>
  )
}
