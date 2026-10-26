/**
 * Der gewählte Tag, gemeinsam für Kalender und Ernährung: Wer im Kalender den
 * 12.10. ansieht und zur Ernährung wechselt, landet dort auch am 12.10. — und
 * umgekehrt.
 *
 * Nur in sessionStorage und nur, solange es nicht „heute" ist. Gespeichert
 * wird zusätzlich, an welchem Tag gewählt wurde: Nach Mitternacht gilt die
 * Wahl nicht mehr, sonst öffnete die App morgens auf dem Vortag.
 */
import { format } from 'date-fns'

const KEY = 'tyd.sharedDay'
const DAY = /^\d{4}-\d{2}-\d{2}$/

/** Tag als `yyyy-MM-dd` in Ortszeit — der Schlüssel, den Kalender und Ernährung teilen. */
export const dayKey = (d: Date) => format(d, 'yyyy-MM-dd')

export function readSharedDay(today: string): string | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    const v = JSON.parse(raw) as { day?: unknown; on?: unknown }
    if (v.on !== today || typeof v.day !== 'string' || !DAY.test(v.day)) return null
    return v.day
  } catch {
    return null
  }
}

export function writeSharedDay(day: string, today: string): void {
  try {
    if (day === today) sessionStorage.removeItem(KEY)
    else sessionStorage.setItem(KEY, JSON.stringify({ day, on: today }))
  } catch {
    // Privater Modus o. Ä.: dann eben ohne gemeinsamen Tag.
  }
}
