import { forwardRef, useCallback, useImperativeHandle, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { useTranslation } from 'react-i18next'
import { dayToTsSafe, formatDaySafe, formatNumber, formatSignedNumber } from '../../lib/dates'
import type { CycleSubstance, DateRange, MetricKey, OngoingSubstance } from '../../types'
import type { MetricDefinition } from '../../lib/metricDefinitions'
import { buildMetricSeries, computeDelta } from '../../lib/metrics'
import type { BloodworkEntry, DailyLogEntry, WeightLogEntry } from '../../types'
import { substanceBarEnd } from '../../lib/focusSummary'
import { buildCycleLegendItems, type CycleLegendItem } from '../../lib/cycleLegend'
import { assignLanes, computeCycleBandLayout, laneCount } from '../../lib/cycleLanes'
import { usesReducedMetricPoints } from '../../lib/chartTooltip'
import { filterDatesInRange } from '../../lib/range'
import { panel } from '../../styles'
import { ChartSettingsButton } from './ChartSettingsButton'
import { MetricChipBar } from './MetricChipBar'
import { rangeBounds, windowMsForRange } from '../../lib/chartWindow'
import { StocksChart, type LaneBand } from '../../../blutspiegel/chart/StocksChart'
import type { LevelPoint } from '../../../blutspiegel/chart/stocksChartMath'
import { clampViewEnd } from '../../../../components/liveCycleChart/chartMath'

/** Feste Spalte links für die senkrechte Einheit — gedrehter Text braucht nur eine Zeilenhöhe. */
const AXIS_UNIT_GUTTER = 14
/** Höhe der X-Achsen-Beschriftung, damit die Einheit auf den Plot zentriert wird statt aufs Panel. */
const AXIS_UNIT_BOTTOM_INSET = 24
/** Wert + Delta zweizeilig — feste Höhe, damit die Kopfzeile den Chart nicht verschiebt. */
const HEADER_VALUE_HEIGHT = 42
const CHART_HEIGHT = 300
/** Halten bis zum Ablesen auf dem Handy — Wischen blaettert zurueck. */
const HOLD_MS = 300

/** Springt im Verlauf ans Ende oder an einen Zeitpunkt. */
export interface ChartPanHandle {
  jumpToNow: () => void
  /** Setzt `ts` an den linken Rand des Fensters. */
  jumpToTs: (ts: number) => void
}

interface Props {
  /** Voller Datenbereich — das Fenster schneidet daraus zu. */
  dataRange: DateRange
  /** Seiten-Zeitraum (30T … Alles): bestimmt Sichtfenster und das Delta „im Zeitraum“. */
  pageRange: DateRange
  metric: MetricDefinition
  availableMetrics: MetricDefinition[]
  metricKey: MetricKey
  pointCounts: Map<string, number>
  onSelectMetric: (key: MetricKey) => void
  weights: WeightLogEntry[]
  dailyLogs: DailyLogEntry[]
  bloodwork: BloodworkEntry[]
  cycles: CycleSubstance[]
  ongoing: OngoingSubstance[]
  onOpenSettings?: () => void
}

function fmtDate(d: string) {
  return formatDaySafe(d)
}

function dateToTs(date: string): number {
  return dayToTsSafe(date, 12) ?? Date.now()
}

const tsLabel = (ts: number) => fmtDate(format(new Date(ts), 'yyyy-MM-dd'))

/**
 * Senkrechte Einheit links neben der Y-Achse. Gedrehter Text ist nur eine
 * Zeilenhöhe breit — die Länge der Einheit kann die Achse also weder sprengen
 * noch ihre Breite verändern. Beides ist bei "mIU/mL" & Co. sonst passiert.
 */
function AxisUnitLabel({ unit }: { unit: string }) {
  if (!unit) return null
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: AXIS_UNIT_BOTTOM_INSET,
        width: AXIS_UNIT_GUTTER,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
      }}
    >
      <span style={{
        transform: 'rotate(-90deg)',
        whiteSpace: 'nowrap',
        fontSize: '0.68rem',
        fontWeight: 700,
        color: 'var(--text-muted)',
      }}>
        {unit}
      </span>
    </div>
  )
}

function withUnit(formatted: string, unit: string): string {
  if (unit === '%') return `${formatted}%`
  return unit ? `${formatted} ${unit}` : formatted
}

function formatTooltipValue(value: number, unit: string): string {
  return withUnit(formatNumber(value), unit)
}

/** Zahl ohne Scheingenauigkeit: zwei Nachkommastellen reichen fuer jede Messgroesse. */
const roundValue = (v: number) => Math.round(v * 100) / 100

