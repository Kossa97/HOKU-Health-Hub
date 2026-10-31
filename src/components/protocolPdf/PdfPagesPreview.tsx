import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal, flushSync } from 'react-dom'
import { ChevronLeft, ChevronRight, Loader2, Maximize2, X } from 'lucide-react'
import { rasterizePdf, revokeRasterPages, type RasterPage } from '../../lib/protocolPdf/rasterizePdf'

export interface PdfPagesPreviewLabels {
  title: string
  updating: string
  empty: string
  error: string
  pageOf: (page: number, total: number) => string
  enlarge: (page: number) => string
  prev: string
  next: string
  close: string
  zoomHint: string
}

interface Props {
  /** Das fertige PDF; `null`, solange keins gebaut ist. */
  bytes: ArrayBuffer | null
  /** Das PDF wird gerade neu gebaut. */
  building: boolean
  failed: boolean
  /** Warum die gezeigten Seiten gerade nicht stimmen (z. B. ungültiger Zeitraum). */
  notice?: string | null
  labels: PdfPagesPreviewLabels
}

/** A4 hochkant — Platzhalter, bis die erste Seite gerastert ist. */
const A4_RATIO = 297 / 210
const MIN_PIXEL_WIDTH = 720
const MAX_PIXEL_WIDTH = 1600
const DOUBLE_TAP_MS = 280
const DOUBLE_TAP_SLOP_PX = 24
const ZOOM = 2.2
const MAX_ZOOM = 3
const HINT_MS = 2600

function pixelWidthFor(cssWidth: number): number {
  const dpr = Math.min(window.devicePixelRatio || 1, 3)
  // Etwas Reserve fuer die Vollansicht: dort ist die Seite fast so breit
  // wie der Bildschirm und wird beim Doppeltippen vergroessert.
  const raw = Math.round(cssWidth * dpr * 1.25)
  return Math.min(MAX_PIXEL_WIDTH, Math.max(MIN_PIXEL_WIDTH, raw))
}

/**
 * Live-Vorschau des PDFs als echte Seiten: wischen zum Blaettern, tippen fuer
 * die Vollansicht. Die alte Fassung bleibt stehen, bis die neue fertig
 * gerastert und dekodiert ist — kein weisses Aufblitzen beim Aendern.
 */
