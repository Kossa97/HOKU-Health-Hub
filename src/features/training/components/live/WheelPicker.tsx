import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { hapticTick } from '../../../../lib/haptics'
import { prefersReducedMotion } from '../../lib/motion'
import { WHEEL_HEIGHT, WHEEL_ITEM_H, WHEEL_PAD as PAD, WHEEL_RADIUS as RADIUS, WHEEL_STEP_RAD as STEP_RAD } from './wheelGeometry'

/**
 * Senkrechtes Auswahlrad wie bei iOS: natives Scrollen mit Schwung, dazu
 * eine Walzenform aus Stauchen und Ausblenden zum Rand. Eingerastet wird
 * hier, nicht per CSS `scroll-snap`: WebKit rastete beim Oeffnen eigenmaechtig
 * zwei Zeilen weiter (82 → 84 im Geraetetest). Steht das Rad, rueckt es auf
 * die naechste Zeile. Jede Zeile, die die Mitte kreuzt, gibt einen leichten
 * Haptik-Tick und geht sofort nach oben. Selbst ausgeloestes Hindrehen
 * (Tastatur, Antippen, Wert von aussen) meldet nur sein Ziel.
 *
 * Die Walze rechnet pro Bild nur die sichtbaren Zeilen und schreibt direkt ins
 * DOM — React rendert beim Drehen nichts neu. Tastatur: Pfeile, Bild auf/ab,
 * Pos1/Ende (`role="spinbutton"`).
 */

/**
 * Nach so vielen ms ohne Scroll-Ereignis steht das Rad (Safari kennt `scrollend`
 * nicht ueberall): selbst ausgeloestes Drehen ist vorbei, der Stand wird gemeldet.
 */
const SETTLE_MS = 110

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const identity = (i: number) => i

