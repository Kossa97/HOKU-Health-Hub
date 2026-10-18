import { useState } from 'react'
import { ArrowDown, ArrowUp, Link2, MoreHorizontal, Plus, StickyNote, Timer, Trash2, Weight } from 'lucide-react'
import type { SessionExercise, TrainingSet, TrainingSettings } from '../../types'
import { useTrainingText } from '../../i18n'
import type { ExerciseInfo } from '../../lib/exerciseLookup'
import { usesDistance, usesDuration, usesReps, usesWeight } from '../../lib/exerciseLookup'
import { formatNumber, formatWeight } from '../../lib/format'
import { platesPerSide, toDisplayWeight } from '../../lib/stats'
import { Button, Chip, TrainingSheet, TRAINING_ACCENT, inputStyle } from '../ui'
import { SetRow, gridColumns } from './SetRow'

/** Eine Uebung im laufenden Training: Kopf, Spaltenkoepfe, Saetze, „+ Satz". */

const REST_OPTIONS = [0, 30, 45, 60, 90, 120, 150, 180, 240, 300]
const BARBELL_LIKE = new Set(['barbell', 'smith', 'trap_bar', 'ez_bar'])
export const SUPERSET_COLORS = ['#ff9f0a', '#64d2ff', '#bf5af2', '#30d158', '#ffd60a', '#ff453a']

