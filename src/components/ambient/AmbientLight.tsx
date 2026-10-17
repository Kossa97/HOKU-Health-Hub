import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { AmbientContext, type AmbientScene, type LightSlot, type Tint } from './context'
import { AVOID_DIM, SLOTS, frameLights, nearestLight, pickFocus, rest, type Framing, type Point, type Zone, type ZoneKind } from './framing'
import { DEFAULT_PALETTE, type Palette } from './palettes'

/** Grundhelligkeit der Bühne — ruhig und leise, damit die Glas-Karten tragen. */
const BASE_OPACITY = 0.18
/** So lange muss das Scrollen ruhen, bevor sich das Licht neu einrichtet */
const SETTLE_MS = 160

interface Claim extends Tint { owner: string }
interface ZoneEntry { ref: RefObject<HTMLElement | null>; kind: ZoneKind; el: HTMLElement | null }

const sameFraming = (a: Framing, b: Framing) => SLOTS.every(s =>
  a.offsets[s].x === b.offsets[s].x && a.offsets[s].y === b.offsets[s].y && a.dims[s] === b.dims[s])

const reducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

/**
 * Fester Hintergrund hinter der Fortschritt-Seite. Beim Scrollen gleiten die
 * Karten über die Lichter, die Lichter selbst stehen still. Erst wenn das
 * Scrollen ruht (oder eine Karte ihre Größe ändert), richten sie sich langsam
 * um die gelesene Karte herum ein. Interaktionen ändern Farbe und Helligkeit
 * eines Lichts; je Eigenschaft gilt der zuletzt angemeldete bzw. geänderte
 * Wunsch, der sie setzt.
 */
