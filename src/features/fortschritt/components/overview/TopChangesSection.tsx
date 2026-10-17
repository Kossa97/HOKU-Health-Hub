import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { MetricChange } from '../../types'
import type { SeriesPoint } from '../../lib/metrics'
import { metricLabel } from '../../lib/metricLabels'
import { formatNumber, formatSignedNumber } from '../../lib/dates'
import { isWellnessMetricKey } from '../../constants'

interface Props {
  changes: MetricChange[]
  hasAnyData: boolean
  hasEnoughForTrend: boolean
  /** Verlauf je Messwert im Zeitraum — Hintergrund-Kurve der Karte */
  seriesFor: (key: string) => SeriesPoint[]
  colorFor: (key: string) => string
  onSelect?: (key: string) => void
  /** Nur antippbar, wo das Antippen auch etwas tut — sonst ist die Karte keine Schaltfläche. */
  canSelect?: (key: string) => boolean
}

const unitText = (unit: string) => (unit === '/10' ? '' : unit === '%' ? ' %' : unit ? ` ${unit}` : '')

/** Tageswerte von 1–10 wären als Kurve nur Zacken: gleitendes 7-Tage-Mittel. */
function smooth(points: SeriesPoint[], key: string): number[] {
  const values = points.map(p => p.value)
  if (!isWellnessMetricKey(key)) return values
  return values.map((_, i) => {
    const window = values.slice(Math.max(0, i - 6), i + 1)
    return window.reduce((s, v) => s + v, 0) / window.length
  })
}

function Spark({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = Math.max(1e-6, max - min)
  const d = values.map((v, i) => `${i ? 'L' : 'M'}${((i / (values.length - 1)) * 200).toFixed(1)},${(56 - ((v - min) / span) * 46).toFixed(1)}`).join('')
  return (
    <svg viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden>
      <path d={`${d}L200,60L0,60Z`} fill={color} fillOpacity="0.12" />
      <path d={d} fill="none" stroke={color} strokeOpacity="0.85" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function TopChangesSection({ changes, hasAnyData, hasEnoughForTrend, seriesFor, colorFor, onSelect, canSelect }: Props) {
  const { t } = useTranslation()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(0)

  const empty = !hasAnyData
    ? { title: t('fortschritt_no_values_title'), body: t('fortschritt_no_values_body') }
    : !hasEnoughForTrend
      ? { title: t('fortschritt_little_data_title'), body: t('fortschritt_little_data_body') }
      : changes.length === 0
        ? { title: t('fortschritt_stable_title'), body: t('fortschritt_stable_body') }
        : null

  // Karten nur neu bauen, wenn sich ihr Inhalt ändert — nicht bei jedem Wisch-Frame
  const cards = useMemo(() => changes.map(change => {
              const label = metricLabel(t, change.key, change.label)
              const color = colorFor(change.key)
              const arrow = change.delta > 0 ? '↑' : change.delta < 0 ? '↓' : '→'
              const body = (
                <>
                  <Spark values={smooth(seriesFor(change.key), change.key)} color={color} />
                  <div className="n">{label}</div>
                  <div className="big">
                    <span style={{ color, marginRight: 6 }} aria-hidden>{arrow}</span>
                    {formatSignedNumber(change.delta)}{unitText(change.unit)}
                  </div>
                  <div className="ft">
                    {formatNumber(change.from)} → {formatNumber(change.to)}{change.unit === '/10' ? ` ${t('fortschritt_values_scale')}` : unitText(change.unit)}
                  </div>
                </>
              )
              const selectable = onSelect && (canSelect?.(change.key) ?? true)
              return selectable ? (
                <button
                  key={change.key}
                  type="button"
                  className="fg-chg fg-surface fortschritt-change-card"
                  onClick={() => onSelect(change.key)}
                >
                  {body}
                </button>
              ) : (
                <div key={change.key} className="fg-chg fg-surface fortschritt-change-card">{body}</div>
              )
            }), [changes, seriesFor, colorFor, onSelect, canSelect, t])

  const onScroll = () => {
    const el = scrollRef.current
    const card = el?.firstElementChild as HTMLElement | null
    if (!el || !card) return
    setPage(Math.round(el.scrollLeft / (card.offsetWidth + 10)))
  }

  return (
    <section aria-labelledby="fg-changes-title">
      <div className="fg-section-head">
        <h2 id="fg-changes-title" className="fg-h3">{t('fortschritt_top_changes')}</h2>
        <span className="fg-meta">{t('fortschritt_top_changes_sub')}</span>
      </div>

      {empty ? (
        <div className="fg-empty fg-surface">
          <p>{empty.title}</p>
          <p>{empty.body}</p>
        </div>
      ) : (
        <>
          <div ref={scrollRef} className="fg-swipe" onScroll={onScroll}>
            {cards}
          </div>
          {changes.length > 1 && (
            <div className="fg-dots" aria-hidden>
              {changes.map((change, i) => <i key={change.key} data-on={i === page} />)}
            </div>
          )}
        </>
      )}
    </section>
  )
}
