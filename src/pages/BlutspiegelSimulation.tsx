import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { format } from 'date-fns'
import { MedicalNotice } from '../features/compliance/components/MedicalNotice'
import { BlutspiegelUebersicht } from '../features/blutspiegel/BlutspiegelUebersicht'
import { MANUELL_PFAD, detailPfad } from '../features/blutspiegel/pfade'

/**
 * Blutspiegel — Übersicht wie die Aktienliste: je Substanz eine Zeile.
 * Detail unter /simulation/<eintrag>, eigene Simulation unter /simulation/neu.
 */
export function BlutspiegelSimulation() {
  const { t } = useTranslation()
  const [searchParams] = useSearchParams()

  // Alte Links (?entry=…&pk=…) führen weiter auf die neuen Adressen.
  const altEintrag = searchParams.get('entry')
  if (altEintrag) return <Navigate to={detailPfad(altEintrag)} replace />
  const altProfil = searchParams.get('pk')
  if (altProfil) return <Navigate to={`${MANUELL_PFAD}?pk=${encodeURIComponent(altProfil)}`} replace />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 8 }}>
      <header className="grid items-start gap-x-3" style={{ gridTemplateColumns: 'minmax(0, 1fr) auto' }}>
        <h1 className="min-w-0 text-[2rem] font-black leading-tight tracking-tight" style={{ color: 'var(--text)' }}>{t('pk_sim_title')}</h1>
        <Link
          to={MANUELL_PFAD}
          aria-label={t('pk_manual_open')}
          title={t('pk_manual_open')}
          className="mt-1 flex h-11 w-11 items-center justify-center rounded-full"
          style={{ background: 'var(--surface-raised)', border: '1px solid var(--border)', color: 'var(--text)' }}
          data-bs-manual
        >
          <Plus size={22} />
        </Link>
        <p className="col-span-2 text-[1.5rem] font-extrabold leading-tight tracking-tight" style={{ color: 'var(--text-muted)' }}>
          {t('pk_overview_as_of', { time: format(new Date(), 'HH:mm') })}
        </p>
      </header>
      <MedicalNotice />

      <BlutspiegelUebersicht />

      <p className="disclaimer" style={{ textAlign: 'center', padding: '4px 8px 12px' }}>{t('pk_sim_disclaimer')} {t('pk_consult')}</p>
    </div>
  )
}
