import type { MuscleGroup, SessionExercise, TrackingMode, TrainingSession, TrainingSet } from '../types'

/**
 * Auswertung des Trainingsverlaufs — reine Funktionen, ohne React und ohne
 * Datenbank. Gewichte sind hier immer kg; umgerechnet wird nur in der Anzeige.
 */

/** Saetze, die zaehlen: abgehakt und kein Aufwaermsatz. */
export function isWorkingSet(set: TrainingSet): boolean {
  return set.done && set.type !== 'warmup'
}

/**
 * Geschaetztes Einmal-Maximum (e1RM) nach Epley.
 *
 * Ueber 12 Wiederholungen wird die Schaetzung zu ungenau, um sie als Rekord zu
 * fuehren — dann null. Bei genau 1 Wdh. ist es das Gewicht selbst.
 */
export function estimateOneRepMax(weightKg: number | null | undefined, reps: number | null | undefined): number | null {
  if (!weightKg || !reps || weightKg <= 0 || reps <= 0 || reps > 12) return null
  if (reps === 1) return weightKg
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10
}

export function setVolumeKg(set: TrainingSet): number {
  if (!isWorkingSet(set) || !set.weightKg || !set.reps) return 0
  return set.weightKg * set.reps
}

export function exerciseVolumeKg(exercise: SessionExercise): number {
  return exercise.sets.reduce((sum, set) => sum + setVolumeKg(set), 0)
}

export function sessionVolumeKg(session: Pick<TrainingSession, 'exercises'>): number {
  return Math.round(session.exercises.reduce((sum, ex) => sum + exerciseVolumeKg(ex), 0))
}

export function workingSetCount(session: Pick<TrainingSession, 'exercises'>): number {
  return session.exercises.reduce((sum, ex) => sum + ex.sets.filter(isWorkingSet).length, 0)
}

/** Dauer einer Einheit in Sekunden — gespeichert oder aus Start/Ende. */
export function sessionDurationS(session: Pick<TrainingSession, 'durationS' | 'startedAt' | 'endedAt'>): number {
  if (session.durationS != null) return session.durationS
  if (!session.endedAt) return 0
  return Math.max(0, Math.round((Date.parse(session.endedAt) - Date.parse(session.startedAt)) / 1000))
}

// ─── Verlauf je Uebung ──────────────────────────────────────────────────────

export interface ExercisePoint {
  sessionId: string
  date: string
  bestE1rm: number | null
  maxWeightKg: number | null
  maxReps: number | null
  volumeKg: number
  bestDurationS: number | null
  bestDistanceM: number | null
  /** Bester Satz nach e1RM, sonst nach Gewicht, sonst nach Wdh. */
  bestSet: TrainingSet | null
}

function pointFor(session: TrainingSession, exerciseId: string): ExercisePoint | null {
  const sets = session.exercises
    .filter(ex => ex.exerciseId === exerciseId)
    .flatMap(ex => ex.sets)
    .filter(isWorkingSet)
  if (sets.length === 0) return null

  let bestE1rm: number | null = null
  let maxWeightKg: number | null = null
  let maxReps: number | null = null
  let bestDurationS: number | null = null
  let bestDistanceM: number | null = null
  let bestSet: TrainingSet | null = null
  // Rang zuerst (e1RM > Gewicht > Rest), dann der Wert innerhalb des Rangs —
  // sonst schluege 40 kg × 15 (kein e1RM, Wert 40 015) jedes 100 kg × 5.
  let bestRank = -1
  let bestScore = -1
  let volumeKg = 0

  for (const set of sets) {
    const e1rm = estimateOneRepMax(set.weightKg, set.reps)
    if (e1rm != null && (bestE1rm == null || e1rm > bestE1rm)) bestE1rm = e1rm
    if (set.weightKg != null && (maxWeightKg == null || set.weightKg > maxWeightKg)) maxWeightKg = set.weightKg
    if (set.reps != null && (maxReps == null || set.reps > maxReps)) maxReps = set.reps
    if (set.durationS != null && (bestDurationS == null || set.durationS > bestDurationS)) bestDurationS = set.durationS
    if (set.distanceM != null && (bestDistanceM == null || set.distanceM > bestDistanceM)) bestDistanceM = set.distanceM
    volumeKg += setVolumeKg(set)
    const rank = e1rm != null ? 2 : set.weightKg ? 1 : 0
    const score = e1rm ?? (set.weightKg ?? 0) * 1000 + (set.reps ?? 0) + (set.durationS ?? 0) / 1000
    if (rank > bestRank || (rank === bestRank && score > bestScore)) { bestRank = rank; bestScore = score; bestSet = set }
  }

  return {
    sessionId: session.id,
    date: session.startedAt,
    bestE1rm, maxWeightKg, maxReps, volumeKg: Math.round(volumeKg),
    bestDurationS, bestDistanceM, bestSet,
  }
}

