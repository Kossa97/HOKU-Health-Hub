import type { TrainingSession } from '../types'
import { exerciseHistory, isWorkingSet, sessionVolumeKg } from './stats'

/**
 * GLP-1-Ansicht: haelt die Kraft, waehrend das Gewicht faellt?
 *
 * Unter GLP-1-Wirkstoffen geht mit dem Fett auch Muskel verloren. Ein
 * einfaches, ehrliches Signal dafuer ist die eigene Kraft: sinkt sie
 * zusammen mit dem Gewicht, ist das ein Grund hinzusehen. Alles hier ist
 * Beobachtung aus den eigenen Daten, keine Diagnose — die Anzeige sagt das.
 */

const GLP1_PATTERN = new RegExp([
  'semaglut', 'ozempic', 'wegovy', 'rybelsus',
  'tirzepat', 'mounjaro', 'zepbound',
  'liraglut', 'victoza', 'saxenda',
  'dulaglut', 'trulicity', 'exenat', 'byetta', 'bydureon',
  'retatrut', 'reta\\b', 'cagrilint', 'cagrisema', 'survodut', 'mazdut', 'orforglipron',
].join('|'), 'i')

/** Ist ein Stack-Eintrag ein GLP-1-(Ko-)Agonist oder eine Kombination damit? */
export function isGlp1Substance(name: string | null | undefined): boolean {
  return !!name && GLP1_PATTERN.test(name)
}

export interface WeightPoint { date: string; kg: number }

export type Glp1Status = 'good' | 'neutral' | 'watch' | 'insufficient'

export interface Glp1Insight {
  status: Glp1Status
  windowDays: number
  weightChangePct: number | null
  strengthChangePct: number | null
  /** Uebungen, aus denen die Kraftaenderung stammt. */
  strengthExercises: number
  /** Arbeitssaetze der letzten 7 Tage im Vergleich zum Schnitt der 3 Wochen davor. */
  setsLast7: number
  setsAvgPrev: number | null
  volumeDrop: boolean
  /** Einheiten und Schnitt-Volumen je Tag nach der letzten Injektion (0 = Injektionstag). */
  byInjectionDay: Array<{ day: number; sessions: number; avgVolumeKg: number }> | null
  /** Protein je kg Koerpergewicht, wenn der Kalorientracker es liefert. */
  proteinPerKg: number | null
}

