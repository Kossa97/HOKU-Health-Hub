// src/components/injection3d/InjectionIntroSheet.tsx
import { Hand, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { SheetGriff } from '../ui/SheetGriff'

export const INJECTION_INTRO_VERSION = 1

export function InjectionIntroSheet({
  onClose,
  onDontShowAgain,
}: {
  onClose: () => void
  onDontShowAgain: () => void
}) {
  const { t } = useTranslation()

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose} />
      <div
        data-app-modal
        role="dialog"
        aria-modal="true"
        aria-labelledby="injection-intro-title"
        className="lg-sheet fixed bottom-2 left-2 right-2 z-[60] max-h-[calc(100dvh-0.5rem-var(--tyd-popup-top))] overflow-y-auto overscroll-contain px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-2"
      >
        <SheetGriff className="mb-4" onClose={onClose} />
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Hand size={18} strokeWidth={1.5} color="var(--lg-text-2)" aria-hidden="true" />
            <h2 id="injection-intro-title" className="lg-title2">{t('injection_intro_title', { defaultValue: 'Markierung setzen' })}</h2>
          </div>
          <button
            type="button"
            data-app-back-close
            aria-label={String(t('injection_close_hint', { defaultValue: 'Hinweis schließen' }))}
            onClick={onClose}
            className="lg-icon-btn lg-press shrink-0 bg-[var(--lg-fill)] !text-[var(--lg-text-2)]"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
        <p className="mb-5 text-[15px] leading-relaxed text-[var(--lg-text-2)]">
          {t('injection_intro_body', { defaultValue: 'Halte eine Stelle auf dem 3D-Torso gedrückt, um einen Pin zu setzen. Danach kannst du die Position feinjustieren.' })}
        </p>
        <div className="flex gap-3">
          <button type="button" data-quiet className="lg-gray-btn min-h-12 flex-1" onClick={onDontShowAgain}>
            {t('injection_intro_dont_show', { defaultValue: 'Nicht mehr anzeigen' })}
          </button>
          <button type="button" className="lg-btn lg-btn-primary min-h-12 flex-1 !px-4 !text-[15px]" onClick={onClose}>
            {t('injection_intro_understood', { defaultValue: 'Verstanden' })}
          </button>
        </div>
      </div>
    </>
  )
}
