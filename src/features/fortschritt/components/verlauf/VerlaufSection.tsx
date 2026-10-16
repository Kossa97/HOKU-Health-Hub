import { useEffect, useMemo, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import type { ChartNavigation, DateRange, FortschrittOverviewState, MetricKey } from '../../types'
import { CHART_METRIC_KEYS, isChartMetricKey } from '../../constants'
import { buildMetricSeries } from '../../lib/metrics'
import { buildAvailableMetrics, normalizeMetricKey } from '../../lib/metricDefinitions'
import { metricLabel } from '../../lib/metricLabels'
import {
  filterCyclesByVisibility,
  filterOngoingByVisibility,
} from '../../lib/chartVisibility'
import { useChartVisibility } from '../../hooks/useChartVisibility'
import { panel } from '../../styles'
import { VerlaufSetup } from './VerlaufSetup'
import { VerlaufSetupSheet } from './VerlaufSetupSheet'
import { ChartSettingsButton } from './ChartSettingsButton'
import { MetricChart, type ChartPanHandle } from './MetricChart'

interface Props {
  state: FortschrittOverviewState
  /** Seiten-Zeitraum aus der Leiste oben — gilt auch für den Verlauf. */
  pageRange: DateRange
  chartNav: ChartNavigation | null
  onChartNavConsumed: () => void
}

export function VerlaufSection({
  state,
  pageRange,
  chartNav,
  onChartNavConsumed,
}: Props) {
  const { t } = useTranslation()
  const [metricKey, setMetricKey] = useState<MetricKey>('weight')
  const [setupOpen, setSetupOpen] = useState(false)
  const chartRef = useRef<ChartPanHandle>(null)

  const {
    groups: visibilityGroups,
    visibleIds,
    toggleGroup,
    toggleCycle,
  } = useChartVisibility(state.cycleSubstances, state.ongoingSubstances)

  const visibleCycles = useMemo(
    () => filterCyclesByVisibility(state.cycleSubstances, visibleIds),
    [state.cycleSubstances, visibleIds],
  )
  const visibleOngoing = useMemo(
    () => filterOngoingByVisibility(state.ongoingSubstances, visibleIds),
    [state.ongoingSubstances, visibleIds],
  )

  useEffect(() => {
    if (!chartNav) return
    if (chartNav.metric && isChartMetricKey(normalizeMetricKey(chartNav.metric))) {
      setMetricKey(normalizeMetricKey(chartNav.metric))
    }
    onChartNavConsumed()
  }, [chartNav, onChartNavConsumed])


  const baseRange = state.fullRange
  const pointCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const key of CHART_METRIC_KEYS) {
      counts.set(key, buildMetricSeries(key, baseRange, state.weightLogs, state.dailyLogs, state.bloodwork).length)
    }
    for (const marker of [...new Set(state.bloodwork.map(b => b.marker))]) {
      counts.set(marker, buildMetricSeries(marker, baseRange, state.weightLogs, state.dailyLogs, state.bloodwork).length)
    }
    return counts
  }, [baseRange, state])

  const labUnits = useMemo(() => {
    const m = new Map<string, string>()
    for (const b of state.bloodwork) m.set(b.marker, b.unit)
    return m
  }, [state.bloodwork])

  const availableMetrics = useMemo(
    () => buildAvailableMetrics(pointCounts, [...new Set(state.bloodwork.map(b => b.marker))], labUnits)
      .map(m => ({ ...m, label: metricLabel(t, m.key, m.label) })),
    [pointCounts, state.bloodwork, labUnits, t],
  )

  const selectedMetric = availableMetrics.find(m => m.key === metricKey)
    ?? availableMetrics.find(m => m.key === 'weight')
    ?? availableMetrics[0]

  useEffect(() => {
    if (availableMetrics.length === 0) return
    if (!availableMetrics.some(m => m.key === metricKey)) {
      setMetricKey(availableMetrics.find(m => m.key === 'weight')?.key ?? availableMetrics[0].key)
    }
  }, [availableMetrics, metricKey])

  const selectMetric = (key: MetricKey) => {
    const count = pointCounts.get(key) ?? 0
    const metric = availableMetrics.find(m => m.key === key)
    if (!metric || count === 0) return
    if (metric.isLab && count < 2) {
      toast.error(t('fortschritt_lab_min_two'))
      return
    }
    setMetricKey(key)
  }

  const hasChartData = visibleCycles.length > 0 || visibleOngoing.length > 0
  const openSetup = () => setSetupOpen(true)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {selectedMetric && hasChartData && (
        <MetricChart
          ref={chartRef}
          dataRange={state.fullRange}
          pageRange={pageRange}
          metric={selectedMetric}
          availableMetrics={availableMetrics}
          metricKey={metricKey}
          pointCounts={pointCounts}
          onSelectMetric={selectMetric}
          weights={state.weightLogs}
          dailyLogs={state.dailyLogs}
          bloodwork={state.bloodwork}
          cycles={visibleCycles}
          ongoing={visibleOngoing}
          onOpenSettings={openSetup}
        />
      )}

      {!hasChartData && (
        <section style={{
          ...panel,
          padding: '32px 18px',
          textAlign: 'center',
          position: 'relative',
        }}>
          <div style={{ position: 'absolute', top: 14, right: 12 }}>
            <ChartSettingsButton onClick={openSetup} />
          </div>
          <p style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-dim)', marginBottom: 8 }}>
            {t('fortschritt_chart_empty_title')}
          </p>
          <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', maxWidth: 260, margin: '0 auto' }}>
            {t('fortschritt_chart_empty_body')}
          </p>
        </section>
      )}

      <VerlaufSetupSheet open={setupOpen} onClose={() => setSetupOpen(false)}>
        <VerlaufSetup
          embedded
          groups={visibilityGroups}
          visibleIds={visibleIds}
          onToggleGroup={toggleGroup}
          onToggleCycle={toggleCycle}
        />
      </VerlaufSetupSheet>
    </div>
  )
}