/** Ein Punkt je Einheit, in der die Uebung vorkam — aelteste zuerst. */
export function exerciseHistory(sessions: readonly TrainingSession[], exerciseId: string): ExercisePoint[] {
  return sessions
    .map(session => pointFor(session, exerciseId))
    .filter((point): point is ExercisePoint => point != null)
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
}

/**
 * Die Saetze vom letzten Mal — die Spalte „Vorher" im Logger und die
 * Startwerte fuer eine neue Einheit (wie bei Hevy).
 */
export function previousSets(
  sessions: readonly TrainingSession[],
  exerciseId: string,
  beforeIso?: string,
): TrainingSet[] {
  const before = beforeIso ? Date.parse(beforeIso) : Infinity
  let latest: { at: number; sets: TrainingSet[] } | null = null
  for (const session of sessions) {
    const at = Date.parse(session.startedAt)
    if (at >= before) continue
    const sets = session.exercises.filter(ex => ex.exerciseId === exerciseId).flatMap(ex => ex.sets).filter(s => s.done)
    if (sets.length === 0) continue
    if (!latest || at > latest.at) latest = { at, sets }
  }
  return latest?.sets ?? []
}

// ─── Rekorde ────────────────────────────────────────────────────────────────

export type RecordKind = 'e1rm' | 'weight' | 'volume' | 'reps' | 'duration' | 'distance'

export interface PersonalRecord {
  exerciseId: string
  kind: RecordKind
  value: number
  previous: number | null
}

/**
 * Welche Rekorde bricht diese Einheit? Verglichen wird mit allen frueheren
 * Einheiten. Die erste Einheit einer Uebung setzt keinen Rekord — sonst waere
 * jedes neue Training voller Pokale, die nichts bedeuten.
 */
export function detectRecords(
  session: TrainingSession,
  history: readonly TrainingSession[],
  /** Erfassungsart je Uebung; bei Unterstuetzung ist weniger Gewicht besser. */
  trackingOf?: (exerciseId: string) => TrackingMode | null | undefined,
): PersonalRecord[] {
  const start = Date.parse(session.startedAt)
  const earlier = history.filter(s => s.id !== session.id && Date.parse(s.startedAt) < start)
  const records: PersonalRecord[] = []
  const seen = new Set<string>()

  for (const ex of session.exercises) {
    if (seen.has(ex.exerciseId)) continue
    seen.add(ex.exerciseId)
    const current = pointFor(session, ex.exerciseId)
    if (!current) continue
    const past = exerciseHistory(earlier, ex.exerciseId)
    if (past.length === 0) continue

    const best = (pick: (p: ExercisePoint) => number | null) =>
      past.reduce<number | null>((max, p) => {
        const v = pick(p)
        return v != null && (max == null || v > max) ? v : max
      }, null)

    // Mit Unterstuetzung (Klimmzug-Maschine) waeren e1RM, Gewicht und Volumen
    // umso hoeher, je mehr geholfen wurde — dort zaehlen nur Wiederholungen.
    if (trackingOf?.(ex.exerciseId) === 'assisted_reps') {
      const previous = best(p => p.maxReps)
      if (current.maxReps != null && previous != null && current.maxReps > previous) {
        records.push({ exerciseId: ex.exerciseId, kind: 'reps', value: current.maxReps, previous })
      }
      continue
    }

    const checks: Array<[RecordKind, number | null, number | null]> = [
      ['e1rm', current.bestE1rm, best(p => p.bestE1rm)],
      ['weight', current.maxWeightKg, best(p => p.maxWeightKg)],
      ['volume', current.volumeKg || null, best(p => p.volumeKg || null)],
      ['duration', current.bestDurationS, best(p => p.bestDurationS)],
      ['distance', current.bestDistanceM, best(p => p.bestDistanceM)],
    ]
    // Wdh. als Rekord nur fuer Uebungen ohne Gewicht (Klimmzug, Liegestuetz).
    if (current.maxWeightKg == null) checks.push(['reps', current.maxReps, best(p => p.maxReps)])

    for (const [kind, value, previous] of checks) {
      if (value != null && previous != null && value > previous) {
        records.push({ exerciseId: ex.exerciseId, kind, value, previous })
      }
    }
  }
  return records
}

// ─── Woche ──────────────────────────────────────────────────────────────────

