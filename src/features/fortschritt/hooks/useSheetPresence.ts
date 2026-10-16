import { useEffect, useState } from 'react'

/** Ausfahren ist kürzer als Einfahren: das System antwortet, der Nutzer wartet nicht. */
export const SHEET_EXIT_MS = 240

/**
 * Hält ein Sheet nach dem Schließen so lange im DOM, bis es hinausgefahren ist.
 *
 * - `mounted`: offen, oder noch beim Hinausfahren.
 * - `shown`: erst einen Frame nach dem Einhängen true, damit die Transition
 *   vom geschlossenen Zustand aus startet; beim Schließen sofort false.
 *
 * Beides wird aus `open` abgeleitet, Zustand ändert sich nur in Frame- und
 * Timer-Callbacks. Wird während des Hinausfahrens wieder geöffnet, ist
 * `entered` noch true — die Transition läuft vom aktuellen Wert zurück.
 */
export function useSheetPresence(open: boolean, exitMs = SHEET_EXIT_MS) {
  const [entered, setEntered] = useState(false)
  const [lingering, setLingering] = useState(false)

  useEffect(() => {
    if (open) {
      let second = 0
      const first = requestAnimationFrame(() => {
        second = requestAnimationFrame(() => {
          setEntered(true)
          setLingering(true)
        })
      })
      return () => {
        cancelAnimationFrame(first)
        cancelAnimationFrame(second)
      }
    }
    const timer = window.setTimeout(() => {
      setEntered(false)
      setLingering(false)
    }, exitMs)
    return () => window.clearTimeout(timer)
  }, [open, exitMs])

  return { mounted: open || lingering, shown: open && entered }
}
