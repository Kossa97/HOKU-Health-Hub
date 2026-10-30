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
/** Wie zaeh ein festgehaltenes Blatt nach unten nachgibt (Apple-Gummiband). */
const ZAEH = 0.15
/** Was in einer Zone selbst angetippt wird und den Zeiger behalten muss. */
const BEDIENBAR = 'button, a, input, select, textarea, label, summary, [role="button"], [role="tab"], '
  + '[role="switch"], [role="checkbox"], [role="radio"], [tabindex]:not([tabindex="-1"])'

/**
 * Ein Blatt nach unten wegziehen, wie in iOS.
 *
 * `griffe` kommen auf eine Zone (Griff, Kopfzeile), nicht aufs ganze Blatt:
 * darunter scrollt das Blatt oder wischt ein Raster seitwaerts, das soll
 * bleiben. Die Zone braucht `touch-action: none`, sonst nimmt der Browser das
 * Ziehen als Scrollen und bricht den Zeiger ab. Das Blatt ist `blatt`, wenn es
 * daran haengt, sonst das naechste Blatt (`.lg-sheet` oder Dialog) ueber der
 * Zone — so braucht ein
 * Blatt nur den Griff (src/components/ui/SheetGriff.tsx).
 *
 * Schliesst das Blatt ohne eigene Ausfahrt (ohne `tyd-sheet`), wartet
 * `schliessen`, bis es aus dem Bild geglitten ist.
 *
 * Waehrend des Ziehens folgt das Blatt dem Finger direkt ueber `transform`.
 * Die Ein- und Ausfahrt des Blatts laeuft als CSS-Animation, und die schlaegt
 * jedes Inline-`transform`; `data-gezogen` schaltet sie deshalb ab (src/index.css).
 * Nach oben gibt das Blatt nur zaeh nach — es steht schon am Anschlag.
 *
 * `festhalten`: solange es `true` liefert (etwa bei ungespeicherten
 * Eingaben), gibt das Blatt auch nach unten nur zaeh nach und federt
 * zurueck, statt wegzufahren; ein Zug, der sonst geschlossen haette,
 * meldet sich stattdessen bei `beiFesthalten`.
 */
export function useSheetDrag<T extends HTMLElement>(
  schliessen: () => void,
  { festhalten, beiFesthalten }: { festhalten?: () => boolean; beiFesthalten?: () => void } = {},
) {
  /** Kommt ans Blatt selbst; der Rest sind die Griffe fuer die Zone. */
  const blatt = useRef<T>(null)
  /** Das Blatt dieses Zugs — `blatt` oder das naechste Blatt ueber der Zone. */
  const ziel = useRef<HTMLElement | null>(null)
  const start = useRef<{ y: number; id: number; gezogen: boolean; basis: number } | null>(null)
  const proben = useRef<{ y: number; t: number }[]>([])

  const setze = (versatz: number, uebergang: string | null) => {
    const el = ziel.current
    if (!el) return
    el.style.transition = uebergang ?? 'none'
    el.style.transform = versatz === 0 ? '' : `translateY(${versatz}px)`
  }

  const zurueck = () => {
    setze(0, `transform ${ZURUECK_MS}ms var(--tyd-ease-drawer)`)
  }

  /** Lehnt das Blatt das Schliessen ab (ungespeicherte Aenderungen, Speichern
   *  laeuft), kommt es zurueck, statt unsichtbar stehen zu bleiben. */
  const fallsEsBleibt = (el: HTMLElement, runden = 3) => {
    window.setTimeout(() => {
      if (!el.isConnected) return
      // Faehrt es gerade aus, noch einmal nachsehen: wird es dabei wieder
      // geoeffnet, steht es sonst unsichtbar und taub da.
      if (el.hasAttribute('data-closing')) {
        if (runden > 1) fallsEsBleibt(el, runden - 1)
        return
      }
      // Hat der Finger es schon wieder gegriffen, gehoert es ihm.
      if (start.current?.gezogen) return
      ziel.current = el
      el.dataset.gezogen = ''
      el.style.pointerEvents = ''
      zurueck()
    }, SHEET_CLOSE_MS + 150)
  }

  const onPointerDown = (event: PointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    // Ein zweiter Finger setzt nicht mitten im Ziehen neu an. Ein Tipp, dessen
    // Loslassen ausserhalb der Zone lag, blockiert dagegen nichts — und ebenso
    // wenig ein Ziehen, dessen Blatt inzwischen auf anderem Weg zuging: ein
    // frisch geoeffnetes Blatt traegt `data-gezogen` noch nicht.
    if (start.current?.gezogen && ziel.current?.isConnected && ziel.current.dataset.gezogen !== undefined) return
    ziel.current = blatt.current ?? event.currentTarget.closest<HTMLElement>('.lg-sheet, [role="dialog"], [role="alertdialog"]')
    start.current = { y: event.clientY, id: event.pointerId, gezogen: false, basis: 0 }
    // Den Zeiger gleich festhalten, sonst verlaesst eine Maus den schmalen Griff,
    // bevor das Ziehen erkannt ist. Nur nicht auf einem Knopf in der Zone: dort
    // landete der Klick sonst auf der Zone statt auf dem Knopf (Finger halten
    // ihr Ziel ohnehin selbst fest).
    const knopf = (event.target as Element).closest(BEDIENBAR)
    if (!knopf || !event.currentTarget.contains(knopf)) event.currentTarget.setPointerCapture?.(event.pointerId)
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
      const el = ziel.current
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
    if (weg < 0) setze(-Math.sqrt(-weg) * 2, null)
    else if (festhalten?.()) {
      const hoehe = ziel.current?.offsetHeight || 600
      setze((weg * hoehe * ZAEH) / (hoehe + ZAEH * weg), null)
    } else setze(weg, null)
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
    const el = ziel.current
    // Geschlossen wird nach dem Weg des Fingers, nicht nach der Lage des
    // Blatts: griff er es, als es noch einfuhr, stand es schon tief, und ein
    // kurzes Ziehen haette es sonst weggeschickt. Steht es nach dem Zug aber
    // mehr als halb aus dem Bild, geht es zu — dann wollte er es weghaben.
    const halbWeg = el ? s.basis + dy >= el.offsetHeight / 2 && dy >= WURF_MIN : false
    if (el && (dy >= WEG_SCHWELLE || halbWeg || (tempo > WURF_TEMPO && dy >= WURF_MIN))) {
      if (festhalten?.()) {
        zurueck()
        beiFesthalten?.()
        return
      }
      const ruhig = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
      if (!ruhig) {
        // Aus der Hand weiter nach unten; der Hintergrund blendet ueber das
        // normale Schliessen aus, das Blatt faehrt nicht noch einmal ein.
        el.dataset.gezogen = 'weg'
        el.style.pointerEvents = 'none'
        setze(el.offsetHeight + 24, `transform ${SHEET_CLOSE_MS}ms var(--tyd-ease-out)`)
        // Ohne eigene Ausfahrt verschwaende das Blatt sofort; erst gleiten lassen.
        if (!el.classList.contains('tyd-sheet')) {
          window.setTimeout(() => {
            // Ging es inzwischen ueber Hintergrund oder Escape zu, nicht noch einmal.
            if (!el.isConnected) return
            schliessen()
            fallsEsBleibt(el)
          }, SHEET_CLOSE_MS)
          return
        }
      }
      // Mit reduzierter Bewegung blendet es dort aus, wo der Finger es liess.
      schliessen()
      fallsEsBleibt(el)
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
