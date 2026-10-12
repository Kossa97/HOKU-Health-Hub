import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronLeft } from 'lucide-react'
import { MedicalNotice } from '../features/compliance/components/MedicalNotice'
import { ManualSimulation } from '../features/blutspiegel/ManualSimulation'
import { UEBERSICHT_PFAD } from '../features/blutspiegel/pfade'

/** Eigene Simulation (ohne Zyklus) — erreichbar über das „+“ der Übersicht. */
export function BlutspiegelManuell() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 8 }}>
      <Link
        to={UEBERSICHT_PFAD}
        className="-ml-2 flex min-h-11 w-fit items-center gap-0.5 pr-2 text-[17px] font-medium"
        style={{ color: 'var(--accent)' }}
      >
        <ChevronLeft size={24} strokeWidth={2.4} aria-hidden="true" />
        {t('pk_sim_title')}
      </Link>
      <MedicalNotice />
      <ManualSimulation preselectProfileId={searchParams.get('pk')} startOffen />
      <p className="disclaimer" style={{ textAlign: 'center', padding: '4px 8px 12px' }}>{t('pk_sim_disclaimer')} {t('pk_consult')}</p>
    </div>
  )
}
