import { useCallback, useId, useRef, useState } from 'react'
import type { CSSProperties, Ref, RefObject } from 'react'
import { usePrefersReducedMotion } from '../features/my-stack/stage/usePrefersReducedMotion'
import { useStageLight, type StageLightHandle } from '../features/my-stack/stage/useStageLight'
import { LiquidGraphic, type LiquidGraphicHandle } from '../features/my-stack/stage/LiquidGraphic'
import { VIAL_CAP_COLLAR, VIAL_CAP_HEIGHT, VIAL_CAP_TOP_PATH, VIAL_INNER_PATH, VIAL_LABEL_INSET_PCT, VIAL_OUTER_PATH, VIAL_SPEC } from '../features/my-stack/extensions/peptide/vialShape'
import { StageLabel } from '../features/my-stack/stage/StageLabel'

// Imperative stage-light channel: the carousel pushes focus/lightOffset per
// scroll frame through this handle so no React re-render happens while swiping.
// The channel itself is shared by every stage form; the name stays for the
// carousel and the vial's existing consumers.
export type VialStageLightHandle = StageLightHandle

interface PeptideVialVisualProps {
  name?: string | null
  amount?: string | number | null
  unit?: string | null
  fillPct: number
  color: string
  animateOnMount?: boolean
  size?: 'large' | 'compact' | 'carousel' | 'mini'
  className?: string
  showLabel?: boolean
  isActive?: boolean
  slosh?: number
  focus?: number
  lightOffset?: number
  stageLightRef?: Ref<VialStageLightHandle>
}

function clampFill(fillPct: number): number {
  if (!Number.isFinite(fillPct)) return 0
  return Math.max(0, Math.min(100, Math.round(fillPct)))
}

function clampSlosh(slosh: number): number {
  if (!Number.isFinite(slosh)) return 0
  return Math.max(-1, Math.min(1, slosh))
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(1, value))
}

// Die zweite Zeile auf dem Etikett — die Wirkstoffmenge.
//
// Hier stand bisher ein Rueckfall auf „Wirkstoff / Vial": ein FELDNAME, fett
// und in Versalien auf dem Etikett, hartkodiert auf Deutsch in einer App, die
// auf Deutsch UND Englisch startet. Sichtbar wurde er ueberall, wo die Menge
// noch fehlt — unter anderem auf dem ganzen Farbschritt, der vor dem
// Staerke-Schritt kommt. Keine andere Darreichungsform tut das: Tablette und
// Kapsel tragen dort nur den Namen.
//
// Ein leeres Feld beschriftet man nicht mit seinem eigenen Namen. Fehlt die
// Menge, faellt die Zeile weg (StageLabel laesst `null` aus) und das Etikett
// traegt nur noch den Namen — wie bei allen anderen Formen.
function vialAmountLabel(amount?: string | number | null, unit?: string | null): string | null {
  if (amount === null || amount === undefined || amount === '') return null
  return `${amount} ${unit || 'mg'} / Vial`
}