export function PdfPagesPreview({ bytes, building, failed, notice, labels }: Props) {
  const [pages, setPages] = useState<RasterPage[]>([])
  /** Fuer welche Fassung die Seiten (oder der Fehler) gelten. */
  const [doneFor, setDoneFor] = useState<ArrayBuffer | null>(null)
  const [rasterFailed, setRasterFailed] = useState(false)
  const [current, setCurrentState] = useState(0)
  const [viewerPage, setViewerPage] = useState<number | null>(null)
  const [pixelWidth, setPixelWidth] = useState(0)

  const pagerRef = useRef<HTMLDivElement>(null)
  const pagesRef = useRef<RasterPage[]>([])
  const currentRef = useRef(0)

  const setCurrent = useCallback((index: number) => {
    currentRef.current = index
    setCurrentState(index)
  }, [])

  // Rasterbreite aus der Kartenbreite — nur bei deutlich mehr Platz neu.
  useLayoutEffect(() => {
    const el = pagerRef.current
    if (!el) return
    const measure = () => {
      const next = pixelWidthFor(el.clientWidth)
      setPixelWidth(prev => (prev === 0 || next > prev * 1.15 ? next : prev))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!bytes || pixelWidth === 0) return
    const abort = new AbortController()
    const isStale = () => abort.signal.aborted
    void rasterizePdf(bytes, pixelWidth, currentRef.current, abort.signal)
      .then(next => {
        if (!next) return
        if (isStale()) {
          revokeRasterPages(next)
          return
        }
        revokeRasterPages(pagesRef.current)
        pagesRef.current = next
        setPages(next)
        setRasterFailed(false)
        setDoneFor(bytes)
      })
      .catch(err => {
        console.error('[pdf-preview]', err)
        if (isStale()) return
        setRasterFailed(true)
        setDoneFor(bytes)
      })
    // Eine neuere Fassung ersetzt diese; laufende Arbeit bricht ab.
    return () => abort.abort()
  }, [bytes, pixelWidth])

  useEffect(() => () => revokeRasterPages(pagesRef.current), [])

  const onScroll = useCallback(() => {
    const el = pagerRef.current
    if (!el) return
    const index = nearestPage(el)
    if (index !== currentRef.current) setCurrent(index)
  }, [setCurrent])

  const goTo = (index: number) => {
    const el = pagerRef.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ left: pageOffset(el, index), behavior: reduce ? 'auto' : 'smooth' })
  }

  const total = pages.length
  const showError = (failed || rasterFailed) && total === 0
  // Seiten stehen, passen aber nicht zur Eingabe: abblenden und sagen, warum.
  const message = notice ?? ((failed || rasterFailed) && total > 0 ? labels.error : null)
  const busy = !message && (building || (bytes != null && doneFor !== bytes))
  const single = total <= 1
  // Weniger Seiten als vorher: der Browser zieht die Scrollposition nach,
  // die Anzeige springt gleich auf die letzte vorhandene Seite.
  const shownPage = Math.min(current, Math.max(total - 1, 0))

  return (
    <div className="flex flex-col">
      <div className="shrink-0 px-4 pt-3 pb-1.5 flex items-center justify-between gap-2">
        <p className="lg-group-title !mx-1 !mb-0">{labels.title}</p>
        {/* Rechts: die Seitenzahl — während des Neuzeichnens der Hinweis darauf. */}
        <span className="inline-flex items-center gap-1.5 text-[12px] tabular-nums text-[var(--lg-text-2)]" aria-live="polite">
          {busy && total > 0
            ? <><Loader2 size={12} className="animate-spin" aria-hidden="true" /> {labels.updating}</>
            : total > 0 ? labels.pageOf(shownPage + 1, total) : null}
        </span>
      </div>

      {message && (
        <p role="status" className="px-5 pb-1 text-[12px] leading-snug text-[var(--lg-warn-text)]">{message}</p>
      )}

      <div className={`relative mx-auto w-full max-w-[560px] transition-opacity duration-200 ${message ? 'opacity-40' : ''}`}>
        <div
          ref={pagerRef}
          onScroll={onScroll}
          className={`pdf-pager relative flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain px-4 py-2 ${single ? '' : 'gap-3'}`}
        >
          {total === 0 ? (
            <div
              className="relative w-full shrink-0 overflow-hidden rounded-[10px] bg-[var(--lg-fill)]"
              style={{ aspectRatio: `1 / ${A4_RATIO}` }}
            >
              <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-[13px] text-[var(--lg-text-2)]">
                {showError
                  ? labels.error
                  : bytes || busy
                    ? <Loader2 size={20} className="animate-spin text-[var(--lg-text-3)]" aria-label={labels.updating} />
                    : labels.empty}
              </div>
            </div>
          ) : pages.map((page, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setViewerPage(i)}
              aria-label={labels.enlarge(i + 1)}
              className={`pdf-page relative shrink-0 snap-center overflow-hidden rounded-[10px] bg-white ${single ? 'w-full' : 'w-[calc(100%-2rem)]'}`}
              style={{ aspectRatio: `${page.width} / ${page.height}` }}
            >
              <img
                src={page.url}
                alt=""
                draggable={false}
                decoding="async"
                className="absolute inset-0 h-full w-full select-none object-contain"
              />
              <span
                aria-hidden="true"
                className="absolute bottom-2.5 right-2.5 grid h-7 w-7 place-items-center rounded-full bg-black/50 text-white backdrop-blur-md"
              >
                <Maximize2 size={13} />
              </span>
            </button>
          ))}
        </div>

        {!single && (
          <>
            <button
              type="button"
              onClick={() => goTo(shownPage - 1)}
              disabled={shownPage === 0}
              aria-label={labels.prev}
              className="pdf-pager-arrow left-1"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => goTo(shownPage + 1)}
              disabled={shownPage >= total - 1}
              aria-label={labels.next}
              className="pdf-pager-arrow right-1"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </div>

      {!single && total <= 12 && (
        <div className="flex items-center justify-center gap-1.5 pt-1.5" aria-hidden="true">
          {pages.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-[width,background-color] duration-200 ${i === shownPage ? 'w-4 bg-[var(--lg-text)]' : 'w-1.5 bg-[var(--lg-text-3)]'}`}
            />
          ))}
        </div>
      )}

      {viewerPage != null && pages.length > 0 && (
        <PdfPageViewer
          pages={pages}
          initialPage={Math.min(viewerPage, pages.length - 1)}
          labels={labels}
          onClose={index => {
            setViewerPage(null)
            if (index !== currentRef.current) {
              setCurrent(index)
              const el = pagerRef.current
              if (el) el.scrollTo({ left: pageOffset(el, index), behavior: 'auto' })
            }
          }}
        />
      )}
    </div>
  )
}

function pageElements(pager: HTMLElement): HTMLElement[] {
  return [...pager.querySelectorAll<HTMLElement>('.pdf-page')]
}

function pageOffset(pager: HTMLElement, index: number): number {
  const page = pageElements(pager)[index]
  if (!page) return 0
  return page.offsetLeft - (pager.clientWidth - page.offsetWidth) / 2
}

function nearestPage(pager: HTMLElement): number {
  const center = pager.scrollLeft + pager.clientWidth / 2
  let best = 0
  let bestDist = Infinity
  pageElements(pager).forEach((page, i) => {
    const dist = Math.abs(page.offsetLeft + page.offsetWidth / 2 - center)
    if (dist < bestDist) {
      bestDist = dist
      best = i
    }
  })
  return best
}

interface ViewerProps {
  pages: RasterPage[]
  initialPage: number
  labels: PdfPagesPreviewLabels
  onClose: (currentPage: number) => void
}

/** Vollansicht: Seiten untereinander; Doppeltippen oder zwei Finger vergroessern an der Stelle. */
function PdfPageViewer({ pages, initialPage, labels, onClose }: ViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(false)
  const [zoom, setZoom] = useState(1)
  const zoomRef = useRef(1)
  // Den Hinweis nur zeigen, wo es Finger gibt; mit der Maus geht Doppelklick.
  const [hint, setHint] = useState(() => window.matchMedia('(pointer: coarse)').matches)
  /** Wann zuletzt zwei Finger lagen — deren Loslassen ist kein Doppeltippen. */
  const lastPinch = useRef(0)
  const [current, setCurrent] = useState(initialPage)
  const lastTap = useRef<{ t: number; x: number; y: number } | null>(null)
  const lastPointerType = useRef('mouse')
  const closing = useRef(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  // Nach dem Schliessen geht der Fokus dorthin zurueck, wo er herkam.
  const openerRef = useRef<Element | null>(null)

  useLayoutEffect(() => {
    // ??= : StrictMode fuehrt den Effekt doppelt aus, dann haette schon der Schliessen-Knopf den Fokus.
    openerRef.current ??= document.activeElement
    closeRef.current?.focus({ preventScroll: true })
    const el = scrollRef.current
    const page = el?.querySelectorAll<HTMLElement>('.pdf-viewer-page')[initialPage]
    if (el && page) el.scrollTop = page.offsetTop - 12
    const raf = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(raf)
  }, [initialPage])

  const close = useCallback(() => {
    if (closing.current) return
    closing.current = true
    setShown(false)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.setTimeout(() => {
      onClose(current)
      if (openerRef.current instanceof HTMLElement) openerRef.current.focus({ preventScroll: true })
    }, reduce ? 120 : 220)
  }, [onClose, current])

  useEffect(() => {
    const timer = window.setTimeout(() => setHint(false), HINT_MS)
    return () => window.clearTimeout(timer)
  }, [])

  /**
   * Zoomt so, dass die Stelle `fx`/`fy` (Anteil der Seite) unter dem Punkt
   * `clientX`/`clientY` liegt — gemessen an der Seite selbst, nicht am Rand
   * der Ansicht (der Inhalt ist zentriert und hat feste Abstaende).
   */
  const zoomTo = useCallback((next: number, page: HTMLElement | null, fx: number, fy: number, clientX: number, clientY: number) => {
    const el = scrollRef.current
    if (!el) return
    zoomRef.current = next
    // Synchron rendern, damit die neue Groesse schon steht, wenn gescrollt wird.
    flushSync(() => setZoom(next))
    if (!page) return
    const after = page.getBoundingClientRect()
    el.scrollLeft += after.left + fx * after.width - clientX
    el.scrollTop += after.top + fy * after.height - clientY
  }, [])

  // Zwei Finger: eigene Geste statt Seiten-Zoom des Browsers (der wuerde die
  // ganze App vergroessern). Nicht passiv, sonst greift preventDefault nicht.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let pinch: { dist: number; zoom: number; page: HTMLElement | null; fx: number; fy: number } | null = null
    // Höchstens ein Zoomschritt pro Bild: touchmove kommt öfter, als gezeichnet wird.
    let frame = 0
    let pending: { zoom: number; x: number; y: number } | null = null
    const spread = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const middle = (t: TouchList) => ({ x: (t[0].clientX + t[1].clientX) / 2, y: (t[0].clientY + t[1].clientY) / 2 })
    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return
      e.preventDefault()
      lastTap.current = null
      lastPinch.current = performance.now()
      const m = middle(e.touches)
      const page = document.elementFromPoint(m.x, m.y)?.closest<HTMLElement>('.pdf-viewer-page') ?? null
      const r = page?.getBoundingClientRect()
      pinch = {
        dist: spread(e.touches),
        zoom: zoomRef.current,
        page,
        fx: r ? (m.x - r.left) / r.width : 0.5,
        fy: r ? (m.y - r.top) / r.height : 0.5,
      }
      setHint(false)
    }
    const onMove = (e: TouchEvent) => {
      if (!pinch || e.touches.length !== 2) return
      e.preventDefault()
      lastPinch.current = performance.now()
      const m = middle(e.touches)
      pending = { zoom: Math.min(MAX_ZOOM, Math.max(1, pinch.zoom * spread(e.touches) / pinch.dist)), x: m.x, y: m.y }
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        if (pinch && pending) zoomTo(pending.zoom, pinch.page, pinch.fx, pinch.fy, pending.x, pending.y)
      })
    }
    const onEnd = (e: TouchEvent) => {
      if (!pinch) return
      lastPinch.current = performance.now()
      if (e.touches.length < 2) pinch = null
    }
    // iOS Safari meldet die Geste zusaetzlich so — auch die nicht durchlassen.
    const stopGesture = (e: Event) => e.preventDefault()
    el.addEventListener('touchstart', onStart, { passive: false })
    el.addEventListener('touchmove', onMove, { passive: false })
    el.addEventListener('touchend', onEnd)
    el.addEventListener('touchcancel', onEnd)
    el.addEventListener('gesturestart', stopGesture)
    return () => {
      el.removeEventListener('touchstart', onStart)
      el.removeEventListener('touchmove', onMove)
      el.removeEventListener('touchend', onEnd)
      el.removeEventListener('touchcancel', onEnd)
      el.removeEventListener('gesturestart', stopGesture)
      cancelAnimationFrame(frame)
    }
  }, [zoomTo])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    const mid = el.scrollTop + el.clientHeight / 2
    const items = el.querySelectorAll<HTMLElement>('.pdf-viewer-page')
    let index = 0
    items.forEach((item, i) => { if (item.offsetTop <= mid) index = i })
    if (index !== current) setCurrent(index)
  }

  const toggleZoom = (target: EventTarget, clientX: number, clientY: number) => {
    const page = target instanceof Element ? target.closest<HTMLElement>('.pdf-viewer-page') : null
    const before = page?.getBoundingClientRect()
    const fx = before ? (clientX - before.left) / before.width : 0.5
    const fy = before ? (clientY - before.top) / before.height : 0.5
    setHint(false)
    zoomTo(zoomRef.current > 1.05 ? 1 : ZOOM, page, fx, fy, clientX, clientY)
  }

  const onPointerUp = (e: ReactPointerEvent) => {
    if (e.pointerType === 'mouse') return
    const now = performance.now()
    if (now - lastPinch.current < 400) {
      lastTap.current = null
      return
    }
    const prev = lastTap.current
    if (prev && now - prev.t < DOUBLE_TAP_MS && Math.hypot(e.clientX - prev.x, e.clientY - prev.y) < DOUBLE_TAP_SLOP_PX) {
      lastTap.current = null
      toggleZoom(e.target, e.clientX, e.clientY)
    } else {
      lastTap.current = { t: now, x: e.clientX, y: e.clientY }
    }
  }

  return createPortal(
    <div
      data-app-modal
      role="dialog"
      aria-modal="true"
      aria-label={labels.title}
      className={`pdf-viewer fixed inset-0 z-[80] flex flex-col ${shown ? 'is-shown' : ''}`}
    >
      <div className="pdf-viewer-scrim absolute inset-0 bg-black" aria-hidden="true" />
      <div className="pdf-viewer-top relative z-10 flex shrink-0 items-center justify-between gap-2 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <span className="pl-2 text-[13px] font-medium tabular-nums text-white/75" aria-live="polite">
          {labels.pageOf(current + 1, pages.length)}
        </span>
        <button
          ref={closeRef}
          type="button"
          data-app-back-close
          onClick={close}
          aria-label={labels.close}
          className="grid h-11 w-11 place-items-center"
        >
          <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-white/15 text-white"><X size={17} /></span>
        </button>
      </div>
      <div
        ref={scrollRef}
        onScroll={onScroll}
        onPointerDown={e => { lastPointerType.current = e.pointerType }}
        onPointerUp={onPointerUp}
        // Touch erkennt das Doppeltippen selbst (onPointerUp) — der Browser
        // schickt dort teils zusaetzlich dblclick, das wuerde zuruecksetzen.
        onDoubleClick={e => { if (lastPointerType.current === 'mouse') toggleZoom(e.target, e.clientX, e.clientY) }}
        className="pdf-viewer-body relative z-10 flex-1 overflow-auto overscroll-contain px-3 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      >
        <div
          className="mx-auto flex flex-col gap-3"
          style={{ width: `${zoom * 100}%`, maxWidth: `${zoom * 860}px` }}
        >
          {pages.map((page, i) => (
            <div
              key={i}
              className="pdf-viewer-page relative w-full overflow-hidden rounded-[6px] bg-white"
              style={{ aspectRatio: `${page.width} / ${page.height}` }}
            >
              <img src={page.url} alt={labels.pageOf(i + 1, pages.length)} draggable={false} className="absolute inset-0 h-full w-full select-none" />
            </div>
          ))}
        </div>
      </div>
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute bottom-[max(1.75rem,calc(env(safe-area-inset-bottom)+0.75rem))] left-1/2 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-[rgba(44,44,48,0.92)] px-4 py-2 text-[12px] text-white/85 transition-opacity duration-300 ${hint ? 'opacity-100' : 'opacity-0'}`}
      >
        {labels.zoomHint}
      </span>
    </div>,
    document.body,
  )
}
