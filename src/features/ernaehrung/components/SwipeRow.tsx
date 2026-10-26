import { type ReactNode, useEffect, useRef, useState } from 'react'
import { PenLine, Trash2 } from 'lucide-react'
import { SLOP, project, releaseVelocity, rubber } from '../lib/gesture'
import { usePrefersReducedMotion } from '../lib/orbZone'

/** Breite je Aktion, wenn die Zeile offen steht. */
const ACTION_W = 76
const OPEN = -2 * ACTION_W
/** Eine Zeile offen zur Zeit: öffnet eine, schließen die anderen. */
const OPEN_EVENT = 'nutr-swipe-open'
/** So lange halten, bis die Zeile sich zum Verschieben löst (wie in iOS-Listen). */
export const HOLD_MS = 420

/**
 * Gelöst zum Verschieben: Fingerposition, Lage der Zeile beim Anheben und das berührte
 * Element — an ihm kommen die weiteren Touch-Ereignisse an, auch wenn die Zeile verschwindet.
 */
export interface LiftStart { x: number; y: number; rect: DOMRect; touchTarget: EventTarget | null }

/**
 * Zeile wie in iOS-Listen: nach links wischen zeigt Bearbeiten und Löschen; ganz
 * durchwischen löscht. Antippen öffnet (bzw. schließt die offene Zeile). Folgt dem
 * Finger 1:1, lässt sich jederzeit wieder greifen und federt (kritisch gedämpft)
 * mit dem Tempo des Fingers aus. Ohne Wischen erreicht man beides über das Antippen.
 * Halten (`onLift`, ohne zu bewegen) löst die Zeile zum Verschieben; das Ziehen verfolgt die Seite.
 */
