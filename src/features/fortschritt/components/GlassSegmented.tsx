import { useLayoutEffect, useRef, useState } from 'react'
import { denyProps } from '../../../lib/denyFeedback'

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
  className?: string
}

/**
 * Umschalter mit gleitender Markierung. Die Markierung misst das aktive
 * Segment und gleitet per transform dorthin (iOS-Drawer-Kurve); beim ersten
 * Zeichnen springt sie ohne Animation an ihren Platz.
 */
export function GlassSegmented<K extends string>({ options, value, onChange, ariaLabel, equal = false, className = '' }: Props<K>) {
  const trackRef = useRef<HTMLDivElement>(null)
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

  return (
    <div
      ref={trackRef}
      role="group"
      aria-label={ariaLabel}
      data-equal={equal}
      className={`fg-seg fg-glass ${className}`}
    >
      {pill && (
        <span
          aria-hidden
          className="fg-seg-pill"
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
}
