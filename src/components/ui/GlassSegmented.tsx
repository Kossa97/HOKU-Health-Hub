import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { denyProps } from '../../lib/denyFeedback'

export interface SegmentOption<K extends string> {
  key: K
  label: string
  /** Gesperrt, aber antippbar: der Grund erscheint als Hinweis. */
  denyReason?: string
}

interface Props<K extends string> {
  options: SegmentOption<K>[]
  value: K
  onChange: (key: K) => void
  ariaLabel: string
  /** Gleich breite Segmente (Zeitraum) statt nach Textlänge (Messwerte). */
  equal?: boolean
  /** Glas für schwebende Leisten (Standard), Füllung für Umschalter im Inhalt */
  material?: 'glass' | 'fill'
  /** Viele Einträge: die Kapsel steht fest, nur die Einträge darin scrollen seitlich. */
  scroll?: boolean
  className?: string
}

/**
 * Umschalter mit gleitender Markierung. Die Markierung misst das aktive
 * Segment und gleitet per transform dorthin (iOS-Drawer-Kurve); beim ersten
 * Zeichnen springt sie ohne Animation an ihren Platz.
 */
export function GlassSegmented<K extends string>({ options, value, onChange, ariaLabel, equal = false, material = 'glass', scroll = false, className = '' }: Props<K>) {
  const trackRef = useRef<HTMLDivElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)
  const [pill, setPill] = useState<{ x: number; w: number } | null>(null)
  const [animate, setAnimate] = useState(false)
  // Die Aufrufer bauen die Liste je Render neu; gemessen wird nur, wenn sich Inhalt oder Auswahl ändern.
  const optionsKey = options.map(o => `${o.key}:${o.label}`).join('|')

  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track) return
    const measure = () => {
      const active = track.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')
      if (!active) { setPill(null); return }
      setPill({ x: active.offsetLeft, w: active.offsetWidth })
    }
    // Messen im nächsten Frame bzw. wenn sich die Breite ändert (Drehen, Schriftgröße).
    const frame = requestAnimationFrame(measure)
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    observer?.observe(track)
    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
    }
  }, [value, optionsKey])

  // Erst nach dem ersten Platzieren animieren, sonst gleitet sie beim Laden von links herein.
  useLayoutEffect(() => {
    if (pill && !animate) {
      const id = requestAnimationFrame(() => setAnimate(true))
      return () => cancelAnimationFrame(id)
    }
  }, [pill, animate])

  useScrollEdges(scroll ? scrollerRef : null, value, optionsKey)

  const segment = (
    <div
      ref={trackRef}
      role="group"
      aria-label={ariaLabel}
      data-equal={equal}
      className={`lg-seg ${scroll ? '' : material === 'glass' ? 'lg-glass' : 'lg-seg-fill'} ${scroll ? '' : className}`}
    >
      {pill && (
        <span
          aria-hidden
          className="lg-seg-pill"
          data-animate={animate}
          style={{ width: pill.w, transform: `translateX(${pill.x}px)` }}
        />
      )}
      {options.map(option => (
        <button
          key={option.key}
          type="button"
          aria-pressed={option.key === value}
          {...denyProps(!!option.denyReason, option.denyReason)}
          onClick={() => { if (!option.denyReason) onChange(option.key) }}
        >
          {option.label}
        </button>
      ))}
    </div>
  )

  if (!scroll) return segment
  // Die Kapsel (Füllung bzw. Glas) steht fest; darin scrollt nur die Spur mit
  // Einträgen und Markierung. An Rändern mit weiterem Inhalt blendet sie aus.
  return (
    <div className={`lg-seg-scroll ${material === 'glass' ? 'lg-glass' : 'lg-seg-fill'} ${className}`}>
      <div ref={scrollerRef} className="lg-seg-scroller">{segment}</div>
    </div>
  )
}

/**
 * Scroll-Spur: merkt sich, an welchem Rand noch Inhalt liegt (für das Ausblenden),
 * und holt die aktive Wahl in die Mitte, wenn sie verdeckt ist — beim ersten
 * Zeichnen ohne Bewegung, danach gleitend.
 */
function useScrollEdges(ref: RefObject<HTMLDivElement | null> | null, value: string, optionsKey: string) {
  const placed = useRef(false)

  useEffect(() => {
    const el = ref?.current
    if (!el) return
    let frame = 0
    const update = () => {
      frame = 0
      const max = el.scrollWidth - el.clientWidth
      el.setAttribute('data-fade-start', String(el.scrollLeft > 1))
      el.setAttribute('data-fade-end', String(el.scrollLeft < max - 1))
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    update()
    el.addEventListener('scroll', schedule, { passive: true })
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(schedule)
    observer?.observe(el)
    if (el.firstElementChild) observer?.observe(el.firstElementChild)
    return () => {
      el.removeEventListener('scroll', schedule)
      observer?.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [ref, optionsKey])

  useLayoutEffect(() => {
    const el = ref?.current
    const active = el?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]')
    if (!el || !active) return
    const fade = 32
    const left = active.offsetLeft
    const right = left + active.offsetWidth
    const hidden = left < el.scrollLeft + fade || right > el.scrollLeft + el.clientWidth - fade
    if (hidden) {
      const target = Math.max(0, Math.min(left - (el.clientWidth - active.offsetWidth) / 2, el.scrollWidth - el.clientWidth))
      const still = !placed.current || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      el.scrollTo({ left: target, behavior: still ? 'auto' : 'smooth' })
    }
    placed.current = true
  }, [ref, value, optionsKey])
}
