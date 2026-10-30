import { useRef, useState, type Ref } from 'react'
import { Check } from 'lucide-react'
import { hapticTick } from '../../../../lib/haptics'
import type { TrackingMode, TrainingSet, WeightUnit } from '../../types'
import { useTrainingText } from '../../i18n'
import { usesDistance, usesDuration, usesReps, usesWeight } from '../../lib/exerciseLookup'
import { formatClock, formatNumber, parseDecimal, parseStopwatchDigits, stopwatchDigits } from '../../lib/format'
import { toDisplayWeight } from '../../lib/stats'
import { TRAINING_ACCENT } from '../ui'
import { SetWheelSheet } from './SetWheelSheet'

/**
 * Eine Satzzeile im Logger: Nummer/Art · Vorher · Werte · Haken.
 *
 * Der naechste offene Satz traegt einen Ring in Akzentfarbe. Werte, die noch
 * vom Vorschlag stammen (nicht getippt, nicht abgehakt), stehen kursiv in
 * Akzentfarbe — sobald der Nutzer tippt oder abhakt, werden sie zu seinen.
 *
 * Gewicht und Wiederholungen werden nicht getippt, sondern per Rad gewaehlt
 * (`SetWheelSheet`); Distanz und Dauer bleiben Eingabefelder.
 */

export const DONE_TINT = 'rgba(48,209,88,0.16)'
const DONE_COLOR = '#30d158'

export const SET_TYPE_COLOR: Record<TrainingSet['type'], string> = {
  normal: 'var(--lg-text)',
  // Helle Varianten: lesbar auf Schwarz
  warmup: 'var(--lg-warn-text)',
  drop: '#da8fff',
  failure: 'var(--lg-bad-text)',
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

type InputKind = 'distance' | 'duration'

function editValue(kind: InputKind, set: TrainingSet, unit: WeightUnit, locale: string): string {
  if (kind === 'duration') return set.durationS == null ? '' : stopwatchDigits(set.durationS)
  return displayValue(kind, set, unit, locale)
}

function parseCell(kind: InputKind, text: string): Partial<TrainingSet> | null {
  if (kind === 'duration') return { durationS: parseStopwatchDigits(text) }
  if (!text.trim()) return { distanceM: null }
  const v = parseDecimal(text)
  return v == null || v < 0 || v > 1_000_000 ? null : { distanceM: Math.round(v) }
}

/**
 * Zahlenfeld fuer Distanz und Dauer, das waehrend der Eingabe den Text haelt
 * („12" ist noch keine fertige Dauer) und erst gueltige Werte nach oben gibt. Ohne Fokus zeigt es den
 * gespeicherten Wert; leer zeigt es grau den Wert vom letzten Mal.
 */
function Cell({ kind, set, unit, locale, placeholder, label, suggested, onChange }: {
  kind: InputKind
  set: TrainingSet
  unit: WeightUnit
  locale: string
  placeholder: string
  label: string
  /** Wert stammt noch vom Vorschlag: Akzentfarbe, leicht kursiv. */
  suggested: boolean
  onChange: (patch: Partial<TrainingSet>) => void
}) {
  const [focused, setFocused] = useState(false)
  const [text, setText] = useState('')

  return (
    <input
      className={suggested ? 'tyd-train-input sug' : 'tyd-train-input'}
      aria-label={label}
      value={focused ? text : displayValue(kind, set, unit, locale)}
      placeholder={placeholder}
      inputMode="numeric"
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
        const patch = parseCell(kind, event.target.value)
        if (patch) onChange(patch)
      }}
      style={{
        width: '100%', height: 40, borderRadius: 10, textAlign: 'center',
        fontSize: 16, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
        background: set.done ? 'transparent' : 'var(--lg-fill)',
        border: 0,
        color: suggested && !set.done ? TRAINING_ACCENT : 'var(--lg-text)', padding: '0 4px',
        transition: 'background 160ms ease-out',
      }}
    />
  )
}

/** Wert in der Zeile; tippen oeffnet die Raeder. Leer zeigt er grau den Wert vom letzten Mal. */
function ValueButton({ value, placeholder, label, done, suggested, onOpen, buttonRef }: {
  value: string
  placeholder: string
  label: string
  done: boolean
  suggested: boolean
  onOpen: () => void
  buttonRef: Ref<HTMLButtonElement>
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={onOpen}
      aria-label={value ? `${label}: ${value}` : label}
      aria-haspopup="dialog"
      className={suggested ? 'tyd-train-press tyd-train-input sug' : 'tyd-train-press tyd-train-input'}
      style={{
        width: '100%', height: 40, borderRadius: 10, textAlign: 'center',
        fontSize: 16, fontWeight: 750, fontVariantNumeric: 'tabular-nums',
        background: done ? 'transparent' : 'var(--lg-fill)',
        border: `1px solid ${done ? 'transparent' : 'var(--lg-separator)'}`,
        color: !value ? 'var(--lg-text-3)' : suggested && !done ? TRAINING_ACCENT : 'var(--lg-text)', padding: '0 4px',
        fontStyle: !value ? 'normal' : undefined,
        transition: 'background 160ms ease-out',
      }}
    >
      {value || placeholder || '–'}
    </button>
  )
}

