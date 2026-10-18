// src/components/injection3d/InjectionEditSheet.tsx
import { useEffect, useRef, useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Check, Info, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { methodLabel } from '../../lib/intakeMethods'
import { formatInjectionSite } from '../../lib/injectionHistory'
import type { InjectionLog3D } from '../../lib/injectionLogTypes'
import type { InjectionLogEdit } from '../../lib/injectionPersistence'
import { denyProps } from '../../lib/denyFeedback'
import {
  INJECTION_METHOD_OPTIONS,
  INJECTION_UNIT_OPTIONS,
  parseInjectionDose,
  toLocalDateTimeInput,
} from '../../lib/injectionLogSheetState'

export function InjectionEditSheet({
  log,
  onCancel,
  onSave,
  onDelete,
}: {
  log: InjectionLog3D
  onCancel: () => void
  onSave: (edit: InjectionLogEdit) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const { t } = useTranslation()
  const linked = Boolean(log.dose_log_id)
  const [substance, setSubstance] = useState(log.substance_label ?? '')
  const [dose, setDose] = useState(log.dose == null ? '' : String(log.dose))
  // Leer bleibt leer: kein stilles 'mg'/'Subkutan' fuer alte Eintraege ohne Angabe.
  const [unit, setUnit] = useState(log.unit ?? '')
  const [method, setMethod] = useState(log.method ?? '')
  const initialLoggedAt = toLocalDateTimeInput(log.logged_at)
  const [loggedAt, setLoggedAt] = useState(initialLoggedAt)
  const [notes, setNotes] = useState(log.notes ?? '')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const confirmRef = useRef<HTMLDivElement | null>(null)

  // Die Rueckfrage liegt unter dem Formular; sonst erscheint sie ausserhalb des Bildes.
  useEffect(() => {
    if (confirmDelete) confirmRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [confirmDelete])

  const parsedDose = parseInjectionDose(dose)
  const loggedAtValid = !Number.isNaN(new Date(loggedAt).getTime())
  const canSave = !busy && (linked || (parsedDose !== undefined && loggedAtValid))
  const title = log.stack_item_name ?? log.substance_label ?? t('injection_default_label', { defaultValue: 'Injektion' })

  const save = async () => {
    if (!canSave) return
    setBusy(true)
    try {
      await onSave({
        notes,
        substanceLabel: substance,
        dose: parsedDose ?? null,
        unit: unit || null,
        method: method || null,
        // Unveraendert: den gespeicherten Zeitpunkt behalten (das Feld kennt nur Minuten).
        loggedAt: loggedAt === initialLoggedAt ? log.logged_at : new Date(loggedAt).toISOString(),
      })
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await onDelete()
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/70" onClick={busy ? undefined : onCancel} />
      <div
        data-app-modal
        data-app-back-dirty-on-interaction
        role="dialog"
        aria-modal="true"
        aria-labelledby="injection-edit-title"
        className="lg-sheet fixed inset-x-2 bottom-2 z-[60] max-h-[92dvh] overflow-y-auto overscroll-contain px-4 pt-2"
        style={{
          paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="lg-grabber mb-3" />
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id="injection-edit-title" className="lg-title2 truncate">
              {t('injection_edit_title', { defaultValue: 'Injektion bearbeiten' })}
            </h2>
            <p className="mt-0.5 truncate text-[13px] text-[var(--lg-text-3)]">{title} · {formatInjectionSite(log)}</p>
          </div>
          <button
            type="button"
            aria-label={String(t('close', { defaultValue: 'Schließen' }))}
            onClick={onCancel}
            disabled={busy}
            data-app-back-close
            className="lg-icon-btn lg-press shrink-0 bg-[var(--lg-fill)] !text-[var(--lg-text-2)]"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4">
          {linked ? (
            <div className="flex gap-2 rounded-[18px] bg-[var(--lg-surface-2)] p-3.5 text-[13px] leading-5 text-[var(--lg-text-2)]">
              <Info size={15} className="mt-0.5 shrink-0 text-[var(--lg-accent-text)]" aria-hidden="true" />
              <div>
                <p className="font-semibold text-[var(--lg-text)]">
                  {[log.dose, log.unit].filter(value => value != null && value !== '').join(' ')}
                  {log.method ? ` · ${methodLabel(t, log.method)}` : ''}
                  {' · '}{format(parseISO(log.logged_at), 'dd.MM. HH:mm')}
                </p>
                <p>{t('injection_edit_linked_hint', { defaultValue: 'Dosis, Methode und Zeitpunkt gehören zur verknüpften Einnahme und werden dort geändert.' })}</p>
              </div>
            </div>
          ) : (
            <>
              <label className="block min-w-0">
                <span className="label">{t('injection_substance_label', { defaultValue: 'Substanz' })}</span>
                <input className="input" value={substance} onChange={e => setSubstance(e.target.value)} />
              </label>
              <div className="grid min-w-0 grid-cols-2 gap-3">
                <label className="min-w-0">
                  <span className="label">{t('injection_dose_label', { defaultValue: 'Dosis' })}</span>
                  <input
                    className="input"
                    value={dose}
                    onChange={e => setDose(e.target.value)}
                    inputMode="decimal"
                    aria-invalid={parsedDose === undefined}
                  />
                </label>
                <label className="min-w-0">
                  <span className="label">{t('injection_unit_label', { defaultValue: 'Einheit' })}</span>
                  <select className="input" value={unit} onChange={e => setUnit(e.target.value)}>
                    {!unit && <option value="">–</option>}
                    {INJECTION_UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
                    {unit && !INJECTION_UNIT_OPTIONS.includes(unit) && <option value={unit}>{unit}</option>}
                  </select>
                </label>
              </div>
              <label className="block min-w-0">
                <span className="label">{t('injection_method_label', { defaultValue: 'Methode' })}</span>
                <select className="input" value={method} onChange={e => setMethod(e.target.value)}>
                  {!method && <option value="">–</option>}
                  {INJECTION_METHOD_OPTIONS.map(m => <option key={m} value={m}>{methodLabel(t, m)}</option>)}
                  {method && !INJECTION_METHOD_OPTIONS.includes(method) && <option value={method}>{methodLabel(t, method)}</option>}
                </select>
              </label>
              <label className="block min-w-0">
                <span className="label">{t('injection_time_label', { defaultValue: 'Zeitpunkt (rückwirkend möglich)' })}</span>
                <input className="input" type="datetime-local" value={loggedAt} onChange={e => setLoggedAt(e.target.value)} />
              </label>
            </>
          )}

          <label className="block min-w-0">
            <span className="label">{t('injection_notes_label', { defaultValue: 'Notiz (optional)' })}</span>
            <textarea className="input min-h-16 resize-none" value={notes} onChange={e => setNotes(e.target.value)} />
          </label>

          <div className="flex min-w-0 gap-3">
            <button type="button" data-quiet className="lg-gray-btn min-h-11 min-w-0 flex-1" onClick={onCancel} disabled={busy}>
              {t('injection_position_cancel', { defaultValue: 'Abbrechen' })}
            </button>
            <button type="button" className="btn-primary min-h-11 min-w-0 flex-1" onClick={save} disabled={busy} {...denyProps(!canSave)}>
              <Check size={14} aria-hidden="true" /> {t('injection_save', { defaultValue: 'Speichern' })}
            </button>
          </div>

          <div className="border-t border-[var(--lg-separator)] pt-4">
            {confirmDelete ? (
              <div ref={confirmRef} role="alert" className="space-y-3 rounded-[18px] bg-[rgba(255,69,58,0.12)] p-3.5">
                <p className="text-[15px] font-semibold text-[var(--lg-bad-text)]">
                  {linked
                    ? t('injection_delete_confirm_linked', { defaultValue: 'Nur die Injektionsstelle wird entfernt. Die verknüpfte Einnahme bleibt, wie sie ist.' })
                    : t('injection_delete_confirm', { defaultValue: 'Diese Injektion wird endgültig gelöscht.' })}
                </p>
                <div className="flex gap-3">
                  <button type="button" data-quiet className="lg-gray-btn min-h-11 min-w-0 flex-1" onClick={() => setConfirmDelete(false)} disabled={busy}>
                    {t('injection_delete_keep', { defaultValue: 'Behalten' })}
                  </button>
                  <button type="button" className="btn-danger min-h-11 min-w-0 flex-1" onClick={remove} disabled={busy}>
                    <Trash2 size={14} aria-hidden="true" /> {t('injection_delete_final', { defaultValue: 'Endgültig löschen' })}
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={busy}
                data-tone="bad"
                data-quiet
                className="lg-gray-btn min-h-11 w-full"
              >
                <Trash2 size={15} aria-hidden="true" /> {t('injection_delete', { defaultValue: 'Injektion löschen' })}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