export function ExerciseBlock({
  exercise, info, index, total, previous, settings, onSetChange, onToggleDone, onCycleType, onRemoveSet,
  onAddSet, onRemove, onMove, onToggleSuperset, onRest, onNotes, supersetNext,
}: {
  exercise: SessionExercise
  info: ExerciseInfo | null
  index: number
  total: number
  previous: TrainingSet[]
  settings: TrainingSettings
  onSetChange: (setIndex: number, patch: Partial<TrainingSet>) => void
  onToggleDone: (setIndex: number) => void
  onCycleType: (setIndex: number, type: TrainingSet['type']) => void
  onRemoveSet: (setIndex: number) => void
  onAddSet: () => void
  onRemove: () => void
  onMove: (delta: -1 | 1) => void
  onToggleSuperset: () => void
  onRest: (restS: number | null) => void
  onNotes: (notes: string) => void
  /** Ist die naechste Uebung schon im selben Supersatz? */
  supersetNext: boolean
}) {
  const { tt, locale } = useTrainingText()
  const [menu, setMenu] = useState(false)
  const [openSet, setOpenSet] = useState<number | null>(null)
  const [plates, setPlates] = useState(false)
  const [notesOpen, setNotesOpen] = useState(!!exercise.notes)
  const tracking = info?.tracking ?? 'weight_reps'
  const unit = settings.unit
  const groupColor = exercise.supersetGroup != null ? SUPERSET_COLORS[(exercise.supersetGroup - 1) % SUPERSET_COLORS.length] : null
  const restS = exercise.restS ?? settings.defaultRestS

  // Arbeitssaetze durchnummerieren, Aufwaermsaetze bekommen „A".
  let counter = 0
  const numbers = exercise.sets.map(s => (s.type === 'warmup' ? 0 : ++counter))
  // „Vorher" je Position: Aufwaermen gegen Aufwaermen, Arbeit gegen Arbeit.
  const prevWarm = previous.filter(s => s.type === 'warmup')
  const prevWork = previous.filter(s => s.type !== 'warmup')
  let w = 0
  let k = 0
  const previousFor = exercise.sets.map(s => (s.type === 'warmup' ? prevWarm[w++] : prevWork[k++]))

  const heaviest = Math.max(0, ...exercise.sets.map(s => s.weightKg ?? 0))

  return (
    <section
      aria-label={info?.name ?? exercise.exerciseId}
      className="lg-surface lg-flat"
      style={{
        padding: '12px 8px 10px',
        // Supersatz: ein schmaler Farbbalken innen am linken Rand
        boxShadow: groupColor ? `var(--lg-surface-shadow), inset 4px 0 0 ${groupColor}` : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 6px 8px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ fontSize: 17, fontWeight: 600, color: TRAINING_ACCENT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {info?.name ?? exercise.exerciseId}
          </h3>
          <div style={{ fontSize: 13, color: 'var(--lg-text-3)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {groupColor && <span style={{ color: groupColor, fontWeight: 600 }}>{tt('superset')}</span>}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Timer size={12} aria-hidden="true" /> {restS > 0 ? `${restS} s` : tt('rest_off')}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMenu(true)}
          aria-label={`${info?.name ?? ''} – ${tt('edit')}`}
          className="lg-icon-btn"
          style={{ color: 'var(--lg-text-2)', flexShrink: 0 }}
        >
          <span style={{ width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'var(--lg-fill)' }}>
            <MoreHorizontal size={18} aria-hidden="true" />
          </span>
        </button>
      </div>

      {notesOpen && (
        <div style={{ padding: '0 6px 8px' }}>
          <textarea
            defaultValue={exercise.notes ?? ''}
            onBlur={e => onNotes(e.target.value)}
            placeholder={tt('notes_placeholder')}
            aria-label={tt('notes')}
            rows={2}
            maxLength={500}
            style={{ ...inputStyle, minHeight: 0, resize: 'vertical' }}
          />
        </div>
      )}

      <div role="table" aria-label={info?.name}>
        <div
          role="row"
          style={{
            display: 'grid', gridTemplateColumns: gridColumns(tracking), gap: 6, padding: '0 6px 4px',
            fontSize: 12, fontWeight: 600, color: 'var(--lg-text-3)', textTransform: 'uppercase', letterSpacing: '0.02em', textAlign: 'center',
          }}
        >
          <span role="columnheader">{tt('col_set')}</span>
          <span role="columnheader">{tt('col_previous')}</span>
          {usesWeight(tracking) && <span role="columnheader">{tracking === 'assisted_reps' ? tt('assist_kg') : tracking === 'bodyweight_reps' ? tt('bodyweight_plus') : unit}</span>}
          {usesReps(tracking) && <span role="columnheader">{tt('col_reps')}</span>}
          {usesDistance(tracking) && <span role="columnheader">{tt('col_distance')}</span>}
          {usesDuration(tracking) && <span role="columnheader">{tt('col_time')}</span>}
          <span role="columnheader" aria-label={tt('mark_done')}>✓</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {exercise.sets.map((set, i) => (
            <SetRow
              key={i}
              set={set}
              number={numbers[i]}
              previous={previousFor[i]}
              tracking={tracking}
              unit={unit}
              onChange={patch => onSetChange(i, patch)}
              onToggleDone={() => onToggleDone(i)}
              onOpenSetMenu={() => setOpenSet(i)}
            />
          ))}
        </div>
      </div>

      <div style={{ padding: '8px 6px 0' }}>
        <Button tone="ghost" block onClick={onAddSet} style={{ minHeight: 40 }}>
          <Plus size={16} aria-hidden="true" /> {tt('add_set')}
        </Button>
      </div>

      {menu && (
        <TrainingSheet title={info?.name ?? ''} onClose={() => setMenu(false)} zIndex={110}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--lg-text-3)', marginBottom: 8 }}>{tt('rest_time')}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {REST_OPTIONS.map(s => (
                  <Chip key={s} active={restS === s} onClick={() => onRest(s)}>{s === 0 ? tt('rest_off') : `${s} s`}</Chip>
                ))}
              </div>
            </div>
            {/* Aktionen als gruppierte Liste wie in iOS */}
            <div className="tyd-train-menu">
            <MenuItem icon={StickyNote} label={tt('notes')} onClick={() => { setNotesOpen(true); setMenu(false) }} />
            {index < total - 1 && (
              <MenuItem icon={Link2} label={supersetNext ? tt('superset_remove') : tt('superset_with_next')} onClick={() => { onToggleSuperset(); setMenu(false) }} />
            )}
            {info && BARBELL_LIKE.has(info.equipment) && (
              <MenuItem icon={Weight} label={tt('plate_calc')} onClick={() => { setPlates(true); setMenu(false) }} />
            )}
            {index > 0 && <MenuItem icon={ArrowUp} label={tt('move_up')} onClick={() => { onMove(-1); setMenu(false) }} />}
            {index < total - 1 && <MenuItem icon={ArrowDown} label={tt('move_down')} onClick={() => { onMove(1); setMenu(false) }} />}
            <MenuItem icon={Trash2} label={tt('remove_exercise')} danger onClick={() => { onRemove(); setMenu(false) }} />
            </div>
          </div>
        </TrainingSheet>
      )}

      {openSet != null && exercise.sets[openSet] && (
        <TrainingSheet title={`${tt('col_set')} ${openSet + 1}`} onClose={() => setOpenSet(null)} zIndex={110}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(['normal', 'warmup', 'drop', 'failure'] as const).map(type => (
              <Chip
                key={type}
                active={exercise.sets[openSet].type === type}
                onClick={() => { onCycleType(openSet, type); setOpenSet(null) }}
              >
                {tt(`set_type_${type}`)}
              </Chip>
            ))}
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--lg-text-3)', marginTop: 8 }}>{tt('col_rpe')}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {[6, 7, 7.5, 8, 8.5, 9, 9.5, 10].map(rpe => (
                <Chip
                  key={rpe}
                  active={exercise.sets[openSet].rpe === rpe}
                  onClick={() => onSetChange(openSet, { rpe: exercise.sets[openSet].rpe === rpe ? null : rpe })}
                >
                  {formatNumber(rpe, locale, 1)}
                </Chip>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <Button tone="danger" block onClick={() => { onRemoveSet(openSet); setOpenSet(null) }}>
                <Trash2 size={16} aria-hidden="true" /> {tt('remove_set')}
              </Button>
            </div>
          </div>
        </TrainingSheet>
      )}

      {plates && (
        <PlateSheet targetKg={heaviest} settings={settings} onClose={() => setPlates(false)} />
      )}
    </section>
  )
}

