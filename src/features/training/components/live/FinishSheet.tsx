import { useMemo, useState } from 'react'
import { Trophy } from 'lucide-react'
import type { TrackingMode, TrainingRoutine, TrainingSession, TrainingSettings } from '../../types'
import { useTrainingText, type TrainingTextKey } from '../../i18n'
import type { ActiveWorkout } from '../../lib/activeWorkout'
import { countSets, finishWorkout } from '../../lib/activeWorkout'
import { formatClock, formatDistance, formatNumber, formatVolume, formatWeight } from '../../lib/format'
import { routineDiff, type RoutineDiff } from '../../lib/routineDiff'
import { detectRecords, sessionVolumeKg, workingSetCount, type PersonalRecord } from '../../lib/stats'
import { Button, Chip, Stat, TrainingSheet, TRAINING_ACCENT } from '../ui'

/**
 * Abschluss: was war das Training, welche Rekorde, wie hart — dann speichern.
 * Weicht ein Live-Training von seiner Routine ab, fragt die App, ob die
 * Routine nachgezogen werden soll (Haken, voreingestellt an). Beim Bearbeiten
 * einer alten Einheit nicht: die Routine ist seitdem weitergezogen, ein alter
 * Stand soll sie nicht zuruecksetzen.
 */
export function FinishSheet({ workout, history, routine, settings, nameOf, trackingOf, onSave, onClose }: {
  workout: ActiveWorkout
  history: readonly TrainingSession[]
  /** Die Routine, aus der das Training gestartet wurde; null ohne. */
  routine: TrainingRoutine | null
  settings: TrainingSettings
  nameOf: (exerciseId: string) => string
  trackingOf: (exerciseId: string) => TrackingMode | null
  /** `diff` ist gesetzt, wenn die Routine die Aenderungen uebernehmen soll. */
  onSave: (rpe: number | null, diff: RoutineDiff | null) => Promise<void>
  onClose: () => void
}) {
  const { tt, locale } = useTrainingText()
  const editing = workout.sessionId ? history.find(s => s.id === workout.sessionId) ?? null : null
  const [rpe, setRpe] = useState<number | null>(editing?.rpe ?? null)
  const [busy, setBusy] = useState(false)
  const [now] = useState(() => new Date())
  const [updateRoutine, setUpdateRoutine] = useState(true)

  // Nur fuer Live-Trainings; eine bearbeitete alte Einheit bietet den Abgleich nicht an.
  const diff = useMemo(
    () => routine && workout.sessionId == null ? routineDiff(workout, routine) : null,
    [workout, routine],
  )
  const diffText = useMemo(() => {
    if (!diff) return ''
    const parts = [
      ...diff.added.map(id => tt('diff_added', { name: nameOf(id) })),
      ...diff.removed.map(id => tt('diff_removed', { name: nameOf(id) })),
      ...diff.setChanges.map(c => tt('diff_sets', { name: nameOf(c.exerciseId), from: c.from, to: c.to })),
      ...(diff.reordered ? [tt('diff_reordered')] : []),
    ]
    return parts.join(' · ')
  }, [diff, nameOf, tt])

  const preview = useMemo(() => {
    const draft = finishWorkout(workout, { now, rpe, previous: editing })
    const session: TrainingSession = { id: workout.sessionId ?? '__draft', ...draft }
    return { session, records: detectRecords(session, history, trackingOf) }
  }, [workout, now, rpe, editing, history, trackingOf])

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Button
            block
            disabled={busy || nothing}
            style={{ minHeight: 52 }}
            onClick={async () => {
              setBusy(true)
              try { await onSave(rpe, updateRoutine ? diff : null) } finally { setBusy(false) }
            }}
          >
            {busy ? tt('saving') : tt('summary_save')}
          </Button>
          {!editing && (
            <p style={{ margin: 0, textAlign: 'center', fontSize: 12, lineHeight: 1.4, color: 'var(--lg-text-3)' }}>{tt('save_hint')}</p>
          )}
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
          <Stat label={tt('summary_duration')} value={formatClock(preview.session.durationS ?? 0)} />
          <Stat label={tt('summary_volume')} value={formatVolume(sessionVolumeKg(preview.session), settings.unit, locale)} />
          <Stat label={tt('summary_sets')} value={sets} />
        </div>

        {nothing && <p style={{ fontSize: 15, color: 'var(--lg-text-3)' }}>{tt('summary_nothing')}</p>}
        {open > 0 && !nothing && <p style={{ color: 'var(--lg-warn-text)', fontSize: 13 }}>{tt('summary_unfinished', { count: open })}</p>}

        {preview.records.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 500, marginBottom: 8 }}>
              <Trophy size={18} strokeWidth={1.5} aria-hidden="true" style={{ color: 'var(--lg-text-2)' }} /> {tt('summary_records')}
            </div>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {preview.records.map((r, i) => (
                <li key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontSize: 15 }}>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 500 }}>{tt(`record_${r.kind}` as TrainingTextKey)}</span>
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--lg-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nameOf(r.exerciseId)}</span>
                  </span>
                  <strong style={{ fontWeight: 500, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{recordValue(r, settings, locale)}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <div style={{ fontSize: 17, fontWeight: 500, marginBottom: 8 }}>
            {tt('summary_rpe')} {rpe != null && <span style={{ color: TRAINING_ACCENT }}>{tt('summary_rpe_value', { value: rpe })}</span>}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map(v => (
              <Chip key={v} active={rpe === v} onClick={() => setRpe(rpe === v ? null : v)}>{v}</Chip>
            ))}
          </div>
        </div>

        {diff && routine && (
          <label
            className="tyd-train-pop"
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer',
              padding: '12px 16px', borderRadius: 14, background: 'var(--lg-surface-2)',
              border: '1px solid var(--lg-hair)',
            }}
          >
            <input
              type="checkbox"
              checked={updateRoutine}
              onChange={event => setUpdateRoutine(event.target.checked)}
              style={{ width: 22, height: 22, margin: 2, flexShrink: 0, accentColor: TRAINING_ACCENT }}
            />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 500 }}>{tt('update_routine_question')}</span>
              <span style={{ display: 'block', fontSize: 13, color: 'var(--lg-text-3)', marginTop: 4, lineHeight: 1.4 }}>
                {routine.name} · {tt('update_routine_hint', { changes: diffText })}
              </span>
            </span>
          </label>
        )}
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
