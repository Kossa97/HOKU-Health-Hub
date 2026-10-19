import { useTranslation } from 'react-i18next'
import { Star } from 'lucide-react'

/**
 * Nach „Plan beenden": einmal kurz fragen, wie es war. Kein Fenster, das
 * im Weg steht — eine Meldung mit zwei Knoepfen. Wer „Spaeter" waehlt
 * oder sie verstreichen laesst, wird hier nicht noch einmal gefragt; der
 * Zyklus taucht dann in den Bewertungen unter „noch nicht bewertet" auf.
 */
export function BewertenAnstoss({ name, onBewerten, onSpaeter }: {
  name: string
  onBewerten: () => void
  onSpaeter: () => void
}) {
  const { t } = useTranslation()
  return (
    <div data-review-prompt className="flex items-center gap-3">
      <Star size={18} aria-hidden="true" className="shrink-0 text-amber-400" fill="currentColor" />
      <p className="min-w-0 flex-1 text-[15px] font-semibold text-[var(--lg-text)]">{t('review_prompt_title', { name })}</p>
      <button type="button" onClick={onSpaeter} className="min-h-11 shrink-0 px-1 text-[14px] font-semibold text-[var(--lg-text-2)]">
        {t('review_prompt_later')}
      </button>
      <button type="button" onClick={onBewerten} className="lg-gray-btn shrink-0 !min-h-9 !px-3.5 !text-[14px]">
        {t('review_prompt_rate')}
      </button>
    </div>
  )
}
