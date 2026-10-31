import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'

/**
 * Das Vollbild hinter einem Objekt der Buehne.
 *
 * Der Uebergang ist FLIP: das angetippte Objekt wird an seinem Platz im
 * Karussell GEMESSEN, im Vollbild an seiner Zielstelle gezeichnet, und die
 * Differenz zwischen beiden als `transform` abgespielt. Damit bewegt sich
 * nichts im Layout — nur eine Matrix —, und es laeuft in jeder WebView, ohne
 * dass wir erst Browserunterstuetzung fuer die View-Transitions-API pruefen
 * muessen.
 *
 * Die Objekte sind SVG mit `viewBox`, deshalb ist das Verkleinern verlustfrei
 * und braucht kein zweites Bild.
 */
export interface StageDetailSheetProps {
  /** Rechteck des angetippten Objekts im Karussell, in Bildschirmkoordinaten. */
  originRect: DOMRect
  /** Das Objekt selbst — dieselbe Buehne, nur kleiner. */
  stage: ReactNode
  title: string
  /**
   * Knoepfe rechts neben dem Objekt (Bearbeiten, Loeschen) — nur Symbole,
   * darum mit `aria-label`. Links bleibt frei, damit das Objekt mittig steht.
   */
  sideActions?: ReactNode
  /** Eine Aktion mit Text unter dem Namen, etwa „Neues Vial anmischen". */
  belowTitle?: ReactNode
  /** Oben links, gegenueber dem Schliessen-Knopf — etwa die Haltbarkeit. */
  topLeft?: ReactNode
  children: ReactNode
  onClose: () => void
  /** Waehrend des Flugs still: schwappende Fluessigkeit im Flug wirkt falsch. */
  onFlightChange?: (imFlug: boolean) => void
}

const FLUGDAUER_MS = 340

function magBewegen(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return true
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function StageDetailSheet({
  originRect, stage, title, sideActions, belowTitle, topLeft, children, onClose, onFlightChange,
}: StageDetailSheetProps) {
  const objektRef = useRef<HTMLDivElement>(null)
  const [gelandet, setGelandet] = useState(false)
  const bewegen = magBewegen()

  useLayoutEffect(() => {
    const objekt = objektRef.current
    if (!objekt || !bewegen) {
      setGelandet(true)
      return
    }

    // FIRST ist `originRect`, LAST ist die Stelle, an der das Objekt jetzt
    // steht. INVERT: die Differenz als Transform setzen, ohne Uebergang.
    const ziel = objekt.getBoundingClientRect()
    if (ziel.width === 0 || ziel.height === 0) {
      setGelandet(true)
      return
    }
    const skala = originRect.width / ziel.width
    const dx = originRect.left - ziel.left
    const dy = originRect.top - ziel.top

    onFlightChange?.(true)
    objekt.style.transition = 'none'
    objekt.style.transformOrigin = 'top left'
    objekt.style.transform = `translate(${dx}px, ${dy}px) scale(${skala})`

    // Lesen erzwingt den Umbruch, damit der Startzustand wirklich gilt —
    // ohne das fasst der Browser beide Schreibvorgaenge zusammen und es gibt
    // gar keine Bewegung.
    void objekt.getBoundingClientRect()

    const bild = requestAnimationFrame(() => {
      objekt.style.transition = `transform ${FLUGDAUER_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`
      objekt.style.transform = 'none'
    })
    const gelandetAb = window.setTimeout(() => {
      setGelandet(true)
      onFlightChange?.(false)
    }, FLUGDAUER_MS)

    return () => {
      cancelAnimationFrame(bild)
      window.clearTimeout(gelandetAb)
      onFlightChange?.(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Zurueck mit der Escape-Taste, wie bei jedem anderen Vollbild auch.
  useEffect(() => {
    const beiTaste = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', beiTaste)
    return () => window.removeEventListener('keydown', beiTaste)
  }, [onClose])

  return (
    <div
      data-stage-detail
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex touch-pan-y flex-col overflow-x-hidden overflow-y-auto overscroll-x-none lg-backdrop"
    >
      {/* Das Vollbild liegt auch unter der Statuszeile des iPhones (Uhr,
          Akku). Ohne den Abstand der Schutzzone sass der Schliessen-Knopf
          mitten in der Akkuanzeige — die anderen Vollbilder halten ihn schon. */}
      <div className="flex items-center justify-between gap-3 pb-3 pl-[calc(1rem+env(safe-area-inset-left))] pr-[calc(1rem+env(safe-area-inset-right))] pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <div data-stage-detail-top-left className="flex min-w-0">{topLeft}</div>
        <button
          type="button"
          onClick={onClose}
          data-app-back-close
          aria-label="Schließen"
          className="lg-glass lg-icon-btn lg-press shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex flex-col items-center px-4">
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3">
          <span aria-hidden="true" />
          <div ref={objektRef} data-stage-detail-object className="will-change-transform">
            {stage}
          </div>
          <div data-stage-detail-actions className="flex flex-col items-start gap-3">
            {sideActions}
          </div>
        </div>
        <h2 className="mt-3 text-center text-[28px] font-medium leading-[34px] text-[var(--lg-text)]">{title}</h2>
        {belowTitle && <div className="mt-4 w-full max-w-xs">{belowTitle}</div>}
      </div>

      {/* Erst wenn das Objekt steht, kommen die Angaben — gestaffelt, damit
          man dem Blick folgt statt alles auf einmal hinzuwerfen. */}
      <div
        data-stage-detail-body
        className={`mx-auto mt-3 w-full max-w-xl flex-1 px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          gelandet ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0'
        }`}
      >
        {children}
      </div>
    </div>
  )
}
