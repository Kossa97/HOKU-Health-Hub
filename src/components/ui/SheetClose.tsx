import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/** Schließen oben rechts in einem Sheet: grauer Kreis wie in iOS. */
export function SheetClose({ onClick, disabled, label }: { onClick: () => void; disabled?: boolean; label?: string }) {
  const { t } = useTranslation()
  return (
    <button type="button" data-app-back-close aria-label={label ?? t('close', { defaultValue: 'Schließen' })} onClick={onClick} disabled={disabled}
      className="lg-icon-btn shrink-0 !text-[var(--lg-text-2)]">
      <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-[var(--lg-fill)]"><X size={17} aria-hidden="true" /></span>
    </button>
  )
}
