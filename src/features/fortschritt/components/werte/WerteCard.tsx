import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { addDays, format, parseISO } from 'date-fns'
import type { DailyLogEntry, DateRange } from '../../types'
import { buildValueOverview, type ValueOverviewKey, type ValueOverviewRow } from '../../lib/valueOverview'
import { formatDaySafe, formatNumber } from '../../lib/dates'
import { metricLabel } from '../../lib/metricLabels'
import { useAmbientTint, useReadingZone } from '../../ambient/context'

interface Props {
  dailyLogs: DailyLogEntry[]
  range: DateRange
}

type RingKey = Exclude<ValueOverviewKey, 'body_fat_pct'>

/** Je Wert ein Verlauf entlang des Rings: dunkel am Start, hell am Ende. */
const RING_COLORS: Record<RingKey, { a: string; b: string }> = {
  energie: { a: '#ff7a00', b: '#ffd60a' },
  schlaf: { a: '#5e5ce6', b: '#64d2ff' },
  wohlbefinden: { a: '#1fae4b', b: '#a6f36b' },
  libido: { a: '#ff2d55', b: '#ff8fb1' },
}
const RING_KEYS = Object.keys(RING_COLORS) as RingKey[]

const ARROWS = { up: '↑', down: '↓', flat: '→' } as const
const TONE: Record<ValueOverviewRow['tone'], string> = {
  positive: '#30d158',
  neutral: 'rgba(235, 240, 255, 0.52)',
  warning: '#ff9f0a',
  negative: '#ff453a',
}

const one = (value: number) => formatNumber(value, 1)

/**
 * „Deine Werte“: Ø der zweiten Zeitraumhälfte als Ring (von 10), darunter die
 * Veränderung gegenüber der ersten Hälfte. Antippen klappt die letzten 14 Tage auf.
 */
export function WerteCard({ dailyLogs, range }: Props) {
  const { t } = useTranslation()
  const rows = buildValueOverview(dailyLogs, range)
  const [open, setOpen] = useState<RingKey | null>(null)
  // Zuletzt geöffnet: bleibt beim Zuklappen stehen, damit das Zuklappen sichtbar animiert
  const [shownDetail, setShownDetail] = useState<RingKey | null>(null)
  // Die Ringe füllen sich einmal sichtbar auf; der Ruhezustand ist der volle Wert.
  const [filled, setFilled] = useState(false)
  const firstFrame = useRef(0)
  useEffect(() => {
    firstFrame.current = requestAnimationFrame(() => {
      firstFrame.current = requestAnimationFrame(() => setFilled(true))
    })
    return () => cancelAnimationFrame(firstFrame.current)
  }, [])

  const bodyFat = rows.find(r => r.key === 'body_fat_pct')

  // Hintergrund: ein geöffneter Ring färbt das untere Licht in seiner Farbe
  useAmbientTint('bottom', open ? { color: RING_COLORS[open].b, boost: 0.03 } : null)
  const sectionRef = useRef<HTMLElement>(null)
  useReadingZone(sectionRef)

  return (
    <section ref={sectionRef} className="fg-card fg-surface" aria-labelledby="fg-values-title">
      <div className="fg-card-head">
        <h3 id="fg-values-title" className="fg-h3">{t('fortschritt_values_title')}</h3>
        <span className="fg-meta">{t('fortschritt_values_sub')} · {t('fortschritt_values_scale')}</span>
      </div>

      <div className="fg-rings">
        {RING_KEYS.map(key => {
          const row = rows.find(r => r.key === key)!
          const label = metricLabel(t, key, row.label)
          const p = filled && row.average != null ? Math.min(1, row.average / 10) : 0
          const colors = RING_COLORS[key]
          return (
            <button
              key={key}
              type="button"
              className="fg-ring"
              aria-expanded={open === key}
              aria-controls="fg-ring-more"
              aria-label={row.average == null
                ? `${label}: ${t('fortschritt_values_no_data')}`
                : `${t('fortschritt_ring_aria', { metric: label, value: one(row.average) })}. ${row.delta == null ? `${t('fortschritt_values_no_compare')}. ` : ''}${t('fortschritt_ring_open')}`}
              onClick={() => {
                const next = open === key ? null : key
                setOpen(next)
                if (next) setShownDetail(next)
              }}
            >
              <span
                className="fg-rv"
                data-empty={row.average == null}
                style={{ '--ca': colors.a, '--cb': colors.b, '--fg-p': p } as CSSProperties}
              >
                <span className="track" />
                <span className="fill" />
                <span className="cap-s" />
                <span className="cap-e"><i /></span>
                <span className="val">{row.average == null ? '–' : one(row.average)}</span>
              </span>
              <span className="fg-ring-name">{label}</span>
              <span className="fg-ring-delta" style={{ color: TONE[row.tone] }}>
                {row.delta == null || row.direction == null
                  ? '–'
                  : `${ARROWS[row.direction]} ${one(Math.abs(row.delta))}`}
              </span>
            </button>
          )
        })}
      </div>

      <div id="fg-ring-more" className="fg-ring-more" data-open={open != null}>
        <div>{shownDetail && <RingDetail key={shownDetail} ringKey={shownDetail} logs={dailyLogs} range={range} />}</div>
      </div>

      {bodyFat?.average != null && (
        <div className="fg-ring-foot">
          <span>{metricLabel(t, 'body_fat', bodyFat.label)} · {t('fortschritt_values_sub')}</span>
          <span>
            {one(bodyFat.average)} %
            {bodyFat.delta != null && bodyFat.direction != null && (
              <span style={{ color: TONE[bodyFat.tone], marginLeft: 8 }}>{ARROWS[bodyFat.direction]} {one(Math.abs(bodyFat.delta))}</span>
            )}
          </span>
        </div>
      )}
    </section>
  )
}

function RingDetail({ ringKey, logs, range }: { ringKey: RingKey; logs: DailyLogEntry[]; range: DateRange }) {
  const { t } = useTranslation()
  const days = useMemo(() => {
    const end = parseISO(`${range.to}T00:00:00`)
    const byDate = new Map(logs.map(l => [l.log_date, l]))
    return Array.from({ length: 14 }, (_, i) => {
      const date = format(addDays(end, i - 13), 'yyyy-MM-dd')
      return { date, value: byDate.get(date)?.[ringKey] ?? null }
    })
  }, [logs, range.to, ringKey])
  const values = days.map(d => d.value).filter((v): v is number => v != null)
  const avg = values.length ? values.reduce((s, v) => s + v, 0) / values.length : null
  const colors = RING_COLORS[ringKey]
  const label = metricLabel(t, ringKey, ringKey)

  return (
    <div className="fg-ring-detail" style={{ '--ca': colors.a, '--cb': colors.b } as CSSProperties}>
      <div className="fg-rd-head">
        <span>{t('fortschritt_ring_last14', { metric: label })}</span>
        <span className="fg-meta">{avg == null ? t('fortschritt_values_no_data') : `Ø ${one(avg)}`}</span>
      </div>
      <div className="fg-rd-bars">
        {days.map((d, i) => (
          <i
            key={d.date}
            data-empty={d.value == null}
            title={`${formatDaySafe(d.date, 'full')}: ${d.value ?? '–'}`}
            style={{ height: `${d.value == null ? 5 : d.value * 10}%`, animationDelay: `${i * 18}ms` }}
          />
        ))}
      </div>
      <div className="fg-rd-axis">
        <span>{formatDaySafe(days[0].date)}</span>
        <span>{formatDaySafe(days[days.length - 1].date)}</span>
      </div>
    </div>
  )
}
