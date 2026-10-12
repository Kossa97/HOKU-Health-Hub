import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft } from 'lucide-react'
import { BlutspiegelView } from '../features/blutspiegel/BlutspiegelView'
import { UEBERSICHT_PFAD } from '../features/blutspiegel/pfade'

/** Blutspiegel einer Substanz — wie die Detailseite einer Aktie. */
export function BlutspiegelDetail() {
  const { t } = useTranslation()
  const { key } = useParams()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 8 }}>
      <Link
        to={UEBERSICHT_PFAD}
        className="-ml-2 flex min-h-11 w-fit items-center gap-0.5 pr-2 text-[17px] font-medium"
        style={{ color: 'var(--accent)' }}
        data-bs-back
      >
        <ChevronLeft size={24} strokeWidth={2.4} aria-hidden="true" />
        {t('pk_sim_title')}
      </Link>
      <BlutspiegelView variant="full" initialKey={key ?? null} einzeln key={key} />
      <p className="disclaimer" style={{ textAlign: 'center', padding: '4px 8px 12px' }}>{t('pk_consult')}</p>
    </div>
  )
}
