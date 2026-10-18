import { useState } from 'react'
import { Check } from 'lucide-react'
import type { TrackingMode, TrainingSet, WeightUnit } from '../../types'
import { useTrainingText } from '../../i18n'
import { usesDistance, usesDuration, usesReps, usesWeight } from '../../lib/exerciseLookup'
import { formatClock, formatNumber, parseDecimal, parseStopwatchDigits, stopwatchDigits } from '../../lib/format'
import { fromDisplayWeight, toDisplayWeight } from '../../lib/stats'

/** Eine Satzzeile im Logger: Nummer/Art · Vorher · Werte · Haken. */

export const DONE_TINT = 'rgba(16,185,129,0.14)'
const DONE_COLOR = '#10b981'

export const SET_TYPE_COLOR: Record<TrainingSet['type'], string> = {
  normal: 'var(--text)',
  warmup: '#f59e0b',
  drop: '#a855f7',
  failure: '#f43f5e',
}

/** Spaltenraster je Erfassungsart — Kopfzeile und Zeilen teilen es. */
export function gridColumns(tracking: TrackingMode): string {
  const cols = ['36px', 'minmax(52px, 1fr)']
  if (usesWeight(tracking)) cols.push('minmax(58px, 72px)')
  if (usesReps(tracking)) cols.push('minmax(50px, 64px)')
  if (usesDistance(tracking)) cols.push('minmax(58px, 72px)')
  if (usesDuration(tracking)) cols.push('minmax(62px, 76px)')
  cols.push('44px')
  return cols.join(' ')
}

export function previousLabel(set: TrainingSet | undefined, tracking: TrackingMode, unit: WeightUnit, locale: string): string {
  if (!set) return '—'
  const parts: string[] = []
  if (usesWeight(tracking) && set.weightKg != null) parts.push(formatNumber(toDisplayWeight(set.weightKg, unit), locale, 2))
  if (usesReps(tracking) && set.reps != null) parts.push(String(set.reps))
  if (usesDistance(tracking) && set.distanceM != null) parts.push(`${formatNumber(set.distanceM, locale, 0)} m`)
  if (usesDuration(tracking) && set.durationS != null) parts.push(formatClock(set.durationS))
  return parts.length ? parts.join(' × ') : '—'
}

type CellKind = 'weight' | 'reps' | 'distance' | 'duration'

function displayValue(kind: CellKind, set: TrainingSet, unit: WeightUnit, locale: string): string {
  switch (kind) {
    case 'weight': return set.weightKg == null ? '' : formatNumber(toDisplayWeight(set.weightKg, unit), locale, 2)
    case 'reps': return set.reps == null ? '' : String(set.reps)
    case 'distance': return set.distanceM == null ? '' : String(Math.round(set.distanceM))
    case 'duration': return set.durationS == null ? '' : formatClock(set.durationS)
  }
}

function editValue(kind: CellKind, set: TrainingSet, unit: WeightUnit, locale: string): string {
  if (kind === 'duration') return set.durationS == null ? '' : stopwatchDigits(set.durationS)
  return displayValue(kind, set, unit, locale)
}

function parseCell(kind: CellKind, text: string, unit: WeightUnit): Partial<TrainingSet> | null {
  switch (kind) {
    case 'weight': {
      if (!text.trim()) return { weightKg: null }
      const v = parseDecimal(text)
      return v == null || v < 0 || v > 2000 ? null : { weightKg: fromDisplayWeight(v, unit) }
    }
    case 'reps': {
      if (!text.trim()) return { reps: null }
      const v = parseDecimal(text)
      return v == null || v < 0 || v > 1000 ? null : { reps: Math.round(v) }
    }
    case 'distance': {
      if (!text.trim()) return { distanceM: null }
      const v = parseDecimal(text)
      return v == null || v < 0 || v > 1_000_000 ? null : { distanceM: Math.round(v) }
    }
    case 'duration':
      return { durationS: parseStopwatchDigits(text) }
  }
}

/**
 * Zahlenfeld, das waehrend der Eingabe den Text haelt („82," ist noch keine
 * Zahl) und erst gueltige Werte nach oben gibt. Ohne Fokus zeigt es den
 * gespeicherten Wert; leer zeigt es grau den Wert vom letzten Mal.
 */
