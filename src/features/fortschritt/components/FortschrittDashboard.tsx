import { useCallback, useMemo, useRef, useState } from 'react'
import { MIN_POINTS_FOR_TREND, isWellnessMetricKey } from '../constants'
import {
  buildMetricSeries,
  computeTopChanges,
  weightSeries,
  dailyFieldSeries,
} from '../lib/metrics'
import { METRIC_COLORS } from '../lib/colors'
import { rangeFromChip, type RangeChipKey } from '../lib/verlaufRange'
import type { ChartNavigation, FortschrittOverviewState } from '../types'
import { TopChangesSection } from './overview/TopChangesSection'
import { EmptyOverview, NoSubstancesBanner } from './overview/EmptyOverview'
import { VerlaufSection } from './verlauf/VerlaufSection'
import { FotosCard } from './fotos/FotosCard'
import { WerteCard } from './werte/WerteCard'

interface Props {
  state: FortschrittOverviewState
  rangeChip: RangeChipKey
  onLogToday: () => void
  onReload: () => void
}

export function FortschrittDashboard({ state, rangeChip, onLogToday, onReload }: Props) {
  const [chartNav, setChartNav] = useState<ChartNavigation | null>(null)
  const heroRef = useRef<HTMLElement>(null)

  const pageRange = useMemo(
    () => rangeFromChip(rangeChip, state.fullRange),
    [rangeChip, state.fullRange],
  )

  const handleChartNavConsumed = useCallback(() => setChartNav(null), [])

  const {
    cycleSubstances,
    ongoingSubstances,
    dailyLogs,
    weightLogs,
    bloodwork,
    photos,
  } = state

  const topChanges = useMemo(
    () => computeTopChanges(pageRange, weightLogs, dailyLogs, bloodwork),
    [pageRange, weightLogs, dailyLogs, bloodwork],
  )
  // Hintergrund-Kurven der Karten einmal je Zeitraum, nicht bei jedem Wischen
  const changeSeries = useMemo(
    () => new Map(topChanges.map(c => [c.key, buildMetricSeries(c.key, pageRange, weightLogs, dailyLogs, bloodwork)])),
    [topChanges, pageRange, weightLogs, dailyLogs, bloodwork],
  )
  const seriesFor = useCallback((key: string) => changeSeries.get(key) ?? [], [changeSeries])
  const colorFor = useCallback((key: string) => METRIC_COLORS[key] ?? '#8b5cf6', [])
  const canSelect = useCallback((key: string) => !isWellnessMetricKey(key), [])
  // Antippen einer Veränderung: Messwert im Graphen wählen und zum Graphen gleiten
  const showInChart = useCallback((key: string) => {
    setChartNav({ metric: key })
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    heroRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }, [])

  const hasSubstances = cycleSubstances.length + ongoingSubstances.length > 0
  const activeCycles = cycleSubstances.filter(c => c.active)
  const hasActiveSubstances = activeCycles.length + ongoingSubstances.length > 0
  const hasAnyLogs =
    dailyLogs.length > 0 ||
    weightLogs.length > 0 ||
    bloodwork.length > 0 ||
    photos.length > 0

  const completelyEmpty = !hasSubstances && !hasAnyLogs

  if (completelyEmpty) {
    return <EmptyOverview onLogToday={onLogToday} />
  }

  const trendCandidates = [
    weightSeries(weightLogs, pageRange),
    ...(['energie', 'schlaf', 'wohlbefinden', 'libido'] as const).map(f => dailyFieldSeries(dailyLogs, pageRange, f)),
    ...[...new Set(bloodwork.map(b => b.marker))].map(m =>
      bloodwork.filter(b => b.marker === m).map(b => ({ date: b.tested_at, value: b.value })),
    ),
  ]
  const hasEnoughForTrend = trendCandidates.some(series => series.length >= MIN_POINTS_FOR_TREND)


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <VerlaufSection
        ref={heroRef}
        state={state}
        pageRange={pageRange}
        chartNav={chartNav}
        onChartNavConsumed={handleChartNavConsumed}
      />

      <WerteCard dailyLogs={dailyLogs} range={pageRange} />

      <TopChangesSection
        changes={topChanges}
        hasAnyData={hasAnyLogs}
        hasEnoughForTrend={hasEnoughForTrend}
        seriesFor={seriesFor}
        colorFor={colorFor}
        onSelect={showInChart}
        canSelect={canSelect}
      />

      {!hasActiveSubstances && <NoSubstancesBanner />}

      <FotosCard photos={photos} range={pageRange} onChange={onReload} />
    </div>
  )
}
