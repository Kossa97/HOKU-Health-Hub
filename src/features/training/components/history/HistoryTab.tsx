import { useMemo } from 'react'
import type { TrainingSession } from '../../types'
import { useTrainingText } from '../../i18n'
import type { TrainingData } from '../../hooks/useTrainingData'
import { formatDate } from '../../lib/format'
import { detectRecords, startOfWeek } from '../../lib/stats'
import { SectionTitle } from '../ui'
import { SessionRow } from './SessionRow'

/** Verlauf nach Wochen gruppiert, neueste zuerst, mit Rekord-Zahl je Einheit. */
export function HistoryTab({ data, onOpen }: { data: TrainingData; onOpen: (session: TrainingSession) => void }) {
  const { tt, locale } = useTrainingText()

  const weeks = useMemo(() => {
    const groups = new Map<number, TrainingSession[]>()
    for (const s of data.sessions) {
      const key = startOfWeek(new Date(s.startedAt)).getTime()
      groups.set(key, [...(groups.get(key) ?? []), s])
    }
    return [...groups.entries()].sort(([a], [b]) => b - a)
  }, [data.sessions])

  // Rekorde nur fuer Krafteinheiten der letzten 60 — ueber den ganzen Verlauf waere das teuer und selten gelesen.
  const records = useMemo(() => {
    const map = new Map<string, number>()
    for (const s of data.sessions.slice(0, 60)) {
      if (s.exercises.length === 0) continue
      map.set(s.id, detectRecords(s, data.sessions).length)
    }
    return map
  }, [data.sessions])

  if (data.sessions.length === 0) {
    return <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '40px 16px' }}>{tt('history_empty')}</p>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {weeks.map(([weekStart, sessions]) => (
        <section key={weekStart}>
          <SectionTitle>{tt('week_of', { date: formatDate(new Date(weekStart).toISOString(), locale, { day: 'numeric', month: 'short', year: 'numeric' }) })}</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sessions.map(s => (
              <SessionRow key={s.id} session={s} data={data} recordCount={records.get(s.id) ?? 0} onOpen={() => onOpen(s)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