// Metallic flip-off cap. The glass vial itself is drawn below as one unified
// shell so the neck, shoulder and body share one continuous material.
// The sheen uses a pre-softened radial gradient instead of an SVG blur filter
// so shifting it per scroll frame never forces a filter re-raster.
function VialTop({
  focus,
  lightOffset,
  sheenRef,
  arcRef,
  marginClass,
}: {
  focus: number
  lightOffset: number
  sheenRef: RefObject<SVGEllipseElement | null>
  arcRef: RefObject<SVGPathElement | null>
  marginClass: string
}) {
  const uid = useId()
  const capSheenOpacity = 0.24 + focus * 0.4
  return (
    <svg className={`pointer-events-none relative z-20 ${marginClass} block h-auto w-full`} viewBox={`0 0 120 ${VIAL_CAP_HEIGHT}`} aria-hidden="true">
      <defs>
        <linearGradient id={`${uid}-capSilver`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f6f9fc" />
          <stop offset="1" stopColor="#c3ccd8" />
        </linearGradient>
        <linearGradient id={`${uid}-capCollar`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#8f99a7" />
          <stop offset="0.25" stopColor="#dfe6ee" />
          <stop offset="0.5" stopColor="#ffffff" />
          <stop offset="0.75" stopColor="#ccd4de" />
          <stop offset="1" stopColor="#8f99a7" />
        </linearGradient>
        <radialGradient id={`${uid}-capSheen`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.85)" />
          <stop offset="55%" stopColor="rgba(255,255,255,0.4)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
      </defs>

            <g data-vial-detail="cap-collar">
        <rect data-vial-detail="single-cap" {...VIAL_CAP_COLLAR} fill={`url(#${uid}-capCollar)`} stroke="#64748b" strokeOpacity="0.5" strokeWidth="1" />
      </g>
      <path data-vial-detail="cap-top" d={VIAL_CAP_TOP_PATH} fill={`url(#${uid}-capSilver)`} stroke="#64748b" strokeOpacity="0.5" strokeWidth="1" />
      <line x1="21" y1="32" x2="99" y2="32" stroke="#475569" strokeOpacity="0.35" strokeWidth="1.3" />
      <ellipse
        ref={sheenRef}
        data-vial-detail="cap-light-sheen"
        cx={60 + lightOffset * 18}
        cy="22"
        rx="28"
        ry="7"
        fill={`url(#${uid}-capSheen)`}
        opacity={capSheenOpacity}
      />
      <path ref={arcRef} d="M27 20 C43 14 77 14 93 20" fill="none" stroke="#ffffff" strokeOpacity={0.36 + focus * 0.28} strokeWidth="1.8" />
    </svg>
  )
}


// Die Kammer liegt jetzt in den Formdaten, damit Innenkontur und
// Fluessigkeitsfenster nicht auseinanderlaufen koennen.
const VIAL_CHAMBER = VIAL_SPEC.chamber!

export function PeptideVialVisual({
  name,
  amount,
  unit,
  fillPct,
  color,
  animateOnMount = false,
  size = 'large',
  className = '',
  showLabel = true,
  isActive = true,
  slosh = 0,
  focus,
  lightOffset = 0,
  stageLightRef,
}: PeptideVialVisualProps) {
  const clampedFill = clampFill(fillPct)
  const tilt = clampSlosh(slosh)
  const uid = useId()
  const reducedMotion = usePrefersReducedMotion()
  const fillFrac = Math.min(clampedFill / 100, 0.97)
  // focus/lightOffset props only seed the paint; afterwards the carousel
  // drives the stage light imperatively via setStageLight. A layout effect
  // below re-applies the imperative values after every re-render so an
  // active-vial change can't snap the light back to the prop defaults.
  const visualFocus = focus === undefined ? (isActive ? 1 : 0.28) : clamp01(focus)
  const visualLightOffset = clampSlosh(lightOffset)
  const focusAttr = Number(visualFocus.toFixed(2))
  const lightOffsetAttr = Number(visualLightOffset.toFixed(2))
  const shellGlowOpacity = 0.2 + visualFocus * 0.42
  const shellEdgeOpacity = 0.36 + visualFocus * 0.28
  const shadowOpacity = 0.2 + visualFocus * 0.28
  const [fillMotion] = useState<{ mode: 'none' | 'reveal' }>(() => (
    animateOnMount && fillFrac > 0.001
      ? { mode: 'reveal' }
      : { mode: 'none' }
  ))

  const rootRef = useRef<HTMLDivElement | null>(null)
  const liquidRef = useRef<LiquidGraphicHandle | null>(null)
  const capSheenRef = useRef<SVGEllipseElement | null>(null)
  const capArcRef = useRef<SVGPathElement | null>(null)
  const stageShadowRef = useRef<SVGEllipseElement | null>(null)
  const shellOutlineRef = useRef<SVGUseElement | null>(null)
  const shellBloomRef = useRef<SVGRectElement | null>(null)
  const shellHighlightsRef = useRef<SVGGElement | null>(null)
  const shellHiLeftRef = useRef<SVGGElement | null>(null)
  const shellHiRightRef = useRef<SVGGElement | null>(null)
  const glassSweepRef = useRef<SVGRectElement | null>(null)
  const labelSheenRef = useRef<HTMLDivElement | null>(null)

  const applyStageLight = useCallback((f: number, o: number) => {
    rootRef.current?.setAttribute('data-vial-focus', f.toFixed(2))
    rootRef.current?.setAttribute('data-vial-light-offset', o.toFixed(2))

    capSheenRef.current?.setAttribute('cx', (60 + o * 18).toFixed(2))
    capSheenRef.current?.setAttribute('opacity', (0.24 + f * 0.4).toFixed(3))
    capArcRef.current?.setAttribute('stroke-opacity', (0.36 + f * 0.28).toFixed(3))

    stageShadowRef.current?.setAttribute('cx', (60 - o * 8).toFixed(2))
    stageShadowRef.current?.setAttribute('rx', (34 + f * 12).toFixed(2))
    stageShadowRef.current?.setAttribute('ry', (5 + f * 4).toFixed(2))
    stageShadowRef.current?.setAttribute('opacity', (0.2 + f * 0.28).toFixed(3))
    shellOutlineRef.current?.setAttribute('stroke-opacity', (0.36 + f * 0.28).toFixed(3))
    shellBloomRef.current?.setAttribute('transform', `translate(${(o * 21.6).toFixed(2)} 0)`)
    shellBloomRef.current?.setAttribute('opacity', (0.2 + f * 0.42).toFixed(3))
    glassSweepRef.current?.setAttribute('transform', `translate(${(o * 34).toFixed(2)} 0)`)
    glassSweepRef.current?.setAttribute('opacity', (0.14 + f * 0.34).toFixed(3))
    shellHighlightsRef.current?.setAttribute('opacity', (0.42 + f * 0.58).toFixed(3))
    // the edge facing the fixed light brightens, the far edge dims
    shellHiLeftRef.current?.setAttribute('opacity', Math.max(0.08, Math.min(1, 0.6 - o * 0.6)).toFixed(3))
    shellHiRightRef.current?.setAttribute('opacity', Math.max(0.08, Math.min(1, 0.5 + o * 0.6)).toFixed(3))

    liquidRef.current?.applyStageLight(f, o)

    if (labelSheenRef.current) {
      labelSheenRef.current.style.transform = `translateX(${(o * 10).toFixed(2)}%)`
      labelSheenRef.current.style.opacity = (0.62 + f * 0.2).toFixed(3)
    }
  }, [])

  useStageLight(applyStageLight, { focus: visualFocus, lightOffset: visualLightOffset }, stageLightRef)

  const viewportRevealClass = fillMotion.mode === 'reveal' ? 'vial-liquid-fill-reveal' : ''
  const fillIntroDurationMs = Math.round(1000 + fillFrac * 1500)
  const viewportRevealStyle = fillMotion.mode === 'reveal'
    ? { '--vial-fill-intro-duration': `${fillIntroDurationMs}ms` } as CSSProperties
    : undefined
  const labelName = name?.trim() || 'Peptidname'
  // 'large' = detail views (edit form, previews); 'carousel' = the My Stack
  // carousel, sized so several vials can peek in side by side; 'compact' =
  // tiny inline previews.
  // `large` ist die grosse, fuer grosse Flaechen GEZEICHNETE Vorlage: der
  // Farbschritt im Formular und die My-Stack-Buehne (dort in `StageFit`
  // eingepasst). Sie steht deshalb fest und gross genug — statt klein zu sein
  // und hochgezogen zu werden.
  const widthClass = size === 'large' ? 'w-[184px] max-w-full' : size === 'carousel' ? 'w-20 sm:w-24' : size === 'mini' ? 'w-12' : 'w-16'
  // Every non-carousel size is a pure scale of the My Stack carousel vial: the
  // glass body keeps the carousel's 5:7 aspect (mobile 80×112) so width alone
  // drives height, and the cap (w-full) scales with it automatically.
  const shellClass = size === 'carousel' ? 'h-28 sm:h-36' : 'aspect-[5/7]'
  // Cap overlap is proportional (5% of width = the carousel's 4px on 80px) so
  // the cap shrinks in lockstep with the vial at every size.
  const capMarginClass = size === 'carousel' ? '-mb-1' : '-mb-[5%]'
  // Der seitliche Einzug kommt aus dem Glaskoerper (`VIAL_LABEL_INSET_PCT`),
  // nicht aus einer getippten Prozentzahl — sonst wandert das Band von der
  // Kante weg, sobald die Silhouette sich aendert.
  // Kein seitlicher Innenabstand: die 4 px auf jeder Seite waren Bandbreite,
  // die die Aufschrift nie benutzen konnte — der Durchlauf endete 8 px vor den
  // Etikettkanten. Als einzige Form hatte der Vial ihn; die uebrigen fuenf
  // Baender laufen von jeher bis an ihre Kante.
  const labelClass = size === 'large'
    ? 'top-1/2 -translate-y-1/2 rounded-sm py-2'
    : 'top-1/2 -translate-y-1/2 rounded-sm py-1'
  const nameClass = size === 'large'
    ? 'text-[26px] leading-tight'
    : size === 'carousel'
      ? 'text-sm sm:text-base leading-tight'
      : 'text-[9px] leading-tight'
  const amountClass = size === 'large'
    ? 'text-[18px] mt-1'
    : size === 'carousel'
      ? 'text-[10px] sm:text-xs mt-0.5'
      : 'text-[7px] mt-0.5'
  return (
    <div
      ref={rootRef}
      className={`relative mx-auto select-none ${widthClass} ${className}`}
      data-fill-pct={clampedFill}
      data-vial-focus={focusAttr}
      data-vial-light-offset={lightOffsetAttr}
      aria-label={[labelName, vialAmountLabel(amount, unit), `${clampedFill}%`].filter(Boolean).join(', ')}
    >
      <style>{`
        @keyframes vial-shimmer {
          0%, 100% { transform: translateX(0); opacity: .35; }
          50% { transform: translateX(14%); opacity: .7; }
        }
        @keyframes vial-liquid-fill-reveal {
          from { clip-path: inset(100% 0 0 0); }
          to { clip-path: inset(0 0 0 0); }
        }
        .vial-liquid-fill-reveal {
          animation: vial-liquid-fill-reveal var(--vial-fill-intro-duration, 1200ms) cubic-bezier(.22,1,.36,1) both;
          will-change: clip-path;
        }
        @media (prefers-reduced-motion: reduce) {
          .vial-shimmer, .vial-liquid-fill-reveal { animation: none !important; }
        }
      `}</style>

      <div className="relative flex flex-col items-center">
        {VialTop({ focus: visualFocus, lightOffset: visualLightOffset, sheenRef: capSheenRef, arcRef: capArcRef, marginClass: capMarginClass })}

        <div className={`relative z-0 w-full ${shellClass} overflow-visible`}>
          <svg
            data-vial-detail="unified-glass-shell"
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
            viewBox="0 0 120 294"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <path
                id={`${uid}-vialShellPath`}
                d={VIAL_OUTER_PATH}
              />
              <clipPath id={`${uid}-shellClip`}>
                <use href={`#${uid}-vialShellPath`} />
              </clipPath>
              {/* clear glass: only the edges carry glass-thickness tint, the
                  centre stays transparent so the dark background shows through */}
              <linearGradient id={`${uid}-glassDepth`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(2,6,23,0.62)" />
                <stop offset="10%" stopColor="rgba(226,232,240,0.10)" />
                <stop offset="34%" stopColor="rgba(255,255,255,0.02)" />
                <stop offset="50%" stopColor="rgba(255,255,255,0)" />
                <stop offset="70%" stopColor="rgba(15,23,42,0.10)" />
                <stop offset="100%" stopColor="rgba(2,6,23,0.7)" />
              </linearGradient>
              {/* static gradient — the light shift happens via a cheap transform
                  on the clipped bloom rect, never by rewriting gradient geometry */}
              <radialGradient id={`${uid}-glassBloom`} gradientUnits="userSpaceOnUse" cx="60" cy="98" r="76">
                <stop offset="0%" stopColor="rgba(255,255,255,0.12)" />
                <stop offset="48%" stopColor="rgba(255,255,255,0.03)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </radialGradient>
              <radialGradient id={`${uid}-stageShadowSoft`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgba(0,0,0,0.78)" />
                <stop offset="62%" stopColor="rgba(0,0,0,0.5)" />
                <stop offset="100%" stopColor="rgba(0,0,0,0)" />
              </radialGradient>
              {/* soft vertical specular band; slides across the glass with the
                  vial's position so the fixed stage light reads as sweeping */}
              <linearGradient id={`${uid}-glassSweep`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                <stop offset="50%" stopColor="rgba(255,255,255,0.6)" />
                <stop offset="100%" stopColor="rgba(255,255,255,0)" />
              </linearGradient>
              <filter id={`${uid}-shellSoft`} x="-25%" y="-25%" width="150%" height="150%">
                <feGaussianBlur stdDeviation="2.2" />
              </filter>
            </defs>

            <ellipse
              ref={stageShadowRef}
              data-vial-detail="glass-stage-shadow"
              cx={60 - visualLightOffset * 8}
              cy="292"
              rx={34 + visualFocus * 12}
              ry={5 + visualFocus * 4}
              fill={`url(#${uid}-stageShadowSoft)`}
              opacity={shadowOpacity}
            />
            <use
              ref={shellOutlineRef}
              data-vial-detail="unified-glass-outline"
              href={`#${uid}-vialShellPath`}
              fill={`url(#${uid}-glassDepth)`}
              stroke="rgba(203,213,225,0.56)"
              strokeOpacity={shellEdgeOpacity}
              strokeWidth="1.25"
              vectorEffect="non-scaling-stroke"
            />
            <g clipPath={`url(#${uid}-shellClip)`}>
              <rect
                ref={shellBloomRef}
                x="-40"
                y="-20"
                width="200"
                height="334"
                fill={`url(#${uid}-glassBloom)`}
                opacity={shellGlowOpacity}
                transform={`translate(${visualLightOffset * 21.6} 0)`}
              />
              {/* the sweeping specular — softly clipped to the glass, glides
                  sideways as the vial travels through the fixed stage light */}
              <rect
                ref={glassSweepRef}
                data-vial-detail="glass-sweep"
                x="40"
                y="0"
                width="40"
                height="294"
                fill={`url(#${uid}-glassSweep)`}
                opacity={0.14 + visualFocus * 0.34}
                transform={`translate(${visualLightOffset * 34} 0)`}
              />
            </g>
            {/* blurred strokes stay static so the filter result can be cached;
                the whole group fades with focus, and the two side edges fade
                against each other so the lit edge follows the light source */}
            <g ref={shellHighlightsRef} data-vial-detail="shell-highlights" opacity={0.42 + visualFocus * 0.58}>
              <g ref={shellHiLeftRef} opacity={Math.max(0.08, Math.min(1, 0.6 - visualLightOffset * 0.6))}>
                <path
                  d="M12 58 C12 44 36 38 36 23 L36 8"
                  fill="none"
                  stroke="rgba(255,255,255,0.58)"
                  strokeOpacity="0.54"
                  strokeWidth="4.4"
                  strokeLinecap="round"
                  filter={`url(#${uid}-shellSoft)`}
                />
                <path
                  d="M12 64 L12 242 C12 265 25 282 48 286"
                  fill="none"
                  stroke="rgba(255,255,255,0.52)"
                  strokeOpacity="0.6"
                  strokeWidth="5"
                  strokeLinecap="round"
                  filter={`url(#${uid}-shellSoft)`}
                />
              </g>
              <g ref={shellHiRightRef} opacity={Math.max(0.08, Math.min(1, 0.5 + visualLightOffset * 0.6))}>
                <path
                  d="M108 64 L108 246 C108 268 96 282 73 286"
                  fill="none"
                  stroke="rgba(255,255,255,0.5)"
                  strokeOpacity="0.5"
                  strokeWidth="3"
                  strokeLinecap="round"
                  filter={`url(#${uid}-shellSoft)`}
                />
              </g>
              <ellipse cx="60" cy="273" rx="42" ry="12" fill="rgba(255,255,255,0.16)" opacity="0.5" filter={`url(#${uid}-shellSoft)`} />
            </g>
            <ellipse cx="60" cy="278" rx="45" ry="9" fill="rgba(0,0,0,0.32)" opacity="0.55" />
          </svg>

          {/* Single-graphic liquid: body, tilting surface, meniscus rim and
              highlight all derive from one geometry so they move as one. */}
          <div
            data-vial-detail="liquid-motion-viewport"
            className={`pointer-events-none absolute inset-0 ${viewportRevealClass}`.trim()}
            style={viewportRevealStyle}
          >
            <svg
              data-vial-detail="liquid-vial-chamber"
              className="absolute inset-0 h-full w-full overflow-visible"
              viewBox="0 0 120 294"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                {/* Die Fluessigkeit wird von der INNEN-Kontur beschnitten, nie
                    von der aeusseren: sonst fehlt der Glasboden und sie klebt
                    an der Aussenwand. */}
                <clipPath id={`${uid}-liquidChamberClip`}>
                  <path d={VIAL_INNER_PATH} />
                </clipPath>
              </defs>
              <g data-vial-detail="liquid-glass-window" clipPath={`url(#${uid}-liquidChamberClip)`}>
                <LiquidGraphic
                  uid={uid}
                  fill={fillFrac}
                  tilt={tilt}
                  x={VIAL_CHAMBER.x}
                  y={VIAL_CHAMBER.y}
                  width={VIAL_CHAMBER.width}
                  height={VIAL_CHAMBER.height}
                  chamberAspect={VIAL_CHAMBER.aspect}
                  color={color}
                  reducedMotion={reducedMotion}
                  seedFocus={visualFocus}
                  seedLightOffset={visualLightOffset}
                  handleRef={liquidRef}
                />
              </g>

              {/* Die Wandstaerke. Sie liegt in diesem SVG und damit ueber der
                  Fluessigkeit — im Glas-SVG darunter waere sie verdeckt.
                  Non-scaling, damit sie die Karussellbreite ueberlebt. */}
              <path
                data-vial-detail="inner-contour"
                d={VIAL_INNER_PATH}
                fill="none"
                stroke="rgba(226,232,240,0.34)"
                strokeWidth="0.9"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          </div>

          <div className="vial-shimmer pointer-events-none absolute inset-y-[24%] left-[24%] w-[32%] rotate-6 rounded-full bg-white/10 blur-[6px]" />
          {!isActive && (
            <svg
              data-vial-detail="inactive-vial-overlay"
              className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
              viewBox="0 0 120 294"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <defs>
                <clipPath id={`${uid}-inactiveOverlayClip`}>
                  <path d={VIAL_OUTER_PATH} />
                </clipPath>
              </defs>
              <g clipPath={`url(#${uid}-inactiveOverlayClip)`}>
                <path d={VIAL_OUTER_PATH} fill="rgba(0,0,0,0.34)" />
              </g>
            </svg>
          )}

          {showLabel && (
            <StageLabel
              name={labelName}
              detail={vialAmountLabel(amount, unit)}
              className={labelClass}
              nameClassName={`${nameClass} font-black text-white tracking-normal drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]`}
              detailClassName={`${amountClass} font-bold uppercase tracking-wide text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]`}
              wrapperProps={{
                'data-vial-detail': 'label-glass-wrap',
                style: {
                  left: `${(VIAL_LABEL_INSET_PCT * 100).toFixed(2)}%`,
                  right: `${(VIAL_LABEL_INSET_PCT * 100).toFixed(2)}%`,
                },
              }}
              innerProps={{ 'data-vial-detail': 'full-width-label' }}
              sheenRef={labelSheenRef}
              sheenStyle={{ transform: `translateX(${visualLightOffset * 10}%)`, opacity: 0.62 + visualFocus * 0.2 }}
            />
          )}
        </div>
      </div>
    </div>
  )
}
