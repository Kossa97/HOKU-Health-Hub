import { useRef, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import type { MetricChange } from '../../types'
import { panel, sectionLabel } from '../../styles'
import { metricLabel } from '../../lib/metricLabels'
import { formatNumber, formatSignedNumber } from '../../lib/dates'

const TOP_CHANGES_MOTION_CSS = `
  @keyframes fortschritt-change-card-enter {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes fortschritt-change-delta-enter {
    0% { opacity: 0; transform: translateY(4px); text-shadow: 0 0 0 transparent; }
    65% { opacity: 1; transform: translateY(0); text-shadow: 0 0 10px currentColor; }
    100% { opacity: 1; transform: translateY(0); text-shadow: 0 0 0 transparent; }
  }

  @keyframes fortschritt-change-copy-refresh {
    from { opacity: 0.35; }
    to { opacity: 1; }
  }

  @keyframes fortschritt-change-delta-refresh {
    0% { opacity: 0.45; text-shadow: 0 0 0 transparent; }
    60% { opacity: 1; text-shadow: 0 0 9px currentColor; }
    100% { opacity: 1; text-shadow: 0 0 0 transparent; }
  }

  .fortschritt-change-grid--entry .fortschritt-change-card {
    animation: fortschritt-change-card-enter 400ms cubic-bezier(.22,1,.36,1) both;
    animation-delay: var(--change-card-delay);
  }

  .fortschritt-change-grid--entry .fortschritt-change-delta {
    animation: fortschritt-change-delta-enter 300ms cubic-bezier(.22,1,.36,1) both;
    animation-delay: calc(var(--change-card-delay) + 170ms);
  }

  .fortschritt-change-grid--refresh .fortschritt-change-copy {
    animation: fortschritt-change-copy-refresh 260ms ease-out both;
    animation-delay: var(--change-card-delay);
  }

  .fortschritt-change-grid--refresh .fortschritt-change-delta {
    animation: fortschritt-change-delta-refresh 280ms cubic-bezier(.22,1,.36,1) both;
    animation-delay: calc(var(--change-card-delay) + 70ms);
  }

  @media (prefers-reduced-motion: reduce) {
    .fortschritt-change-grid *,
    .fortschritt-change-grid *::before,
    .fortschritt-change-grid *::after {
      animation: none !important;
    }
  }
`

interface Props {
  changes: MetricChange[]
  hasAnyData: boolean
  hasEnoughForTrend: boolean
  animationKey: string
  onSelect?: (key: string) => void
}

export function TopChangesSection({ changes, hasAnyData, hasEnoughForTrend, animationKey, onSelect }: Props) {
  const { t } = useTranslation()
  const initialAnimationKey = useRef(animationKey)
  const hasRefreshed = useRef(false)
  if (animationKey !== initialAnimationKey.current) hasRefreshed.current = true
  const motionMode = hasRefreshed.current ? 'refresh' : 'entry'

  return (
    <section style={{ ...panel, padding: '14px 14px 16px' }}>
      <p style={{ ...sectionLabel, marginBottom: 2 }}>{t('fortschritt_top_changes')}</p>
      <style>{TOP_CHANGES_MOTION_CSS}</style>
      <p style={{ fontSize: '0.68rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 12 }}>
        {t('fortschritt_top_changes_sub')}
      </p>

      {!hasAnyData && (
        <EmptyMessage
          title={t('fortschritt_no_values_title')}
          body={t('fortschritt_no_values_body')}
        />
      )}

      {hasAnyData && !hasEnoughForTrend && (
        <EmptyMessage
          title={t('fortschritt_little_data_title')}
          body={t('fortschritt_little_data_body')}
        />
      )}

      {hasAnyData && hasEnoughForTrend && changes.length === 0 && (
        <EmptyMessage
          title={t('fortschritt_stable_title')}
          body={t('fortschritt_stable_body')}
        />
      )}

      {changes.length > 0 && (
        <div
          key={animationKey}
          className={`fortschritt-change-grid fortschritt-change-grid--${motionMode}`}
          style={{
            display: 'grid',
            gridTemplateColumns: changes.length === 1 ? '1fr' : '1fr 1fr',
            gap: 8,
          }}
        >
          {changes.map((change, index) => (
            <ChangeCard key={change.key} change={change} index={index} onSelect={onSelect} />
          ))}
        </div>
      )}
    </section>
  )
}

function ChangeCard({
  change,
  index,
  onSelect,
}: {
  change: MetricChange
  index: number
  onSelect?: (key: string) => void
}) {
  const { t } = useTranslation()
  const deltaColor = change.delta > 0 ? '#10b981' : change.delta < 0 ? '#f59e0b' : 'var(--text-muted)'

  return (
    <button
      type="button"
      className="fortschritt-change-card"
      onClick={() => onSelect?.(change.key)}
      style={{
        '--change-card-delay': `${index * 90}ms`,
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '11px 12px',
        borderRadius: 14,
        background: 'var(--surface-input)',
        border: '1px solid var(--border)',
        cursor: onSelect ? 'pointer' : 'default',
      } as CSSProperties}
    >
      <div className="fortschritt-change-copy">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-dim)', lineHeight: 1.2 }}>
          {metricLabel(t, change.key, change.label)}
        </span>
        <span className="fortschritt-change-delta" style={{ fontSize: '0.75rem', fontWeight: 800, color: deltaColor, flexShrink: 0 }}>
          {formatDelta(change)}
        </span>
      </div>
      <p style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', lineHeight: 1.35 }}>
        {formatValue(change.from, change.unit)} → {formatValue(change.to, change.unit)}
      </p>
      </div>
    </button>
  )
}

function formatValue(value: number, unit: string): string {
  const n = formatNumber(value)
  if (unit === 'kg') return `${n} kg`
  if (unit === '%') return `${n}%`
  if (unit === '/10') return `${n}/10`
  if (unit) return `${n} ${unit}`
  return n
}

function formatDelta(change: MetricChange): string {
  const sign = change.delta > 0 ? '↑' : change.delta < 0 ? '↓' : '→'
  const signed = formatSignedNumber(change.delta)
  if (change.unit === 'kg') return `${sign} ${signed} kg`
  if (change.unit === '%') return `${sign} ${signed}%`
  if (change.unit === '/10') return `${sign} ${signed}`
  const abs = formatNumber(Math.abs(change.delta))
  return `${sign} ${change.delta > 0 ? '+' : ''}${abs}`
}

function EmptyMessage({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '12px 4px 4px' }}>
      <p style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-dim)', marginBottom: 6 }}>{title}</p>
      <p style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-muted)', lineHeight: 1.45 }}>{body}</p>
    </div>
  )
}
