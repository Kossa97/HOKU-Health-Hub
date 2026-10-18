import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type BarShapeProps } from 'recharts'
import type { TrainingSession, WeightUnit } from '../../types'
import { toDisplayWeight } from '../../lib/stats'
import { formatNumber, formatVolume } from '../../lib/format'
import { useTrainingText } from '../../i18n'
import { Card, Chip, KIND_STYLE, SectionTitle, TRAINING_ACCENT } from '../ui'
import { LegendItem, TableView, TooltipBox } from './chartParts'
import { AXIS_TICK, REST_KEY, weeklyModel, type WeekSeriesKey } from './progressModel'

/**
 * Einheiten je Woche, gestapelt nach Art — oder das Volumen als eine Reihe.
 * Hoechstens vier Farben; seltene Arten fallen unter „Weitere". Die Farbe
 * haengt an der Art (KIND_STYLE), nie am Rang.
 */

const REST_COLOR = '#64748b'
const GAP = 2
const RADIUS = 4

function seriesColor(key: WeekSeriesKey): string {
  return key === REST_KEY ? REST_COLOR : KIND_STYLE[key].color
}

/** Balken mit 4px runder Oberkante; Segmente darunter lassen 2px Luft nach oben. */
function segmentPath(x: number, y: number, width: number, height: number, top: boolean): string {
  const h = top ? height : height - GAP
  const yy = top ? y : y + GAP
  if (h <= 0 || width <= 0) return ''
  if (!top) return `M${x},${yy} H${x + width} V${yy + h} H${x} Z`
  const r = Math.min(RADIUS, width / 2, h)
  return `M${x},${yy + h} V${yy + r} Q${x},${yy} ${x + r},${yy} H${x + width - r} Q${x + width},${yy} ${x + width},${yy + r} V${yy + h} Z`
}

function makeShape(key: string, fill: string, alwaysTop = false) {
  return function Segment(props: BarShapeProps) {
    const { x, y, width, height } = props
    const row = props.payload as { __top?: string } | undefined
    const d = segmentPath(Number(x), Number(y), Number(width), Number(height), alwaysTop || row?.__top === key)
    return d ? <path d={d} fill={fill} /> : <g />
  }
}

type Mode = 'sessions' | 'volume'

