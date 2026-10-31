import { useTranslation } from 'react-i18next'
import { CloudOff, Zap } from 'lucide-react'
import { setzeStoerungSimuliert, useStoerung } from '../lib/stoerung'

/**
 * Schmale Leiste oben, solange Dienste nicht erreichbar sind — echt oder
 * per Schalter simuliert. Simuliert lässt sie sich hier direkt beenden,
 * auch wenn das Profil (wo der Schalter steht) offline nicht lädt.
 */
export function VerbindungsHinweis() {
  const { t } = useTranslation()
  const { simuliert, verbindung } = useStoerung()
  if (!simuliert && verbindung === 'online') return null

  return (
    <div
      role="status"
      data-verbindungs-hinweis={simuliert ? 'simuliert' : 'offline'}
      style={{
        // Über der unteren Navigation, nicht über den Knöpfen der Kopfzeile.
        // Feste dunkle Kapsel wie die Meldungen (Toaster in App.tsx).
        position: 'fixed',
        bottom: 'calc(var(--bottom-nav-height) + env(safe-area-inset-bottom) + 8px)',
        left: '50%',
        transform: 'translateX(-50%)',
        maxWidth: 'calc(100vw - 32px)',
        zIndex: 9000,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: simuliert ? '4px 4px 4px 12px' : '8px 16px',
        borderRadius: 999,
        background: '#2c2c2e',
        color: '#fff',
        boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
        fontSize: 13,
        lineHeight: 1.3,
        whiteSpace: 'nowrap',
      }}
    >
      {simuliert
        ? <Zap size={16} aria-hidden="true" style={{ flexShrink: 0, color: '#ffb340' }} />
        : <CloudOff size={16} aria-hidden="true" style={{ flexShrink: 0, color: 'rgba(255,255,255,0.7)' }} />}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {simuliert ? t('stoerung_banner_simuliert') : t('stoerung_banner_offline')}
      </span>
      {simuliert && (
        <button
          type="button"
          onClick={() => setzeStoerungSimuliert(false)}
          style={{ minHeight: 32, padding: '0 12px', borderRadius: 999, border: 0, fontSize: 13, fontWeight: 500, background: 'rgba(255,255,255,0.14)', color: '#fff', cursor: 'pointer' }}
        >
          {t('stoerung_beenden')}
        </button>
      )}
    </div>
  )
}
