/**
 * Die feste Zone oben (Tageskugel bzw. Gericht-Kugel): immer gleich hoch, die Kugel
 * bleibt beim Scrollen gleich groß im Hintergrund. Unterhalb der Zone schwebt die
 * Zeichenfläche nur noch zart über den Formularen.
 */
import { useEffect, useState } from 'react'

/** Höhe der Kugel-Zone oben (fest). */
export const ZONE_MAX = 316
/** So weit reicht die Zeichenfläche unter die Zone: Monde und Flüge schweben dort nur noch zart über den Formularen. */
export const ZONE_BELOW = 120

/**
 * Größe verfolgen: `resize(w)` bei neuer Breite, danach `stage(h, 1)` mit der
 * (festen) Zonenhöhe. Maske und Abstände direkt am Element, ohne React.
 * Gibt die Aufräum-Funktion zurück.
 */
export function trackZone(zone: HTMLElement, canvas: HTMLCanvasElement, resize: (w: number) => void, stage: (h: number, scale: number) => void): () => void {
  const h = ZONE_MAX
  // Unterhalb der Zone ist die Kugel nur noch ein Hauch.
  const mask = `linear-gradient(to bottom, #000 0px, #000 ${h - 20}px, rgba(0,0,0,0.28) ${h + 26}px, rgba(0,0,0,0.28) 100%)`
  canvas.style.maskImage = mask
  canvas.style.webkitMaskImage = mask
  const size = () => { resize(zone.clientWidth); stage(h, 1) }
  size()
  const ro = new ResizeObserver(size)
  ro.observe(zone)
  window.addEventListener('resize', size)
  // Was ins Bild gescrollt wird (Fokus, Tastatur, scrollIntoView), landet zwischen Zone und Tab-Leiste,
  // nicht darunter — auf kleinen Geräten (iPhone SE) blieb sonst nur ein schmaler Streifen frei.
  const root = document.documentElement.style
  const padBefore = [root.scrollPaddingTop, root.scrollPaddingBottom]
  root.scrollPaddingTop = `calc(env(safe-area-inset-top, 0px) + ${ZONE_MAX + 8}px)`
  root.scrollPaddingBottom = 'calc(env(safe-area-inset-bottom, 0px) + var(--bottom-nav-gap, 10px) + var(--bottom-nav-height, 66px) + 8px)'
  return () => {
    ro.disconnect()
    window.removeEventListener('resize', size)
    ;[root.scrollPaddingTop, root.scrollPaddingBottom] = padBefore
  }
}

/** „Bewegung reduzieren“ des Systems, live. */
export function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(() => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduce(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduce
}
