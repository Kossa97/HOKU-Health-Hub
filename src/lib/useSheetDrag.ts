import { useRef, type PointerEvent } from 'react'
import { SHEET_CLOSE_MS } from './useSheetClose'

/** Ab diesem Weg (px) schliesst das Blatt auch ohne Schwung. */
const WEG_SCHWELLE = 110
/** Ab diesem Tempo (px/ms) schliesst ein kurzer Wurf nach unten. */
const WURF_TEMPO = 0.5
/** Mindestweg fuer einen Wurf — ein Zucken ist kein Wurf. */
const WURF_MIN = 24
/** Erst ab diesem Weg ist es ein Ziehen und kein Tipp. */
const ZIEH_START = 6
const ZURUECK_MS = 300

/**
 * Ein Blatt nach unten wegziehen, wie in iOS.
 *
 * `blatt` kommt ans Blatt, `griffe` auf eine Zone (Griff, Kopfzeile), nicht
 * aufs ganze Blatt: darunter wischt das Raster seitwaerts und das Blatt scrollt
 * senkrecht, beides soll bleiben. Die Zone braucht `touch-action: none`, sonst nimmt der Browser
 * das Ziehen als Scrollen und bricht den Zeiger ab.
 *
 * Waehrend des Ziehens folgt das Blatt dem Finger direkt ueber `transform`.
 * Die Ein- und Ausfahrt des Blatts laeuft als CSS-Animation, und die schlaegt
 * jedes Inline-`transform`; `data-gezogen` schaltet sie deshalb ab (src/index.css).
 * Nach oben gibt das Blatt nur zaeh nach — es steht schon am Anschlag.
 */
export function useSheetDrag<T extends HTMLElement>(schliessen: () => void) {
  /** Kommt ans Blatt selbst; der Rest sind die Griffe fuer die Zone. */
  const blatt = useRef<T>(null)
  const start = useRef<{ y: number; id: number; gezogen: boolean; basis: number } | null>(null)
  const proben = useRef<{ y: number; t: number }[]>([])

  const setze = (versatz: number, uebergang: string | null) => {
    const el = blatt.current
    if (!el) return
    el.style.transition = uebergang ?? 'none'
    el.style.transform = versatz === 0 ? '' : `translateY(${versatz}px)`
  }

  const zurueck = () => {
    setze(0, `transform ${ZURUECK_MS}ms var(--tyd-ease-drawer)`)
  }

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    // Ein zweiter Finger setzt nicht mitten im Ziehen neu an. Ein Tipp, dessen
    // Loslassen ausserhalb der Zone lag, blockiert dagegen nichts — und ebenso
    // wenig ein Ziehen, dessen Blatt inzwischen auf anderem Weg zuging: ein
    // frisch geoeffnetes Blatt traegt `data-gezogen` noch nicht.
    if (start.current?.gezogen && blatt.current?.dataset.gezogen !== undefined) return
    start.current = { y: event.clientY, id: event.pointerId, gezogen: false, basis: 0 }
    proben.current = [{ y: event.clientY, t: performance.now() }]
  }

  const onPointerMove = (event: PointerEvent<HTMLElement>) => {
    const s = start.current
    if (!s || s.id !== event.pointerId) return
    // Maus oder Stift ohne gedrueckte Taste: das Loslassen lag ausserhalb.
    if (event.pointerType !== 'touch' && event.buttons === 0) {
      start.current = null
      if (s.gezogen) zurueck()
      return
    }
    const dy = event.clientY - s.y
    if (!s.gezogen) {
      if (Math.abs(dy) < ZIEH_START) return
      s.gezogen = true
      // Erst ab hier gehoert der Zeiger dem Ziehen: ein Tipp auf das Kreuz
      // oder die Pfeile in der Kopfzeile bleibt ein Tipp.
      event.currentTarget.setPointerCapture?.(event.pointerId)
      const el = blatt.current
      if (el) {
        // Faehrt das Blatt gerade noch ein, uebernimmt der Finger es dort,
        // wo es steht, statt es ans Ende springen zu lassen.
        const steht = getComputedStyle(el).transform
        s.basis = steht && steht !== 'none' ? new DOMMatrixReadOnly(steht).m42 : 0
        el.dataset.gezogen = ''
      }
    }
    proben.current = [...proben.current.slice(-4), { y: event.clientY, t: performance.now() }]
    // Nach oben mit wachsendem Widerstand statt hart am Anschlag.
    const weg = s.basis + dy
    setze(weg >= 0 ? weg : -Math.sqrt(-weg) * 2, null)
  }

  const onPointerUp = (event: PointerEvent<HTMLElement>) => {
    const s = start.current
    // Hebt ein anderer Finger ab, laeuft das Ziehen weiter.
    if (!s || s.id !== event.pointerId) return
    start.current = null
    if (!s.gezogen) return
    const dy = event.clientY - s.y
    const jetzt = performance.now()
    // Stand der Finger zuletzt still, ist das Tempo null — kein Wurf.
    const probe = proben.current.find(p => jetzt - p.t <= 100)
    const tempo = probe ? (event.clientY - probe.y) / Math.max(1, jetzt - probe.t) : 0
    const el = blatt.current
    if (el && (s.basis + dy >= WEG_SCHWELLE || (tempo > WURF_TEMPO && dy >= WURF_MIN))) {
      const ruhig = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
      if (!ruhig) {
        // Aus der Hand weiter nach unten; der Hintergrund blendet ueber das
        // normale Schliessen aus, das Blatt faehrt nicht noch einmal ein.
        el.dataset.gezogen = 'weg'
        setze(el.offsetHeight + 24, `transform ${SHEET_CLOSE_MS}ms var(--tyd-ease-out)`)
      }
      // Mit reduzierter Bewegung blendet es dort aus, wo der Finger es liess.
      schliessen()
      return
    }
    zurueck()
  }

  const onPointerCancel = (event: PointerEvent<HTMLElement>) => {
    const s = start.current
    if (!s || s.id !== event.pointerId) return
    start.current = null
    if (s.gezogen) zurueck()
  }

  return { blatt, griffe: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel } }
}
