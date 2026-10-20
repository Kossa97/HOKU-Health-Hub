import { useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import type { Ref } from 'react'
import { buildLiquid, LIQUID_VB_H, LIQUID_VB_W } from './liquidGeometry'
import { useSloshSubscribe } from '../../../components/SloshContext'
import { REST_ENERGY, type SloshState } from '../../../components/sloshEngine'

function clamp01(wert: number): number {
  return Number.isFinite(wert) ? Math.max(0, Math.min(1, wert)) : 0
}

/** Ueberlappt das Rechteck seinen Rahmen (null: den Bildschirm)? */
function imRahmen(r: DOMRect | null, rahmen: Element | null): boolean {
  if (!r) return false
  const b = rahmen
    ? rahmen.getBoundingClientRect()
    : { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight }
  return r.right > b.left && r.left < b.right && r.bottom > b.top && r.top < b.bottom
}

/** Der naechste waagerecht scrollende Vorfahr — oder null fuer den Bildschirm. */
function scrollContainer(element: Element): Element | null {
  for (let node = element.parentElement; node; node = node.parentElement) {
    const overflowX = getComputedStyle(node).overflowX
    if (overflowX === 'auto' || overflowX === 'scroll') return node
  }
  return null
}

/**
 * Die Ruhewellen bewegen die Oberflaeche um hoechstens 2,3 viewBox-Einheiten
 * (1,15 nach oben und unten).
 * Ist das Vial so klein, dass das unter einem halben Bildpunkt bleibt (die
 * Zeilen der Liste), sieht niemand sie — dann zeichnet es in Ruhe nicht neu.
 */
const RUHEWELLE_EINHEITEN = 2.3
const RUHEWELLE_MIN_PX = 0.5

/** Wie oft ein Vial selbst nachsieht, ob es im Bild steht (s). */
const LAGE_PRUEFEN_ALLE_S = 0.3

function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - value, 3)
}

function levelChangeDurationMs(from: number, to: number): number {
  return Math.round(600 + Math.abs(to - from) * 2200)
}

// A few rising bubbles give the liquid life. Positions are in viewBox units and
// the body clip-path makes them pop out of existence at the waterline.
// `phase`: wie weit jede Blase beim Einhaengen schon aufgestiegen ist (Anteil
// ihrer Dauer). Frueher starteten alle unten, einige erst nach bis zu 3 s —
// nach dem Auffuellen stand die Fluessigkeit noch sekundenlang still, bis die
// Blasen oben ankamen. Mit negativem `begin` laufen sie ab dem ersten Bild,
// ueber die Hoehe verteilt.
const LIQUID_BUBBLES = [
  { cx: 24, r: 1.5, dur: 5.4, phase: 0.62 },
  { cx: 46, r: 1.0, dur: 6.6, phase: 0.3 },
  { cx: 63, r: 1.9, dur: 5.0, phase: 0.08 },
  { cx: 82, r: 1.1, dur: 7.2, phase: 0.46 },
  { cx: 98, r: 1.4, dur: 5.9, phase: 0.8 },
]

// The liquid's own share of the stage light. The surrounding form calls this
// from its applyStageLight so both move in the same frame.
export interface LiquidGraphicHandle {
  applyStageLight: (focus: number, lightOffset: number) => void
}

export interface LiquidGraphicProps {
  uid: string
  fill: number // 0..1
  tilt?: number
  chamberAspect?: number
  // Where the chamber sits inside the surrounding form's viewBox.
  x: number
  y: number
  width: number
  height: number
  color: string
  bubbles?: boolean
  reducedMotion?: boolean
  seedFocus?: number
  seedLightOffset?: number
  handleRef?: Ref<LiquidGraphicHandle>
}