export function WeeklyChart({ sessions, unit, now }: { sessions: readonly TrainingSession[]; unit: WeightUnit; now: Date }) {
  const { tt, locale } = useTrainingText()
  const [mode, setMode] = useState<Mode>('sessions')
  const model = useMemo(() => weeklyModel(sessions, now), [sessions, now])
  const hasVolume = model.totalVolumeKg > 0
  const activeMode: Mode = hasVolume ? mode : 'sessions'

  const seriesLabel = (key: WeekSeriesKey) => key === REST_KEY ? tt('progress_kind_rest') : tt(`kind_${key}`)
  const weekLabel = (start: number) => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'numeric' }).format(new Date(start))
  const weekLong = (start: number) => tt('week_of', { date: new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(new Date(start)) })

  const rows = useMemo(() => model.weeks.map(week => {
    const row: Record<string, number | string> = {
      start: week.start,
      volume: toDisplayWeight(week.volumeKg, unit),
    }
    let top = ''
    for (const key of model.series) {
      const count = week.counts[key] ?? 0
      row[key] = count
      if (count > 0) top = key
    }
    row.__top = top
    return row
  }), [model, unit])

  const shapes = useMemo(
    () => Object.fromEntries(model.series.map(key => [key, makeShape(key, seriesColor(key))])),
    [model.series],
  )
  const volumeShape = useMemo(() => makeShape('volume', TRAINING_ACCENT, true), [])

  const subtitle = activeMode === 'sessions'
    ? tt('progress_weekly_sessions_total', { count: model.totalSessions })
    : tt('progress_weekly_volume_total', { value: formatVolume(model.totalVolumeKg, unit, locale) })

  return (
    <section aria-labelledby="progress-weekly-title">
      <SectionTitle
        action={hasVolume ? (
          <div role="group" aria-label={tt('progress_weekly_title')} style={{ display: 'flex', gap: 6 }}>
            <Chip active={activeMode === 'sessions'} onClick={() => setMode('sessions')}>{tt('progress_mode_sessions')}</Chip>
            <Chip active={activeMode === 'volume'} onClick={() => setMode('volume')}>{tt('progress_mode_volume')}</Chip>
          </div>
        ) : undefined}
      >
        <span id="progress-weekly-title">{tt('progress_weekly_title')}</span>
      </SectionTitle>
      <Card>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-dim)', fontWeight: 650, marginBottom: 8 }}>{subtitle}</div>

        {activeMode === 'sessions' && model.series.length >= 2 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', marginBottom: 8 }}>
            {model.series.map(key => <LegendItem key={key} color={seriesColor(key)} label={seriesLabel(key)} />)}
          </div>
        )}

        <div style={{ width: '100%', height: 184 }} role="img" aria-label={`${tt('progress_weekly_title')}: ${subtitle}`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 6, right: 4, bottom: 0, left: -12 }} barCategoryGap="22%">
              <CartesianGrid vertical={false} stroke="var(--border)" strokeWidth={1} />
              <XAxis
                dataKey="start"
                tickFormatter={(value: number) => weekLabel(value)}
                tick={AXIS_TICK} tickLine={false} axisLine={{ stroke: 'var(--border-strong)' }}
                interval="preserveStartEnd" minTickGap={8}
              />
              <YAxis
                tick={AXIS_TICK} tickLine={false} axisLine={false} width={44}
                allowDecimals={activeMode === 'volume'}
                tickFormatter={(value: number) => activeMode === 'volume'
                  ? new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 }).format(value)
                  : formatNumber(value, locale, 0)}
              />
              <Tooltip
                cursor={{ fill: 'var(--border)' }}
                isAnimationActive={false}
                content={({ active, payload }) => {
                  const row = payload?.[0]?.payload as Record<string, number> | undefined
                  if (!active || !row) return null
                  if (activeMode === 'volume') {
                    return <TooltipBox title={weekLong(row.start)} rows={[{ key: 'v', color: TRAINING_ACCENT, value: formatVolume(model.weeks.find(w => w.start === row.start)?.volumeKg ?? 0, unit, locale) }]} />
                  }
                  const parts = model.series
                    .filter(key => (row[key] ?? 0) > 0)
                    .map(key => ({ key, color: seriesColor(key), value: String(row[key]), label: seriesLabel(key) }))
                  const total = model.series.reduce((sum, key) => sum + (row[key] ?? 0), 0)
                  return <TooltipBox title={weekLong(row.start)} rows={[...parts, { key: 'total', value: String(total), label: tt('progress_col_total') }]} />
                }}
              />
              {activeMode === 'sessions'
                ? model.series.map(key => (
                  <Bar key={key} dataKey={key} stackId="kinds" fill={seriesColor(key)} maxBarSize={24} isAnimationActive={false} shape={shapes[key]} />
                ))
                : <Bar dataKey="volume" fill={TRAINING_ACCENT} maxBarSize={24} isAnimationActive={false} shape={volumeShape} />}
            </BarChart>
          </ResponsiveContainer>
        </div>

        {activeMode === 'volume' && (
          <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>{tt('progress_weekly_volume_note')}</p>
        )}

        <TableView
          summary={tt('progress_table_show')}
          head={activeMode === 'sessions'
            ? [tt('progress_col_week'), ...model.series.map(seriesLabel), tt('progress_col_total')]
            : [tt('progress_col_week'), tt('progress_mode_volume')]}
          rows={[...model.weeks].reverse().map(week => ({
            key: String(week.start),
            cells: activeMode === 'sessions'
              ? [weekLabel(week.start), ...model.series.map(key => week.counts[key] ?? 0), week.total]
              : [weekLabel(week.start), formatVolume(week.volumeKg, unit, locale)],
          }))}
        />
      </Card>
    </section>
  )
}