export function SwipeRow({ id, children, label, editLabel, deleteLabel, disabled, onTap, onEdit, onDelete, onLift }: {
  id: string
  children: ReactNode
  /** Name der Zeile für Screenreader. */
  label: string
  editLabel: string
  deleteLabel: string
  disabled?: boolean
  onTap: () => void
  onEdit: () => void
  /** Gibt false zurück, wenn das Löschen scheiterte — dann kommt die Zeile zurück. */
  onDelete: () => Promise<boolean> | void
  onLift?: (start: LiftStart) => void
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLButtonElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)
  const editRef = useRef<HTMLButtonElement>(null)
  const reduce = usePrefersReducedMotion()
  const [open, setOpen] = useState(false)
  const st = useRef({
    x: 0, v: 0, raf: 0, armed: false, deleting: false,
    /** Bis wann ein Klick noch zum Wischen gehört (danach wieder ein echter Tipp). */
    swallowUntil: 0,
    drag: null as null | { id: number; x0: number; y0: number; base: number; dir: 'x' | null; hist: { x: number; t: number }[] },
    /** Halten läuft (Timer) bzw. Zeile ist gelöst; letzte Fingerposition. */
    hold: 0, lifted: false, p0: { x: 0, y: 0 }, last: { x: 0, y: 0 }, touchTarget: null as EventTarget | null,
  })
  const liftRef = useRef(onLift)
  useEffect(() => { liftRef.current = onLift })

  const paint = () => {
    const s = st.current
    if (contentRef.current) contentRef.current.style.transform = s.x ? `translate3d(${s.x}px,0,0)` : ''
    if (actionsRef.current) actionsRef.current.style.width = `${Math.max(0, -s.x)}px`
    // Ganz durchgewischt: Löschen füllt die Breite, Bearbeiten weicht.
    if (editRef.current) editRef.current.style.flexGrow = s.armed ? '0' : '1'
  }

  const animateTo = (target: number, v0 = 0, then?: () => void) => {
    const s = st.current
    cancelAnimationFrame(s.raf)
    s.v = v0
    if (reduce) { s.x = target; s.v = 0; paint(); then?.(); return }
    // Feder, kritisch gedämpft (Antwortzeit 0,32 s): kein Überschwingen, übernimmt das Tempo des Fingers.
    const k = (2 * Math.PI / 0.32) ** 2
    const c = 2 * Math.sqrt(k)
    let last = performance.now()
    const step = (now: number) => {
      const dt = Math.min(0.032, Math.max(0, (now - last) / 1000))
      last = now
      s.v += (-k * (s.x - target) - c * s.v) * dt
      s.x += s.v * dt
      if (Math.abs(s.x - target) < 0.5 && Math.abs(s.v) < 8) {
        s.x = target; s.v = 0; s.raf = 0; paint(); then?.(); return
      }
      paint()
      s.raf = requestAnimationFrame(step)
    }
    s.raf = requestAnimationFrame(step)
  }

  const settle = (target: number, v = 0) => {
    // Gelöscht wird gerade: nichts holt die Zeile zurück (außer dem Fehlschlag selbst).
    if (st.current.deleting) return
    st.current.armed = false
    setOpen(target !== 0)
    if (target !== 0) window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: id }))
    animateTo(target, v)
  }

  const remove = (v = 0) => {
    const s = st.current
    if (s.deleting || disabled) return
    const width = rowRef.current?.clientWidth ?? 360
    s.armed = true
    s.deleting = true
    animateTo(-width, v, () => {
      void Promise.resolve(onDelete()).then(ok => {
        if (ok !== false) return
        s.deleting = false
        settle(0)
      })
    })
  }
  /** Losgelassen: die Seite beendet das Verschieben selbst (EntryDrag); hier nur aufräumen. */
  const finishLift = () => {
    const s = st.current
    if (!s.lifted) return
    s.lifted = false
    // Der Klick nach dem Loslassen gehört noch zur Geste.
    s.swallowUntil = performance.now() + 400
  }
  const finishLiftRef = useRef(finishLift)
  useEffect(() => { finishLiftRef.current = finishLift })

  // Gelöst folgt die Zeile dem Finger, die Seite scrollt nicht mit: Touch-Bewegungen hier abfangen
  // (nicht passiv, an der Zeile selbst — so kennt der Browser den Handler schon bei Berührung).
  useEffect(() => {
    const row = rowRef.current
    if (!row) return
    // Nur abfangen; die Bewegung selbst verfolgt die Seite am berührten Element (siehe LiftStart).
    const move = (e: TouchEvent) => { if (st.current.lifted) e.preventDefault() }
    const touchStart = (e: TouchEvent) => { st.current.touchTarget = e.target }
    const end = () => finishLiftRef.current()
    // Langes Drücken öffnet sonst das Kontextmenü (Android) bzw. die Auswahl.
    const menu = (e: Event) => { if (st.current.hold || st.current.lifted) e.preventDefault() }
    row.addEventListener('touchstart', touchStart, { passive: true })
    row.addEventListener('touchmove', move, { passive: false })
    row.addEventListener('touchend', end)
    row.addEventListener('touchcancel', end)
    row.addEventListener('contextmenu', menu)
    return () => {
      row.removeEventListener('touchstart', touchStart)
      row.removeEventListener('touchmove', move)
      row.removeEventListener('touchend', end)
      row.removeEventListener('touchcancel', end)
      row.removeEventListener('contextmenu', menu)
    }
  }, [])
  useEffect(() => () => window.clearTimeout(st.current.hold), [])

  const settleRef = useRef(settle)
  useEffect(() => { settleRef.current = settle })

  // Andere Zeile geöffnet, irgendwo anders getippt: schließen.
  useEffect(() => {
    if (!open) return
    const other = (e: Event) => { if ((e as CustomEvent<string>).detail !== id) settleRef.current(0) }
    const outside = (e: PointerEvent) => { if (!rowRef.current?.contains(e.target as Node)) settleRef.current(0) }
    window.addEventListener(OPEN_EVENT, other)
    document.addEventListener('pointerdown', outside, true)
    return () => { window.removeEventListener(OPEN_EVENT, other); document.removeEventListener('pointerdown', outside, true) }
  }, [open, id])
  useEffect(() => () => cancelAnimationFrame(st.current.raf), [])

  return (
    <div ref={rowRef} className="relative select-none overflow-hidden" style={{ touchAction: 'pan-y', WebkitTouchCallout: 'none' }}
      // Am Zeilen-div, nicht am Inhalt: nach dem Wischen (Zeiger eingefangen) geht der Klick hierher.
      onClickCapture={e => {
        const s = st.current
        if (actionsRef.current?.contains(e.target as Node)) return
        if (performance.now() < s.swallowUntil || s.x !== 0) {
          e.preventDefault()
          e.stopPropagation()
          if (performance.now() >= s.swallowUntil && !s.drag) settle(0)
          s.swallowUntil = 0
        }
      }}
      onPointerDown={e => {
        const s = st.current
        if (e.pointerType !== 'touch') s.touchTarget = null
        if (disabled || s.deleting || e.button !== 0) return
        // Greifen, wo sie gerade ist — auch mitten in der Feder.
        cancelAnimationFrame(s.raf)
        s.drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, base: s.x, dir: null, hist: [{ x: e.clientX, t: e.timeStamp }] }
        // Halten ohne Bewegung löst die (geschlossene) Zeile zum Verschieben.
        window.clearTimeout(s.hold)
        s.hold = 0
        if (liftRef.current && s.x === 0) {
          s.p0 = { x: e.clientX, y: e.clientY }
          s.last = { x: e.clientX, y: e.clientY }
          const pointerId = e.pointerId
          s.hold = window.setTimeout(() => {
            s.hold = 0
            const rect = contentRef.current?.getBoundingClientRect()
            if (!rect || !liftRef.current) return
            s.drag = null
            s.lifted = true
            s.swallowUntil = Infinity
            try { rowRef.current?.setPointerCapture(pointerId) } catch { /* Zeiger schon weg */ }
            liftRef.current({ x: s.last.x, y: s.last.y, rect, touchTarget: s.touchTarget })
          }, HOLD_MS)
        }
      }}
      onPointerMove={e => {
        const s = st.current
        s.last = { x: e.clientX, y: e.clientY }
        if (s.lifted) return
        // Bewegt, bevor die Zeile sich löst: Scrollen oder Wischen, kein Verschieben.
        if (s.hold && Math.hypot(e.clientX - s.p0.x, e.clientY - s.p0.y) > SLOP) { window.clearTimeout(s.hold); s.hold = 0 }
        const d = s.drag
        if (!d || e.pointerId !== d.id) return
        if (!d.dir) {
          const dx = e.clientX - d.x0
          const dy = e.clientY - d.y0
          if (Math.abs(dy) > SLOP && Math.abs(dy) >= Math.abs(dx)) { s.drag = null; if (s.x !== 0) settle(s.x < OPEN / 2 ? OPEN : 0); return }
          if (Math.abs(dx) <= SLOP) return
          d.dir = 'x'
          // Ab der Schwelle 1:1 weiter, ohne Sprung.
          d.x0 += Math.sign(dx) * SLOP
          rowRef.current?.setPointerCapture(e.pointerId)
        }
        const width = rowRef.current?.clientWidth ?? 360
        let x = d.base + (e.clientX - d.x0)
        if (x > 0) x = rubber(x, width)
        s.armed = x < -Math.max(width * 0.55, -OPEN + 40)
        s.x = x
        d.hist.push({ x: e.clientX, t: e.timeStamp })
        if (d.hist.length > 5) d.hist.shift()
        paint()
      }}
      onPointerUp={e => {
        const s = st.current
        window.clearTimeout(s.hold)
        s.hold = 0
        if (s.lifted) { finishLift(); return }
        const d = s.drag
        s.drag = null
        if (!d || e.pointerId !== d.id || !d.dir) return
        s.swallowUntil = performance.now() + 400
        const v = releaseVelocity(d.hist, e.timeStamp)
        if (s.armed) { remove(v); return }
        settle(s.x + project(v) < OPEN / 2 ? OPEN : 0, v)
      }}
      onPointerCancel={() => {
        const s = st.current
        window.clearTimeout(s.hold)
        s.hold = 0
        // Gelöst: das Ziehen läuft über Touch-Ereignisse weiter (touchend beendet es).
        if (s.lifted) return
        if (s.drag?.dir) settle(s.x < OPEN / 2 ? OPEN : 0)
        s.drag = null
      }}>
      <div ref={actionsRef} inert={!open} aria-hidden={!open} className="absolute inset-y-0 right-0 flex w-0 overflow-hidden">
        <button ref={editRef} type="button" tabIndex={open ? 0 : -1} disabled={disabled}
          onClick={() => { settle(0); onEdit() }}
          className="flex min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-1 overflow-hidden bg-[#8e8e93] text-[12px] font-medium text-white transition-[flex-grow] duration-200">
          <PenLine size={18} aria-hidden="true" /><span className="truncate">{editLabel}</span>
        </button>
        <button type="button" tabIndex={open ? 0 : -1} disabled={disabled}
          onClick={() => remove()}
          className="flex min-w-0 flex-1 basis-0 flex-col items-center justify-center gap-1 overflow-hidden bg-[#ff3b30] text-[12px] font-medium text-white">
          <Trash2 size={18} aria-hidden="true" /><span className="truncate">{deleteLabel}</span>
        </button>
      </div>
      <button ref={contentRef} type="button" aria-label={label} data-swipe-row={id}
        onClick={onTap}
        className="relative flex min-h-[56px] w-full touch-manipulation select-none items-center justify-between gap-3 py-2 pl-2 pr-4 text-left transition-colors active:bg-[var(--lg-fill)]">
        {children}
      </button>
    </div>
  )
}