function CycleLegend({ items }: { items: CycleLegendItem[] }) {
  // Ein Eintrag pro Substanz statt pro Zyklus: mehrere Zyklen derselben Substanz
  // teilen sich Farbe und Namen, also auch nur einen Legenden-Punkt. Eine Substanz
  // gilt als gefüllt/hervorgehoben, wenn irgendeiner ihrer Balken es ist.

  return (
    <div style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: '8px 16px',
      paddingLeft: 12,
      marginTop: 14,
      paddingTop: 12,
      borderTop: '1px solid var(--border)',
    }}>
      {items.map(item => (
        <div
          key={`${item.name}|${item.color}`}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}
        >
          <span style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: item.filled ? item.color : 'transparent',
            border: item.filled ? 'none' : `2px solid ${item.color}`,
            flexShrink: 0,
            boxShadow: item.filled ? `0 0 6px ${item.color}44` : 'none',
          }} />
          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)' }}>
            {item.name}
          </span>
        </div>
      ))}
    </div>
  )
}

const MetricChartInner = forwardRef<ChartPanHandle, Props>(
function MetricChartInner({
  dataRange,
  pageRange,
  metric,
  availableMetrics,
  metricKey,
  pointCounts,
  onSelectMetric,
  weights,
  dailyLogs,
  bloodwork,
  cycles,
  ongoing,
  onOpenSettings,
}, ref) {
  const { t } = useTranslation()
  const { start: dataStart, now } = useMemo(() => rangeBounds(dataRange), [dataRange])
  const windowMs = windowMsForRange(pageRange)

  // Zurueckgeblaettert: Ende des Fensters; null folgt „jetzt" (auch wenn neue Daten kommen).
  const [panEnd, setPanEnd] = useState<number | null>(null)
  // Neuer Zeitraum oben: zurück an „jetzt", wie beim Wechsel eines Zeitraums erwartet.
  const [prevWindowMs, setPrevWindowMs] = useState(windowMs)
  if (windowMs !== prevWindowMs) {
    setPrevWindowMs(windowMs)
    setPanEnd(null)
  }
  const viewEnd = panEnd == null ? now : clampViewEnd(panEnd, dataStart, now, windowMs)
  const viewStart = viewEnd - windowMs

  const jumpToNow = useCallback(() => setPanEnd(null), [])
  const jumpToTs = useCallback((ts: number) => setPanEnd(ts + windowMs), [windowMs])
  useImperativeHandle(ref, () => ({ jumpToNow, jumpToTs }), [jumpToNow, jumpToTs])

  // Serie über den vollen Bereich — das Fenster schneidet die Anzeige zu.
  const series = useMemo(
    () => buildMetricSeries(metric.key, dataRange, weights, dailyLogs, bloodwork),
    [metric.key, dataRange, weights, dailyLogs, bloodwork],
  )

  const points: LevelPoint[] = useMemo(
    () => series.map(point => ({ ts: dateToTs(point.date), level: point.value })),
    [series],
  )

  // Zeilen über die gesamte Historie packen, nicht über das Sichtfenster: Die
  // Balkenhöhe hängt an der Zeilenzahl, also würde jeder aus dem Fenster
  // gewanderte Zyklus die Geometrie der übrigen verschieben.
  const { packed, lanes } = useMemo(() => {
    const substances = [
      ...cycles.map(c => ({ substance: c, filled: true })),
      ...ongoing.map(o => ({ substance: o, filled: false })),
    ]
    const all = substances.map(({ substance, filled }) => {
      const startTs = dateToTs(substance.startDate)
      return {
        id: substance.id,
        name: substance.name,
        color: substance.color,
        filled,
        startTs,
        x1: startTs,
        x2: dateToTs(substanceBarEnd(substance)),
      }
    })
    const packed = assignLanes(all)
    return { packed, lanes: laneCount(packed) }
  }, [cycles, ongoing])

  const laneBands = useMemo(() => ({
    items: packed.map((band): LaneBand => ({
      id: band.id, color: band.color, filled: band.filled,
      x1: band.x1, x2: band.x2, lane: band.lane, start: band.startTs,
    })),
    count: lanes,
    layout: computeCycleBandLayout,
  }), [packed, lanes])

  // Ablesen rastet auch an Zyklus-Starts ein und nennt sie im Schild.
  const startTimes = useMemo(() => packed.map(band => band.startTs), [packed])
  const scrubLabel = useMemo(() => ({
    date: tsLabel,
    value: (v: number) => formatTooltipValue(roundValue(v), metric.unit),
    note: (ts: number) => {
      const day = format(new Date(ts), 'yyyy-MM-dd')
      const names = packed.filter(b => format(new Date(b.startTs), 'yyyy-MM-dd') === day).map(b => b.name)
      return names.length ? t('fortschritt_chart_start_note', { names: names.join(', ') }) : null
    },
  }), [metric.unit, packed, t])

  const legendItems = useMemo(() => buildCycleLegendItems(cycles, ongoing), [cycles, ongoing])

  const reducedMetricPoints = usesReducedMetricPoints(metricKey, windowMs)
  const values = points.map(p => Math.abs(p.level))
  const minSpan = Math.max(0.5, (values.length ? Math.max(...values) : 1) * 0.04)

  // Wert und Delta über denselben Zeitraum wie die übrigen Karten der Seite.
  const rangeSeries = useMemo(() => filterDatesInRange(series, pageRange), [series, pageRange])
  const delta = useMemo(() => computeDelta(rangeSeries), [rangeSeries])
  const latest = rangeSeries[rangeSeries.length - 1]

  const metricBar = (
    <MetricChipBar
      availableMetrics={availableMetrics}
      metricKey={metricKey}
      pointCounts={pointCounts}
      onSelectMetric={onSelectMetric}
    />
  )

  if (points.length === 0) {
    return (
      <section style={{ ...panel, padding: '28px 18px', textAlign: 'center', position: 'relative' }}>
        {onOpenSettings && (
          <div style={{ position: 'absolute', top: 14, right: 12 }}>
            <ChartSettingsButton onClick={onOpenSettings} />
          </div>
        )}
        <div style={{ paddingLeft: 12, paddingRight: 12, width: '100%', boxSizing: 'border-box', textAlign: 'left' }}>
          {metricBar}
        </div>
        <p style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-dim)', marginBottom: 8 }}>
          {t('fortschritt_chart_no_data_title', { metric: metric.label })}
        </p>
        <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>
          {t('fortschritt_chart_no_data_body')}
        </p>
      </section>
    )
  }

  return (
    <section style={{ ...panel, padding: '16px 12px 14px 4px', position: 'relative' }}>
      <div style={{
        position: 'absolute', top: 14, right: 12, zIndex: 2,
        display: 'flex', alignItems: 'center', gap: 6,
      }}>
        {onOpenSettings && <ChartSettingsButton onClick={onOpenSettings} />}
      </div>

      <div style={{ paddingLeft: 12, marginBottom: 4, paddingRight: 120 }}>
        <p style={{ fontSize: '0.95rem', fontWeight: 900, color: 'var(--text-dim)' }}>{metric.label}</p>
        {/* Feste Höhe, Wert und Delta immer untereinander: nebeneinander brachen
            lange Einheiten wie "1.9 mIU/mL" um und schoben den Chart nach unten. */}
        <div style={{ height: HEADER_VALUE_HEIGHT, marginTop: 2 }}>
          {latest && (
            <p style={{
              fontSize: '1.25rem',
              fontWeight: 900,
              color: 'var(--text)',
              margin: 0,
              lineHeight: 1.15,
              whiteSpace: 'nowrap',
            }}>
              {formatTooltipValue(latest.value, metric.unit)}
            </p>
          )}
          {delta && (
            <p style={{
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'var(--text-muted)',
              margin: 0,
              lineHeight: 1.3,
              whiteSpace: 'nowrap',
            }}>
              {t('fortschritt_chart_delta', { value: withUnit(formatSignedNumber(delta.delta), metric.unit) })}
            </p>
          )}
        </div>
      </div>
      <div style={{ width: '100%', paddingLeft: 12, paddingRight: 12, boxSizing: 'border-box' }}>
        {metricBar}
      </div>

      <div className="fortschritt-metric-chart" style={{ position: 'relative', paddingLeft: AXIS_UNIT_GUTTER, paddingRight: AXIS_UNIT_GUTTER }}>
        <AxisUnitLabel unit={metric.unit} />
        <StocksChart
          points={points}
          start={viewStart}
          end={viewEnd}
          accent={metric.color}
          height={CHART_HEIGHT}
          seriesKey={metricKey}
          formatTick={tsLabel}
          formatValue={v => formatNumber(roundValue(v))}
          scrubLabel={scrubLabel}
          ariaLabel={t('fortschritt_chart_aria', { metric: metric.label })}
          dots={!reducedMetricPoints}
          percentCap={false}
          minSpan={minSpan}
          intakeStrip={false}
          holdMs={HOLD_MS}
          snapTimes={startTimes}
          lanes={laneBands}
          pan={{
            min: dataStart,
            max: now,
            onPan: end => setPanEnd(end >= now - 1000 ? null : end),
            jumpLabel: t('fortschritt_chart_now'),
          }}
        />
      </div>

      <CycleLegend items={legendItems} />
    </section>
  )
})

export const MetricChart = MetricChartInner
