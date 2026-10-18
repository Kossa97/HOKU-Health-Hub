import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { TrainingData, ChartMarker } from '../../hooks/useTrainingData'
import { exerciseHistory, estimateOneRepMax } from '../../lib/stats'
import { exerciseInfo, exerciseName } from '../../lib/exerciseLookup'
import { formatClock, formatDate, formatNumber, formatWeight } from '../../lib/format'
import { useTrainingText } from '../../i18n'
import { Card, Chip, SectionTitle, Stat, TRAINING_ACCENT, TrainingSheet } from '../ui'
import { TableView, TooltipBox } from './chartParts'
import {
  AXIS_TICK, bestOf, chartValue, formatMetric, formatSet, inferTracking, markersInRange, metricValue, metricsFor,
  type Metric,
} from './progressModel'

/**
 * Eine Uebung im Verlauf. Der Unterschied zu Hevy: senkrechte Marker zeigen,
 * wann eine Substanz begonnen oder geendet hat und wann Blut abgenommen wurde.
 * Das ist zeitliche Naehe, keine Ursache — die Fussnote sagt das ausdruecklich.
 */

type MarkerKind = ChartMarker['kind']

/** Geprueft mit dem dataviz-Validator (hell und dunkel); Form der Marke traegt zusaetzlich die Bedeutung. */
const MARKER_COLOR: Record<MarkerKind, string> = {
  substance_start: '#bf5af2',
  substance_end: '#0a84ff',
  bloodwork: '#ff375f',
}

const MARKER_KINDS: MarkerKind[] = ['substance_start', 'substance_end', 'bloodwork']
const DAY = 24 * 60 * 60 * 1000

function GlyphPath({ kind, color }: { kind: MarkerKind; color: string }) {
  if (kind === 'substance_start') return <path d="M2 1 L11 6 L2 11 Z" fill={color} />
  if (kind === 'substance_end') return <rect x="2" y="2" width="8" height="8" rx="1" fill={color} />
  return <path d="M6 0.5 C6 0.5 1.8 5.2 1.8 7.8 A4.2 4.2 0 0 0 10.2 7.8 C10.2 5.2 6 0.5 6 0.5 Z" fill={color} />
}

export function MarkerGlyph({ kind, size = 12 }: { kind: MarkerKind; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true" style={{ flexShrink: 0 }}>
      <GlyphPath kind={kind} color={MARKER_COLOR[kind]} />
    </svg>
  )
}

function shorten(text: string, max = 14): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

const METRIC_KEY = {
  e1rm: 'progress_metric_e1rm',
  weight: 'progress_metric_weight',
  volume: 'progress_metric_volume',
  reps: 'progress_metric_reps',
  duration: 'progress_metric_duration',
  distance: 'progress_metric_distance',
} as const

const RECORD_KEY = {
  e1rm: 'progress_record_e1rm',
  weight: 'progress_record_weight',
  volume: 'progress_record_volume',
  reps: 'progress_record_reps',
  duration: 'progress_record_duration',
  distance: 'progress_record_distance',
} as const

const RECORD_ORDER: Metric[] = ['e1rm', 'weight', 'reps', 'volume', 'duration', 'distance']