export function SetRow({ set, number, previous, tracking, unit, isNext = false, suggested = false, onChange, onToggleDone, onOpenSetMenu }: {
  set: TrainingSet
  /** Laufende Nummer der Arbeitssaetze; Aufwaermsaetze zaehlen nicht mit. */
  number: number
  previous: TrainingSet | undefined
  tracking: TrackingMode
  unit: WeightUnit
  /** Der naechste offene Satz des Trainings: bekommt den Ring. */
  isNext?: boolean
  /** Die Werte stammen noch vom Vorschlag. */
  suggested?: boolean
  onChange: (patch: Partial<TrainingSet>) => void
  onToggleDone: () => void
  onOpenSetMenu: () => void
}) {
  const { tt, locale } = useTrainingText()
  // Der Haken federt nur beim Abhaken, nicht beim ersten Zeichnen eines schon erledigten Satzes.
  const [popping, setPopping] = useState(false)
  const [wheel, setWheel] = useState<'weight' | 'reps' | null>(null)
  const weightButton = useRef<HTMLButtonElement>(null)
  const repsButton = useRef<HTMLButtonElement>(null)
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
        boxShadow: isNext && !set.done ? `inset 0 0 0 1.5px ${TRAINING_ACCENT}99` : undefined,
        transition: 'background 160ms ease-out',
      }}
    >
      <button
        type="button"
        onClick={onOpenSetMenu}
        aria-label={`${tt('col_set')} ${label}: ${tt(`set_type_${set.type}`)}`}
        className="tyd-train-press"
        style={{ height: 36, borderRadius: 10, fontSize: 15, fontWeight: 600, color: SET_TYPE_COLOR[set.type], background: 'var(--lg-fill)' }}
      >
        {label}
      </button>
      <span style={{ fontSize: 13, color: 'var(--lg-text-3)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
        {previousLabel(previous, tracking, unit, locale)}
      </span>
      {usesWeight(tracking) && <ValueButton value={displayValue('weight', set, unit, locale)} placeholder={ph('weight')} label={weightLabel} done={set.done} suggested={suggested} onOpen={() => setWheel('weight')} buttonRef={weightButton} />}
      {usesReps(tracking) && <ValueButton value={displayValue('reps', set, unit, locale)} placeholder={ph('reps')} label={tt('col_reps')} done={set.done} suggested={suggested} onOpen={() => setWheel('reps')} buttonRef={repsButton} />}
      {usesDistance(tracking) && <Cell kind="distance" set={set} unit={unit} locale={locale} placeholder={ph('distance')} label={tt('col_distance')} suggested={suggested} onChange={onChange} />}
      {usesDuration(tracking) && <Cell kind="duration" set={set} unit={unit} locale={locale} placeholder={ph('duration')} label={tt('col_time')} suggested={suggested} onChange={onChange} />}
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
          void hapticTick()
          setPopping(!set.done)
          onToggleDone()
        }}
        onAnimationEnd={() => setPopping(false)}
        className={`tyd-train-press tyd-train-check${popping && set.done ? ' is-popping' : ''}`}
        style={{
          width: 44, height: 40, borderRadius: 12,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          background: set.done ? DONE_COLOR : 'var(--lg-fill)',
          border: 0,
          color: set.done ? '#fff' : 'var(--lg-text-3)',
        }}
      >
        <Check size={20} strokeWidth={3} aria-hidden="true" />
      </button>
      {wheel && (
        <SetWheelSheet
          title={`${tt('col_set')} ${label}`}
          previousText={previous ? previousLabel(previous, tracking, unit, locale) : undefined}
          set={set}
          previous={previous}
          tracking={tracking}
          unit={unit}
          weightLabel={weightLabel}
          focus={wheel}
          onClose={(patch, markDone) => {
            // Fokus zurueck auf den Wert, von dem aus geoeffnet wurde.
            const opener = wheel === 'weight' ? weightButton : repsButton
            opener.current?.focus({ preventScroll: true })
            setWheel(null)
            if (patch) onChange(patch)
            if (markDone) {
              void hapticTick()
              setPopping(true)
              onToggleDone()
            }
          }}
        />
      )}
    </div>
  )
}