function MenuItem({ icon: Icon, label, onClick, danger }: {
  icon: typeof Plus
  label: string
  onClick: () => void
  danger?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="tyd-train-press"
      style={{
        minHeight: 50, width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px',
        fontSize: 17, fontWeight: 400, color: danger ? 'var(--lg-bad-text)' : 'var(--lg-text)', textAlign: 'left',
      }}
    >
      <Icon size={20} aria-hidden="true" style={{ color: danger ? 'var(--lg-bad-text)' : 'var(--lg-accent-text)', flexShrink: 0 }} /> {label}
    </button>
  )
}

/** Scheibenrechner: welche Scheiben je Seite fuer das schwerste Gewicht der Uebung. */
function PlateSheet({ targetKg, settings, onClose }: { targetKg: number; settings: TrainingSettings; onClose: () => void }) {
  const { tt, locale } = useTrainingText()
  const { plates, restKg } = platesPerSide(targetKg, settings.barKg, settings.platesKg)
  const maxPlate = Math.max(...settings.platesKg, 1)
  return (
    <TrainingSheet title={`${tt('plate_calc')} · ${formatWeight(targetKg, settings.unit, locale)}`} onClose={onClose} zIndex={110}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 8 }}>
        <div style={{ fontSize: 13, color: 'var(--lg-text-3)' }}>
          {tt('plates_bar', { kg: formatWeight(settings.barKg, settings.unit, locale) })} · {tt('plates_per_side')}
        </div>
        {plates.length === 0 ? (
          <p style={{ fontSize: 15, color: 'var(--lg-text-3)' }}>{tt('plates_none')}</p>
        ) : (
          <div aria-label={plates.map(p => formatNumber(toDisplayWeight(p, settings.unit), locale, 2)).join(', ')} style={{ display: 'flex', alignItems: 'center', gap: 4, minHeight: 120 }}>
            <div style={{ width: 28, height: 10, borderRadius: 3, background: 'var(--lg-text-3)' }} />
            {plates.map((p, i) => (
              <div
                key={i}
                style={{
                  width: 22, height: 40 + 80 * (p / maxPlate), borderRadius: 5,
                  background: TRAINING_ACCENT, opacity: 0.55 + 0.45 * (p / maxPlate),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  writingMode: 'vertical-rl', fontSize: 11, fontWeight: 700, color: '#140800',
                }}
              >
                {formatNumber(toDisplayWeight(p, settings.unit), locale, 2)}
              </div>
            ))}
          </div>
        )}
        {restKg > 0 && (
          <p style={{ color: 'var(--lg-warn-text)', fontSize: 13 }}>{tt('plates_rest', { kg: formatWeight(restKg, settings.unit, locale) })}</p>
        )}
      </div>
    </TrainingSheet>
  )
}
