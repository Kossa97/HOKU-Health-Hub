import { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, RotateCcw } from 'lucide-react'
import { hapticTick } from '../../../../lib/haptics'
import type { TrackingMode, TrainingSet, WeightUnit } from '../../types'
import { useTrainingText } from '../../i18n'
import { usesReps, usesWeight } from '../../lib/exerciseLookup'
import { draftPatch, FRACTIONS, REPS_MAX, toDraft, WEIGHT_MAX, type Draft, type WheelField } from '../../lib/setWheel'
import { WheelPicker } from './WheelPicker'
import { WHEEL_HEIGHT, WHEEL_ITEM_H } from './wheelGeometry'

/**
 * Satz per Rad eintragen: Wiederholungen × Gewicht (ganze Zahl + Nachkomma).
 *
 * Was gedreht wird, gilt — auch beim Zuklappen (Chevron, Hintergrund,
 * Escape). Geschrieben wird nur das Feld, an dem gedreht wurde: ein
 * vorhandener Wert bleibt, wie er ist (auch 82,4 kg oder 150 Wdh., die das Rad
 * nicht genau trifft). Der runde Haken hakt ab und fuellt dabei leere Felder
 * mit dem, was das Rad zeigt. „Wie letztes Mal" dreht beide Raeder auf die
 * letzte Einheit.
 */

const DONE_COLOR = '#10b981'

