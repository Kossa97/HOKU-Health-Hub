import { useTranslation } from 'react-i18next'
import { Ban } from 'lucide-react'
import { Sheet } from './Sheet'

/** Bestaetigung vor dem Blockieren; Fokus auf „Abbrechen". */
export function BlockSheet({ username, busy, onCancel, onConfirm }: {
  username: string
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  return (
    <Sheet labelledBy="block-title" busy={busy} onClose={onCancel} role="alertdialog" data-block-sheet>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--lg-bad)_18%,transparent)] text-[var(--lg-bad-text)]">
          <Ban size={18} aria-hidden="true" />
        </span>
        <h2 id="block-title" className="lg-title2 min-w-0 break-words pt-2">{t('block_title', { name: username })}</h2>
      </div>
      <p className="mt-3 text-[15px] leading-snug text-[var(--lg-text-2)]">{t('block_desc')}</p>
      <div className="mt-5 flex gap-2">
        <button type="button" autoFocus data-app-back-close disabled={busy} onClick={onCancel} data-quiet className="lg-gray-btn flex-1 !min-h-12 !text-[17px]">
          {t('cancel')}
        </button>
        <button type="button" data-block-confirm disabled={busy} onClick={onConfirm} data-tone="bad" className="lg-gray-btn flex-1 !min-h-12 !text-[17px]">
          {t('block_action')}
        </button>
      </div>
    </Sheet>
  )
}
