import { useMemo, useState } from 'react'
import { Trophy } from 'lucide-react'
import type { TrainingSession, TrainingSettings } from '../../types'
import { useTrainingText, type TrainingTextKey } from '../../i18n'
import type { ActiveWorkout } from '../../lib/activeWorkout'
import { countSets, finishWorkout } from '../../lib/activeWorkout'
import { formatClock, formatDistance, formatNumber, formatVolume, formatWeight } from '../../lib/format'
import { detectRecords, sessionVolumeKg, workingSetCount, type PersonalRecord } from '../../lib/stats'
import { Button, Chip, Stat, TrainingSheet, TRAINING_ACCENT } from '../ui'

/** Abschluss: was war das Training, welche Rekorde, wie hart — dann speichern. */
export function FinishSheet({ workout, history, settings, nameOf, onSave, onClose }: {
  workout: ActiveWorkout
  history: readonly TrainingSession[]
  settings: TrainingSettings
  nameOf: (exerciseId: string) => string
  onSave: (rpe: number | null) => Promise<void>
  onClose: () => void
}) {
  const { tt, locale } = useTrainingText()
  const editing = workout.sessionId ? history.find(s => s.id === workout.sessionId) ?? null : null
  const [rpe, setRpe] = useState<number | null>(editing?.rpe ?? null)
  const [busy, setBusy] = useState(false)
  const [now] = useState(() => new Date())

  const preview = useMemo(() => {
    const draft = finishWorkout(workout, { now, rpe, previous: editing })
    const session: TrainingSession = { id: workout.sessionId ?? '__draft', ...draft }
    return { session, records: detectRecords(session, history) }
  }, [workout, now, rpe, editing, history])

  const { open } = countSets(workout)
  const sets = workingSetCount(preview.session)
  const nothing = preview.session.exercises.length === 0

  return (
    <TrainingSheet
      title={tt('summary_title')}
      onClose={onClose}
      busy={busy}
      tall
      zIndex={110}
      footer={
        <Button
          block
          disabled={busy || nothing}
          onClick={async () => {
            setBusy(true)
            try { await onSave(rpe) } finally { setBusy(false) }
          }}
        >
          {busy ? tt('saving') : tt('summary_save')}
        </Button>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
          <Stat label={tt('summary_duration')} value={formatClock(preview.session.durationS ?? 0)} />
          <Stat label={tt('summary_volume')} value={formatVolume(sessionVolumeKg(preview.session), settings.unit, locale)} />
          <Stat label={tt('summary_sets')} value={sets} />
        </div>

        {nothing && <p style={{ color: 'var(--text-dim)' }}>{tt('summary_nothing')}</p>}
        {open > 0 && !nothing && <p style={{ color: '#f59e0b', fontSize: '0.85rem' }}>{tt('summary_unfinished', { count: open })}</p>}

        {preview.records.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, marginBottom: 8, color: '#eab308' }}>
              <Trophy size={18} aria-hidden="true" /> {tt('summary_records')}
            </div>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {preview.records.map((r, i) => (
                <li key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontSize: '0.9rem' }}>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 700 }}>{tt(`record_${r.kind}` as TrainingTextKey)}</span>
                    <span style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameOf(r.exerciseId)}</span>
                  </span>
                  <strong style={{ fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{recordValue(r, settings, locale)}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <div style={{ fontWeight: 800, marginBottom: 8 }}>
            {tt('summary_rpe')} {rpe != null && <span style={{ color: TRAINING_ACCENT }}>{tt('summary_rpe_value', { value: rpe })}</span>}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map(v => (
              <Chip key={v} active={rpe === v} onClick={() => setRpe(rpe === v ? null : v)}>{v}</Chip>
            ))}
          </div>
        </div>
      </div>
    </TrainingSheet>
  )
}

export function recordValue(r: PersonalRecord, settings: TrainingSettings, locale: string): string {
  switch (r.kind) {
    case 'e1rm':
    case 'weight': return formatWeight(r.value, settings.unit, locale)
    case 'volume': return formatVolume(r.value, settings.unit, locale)
    case 'reps': return formatNumber(r.value, locale, 0)
    case 'duration': return formatClock(r.value)
    case 'distance': return formatDistance(r.value, locale)
  }
}
