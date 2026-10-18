import { useDeferredValue, useMemo, useState } from 'react'
import { ChevronRight, LineChart as LineChartIcon, Minus, Search, TrendingDown, TrendingUp } from 'lucide-react'
import type { TrainingData } from '../../hooks/useTrainingData'
import { matchesSearch } from '../../lib/exerciseLookup'
import { formatDate } from '../../lib/format'
import { useTrainingText } from '../../i18n'
import { Card, SectionTitle, TRAINING_ACCENT, inputStyle } from '../ui'
import { WeeklyChart } from './WeeklyChart'
import { MuscleBalance } from './MuscleBalance'
import { ExerciseDetailSheet } from './ExerciseDetailSheet'
import { bestOf, exerciseSummaries, formatMetric, formatSet, type ExerciseSummary, type Trend } from './progressModel'

/**
 * Fortschritt: Wochen, Muskelbalance, jede Uebung im Verlauf. Tippen auf eine
 * Uebung oeffnet den Verlauf mit Stack- und Blutwert-Markern.
 */

const TREND_ICON = { up: TrendingUp, down: TrendingDown, flat: Minus } as const
const TREND_KEY = { up: 'progress_trend_up', down: 'progress_trend_down', flat: 'progress_trend_flat' } as const

function TrendMark({ trend, label }: { trend: Trend; label: string }) {
  const Icon = TREND_ICON[trend]
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      style={{
        width: 24, height: 24, borderRadius: 8, flexShrink: 0,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        color: trend === 'up' ? '#10b981' : 'var(--text-muted)',
        background: trend === 'up' ? 'rgba(16,185,129,0.12)' : 'var(--surface-raised)',
      }}
    >
      <Icon size={14} aria-hidden="true" />
    </span>
  )
}

export function ProgressTab({ data }: { data: TrainingData }) {
  const { tt, lang, locale } = useTrainingText()
  const [now] = useState(() => new Date())
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const [openId, setOpenId] = useState<string | null>(null)
  const unit = data.settings.unit
  const repsUnit = tt('progress_reps_unit')

  const summaries = useMemo(
    () => exerciseSummaries(data.sessions, lang, data.customExercises),
    [data.sessions, lang, data.customExercises],
  )
  const filtered = useMemo(
    () => summaries.filter(s => matchesSearch(s.id, deferredQuery, lang, data.customExercises)),
    [summaries, deferredQuery, lang, data.customExercises],
  )

  if (data.sessions.length === 0) {
    return (
      <Card style={{ textAlign: 'center', padding: '32px 20px' }}>
        <span
          aria-hidden="true"
          style={{
            width: 48, height: 48, borderRadius: 16, margin: '0 auto 12px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: `${TRAINING_ACCENT}1f`, color: TRAINING_ACCENT,
          }}
        >
          <LineChartIcon size={24} />
        </span>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 800, marginBottom: 6 }}>{tt('progress_empty_title')}</h2>
        <p style={{ fontSize: '0.88rem', color: 'var(--text-dim)', lineHeight: 1.45, maxWidth: 340, margin: '0 auto' }}>{tt('progress_empty_body')}</p>
      </Card>
    )
  }

  const bestLabel = (s: ExerciseSummary): string | null => {
    const primary = s.metrics[0]
    if (!primary) return null
    // Kraft: bester e1RM; sonst die erste sinnvolle Kennzahl der Uebung.
    const pick = s.metrics.includes('e1rm') ? 'e1rm' : primary === 'volume' ? null : primary
    if (!pick) return null
    const best = bestOf(s.history, pick)
    if (!best) return null
    const value = formatMetric(pick, best.value, unit, locale, repsUnit)
    switch (pick) {
      case 'e1rm': return tt('progress_best_e1rm', { value })
      case 'weight': return tt('progress_best_weight', { value })
      case 'reps': return tt('progress_best_reps', { value: best.value })
      case 'duration': return tt('progress_best_duration', { value })
      case 'distance': return tt('progress_best_distance', { value })
      default: return null
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <WeeklyChart sessions={data.sessions} unit={unit} now={now} />
      <MuscleBalance sessions={data.sessions} custom={data.customExercises} now={now} />

      <section aria-labelledby="progress-exercises-title">
        <SectionTitle><span id="progress-exercises-title">{tt('progress_exercises_title')}</span></SectionTitle>

        {summaries.length > 0 && (
          <label style={{ position: 'relative', display: 'block', marginBottom: 10 }}>
            <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' }}>
              {tt('progress_search_label')}
            </span>
            <Search size={16} aria-hidden="true" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input
              type="search"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder={tt('progress_search_placeholder')}
              autoComplete="off"
              enterKeyHint="search"
              style={{ ...inputStyle, paddingLeft: 36 }}
            />
          </label>
        )}

        {summaries.length === 0 ? (
          <Card><p style={{ fontSize: '0.88rem', color: 'var(--text-dim)' }}>{tt('progress_exercises_empty')}</p></Card>
        ) : filtered.length === 0 ? (
          <Card><p style={{ fontSize: '0.88rem', color: 'var(--text-dim)', overflowWrap: 'anywhere' }}>{tt('progress_search_empty', { query: deferredQuery.trim() })}</p></Card>
        ) : (
          <Card style={{ padding: 0, overflow: 'hidden' }}>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {filtered.map((s, i) => {
                const best = bestLabel(s)
                const lastSet = s.last.bestSet ? formatSet(s.last.bestSet, s.tracking, unit, locale, repsUnit) : '—'
                return (
                  <li key={s.id} style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border)' }}>
                    <button
                      type="button"
                      onClick={() => setOpenId(s.id)}
                      className="tyd-train-press"
                      style={{
                        width: '100%', minHeight: 60, padding: '10px 14px',
                        display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
                        background: 'transparent', color: 'var(--text)', cursor: 'pointer',
                      }}
                    >
                      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontWeight: 750, fontSize: '0.92rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                          {tt('progress_last_set', { date: formatDate(s.last.date, locale, { day: 'numeric', month: 'short' }), set: lastSet })}
                        </span>
                        {best && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>{best}</span>
                        )}
                      </span>
                      {s.trend && s.metrics[0] && <TrendMark trend={s.trend} label={tt(TREND_KEY[s.trend])} />}
                      <ChevronRight size={18} aria-hidden="true" style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    </button>
                  </li>
                )
              })}
            </ul>
          </Card>
        )}
      </section>

      {openId && <ExerciseDetailSheet exerciseId={openId} data={data} onClose={() => setOpenId(null)} />}
    </div>
  )
}
