import { useEffect, useRef, type PointerEvent as ReactPointerEvent } from 'react'

/** So lange gedrückt halten, bis sich die Zeile anhebt. */
export const HALTEN_MS = 380
/** So lange über einem Ziel verweilen, bis es eines wird — wie Ordner auf dem iPhone. */
export const VERWEILEN_MS = 220
/** Bewegt sich der Finger vorher weiter, ist es Scrollen und kein Halten. */
const ZITTERN = 8
const ZURUECK_MS = 380

export interface ZiehQuelle {
  stackItemId: string
  /** Das Bündel, aus dem die Zeile kommt — null, wenn sie einzeln stand. */
  buendelId: string | null
  periode: string
}

export type ZiehZiel =
  | { art: 'einnahme'; stackItemId: string }
  | { art: 'buendel'; buendelId: string }

interface Optionen {
  /** Auf eine Einnahme oder ein Bündel derselben Tageszeit losgelassen. */
  onZusammen: (quelle: ZiehQuelle, ziel: ZiehZiel) => void
  /** Aus dem Bündel heraus in die eigene Tageszeit gezogen. */
  onHeraus: (quelle: ZiehQuelle) => void
  /** In einer anderen Tageszeit losgelassen — dort geht kein Bündel. */
  onAndereTageszeit: (quelle: ZiehQuelle) => void
  /** Text des Feldes, auf dem eine Einnahme aus dem Bündel wieder einzeln wird. */
  wiederEinzeln: string
}

interface Zug {
  quelle: ZiehQuelle
  zeile: HTMLElement
  bild: HTMLElement
  pointerId: number
  start: { x: number; y: number }
  kandidat: { ziel: ZiehZiel; el: Element } | null
  ziel: { ziel: ZiehZiel; el: Element } | null
  verweilen: number | null
  /** Federt schon zurück: nimmt nichts mehr an. */
  zurueck: boolean
  periodeUnter: string | null
  ueberFeld: boolean
  feld: HTMLElement | null
}

const ruhig = () => window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false
const vibrieren = (muster: number | number[]) => {
  try { navigator.vibrate?.(muster) } catch { /* nicht verfügbar */ }
}

/**
 * Einnahmen im Kalender gedrückt halten und aufeinanderziehen, um Bündel zu
 * bilden, zu erweitern oder aufzulösen.
 *
 * Die Liste kennzeichnet sich über Datenattribute:
 * - `data-zieh-zeile` + `data-stack-item` + `data-periode` (+ `data-buendel`)
 *   an jeder ziehbaren Einnahme,
 * - `data-bundle-row` + `data-periode` an jeder Bündelkarte,
 * - `data-periode-abschnitt` an jeder Tageszeit, darin `data-periode-bloecke`.
 *
 * Während des Ziehens setzt der Baustein nur Attribute (`data-zieht` am body,
 * `data-gesperrt`/`data-abgelehnt` an fremden Tageszeiten, `data-zieh-ziel` am
 * Ziel); die Darstellung steht in src/index.css. Gerendert wird erst nach dem
 * Loslassen, über die Rückrufe.
 */
