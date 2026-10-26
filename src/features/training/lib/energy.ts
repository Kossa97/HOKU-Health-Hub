import type { TrainingSession } from '../types'
import { metForIntensity } from '../data/met'
import { sessionDurationS } from './stats'

/**
 * Verbrauch einer Einheit in kcal.
 *
 * Liefert die Uhr einen Wert, gilt der. Sonst eine Schaetzung nach MET:
 * kcal = MET × kg Koerpergewicht × Stunden. Gezaehlt wird der Gesamtverbrauch
 * waehrend der Einheit — so, wie Uhren ihn als „aktive + Ruhe-Kalorien"
 * fuehren. Ohne Koerpergewicht keine Schaetzung (0), statt mit einem
 * Standardmenschen zu rechnen.
 */
export function sessionKcal(session: TrainingSession, bodyWeightKg: number | null): number {
  if (session.kcal != null) return session.kcal
  if (!bodyWeightKg || bodyWeightKg <= 0) return 0
  const hours = sessionDurationS(session) / 3600
  if (hours <= 0) return 0
  return Math.round(metForIntensity(session.kind, session.rpe) * bodyWeightKg * hours)
}

/** Ortsdatum `YYYY-MM-DD` eines Zeitpunkts. */
export function localDateKey(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Schnittstelle fuer den Kalorientracker: Trainingsverbrauch eines Tages
 * (Ortszeit). Der Kalorientracker ruft das auf, statt selbst Einheiten zu lesen.
 */
export function trainingEnergyForDay(
  sessions: readonly TrainingSession[],
  dateKey: string,
  bodyWeightKg: number | null,
): { kcal: number; sessions: number; estimated: boolean } {
  const day = sessions.filter(s => localDateKey(s.startedAt) === dateKey)
  return {
    kcal: day.reduce((sum, s) => sum + sessionKcal(s, bodyWeightKg), 0),
    sessions: day.length,
    estimated: day.some(s => s.kcal == null),
  }
}