function Cell({ kind, set, unit, locale, placeholder, label, onChange }: {
  kind: CellKind
  set: TrainingSet
  unit: WeightUnit
  locale: string
  placeholder: string
  label: string
  onChange: (patch: Partial<TrainingSet>) => void
}) {
  const [focused, setFocused] = useState(false)
  const [text, setText] = useState('')

  return (
    <input
      className="tyd-train-input"
      aria-label={label}
      value={focused ? text : displayValue(kind, set, unit, locale)}
      placeholder={placeholder}
      inputMode={kind === 'weight' ? 'decimal' : 'numeric'}
      enterKeyHint="done"
      autoComplete="off"
      onFocus={event => {
        setText(editValue(kind, set, unit, locale))
        setFocused(true)
        const target = event.currentTarget
        requestAnimationFrame(() => target.select())
      }}
      onBlur={() => setFocused(false)}
      onChange={event => {
        setText(event.target.value)
        const patch = parseCell(kind, event.target.value, unit)
        if (patch) onChange(patch)
      }}
      style={{
        width: '100%', height: 40, borderRadius: 10, textAlign: 'center',
        fontSize: 16, fontWeight: 750, fontVariantNumeric: 'tabular-nums',
        background: set.done ? 'transparent' : 'var(--surface-input)',
        border: `1px solid ${set.done ? 'transparent' : 'var(--border-strong)'}`,
        color: 'var(--text)', padding: '0 4px',
      }}
    />
  )
}

export function SetRow({ set, number, previous, tracking, unit, onChange, onToggleDone, onOpenSetMenu }: {
  set: TrainingSet
  /** Laufende Nummer der Arbeitssaetze; Aufwaermsaetze zaehlen nicht mit. */
  number: number
  previous: TrainingSet | undefined
  tracking: TrackingMode
  unit: WeightUnit
  onChange: (patch: Partial<TrainingSet>) => void
  onToggleDone: () => void
  onOpenSetMenu: () => void
}) {
  const { tt, locale } = useTrainingText()
  const label = set.type === 'warmup' ? tt('set_warmup_short')
    : set.type === 'drop' ? tt('set_drop_short')
    : set.type === 'failure' ? tt('set_failure_short')
    : String(number)
  const ph = (kind: CellKind) => previous ? displayValue(kind, previous, unit, locale) : ''
  const weightLabel = tracking === 'assisted_reps' ? tt('assist_kg') : tracking === 'bodyweight_reps' ? tt('bodyweight_plus') : (unit === 'kg' ? tt('col_kg') : tt('col_lb'))

  return (
    <div
      role="row"
      style={{
        display: 'grid', gridTemplateColumns: gridColumns(tracking), gap: 6, alignItems: 'center',
        padding: '4px 6px', borderRadius: 12,
        background: set.done ? DONE_TINT : 'transparent',
        transition: 'background 160ms ease-out',
      }}
    >
      <button
        type="button"
        onClick={onOpenSetMenu}
        aria-label={`${tt('col_set')} ${label}: ${tt(`set_type_${set.type}`)}`}
        className="tyd-train-press"
        style={{ height: 36, borderRadius: 10, fontWeight: 800, color: SET_TYPE_COLOR[set.type], background: 'var(--surface-raised)' }}
      >
        {label}
      </button>
      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
        {previousLabel(previous, tracking, unit, locale)}
      </span>
      {usesWeight(tracking) && <Cell kind="weight" set={set} unit={unit} locale={locale} placeholder={ph('weight')} label={weightLabel} onChange={onChange} />}
      {usesReps(tracking) && <Cell kind="reps" set={set} unit={unit} locale={locale} placeholder={ph('reps')} label={tt('col_reps')} onChange={onChange} />}
      {usesDistance(tracking) && <Cell kind="distance" set={set} unit={unit} locale={locale} placeholder={ph('distance')} label={tt('col_distance')} onChange={onChange} />}
      {usesDuration(tracking) && <Cell kind="duration" set={set} unit={unit} locale={locale} placeholder={ph('duration')} label={tt('col_time')} onChange={onChange} />}
      <button
        type="button"
        role="checkbox"
        aria-checked={set.done}
        aria-label={tt('mark_done')}
        onClick={() => {
          // Leere Felder uebernehmen beim Abhaken den Wert vom letzten Mal — wie bei Hevy.
          if (!set.done && previous) {
            const fill: Partial<TrainingSet> = {}
            if (usesWeight(tracking) && set.weightKg == null && previous.weightKg != null) fill.weightKg = previous.weightKg
            if (usesReps(tracking) && set.reps == null && previous.reps != null) fill.reps = previous.reps
            if (usesDistance(tracking) && set.distanceM == null && previous.distanceM != null) fill.distanceM = previous.distanceM
            if (usesDuration(tracking) && set.durationS == null && previous.durationS != null) fill.durationS = previous.durationS
            if (Object.keys(fill).length) onChange(fill)
          }
          onToggleDone()
        }}
        className="tyd-train-press"
        style={{
          width: 44, height: 40, borderRadius: 12,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: set.done ? DONE_COLOR : 'var(--surface-raised)',
          border: `1px solid ${set.done ? DONE_COLOR : 'var(--border-strong)'}`,
          color: set.done ? '#04140d' : 'var(--text-muted)',
        }}
      >
        <Check size={20} strokeWidth={3} aria-hidden="true" />
      </button>
    </div>
  )
}