export function ExerciseDetailSheet({ exerciseId, data, onClose }: {
  exerciseId: string
  data: TrainingData
  onClose: () => void
}) {
  const { tt, lang, locale } = useTrainingText()
  const unit = data.settings.unit
  const repsUnit = tt('progress_reps_unit')

  const history = useMemo(() => exerciseHistory(data.sessions, exerciseId), [data.sessions, exerciseId])
  const name = exerciseName(exerciseId, lang, data.customExercises)
  const tracking = exerciseInfo(exerciseId, lang, data.customExercises)?.tracking ?? inferTracking(history)
  const metrics = useMemo(() => metricsFor(tracking, history), [tracking, history])

  const [chosen, setChosen] = useState<Metric | null>(null)
  const metric: Metric | null = chosen && metrics.includes(chosen) ? chosen : metrics[0] ?? null
  const [hidden, setHidden] = useState<Set<MarkerKind>>(() => new Set())

  const points = useMemo(() => {
    if (!metric) return []
    return history
      .map(p => ({ t: Date.parse(p.date), raw: metricValue(p, metric), date: p.date }))
      .filter((p): p is { t: number; raw: number; date: string } => p.raw != null && Number.isFinite(p.t))
      .map(p => ({ ...p, v: chartValue(metric, p.raw, unit) }))
  }, [history, metric, unit])

  const domain = useMemo<[number, number] | null>(() => {
    if (points.length === 0) return null
    let from = points[0].t
    let to = points[points.length - 1].t
    if (to - from < 7 * DAY) { const mid = (from + to) / 2; from = mid - 3.5 * DAY; to = mid + 3.5 * DAY }
    const pad = (to - from) * 0.04
    return [from - pad, to + pad]
  }, [points])

  const allMarkers = useMemo(
    () => domain ? markersInRange(data.context.markers, domain[0], domain[1]) : [],
    [data.context.markers, domain],
  )
  const presentKinds = MARKER_KINDS.filter(kind => allMarkers.some(m => m.kind === kind))
  const visibleMarkers = allMarkers.filter(m => !hidden.has(m.kind))

  const toggleKind = (kind: MarkerKind) => setHidden(prev => {
    const next = new Set(prev)
    if (next.has(kind)) next.delete(kind)
    else next.add(kind)
    return next
  })

  const ticks = useMemo(() => {
    if (!domain) return []
    const [from, to] = domain
    const inner = (to - from) / 1.08
    const start = from + (to - from - inner) / 2
    return [0, 1, 2, 3].map(i => start + (inner * i) / 3)
  }, [domain])
  const spanDays = domain ? (domain[1] - domain[0]) / DAY : 0
  const tickDate = (t: number) => new Intl.DateTimeFormat(locale, spanDays > 300
    ? { month: 'short', year: '2-digit' }
    : { day: 'numeric', month: 'short' }).format(new Date(t))

  const formatAxis = (value: number) => {
    if (!metric) return ''
    if (metric === 'duration') return formatClock(value)
    return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
  }
  const axisUnit = !metric ? '' : metric === 'duration' ? 'min:s'
    : metric === 'distance' ? 'm' : metric === 'reps' ? '' : unit
  const formatValue = (raw: number) => metric ? formatMetric(metric, raw, unit, locale, repsUnit) : ''

  const markerText = (m: ChartMarker) => m.kind === 'bloodwork'
    ? tt('progress_marker_bloodwork')
    : tt(m.kind === 'substance_start' ? 'progress_marker_start_item' : 'progress_marker_end_item', { name: m.label })

  const labelRows = Math.min(3, visibleMarkers.length)
  const topMargin = 8 + labelRows * 15

  const records = RECORD_ORDER
    .filter(kind => tracking !== 'assisted_reps' || kind === 'reps')
    .map(kind => ({ kind, best: bestOf(history, kind) }))
    .filter((r): r is { kind: Metric; best: { value: number; date: string } } => r.best != null)

  const sessionsById = useMemo(() => new Map(data.sessions.map(s => [s.id, s])), [data.sessions])
  const longDate = (iso: string) => formatDate(iso, locale, { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <TrainingSheet title={name} onClose={onClose} tall>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 8 }}>
        {metrics.length > 1 && (
          <div role="group" aria-label={tt('progress_metric_label')} style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
            {metrics.map(m => (
              <Chip key={m} active={m === metric} onClick={() => setChosen(m)}>{tt(METRIC_KEY[m])}</Chip>
            ))}
          </div>
        )}

        {metric && domain && (
          <Card style={{ padding: '14px 12px 10px' }}>
            <div style={{ fontSize: 12, color: 'var(--lg-text-3)', fontWeight: 500, margin: '0 4px 4px' }}>
              {tt(METRIC_KEY[metric])}{axisUnit ? ` (${axisUnit})` : ''}
            </div>
            <div
              role="img"
              aria-label={tt('progress_chart_label', { metric: tt(METRIC_KEY[metric]), count: points.length })}
              style={{ width: '100%', height: 220 + labelRows * 15 }}
            >
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={points} margin={{ top: topMargin, right: 12, bottom: 0, left: -8 }}>
                  <CartesianGrid vertical={false} stroke="var(--lg-separator)" strokeWidth={1} />
                  <XAxis
                    dataKey="t" type="number" scale="time" domain={domain} ticks={ticks}
                    tickFormatter={tickDate} tick={AXIS_TICK} tickLine={false}
                    axisLine={{ stroke: 'var(--lg-separator)' }} allowDataOverflow
                  />
                  <YAxis
                    dataKey="v" domain={['auto', 'auto']} tick={AXIS_TICK} tickLine={false} axisLine={false}
                    width={48} tickFormatter={formatAxis}
                    allowDecimals={metric !== 'reps'}
                  />
                  {visibleMarkers.map((marker, i) => {
                    const color = MARKER_COLOR[marker.kind]
                    const nearRight = (marker.t - domain[0]) / (domain[1] - domain[0]) > 0.62
                    const row = i % 3
                    return (
                      <ReferenceLine
                        key={`${marker.kind}-${marker.date}-${marker.label}-${i}`}
                        x={marker.t}
                        stroke={color}
                        strokeWidth={1.5}
                        ifOverflow="hidden"
                        label={(props: { viewBox?: { x?: number; y?: number } }) => {
                          const x = props.viewBox?.x ?? 0
                          const y = (props.viewBox?.y ?? 0) - topMargin + 4 + row * 15
                          const text = marker.kind === 'substance_start' ? shorten(marker.label) : ''
                          return (
                            <g>
                              <g transform={`translate(${x - 6}, ${y})`}><GlyphPath kind={marker.kind} color={color} /></g>
                              {text && (
                                <text
                                  x={nearRight ? x - 9 : x + 9} y={y + 10}
                                  textAnchor={nearRight ? 'end' : 'start'}
                                  fill="var(--lg-text-3)" fontSize={11} fontWeight={500}
                                >
                                  {text}
                                </text>
                              )}
                            </g>
                          )
                        }}
                      />
                    )
                  })}
                  <Tooltip
                    isAnimationActive={false}
                    cursor={{ stroke: 'var(--lg-separator)', strokeWidth: 1 }}
                    content={({ active, payload }) => {
                      const p = payload?.[0]?.payload as { raw: number; date: string } | undefined
                      if (!active || !p) return null
                      return <TooltipBox title={longDate(p.date)} rows={[{ key: 'v', color: TRAINING_ACCENT, value: formatValue(p.raw), label: tt(METRIC_KEY[metric]) }]} />
                    }}
                  />
                  <Line
                    dataKey="v" type="linear" stroke={TRAINING_ACCENT} strokeWidth={2}
                    strokeLinejoin="round" strokeLinecap="round" isAnimationActive={false}
                    dot={{ r: 4, fill: TRAINING_ACCENT, stroke: 'var(--lg-sheet-solid)', strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: TRAINING_ACCENT, stroke: 'var(--lg-sheet-solid)', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {points.length < 2 && (
              <p style={{ fontSize: 13, color: 'var(--lg-text-3)', marginTop: 6 }}>{tt('progress_single_point')}</p>
            )}

            {presentKinds.length > 0 && (
              <div role="group" aria-label={tt('progress_markers_label')} style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                {presentKinds.map(kind => (
                  <Chip key={kind} active={!hidden.has(kind)} color={MARKER_COLOR[kind]} onClick={() => toggleKind(kind)}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <MarkerGlyph kind={kind} />
                      {tt(kind === 'substance_start' ? 'progress_marker_start' : kind === 'substance_end' ? 'progress_marker_end' : 'progress_marker_bloodwork')}
                    </span>
                  </Chip>
                ))}
              </div>
            )}

            {visibleMarkers.length > 0 ? (
              <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {visibleMarkers.map((marker, i) => (
                  <li key={`${marker.kind}-${marker.date}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, minWidth: 0 }}>
                    <MarkerGlyph kind={marker.kind} />
                    <span style={{ color: 'var(--lg-text-3)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{longDate(marker.date)}</span>
                    <span style={{ color: 'var(--lg-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{markerText(marker)}</span>
                  </li>
                ))}
              </ul>
            ) : presentKinds.length === 0 && (
              <p style={{ fontSize: 12, color: 'var(--lg-text-3)', marginTop: 8 }}>{tt('progress_markers_none')}</p>
            )}

            <TableView
              summary={tt('progress_table_show')}
              head={[tt('progress_col_date'), tt(METRIC_KEY[metric])]}
              rows={[...points].reverse().map(p => ({ key: `${p.t}`, cells: [longDate(p.date), formatValue(p.raw)] }))}
            />
          </Card>
        )}

        {records.length > 0 && (
          <section>
            <SectionTitle>{tt('progress_records_title')}</SectionTitle>
            <Card>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
                {records.map(({ kind, best }) => (
                  <Stat
                    key={kind}
                    label={tt(RECORD_KEY[kind])}
                    value={formatMetric(kind, best.value, unit, locale, repsUnit)}
                    sub={longDate(best.date)}
                  />
                ))}
              </div>
            </Card>
          </section>
        )}

        <section>
          <SectionTitle>{tt('progress_sessions_title', { count: history.length })}</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[...history].reverse().map(point => {
              const session = sessionsById.get(point.sessionId)
              const sets = session?.exercises.filter(ex => ex.exerciseId === exerciseId).flatMap(ex => ex.sets).filter(s => s.done) ?? []
              const numbers = sets.reduce<number[]>((acc, set) => {
                acc.push(set.type === 'warmup' ? 0 : (acc.filter(n => n > 0).length + 1))
                return acc
              }, [])
              return (
                <Card key={point.sessionId} style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, minWidth: 0, marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 15, flexShrink: 0 }}>{formatDate(point.date, locale)}</span>
                    {session?.title && (
                      <span style={{ fontSize: 13, color: 'var(--lg-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{session.title}</span>
                    )}
                  </div>
                  <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {sets.map((set, i) => {
                      const warm = set.type === 'warmup'
                      const e1rm = tracking === 'weight_reps' && !warm ? estimateOneRepMax(set.weightKg, set.reps) : null
                      return (
                        <li key={i} style={{ display: 'grid', gridTemplateColumns: '1.6rem minmax(0, 1fr) auto', gap: 8, alignItems: 'baseline', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                          <span
                            title={warm ? tt('progress_set_warmup_label') : undefined}
                            style={{ color: warm ? 'var(--lg-warn-text)' : 'var(--lg-text-3)', fontWeight: 600 }}
                          >
                            {warm ? tt('progress_set_warmup') : numbers[i]}
                          </span>
                          <span style={{ color: warm ? 'var(--lg-text-3)' : 'var(--lg-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {formatSet(set, tracking, unit, locale, repsUnit)}
                            {set.rpe != null && <span style={{ color: 'var(--lg-text-3)' }}> · {tt('progress_set_rpe', { value: formatNumber(set.rpe, locale, 1) })}</span>}
                          </span>
                          <span style={{ color: 'var(--lg-text-3)', fontSize: 12 }}>
                            {e1rm != null ? `e1RM ${formatWeight(e1rm, unit, locale)}` : ''}
                          </span>
                        </li>
                      )
                    })}
                  </ol>
                </Card>
              )
            })}
          </div>
        </section>

        <p style={{ fontSize: 12, color: 'var(--lg-text-3)', lineHeight: 1.45 }}>{tt('progress_footnote')}</p>
      </div>
    </TrainingSheet>
  )
}
