import type { MetricDefinition } from '../../lib/metricDefinitions'
import type { MetricKey } from '../../types'
import { useTranslation } from 'react-i18next'
import { denyProps } from '../../../../lib/denyFeedback'

interface Props {
  availableMetrics: MetricDefinition[]
  metricKey: MetricKey
  pointCounts: Map<string, number>
  onSelectMetric: (key: MetricKey) => void
}

export function MetricChipBar({
  availableMetrics,
  metricKey,
  pointCounts,
  onSelectMetric,
}: Props) {
  const { t } = useTranslation()
  if (availableMetrics.length <= 1) return null

  return (
    <div style={{
      display: 'flex',
      width: '100%',
      gap: 4,
      overflowX: 'auto',
      paddingBottom: 1,
      marginBottom: 10,
      WebkitOverflowScrolling: 'touch',
      scrollbarWidth: 'none',
    }}>
      {availableMetrics.map(metric => {
        const count = pointCounts.get(metric.key) ?? 0
        const disabled = metric.isLab ? count < 2 : count === 0
        const active = metricKey === metric.key
        return (
          <button
            key={metric.key}
            type="button"
            {...denyProps(disabled, metric.isLab
              ? t('fortschritt_chip_need_two', { metric: metric.label })
              : t('fortschritt_chip_no_values', { metric: metric.label }))}
            onClick={() => { if (!disabled) onSelectMetric(metric.key) }}
            style={{
              flexShrink: 0,
              padding: '4px 9px',
              borderRadius: 99,
              fontSize: '0.68rem',
              fontWeight: 800,
              whiteSpace: 'nowrap',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.32 : 1,
              background: active ? `${metric.color}22` : 'transparent',
              color: active ? metric.color : 'var(--text-muted)',
              border: `1px solid ${active ? `${metric.color}44` : 'var(--border)'}`,
            }}
          >
            {metric.label}
          </button>
        )
      })}
    </div>
  )
}