export function WheelPicker({ count, index, onChange, format, numberAt = identity, label, align = 'center', autoFocus = false }: {
  count: number
  index: number
  onChange: (index: number) => void
  format: (index: number) => string
  /** Zahlenwert einer Zeile fuer Screenreader (`aria-valuenow`); Standard: die Zeilennummer. */
  numberAt?: (index: number) => number
  /** Name fuer Screenreader, etwa „Wdh." oder „kg". */
  label: string
  align?: 'center' | 'left' | 'right'
  autoFocus?: boolean
}) {
  const scroller = useRef<HTMLDivElement>(null)
  const items = useRef<Array<HTMLDivElement | null>>([])
  const frame = useRef(0)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  /** Zeile in der Mitte, zuletzt gemeldet an Haptik und Eltern. */
  const centered = useRef(index)
  const reported = useRef(index)
  /** Laeuft ein Scrollen, das wir selbst ausgeloest haben? Dann keine Ticks. */
  const programmatic = useRef(false)
  /**
   * Ziel des selbst ausgeloesten Drehens. Bis es erreicht ist, gilt es als
   * Wert — auch wenn das sanfte Scrollen stockt (volle Hauptschleife) und
   * zwischendurch kurz still steht. Greift der Nutzer ein, verfaellt es.
   */
  const target = useRef<number | null>(null)
  /** Schon einmal ohne Animation nachgesprungen? Dann gilt das Ziel als erreicht. */
  const retried = useRef(false)
  /** Finger liegt auf dem Rad: dann nicht einrasten, auch wenn es kurz still steht. */
  const holding = useRef(false)
  const onChangeRef = useRef(onChange)
  useLayoutEffect(() => { onChangeRef.current = onChange })

  /** Walzenform: Zeilen um die Mitte stauchen und zum Rand ausblenden. */
  const paint = useCallback(() => {
    frame.current = 0
    const el = scroller.current
    if (!el) return
    const pos = el.scrollTop / WHEEL_ITEM_H
    const from = Math.max(0, Math.floor(pos) - 6)
    const to = Math.min(count - 1, Math.ceil(pos) + 6)
    for (let i = from; i <= to; i++) {
      const item = items.current[i]
      if (!item) continue
      const d = i - pos
      const angle = clamp(d * STEP_RAD, -Math.PI / 2, Math.PI / 2)
      const cos = Math.cos(angle)
      // Auf der Walze liegt die Zeile bei R·sin(a) statt bei d·Hoehe: nach innen ruecken.
      const shift = RADIUS * Math.sin(angle) - d * WHEEL_ITEM_H
      item.style.transform = `translate3d(0, ${shift.toFixed(2)}px, 0) scale(${(1 - (1 - cos) * 0.12).toFixed(3)}, ${cos.toFixed(3)})`
      item.style.opacity = Math.abs(d) < 0.5 ? '1' : String(clamp(cos * 0.85 - 0.1, 0, 0.75).toFixed(3))
    }
    const now = clamp(Math.round(pos), 0, count - 1)
    if (now !== centered.current) {
      centered.current = now
      // Sofort melden, nicht erst beim Einrasten: wer waehrend des Auslaufens
      // zuklappt, bekommt den Wert, der gerade in der Mitte steht.
      if (!programmatic.current && now !== reported.current) {
        void hapticTick()
        reported.current = now
        onChangeRef.current(now)
      }
    }
  }, [count])

  const settleRef = useRef<() => void>(() => {})
  const settle = useCallback(() => {
    const el = scroller.current
    if (el && target.current != null) {
      const top = target.current * WHEEL_ITEM_H
      // Gestockt statt angekommen: einmal ohne Animation hin, dann gilt es als erreicht.
      if (Math.abs(el.scrollTop - top) > 2 && !retried.current) {
        retried.current = true
        el.scrollTo({ top, behavior: 'auto' })
        clearTimeout(settleTimer.current)
        settleTimer.current = setTimeout(() => settleRef.current(), SETTLE_MS)
        return
      }
      centered.current = target.current
      target.current = null
      retried.current = false
    } else if (el && !holding.current) {
      // Vom Nutzer gedreht und ausgelaufen: auf die naechste Zeile einrasten.
      const nearest = clamp(Math.round(el.scrollTop / WHEEL_ITEM_H), 0, count - 1)
      if (Math.abs(el.scrollTop - nearest * WHEEL_ITEM_H) > 1) {
        if (nearest !== reported.current) {
          reported.current = nearest
          onChangeRef.current(nearest)
        }
        programmatic.current = true
        target.current = nearest
        retried.current = false
        el.scrollTo({ top: nearest * WHEEL_ITEM_H, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
        return
      }
    }
    programmatic.current = false
    const now = centered.current
    if (now !== reported.current) {
      reported.current = now
      onChangeRef.current(now)
    }
  }, [count])

  useLayoutEffect(() => { settleRef.current = settle })

  const onScroll = useCallback(() => {
    if (!frame.current) frame.current = requestAnimationFrame(paint)
    clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(settle, SETTLE_MS)
  }, [paint, settle])

  const scrollToIndex = useCallback((i: number, smooth: boolean) => {
    const el = scroller.current
    if (!el) return
    const top = i * WHEEL_ITEM_H
    if (Math.abs(el.scrollTop - top) < 1) return
    programmatic.current = true
    target.current = i
    retried.current = false
    el.scrollTo({ top, behavior: smooth && !prefersReducedMotion() ? 'smooth' : 'auto' })
  }, [])

  // Startposition ohne Animation, vor dem ersten Bild.
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    el.scrollTop = index * WHEEL_ITEM_H
    centered.current = index
    reported.current = index
    paint()
    if (autoFocus) el.focus({ preventScroll: true })
    // Nur beim Einhaengen; spaetere Werte kommen ueber den Effekt darunter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Wert von aussen (etwa „Wie letztes Mal"): hindrehen.
  useEffect(() => {
    if (index === reported.current) return
    reported.current = index
    scrollToIndex(index, true)
  }, [index, scrollToIndex])

  useEffect(() => () => {
    cancelAnimationFrame(frame.current)
    clearTimeout(settleTimer.current)
  }, [])

  // Finger, Maus oder Rad uebernehmen: ein laufendes Hindrehen verfaellt.
  const takeOver = () => {
    target.current = null
    programmatic.current = false
  }
  // Finger auf dem Rad (Touch-Ereignisse kommen auch waehrend des nativen Scrollens).
  const grab = () => { holding.current = true; takeOver() }
  const release = () => {
    holding.current = false
    clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => settleRef.current(), SETTLE_MS)
  }

  const step = (delta: number) => {
    const next = clamp(reported.current + delta, 0, count - 1)
    if (next === reported.current) return
    reported.current = next
    onChangeRef.current(next)
    scrollToIndex(next, true)
  }

  // Die Zeilen aendern sich nur mit Anzahl und Format — beim Drehen bleibt React still.
  const rows = useMemo(() => Array.from({ length: count }, (_, i) => (
    <div
      key={i}
      ref={node => { items.current[i] = node }}
      aria-hidden="true"
      data-wheel-index={i}
      style={{
        height: WHEEL_ITEM_H, lineHeight: `${WHEEL_ITEM_H}px`,
        textAlign: align, padding: '0 10px', whiteSpace: 'nowrap',
      }}
    >
      {format(i)}
    </div>
  )), [count, format, align])

  return (
    <div
      ref={scroller}
      role="spinbutton"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={numberAt(0)}
      aria-valuemax={numberAt(count - 1)}
      aria-valuenow={numberAt(index)}
      aria-valuetext={format(index)}
      className="tyd-wheel"
      onScroll={onScroll}
      onPointerDown={takeOver}
      onWheel={takeOver}
      onTouchStart={grab}
      onTouchEnd={release}
      onTouchCancel={release}
      onClick={event => {
        // Tippen auf eine Zeile dreht sie in die Mitte.
        const row = (event.target as HTMLElement).closest<HTMLElement>('[data-wheel-index]')
        if (!row) return
        const i = Number(row.dataset.wheelIndex)
        if (i === reported.current) return
        reported.current = i
        onChangeRef.current(i)
        scrollToIndex(i, true)
      }}
      onKeyDown={event => {
        const delta = { ArrowUp: -1, ArrowDown: 1, PageUp: -5, PageDown: 5, Home: -count, End: count }[event.key]
        if (delta == null) return
        event.preventDefault()
        step(delta)
      }}
      style={{
        height: WHEEL_HEIGHT, overflowY: 'auto', overscrollBehavior: 'contain',
        fontSize: 22, fontWeight: 500, fontVariantNumeric: 'tabular-nums',
        color: 'var(--lg-text)', touchAction: 'pan-y', outline: 'none',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent, #000 30%, #000 70%, transparent)',
        maskImage: 'linear-gradient(to bottom, transparent, #000 30%, #000 70%, transparent)',
      }}
    >
      {/* Platzhalter oben und unten, damit auch die erste und letzte Zeile in die Mitte kommt */}
      <div aria-hidden="true" style={{ height: PAD }} />
      {rows}
      <div aria-hidden="true" style={{ height: PAD }} />
    </div>
  )
}

