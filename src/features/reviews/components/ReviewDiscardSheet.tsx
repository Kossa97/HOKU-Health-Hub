import { useId } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * „Änderungen verwerfen?" — wie das Aktionsblatt in iOS: oben die Frage mit
 * „Verwerfen", darunter abgesetzt „Weiter bearbeiten". Der Fokus liegt auf
 * „Weiter bearbeiten", damit Enter nichts wegwirft; ein Tipp daneben,
 * Escape und die Zurück-Geste führen ebenfalls zurück ins Formular.
 */
export function ReviewDiscardSheet({ onKeep, onDiscard }: {
  onKeep: () => void
  onDiscard: () => void
}) {
  const { t } = useTranslation()
  const id = useId()
  return (
    <div
      data-app-modal
      className="tyd-backdrop fixed inset-0 z-[80] flex items-end justify-center bg-black/45 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
      onClick={event => { event.stopPropagation(); onKeep() }}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-titel`}
        aria-describedby={`${id}-text`}
        data-review-discard
        className="tyd-sheet flex w-full max-w-md flex-col gap-2 !pb-0"
        onClick={event => event.stopPropagation()}
        onKeyDown={event => {
          if (event.key !== 'Escape') return
          event.stopPropagation()
          onKeep()
        }}
      >
        <div className="overflow-hidden rounded-[14px] bg-[var(--lg-sheet-solid)]">
          <div className="px-4 pb-3 pt-3.5 text-center">
            <h2 id={`${id}-titel`} className="text-[13px] font-semibold text-[var(--lg-text-2)]">{t('review_discard_title')}</h2>
            <p id={`${id}-text`} className="mt-1 text-[13px] text-[var(--lg-text-3)]">{t('review_discard_desc')}</p>
          </div>
          <button
            type="button"
            onClick={onDiscard}
            className="block min-h-14 w-full border-t-[0.5px] border-[var(--lg-separator)] text-[20px] text-[var(--lg-bad-text)] active:bg-white/[0.06]"
          >
            {t('review_discard')}
          </button>
        </div>
        <button
          type="button"
          autoFocus
          data-app-back-close
          onClick={onKeep}
          className="block min-h-14 w-full rounded-[14px] bg-[var(--lg-sheet-solid)] text-[20px] font-semibold text-[var(--lg-accent-text)] active:bg-white/[0.06]"
        >
          {t('review_keep_editing')}
        </button>
      </div>
    </div>
  )
}
