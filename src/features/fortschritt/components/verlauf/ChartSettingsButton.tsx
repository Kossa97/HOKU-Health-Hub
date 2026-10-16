import { SlidersHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface Props {
  onClick: () => void
  label?: string
}

export function ChartSettingsButton({ onClick, label: labelProp }: Props) {
  const { t } = useTranslation()
  const label = labelProp ?? t('fortschritt_chart_settings')
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '7px 11px',
        borderRadius: 10,
        border: '1px solid var(--border)',
        background: 'var(--surface-input)',
        color: 'var(--text-muted)',
        fontSize: '0.68rem',
        fontWeight: 800,
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <SlidersHorizontal size={15} />
      {label}
    </button>
  )
}
