import { useCallback, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { prefersReducedMotion } from '../../lib/motion'

/**
 * Zeilen per Griff umsortieren (Pointer Events, kein Drag-and-Drop-API — das
 * ist auf dem Handy unbrauchbar). Waehrend des Ziehens bleibt die Liste
 * unveraendert: die gezogene Zeile folgt dem Finger, die anderen weichen per
 * `transform` aus (180 ms), umsortiert wird erst beim Loslassen. So gibt es
 * keine springenden DOM-Knoten mitten in der Geste.
 *
 * Zeilen tragen `data-drag-row`, der Container bekommt `containerProps`, der
 * Griff `handleProps(index)`; `rowStyle(index)` liefert die Transformation.
 * `touch-action: none` auf dem Griff, damit die Seite beim Ziehen nicht scrollt.
 */

interface DragState {
  from: number
  to: number
  startY: number
  dy: number
  /** Lage aller Zeilen beim Start — die Live-Rects verschieben sich mit den Transforms. */
  rects: DOMRect[]
  height: number
  gap: number
  reduced: boolean
}

const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)'


export function useDragReorder<E extends HTMLElement>(onReorder: (from: number, to: number) => void) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const containerRef = useRef<E | null>(null)

  const commit = (state: DragState | null) => { dragRef.current = state; setDrag(state) }

  const rows = () => Array.from(containerRef.current?.querySelectorAll<HTMLElement>('[data-drag-row]') ?? [])

  const onPointerDown = useCallback((index: number) => (event: ReactPointerEvent<HTMLElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const rects = rows().map(row => row.getBoundingClientRect())
    if (!rects[index]) return
    event.preventDefault()
    try { event.currentTarget.setPointerCapture(event.pointerId) } catch { /* aelterer Browser: dann ohne Capture */ }
    const gap = rects.length > 1 ? Math.max(0, rects[1].top - rects[0].bottom) : 8
    commit({ from: index, to: index, startY: event.clientY, dy: 0, rects, height: rects[index].height, gap, reduced: prefersReducedMotion() })
  }, [])

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const d = dragRef.current
    if (!d) return
    const dy = event.clientY - d.startY
    const mid = d.rects[d.from].top + d.height / 2 + dy
    let to = d.from
    d.rects.forEach((rect, k) => {
      if (k === d.from) return
      const center = rect.top + rect.height / 2
      if (k < d.from && mid < center) to = Math.min(to, k)
      if (k > d.from && mid > center) to = Math.max(to, k)
    })
    commit({ ...d, dy, to })
  }, [])

  const onPointerEnd = useCallback(() => {
    const d = dragRef.current
    if (!d) return
    commit(null)
    if (d.to !== d.from) onReorder(d.from, d.to)
  }, [onReorder])

  const rowStyle = (index: number): CSSProperties => {
    if (!drag) return {}
    if (index === drag.from) {
      return {
        transform: `translateY(${drag.dy}px) scale(1.02)`,
        transition: 'none', position: 'relative', zIndex: 5,
        boxShadow: '0 14px 30px rgba(0,0,0,0.45)',
      }
    }
    const shift = drag.height + drag.gap
    let offset = 0
    if (drag.to < drag.from && index >= drag.to && index < drag.from) offset = shift
    if (drag.to > drag.from && index > drag.from && index <= drag.to) offset = -shift
    return {
      transform: offset ? `translateY(${offset}px)` : 'none',
      transition: drag.reduced ? 'none' : `transform 180ms ${EASE}`,
    }
  }

  return {
    containerProps: { ref: containerRef, onPointerMove, onPointerUp: onPointerEnd, onPointerCancel: onPointerEnd },
    handleProps: (index: number) => ({
      onPointerDown: onPointerDown(index),
      style: { touchAction: 'none', cursor: drag ? 'grabbing' : 'grab' } as CSSProperties,
    }),
    rowStyle,
    dragging: drag?.from ?? null,
  }
}
