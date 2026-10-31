import { Info } from 'lucide-react'
import { useTranslation } from 'react-i18next'

/**
 * „Kein Medizinprodukt, ersetzt keinen aerztlichen Rat" — an Rechnern,
 * Simulation, Registrierung und im Profil (Apple 1.4.1/1.4.2, Google
 * „Health apps"). Bewusst unaufdringlich, aber immer sichtbar.
 */
export function MedicalNotice({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <p data-medical-notice className={`flex items-start gap-2.5 rounded-[18px] bg-[var(--lg-surface-2)] px-4 py-2.5 text-[13px] leading-snug text-[var(--lg-text-2)] ${className}`}>
      <Info size={15} aria-hidden="true" className="mt-px shrink-0 text-[var(--lg-text-3)]" />
      <span>{t('medical_notice')}</span>
    </p>
  )
}