// One graphic for the whole liquid: body, tilting surface, sub-surface glow,
// meniscus rim and specular all derive from the same sampled geometry, so they
// move as one. Subscribes to the slosh engine and redraws itself imperatively —
// no React render happens while the surface moves.
export function LiquidGraphic({
  uid,
  fill,
  tilt = 0,
  chamberAspect,
  x,
  y,
  width,
  height,
  color,
  bubbles = true,
  reducedMotion = false,
  seedFocus = 1,
  seedLightOffset = 0,
  handleRef,
}: LiquidGraphicProps) {
  const subscribe = useSloshSubscribe()
  const stageRef = useRef({ focus: seedFocus, lightOffset: seedLightOffset })
  const highlightShift = seedLightOffset * 10
  const geom = buildLiquid({ fill, tilt, chamberAspect })

  const svgRef = useRef<SVGSVGElement | null>(null)
  // Nur was auf dem Bildschirm steht, bewegt sich. Im Karussell stehen zehn
  // Vials nebeneinander; jedes zeichnete seine Oberflaeche in jedem Bild neu
  // (ein Dutzend SVG-Aenderungen) und liess zehn SMIL-Animationen fuer die
  // Blasen laufen — auch die seitlich ausgerollten. Die Blasen allein kosteten
  // im Ruhezustand mehr Stilberechnung als alles andere zusammen, und Chrome
  // rechnet SMIL auch pausiert weiter: sie werden ausserhalb nicht gerendert.
  // Ohne IntersectionObserver (Tests, alte Browser) gilt alles als sichtbar.
  // Mit ihm startet ein Vial unsichtbar: sonst liefen beim Einhaengen erst
  // alle Blasen an, um gleich darauf wieder abgebaut zu werden.
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined')
  const visibleRef = useRef(visible)
  // Der letzte Stand der Maschine: wer wieder sichtbar wird, zeichnet sich
  // damit sofort — auch wenn die Maschine gerade steht (Vollbild-Flug,
  // verborgener Tab) und ihr Zuruecksetzen verpasst wurde.
  const lastStateRef = useRef<SloshState | null>(null)
  // Der Rahmen des Beobachters (Karussell-Streifen, sonst der Bildschirm) und
  // wann ein Vial zuletzt selbst nachgesehen hat.
  const rahmenRef = useRef<Element | null>(null)
  const lageGeprueftRef = useRef(-Infinity)
  const ruhewelleSichtbarRef = useRef(true)
  const ruhendGezeichnetRef = useRef(false)
  const bodyRef = useRef<SVGPathElement | null>(null)
  const surfaceRef = useRef<SVGPathElement | null>(null)
  const glowRef = useRef<SVGPathElement | null>(null)
  const rimRef = useRef<SVGPathElement | null>(null)
  const specHaloRef = useRef<SVGEllipseElement | null>(null)
  const specCoreRef = useRef<SVGEllipseElement | null>(null)
  const leftGlintRef = useRef<SVGEllipseElement | null>(null)
  const rightGlintRef = useRef<SVGEllipseElement | null>(null)
  const refractLeftRef = useRef<SVGRectElement | null>(null)
  const refractRightRef = useRef<SVGRectElement | null>(null)
  const previousFillRef = useRef(fill)
  const fillTweenRef = useRef<{ from: number; to: number; start: number; duration: number } | null>(null)

  const draw = useCallback(
    (s: SloshState) => {
      lastStateRef.current = s
      // Der Beobachter kann auf dem iPhone nach der ersten Meldung still
      // bleiben. Beide Richtungen pruefen: hereingerollte Vials aufwecken
      // und herausgerollte wieder anhalten.
      if (typeof IntersectionObserver !== 'undefined' && s.time - lageGeprueftRef.current >= LAGE_PRUEFEN_ALLE_S) {
        lageGeprueftRef.current = s.time
        const rect = svgRef.current?.getBoundingClientRect() ?? null
        const sichtbar = imRahmen(rect, rahmenRef.current)
        const hoehe = rect?.height ?? 0
        ruhewelleSichtbarRef.current = hoehe === 0 || RUHEWELLE_EINHEITEN * (hoehe / LIQUID_VB_H) >= RUHEWELLE_MIN_PX
        if (sichtbar !== visibleRef.current) {
          visibleRef.current = sichtbar
          setVisible(sichtbar)
        }
      }
      if (!visibleRef.current) return false
      // Kleines Vial in Ruhe: die Wellen laegen unter einem halben Bildpunkt.
      // Einmal im Ruhestand gezeichnet, bleibt es stehen, bis wieder etwas
      // schwappt oder der Fuellstand gleitet.
      const ruhig = s.energy < REST_ENERGY && fillTweenRef.current === null
      if (ruhig && !ruhewelleSichtbarRef.current && ruhendGezeichnetRef.current) return false
      ruhendGezeichnetRef.current = ruhig
      const stage = stageRef.current
      const stageFocus = stage.focus
      const stageShift = stage.lightOffset * 10
      let animatedFill = fill
      const tween = fillTweenRef.current
      if (tween) {
        const progress = Math.max(0, (performance.now() - tween.start) / tween.duration)
        if (progress >= 1) {
          fillTweenRef.current = null
        } else {
          animatedFill = tween.from + (tween.to - tween.from) * easeOutCubic(progress)
        }
      }
      const g = buildLiquid({ fill: animatedFill, tilt: s.tilt, energy: s.energy, time: s.time, chamberAspect })
      bodyRef.current?.setAttribute('d', g.body)
      surfaceRef.current?.setAttribute('d', g.surface)
      glowRef.current?.setAttribute('d', g.glow)
      rimRef.current?.setAttribute('d', g.rim)
      const sx = (g.highlightX + stageShift).toFixed(2)
      const sy = g.highlightY.toFixed(2)
      // the sheen stays faint at rest and flares as the surface agitates
      const halo = (0.12 + stageFocus * 0.12 + s.energy * 0.5).toFixed(2)
      const core = (0.08 + stageFocus * 0.16 + s.energy * 0.6).toFixed(2)
      specHaloRef.current?.setAttribute('cx', sx)
      specHaloRef.current?.setAttribute('cy', sy)
      specHaloRef.current?.setAttribute('opacity', halo)
      specCoreRef.current?.setAttribute('cx', sx)
      specCoreRef.current?.setAttribute('cy', sy)
      specCoreRef.current?.setAttribute('opacity', core)
      leftGlintRef.current?.setAttribute('cy', g.leftWallY.toFixed(2))
      rightGlintRef.current?.setAttribute('cy', g.rightWallY.toFixed(2))
      // Waehrend der Fuellstand gleitet, braucht er jedes Bild — auch wenn die
      // Fluessigkeit selbst ruht und die Maschine sonst nur halb so oft zeichnet.
      return fillTweenRef.current !== null
    },
    [fill, chamberAspect],
  )

  useEffect(() => {
    if (!subscribe) return
    // Neu gebaut (Fuellstand, Kammerform): einmal ganz zeichnen, auch in Ruhe.
    ruhendGezeichnetRef.current = false
    return subscribe(draw)
  }, [subscribe, draw])

  const drawRef = useRef(draw)
  useEffect(() => { drawRef.current = draw }, [draw])
  useEffect(() => {
    const target = svgRef.current
    if (!target || typeof IntersectionObserver === 'undefined') return
    rahmenRef.current = scrollContainer(target)
    // Rahmen ist der Karussell-Streifen, denn er schneidet ab — nicht der
    // Bildschirm. Ohne Vorlauf: schon ein Rand von einer halben Breite hielt
    // beide Nachbarn wach und kostete mehr als das Doppelte. Ein
    // hereinrollendes Vial zeichnet sich beim Eintreten sofort mit dem
    // letzten Stand der Maschine.
    const observer = new IntersectionObserver(
      entries => {
        const sichtbar = entries[entries.length - 1]?.isIntersecting ?? true
        const war = visibleRef.current
        visibleRef.current = sichtbar
        setVisible(sichtbar)
        if (sichtbar && !war && lastStateRef.current) drawRef.current(lastStateRef.current)
      },
      { root: rahmenRef.current },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const previousFill = previousFillRef.current
    if (Math.abs(previousFill - fill) < 0.001) return

    fillTweenRef.current = reducedMotion
      ? null
      : {
          from: previousFill,
          to: fill,
          start: performance.now(),
          duration: levelChangeDurationMs(previousFill, fill),
        }
    previousFillRef.current = fill
  }, [fill, reducedMotion])

  const applyStageLight = useCallback((focus: number, lightOffset: number) => {
    stageRef.current = { focus, lightOffset }
    // Das Glanzlicht folgt dem Licht erst beim naechsten Zeichnen — auch ein
    // kleines Vial in Ruhe zeichnet deshalb einmal neu.
    ruhendGezeichnetRef.current = false
    refractLeftRef.current?.setAttribute('x', (5 + lightOffset * 8).toFixed(2))
    refractLeftRef.current?.setAttribute('opacity', (0.46 + focus * 0.22).toFixed(3))
    refractRightRef.current?.setAttribute('x', (99 + lightOffset * 5).toFixed(2))
    refractRightRef.current?.setAttribute('opacity', (0.14 + focus * 0.16).toFixed(3))
    surfaceRef.current?.setAttribute('opacity', (0.4 + focus * 0.14).toFixed(3))
  }, [])

  useLayoutEffect(() => {
    applyStageLight(stageRef.current.focus, stageRef.current.lightOffset)
  })

  useImperativeHandle(handleRef, () => ({ applyStageLight }), [applyStageLight])

  return (
    <svg
      ref={svgRef}
      data-vial-detail="liquid-graphic"
      x={x}
      y={y}
      width={width}
      height={height}
      className="overflow-visible"
      viewBox={`0 0 ${LIQUID_VB_W} ${LIQUID_VB_H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      style={{ color }}
    >
    <defs>
    {/* one template path drives the body fills and the clip together */}
    <path id={`${uid}-bodyPath`} ref={bodyRef} d={geom.body} />
    <clipPath id={`${uid}-clip`}>
    <use href={`#${uid}-bodyPath`} />
    </clipPath>
    <linearGradient id={`${uid}-depth`} x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stopColor="rgba(255,255,255,0.26)" />
    <stop offset="18%" stopColor="rgba(255,255,255,0.05)" />
    <stop offset="100%" stopColor="rgba(0,0,0,0.58)" />
    </linearGradient>
    <linearGradient id={`${uid}-side`} x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stopColor="rgba(255,255,255,0.18)" />
    <stop offset="30%" stopColor="rgba(255,255,255,0)" />
    <stop offset="72%" stopColor="rgba(0,0,0,0.05)" />
    <stop offset="100%" stopColor="rgba(0,0,0,0.3)" />
    </linearGradient>
    <linearGradient id={`${uid}-glow`} x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stopColor="rgba(255,255,255,0.58)" />
    <stop offset="55%" stopColor="rgba(255,255,255,0.14)" />
    <stop offset="100%" stopColor="rgba(255,255,255,0)" />
    </linearGradient>
    <linearGradient id={`${uid}-refract`} x1="0" y1="0" x2="1" y2="0">
    <stop offset="0%" stopColor="rgba(255,255,255,0)" />
    <stop offset="50%" stopColor="rgba(255,255,255,0.5)" />
    <stop offset="100%" stopColor="rgba(255,255,255,0)" />
    </linearGradient>
    <linearGradient id={`${uid}-surface`} x1="0" y1="0" x2="0" y2="1">
    <stop offset="0%" stopColor="rgba(255,255,255,0.58)" />
    <stop offset="100%" stopColor="rgba(255,255,255,0.05)" />
    </linearGradient>
    {/* Der Lichtteich am Boden. Frueher 0,58 hell und 48 breit — in einer
        flachen, breiten Kammer (Nasenspray) war das kein Lichtreflex mehr,
        sondern ein weisser Fleck ueber dem halben Boden. Jetzt halb so hell
        und mit einem weichen Rand, der frueher anfaengt. */}
    <radialGradient id={`${uid}-caustic`} cx="50%" cy="50%" r="50%">
    <stop offset="0%" stopColor="rgba(255,255,255,0.32)" />
    <stop offset="55%" stopColor="rgba(255,255,255,0.12)" />
    <stop offset="100%" stopColor="rgba(255,255,255,0)" />
    </radialGradient>
    <radialGradient id={`${uid}-floor`} cx="50%" cy="100%" r="70%">
    <stop offset="0%" stopColor="rgba(0,0,0,0.4)" />
    <stop offset="100%" stopColor="rgba(0,0,0,0)" />
    </radialGradient>
    <radialGradient id={`${uid}-spec`} cx="50%" cy="50%" r="50%">
    <stop offset="0%" stopColor="rgba(255,255,255,0.95)" />
    <stop offset="55%" stopColor="rgba(255,255,255,0.35)" />
    <stop offset="100%" stopColor="rgba(255,255,255,0)" />
    </radialGradient>
    </defs>

    <g>
    <use data-vial-detail="liquid-body" href={`#${uid}-bodyPath`} fill="currentColor" fillOpacity="0.8" />
    <g clipPath={`url(#${uid}-clip)`}>
    <use href={`#${uid}-bodyPath`} fill={`url(#${uid}-depth)`} />
    <use href={`#${uid}-bodyPath`} fill={`url(#${uid}-side)`} />
    <rect x="0" y={LIQUID_VB_H - 34} width={LIQUID_VB_W} height="34" fill={`url(#${uid}-floor)`} />
    {/* Der Teich gehoert der FLUESSIGKEIT, nicht der Kammer: steht wenig
        drin, liegt der Boden nah unter der Oberflaeche und das Licht sammelt
        sich auf kleinerer Flaeche. Vorher war er eine feste Groesse, und in
        einer flachen Kammer deckte er den Boden fast zu. */}
    <ellipse
    cx={LIQUID_VB_W / 2}
    cy={LIQUID_VB_H - 13}
    rx={32 + 10 * clamp01(fill)}
    ry={10 + 3 * clamp01(fill)}
    fill={`url(#${uid}-caustic)`}
    />
    <rect ref={refractLeftRef} x={5 + seedLightOffset * 8} y="0" width="16" height={LIQUID_VB_H} fill={`url(#${uid}-refract)`} opacity={0.46 + seedFocus * 0.22} />
    <rect ref={refractRightRef} x={99 + seedLightOffset * 5} y="0" width="10" height={LIQUID_VB_H} fill={`url(#${uid}-refract)`} opacity={0.14 + seedFocus * 0.16} />
    <path ref={glowRef} data-vial-detail="liquid-glow" d={geom.glow} fill={`url(#${uid}-glow)`} />
    {/* Blasen als CSS-Animation (`.tyd-liquid-bubble` in index.css), nicht
        als SMIL: SMIL rechnete in jedem Bild den Stil der ganzen Seite neu —
        in der Liste mit allen Vials lastete das allein den Haupt-Thread aus.
        Gleicher Weg (von 192 nach 30), gleiche Deckkraft, gleicher Takt. */}
    {bubbles && !reducedMotion && visible && LIQUID_BUBBLES.map((b, i) => (
    <circle
      key={i}
      data-vial-detail="liquid-bubble"
      className="tyd-liquid-bubble"
      cx={b.cx}
      cy="0"
      r={b.r}
      fill="rgba(255,255,255,0.55)"
      style={{ animationDuration: `${b.dur}s`, animationDelay: `${-(b.dur * b.phase).toFixed(2)}s` }}
    />
    ))}
    </g>
    <path ref={surfaceRef} data-vial-detail="liquid-surface" d={geom.surface} fill={`url(#${uid}-surface)`} opacity={0.4 + seedFocus * 0.14} />
    <ellipse ref={leftGlintRef} cx="4" cy={geom.leftWallY} rx="4.5" ry="8" fill={`url(#${uid}-spec)`} opacity="0.5" />
    <ellipse ref={rightGlintRef} cx={LIQUID_VB_W - 4} cy={geom.rightWallY} rx="4.5" ry="8" fill={`url(#${uid}-spec)`} opacity="0.5" />
    <ellipse ref={specHaloRef} cx={geom.highlightX + highlightShift} cy={geom.highlightY} rx="24" ry="4.2" fill={`url(#${uid}-spec)`} opacity={0.14 + seedFocus * 0.14} />
    <ellipse ref={specCoreRef} cx={geom.highlightX + highlightShift} cy={geom.highlightY} rx="8" ry="2.8" fill={`url(#${uid}-spec)`} opacity={0.1 + seedFocus * 0.16} />
    <path
    ref={rimRef}
    data-vial-detail="liquid-rim"
    d={geom.rim}
    fill="none"
    stroke="rgba(255,255,255,0.66)"
    strokeWidth="1.4"
    strokeLinecap="round"
    vectorEffect="non-scaling-stroke"
    />
    </g>
    </svg>
  )
}
