import { Navigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
      {/* Hinweis und Haftung gebuendelt unter der Liste: einmal, statt oben als
          Kasten und unten noch einmal als Fusszeile. */}
      <BlutspiegelUebersicht>
        <footer className="flex flex-col gap-2 pt-2">
          <MedicalNotice />
          <p className="disclaimer" style={{ textAlign: 'center', padding: '0 8px 12px' }}>{t('pk_sim_disclaimer')} {t('pk_consult')}</p>
        </footer>
      </BlutspiegelUebersicht>
    </div>
  )
}
