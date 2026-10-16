import { Pencil, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const ENTRY_GLOW_CSS = `
  @keyframes fortschritt-entry-glow {
    0%, 100% {
      box-shadow:
        0 0 10px rgba(0, 204, 245, 0.22),
        var(--shadow-btn-primary);
    }
    50% {
      box-shadow:
        0 0 18px rgba(0, 204, 245, 0.38),
        var(--shadow-btn-primary);
    }
  }
  .fortschritt-entry-glow-wrap .btn-primary {
    animation: fortschritt-entry-glow 2.2s ease-in-out infinite !important;
    animation-duration: 2.2s !important;
    animation-iteration-count: infinite !important;
  }
  @media (prefers-reduced-motion: reduce) {
    .fortschritt-entry-glow-wrap .btn-primary {
      animation: none !important;
      box-shadow:
        0 0 12px rgba(0, 204, 245, 0.28),
        var(--shadow-btn-primary) !important;
    }
  }
`

interface Props {
  rangeLabel: string
  onLogToday: () => void
  hasTodayEntry?: boolean
  /** Daten geladen — Glow erst dann, kein Flackern */
  dataReady?: boolean
}

export function FortschrittHeader({
  rangeLabel,
  onLogToday,
  hasTodayEntry = false,
  dataReady = false,
}: Props) {
  const { t } = useTranslation()
  // Glow genau wenn der Button „Fortschritt eintragen“ zeigt (noch kein heutiger Eintrag)
  const showGlow = dataReady && !hasTodayEntry

  const button = (
    <button
      type="button"
      onClick={onLogToday}
      className="btn-primary"
      style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: '12px 16px',
        fontSize: '0.82rem',
      }}
    >
      {hasTodayEntry ? <Pencil size={17} /> : <Plus size={17} />}
      {hasTodayEntry ? t('fortschritt_edit_today') : t('fortschritt_log_today')}
    </button>
  )

  return (
    <header style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {showGlow && <style>{ENTRY_GLOW_CSS}</style>}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        flexWrap: 'wrap',
        gap: '4px 10px',
      }}>
        <h1 style={{ fontSize: '1.45rem', fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.02em', margin: 0 }}>
          {t('fortschritt_title')}
        </h1>
        <span style={{
          fontSize: '0.62rem',
          fontWeight: 700,
          color: 'var(--text-muted)',
        }}>
          {rangeLabel}
        </span>
      </div>

      <div
        className={showGlow ? 'fortschritt-entry-glow-wrap' : undefined}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
      >
        {hasTodayEntry && (
          <span style={{
            fontSize: '0.62rem',
            fontWeight: 900,
            letterSpacing: '0.08em',
            color: '#22c55e',
            textAlign: 'center',
            lineHeight: 1,
          }}>
            {t('fortschritt_done')}
          </span>
        )}
        {button}
      </div>
    </header>
  )
}
