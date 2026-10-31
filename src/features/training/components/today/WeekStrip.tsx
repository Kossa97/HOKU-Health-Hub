import { useMemo, useRef, useState } from 'react'
import type { TrainingSession } from '../../types'
import { useTrainingText, type TrainingTextKey } from '../../i18n'
import type { TrainingData } from '../../hooks/useTrainingData'
import { formatDuration, formatVolume } from '../../lib/format'
import { sessionDurationS, sessionVolumeKg } from '../../lib/stats'
import { weekDays, type WeekDay } from '../../lib/weekStrip'
import { KIND_STYLE, TRAINING_ACCENT } from '../ui'
import { trainingTint } from '../accent'

/**
 * Montag bis Sonntag oben auf „Heute": Datum, darunter der Wochentag.
 * Ein gefuellter Kreis heisst trainiert (Farbe der Art), ein Ring in
 * Akzentfarbe heisst geplant, heute ist der Ring dicker (hell, wenn nichts
 * geplant ist). Tippen oder Pfeiltasten zeigen unter der Leiste, was an dem
 * Tag war oder ansteht.
 */
export function WeekStrip({ data, now }: { data: TrainingData; now: Date }) {
  const { tt, locale } = useTrainingText()
  const days = useMemo(() => weekDays(now, data.sessions, data.routines), [now, data.sessions, data.routines])
  const [selected, setSelected] = useState(() => Math.max(0, days.findIndex(d => d.isToday)))
  const buttons = useRef<Array<HTMLButtonElement | null>>([])
  const hasPlan = data.routines.some(r => r.weekdays.length > 0)
  const longDate = useMemo(() => new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }), [locale])

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
    <div>
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
        style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 2 }}
      >
        {days.map((day, i) => {
          const main = day.sessions[0]
          const fill = main ? KIND_STYLE[main.kind].color : null
          const planned = day.planned.length > 0
          // Ring: heute (Akzent, wenn etwas geplant ist) bzw. geplant; die Art des Trainings steht als Punkt darunter.
          const ring = day.isToday ? `inset 0 0 0 2px ${planned && !fill ? TRAINING_ACCENT : 'var(--lg-text)'}`
            : planned && !fill ? `inset 0 0 0 1.5px ${trainingTint(70)}`
            : undefined
          return (
            <button
              key={day.date.toISOString()}
              ref={node => { buttons.current[i] = node }}
              type="button"
              role="radio"
              aria-checked={selected === i}
              tabIndex={selected === i ? 0 : -1}
              onClick={() => setSelected(i)}
              aria-current={day.isToday ? 'date' : undefined}
              aria-label={`${longDate.format(day.date)}: ${dayText(day)}`}
              className="tyd-train-press"
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                minHeight: 60, padding: '4px 0', borderRadius: 12,
                background: selected === i ? 'var(--lg-fill)' : 'transparent',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  position: 'relative',
                  width: 32, height: 32, borderRadius: 16, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 500, fontVariantNumeric: 'tabular-nums',
                  background: fill ? 'var(--lg-fill-selected)' : 'transparent', boxShadow: ring,
                  color: fill || day.isToday ? 'var(--lg-text)' : planned ? TRAINING_ACCENT : 'var(--lg-text-3)',
                }}
              >
                {day.date.getDate()}
                {fill && <span style={{ position: 'absolute', bottom: 3, left: '50%', width: 4, height: 4, marginLeft: -2, borderRadius: '50%', background: fill }} />}
              </span>
              <span aria-hidden="true" style={{ fontSize: 12, fontWeight: 400, color: day.isToday ? 'var(--lg-text)' : 'var(--lg-text-3)' }}>
                {tt(`weekday_${day.weekday}` as TrainingTextKey)}
              </span>
            </button>
          )
        })}
      </div>
      <p aria-live="polite" style={{ fontSize: 13, color: 'var(--lg-text-3)', textAlign: 'center', margin: '8px 0 0', minHeight: '1.2em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {days[selected] ? dayText(days[selected]) : ''}
      </p>
    </div>
  )
}
