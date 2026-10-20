/**
 * Die feste Zone oben (Tageskugel bzw. Gericht-Kugel): Sie schrumpft beim Scrollen,
 * die Kugel darin höchstens auf 80 %. Unterhalb der Zone schwebt die Zeichenfläche
 * nur noch zart über den Formularen.
 */
import { useEffect, useState } from 'react'

/** Höhe der Kugel-Zone oben; beim Scrollen schrumpft sie auf ZONE_MIN. */
export const ZONE_MAX = 300
export const ZONE_MIN = 240
/** So weit reicht die Zeichenfläche unter die Zone: Monde und Flüge schweben dort nur noch zart über den Formularen. */
export const ZONE_BELOW = 120

/**
 * Scrollen und Größe verfolgen. `resize(w)` bei neuer Breite (danach wird der
 * Scroll-Stand neu angewendet), `stage(h, scale)` bei neuer Zonenhöhe: Mitte der
 * Kugel bei `h * 0.4`, `scale` 0,8–1. Werte direkt am Element, ohne React.
 * Gibt die Aufräum-Funktion zurück.
 */
export function trackZone(zone: HTMLElement, canvas: HTMLCanvasElement, resize: (w: number) => void, stage: (h: number, scale: number) => void): () => void {
  let lastH = -1
  const onScroll = () => {
    const h = Math.max(ZONE_MIN, ZONE_MAX - Math.max(0, window.scrollY))
    if (h === lastH) return
    lastH = h
    zone.style.height = `${h}px`
    stage(h, 0.8 + (0.2 * (h - ZONE_MIN)) / (ZONE_MAX - ZONE_MIN))
    // Unterhalb der Zone ist die Kugel nur noch ein Hauch.
    const mask = `linear-gradient(to bottom, #000 0px, #000 ${h - 20}px, rgba(0,0,0,0.28) ${h + 26}px, rgba(0,0,0,0.28) 100%)`
    canvas.style.maskImage = mask
    canvas.style.webkitMaskImage = mask
  }
  // Neue Größe setzt die Mitte zurück — danach den Scroll-Stand wieder anwenden.
  const size = () => { resize(zone.clientWidth); lastH = -1; onScroll() }
  size()
  window.addEventListener('scroll', onScroll, { passive: true })
  const ro = new ResizeObserver(size)
  ro.observe(zone)
  window.addEventListener('resize', size)
  return () => {
    window.removeEventListener('scroll', onScroll)
    ro.disconnect()
    window.removeEventListener('resize', size)
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