const DAY = 24 * 60 * 60 * 1000
const round1 = (v: number) => Math.round(v * 10) / 10
const median = (values: number[]) => {
  const s = [...values].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** Gewichtsaenderung: Schnitt der ersten gegen Schnitt der letzten 7 Tage im Fenster. */
export function weightChangePct(weights: readonly WeightPoint[], from: number, to: number): number | null {
  const inWindow = weights.filter(w => { const t = Date.parse(w.date); return t >= from && t <= to && w.kg > 0 })
  const early = inWindow.filter(w => Date.parse(w.date) < from + 7 * DAY).map(w => w.kg)
  const late = inWindow.filter(w => Date.parse(w.date) > to - 7 * DAY).map(w => w.kg)
  if (early.length === 0 || late.length === 0) return null
  if (to - from < 14 * DAY) return null
  const a = early.reduce((s, v) => s + v, 0) / early.length
  const b = late.reduce((s, v) => s + v, 0) / late.length
  return round1((b / a - 1) * 100)
}

/**
 * Kraftaenderung: je Uebung, die in beiden Haelften des Fensters vorkommt,
 * bester e1RM der ersten gegen der zweiten Haelfte; davon der Median. Der
 * Median, damit eine einzelne Ausreisser-Uebung das Bild nicht dreht.
 */
export function strengthChangePct(sessions: readonly TrainingSession[], from: number, to: number): { pct: number | null; exercises: number } {
  const mid = from + (to - from) / 2
  const inWindow = sessions.filter(s => { const t = Date.parse(s.startedAt); return t >= from && t <= to })
  const ids = new Set(inWindow.flatMap(s => s.exercises.map(e => e.exerciseId)))
  const changes: number[] = []
  for (const id of ids) {
    const points = exerciseHistory(inWindow, id).filter(p => p.bestE1rm != null)
    const first = points.filter(p => Date.parse(p.date) < mid).map(p => p.bestE1rm as number)
    const second = points.filter(p => Date.parse(p.date) >= mid).map(p => p.bestE1rm as number)
    if (first.length === 0 || second.length === 0) continue
    changes.push((Math.max(...second) / Math.max(...first) - 1) * 100)
  }
  if (changes.length === 0) return { pct: null, exercises: 0 }
  return { pct: round1(median(changes)), exercises: changes.length }
}

export interface Glp1Input {
  sessions: readonly TrainingSession[]
  weights: readonly WeightPoint[]
  /** Zeitpunkte bestaetigter GLP-1-Einnahmen. */
  injections: readonly string[]
  now: Date
  windowDays?: number
  /** Durchschnittliches Protein pro Tag in g (Kalorientracker), falls vorhanden. */
  avgProteinG?: number | null
}

export function glp1Insight(input: Glp1Input): Glp1Insight {
  const windowDays = input.windowDays ?? 56
  const to = input.now.getTime()
  const from = to - windowDays * DAY

  const weight = weightChangePct(input.weights, from, to)
  const strength = strengthChangePct(input.sessions, from, to)

  const setsBetween = (a: number, b: number) => input.sessions
    .filter(s => { const t = Date.parse(s.startedAt); return t > a && t <= b })
    .reduce((sum, s) => sum + s.exercises.reduce((n, e) => n + e.sets.filter(isWorkingSet).length, 0), 0)
  const setsLast7 = setsBetween(to - 7 * DAY, to)
  const prev = [1, 2, 3].map(w => setsBetween(to - (w + 1) * 7 * DAY, to - w * 7 * DAY))
  const setsAvgPrev = prev.some(v => v > 0) ? round1(prev.reduce((a, b) => a + b, 0) / 3) : null
  const volumeDrop = setsAvgPrev != null && setsAvgPrev >= 6 && setsLast7 < setsAvgPrev * 0.7

  let status: Glp1Status = 'insufficient'
  if (weight != null && strength.pct != null) {
    if (weight <= -2 && strength.pct <= -5) status = 'watch'
    else if (strength.pct >= -2) status = 'good'
    else status = 'neutral'
  } else if (strength.pct != null) {
    status = strength.pct <= -5 ? 'watch' : strength.pct >= -2 ? 'good' : 'neutral'
  }

  const latestWeight = [...input.weights].sort((a, b) => Date.parse(b.date) - Date.parse(a.date))[0]?.kg
  const proteinPerKg = input.avgProteinG != null && latestWeight
    ? round1(input.avgProteinG / latestWeight)
    : null

  return {
    status,
    windowDays,
    weightChangePct: weight,
    strengthChangePct: strength.pct,
    strengthExercises: strength.exercises,
    setsLast7,
    setsAvgPrev,
    volumeDrop,
    byInjectionDay: byInjectionDay(input.sessions, input.injections, from, to),
    proteinPerKg,
  }
}

/**
 * Wie trainiere ich je nach Abstand zur letzten Injektion? Viele merken an
 * den ersten Tagen danach weniger Appetit und Energie. Gezeigt wird das erst
 * ab 6 Krafteinheiten im Fenster — darunter ist es Zufall.
 */
export function byInjectionDay(
  sessions: readonly TrainingSession[],
  injections: readonly string[],
  from: number,
  to: number,
): Glp1Insight['byInjectionDay'] {
  const shots = injections.map(d => Date.parse(d)).filter(Number.isFinite).sort((a, b) => a - b)
  if (shots.length === 0) return null
  const buckets = Array.from({ length: 7 }, (_, day) => ({ day, sessions: 0, volume: 0 }))
  let counted = 0
  for (const s of sessions) {
    const t = Date.parse(s.startedAt)
    if (t < from || t > to || s.kind !== 'strength') continue
    let last: number | null = null
    for (const shot of shots) { if (shot <= t) last = shot; else break }
    if (last == null) continue
    const day = Math.floor((t - last) / DAY)
    if (day > 6) continue
    buckets[day].sessions++
    buckets[day].volume += sessionVolumeKg(s)
    counted++
  }
  if (counted < 6) return null
  return buckets.map(b => ({ day: b.day, sessions: b.sessions, avgVolumeKg: b.sessions ? Math.round(b.volume / b.sessions) : 0 }))
}
