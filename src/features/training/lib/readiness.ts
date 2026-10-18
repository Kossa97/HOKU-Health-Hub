import type { TrainingSession } from '../types'
import { sessionDurationS } from './stats'

/**
 * Bereitschaft: wie erholt bin ich heute — verglichen mit MEINEM Schnitt, nicht
 * mit einer Tabelle.
 *
 * fin zeigt das nur im Abo und nur mit Apple Health. Hier rechnet es mit dem,
 * was da ist: Schlaf, Ruhepuls und HRV von der Uhr, sonst die Tagesform aus dem
 * Tagesprotokoll (Schlafqualitaet, Energie), dazu immer die eigene
 * Trainingslast. Jeder Faktor zaehlt nur, wenn genug eigene Vergleichswerte
 * vorliegen (`MIN_BASELINE`). Ohne einen einzigen Faktor gibt es keinen Wert —
 * eine erfundene Zahl waere schlechter als keine.
 */

export const MIN_BASELINE = 3
const NEUTRAL = 70

export type ReadinessFactorKey = 'sleep' | 'resting_hr' | 'hrv' | 'wellness' | 'load'

export interface ReadinessFactor {
  key: ReadinessFactorKey
  /** Beitrag zum Wert in Punkten (+ hilft, − bremst). */
  points: number
  /** Heutiger Wert und eigener Schnitt, fuer die Anzeige. */
  today: number
  average: number
}

export interface ReadinessResult {
  score: number
  level: 'high' | 'normal' | 'low'
  factors: ReadinessFactor[]
}

export interface ReadinessInput {
  /** Schlaf letzte Nacht in Stunden und die Naechte davor (bis 28). */
  sleepHours?: { today: number | null; history: number[] }
  restingHr?: { today: number | null; history: number[] }
  hrvMs?: { today: number | null; history: number[] }
  /** Tagesprotokoll, Skala 0–10. Wird nur genutzt, wenn die Uhr keinen Schlaf liefert. */
  wellness?: { sleep: number | null; energy: number | null }
  /** Einheiten der letzten 28 Tage. */
  sessions?: readonly TrainingSession[]
  now: Date
}

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length
const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const round1 = (value: number) => Math.round(value * 10) / 10

function relative(
  key: ReadinessFactorKey,
  series: { today: number | null; history: number[] } | undefined,
  /** Punkte je 1 % Abweichung; negativ, wenn „mehr" schlechter ist (Ruhepuls). */
  pointsPerPercent: number,
): ReadinessFactor | null {
  if (!series || series.today == null) return null
  const history = series.history.filter(v => Number.isFinite(v) && v > 0)
  if (history.length < MIN_BASELINE) return null
  const average = mean(history)
  if (average <= 0) return null
  const percent = (series.today / average - 1) * 100
  return {
    key,
    points: round1(clamp(percent * pointsPerPercent, -20, 20)),
    today: round1(series.today),
    average: round1(average),
  }
}

/**
 * Trainingslast als Verhaeltnis akut (7 Tage) zu chronisch (28 Tage, je
 * Woche). Ueber 1,3 gilt die Last als sprunghaft gestiegen. Gewichtet wird
 * Dauer × gefuehlte Anstrengung (sRPE); ohne RPE mit 5.
 */
export function loadRatio(sessions: readonly TrainingSession[], now: Date): { acute: number; chronicWeekly: number; ratio: number } | null {
  const day = 24 * 60 * 60 * 1000
  const t = now.getTime()
  const load = (s: TrainingSession) => (sessionDurationS(s) / 60) * (s.rpe ?? 5)
  const last28 = sessions.filter(s => { const at = Date.parse(s.startedAt); return at <= t && at > t - 28 * day })
  if (last28.length < 4) return null
  const acute = last28.filter(s => Date.parse(s.startedAt) > t - 7 * day).reduce((sum, s) => sum + load(s), 0)
  const chronicWeekly = last28.reduce((sum, s) => sum + load(s), 0) / 4
  if (chronicWeekly <= 0) return null
  return { acute: Math.round(acute), chronicWeekly: Math.round(chronicWeekly), ratio: round1(acute / chronicWeekly) }
}

export function computeReadiness(input: ReadinessInput): ReadinessResult | null {
  const factors: ReadinessFactor[] = []

  const sleep = relative('sleep', input.sleepHours, 1)
  if (sleep) factors.push(sleep)
  const hr = relative('resting_hr', input.restingHr, -2)
  if (hr) factors.push(hr)
  const hrv = relative('hrv', input.hrvMs, 0.8)
  if (hrv) factors.push(hrv)

  // Tagesform aus dem Protokoll nur, wenn die Uhr keinen Schlaf liefert —
  // sonst zaehlte derselbe Schlaf doppelt.
  if (!sleep && input.wellness) {
    const values = [input.wellness.sleep, input.wellness.energy].filter((v): v is number => v != null)
    if (values.length > 0) {
      const avg = mean(values)
      factors.push({ key: 'wellness', points: round1(clamp((avg - 5) * 4, -20, 20)), today: round1(avg), average: 5 })
    }
  }

  if (factors.length === 0) return null

  if (input.sessions) {
    const ratio = loadRatio(input.sessions, input.now)
    if (ratio) {
      const points = ratio.ratio > 1.3
        ? -clamp((ratio.ratio - 1.3) * 40, 0, 20)
        : ratio.ratio < 0.8 ? 5 : 0
      factors.push({ key: 'load', points: round1(points), today: ratio.acute, average: ratio.chronicWeekly })
    }
  }

  const score = Math.round(clamp(NEUTRAL + factors.reduce((sum, f) => sum + f.points, 0), 0, 100))
  const level = score >= 78 ? 'high' : score >= 55 ? 'normal' : 'low'
  return { score, level, factors }
}
