import { useId, useRef, useState } from 'react'
import { format } from 'date-fns'
import { Check, Clock, Pencil, RotateCcw, Syringe, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { formatTrackedQuantity } from '../quantityPresentation'
import {
  buildConfirmationEntry,
  type RoutineConfirmationEntry,
  type RoutineGroupModel,
  type RoutineIntake,
} from '../intakeGroups'
import { buildOneOffActualDose, dosePlanCapabilities } from '../../my-stack/lib/dosePlan'
import { InventoryConfirmationError } from '../../my-stack/services/stackInventory'
import { denyProps } from '../../../lib/denyFeedback'
import { useSheetClose } from '../../../lib/useSheetClose'

interface ConfirmedIntake {
  entry: RoutineConfirmationEntry
  doseLogId: string
}

interface RoutineConfirmationSheetProps {
  group: RoutineGroupModel
  onClose: () => void
  /**
   * `time` ist die abgefragte Uhrzeit (HH:mm), wenn `initialTime` gesetzt ist.
   * Sie gilt fuer alle gewaehlten Einnahmen: was man zusammen nimmt, nimmt
   * man zur selben Zeit.
   */
  onConfirm: (entries: RoutineConfirmationEntry[], time?: string) => Promise<string[]>
  onAfterConfirm?: (entries: RoutineConfirmationEntry[], savedLogIds: string[]) => void | Promise<void>
  onAddInjection?: (entry: RoutineIntake, doseLogId: string) => void
  /** Gesetzt, fragt das Blatt die Uhrzeit ab, vorbelegt mit diesem Wert (HH:mm). */
  initialTime?: string
}



const GROUP_LABEL_KEYS: Record<RoutineGroupModel['key'], string> = {
  morning: 'my_stack_routine_morning',
  midday: 'my_stack_routine_midday',
  evening: 'my_stack_routine_evening',
}

export function RoutineConfirmationSheet({
  group,
  onClose,
  onConfirm,
  onAfterConfirm,
  onAddInjection,
  initialTime,
}: RoutineConfirmationSheetProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const timeId = useId()
  const { requestClose, closingProps } = useSheetClose(onClose)
  const [time, setTime] = useState(initialTime ?? '')
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const [entries, setEntries] = useState<RoutineConfirmationEntry[]>(() => (
    group.items.map(buildConfirmationEntry)
  ))
  const [editingKeys, setEditingKeys] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const [confirmed, setConfirmed] = useState<ConfirmedIntake[] | null>(null)
  const [inventoryRetry, setInventoryRetry] = useState<{
    entries: RoutineConfirmationEntry[]
    savedLogIds: string[]
  } | null>(null)
  const [retryingInventory, setRetryingInventory] = useState(false)

  const updateEntry = (key: string, update: Partial<RoutineConfirmationEntry>) => {
    setEntries(current => current.map(entry => entry.key === key ? { ...entry, ...update } : entry))
  }

  const selectedEntries = entries.filter(entry => entry.selected)
  const hasInvalidQuantity = selectedEntries.some(entry => (
    entry.trackingLevel !== 'intake_only'
    && (
      entry.actualDose == null
      || !Number.isFinite(entry.actualDose)
      || entry.actualDose <= 0
      || !entry.actualUnit?.trim()
      || entry.actualUnit !== entry.unit
    )
  ))
  const timeMissing = initialTime !== undefined && !/^\d{2}:\d{2}$/.test(time)
  const canConfirm = selectedEntries.length > 0 && !hasInvalidQuantity && !timeMissing && !saving

  const runAfterConfirm = async (
    confirmedEntries: RoutineConfirmationEntry[],
    savedLogIds: string[],
  ) => {
    try {
      await onAfterConfirm?.(confirmedEntries, savedLogIds)
      setInventoryRetry(null)
    } catch (afterError) {
      if (afterError instanceof InventoryConfirmationError) {
        setInventoryRetry({ entries: confirmedEntries, savedLogIds })
      }
    }
  }

  const save = async () => {
    if (!canConfirm) return
    setSaving(true)
    setError(false)
    let savedLogIds: string[]
    try {
      savedLogIds = initialTime !== undefined ? await onConfirm(entries, time) : await onConfirm(entries)
    } catch {
      setError(true)
      setSaving(false)
      return
    }
    setConfirmed(selectedEntries.map((entry, index) => ({
      entry,
      doseLogId: savedLogIds[index],
    })).filter(item => Boolean(item.doseLogId)))
    setSaving(false)
    void runAfterConfirm(entries, savedLogIds)
  }

  return (
    <>
      <button
        type="button"
        aria-label={String(t('routine_confirmation_close', { defaultValue: 'Routine-Bestätigung schließen' }))}
        onClick={requestClose}
        {...closingProps}
        className="tyd-backdrop fixed inset-0 z-50 cursor-pointer bg-black/70"
      />
      <section
        role="dialog"
        aria-modal="true"
        data-app-back-dirty-on-interaction
        aria-labelledby={titleId}
        {...closingProps}
        className="tyd-sheet fixed inset-x-3 bottom-3 z-[60] max-h-[calc(100dvh-0.75rem-var(--tyd-popup-top))] overflow-y-auto rounded-3xl border border-white/10 bg-[var(--surface)] p-4 shadow-[0_-16px_48px_rgba(0,0,0,0.55)]"
      >
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[0.62rem] font-black uppercase tracking-[0.13em] text-cyan-300">
              {group.label ?? t('routine_group_label', {
                defaultValue: '{{group}}-Routine',
                group: t(GROUP_LABEL_KEYS[group.key]),
              })}
            </p>
            <h2 id={titleId} className="mt-1 text-lg font-black text-white">
              {t('routine_confirmation_title', { defaultValue: 'Gemeinsam bestätigen' })}
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-400">
              {t('routine_confirmation_hint', { defaultValue: 'Auswahl und Mengen vor dem Speichern prüfen.' })}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            data-app-back-close
            aria-label={String(t('close', { defaultValue: 'Schließen' }))}
            onClick={requestClose}
            className="tyd-press grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        {confirmed ? (
          <div className="space-y-3">
            <div className="flex min-h-11 items-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-3 text-sm font-bold text-emerald-300">
              <Check size={17} aria-hidden="true" /> {t('routine_confirmation_saved', { defaultValue: 'Routine gespeichert' })}
            </div>
            {inventoryRetry && (
              <div role="alert" className="rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm font-bold text-amber-200">
                <p>{t('routine_inventory_committed_retry', { defaultValue: 'Die Routine ist gespeichert, aber der Bestand wurde nicht aktualisiert.' })}</p>
                <button
                  type="button"
                  disabled={retryingInventory}
                  onClick={() => {
                    setRetryingInventory(true)
                    void runAfterConfirm(inventoryRetry.entries, inventoryRetry.savedLogIds)
                      .finally(() => setRetryingInventory(false))
                  }}
                  className="mt-2 flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-amber-400/25 bg-amber-500/15 px-3 text-sm font-black text-amber-100 transition-colors hover:bg-amber-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RotateCcw size={15} aria-hidden="true" /> {t('routine_inventory_retry', { defaultValue: 'Bestand erneut versuchen' })}
                </button>
              </div>
            )}
            {confirmed.filter(item => item.entry.injectable).map(item => (
              <button
                key={item.entry.key}
                type="button"
                aria-label={String(t('routine_add_injection_label', {
                  defaultValue: 'Injektionsstelle ergänzen für {{substanceName}}',
                  substanceName: item.entry.stackItemName,
                }))}
                onClick={() => onAddInjection?.(item.entry, item.doseLogId)}
                className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-sky-500/25 bg-sky-500/15 px-3 text-sm font-black text-sky-300 transition-colors hover:bg-sky-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
              >
                <Syringe size={16} aria-hidden="true" /> {t('routine_add_injection', { defaultValue: 'Injektionsstelle ergänzen' })}
              </button>
            ))}
            <button
              type="button"
              onClick={requestClose}
              className="tyd-press min-h-11 w-full cursor-pointer rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm font-black text-slate-200 transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
            >
              {t('routine_confirmation_done', { defaultValue: 'Fertig' })}
            </button>
          </div>
        ) : (
          <>
            {initialTime !== undefined && (
              <div className="mb-3">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <label htmlFor={timeId} className="text-xs font-extrabold uppercase tracking-[0.12em] text-slate-400">
                    {t('confirm_sheet_time_label', { defaultValue: 'Uhrzeit' })}
                  </label>
                  <button
                    type="button"
                    onClick={() => setTime(format(new Date(), 'HH:mm'))}
                    className="tyd-press flex min-h-9 items-center gap-1.5 rounded-lg border border-sky-500/25 bg-sky-500/10 px-3 text-xs font-bold text-sky-300 transition-colors hover:bg-sky-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300"
                  >
                    <Clock size={12} aria-hidden="true" />
                    {t('confirm_time_now', { defaultValue: 'Jetzt' })}
                  </button>
                </div>
                <input
                  id={timeId}
                  type="time"
                  value={time}
                  onChange={event => setTime(event.target.value)}
                  className="input min-h-11 text-base font-bold"
                />
              </div>
            )}
            <ul className="space-y-2">
              {entries.map(entry => {
                const editing = editingKeys.includes(entry.key)
                const capabilities = dosePlanCapabilities(entry.trackingLevel)
                const plannedQuantity = capabilities.oneOff
                  ? formatTrackedQuantity(entry.dose, entry.unit, '')
                  : null
                return (
                  <li key={entry.key} className="rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                    <div className="flex min-h-11 items-center gap-3">
                      <label className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          aria-label={String(t('routine_select_item', {
                            defaultValue: '{{substanceName}} auswählen',
                            substanceName: entry.stackItemName,
                          }))}
                          checked={entry.selected}
                          onChange={event => updateEntry(entry.key, { selected: event.target.checked })}
                          className="h-5 w-5 shrink-0 cursor-pointer accent-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                        />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-black text-white">{entry.stackItemName}</span>
                          {plannedQuantity && (
                            <span className="block text-xs font-semibold text-slate-400">
                              {t('routine_planned_quantity', { defaultValue: 'Geplant: {{quantity}}', quantity: plannedQuantity })}
                            </span>
                          )}
                        </span>
                      </label>
                      {capabilities.oneOff && (
                        <button
                          type="button"
                          aria-label={String(t('routine_actual_override', { defaultValue: 'Einmalige Abweichung' }))}
                          aria-expanded={editing}
                          onClick={() => {
                            if (editing) {
                              updateEntry(entry.key, { actualDose: entry.dose, actualUnit: entry.unit })
                              setEditingKeys(current => current.filter(key => key !== entry.key))
                            } else {
                              setEditingKeys(current => [...current, entry.key])
                            }
                          }}
                          className="flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl border border-cyan-500/20 bg-cyan-500/10 px-3 text-xs font-black text-cyan-300 transition-colors hover:bg-cyan-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                        >
                          <Pencil size={13} aria-hidden="true" /> {t('routine_actual_override', { defaultValue: 'Einmalige Abweichung' })}
                        </button>
                      )}
                    </div>
                    {editing && capabilities.oneOff && (
                      <div className="mt-2 flex items-center gap-2">
                        <label className="sr-only" htmlFor={`routine-amount-${entry.key}`}>
                          {t('routine_amount_for', {
                            defaultValue: 'Menge für {{substanceName}}',
                            substanceName: entry.stackItemName,
                          })}
                        </label>
                        <input
                          id={`routine-amount-${entry.key}`}
                          type="number"
                          min="0"
                          step="any"
                          value={entry.actualDose ?? ''}
                          onChange={event => {
                            if (event.target.value === '') {
                              updateEntry(entry.key, { actualDose: null })
                              return
                            }
                            const dose = Number(event.target.value)
                            if (!Number.isFinite(dose) || dose <= 0) {
                              updateEntry(entry.key, { actualDose: dose })
                              return
                            }
                            setEntries(current => current.map(currentEntry => currentEntry.key === entry.key
                              ? buildOneOffActualDose(currentEntry, {
                                  dose,
                                  unit: currentEntry.actualUnit ?? currentEntry.unit ?? '',
                                })
                              : currentEntry))
                          }}
                          className="min-h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-[var(--surface-input)] px-3 text-base font-black text-white outline-none focus-visible:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-300"
                        />
                        <span className="text-sm font-bold text-slate-300">{entry.actualUnit}</span>
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>

            {error && (
              <div role="alert" className="mt-3 rounded-2xl border border-red-500/25 bg-red-500/10 p-3 text-sm font-bold text-red-300">
                <p>{t('routine_confirmation_save_error', { defaultValue: 'Gruppe konnte nicht gespeichert werden. Deine Auswahl bleibt erhalten.' })}</p>
                <button
                  type="button"
                  onClick={() => void save()}
                  className="mt-2 flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-red-400/25 bg-red-500/15 px-3 text-sm font-black text-red-200 transition-colors hover:bg-red-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300"
                >
                  <RotateCcw size={15} aria-hidden="true" /> {t('routine_confirmation_retry', { defaultValue: 'Erneut versuchen' })}
                </button>
              </div>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={requestClose}
                className="tyd-press min-h-11 cursor-pointer rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-sm font-black text-slate-300 transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              >
                {t('routine_confirmation_cancel', { defaultValue: 'Abbrechen' })}
              </button>
              <button
                type="button"
                disabled={saving}
                {...denyProps(!saving && !canConfirm)}
                onClick={() => void save()}
                className="tyd-press flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-2xl border border-emerald-500/25 bg-emerald-500/15 px-3 text-sm font-black text-emerald-300 transition-colors hover:bg-emerald-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:opacity-50"
              >
                <Check size={16} aria-hidden="true" /> {saving
                  ? t('routine_confirmation_saving', { defaultValue: 'Speichert …' })
                  // Mit Uhrzeit (Bündel) reicht „Eingenommen": „alle" ist bei
                  // einer Substanz falsch und bricht auf dem Handy dreizeilig um.
                  : initialTime !== undefined
                  ? t('eingenommen', { defaultValue: 'Eingenommen' })
                  : t('routine_confirmation_confirm_all', { defaultValue: 'Alle als eingenommen markieren' })}
              </button>
            </div>
          </>
        )}
      </section>
    </>
  )
}
