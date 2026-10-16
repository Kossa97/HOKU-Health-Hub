import { useId, useState } from 'react'
import { Check, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { BUNDLE_NAME_MAX, normalizeBundleName, type IntakeBundle } from './intakeBundles'

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
        onClick={onClose}
        className="fixed inset-0 z-50 cursor-pointer bg-black/70"
      />
      <section
        role="dialog"
        aria-modal="true"
        data-app-modal
        data-app-back-dirty-on-interaction
        aria-labelledby={titleId}
        className="fixed inset-x-3 bottom-3 z-[60] max-h-[calc(100dvh-1.5rem)] overflow-y-auto overscroll-contain rounded-3xl border border-white/10 bg-[var(--surface)] p-4 shadow-[0_-16px_48px_rgba(0,0,0,0.55)]"
      >
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 id={titleId} className="text-lg font-black text-white">
              {bundle
                ? t('bundle_edit_title', { defaultValue: 'Bündel bearbeiten' })
                : t('bundle_new_title', { defaultValue: 'Neues Bündel' })}
            </h2>
            <p className="mt-1 text-sm font-semibold text-slate-400">
              {t('bundle_sheet_hint', { defaultValue: 'Substanzen, die du zusammen nimmst, bestätigst du im Kalender mit einem Tipp.' })}
            </p>
          </div>
          <button
            type="button"
            data-app-back-close
            aria-label={String(t('close', { defaultValue: 'Schließen' }))}
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 cursor-pointer place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-slate-300 transition-colors hover:bg-white/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <label htmlFor={nameId} className="mb-1.5 block text-xs font-extrabold uppercase tracking-[0.12em] text-slate-400">
          {t('bundle_name_label', { defaultValue: 'Name' })}
        </label>
        <input
          id={nameId}
          className="input mb-4 min-h-11 w-full text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          value={name}
          maxLength={BUNDLE_NAME_MAX}
          placeholder={String(t('bundle_name_placeholder', { defaultValue: 'z. B. Morgen-Stack' }))}
          onChange={event => setName(event.target.value)}
          enterKeyHint="done"
          autoComplete="off"
        />

        <fieldset>
          <legend className="mb-1.5 text-xs font-extrabold uppercase tracking-[0.12em] text-slate-400">
            {t('bundle_items_label', { defaultValue: 'Substanzen' })}
          </legend>
          {stackItems.length === 0 ? (
            <p className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 text-sm text-slate-400">
              {t('bundle_items_empty', { defaultValue: 'Lege zuerst Substanzen in My Stack an.' })}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {stackItems.map(item => {
                const checked = selected.includes(item.id)
                return (
                  <li key={item.id}>
                    <label className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border px-3 transition-colors ${checked
                      ? 'border-emerald-500/30 bg-emerald-500/[0.1]'
                      : 'border-white/10 bg-white/[0.035] hover:bg-white/[0.06]'}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(item.id)}
                        className="h-5 w-5 shrink-0 accent-emerald-400"
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-bold text-white">{item.display_name}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          )}
        </fieldset>

        {error && (
          <p role="alert" className="mt-3 text-sm font-bold text-rose-300">
            {t('fehler_speichern', { defaultValue: 'Fehler beim Speichern' })}
          </p>
        )}

        <button
          type="button"
          disabled={!canSave}
          onClick={() => void run(() => onSave({ name, stackItemIds: selected }))}
          className="mt-4 flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.17] text-base font-extrabold text-emerald-300 transition-colors hover:bg-emerald-500/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
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
            className="mt-2 flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-rose-500/20 bg-rose-500/[0.08] text-sm font-extrabold text-rose-300 transition-colors hover:bg-rose-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-50"
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