export function useBuendelZiehen(optionen: Optionen) {
  const aktuell = useRef(optionen)
  useEffect(() => { aktuell.current = optionen })
  const druck = useRef<{ zeile: HTMLElement; x: number; y: number; pointerId: number; timer: number } | null>(null)
  const zug = useRef<Zug | null>(null)
  /** Nach dem Loslassen feuert der Browser ein `click` — das ist kein Tipp. */
  const klickSperre = useRef(false)
  /** Hebt die gehaltene Zeile an; der Effekt unten setzt sie. */
  const anhebenRef = useRef<() => void>(() => {})

  useEffect(() => {
    const aufraeumenDruck = () => {
      if (druck.current) window.clearTimeout(druck.current.timer)
      druck.current = null
    }

    const beenden = () => {
      const z = zug.current
      if (!z) return
      if (z.verweilen) window.clearTimeout(z.verweilen)
      z.ziel?.el.removeAttribute('data-zieh-ziel')
      z.bild.remove()
      z.feld?.remove()
      z.zeile.removeAttribute('data-zieh-platzhalter')
      document.body.removeAttribute('data-zieht')
      document.querySelectorAll('[data-periode-abschnitt]').forEach(el => {
        el.removeAttribute('data-gesperrt')
        el.removeAttribute('data-abgelehnt')
      })
      zug.current = null
      sperreKlick()
    }

    /** Das `click` nach dem Loslassen ist kein Tipp — auch wenn die Zeile erst noch zurückfedert. */
    const sperreKlick = () => {
      klickSperre.current = true
      window.setTimeout(() => { klickSperre.current = false }, 0)
    }

    const zurueckfedern = () => {
      const z = zug.current
      if (!z) return
      if (ruhig()) { beenden(); return }
      z.zurueck = true
      z.ziel?.el.removeAttribute('data-zieh-ziel')
      if (z.verweilen) window.clearTimeout(z.verweilen)
      z.bild.style.transition = `transform ${ZURUECK_MS}ms var(--tyd-ease-drawer)`
      z.bild.style.transform = 'translate(0px, 0px)'
      z.bild.removeAttribute('data-angehoben')
      // Bis es zurück ist, nimmt nichts mehr an.
      const mein = z
      window.setTimeout(() => { if (zug.current === mein) beenden() }, ZURUECK_MS)
    }

    const anheben = () => {
      const d = druck.current
      druck.current = null
      if (!d) return
      const { zeile, x, y, pointerId } = d
      const stackItemId = zeile.dataset.stackItem
      const periode = zeile.dataset.periode
      if (!stackItemId || !periode) return
      const rect = zeile.getBoundingClientRect()
      const bild = zeile.cloneNode(true) as HTMLElement
      bild.removeAttribute('data-zieh-zeile')
      bild.removeAttribute('data-due-row')
      bild.setAttribute('aria-hidden', 'true')
      bild.setAttribute('data-ziehbild', '')
      bild.style.left = `${rect.left}px`
      bild.style.top = `${rect.top}px`
      bild.style.width = `${rect.width}px`
      bild.style.transformOrigin = `${x - rect.left}px ${y - rect.top}px`
      document.body.append(bild)
      requestAnimationFrame(() => bild.setAttribute('data-angehoben', ''))
      zeile.setAttribute('data-zieh-platzhalter', '')
      document.body.setAttribute('data-zieht', '')
      document.querySelectorAll<HTMLElement>('[data-periode-abschnitt]').forEach(el => {
        if (el.dataset.periodeAbschnitt !== periode) el.setAttribute('data-gesperrt', '')
      })
      const buendelId = zeile.dataset.buendel ?? null
      // Aus einem Bündel gezogen: unten in der Tageszeit steht das Feld zum Herausnehmen.
      let feld: HTMLElement | null = null
      if (buendelId) {
        feld = document.createElement('div')
        feld.setAttribute('data-wieder-einzeln', '')
        feld.textContent = aktuell.current.wiederEinzeln
        document.querySelector(`[data-periode-abschnitt="${CSS.escape(periode)}"] [data-periode-bloecke]`)?.append(feld)
      }
      zug.current = {
        quelle: { stackItemId, buendelId, periode },
        zeile, bild, pointerId, start: { x, y },
        kandidat: null, ziel: null, verweilen: null, zurueck: false, periodeUnter: periode, ueberFeld: false, feld,
      }
      vibrieren(10)
    }

    anhebenRef.current = anheben

    const bewegen = (x: number, y: number) => {
      const z = zug.current
      if (!z || z.zurueck) return
      z.bild.style.transform = `translate(${x - z.start.x}px, ${y - z.start.y}px)`
      const unter = document.elementFromPoint(x, y)
      const abschnitt = unter?.closest<HTMLElement>('[data-periode-abschnitt]') ?? null
      z.periodeUnter = abschnitt?.dataset.periodeAbschnitt ?? null
      document.querySelectorAll('[data-abgelehnt]').forEach(el => { if (el !== abschnitt) el.removeAttribute('data-abgelehnt') })
      if (abschnitt && z.periodeUnter !== z.quelle.periode) abschnitt.setAttribute('data-abgelehnt', '')
      z.ueberFeld = Boolean(unter?.closest('[data-wieder-einzeln]'))
      z.feld?.toggleAttribute('data-aktiv', z.ueberFeld)

      let kandidat: Zug['kandidat'] = null
      if (z.periodeUnter === z.quelle.periode && !z.ueberFeld) {
        const karte = unter?.closest<HTMLElement>('[data-bundle-row]')
        const zeile = unter?.closest<HTMLElement>('[data-zieh-zeile]')
        if (karte) {
          // Das eigene Bündel ist kein Ziel, eines mit derselben Substanz auch nicht.
          const mitglieder = karte.dataset.mitglieder?.split(' ') ?? []
          if (karte.dataset.bundleRow !== z.quelle.buendelId && !mitglieder.includes(z.quelle.stackItemId)) {
            kandidat = { ziel: { art: 'buendel', buendelId: karte.dataset.bundleRow! }, el: karte }
          }
        } else if (zeile && zeile !== z.zeile && zeile.dataset.stackItem && zeile.dataset.stackItem !== z.quelle.stackItemId) {
          kandidat = { ziel: { art: 'einnahme', stackItemId: zeile.dataset.stackItem }, el: zeile }
        }
      }
      if (kandidat?.el !== z.kandidat?.el) {
        if (z.verweilen) window.clearTimeout(z.verweilen)
        z.kandidat = kandidat
        z.ziel?.el.removeAttribute('data-zieh-ziel')
        z.ziel = null
        if (kandidat) {
          z.verweilen = window.setTimeout(() => {
            if (zug.current !== z || z.kandidat !== kandidat) return
            z.ziel = kandidat
            kandidat.el.setAttribute('data-zieh-ziel', '')
            vibrieren(8)
          }, VERWEILEN_MS)
        }
      }
    }

    const onMove = (event: PointerEvent) => {
      const d = druck.current
      if (d && event.pointerId === d.pointerId && Math.hypot(event.clientX - d.x, event.clientY - d.y) > ZITTERN) {
        aufraeumenDruck()   // das war Scrollen
      }
      if (zug.current && event.pointerId === zug.current.pointerId) bewegen(event.clientX, event.clientY)
    }
    const onUp = (event: PointerEvent) => {
      if (druck.current && event.pointerId === druck.current.pointerId) aufraeumenDruck()
      const z = zug.current
      if (!z || event.pointerId !== z.pointerId) return
      sperreKlick()
      if (z.zurueck) return
      const { quelle, ziel, periodeUnter, ueberFeld } = z
      const unter = document.elementFromPoint(event.clientX, event.clientY)
      if (ziel) { beenden(); aktuell.current.onZusammen(quelle, ziel.ziel); return }
      if (periodeUnter && periodeUnter !== quelle.periode) {
        vibrieren([12, 60, 12])
        zurueckfedern()
        aktuell.current.onAndereTageszeit(quelle)
        return
      }
      if (quelle.buendelId && (ueberFeld || (periodeUnter === quelle.periode && !unter?.closest('[data-bundle-row]')))) {
        beenden(); aktuell.current.onHeraus(quelle); return
      }
      zurueckfedern()
    }
    const onCancel = (event: PointerEvent) => {
      if (druck.current && event.pointerId === druck.current.pointerId) aufraeumenDruck()
      if (zug.current && event.pointerId === zug.current.pointerId && !zug.current.zurueck) zurueckfedern()
    }
    // Während des Ziehens scrollt die Seite nicht.
    const onTouchMove = (event: TouchEvent) => { if (zug.current) event.preventDefault() }
    const onContextMenu = (event: MouseEvent) => {
      if (druck.current || zug.current) event.preventDefault()
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('contextmenu', onContextMenu)
    return () => {
      aufraeumenDruck()
      beenden()
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('contextmenu', onContextMenu)
    }
  }, [])

  /** An den Container der Tagesliste: startet das Halten auf einer ziehbaren Zeile. */
  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    if (zug.current) return
    const ziel = event.target as Element
    // Der Kreis zum Bestätigen und andere eigene Knöpfe bleiben Knöpfe.
    if (ziel.closest('[data-kein-ziehen]')) return
    const zeile = ziel.closest<HTMLElement>('[data-zieh-zeile]')
    if (!zeile) return
    if (druck.current) window.clearTimeout(druck.current.timer)
    druck.current = {
      zeile, x: event.clientX, y: event.clientY, pointerId: event.pointerId,
      timer: window.setTimeout(() => anhebenRef.current(), HALTEN_MS),
    }
  }

  /** In `onClick` der Zeile prüfen: true heisst, der Klick kam vom Loslassen. */
  const klickNachZiehen = () => klickSperre.current

  return { onPointerDown, klickNachZiehen }
}
