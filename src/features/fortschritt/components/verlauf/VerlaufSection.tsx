import { forwardRef, useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import type { ChartNavigation, DateRange, FortschrittOverviewState, MetricKey } from '../../types'
import { CHART_METRIC_KEYS, isChartMetricKey } from '../../constants'
import { buildMetricSeries, computeDelta } from '../../lib/metrics'
import { buildAvailableMetrics, normalizeMetricKey } from '../../lib/metricDefinitions'
import { metricLabel } from '../../lib/metricLabels'
import { formatDaySafe, formatNumber, formatSignedNumber } from '../../lib/dates'
import { todayIso } from '../../lib/substances'
import { GlassSegmented } from '../GlassSegmented'
import { GlassChart, type ChartBand, type ScrubState } from './GlassChart'
import { CycleChips } from './CycleChips'
import { useAmbientLight, useAmbientPulse } from '../../ambient/context'
import { substancesInRange } from '../../lib/cycleSubstances'

interface Props {
  state: FortschrittOverviewState
  /** Seiten-Zeitraum aus der Leiste oben — gilt auch für den Verlauf. */
  pageRange: DateRange
  chartNav: ChartNavigation | null
  onChartNavConsumed: () => void
}

const withUnit = (value: string, unit: string) => (unit === '%' ? `${value} %` : unit ? `${value} ${unit}` : value)

export const VerlaufSection = forwardRef<HTMLElement, Props>(function VerlaufSection({
  state,
  pageRange,
  chartNav,
  onChartNavConsumed,
}, ref) {
  const { t } = useTranslation()
  const [metricKey, setMetricKey] = useState<MetricKey>('weight')
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set())
  const [touched, setTouched] = useState(false)
  const [newSubstance, setNewSubstance] = useState<string | null>(null)
  const [scrub, setScrub] = useState<ScrubState | null>(null)
  const sectionRef = useRef<HTMLElement>(null)
  const [lightX, setLightX] = useState<number | null>(null)
  const pulse = useAmbientPulse()

  useEffect(() => {
    if (!chartNav) return
    if (chartNav.metric && isChartMetricKey(normalizeMetricKey(chartNav.metric))) {
      setMetricKey(normalizeMetricKey(chartNav.metric))
    }
    onChartNavConsumed()
  }, [chartNav, onChartNavConsumed])

  // Welche Messwerte es überhaupt gibt: über die ganze Historie, damit der
  // Umschalter beim Zeitraum-Wechsel nicht springt.
  const pointCounts = useMemo(() => {
    const counts = new Map<string, number>()
    const full = state.fullRange
    for (const key of CHART_METRIC_KEYS) {
      counts.set(key, buildMetricSeries(key, full, state.weightLogs, state.dailyLogs, state.bloodwork).length)
    }
    for (const marker of new Set(state.bloodwork.map(b => b.marker))) {
      counts.set(marker, buildMetricSeries(marker, full, state.weightLogs, state.dailyLogs, state.bloodwork).length)
    }
    return counts
  }, [state.fullRange, state.weightLogs, state.dailyLogs, state.bloodwork])

  const labUnits = useMemo(() => {
    const units = new Map<string, string>()
    for (const b of state.bloodwork) units.set(b.marker, b.unit)
    return units
  }, [state.bloodwork])

  const metrics = useMemo(
    () => buildAvailableMetrics(pointCounts, [...new Set(state.bloodwork.map(b => b.marker))], labUnits)
      .map(m => ({ ...m, label: metricLabel(t, m.key, m.label) })),
    [pointCounts, state.bloodwork, labUnits, t],
  )
  const metric = metrics.find(m => m.key === metricKey) ?? metrics.find(m => m.key === 'weight') ?? metrics[0]

  const series = useMemo(
    () => metric ? buildMetricSeries(metric.key, pageRange, state.weightLogs, state.dailyLogs, state.bloodwork) : [],
    [metric, pageRange, state.weightLogs, state.dailyLogs, state.bloodwork],
  )

  const substances = useMemo(() => substancesInRange(state.cycleSubstances, pageRange), [state.cycleSubstances, pageRange])
  // Angewählte Substanzen, die im Zeitraum nicht mehr vorkommen, zählen nicht mit.
  const activeSelection = useMemo(
    () => new Set(substances.filter(s => selected.has(s.id)).map(s => s.id)),
    [substances, selected],
  )

  const bands = useMemo<ChartBand[]>(() => substances
    .filter(s => activeSelection.has(s.id))
    .flatMap(s => s.cycles.map(c => ({
      key: c.id,
      substanceId: s.id,
      name: s.name,
      color: s.color,
      start: c.startDate,
      end: c.endDate,
    }))), [substances, activeSelection])

  const toggle = useCallback((id: string) => {
    const on = !selected.has(id)
    const next = new Set(selected)
    if (on) next.add(id)
    else next.delete(id)
    setTouched(true)
    setSelected(next)
    // Angewählt: die Farbe des Zyklus blüht hinter dem Graphen auf
    if (on) {
      const substance = substances.find(s => s.id === id)
      if (substance) pulse(substance.color, sectionRef.current, 0.6, 0.55)
    }
    // Nur der neu angewählte Balken blendet auf; die übrigen werden dünner.
    setNewSubstance(on ? id : null)
  }, [selected, substances, pulse])

  // Die Karte geht an das eigene Licht und an den Aufrufer (Gleiten zum Graphen)
  const setSection = useCallback((node: HTMLElement | null) => {
    sectionRef.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) ref.current = node
  }, [ref])

  const onScrub = useCallback((s: ScrubState | null) => {
    setScrub(s)
    // Licht unter den Ablese-Strich: Lage relativ zur Karte
    const rect = sectionRef.current?.getBoundingClientRect()
    setLightX(s && rect && rect.width > 0 ? Math.min(1, Math.max(0, (s.clientX - rect.left) / rect.width)) : null)
  }, [])
  // Nur ein Ablesen, das zur aktuellen Reihe passt, zählt — wie für die Anzeige unten
  const scrubbing = scrub != null && scrub.index < series.length && lightX != null

  // Licht der Messwert-Farbe: ruht oben links, folgt beim Ablesen dem Finger.
  useAmbientLight('hero', sectionRef, {
    color: metric?.color ?? '#00ccf5',
    intensity: scrubbing ? 0.85 : 0.55,
    anchorX: scrubbing ? lightX : 0.24,
    anchorY: scrubbing ? 0.62 : 0.32,
    size: scrubbing ? 320 : 400,
  })
  // Zweites Licht in der Farbe des zuletzt angewählten Zyklus, hinter den Balken
  const cycleColor = substances.find(s => s.id === newSubstance && activeSelection.has(s.id))?.color
    ?? substances.find(s => activeSelection.has(s.id))?.color
  useAmbientLight('hero-cycle', sectionRef, {
    color: cycleColor ?? '#000000',
    intensity: cycleColor ? 0.5 : 0,
    anchorX: 0.78,
    anchorY: 0.66,
    size: 360,
  })

  if (!metric) {
    return (
      <section ref={setSection} className="fg-hero fg-surface" aria-label={t('fortschritt_metric_weight')}>
        <div className="fg-chart-empty">
          <p className="fg-h3">{t('fortschritt_chart_no_data_title', { metric: t('fortschritt_metric_weight') })}</p>
          <p>{t('fortschritt_chart_no_data_body')}</p>
        </div>
        <CycleChips substances={substances} selected={activeSelection} hint={!touched} onToggle={toggle} />
      </section>
    )
  }

  const first = series[0]
  // Ein Index aus einer älteren Reihe (Zeitraum gewechselt, Daten neu geladen) gilt nicht mehr.
  const liveScrub = scrub && scrub.index < series.length ? scrub : null
  const point = liveScrub ? series[liveScrub.index] : series[series.length - 1]
  const pointDate = liveScrub?.date ?? point?.date
  const delta = point && first ? point.value - first.value : null
  const isToday = !liveScrub && point?.date === todayIso()

  // Am Zyklusstart: der Start und, ehrlich daneben, von wann der gezeigte Messwert ist.
  const label = liveScrub?.startOf && point
    ? `${t('fortschritt_chart_start_note', { names: liveScrub.startOf })} ${formatDaySafe(liveScrub.date)} · ${t('fortschritt_chart_value_of', { metric: metric.label, date: formatDaySafe(point.date) })}`
    : point
      ? `${metric.label} · ${isToday ? t('fortschritt_chart_today') : formatDaySafe(point.date, 'full')}`
      : metric.label

  // Welche angewählten Zyklen an diesem Tag liefen, mit Zyklustag
  const running = pointDate
    ? bands
      .filter(b => b.start <= pointDate && (b.end == null || b.end >= pointDate))
      .map(b => ({ key: b.key, name: b.name, color: b.color, day: differenceInCalendarDays(parseISO(pointDate), parseISO(b.start)) + 1 }))
    : []

  const options = metrics.map(m => {
    const count = pointCounts.get(m.key) ?? 0
    return {
      key: m.key,
      label: m.label,
      denyReason: m.isLab && count < 2 ? t('fortschritt_chip_need_two', { metric: m.label }) : undefined,
    }
  })

  const fullDelta = computeDelta(series)

  return (
    <section
      ref={setSection}
      className="fg-hero fg-surface"
      aria-label={metric.label}
      data-metric={metric.key}
    >
      <div className="fg-hero-in">
        {options.length > 1 && (
          <div className="fg-seg-scroll">
            <GlassSegmented
              ariaLabel={t('fortschritt_metric_switch_aria')}
              options={options}
              value={metric.key}
              onChange={key => { setScrub(null); setMetricKey(key) }}
            />
          </div>
        )}

        {series.length === 0 ? (
          <div className="fg-chart-empty">
            <p className="fg-h3">{t('fortschritt_chart_no_data_title', { metric: metric.label })}</p>
            <p>{t('fortschritt_chart_no_data_body')}</p>
          </div>
        ) : (
          <>
            <div className="fg-hero-label" aria-live="polite">{label}</div>
            <div className="fg-hero-value" data-hero-value>
              {formatNumber(point.value)}
              {metric.unit && <small>{metric.unit}</small>}
            </div>
            {delta != null && first && (
              <div className="fg-hero-delta">
                {withUnit(formatSignedNumber(Math.round(delta * 100) / 100), metric.unit)} {t('fortschritt_since', { date: formatDaySafe(first.date) })}
              </div>
            )}
            <div className="fg-hero-ctx">
              {running.map(r => (
                <span key={r.key} style={{ '--dot': r.color } as CSSProperties}>
                  {r.name} · {t('fortschritt_cycle_day', { n: r.day })}
                </span>
              ))}
            </div>
          </>
        )}
      </div>

      {series.length > 0 && (
        <GlassChart
          points={series}
          range={pageRange}
          color={metric.color}
          bands={bands}
          newBandSubstance={newSubstance}
          onScrub={onScrub}
          ariaLabel={t('fortschritt_chart_aria_range', {
            metric: metric.label,
            from: formatDaySafe(pageRange.from, 'full'),
            to: formatDaySafe(pageRange.to, 'full'),
            delta: fullDelta ? withUnit(formatSignedNumber(Math.round(fullDelta.delta * 100) / 100), metric.unit) : '–',
          })}
        />
      )}

      <CycleChips substances={substances} selected={activeSelection} hint={!touched} onToggle={toggle} />
    </section>
  )
})
