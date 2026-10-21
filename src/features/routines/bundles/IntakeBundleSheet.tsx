import { useId, useState } from 'react'
import { Check, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSheetClose } from '../../../lib/useSheetClose'
import { SheetClose } from '../../../components/ui/SheetClose'
import { BUNDLE_NAME_MAX, normalizeBundleName, type IntakeBundle } from './intakeBundles'
import { SheetGriff } from '../../../components/ui/SheetGriff'

interface BundleSheetItem {
  id: string
  display_name: string
}

interface IntakeBundleSheetProps {
  /** Fehlt es, wird ein neues Bündel angelegt. */
  bundle?: IntakeBundle | null
  stackItems: readonly BundleSheetItem[]
  onClose: () => void
  onSave: (draft: { name: string; stackItemIds: string[] }) => Promise<void>
  onDelete?: () => Promise<void>
}

export function IntakeBundleSheet({ bundle, stackItems, onClose, onSave, onDelete }: IntakeBundleSheetProps) {
  const { t } = useTranslation()
  const titleId = useId()
  const nameId = useId()
  const { requestClose, closingProps } = useSheetClose(onClose)
  const [name, setName] = useState(bundle?.name ?? '')
  const [selected, setSelected] = useState<string[]>(() => {
    const known = new Set(stackItems.map(item => item.id))
    return (bundle?.stack_item_ids ?? []).filter(id => known.has(id))
  })
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState(false)

  const canSave = normalizeBundleName(name).length > 0 && selected.length > 0 && !saving

  const toggle = (id: string) => {
    setSelected(current => current.includes(id) ? current.filter(other => other !== id) : [...current, id])
  }

  const run = async (action: () => Promise<void>) => {
    setSaving(true)
    setError(false)
    try {
      await action()
    } catch {
      setError(true)
      setSaving(false)
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label={String(t('close', { defaultValue: 'Schließen' }))}
        onClick={requestClose}
        {...closingProps}
        className="tyd-backdrop fixed inset-0 z-50 cursor-pointer bg-black/60"
      />
      <section
        role="dialog"
        aria-modal="true"
        data-app-modal
        data-app-back-dirty-on-interaction
        aria-labelledby={titleId}
        {...closingProps}
        className="lg-sheet lg-sheet-solid tyd-sheet fixed inset-x-2 bottom-2 z-[60] max-h-[calc(100dvh-0.5rem-var(--tyd-popup-top))] overflow-y-auto overscroll-contain px-5 pt-2 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"
      >
        <SheetGriff className="mb-3" onClose={requestClose} disabled={saving} />
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="lg-title2">
              {bundle
                ? t('bundle_edit_title', { defaultValue: 'Bündel bearbeiten' })
                : t('bundle_new_title', { defaultValue: 'Neues Bündel' })}
            </h2>
            <p className="mt-1 text-[15px] leading-snug text-[var(--lg-text-2)]">
              {t('bundle_sheet_hint', { defaultValue: 'Substanzen, die du zusammen nimmst, bestätigst du im Kalender mit einem Tipp.' })}
            </p>
          </div>
          <SheetClose onClick={requestClose} />
        </header>

        <label htmlFor={nameId} className="label">
          {t('bundle_name_label', { defaultValue: 'Name' })}
        </label>
        <input
          id={nameId}
          className="input mb-5"
          value={name}
          maxLength={BUNDLE_NAME_MAX}
          placeholder={String(t('bundle_name_placeholder', { defaultValue: 'z. B. Morgen-Stack' }))}
          onChange={event => setName(event.target.value)}
          enterKeyHint="done"
          autoComplete="off"
        />

        <fieldset>
          <legend className="label">
            {t('bundle_items_label', { defaultValue: 'Substanzen' })}
          </legend>
          {stackItems.length === 0 ? (
            <p className="rounded-[18px] bg-[var(--lg-surface-2)] p-4 text-[15px] text-[var(--lg-text-3)]">
              {t('bundle_items_empty', { defaultValue: 'Lege zuerst Substanzen in My Stack an.' })}
            </p>
          ) : (
            // Gruppierte Liste wie in iOS: Name links, Häkchen rechts
            <ul className="lg-rows overflow-hidden rounded-[var(--r-xl)] bg-[var(--lg-surface-2)]">
              {stackItems.map(item => {
                const checked = selected.includes(item.id)
                return (
                  <li key={item.id}>
                    <label className="flex min-h-12 cursor-pointer items-center gap-3 px-4 transition-colors active:bg-[var(--lg-fill)]">
                      <span className="min-w-0 flex-1 truncate text-[17px] text-[var(--lg-text)]">{item.display_name}</span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(item.id)}
                        className="peer sr-only"
                      />
                      <span aria-hidden="true" className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--lg-accent)] ${checked
                        ? 'bg-[var(--lg-accent)] text-[var(--accent-contrast)]'
                        : 'shadow-[inset_0_0_0_1.5px_var(--lg-text-3)]'}`}
                      >
                        {checked && <Check size={14} strokeWidth={3} />}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </fieldset>

        {error && (
          <p role="alert" className="mt-3 px-1 text-[13px] text-[var(--lg-bad-text)]">
            {t('fehler_speichern', { defaultValue: 'Fehler beim Speichern' })}
          </p>
        )}

        <button
          type="button"
          disabled={!canSave}
          onClick={() => void run(() => onSave({ name, stackItemIds: selected }))}
          className="lg-btn lg-btn-primary mt-5 w-full"
        >
          <Check size={18} aria-hidden="true" />
          {t('bundle_save', { defaultValue: 'Bündel speichern' })}
        </button>

        {bundle && onDelete && (
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              if (!confirmDelete) { setConfirmDelete(true); return }
              void run(onDelete)
            }}
            data-tone="bad"
            className="lg-gray-btn mt-2 w-full !min-h-12"
          >
            <Trash2 size={15} aria-hidden="true" />
            {confirmDelete
              ? t('bundle_delete_confirm', { defaultValue: 'Wirklich löschen?' })
              : t('bundle_delete', { defaultValue: 'Bündel löschen' })}
          </button>
        )}
      </section>
    </>
  )
}
