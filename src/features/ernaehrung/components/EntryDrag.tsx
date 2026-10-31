import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { LogEntry, Meal } from '../lib/nutrition'
import { hapticTick } from '../lib/orbFeedback'
import { usePrefersReducedMotion } from '../lib/orbZone'
import type { LiftStart } from './SwipeRow'

/** Wohin ein gezogener Eintrag fällt: an einen Platz in einer Mahlzeit oder auf einen Tag der Woche. */
export type DropTarget = { kind: 'meal'; meal: Meal; index: number } | { kind: 'day'; date: string }

export interface DragState {
  entry: LogEntry
  /** Höhe der Lücke, die an der Zielstelle aufgeht; Breite der Kopie. */
  height: number
  width: number
  target: DropTarget
  origin: { meal: Meal; index: number; date: string }
}

/** Über einem Tag so lange halten, bis er sich öffnet (wie Ordner auf dem iPhone). */
const SPRING_MS = 650
/** Abstand zum Rand, ab dem die Seite beim Ziehen mitscrollt; Höchsttempo je Bild. */
const EDGE = 64
const MAX_SPEED = 14

const same = (a: DropTarget | null, b: DropTarget | null) =>
  a === b || (!!a && !!b && (a.kind === 'meal' && b.kind === 'meal'
    ? a.meal === b.meal && a.index === b.index
    : a.kind === 'day' && b.kind === 'day' && a.date === b.date))

/**
 * Halten und Verschieben der Einträge. Die Zeile löst sich (SwipeRow), eine Kopie folgt dem
 * Finger, darunter geht dort eine Lücke auf, wo sie landen würde; am Rand scrollt die Seite.
 * Über einem Tag der Woche: kurz halten öffnet ihn, loslassen legt den Eintrag dorthin.
 * Loslassen gleitet die Kopie an ihren Platz. „Bewegung reduzieren“: ohne Gleiten.
 */
