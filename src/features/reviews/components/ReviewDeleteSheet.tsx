import { useTranslation } from 'react-i18next'
import { Trash2 } from 'lucide-react'
import { SheetGriff } from '../../../components/ui/SheetGriff'

/**
 * Loeschen einer Bewertung — ein eigenes Sheet statt des Browser-Fensters.
 * Nennt, was verschwindet (Substanz und Zyklus); der Fokus liegt auf
 * „Abbrechen", damit ein Druck auf Enter nichts loescht.
 */
export function ReviewDeleteSheet({ name, zyklus, busy, onCancel, onConfirm }: {
  name: string
  zyklus: string
  busy: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  return (
    <div
      data-app-modal
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-[var(--tyd-popup-top)]"
      onClick={() => { if (!busy) onCancel() }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="review-delete-title"
        aria-describedby="review-delete-desc"
        data-review-delete
        className="lg-sheet w-full max-w-md px-5 pb-5 pt-2"
        onClick={event => event.stopPropagation()}
        onKeyDown={event => {
          if (event.key !== 'Escape' || busy) return
          event.stopPropagation()
          onCancel()
        }}
      >
        <SheetGriff className="mb-3" onClose={onCancel} disabled={busy} />
        <div className="flex items-start gap-3">
          <Trash2 size={18} strokeWidth={1.5} aria-hidden="true" className="mt-1 shrink-0 text-[var(--lg-text-2)]" />
          <div className="min-w-0">
            <h2 id="review-delete-title" className="lg-title2">{t('review_delete_title')}</h2>
            <p id="review-delete-desc" className="mt-1 text-[15px] leading-snug text-[var(--lg-text-2)]">
              {name} · {zyklus}
            </p>
          </div>
        </div>
        <p className="mt-3 text-[15px] leading-snug text-[var(--lg-text-2)]">{t('review_delete_desc')}</p>
        <div className="mt-6 flex gap-2">
          <button
            type="button"
            autoFocus
            data-app-back-close
            disabled={busy}
            onClick={onCancel}
            data-quiet
            className="lg-gray-btn flex-1 !min-h-12 !text-[17px]"
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            data-tone="bad"
            className="lg-gray-btn flex-1 !min-h-12 !text-[17px]"
          >
            {busy ? t('review_deleting') : t('loeschen')}
          </button>
        </div>
      </div>
    </div>
  )
}
