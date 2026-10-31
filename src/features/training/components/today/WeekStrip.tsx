import { useMemo, useRef, useState } from 'react'
import type { TrainingSession } from '../../types'
import { useTrainingText, type TrainingTextKey } from '../../i18n'
import type { TrainingData } from '../../hooks/useTrainingData'
import { formatDuration, formatVolume } from '../../lib/format'
import { sessionDurationS, sessionVolumeKg } from '../../lib/stats'
import { weekDays, type WeekDay } from '../../lib/weekStrip'

/**
 * Montag bis Sonntag oben auf „Heute", in der Optik des Kalenders: darueber
 * der Zeitraum der Woche, je Tag oben ein Balken, darunter Datum und
 * Wochentag. Gruen gefuellt heisst trainiert, Akzent heisst geplant. Heute
 * steht die Zahl in Akzentfarbe, der gewaehlte Tag liegt auf einer Kachel.
 * Tippen oder Pfeiltasten zeigen unter der Leiste, was an dem Tag war oder
 * ansteht.
 */
export function WeekStrip({ data, now }: { data: TrainingData; now: Date }) {
  const { tt, locale } = useTrainingText()
  const days = useMemo(() => weekDays(now, data.sessions, data.routines), [now, data.sessions, data.routines])
  const [selected, setSelected] = useState(() => Math.max(0, days.findIndex(d => d.isToday)))
  const buttons = useRef<Array<HTMLButtonElement | null>>([])
  const hasPlan = data.routines.some(r => r.weekdays.length > 0)
  const longDate = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }), [locale])
  const weekTitle = useMemo(() => {
    const range = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' })
    const first = days[0].date
    const last = days[days.length - 1].date
    return typeof range.formatRange === 'function' ? range.formatRange(first, last) : `${range.format(first)} – ${range.format(last)}`
  }, [days, locale])

  const sessionText = (s: TrainingSession) => {
    const duration = sessionDurationS(s)
    const volume = sessionVolumeKg(s)
    return [
      s.title || tt(`kind_${s.kind}` as TrainingTextKey),
      duration > 0 ? formatDuration(duration, tt('min')) : null,
      volume > 0 ? formatVolume(volume, data.settings.unit, locale) : null,
    ].filter(Boolean).join(' · ')
  }
  const dayText = (day: WeekDay) => {
    if (day.sessions.length) return day.sessions.map(sessionText).join(' + ')
    const names = day.planned.map(r => r.name).join(', ')
    if (names) return day.isToday ? `${tt('planned_today')}: ${names}` : tt('week_planned', { names })
    if (day.isPast) return tt('week_no_training')
    return hasPlan ? tt('rest_day') : tt('week_nothing_planned')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--lg-text)', padding: '0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{weekTitle}</h2>
      <div
        role="radiogroup"
        aria-label={tt('this_week')}
        onKeyDown={event => {
          const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
          if (!delta) return
          event.preventDefault()
          const i = (selected + delta + 7) % 7
          setSelected(i)
          buttons.current[i]?.focus()
        }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4 }}
      >
        {days.map((day, i) => {
          const isSelected = selected === i
          const trained = day.sessions.length > 0
          const planned = day.planned.length > 0
          // Der Balken wie im Kalender: gruen = erledigt, Akzent = steht an.
          const bar = trained ? 'var(--lg-good)'
            : planned ? 'color-mix(in srgb, var(--accent) 45%, transparent)'
            : 'transparent'
          return (
            <button
              key={day.date.toISOString()}
              ref={node => { buttons.current[i] = node }}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => setSelected(i)}
              aria-current={day.isToday ? 'date' : undefined}
              aria-label={`${longDate.format(day.date)}: ${dayText(day)}`}
              className="tyd-train-press"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7,
                minHeight: 72, padding: '9px 0 10px', borderRadius: 16,
                background: isSelected ? 'var(--lg-fill)' : 'transparent',
              }}
            >
              <span aria-hidden="true" style={{ display: 'block', width: 22, height: 4, borderRadius: 2, background: bar, flexShrink: 0 }} />
              <span
                aria-hidden="true"
                style={{
                  fontFamily: 'var(--lg-display)', fontSize: 21, fontWeight: 700, lineHeight: 1,
                  letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', transition: 'color 150ms',
                  color: day.isToday ? 'var(--accent)'
                    : isSelected ? 'var(--lg-text)'
                    : day.isPast ? 'var(--lg-text-3)' : 'var(--lg-text-2)',
                }}
              >
                {day.date.getDate()}
              </span>
              <span
                aria-hidden="true"
                style={{
                  fontSize: 11, fontWeight: 700, lineHeight: 1, textTransform: 'uppercase', letterSpacing: '0.08em',
                  transition: 'color 150ms', color: isSelected ? 'var(--accent)' : 'var(--lg-text-3)',
                }}
              >
                {tt(`weekday_${day.weekday}` as TrainingTextKey)}
              </span>
            </button>
          )
        })}
      </div>
      <p aria-live="polite" style={{ fontSize: '0.8rem', color: 'var(--lg-text-3)', textAlign: 'center', margin: 0, minHeight: '1.2em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {days[selected] ? dayText(days[selected]) : ''}
      </p>
    </div>
  )
}
