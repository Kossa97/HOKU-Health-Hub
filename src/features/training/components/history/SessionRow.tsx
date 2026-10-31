import { Trophy } from 'lucide-react'
import type { TrainingSession } from '../../types'
import { useTrainingText, type TrainingTextKey } from '../../i18n'
import type { TrainingData } from '../../hooks/useTrainingData'
import { formatDate, formatDistance, formatDuration, formatVolume } from '../../lib/format'
import { sessionDurationS, sessionVolumeKg } from '../../lib/stats'
import { Card, KindBadge } from '../ui'

/** Eine Einheit als Zeile: Art, Titel, Datum, Dauer und das Wichtigste dazu. */
export function SessionRow({ session, data, recordCount = 0, onOpen }: {
  session: TrainingSession
  data: TrainingData
  recordCount?: number
  onOpen: () => void
}) {
  const { tt, locale } = useTrainingText()
  const duration = sessionDurationS(session)
  const volume = sessionVolumeKg(session)
  const details = [
    formatDate(session.startedAt, locale, { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
    duration > 0 ? formatDuration(duration, tt('min')) : null,
    session.distanceM ? formatDistance(session.distanceM, locale) : null,
    volume > 0 ? formatVolume(volume, data.settings.unit, locale) : null,
  ].filter(Boolean).join(' · ')

  return (
    <Card onClick={onOpen} style={{ padding: '12px 16px' }} ariaLabel={[session.title || tt(`kind_${session.kind}` as TrainingTextKey), details, recordCount > 0 ? tt('session_records', { count: recordCount }) : null].filter(Boolean).join(', ')}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <KindBadge kind={session.kind} size={36} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {session.title || tt(`kind_${session.kind}` as TrainingTextKey)}
          </div>
          <div style={{ fontSize: 13, color: 'var(--lg-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {details}
          </div>
        </div>
        {recordCount > 0 && (
          <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--lg-text-2)', fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', fontSize: 13, flexShrink: 0 }}>
            <Trophy size={16} strokeWidth={1.5} aria-hidden="true" /> {recordCount}
          </span>
        )}
      </div>
    </Card>
  )
}
