import { TrendingUp } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { DailyLogEntry, DateRange } from '../../types'
import {
  buildValueOverview,
  type ValueOverviewDirection,
  type ValueOverviewTone,
} from '../../lib/valueOverview'
import { panel, sectionLabel } from '../../styles'
import { formatNumber } from '../../lib/dates'
import { metricLabel } from '../../lib/metricLabels'

interface Props {
  dailyLogs: DailyLogEntry[]
  range: DateRange
}

const TONE_COLORS: Record<ValueOverviewTone, string> = {
  positive: '#10b981',
  neutral: 'var(--text-muted)',
  warning: '#f59e0b',
  negative: '#ef4444',
}

const ARROWS: Record<ValueOverviewDirection, string> = {
  up: '↑',
  down: '↓',
  flat: '→',
}

const number = (value: number) => formatNumber(value, 1)

const valueWithUnit = (value: number, unit: '' | '%') =>
  unit ? `${number(value)} ${unit}` : number(value)

export function WerteCard({ dailyLogs, range }: Props) {
  const { t } = useTranslation()
  const rows = buildValueOverview(dailyLogs, range)

  return (
    <section style={{
      ...panel,
      padding: '14px 14px 12px',
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p style={{ ...sectionLabel, margin: 0 }}>{t('fortschritt_values_title')}</p>
        <TrendingUp size={16} color="var(--accent)" aria-hidden="true" />
      </div>
      <p style={{ margin: '3px 0 8px', fontSize: '0.68rem', color: 'var(--text-muted)' }}>
        {t('fortschritt_values_sub')}
      </p>

      <div style={{ display: 'flex', flex: 1, minHeight: 0, flexDirection: 'column' }}>
        {rows.map(row => (
          <div key={row.key} style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            alignItems: 'center',
            gap: 6,
            flex: 1,
            minHeight: 34,
            borderBottom: row.key === 'body_fat_pct' ? 'none' : '1px solid var(--border)',
          }}>
            <span style={{
              minWidth: 0,
              overflow: 'hidden',
              color: 'var(--text-muted)',
              fontSize: '0.68rem',
              fontWeight: 800,
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {metricLabel(t, row.key, row.label)}
            </span>
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 5, whiteSpace: 'nowrap' }}>
              {row.average == null ? (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 700 }}>
                  {t('fortschritt_values_no_data')}
                </span>
              ) : (
                <>
                  <strong style={{ color: 'var(--text-dim)', fontSize: '0.82rem', fontWeight: 900 }}>
                    {valueWithUnit(row.average, row.unit)}
                  </strong>
                  {row.delta == null || row.direction == null ? (
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 700 }}>
                      {t('fortschritt_values_no_compare')}
                    </span>
                  ) : (
                    <span
                      aria-label={t('fortschritt_values_change_aria', { value: valueWithUnit(row.delta, row.unit) })}
                      style={{ color: TONE_COLORS[row.tone], fontSize: '0.68rem', fontWeight: 800 }}
                    >
                      {ARROWS[row.direction]} {row.delta > 0 ? '+' : ''}{valueWithUnit(row.delta, row.unit)}
                    </span>
                  )}
                </>
              )}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
