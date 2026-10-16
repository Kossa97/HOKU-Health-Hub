import { useTranslation } from 'react-i18next'
import { CHART_WINDOWS, type ChartWindowKey } from '../../lib/chartWindow'

interface Props {
  value: ChartWindowKey
  onChange: (key: ChartWindowKey) => void
}

/** 30T/3M-Umschalter für das Sichtfenster des Verlaufs-Charts. */
export function ChartWindowToggle({ value, onChange }: Props) {
  const { t } = useTranslation()
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      {CHART_WINDOWS.map(win => {
        const on = value === win.key
        return (
          <button
            key={win.key}
            type="button"
            onClick={() => onChange(win.key)}
            aria-pressed={on}
            style={{
              padding: '3px 9px',
              borderRadius: 8,
              fontSize: '0.6rem',
              fontWeight: 800,
              cursor: 'pointer',
              background: on ? 'var(--accent-weak)' : 'transparent',
              color: on ? 'var(--accent)' : 'var(--text-muted)',
              border: on ? '1px solid var(--accent-border)' : '1px solid var(--border)',
            }}
          >
            {t(`fortschritt_window_${win.key}`)}
          </button>
        )
      })}
    </div>
  )
}
