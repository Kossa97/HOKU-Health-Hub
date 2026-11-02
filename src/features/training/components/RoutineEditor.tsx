import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { ArrowDown, ArrowRightLeft, ArrowUp, Check, ClipboardPaste, Copy, CopyPlus, GripVertical, Link2, MoreHorizontal, Play, Plus, Star, StickyNote, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { ROUTINE_FOLDER_MAX, type RoutineExercise, type RoutineSet, type SetType, type TrackingMode, type TrainingRoutine } from '../types'
import { useTrainingText, type TrainingTextKey } from '../i18n'
import type { TrainingData } from '../hooks/useTrainingData'
import { exerciseInfo, usesDistance, usesDuration, usesReps, usesWeight } from '../lib/exerciseLookup'
import { formatClock, formatNumber, parseClock, parseDecimal, parseStopwatchDigits } from '../lib/format'
import { fromDisplayWeight, toDisplayWeight } from '../lib/stats'
import { routineSetsPerMuscle, sortedMuscles, weeklySetsPerMuscle } from '../lib/muscleVolume'
import { migrateRepsRange } from '../lib/repsRange'
import { toggleSupersetAt } from '../lib/supersets'
import { duplicateSelected, pickSelected, withoutSelected } from '../lib/exerciseSelection'
import { clipboardCopies, copyToClipboard, useExerciseClipboard } from '../lib/exerciseClipboard'
import { ExercisePicker } from './ExercisePicker'
import { SUPERSET_COLORS } from './live/ExerciseBlock'
import { Button, Chip, SelectCircle, TrainingSheet, TRAINING_ACCENT, inputStyle } from './ui'
import { MuscleBars } from './plan/MuscleVolume'
import { useDragReorder } from './plan/useDragReorder'

/**
 * Routine anlegen oder bearbeiten: Name, Plan (Ordner), Wochentage, Uebungen
 * mit Satzzeilen (Wdh.-Bereich, Startgewicht, Ziel-RPE, Satzart), Pause,
 * Supersatz, Notiz. Gespeichert wird implizit beim Schliessen — es gibt keinen
 * Speichern-Knopf; nur wenn sich etwas geaendert hat, wird geschrieben.
 *
 * Mehrfachauswahl („Auswaehlen" oder lange auf eine Uebung druecken): die
 * markierten Uebungen kopieren (in die Ablage, einfuegen in jedem Workout),
 * in ein anderes Workout verschieben, duplizieren oder loeschen. Kopierte und
 * verschobene Uebungen behalten alle Werte; neu aus dem Katalog hinzugefuegte
 * kommen leer.
 */

/** So lange druecken, bis die Auswahl beginnt (wie in iOS-Listen). */
const LONG_PRESS_MS = 450

const REST_OPTIONS = [60, 90, 120, 180]
const TYPE_ORDER: SetType[] = ['normal', 'warmup', 'drop', 'failure']
const TYPE_COLOR: Record<SetType, string> = { normal: 'var(--lg-text)', warmup: '#f59e0b', drop: '#a855f7', failure: '#f43f5e' }
const MAX_SETS = 20

type Column = 'type' | 'min' | 'dash' | 'max' | 'duration' | 'distance' | 'weight' | 'rpe'
const COLUMN_WIDTH: Record<Column, string> = {
  type: '34px', min: 'minmax(0, 1fr)', dash: '10px', max: 'minmax(0, 1fr)',
  duration: 'minmax(0, 1.3fr)', distance: 'minmax(0, 1.2fr)', weight: 'minmax(0, 1.2fr)', rpe: 'minmax(0, 0.9fr)',
}

/** Welche Spalten eine Satzzeile hat, haengt an der Erfassungsart der Uebung. */
function columnsFor(tracking: TrackingMode | null): Column[] {
  const t = tracking ?? 'weight_reps'
  const cols: Column[] = ['type']
  if (usesReps(t)) cols.push('min', 'dash', 'max')
  if (usesDuration(t)) cols.push('duration')
  if (usesDistance(t)) cols.push('distance')
  if (usesWeight(t)) cols.push('weight')
  cols.push('rpe')
  return cols
}

type Draft = Omit<TrainingRoutine, 'id'> & { id?: string }

/** Vergleichsgrundlage fuer „hat sich etwas geaendert?" — nur die gespeicherten Felder. */
const serialize = (draft: Draft) => JSON.stringify({
  name: draft.name, kind: draft.kind, weekdays: draft.weekdays, exercises: draft.exercises, folder: draft.folder, sortOrder: draft.sortOrder,
})

export function RoutineEditor({ routine, data, onClose, onStart }: {
  routine: Draft | null
  data: TrainingData
  onClose: () => void
  /** Speichert und startet die Routine; ohne diese Funktion gibt es keinen Start-Knopf. */
  onStart?: (routine: TrainingRoutine) => void
}) {
  const { tt, lang, locale } = useTrainingText()
  const [name, setName] = useState(routine?.name ?? '')
  const [folder, setFolder] = useState<string | null>(routine?.folder ?? null)
  const [newFolder, setNewFolder] = useState(false)
  const [weekdays, setWeekdays] = useState<number[]>(routine?.weekdays ?? [])
  const [exercises, setExercises] = useState<RoutineExercise[]>(routine?.exercises ?? [])
  const [openNotes, setOpenNotes] = useState<number[]>([])
  const [menu, setMenu] = useState<number | null>(null)
  const [picker, setPicker] = useState(false)
  const [busy, setBusy] = useState(false)
  const [selecting, setSelecting] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  const [moveOpen, setMoveOpen] = useState(false)
  const clipboard = useExerciseClipboard()
  const pressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const pressStart = useRef<{ x: number; y: number } | null>(null)
  /** Nach dem langen Druecken: der Klick beim Loslassen darf die erste Wahl nicht gleich wieder aufheben. */
  const ignoreClick = useRef(false)
  const kind = routine?.kind ?? 'strength'
  const unit = data.settings.unit

  const initial = useRef(routine ? serialize(routine) : null)

  const folders = useMemo(() => {
    const seen: string[] = []
    for (const r of data.routines) if (r.folder && !seen.includes(r.folder)) seen.push(r.folder)
    if (folder && !seen.includes(folder)) seen.push(folder)
    return seen
  }, [data.routines, folder])

  const info = useCallback((id: string) => exerciseInfo(id, lang, data.customExercises), [lang, data.customExercises])

  // ── Speichern ──────────────────────────────────────────────────────────────

  const build = (): Draft => ({
    ...(routine?.id ? { id: routine.id } : {}),
    name: name.trim() || tt('routine_default_name', { n: data.routines.length + 1 }),
    kind,
    weekdays,
    exercises,
    sortOrder: routine?.sortOrder ?? data.routines.length,
    folder: folder?.trim().slice(0, ROUTINE_FOLDER_MAX) || null,
  })

  /** Speichert, wenn noetig; liefert die gespeicherte Routine oder null, wenn nichts zu speichern war. */
  const persist = async (): Promise<TrainingRoutine | null> => {
    const next = build()
    const untouchedNew = routine == null && !name.trim() && exercises.length === 0
    if (untouchedNew) return null
    if (routine?.id && serialize(next) === initial.current) return null
    const saved = await data.saveRoutine(next)
    initial.current = serialize(saved)
    toast.success(tt('saved'))
    return saved
  }

  const close = async () => {
    if (busy) return
    setBusy(true)
    try { await persist(); onClose() } catch { toast.error(tt('save_error')); setBusy(false) }
  }

  const start = async () => {
    if (busy || !onStart) return
    setBusy(true)
    try {
      const saved = (await persist()) ?? data.routines.find(r => r.id === routine?.id) ?? null
      if (!saved) { setBusy(false); return }
      onClose()
      onStart(saved)
    } catch { toast.error(tt('save_error')); setBusy(false) }
  }

  const remove = async () => {
    if (!routine?.id || !window.confirm(tt('routine_delete_confirm', { name: routine.name }))) return
    setBusy(true)
    try { await data.removeRoutine(routine.id); toast.success(tt('deleted')); onClose() } catch { toast.error(tt('delete_error')); setBusy(false) }
  }

  // ── Uebungen ───────────────────────────────────────────────────────────────

  const updateExercise = (index: number, fn: (ex: RoutineExercise) => RoutineExercise) =>
    setExercises(prev => prev.map((ex, i) => (i === index ? fn(ex) : ex)))

  const updateSet = (index: number, setIndex: number, patch: Partial<RoutineSet>) =>
    updateExercise(index, ex => ({ ...ex, sets: ex.sets.map((s, j) => (j === setIndex ? { ...s, ...patch } : s)) }))

  const cycleType = (index: number, setIndex: number) =>
    updateExercise(index, ex => ({
      ...ex,
      sets: ex.sets.map((s, j) => (j === setIndex ? { ...s, type: TYPE_ORDER[(TYPE_ORDER.indexOf(s.type) + 1) % TYPE_ORDER.length] } : s)),
    }))

  const addSet = (index: number) => updateExercise(index, ex => {
    if (ex.sets.length >= MAX_SETS) return ex
    const last = ex.sets[ex.sets.length - 1]
    return { ...ex, sets: [...ex.sets, { ...(last ?? {}), type: 'normal' }] }
  })

  const removeSet = (index: number) => updateExercise(index, ex => (ex.sets.length > 1 ? { ...ex, sets: ex.sets.slice(0, -1) } : ex))

  const cycleRest = (index: number) => updateExercise(index, ex => {
    const current = ex.restS ?? data.settings.defaultRestS
    return { ...ex, restS: REST_OPTIONS.find(v => v > current) ?? REST_OPTIONS[0] }
  })

  // Dieselbe Regel wie im Logger (`lib/supersets.ts`).
  const toggleSuperset = (index: number) => setExercises(prev => toggleSupersetAt(prev, index))

  /**
   * Eine Grenze des Wdh.-Bereichs setzen. Steht am Satz noch die v1-Zahl `reps`,
   * wird sie erst in beide Grenzen uebernommen, damit die andere nicht verloren geht.
   */
  const commitRepsBound = (index: number, setIndex: number, bound: 'repsMin' | 'repsMax', value: number | null) =>
    updateExercise(index, ex => ({
      ...ex,
      sets: ex.sets.map((s, j) => j === setIndex ? { ...s, ...migrateRepsRange(s), [bound]: value, reps: null } : s),
    }))

  const move = useCallback((from: number, to: number) => {
    setExercises(prev => {
      if (to < 0 || to >= prev.length || from === to) return prev
      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
    setOpenNotes([])
  }, [])

  const undoToast = (message: string, snapshot: RoutineExercise[]) =>
    toast(t => (
      <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span>{message}</span>
        <button
          type="button"
          onClick={() => { setExercises(snapshot); toast.dismiss(t.id) }}
          className="tyd-train-press"
          style={{ color: TRAINING_ACCENT, fontWeight: 800, minHeight: 32, padding: '0 6px' }}
        >
          {tt('undo')}
        </button>
      </span>
    ), { duration: 6000 })

  const removeExercise = (index: number) => {
    const snapshot = exercises
    setExercises(prev => prev.filter((_, i) => i !== index))
    setOpenNotes([])
    undoToast(tt('exercise_removed'), snapshot)
  }

  // ── Mehrfachauswahl ────────────────────────────────────────────────────────

  const what = (count: number) => tt('exercises_n', { count })
  const allSelected = exercises.length > 0 && selected.length === exercises.length

  const startSelect = (index?: number) => {
    setMenu(null)
    setSelecting(true)
    setSelected(index == null ? [] : [index])
  }
  const stopSelect = () => { setSelecting(false); setSelected([]) }
  const toggleSelected = (index: number) => {
    if (ignoreClick.current) return
    setSelected(prev => (prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]))
  }

  // Lange druecken auf den Kopf einer Uebung beginnt die Auswahl. Wer dabei
  // scrollt (Finger wandert), bricht ab.
  const swallowClick = () => {
    ignoreClick.current = true
    setTimeout(() => { ignoreClick.current = false }, 500)
  }
  const cancelPress = () => { clearTimeout(pressTimer.current); pressStart.current = null }
  const pressProps = (index: number) => ({
    onPointerDown: (event: ReactPointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      pressStart.current = { x: event.clientX, y: event.clientY }
      clearTimeout(pressTimer.current)
      pressTimer.current = setTimeout(() => { pressStart.current = null; swallowClick(); startSelect(index) }, LONG_PRESS_MS)
    },
    onPointerMove: (event: ReactPointerEvent) => {
      const start = pressStart.current
      if (start && Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) cancelPress()
    },
    onPointerUp: cancelPress,
    onPointerCancel: cancelPress,
    onPointerLeave: cancelPress,
    // Rechtsklick bzw. das Kontextmenue beim langen Druecken: stattdessen auswaehlen
    onContextMenu: (event: ReactMouseEvent) => {
      event.preventDefault()
      cancelPress()
      if (!selecting) { swallowClick(); startSelect(index) }
    },
  })
  useEffect(() => () => clearTimeout(pressTimer.current), [])

  const copySelected = () => {
    const count = selected.length
    copyToClipboard(pickSelected(exercises, selected))
    stopSelect()
    toast.success(tt('clip_copied', { what: what(count) }))
  }

  const duplicateSel = () => {
    const count = selected.length
    const snapshot = exercises
    setExercises(prev => duplicateSelected(prev, selected))
    setOpenNotes([])
    stopSelect()
    undoToast(tt('duplicated', { what: what(count) }), snapshot)
  }

  const deleteSelected = () => {
    const count = selected.length
    const snapshot = exercises
    setExercises(prev => withoutSelected(prev, selected))
    setOpenNotes([])
    stopSelect()
    undoToast(tt('removed_n', { what: what(count) }), snapshot)
  }

  const paste = () => {
    const copies = clipboardCopies()
    if (copies.length === 0) return
    setExercises(prev => [...prev, ...copies])
    toast.success(tt('clip_pasted', { what: what(copies.length) }))
  }

  // Ziele zum Verschieben: alle anderen Workouts, nach Plan gruppiert.
  const moveTargets = useMemo(() => {
    const groups = new Map<string | null, TrainingRoutine[]>()
    for (const r of data.routines) {
      if (r.id === routine?.id) continue
      const list = groups.get(r.folder) ?? []
      list.push(r)
      groups.set(r.folder, list)
    }
    return [...groups.entries()].sort(([a], [b]) => (a == null ? 1 : b == null ? -1 : a.localeCompare(b)))
  }, [data.routines, routine?.id])

  // Beide Workouts werden sofort gespeichert: erst das Ziel, dann dieses ohne
  // die Uebungen. Klappt das zweite nicht, wird das Ziel zurueckgesetzt — so
  // liegt eine Uebung nie in beiden.
  const moveTo = async (target: TrainingRoutine) => {
    const moving = pickSelected(exercises, selected)
    const remaining = withoutSelected(exercises, selected)
    const count = moving.length
    setBusy(true)
    try {
      await data.saveRoutine({ ...target, exercises: [...target.exercises, ...moving] })
      if (routine?.id) {
        try {
          const saved = await data.saveRoutine({ ...build(), exercises: remaining })
          initial.current = serialize(saved)
        } catch (error) {
          await data.saveRoutine(target).catch(() => {})
          throw error
        }
      }
      setExercises(remaining)
      setOpenNotes([])
      setMoveOpen(false)
      stopSelect()
      toast.success(tt('moved_to', { what: what(count), name: target.name }))
    } catch {
      toast.error(tt('save_error'))
    } finally {
      setBusy(false)
    }
  }

  const drag = useDragReorder<HTMLUListElement>(move)

  // ── Saetze je Muskel ───────────────────────────────────────────────────────

  const times = Math.max(1, weekdays.length)
  const muscleRows = useMemo(() => {
    const own = routineSetsPerMuscle(exercises, info)
    const others = folder ? data.routines.filter(r => r.id !== routine?.id && r.folder === folder) : []
    const weekly = weeklySetsPerMuscle([...others, { exercises, weekdays }], info)
    return sortedMuscles(own).map(row => {
      const week = weekly.get(row.muscle) ?? 0
      return { muscle: row.muscle, week, label: tt('muscle_sets_week', { sets: formatNumber(row.sets, locale, 1), week: formatNumber(week, locale, 1) }) }
    })
  }, [exercises, weekdays, folder, info, data.routines, routine?.id, tt, locale])

  // ── Darstellung ────────────────────────────────────────────────────────────

  if (picker) {
    return (
      <ExercisePicker
        sessions={data.sessions}
        customExercises={data.customExercises}
        favorites={data.settings.favoriteExercises}
        onToggleFavorite={data.toggleFavorite}
        onAddCustom={data.addCustomExercise}
        onClose={() => setPicker(false)}
        onPick={ids => {
          setExercises(prev => [...prev, ...ids.map(id => ({
            exerciseId: id,
            restS: data.settings.defaultRestS,
            // Neu aus dem Katalog: leer. Werte bringt nur Kopieren/Verschieben mit.
            sets: Array.from({ length: 3 }, (): RoutineSet => ({ type: 'normal' })),
          }))])
          setPicker(false)
        }}
      />
    )
  }

  const menuExercise = menu != null ? exercises[menu] : null

  return (
    <TrainingSheet
      title={routine?.id ? tt('routine_title_edit') : tt('routine_title_new')}
      // Waehrend der Auswahl beendet Schliessen (Escape, Wischen) nur die Auswahl
      onClose={selecting ? stopSelect : close}
      busy={busy}
      closeLabel={tt('editor_close_save')}
      tall
      footer={selecting ? (
        <div role="toolbar" aria-label={tt('select_count', { count: selected.length })} style={{ display: 'flex', gap: 4 }}>
          <ActionButton icon={<Copy size={22} aria-hidden="true" />} disabled={selected.length === 0} onClick={copySelected}>{tt('sel_copy')}</ActionButton>
          <ActionButton icon={<ArrowRightLeft size={22} aria-hidden="true" />} disabled={selected.length === 0} onClick={() => setMoveOpen(true)}>{tt('sel_move')}</ActionButton>
          <ActionButton icon={<CopyPlus size={22} aria-hidden="true" />} disabled={selected.length === 0} onClick={duplicateSel}>{tt('sel_duplicate')}</ActionButton>
          <ActionButton icon={<Trash2 size={22} aria-hidden="true" />} disabled={selected.length === 0} danger onClick={deleteSelected}>{tt('sel_delete')}</ActionButton>
        </div>
      ) : undefined}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 8 }}>
        {selecting ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 38 }}>
            <span aria-live="polite" style={{ flex: 1, fontSize: 17, fontWeight: 600 }}>{tt('select_count', { count: selected.length })}</span>
            <button
              type="button"
              onClick={() => setSelected(allSelected ? [] : exercises.map((_, i) => i))}
              className="tyd-train-press"
              style={{ minHeight: 38, padding: '0 8px', color: 'var(--accent)', fontSize: 16 }}
            >
              {allSelected ? tt('select_none') : tt('select_all')}
            </button>
            <Button tone="ghost" onClick={stopSelect} style={{ minHeight: 38, padding: '0 14px', fontSize: '0.85rem' }}>{tt('select_done')}</Button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ flex: 1, fontSize: '0.78rem', color: 'var(--lg-text-3)' }}>{tt('editor_saves_on_close')}</span>
            {exercises.length > 0 && (
              <Button tone="ghost" disabled={busy} onClick={() => startSelect()} style={{ minHeight: 38, padding: '0 12px', fontSize: '0.85rem' }}>
                {tt('select_start')}
              </Button>
            )}
            {onStart && (
              <Button tone="ghost" disabled={busy} onClick={start} style={{ minHeight: 38, padding: '0 12px', fontSize: '0.85rem' }}>
                <Play size={14} aria-hidden="true" /> {tt('start')}
              </Button>
            )}
          </div>
        )}

        <section style={cardStyle}>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder={tt('routine_name_placeholder')}
            aria-label={tt('routine_name')}
            maxLength={60}
            style={{ ...inputStyle, fontWeight: 750, fontSize: 17, minHeight: 46 }}
          />
          <div style={rowStyle}>
            <span style={rowLabel}>{tt('routine_folder')}</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', flex: 1 }}>
              {folders.map(f => (
                <Chip key={f} active={!newFolder && folder === f} onClick={() => { setFolder(f); setNewFolder(false) }}>{f}</Chip>
              ))}
              <Chip active={!newFolder && folder == null} onClick={() => { setFolder(null); setNewFolder(false) }}>{tt('routine_folder_none')}</Chip>
              {newFolder ? (
                <input
                  autoFocus
                  defaultValue=""
                  placeholder={tt('folder_new_placeholder')}
                  aria-label={tt('routine_folder')}
                  maxLength={ROUTINE_FOLDER_MAX}
                  onChange={e => setFolder(e.target.value.trim() || null)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); setNewFolder(false) } }}
                  onBlur={() => setNewFolder(false)}
                  style={{ ...inputStyle, minHeight: 36, padding: '4px 12px', borderRadius: 999, width: 'auto', flex: '1 1 10em', fontWeight: 700 }}
                />
              ) : (
                <Chip active={false} onClick={() => { setFolder(null); setNewFolder(true) }}>{tt('folder_new')}</Chip>
              )}
            </div>
          </div>
          <div style={rowStyle}>
            <span style={rowLabel}>{tt('routine_days')}</span>
            <div role="group" aria-label={tt('routine_days')} style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {[1, 2, 3, 4, 5, 6, 7].map(day => (
                <Chip
                  key={day}
                  active={weekdays.includes(day)}
                  onClick={() => setWeekdays(prev => (prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day].sort()))}
                >
                  {tt(`weekday_${day}` as TrainingTextKey)}
                </Chip>
              ))}
            </div>
          </div>
        </section>

        {exercises.length === 0 && <p style={{ color: 'var(--lg-text-3)', padding: '4px 2px', fontSize: '0.9rem' }}>{tt('routine_no_exercises')}</p>}
        {selecting ? (
          <ul aria-label={tt('select_count', { count: selected.length })} style={{ ...cardStyle, listStyle: 'none', margin: 0, padding: 0, gap: 0, overflow: 'hidden' }}>
            {exercises.map((ex, index) => {
              const exName = info(ex.exerciseId)?.name ?? ex.exerciseId.replace(/_/g, ' ')
              const isSelected = selected.includes(index)
              return (
                <li key={`${ex.exerciseId}-${index}`} style={{ borderTop: index === 0 ? undefined : '0.5px solid var(--lg-separator)' }}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isSelected}
                    onClick={() => toggleSelected(index)}
                    className="tyd-train-press"
                    style={{
                      width: '100%', minHeight: 60, display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', textAlign: 'left',
                      background: isSelected ? 'color-mix(in srgb, var(--accent) 12%, transparent)' : 'transparent',
                    }}
                  >
                    <SelectCircle checked={isSelected} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 17, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{exName}</span>
                      <span style={{ display: 'block', fontSize: 13, color: 'var(--lg-text-3)', fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {exerciseSummary(ex, tt, unit, locale, data.settings.defaultRestS)}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
        <ul {...drag.containerProps} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {exercises.map((ex, index) => {
            const exInfo = info(ex.exerciseId)
            const exName = exInfo?.name ?? ex.exerciseId.replace(/_/g, ' ')
            const columns = columnsFor(exInfo?.tracking ?? null)
            const grid = columns.map(c => COLUMN_WIDTH[c]).join(' ')
            const group = ex.supersetGroup
            const groupColor = group != null ? SUPERSET_COLORS[(group - 1) % SUPERSET_COLORS.length] : null
            const coupled = group != null && exercises[index + 1]?.supersetGroup === group
            const restS = ex.restS ?? data.settings.defaultRestS
            const notesOpen = !!ex.notes || openNotes.includes(index)
            let working = 0
            return (
              <li
                key={`${ex.exerciseId}-${index}`}
                data-drag-row
                style={{
                  ...cardStyle, gap: 6, padding: '8px 8px 10px',
                  borderLeft: groupColor ? `4px solid ${groupColor}` : undefined,
                  ...drag.rowStyle(index),
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    type="button"
                    aria-label={tt('drag_handle')}
                    {...drag.handleProps(index)}
                    style={{ ...drag.handleProps(index).style, width: 32, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lg-text-3)', flexShrink: 0 }}
                  >
                    <GripVertical size={18} aria-hidden="true" />
                  </button>
                  <div {...pressProps(index)} style={{ flex: 1, minWidth: 0, WebkitUserSelect: 'none', userSelect: 'none', WebkitTouchCallout: 'none' }}>
                    <div style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {data.settings.favoriteExercises.includes(ex.exerciseId) && (
                        <Star size={13} fill="currentColor" aria-label={tt('picker_favorites')} style={{ color: FAVORITE_STAR, marginRight: 5, verticalAlign: '-1px' }} />
                      )}
                      {exName}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--lg-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {exInfo?.primary.map(m => tt(`muscle_${m}` as TrainingTextKey)).join(', ')}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => cycleRest(index)}
                    aria-label={`${tt('rest_change')}: ${tt('rest_seconds', { s: restS })}`}
                    className="tyd-train-press"
                    style={smallChip(false)}
                  >
                    {tt('rest_seconds', { s: restS })}
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSuperset(index)}
                    disabled={index === exercises.length - 1 && group == null}
                    aria-pressed={coupled}
                    aria-label={coupled ? tt('superset_remove') : tt('superset_with_next')}
                    className="tyd-train-press"
                    style={{ ...smallChip(coupled, groupColor ?? TRAINING_ACCENT), padding: '0 8px', opacity: index === exercises.length - 1 && group == null ? 0.4 : 1 }}
                  >
                    <Link2 size={14} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMenu(index)}
                    aria-label={`${exName} – ${tt('exercise_menu')}`}
                    className="tyd-train-press"
                    style={{ width: 36, height: 40, borderRadius: 12, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lg-text-3)', flexShrink: 0 }}
                  >
                    <MoreHorizontal size={18} aria-hidden="true" />
                  </button>
                </div>

                <div aria-hidden="true" style={{ display: 'grid', gridTemplateColumns: grid, gap: 6, padding: '2px 4px 0', fontSize: '0.62rem', fontWeight: 800, color: 'var(--lg-text-3)', textTransform: 'uppercase', textAlign: 'center', letterSpacing: '0.04em' }}>
                  {columns.map(col => <span key={col}>{columnHeader(col, tt, unit)}</span>)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {ex.sets.map((set, setIndex) => {
                    const number = set.type === 'warmup' ? null : ++working
                    return (
                      <div key={setIndex} style={{ display: 'grid', gridTemplateColumns: grid, gap: 6, alignItems: 'center', padding: '0 4px' }}>
                        {columns.map(col => {
                          switch (col) {
                            case 'type':
                              return (
                                <button
                                  key={col}
                                  type="button"
                                  onClick={() => cycleType(index, setIndex)}
                                  aria-label={`${tt('set_type')}: ${tt(`set_type_${set.type}` as TrainingTextKey)}`}
                                  className="tyd-train-press"
                                  style={{ height: 38, borderRadius: 10, fontWeight: 800, fontSize: '0.85rem', background: 'var(--lg-fill)', color: TYPE_COLOR[set.type] }}
                                >
                                  {set.type === 'normal' ? number : tt(`set_${set.type}_short` as TrainingTextKey)}
                                </button>
                              )
                            case 'dash':
                              return <span key={col} aria-hidden="true" style={{ textAlign: 'center', color: 'var(--lg-text-3)' }}>–</span>
                            case 'min':
                              return <NumField key={col} label={`${tt('reps_range')} ${tt('reps_min')}`} value={set.repsMin ?? set.reps ?? null} parse={parseReps} format={String} inputMode="numeric" onCommit={v => commitRepsBound(index, setIndex, 'repsMin', v)} />
                            case 'max':
                              return <NumField key={col} label={`${tt('reps_range')} ${tt('reps_max')}`} value={set.repsMax ?? set.reps ?? null} parse={parseReps} format={String} inputMode="numeric" onCommit={v => commitRepsBound(index, setIndex, 'repsMax', v)} />
                            case 'duration':
                              return <NumField key={col} label={tt('col_time')} value={set.durationS ?? null} parse={parseDuration} format={formatClock} inputMode="numeric" placeholder="0:00" onCommit={v => updateSet(index, setIndex, { durationS: v })} />
                            case 'distance':
                              return <NumField key={col} label={tt('col_distance')} value={set.distanceM ?? null} parse={parseMeters} format={v => formatNumber(v, locale, 0)} inputMode="numeric" placeholder="m" onCommit={v => updateSet(index, setIndex, { distanceM: v })} />
                            case 'weight':
                              return (
                                <NumField
                                  key={col}
                                  label={tt('target_weight')}
                                  value={set.weightKg ?? null}
                                  parse={v => { const n = parseDecimal(v); return n == null || n < 0 ? null : fromDisplayWeight(n, unit) }}
                                  format={kg => formatNumber(toDisplayWeight(kg, unit), locale, 2)}
                                  inputMode="decimal"
                                  placeholder={tt('weight_last_time')}
                                  onCommit={v => updateSet(index, setIndex, { weightKg: v })}
                                />
                              )
                            case 'rpe':
                              return <NumField key={col} label={tt('target_rpe')} value={set.rpe ?? null} parse={parseRpe} format={v => formatNumber(v, locale, 1)} inputMode="decimal" placeholder="–" onCommit={v => updateSet(index, setIndex, { rpe: v })} />
                          }
                        })}
                      </div>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', gap: 6, padding: '4px 4px 0' }}>
                  <Button tone="ghost" onClick={() => addSet(index)} disabled={ex.sets.length >= MAX_SETS} aria-label={tt('add_set')} style={{ minHeight: 36, fontSize: '0.82rem', flex: 1 }}>{tt('add_set_short')}</Button>
                  <Button tone="ghost" onClick={() => removeSet(index)} disabled={ex.sets.length <= 1} aria-label={tt('remove_set')} style={{ minHeight: 36, fontSize: '0.82rem', color: 'var(--lg-text-3)' }}>{tt('remove_set_short')}</Button>
                </div>
                {notesOpen && (
                  <textarea
                    value={ex.notes ?? ''}
                    onChange={e => updateExercise(index, x => ({ ...x, notes: e.target.value || null }))}
                    placeholder={tt('notes_placeholder')}
                    aria-label={tt('notes')}
                    rows={2}
                    style={{ ...inputStyle, minHeight: 56, resize: 'vertical', fontSize: 16, margin: '2px 4px 0', width: 'calc(100% - 8px)' }}
                  />
                )}
              </li>
            )
          })}
        </ul>
        )}

        {!selecting && (
          <Button tone="ghost" block onClick={() => setPicker(true)} style={{ minHeight: 52, borderStyle: 'dashed', color: TRAINING_ACCENT }}>
            <Plus size={18} aria-hidden="true" /> {tt('add_from_catalog')}
          </Button>
        )}
        {!selecting && clipboard.length > 0 && (
          <Button tone="ghost" block onClick={paste} style={{ minHeight: 48, borderStyle: 'dashed', color: 'var(--accent)' }}>
            <ClipboardPaste size={18} aria-hidden="true" /> {tt('clip_paste', { what: what(clipboard.length) })}
          </Button>
        )}

        <section style={{ ...cardStyle, padding: '14px 16px' }} aria-labelledby="routine-muscle-title">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <h3 id="routine-muscle-title" style={{ margin: 0, fontSize: '0.78rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--lg-text-3)' }}>{tt('sets_per_muscle')}</h3>
            <span style={{ fontSize: '0.72rem', color: 'var(--lg-text-3)' }}>{tt('muscle_routine_times', { count: times })}</span>
          </div>
          {muscleRows.length === 0 ? (
            <p style={{ fontSize: '0.85rem', color: 'var(--lg-text-3)', marginTop: 8 }}>{tt('muscle_empty_editor')}</p>
          ) : (
            <div style={{ marginTop: 10 }}><MuscleBars rows={muscleRows} /></div>
          )}
          <p style={{ margin: '10px 0 0', fontSize: '0.72rem', color: 'var(--lg-text-3)', lineHeight: 1.4 }}>{tt('muscle_band_hint')}</p>
        </section>

        {routine?.id && (
          <Button tone="danger" block disabled={busy} onClick={remove}>
            <Trash2 size={16} aria-hidden="true" /> {tt('routine_delete')}
          </Button>
        )}
      </div>

      {menu != null && menuExercise && (
        <TrainingSheet title={info(menuExercise.exerciseId)?.name ?? menuExercise.exerciseId} onClose={() => setMenu(null)} zIndex={100}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 8 }}>
            <MenuItem icon={<ArrowUp size={18} aria-hidden="true" />} disabled={menu === 0} onClick={() => { move(menu, menu - 1); setMenu(null) }}>{tt('move_up')}</MenuItem>
            <MenuItem icon={<ArrowDown size={18} aria-hidden="true" />} disabled={menu === exercises.length - 1} onClick={() => { move(menu, menu + 1); setMenu(null) }}>{tt('move_down')}</MenuItem>
            <MenuItem icon={<StickyNote size={18} aria-hidden="true" />} onClick={() => { setOpenNotes(prev => (prev.includes(menu) ? prev : [...prev, menu])); setMenu(null) }}>
              {menuExercise.notes ? tt('note_show') : tt('note_add')}
            </MenuItem>
            <MenuItem
              icon={<Star size={18} aria-hidden="true" fill={data.settings.favoriteExercises.includes(menuExercise.exerciseId) ? 'currentColor' : 'none'} />}
              onClick={() => { data.toggleFavorite(menuExercise.exerciseId).catch(() => toast.error(tt('save_error'))); setMenu(null) }}
            >
              {data.settings.favoriteExercises.includes(menuExercise.exerciseId) ? tt('favorite_menu_remove') : tt('favorite_menu_add')}
            </MenuItem>
            <MenuItem icon={<Check size={18} aria-hidden="true" />} onClick={() => startSelect(menu)}>{tt('select_start')}</MenuItem>
            <MenuItem icon={<Trash2 size={18} aria-hidden="true" />} danger onClick={() => { removeExercise(menu); setMenu(null) }}>{tt('remove_exercise')}</MenuItem>
          </div>
        </TrainingSheet>
      )}

      {moveOpen && (
        <TrainingSheet title={tt('move_title', { what: what(selected.length) })} onClose={() => setMoveOpen(false)} zIndex={100} busy={busy}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 8 }}>
            {moveTargets.length === 0 && <p style={{ color: 'var(--lg-text-3)', fontSize: 15, padding: '8px 2px' }}>{tt('move_no_targets')}</p>}
            {moveTargets.map(([plan, list]) => (
              <section key={plan ?? ''} aria-label={plan ?? tt('move_without_plan')} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--lg-text-3)', textTransform: 'uppercase', letterSpacing: '0.04em', padding: '10px 4px 0' }}>
                  {plan ?? tt('move_without_plan')}
                </h3>
                {list.map(target => (
                  <MenuItem key={target.id} icon={<ArrowRightLeft size={18} aria-hidden="true" />} disabled={busy} onClick={() => { void moveTo(target) }}>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{target.name}</span>
                    <span style={{ fontSize: 13, color: 'var(--lg-text-3)' }}>{what(target.exercises.length)}</span>
                  </MenuItem>
                ))}
              </section>
            ))}
          </div>
        </TrainingSheet>
      )}
    </TrainingSheet>
  )
}

// ─── Bausteine ──────────────────────────────────────────────────────────────

/** Gelb wie der Stern in der Uebungsauswahl. */
const FAVORITE_STAR = '#ffd60a'

/** Eine Zeile Werte fuer die Auswahlliste: „3 Saetze · 8–12 · 80 kg · 90 s". */
function exerciseSummary(ex: RoutineExercise, tt: ReturnType<typeof useTrainingText>['tt'], unit: 'kg' | 'lb', locale: string, defaultRestS: number): string {
  const first = ex.sets.find(s => s.type !== 'warmup') ?? ex.sets[0]
  const min = first?.repsMin ?? first?.reps ?? null
  const max = first?.repsMax ?? first?.reps ?? null
  const reps = min != null && max != null ? (min === max ? String(min) : `${min}–${max}`) : min ?? max
  return [
    tt('sets_count', { count: ex.sets.length }),
    reps != null ? `${reps} ${tt('col_reps')}` : null,
    first?.weightKg != null ? `${formatNumber(toDisplayWeight(first.weightKg, unit), locale, 2)} ${unit}` : null,
    tt('rest_seconds', { s: ex.restS ?? defaultRestS }),
  ].filter(Boolean).join(' · ')
}

function ActionButton({ icon, children, onClick, disabled, danger }: { icon: ReactNode; children: ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="tyd-train-press"
      style={{
        flex: 1, minWidth: 0, minHeight: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
        fontSize: 12, fontWeight: 600, borderRadius: 14,
        color: danger ? 'var(--lg-bad-text)' : 'var(--accent)', opacity: disabled ? 0.35 : 1, cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {icon}{children}
    </button>
  )
}

const cardStyle: CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 14px', borderRadius: 18,
  background: 'var(--lg-surface-2)', border: '1px solid var(--lg-separator)',
}
const rowStyle: CSSProperties = { display: 'flex', gap: 8, alignItems: 'flex-start' }
const rowLabel: CSSProperties = { fontSize: '0.75rem', color: 'var(--lg-text-3)', fontWeight: 700, width: '4em', flexShrink: 0, paddingTop: 10 }

const smallChip = (active: boolean, color = TRAINING_ACCENT): CSSProperties => ({
  minHeight: 30, padding: '0 9px', borderRadius: 999, flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 4,
  fontSize: '0.72rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
  background: active ? `${color}22` : 'var(--lg-fill)',
  border: `1px solid ${active ? `${color}66` : 'var(--lg-separator)'}`,
  color: active ? color : 'var(--lg-text-3)',
})

function columnHeader(col: Column, tt: ReturnType<typeof useTrainingText>['tt'], unit: 'kg' | 'lb'): string {
  switch (col) {
    case 'type': return tt('col_set')
    case 'min': return `${tt('reps_range')} ${tt('reps_min')}`
    case 'dash': return ''
    case 'max': return tt('reps_max')
    case 'duration': return tt('col_time')
    case 'distance': return tt('col_distance')
    case 'weight': return tt('weight_start', { unit: tt(unit === 'kg' ? 'col_kg' : 'col_lb') })
    case 'rpe': return tt('col_rpe')
  }
}

const parseReps = (text: string): number | null => {
  const n = parseDecimal(text)
  return n == null || n <= 0 ? null : Math.round(n)
}
const parseRpe = (text: string): number | null => {
  const n = parseDecimal(text)
  return n == null ? null : Math.min(10, Math.max(1, Math.round(n * 2) / 2))
}
const parseMeters = (text: string): number | null => {
  const n = parseDecimal(text)
  return n == null || n <= 0 ? null : Math.round(n)
}
/** „1:30" wie eine Uhr, „130" wie an der Mikrowelle (1:30). */
const parseDuration = (text: string): number | null => {
  const s = text.includes(':') ? parseClock(text) : parseStopwatchDigits(text)
  return s == null || s <= 0 ? null : s
}

/**
 * Zahlenfeld mit eigenem Text, solange es den Fokus hat — so laesst sich
 * „82," tippen, ohne dass die Formatierung dazwischenfunkt. Uebernommen wird
 * beim Verlassen; aendert sich der Wert von aussen (Rueckgaengig, Umsortieren),
 * zieht der Text nach.
 */
function NumField({ value, onCommit, format, parse, label, placeholder, inputMode }: {
  value: number | null
  onCommit: (value: number | null) => void
  format: (value: number) => string
  parse: (text: string) => number | null
  label: string
  placeholder?: string
  inputMode: 'numeric' | 'decimal'
}) {
  const [text, setText] = useState(value == null ? '' : format(value))
  const focused = useRef(false)
  useEffect(() => { if (!focused.current) setText(value == null ? '' : format(value)) }, [value, format])
  return (
    <input
      value={text}
      inputMode={inputMode}
      placeholder={placeholder}
      aria-label={label}
      className="tyd-train-input"
      onFocus={() => { focused.current = true }}
      onChange={e => setText(e.target.value)}
      onBlur={() => {
        focused.current = false
        const parsed = text.trim() === '' ? null : parse(text)
        onCommit(parsed)
        setText(parsed == null ? '' : format(parsed))
      }}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur() }}
      style={{ ...inputStyle, minHeight: 38, height: 38, padding: '0 4px', borderRadius: 10, textAlign: 'center', fontWeight: 750, fontVariantNumeric: 'tabular-nums' }}
    />
  )
}

function MenuItem({ icon, children, onClick, disabled, danger }: { icon: ReactNode; children: ReactNode; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="tyd-train-press"
      style={{
        minHeight: 50, display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', padding: '0 16px', borderRadius: 14,
        fontWeight: 500, fontSize: 17, background: 'var(--lg-surface-2)', border: 0,
        color: danger ? 'var(--lg-bad-text)' : 'var(--lg-text)', opacity: disabled ? 0.4 : 1, cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {icon}{children}
    </button>
  )
}