/** Montag 00:00 Ortszeit der Woche, in der `date` liegt. */
export function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const weekday = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - weekday)
  return d
}

/** 1 = Montag … 7 = Sonntag. */
export function isoWeekday(date: Date): number {
  return ((date.getDay() + 6) % 7) + 1
}

export interface WeekSummary {
  sessions: number
  durationS: number
  volumeKg: number
  kcal: number
  distanceM: number
  goal: number
  /** Wochen in Folge (bis einschliesslich dieser), in denen das Ziel erreicht wurde. */
  streakWeeks: number
}

export function weekSummary(
  sessions: readonly TrainingSession[],
  now: Date,
  goal: number,
  kcalOf: (session: TrainingSession) => number,
): WeekSummary {
  const weekStart = startOfWeek(now).getTime()
  const inWeek = sessions.filter(s => Date.parse(s.startedAt) >= weekStart)
  const summary: WeekSummary = {
    sessions: inWeek.length,
    durationS: inWeek.reduce((sum, s) => sum + sessionDurationS(s), 0),
    volumeKg: inWeek.reduce((sum, s) => sum + sessionVolumeKg(s), 0),
    kcal: Math.round(inWeek.reduce((sum, s) => sum + kcalOf(s), 0)),
    distanceM: inWeek.reduce((sum, s) => sum + (s.distanceM ?? 0), 0),
    goal,
    streakWeeks: 0,
  }

  // Serie: die laufende Woche zaehlt mit, sobald ihr Ziel erreicht ist; sonst
  // beginnt die Zaehlung bei der Vorwoche (die laufende ist ja noch offen).
  const countIn = (start: number, end: number) =>
    sessions.filter(s => { const t = Date.parse(s.startedAt); return t >= start && t < end }).length
  const week = 7 * 24 * 60 * 60 * 1000
  let streak = summary.sessions >= goal ? 1 : 0
  let cursor = weekStart
  for (let i = 0; i < 520; i++) {
    const prevStart = startOfWeek(new Date(cursor - week / 2)).getTime()
    if (countIn(prevStart, cursor) < goal) break
    streak++
    cursor = prevStart
  }
  summary.streakWeeks = goal > 0 ? streak : 0
  return summary
}

// ─── Muskeln ────────────────────────────────────────────────────────────────

export interface MuscleInfo {
  primary: readonly MuscleGroup[]
  secondary: readonly MuscleGroup[]
}

/**
 * Arbeitssaetze je Muskelgruppe — primaer zaehlt voll, sekundaer halb. Das ist
 * die uebliche Zaehlweise fuer „Saetze pro Muskel und Woche".
 */
export function setsPerMuscle(
  sessions: readonly TrainingSession[],
  muscleOf: (exerciseId: string) => MuscleInfo | null,
): Map<MuscleGroup, number> {
  const result = new Map<MuscleGroup, number>()
  for (const session of sessions) {
    for (const ex of session.exercises) {
      const info = muscleOf(ex.exerciseId)
      if (!info) continue
      const sets = ex.sets.filter(isWorkingSet).length
      if (sets === 0) continue
      for (const m of info.primary) result.set(m, (result.get(m) ?? 0) + sets)
      for (const m of info.secondary) result.set(m, (result.get(m) ?? 0) + sets / 2)
    }
  }
  return result
}

// ─── Scheibenrechner ────────────────────────────────────────────────────────

/**
 * Welche Scheiben je Seite fuer ein Zielgewicht? Gierig von der schwersten
 * Scheibe an; `restKg` ist, was sich mit den vorhandenen Scheiben nicht legen laesst.
 */
export function platesPerSide(targetKg: number, barKg: number, platesKg: readonly number[]): { plates: number[]; restKg: number } {
  let perSide = Math.max(0, (targetKg - barKg) / 2)
  const plates: number[] = []
  const sorted = [...platesKg].filter(p => p > 0).sort((a, b) => b - a)
  for (const plate of sorted) {
    while (perSide + 1e-9 >= plate) {
      plates.push(plate)
      perSide -= plate
    }
  }
  return { plates, restKg: Math.round(perSide * 2 * 100) / 100 }
}

// ─── Einheiten ──────────────────────────────────────────────────────────────

export const LB_PER_KG = 2.2046226218

export function toDisplayWeight(kg: number, unit: 'kg' | 'lb'): number {
  return unit === 'kg' ? Math.round(kg * 100) / 100 : Math.round(kg * LB_PER_KG * 10) / 10
}

export function fromDisplayWeight(value: number, unit: 'kg' | 'lb'): number {
  return unit === 'kg' ? value : Math.round((value / LB_PER_KG) * 1000) / 1000
}
