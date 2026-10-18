import { useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import type { SessionKind, TrainingSession } from '../types'
import { SESSION_KINDS } from '../types'
import { useTrainingText, type TrainingTextKey } from '../i18n'
import { sessionKcal } from '../lib/energy'
import { parseDecimal } from '../lib/format'
import { Button, Chip, Field, KIND_STYLE, TrainingSheet, inputStyle } from './ui'

/**
 * Eine Aktivitaet ohne Saetze eintragen: Lauf, Radtour, Fussball, Yoga.
 * Fuer Krafttraining gibt es den Logger; hier reicht Art, Zeit, Dauer.
 */

const DISTANCE_KINDS = new Set<SessionKind>(['run', 'cycle', 'swim', 'row', 'walk', 'hike'])
const QUICK_KINDS = SESSION_KINDS.filter(k => k !== 'strength')

function localInputValue(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function QuickLogSheet({ session, bodyWeightKg, onSave, onDelete, onClose }: {
  /** Gesetzt = bearbeiten. */
  session?: TrainingSession | null
  bodyWeightKg: number | null
  onSave: (session: Omit<TrainingSession, 'id'> & { id?: string }) => Promise<unknown>
  onDelete?: () => Promise<void>
  onClose: () => void
}) {
  const { tt } = useTrainingText()
  const [kind, setKind] = useState<SessionKind>(session?.kind ?? 'run')
  const [when, setWhen] = useState(() => localInputValue(session?.startedAt ?? new Date(Date.now() - 45 * 60000).toISOString()))
  const [minutes, setMinutes] = useState(session?.durationS ? String(Math.round(session.durationS / 60)) : '')
  const [km, setKm] = useState(session?.distanceM ? String(Math.round(session.distanceM / 10) / 100) : '')
  const [kcal, setKcal] = useState(session?.kcal != null ? String(session.kcal) : '')
  const [avgHr, setAvgHr] = useState(session?.avgHr != null ? String(session.avgHr) : '')
  const [rpe, setRpe] = useState<number | null>(session?.rpe ?? null)
  const [title, setTitle] = useState(session?.title ?? '')
  const [busy, setBusy] = useState(false)

  const draft = useMemo((): Omit<TrainingSession, 'id'> | null => {
    const durationMin = parseDecimal(minutes)
    if (durationMin == null || durationMin <= 0 || durationMin > 2880) return null
    const startedAt = new Date(when)
    if (Number.isNaN(startedAt.getTime())) return null
    const durationS = Math.round(durationMin * 60)
    const distanceKm = DISTANCE_KINDS.has(kind) ? parseDecimal(km) : null
    const kcalValue = parseDecimal(kcal)
    const hr = parseDecimal(avgHr)
    return {
      kind,
      title: title.trim(),
      startedAt: startedAt.toISOString(),
      endedAt: new Date(startedAt.getTime() + durationS * 1000).toISOString(),
      durationS,
      distanceM: distanceKm != null && distanceKm > 0 ? Math.round(distanceKm * 1000) : null,
      kcal: kcalValue != null && kcalValue > 0 ? Math.round(kcalValue) : null,
      avgHr: hr != null && hr >= 20 && hr <= 250 ? Math.round(hr) : null,
      rpe,
      notes: session?.notes ?? null,
      routineId: null,
      exercises: session?.exercises ?? [],
      source: session?.source ?? 'manual',
      externalId: session?.externalId ?? null,
    }
  }, [kind, when, minutes, km, kcal, avgHr, rpe, title, session])

  const estimate = draft && draft.kcal == null ? sessionKcal({ id: '', ...draft }, bodyWeightKg) : 0

  const save = async () => {
    if (!draft) { toast.error(tt('quick_duration_required')); return }
    setBusy(true)
    try {
      await onSave(session ? { ...draft, id: session.id } : draft)
      toast.success(tt('saved'))
      onClose()
    } catch {
      toast.error(tt('save_error'))
      setBusy(false)
    }
  }

  return (
    <TrainingSheet
      title={session ? tt('quick_edit_title') : tt('quick_title')}
      onClose={onClose}
      busy={busy}
      tall
      footer={
        <div style={{ display: 'flex', gap: 8 }}>
          {session && onDelete && (
            <Button
              tone="danger"
              disabled={busy}
              onClick={async () => {
                if (!window.confirm(tt('session_delete_confirm'))) return
                setBusy(true)
                try { await onDelete(); onClose() } catch { toast.error(tt('delete_error')); setBusy(false) }
              }}
            >
              {tt('delete')}
            </Button>
          )}
          <Button block disabled={busy || !draft} onClick={save}>{busy ? tt('saving') : tt('save')}</Button>
        </div>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Field group label={tt('quick_kind')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {QUICK_KINDS.map(k => (
              <Chip key={k} active={kind === k} color={KIND_STYLE[k].color} onClick={() => setKind(k)}>
                {tt(`kind_${k}` as TrainingTextKey)}
              </Chip>
            ))}
          </div>
        </Field>
        <Field label={tt('quick_when')}>
          <input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} style={inputStyle} />
        </Field>
        <div style={{ display: 'grid', gridTemplateColumns: DISTANCE_KINDS.has(kind) ? '1fr 1fr' : '1fr', gap: 12 }}>
          <Field label={tt('quick_duration')}>
            <input inputMode="numeric" value={minutes} onChange={e => setMinutes(e.target.value)} style={inputStyle} />
          </Field>
          {DISTANCE_KINDS.has(kind) && (
            <Field label={tt('quick_distance')}>
              <input inputMode="decimal" value={km} onChange={e => setKm(e.target.value)} style={inputStyle} />
            </Field>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label={tt('quick_kcal')} hint={estimate > 0 ? tt('quick_kcal_estimate', { kcal: estimate }) : undefined}>
            <input inputMode="numeric" value={kcal} onChange={e => setKcal(e.target.value)} style={inputStyle} />
          </Field>
          <Field label={tt('quick_avg_hr')}>
            <input inputMode="numeric" value={avgHr} onChange={e => setAvgHr(e.target.value)} style={inputStyle} />
          </Field>
        </div>
        <Field group label={tt('quick_rpe')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map(v => (
              <Chip key={v} active={rpe === v} onClick={() => setRpe(rpe === v ? null : v)}>{v}</Chip>
            ))}
          </div>
        </Field>
        <Field label={tt('quick_title_label')}>
          <input value={title} onChange={e => setTitle(e.target.value)} maxLength={80} style={inputStyle} />
        </Field>
      </div>
    </TrainingSheet>
  )
}
