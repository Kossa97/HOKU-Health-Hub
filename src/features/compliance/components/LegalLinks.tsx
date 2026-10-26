import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { LEGAL_PATHS } from '../legal/texts'

/** Datenschutz · Nutzungsbedingungen · Impressum — klein, als Fusszeile. */
export function LegalLinks({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <nav aria-label={t('legal_links_label')} data-legal-links className={`flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[13px] text-[var(--lg-text-3)] ${className}`}>
      <Link to={LEGAL_PATHS.datenschutz} className="underline-offset-2 hover:underline">{t('legal_privacy')}</Link>
      <span aria-hidden="true">·</span>
      <Link to={LEGAL_PATHS.nutzungsbedingungen} className="underline-offset-2 hover:underline">{t('legal_terms')}</Link>
      <span aria-hidden="true">·</span>
      <Link to={LEGAL_PATHS.impressum} className="underline-offset-2 hover:underline">{t('legal_imprint')}</Link>
    </nav>
  )
}