export function SetWheelSheet({ title, previousText, set, previous, tracking, unit, weightLabel, focus, onClose }: {
  title: string
  /** Werte der letzten Einheit, etwa „80 × 5"; steht auf dem Knopf „Wie letztes Mal". */
  previousText?: string
  set: TrainingSet
  previous: TrainingSet | undefined
  tracking: TrackingMode
  unit: WeightUnit
  /** Kopf ueber dem Gewichtsrad: kg, lb, „+kg" oder „Hilfe kg". */
  weightLabel: string
  /** Welches Rad den Fokus bekommt. */
  focus: 'weight' | 'reps'
  /** `patch` null = nichts zu schreiben; `markDone` = runder Haken. */
  onClose: (patch: Partial<TrainingSet> | null, markDone: boolean) => void
}) {
  const { tt, locale } = useTrainingText()
  const titleId = useId()
  // Ohne Wert und ohne Vorher: Leerstange (20 kg) bzw. 0 bei Zusatz- und Hilfsgewicht.
  const fallbackKg = tracking === 'weight_reps' ? 20 : 0
  const initial = useMemo(
    () => toDraft(set.weightKg ?? previous?.weightKg, set.reps ?? previous?.reps, unit, fallbackKg),
    // Nur beim Oeffnen: danach gehoert das Rad dem Nutzer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const [draft, setDraft] = useState(initial)
  const [turned, setTurned] = useState<ReadonlySet<WheelField>>(() => new Set())
  const update = useCallback((patch: Partial<Draft>) => {
    setDraft(d => ({ ...d, ...patch }))
    setTurned(t => {
      const next = new Set(t)
      if ('reps' in patch) next.add('reps')
      if ('whole' in patch || 'frac' in patch) next.add('weight')
      return next
    })
  }, [])

  const close = useCallback((markDone: boolean) => {
    onClose(draftPatch(draft, turned, set, markDone, tracking, unit), markDone)
  }, [draft, turned, set, onClose, tracking, unit])

  useEffect(() => {
    // Capture-Phase und stopImmediatePropagation: nur dieses Sheet schliesst,
    // nicht auch das Training oder ein Sheet darunter.
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.stopImmediatePropagation(); close(false) }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [close])

  const fractions = FRACTIONS[unit]
  const sep = useMemo(() => new Intl.NumberFormat(locale).format(1.5).charAt(1), [locale])
  const formatReps = useCallback((i: number) => String(i), [])
  const formatWhole = useCallback((i: number) => String(i), [])
  const formatFrac = useCallback((i: number) => `${sep}${String(Math.round(fractions[i] * 100)).padStart(2, '0')}`, [fractions, sep])

  const withWeight = usesWeight(tracking)
  const withReps = usesReps(tracking)
  const canRepeat = previous != null && (previous.weightKg != null || previous.reps != null)

  return createPortal(
    <div
      data-app-modal
      onClick={() => close(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={event => event.stopPropagation()}
        className="tyd-train-sheet"
        style={{
          width: '100%', maxWidth: 560,
          background: 'var(--app-bg)', color: 'var(--text)',
          borderTopLeftRadius: 24, borderTopRightRadius: 24,
          border: '1px solid var(--border-strong)', borderBottom: 'none',
          boxShadow: '0 -12px 48px rgba(0,0,0,0.5)',
          padding: '8px 16px calc(14px + env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div aria-hidden="true" style={{ width: 36, height: 5, borderRadius: 3, background: 'var(--border-strong)', margin: '0 auto 8px' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            type="button"
            onClick={() => close(false)}
            aria-label={tt('close')}
            className="tyd-train-press"
            style={{ width: 40, height: 40, borderRadius: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-raised)', color: 'var(--text-dim)', flexShrink: 0 }}
          >
            <ChevronDown size={22} aria-hidden="true" />
          </button>
          <h2 id={titleId} style={{ flex: 1, minWidth: 0, fontSize: '1.05rem', fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</h2>
          <button
            type="button"
            onClick={() => close(!set.done)}
            aria-label={set.done ? tt('wheel_save') : tt('wheel_save_done')}
            className="tyd-train-press"
            style={{ width: 48, height: 48, borderRadius: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: DONE_COLOR, color: '#04140d', boxShadow: `0 6px 18px ${DONE_COLOR}55`, flexShrink: 0 }}
          >
            <Check size={24} strokeWidth={3} aria-hidden="true" />
          </button>
        </div>

        {canRepeat && (
          <button
            type="button"
            onClick={() => {
              void hapticTick()
              update(toDraft(previous.weightKg, previous.reps, unit, fallbackKg))
            }}
            className="tyd-train-press"
            style={{
              marginTop: 10, height: 34, maxWidth: '100%', padding: '0 12px', borderRadius: 17,
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'var(--surface-raised)', color: 'var(--text)', fontWeight: 700, fontSize: '0.82rem',
              fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden',
            }}
          >
            <RotateCcw size={14} aria-hidden="true" style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {tt('wheel_same_as_last')}{previousText ? <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}> · {previousText}</span> : null}
            </span>
          </button>
        )}

        <div style={{ display: 'flex', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'center', marginTop: 14 }}>
          {withReps && <span style={{ flex: 1 }}>{tt('col_reps')}</span>}
          {withReps && withWeight && <span style={{ width: 28 }} />}
          {withWeight && <span style={{ flex: 1.6 }}>{weightLabel}</span>}
        </div>

        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', marginTop: 4 }}>
          {/* Auswahlband hinter den Raedern, wie die Lupe bei iOS */}
          <div
            aria-hidden="true"
            style={{
              position: 'absolute', left: 0, right: 0, top: (WHEEL_HEIGHT - WHEEL_ITEM_H) / 2, height: WHEEL_ITEM_H,
              borderRadius: 10, background: 'var(--surface-raised)', pointerEvents: 'none',
            }}
          />
          {withReps && (
            <div className="tyd-wheel-wrap" style={{ flex: 1, position: 'relative' }}>
              <WheelPicker count={REPS_MAX + 1} index={draft.reps} onChange={i => update({ reps: i })} format={formatReps} label={tt('col_reps')} autoFocus={focus === 'reps' || !withWeight} />
            </div>
          )}
          {withReps && withWeight && (
            <span aria-hidden="true" style={{ width: 28, textAlign: 'center', position: 'relative', fontSize: 18, fontWeight: 700, color: 'var(--text-muted)' }}>×</span>
          )}
          {withWeight && (
            <div style={{ flex: 1.6, position: 'relative', display: 'flex', alignItems: 'center' }}>
              <div className="tyd-wheel-wrap" style={{ flex: 1 }}>
                <WheelPicker count={WEIGHT_MAX[unit] + 1} index={draft.whole} onChange={i => update({ whole: i })} format={formatWhole} label={weightLabel} align="right" autoFocus={focus === 'weight'} />
              </div>
              <div className="tyd-wheel-wrap" style={{ width: 64 }}>
                <WheelPicker count={fractions.length} index={draft.frac} onChange={i => update({ frac: i })} format={formatFrac} numberAt={i => fractions[i]} label={`${weightLabel} ${tt('wheel_decimals')}`} align="left" />
              </div>
              <span aria-hidden="true" style={{ width: 30, fontSize: 15, fontWeight: 700, color: 'var(--text-muted)' }}>{unit}</span>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