export function AmbientLightProvider({ children, palette = DEFAULT_PALETTE, level = 1, off = false }: {
  children: ReactNode
  /** Vollbild-Seiten (3D-Karte): nichts scheint durch, die Bühne entfällt */
  off?: boolean
  /** Grundfarben je Licht; ein Wechsel blendet in 1 s über */
  palette?: Palette
  /** Helligkeit relativ zur Grundbühne (1 = wie Fortschritt) */
  level?: number
}) {
  const [claims, setClaims] = useState<Record<LightSlot, Claim[]>>({ top: [], middle: [], bottom: [] })
  const [framing, setFraming] = useState<Framing>(rest)
  const [avoided, setAvoided] = useState<LightSlot | null>(null)

  const stage = useRef<HTMLDivElement>(null)
  const zones = useRef(new Map<string, ZoneEntry>())
  const lights = useRef<Record<LightSlot, HTMLDivElement | null>>({ top: null, middle: null, bottom: null })
  /** Sichtbare Mitte je Licht aus der letzten Einrichtung — fürs Ablesen ohne neues Messen */
  const shown = useRef<Record<LightSlot, Point> | null>(null)
  const timer = useRef(0)

  /** Feste Mitte eines Lichts (ohne Verschiebung) in Bildschirm-Koordinaten */
  const homeCenters = useCallback((): Record<LightSlot, Point> | null => {
    const origin = stage.current?.getBoundingClientRect()
    if (!origin) return null
    const out = {} as Record<LightSlot, Point>
    for (const slot of SLOTS) {
      const el = lights.current[slot]
      if (!el) return null
      out[slot] = { x: origin.left + el.offsetLeft + el.offsetWidth / 2, y: origin.top + el.offsetTop + el.offsetHeight / 2 }
    }
    return out
  }, [])

  const settle = useCallback(() => {
    const centers = homeCenters()
    if (!centers) return
    const found: Zone[] = []
    for (const { ref, kind } of zones.current.values()) {
      const el = ref.current
      if (!el) continue
      // DOMRect trägt seine Werte am Prototyp; als einfaches Objekt lassen sie sich kopieren
      const { left, top, right, bottom } = el.getBoundingClientRect()
      found.push({ kind, box: { left, top, right, bottom } })
    }
    const next = frameLights(centers, pickFocus(found, window.innerHeight), window.innerWidth, reducedMotion())
    shown.current = Object.fromEntries(SLOTS.map(s =>
      [s, { x: centers[s].x + next.offsets[s].x, y: centers[s].y + next.offsets[s].y }])) as Record<LightSlot, Point>
    setFraming(prev => (sameFraming(prev, next) ? prev : next))
  }, [homeCenters])

  const scheduleSettle = useCallback(() => {
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(settle, SETTLE_MS)
  }, [settle])

  // Karten, die wachsen oder schrumpfen (Ring geöffnet, Zeitraum gewechselt), verschieben die übrigen
  const resizes = useRef<ResizeObserver | null>(null)

  useEffect(() => {
    // Karten melden sich in ihren Effekten an, also vor diesem hier: sie jetzt nachtragen
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(scheduleSettle)
    resizes.current = observer
    for (const { el } of zones.current.values()) if (el) observer?.observe(el)

    // Nur Scrollen der Seite selbst zählt — nicht das Wischen durch Karten oder Sheets
    const onScroll = (e: Event) => {
      // Seiten ohne Lesezonen: das Licht bleibt an seinem Platz, nichts zu messen
      if (zones.current.size === 0) return
      const target = e.target
      if (target === document || (target instanceof Element && [...zones.current.values()].some(z => z.el && target.contains(z.el)))) {
        scheduleSettle()
      }
    }
    // Scroll-Ereignisse steigen nicht auf; im Einfang-Modus kommen sie von jedem Scroller an
    document.addEventListener('scroll', onScroll, { capture: true, passive: true })
    window.addEventListener('resize', scheduleSettle)
    return () => {
      document.removeEventListener('scroll', onScroll, { capture: true })
      window.removeEventListener('resize', scheduleSettle)
      window.clearTimeout(timer.current)
      observer?.disconnect()
      resizes.current = null
    }
  }, [scheduleSettle])

  const scene = useMemo<AmbientScene>(() => ({
    claim(slot, owner, tint) {
      setClaims(prev => ({ ...prev, [slot]: [...prev[slot].filter(c => c.owner !== owner), { owner, ...tint }] }))
    },
    release(slot, owner) {
      setClaims(prev => ({ ...prev, [slot]: prev[slot].filter(c => c.owner !== owner) }))
    },
    addZone(owner, ref, kind) {
      const el = ref.current
      zones.current.set(owner, { ref, kind, el })
      if (el) resizes.current?.observe(el)
      scheduleSettle()
    },
    removeZone(owner) {
      const el = zones.current.get(owner)?.el
      zones.current.delete(owner)
      if (el) resizes.current?.unobserve(el)
      scheduleSettle()
    },
    avoid(at) {
      setAvoided(at && shown.current ? nearestLight(shown.current, at, window.innerHeight) : null)
    },
  }), [scheduleSettle])

  return (
    <AmbientContext.Provider value={scene}>
      {!off && (
        <div ref={stage} className="lg-ambient" aria-hidden>
          {SLOTS.map(slot => {
            const color = claims[slot].findLast(c => c.color != null)?.color
            const boost = claims[slot].findLast(c => c.boost != null)?.boost ?? 0
            const { x, y } = framing.offsets[slot]
            const moved = x !== 0 || y !== 0
            return (
              <div
                key={slot}
                ref={el => { lights.current[slot] = el }}
                className={`lg-light lg-light-${slot}`}
                data-tinted={color != null}
                data-moved={moved}
                data-avoided={avoided === slot}
                style={{
                  transform: moved ? `translate3d(${x}px, ${y}px, 0)` : undefined,
                  opacity: framing.dims[slot] * (avoided === slot ? AVOID_DIM : 1),
                }}
              >
                <i style={{ backgroundColor: color ?? palette[slot], opacity: BASE_OPACITY * level + boost }} />
              </div>
            )
          })}
        </div>
      )}
      {children}
    </AmbientContext.Provider>
  )
}
