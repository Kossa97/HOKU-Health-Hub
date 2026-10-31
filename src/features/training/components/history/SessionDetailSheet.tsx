import { useMemo, useState } from 'react'
import { Pencil, Trash2, Trophy } from 'lucide-react'
import toast from 'react-hot-toast'
import type { TrainingSession } from '../../types'
import { useTrainingText, type TrainingTextKey } from '../../i18n'
import type { TrainingData } from '../../hooks/useTrainingData'
import { sessionKcal } from '../../lib/energy'
import { exerciseInfo, exerciseName, exerciseTracking } from '../../lib/exerciseLookup'
import { formatClock, formatDate, formatDistance, formatNumber, formatVolume } from '../../lib/format'
import { detectRecords, sessionDurationS, sessionVolumeKg } from '../../lib/stats'
import { previousLabel, SET_TYPE_COLOR } from '../live/SetRow'
import { recordValue } from '../live/FinishSheet'
import { Button, KindBadge, Stat, TrainingSheet } from '../ui'

/** Eine gespeicherte Einheit ansehen, bearbeiten oder loeschen. */
export function SessionDetailSheet({ session, data, onEdit, onClose }: {
  session: TrainingSession
  data: TrainingData
  onEdit: () => void
  onClose: () => void
}) {
  const { tt, lang, locale } = useTrainingText()
  const [busy, setBusy] = useState(false)
  const records = useMemo(
    () => detectRecords(session, data.sessions, id => exerciseTracking(id, data.customExercises)),
    [session, data.sessions, data.customExercises],
  )
  const kcal = sessionKcal(session, data.context.latestWeightKg)
  const unit = data.settings.unit
  const title = session.title || tt(`kind_${session.kind}` as TrainingTextKey)

  const remove = async () => {
    if (!window.confirm(tt('session_delete_confirm'))) return
    setBusy(true)
    try {
      await data.removeSession(session.id)
      toast.success(tt('deleted'))
      onClose()
    } catch {
      toast.error(tt('delete_error'))
      setBusy(false)
    }
  }

  return (
    <TrainingSheet
      title={title}
      onClose={onClose}
      busy={busy}
      tall
      footer={
        <div style={{ display: 'flex', gap: 8 }}>
          <Button tone="danger" disabled={busy} onClick={remove} aria-label={tt('delete')}><Trash2 size={18} aria-hidden="true" /></Button>
          <Button tone="ghost" block disabled={busy} onClick={onEdit}><Pencil size={16} aria-hidden="true" /> {tt('edit')}</Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <KindBadge kind={session.kind} size={44} />
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, color: 'var(--lg-text-3)' }}>
              {formatDate(session.startedAt, locale, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
            </div>
            {session.source !== 'manual' && session.source !== 'live' && (
              <div style={{ fontSize: 12, color: 'var(--lg-text-3)' }}>{tt(`session_source_${session.source}` as TrainingTextKey)}</div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
          <Stat label={tt('summary_duration')} value={formatClock(sessionDurationS(session))} />
          {session.exercises.length > 0
            ? <Stat label={tt('summary_volume')} value={formatVolume(sessionVolumeKg(session), unit, locale)} />
            : <Stat label={tt('quick_distance')} value={session.distanceM ? formatDistance(session.distanceM, locale) : '—'} />}
          <Stat
            label={tt('week_kcal')}
            value={kcal > 0 ? formatNumber(kcal, locale, 0) : '—'}
            sub={session.kcal == null && kcal > 0 ? tt('session_kcal_estimated') : undefined}
          />
          {session.avgHr != null && <Stat label={tt('quick_avg_hr')} value={session.avgHr} />}
          {session.rpe != null && <Stat label={tt('quick_rpe')} value={`${formatNumber(session.rpe, locale, 1)}/10`} />}
        </div>

        {records.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 17, fontWeight: 500, marginBottom: 8 }}>
              <Trophy size={18} strokeWidth={1.5} aria-hidden="true" style={{ color: 'var(--lg-text-2)' }} /> {tt('summary_records')}
            </div>
            <ul style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {records.map((r, i) => (
                <li key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 15 }}>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {exerciseName(r.exerciseId, lang, data.customExercises)} · {tt(`record_${r.kind}` as TrainingTextKey)}
                  </span>
                  <strong style={{ flexShrink: 0, fontWeight: 500, fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>{recordValue(r, data.settings, locale)}</strong>
                </li>
              ))}
            </ul>
          </div>
        )}

        {session.exercises.map((ex, i) => {
          const info = exerciseInfo(ex.exerciseId, lang, data.customExercises)
          let n = 0
          return (
            <div key={i} style={{ padding: 12, borderRadius: 12, background: 'var(--lg-surface-2)' }}>
              <div style={{ fontSize: 17, fontWeight: 500, marginBottom: 8 }}>{info?.name ?? exerciseName(ex.exerciseId, lang, data.customExercises)}</div>
              <ol style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {ex.sets.map((set, j) => {
                  const label = set.type === 'warmup' ? tt('set_warmup_short') : set.type === 'drop' ? tt('set_drop_short') : set.type === 'failure' ? tt('set_failure_short') : String(++n)
                  return (
                    <li key={j} style={{ display: 'flex', gap: 12, fontSize: 15, fontVariantNumeric: 'tabular-nums' }}>
                      <span style={{ width: 24, fontWeight: 500, color: SET_TYPE_COLOR[set.type] }}>{label}</span>
                      <span>{previousLabel(set, info?.tracking ?? 'weight_reps', unit, locale)}</span>
                      {set.rpe != null && <span style={{ color: 'var(--lg-text-3)' }}>@{formatNumber(set.rpe, locale, 1)}</span>}
                    </li>
                  )
                })}
              </ol>
              {ex.notes && <p style={{ fontSize: 13, color: 'var(--lg-text-3)', marginTop: 8 }}>{ex.notes}</p>}
            </div>
          )
        })}
        {session.notes && <p style={{ fontSize: 15, color: 'var(--lg-text-3)' }}>{session.notes}</p>}
      </div>
    </TrainingSheet>
  )
}
