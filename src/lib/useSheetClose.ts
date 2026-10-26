import { useCallback, useEffect, useRef, useState } from 'react'

/** So lange laeuft `tyd-sheet-out` (src/index.css). */
export const SHEET_CLOSE_MS = 200

/**
 * Schliessen mit Ausblenden: erst `data-closing` setzen, damit das Blatt
 * hinausfaehrt, dann wirklich schliessen.
 *
 * `open` meldet, ob das Blatt gerade steht; ohne Angabe gilt es als offen
 * (der Hook sitzt dann im Blatt selbst und stirbt mit ihm).
 *
 * Nur fuer Wege, die der Nutzer waehlt (Kreuz, Hintergrund, Abbrechen,
 * Escape). Schliesst die Seite das Blatt selbst, etwa nach dem Speichern,
 * darf es sofort verschwinden.
 */
export function useSheetClose(onClose: () => void, open = true) {
  const [closing, setClosing] = useState(false)
  const timer = useRef<number | null>(null)
  const latest = useRef(onClose)
  useEffect(() => { latest.current = onClose })
  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
  }, [])
  // Lebt der Hook laenger als sein Blatt (eine Seite mit mehreren Blaettern
  // nacheinander), darf ein angefangenes Schliessen nicht das NAECHSTE Blatt
  // treffen: geht das Blatt auf anderem Weg zu, ist der Vorgang erledigt.
  const [warOffen, setWarOffen] = useState(open)
  if (open !== warOffen) {
    setWarOffen(open)
    if (!open) setClosing(false)
  }
  useEffect(() => {
    if (open || timer.current === null) return
    window.clearTimeout(timer.current)
    timer.current = null
  }, [open])

  const requestClose = useCallback(() => {
    if (timer.current !== null) return
    const reduce = typeof window !== 'undefined'
      && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    setClosing(true)
    timer.current = window.setTimeout(() => {
      timer.current = null
      setClosing(false)
      latest.current()
    }, reduce ? 150 : SHEET_CLOSE_MS)
  }, [])

  return { closing, requestClose, closingProps: closing ? { 'data-closing': '' } : {} }
}