export function useEntryDrag({ date, onDrop, onSpringDay, renderGhost }: {
  /** Gezeigter Tag (Ziel beim Ablegen in eine Mahlzeit). */
  date: string
  onDrop: (entry: LogEntry, target: DropTarget, origin: DragState['origin']) => void
  /** Über einem Tag lange genug gehalten: diesen Tag zeigen, das Ziehen läuft weiter. */
  onSpringDay: (date: string) => void
  renderGhost: (entry: LogEntry) => ReactNode
}) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const ghostRef = useRef<HTMLDivElement>(null)
  const reduce = usePrefersReducedMotion()
  const opts = useRef({ date, onDrop, onSpringDay })
  useEffect(() => { opts.current = { date, onDrop, onSpringDay } })
  const g = useRef({
    active: false, x: 0, y: 0, dx: 0, dy: 0, width: 0, raf: 0, spring: 0, springDay: null as string | null,
    target: null as DropTarget | null, state: null as DragState | null,
    /** Abmelden der Touch-/Zeiger-Verfolgung dieser Geste. */
    detach: null as null | (() => void),
  })

  const place = () => {
    const s = g.current
    const el = ghostRef.current
    if (el) el.style.transform = `translate3d(${s.x - s.dx}px, ${s.y - s.dy}px, 0)`
  }

  /** Was liegt unter dem Finger? Die Kopie selbst lässt Treffer durch (pointer-events: none). */
  const hit = (x: number, y: number): DropTarget | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    if (!el || el.closest('[data-nutr-zone]')) return null
    const day = el.closest<HTMLButtonElement>('[data-nutr-day]')
    // Der gezeigte Tag ist kein Ziel (dort liegt der Eintrag schon bzw. legt man in eine Mahlzeit).
    if (day) return day.disabled || day.dataset.nutrDay === opts.current.date ? null : { kind: 'day', date: day.dataset.nutrDay! }
    const section = el.closest<HTMLElement>('[data-meal]')
    // Ein gerade geöffneter Tag lädt noch: dort noch nicht ablegen.
    if (!section || !section.hasAttribute('data-drop-ready')) return null
    const id = g.current.state?.entry.id
    let index = 0
    for (const row of section.querySelectorAll<HTMLElement>('[data-swipe-row]')) {
      if (row.dataset.swipeRow === id) continue
      const r = row.getBoundingClientRect()
      if (r.top + r.height / 2 < y) index++
    }
    return { kind: 'meal', meal: section.dataset.meal as Meal, index }
  }

  const retarget = () => {
    const s = g.current
    const t = hit(s.x, s.y)
    // Über nichts Brauchbarem (Kugel oben, Rand): die Lücke bleibt, wo sie war.
    if (!t || same(t, s.target)) return
    s.target = t
    setDrag(d => (d ? { ...d, target: t } : d))
    // Tag halten: nach kurzer Zeit öffnet er sich; ein anderer Ort bricht das ab.
    window.clearTimeout(s.spring)
    s.springDay = null
    if (t.kind === 'day' && t.date !== opts.current.date) {
      s.springDay = t.date
      s.spring = window.setTimeout(() => {
        if (!g.current.active || g.current.springDay !== t.date) return
        hapticTick()
        opts.current.onSpringDay(t.date)
      }, SPRING_MS)
    }
  }

  /** Am oberen (unter der festen Kugel) und unteren Rand scrollt die Seite mit. */
  const tick = () => {
    const s = g.current
    if (!s.active) return
    const top = (document.querySelector('[data-nutr-zone]')?.getBoundingClientRect().bottom ?? 0) + EDGE
    const bottom = window.innerHeight - EDGE
    const v = s.y < top ? -Math.min(MAX_SPEED, ((top - s.y) / EDGE) * MAX_SPEED)
      : s.y > bottom ? Math.min(MAX_SPEED, ((s.y - bottom) / EDGE) * MAX_SPEED) : 0
    if (v) {
      const before = window.scrollY
      window.scrollBy(0, v)
      if (window.scrollY !== before) retarget()
    }
    s.raf = requestAnimationFrame(tick)
  }

  const start = (entry: LogEntry, origin: DragState['origin'], lift: LiftStart) => {
    const s = g.current
    const target: DropTarget = { kind: 'meal', meal: origin.meal, index: origin.index }
    s.active = true
    s.x = lift.x
    s.y = lift.y
    s.dx = lift.x - lift.rect.left
    s.dy = lift.y - lift.rect.top
    s.width = lift.rect.width
    s.target = target
    s.state = { entry, height: lift.rect.height, width: lift.rect.width, target, origin }
    setDrag(s.state)
    // Verfolgen am berührten Element (bleibt Ziel aller Touch-Ereignisse, auch losgelöst aus der Seite)
    // und — für Maus/Stift — am Fenster: die Zeile kann beim Tageswechsel verschwinden.
    s.detach?.()
    const tt = lift.touchTarget
    const onTouchMove = (e: Event) => {
      const t = (e as TouchEvent).touches?.[0]
      e.preventDefault()
      if (t) move(t.clientX, t.clientY)
    }
    const onTouchEnd = () => end(false)
    const onTouchCancel = () => end(true)
    const onPointerMove = (e: PointerEvent) => { if (e.pointerType !== 'touch') move(e.clientX, e.clientY) }
    const onPointerUp = (e: PointerEvent) => { if (e.pointerType !== 'touch') end(false) }
    tt?.addEventListener('touchmove', onTouchMove, { passive: false })
    tt?.addEventListener('touchend', onTouchEnd)
    tt?.addEventListener('touchcancel', onTouchCancel)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    s.detach = () => {
      tt?.removeEventListener('touchmove', onTouchMove)
      tt?.removeEventListener('touchend', onTouchEnd)
      tt?.removeEventListener('touchcancel', onTouchCancel)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      s.detach = null
    }
    hapticTick()
    cancelAnimationFrame(s.raf)
    s.raf = requestAnimationFrame(tick)
  }

  const move = (x: number, y: number) => {
    const s = g.current
    if (!s.active) return
    s.x = x
    s.y = y
    place()
    retarget()
  }

  const end = (cancelled: boolean) => {
    const s = g.current
    if (!s.active || !s.state) return
    s.active = false
    s.detach?.()
    cancelAnimationFrame(s.raf)
    window.clearTimeout(s.spring)
    const state = s.state
    const origin: DropTarget = { kind: 'meal', meal: state.origin.meal, index: state.origin.index }
    // Abgebrochen (Anruf, Benachrichtigung …) ändert nie etwas; nur angehoben: zurück an den alten Platz.
    const target = cancelled ? origin : s.target ?? origin
    const unchanged = cancelled || (same(target, origin) && opts.current.date === state.origin.date)
    const finish = () => {
      if (!unchanged) opts.current.onDrop(state.entry, target, state.origin)
      s.state = null
      s.target = null
      setDrag(null)
    }
    if (target !== s.target) setDrag(d => (d ? { ...d, target } : d))
    const ghost = ghostRef.current
    if (reduce || !ghost) { finish(); return }
    hapticTick()
    // Erst im nächsten Bild steht die Lücke am Ziel; dorthin gleiten (Tag: schrumpfend in den Tag).
    requestAnimationFrame(() => {
      const spot = target.kind === 'day'
        ? document.querySelector(`[data-nutr-day="${target.date}"]`)
        : document.querySelector('[data-drop-placeholder]')
      const r = spot?.getBoundingClientRect()
      if (!r) { finish(); return }
      const toDay = target.kind === 'day'
      const x = toDay ? r.left + r.width / 2 - s.width / 2 : r.left
      const y = toDay ? r.top + r.height / 2 - state.height / 2 : r.top
      const anim = ghost.animate([
        { transform: ghost.style.transform, opacity: 1 },
        { transform: `translate3d(${x}px, ${y}px, 0) scale(${toDay ? 0.3 : 1})`, opacity: toDay ? 0 : 1 },
      ], { duration: toDay ? 260 : 220, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1)', fill: 'forwards' })
      anim.onfinish = finish
      anim.oncancel = finish
    })
  }

  useLayoutEffect(() => { if (drag) place() }, [drag?.entry.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => {
    g.current.detach?.()
    cancelAnimationFrame(g.current.raf)
    window.clearTimeout(g.current.spring)
  }, [])

  const ghost = drag && createPortal(
    <div ref={ghostRef} aria-hidden="true" className="pointer-events-none fixed left-0 top-0 z-[70]" style={{ width: drag.width }}>
      <div className={`rounded-[16px] bg-[var(--lg-sheet-solid)] shadow-[0_18px_40px_rgba(0,0,0,0.45)] ring-1 ring-[var(--lg-hair)] ${reduce ? '' : 'animate-[nutr-lift_220ms_cubic-bezier(0.22,1,0.36,1)_forwards]'}`}>
        <div className="flex min-h-[56px] items-center justify-between gap-3 py-2 pl-2 pr-4">{renderGhost(drag.entry)}</div>
      </div>
    </div>,
    document.body,
  )

  return { drag, start, move, end, ghost }
}
