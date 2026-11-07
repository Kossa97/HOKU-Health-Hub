import { useCallback, useId, useRef } from 'react'
import type { Ref } from 'react'
import { LiquidCanvas, type LiquidGraphicHandle } from '../../stage/LiquidCanvas'
import { StageLabel } from '../../stage/StageLabel'
import { usePrefersReducedMotion } from '../../stage/usePrefersReducedMotion'
import { useStageLight, type StageLightHandle } from '../../stage/useStageLight'
import {
  NASAL_SPRAY_BODY_INNER_PATH,
  NASAL_SPRAY_BODY_PATH,
  NASAL_SPRAY_COLLAR_GROOVE_PATH,
  NASAL_SPRAY_COLLAR_PATH,
  NASAL_SPRAY_FILL,
  NASAL_SPRAY_FLANGE,
  NASAL_SPRAY_LABEL,
  NASAL_SPRAY_NOZZLE_PATH,
  NASAL_SPRAY_SPEC,
} from './nasalSprayShape'

/** viewBox des Glases, fest: die Zeichenfläche zeichnet nur bei neuen Werten neu */
const NASAL_SPRAY_VIEWBOX = [21, 6, 78, 288] as const
const NASAL_SPRAY_LIQUID_DETAIL = { 'data-nasal-spray-detail': 'liquid-canvas' }

export interface NasalSprayVisualProps {
  name?: string | null
  amount?: string | number | null
  unit?: string | null
  color: string
  size?: 'large' | 'compact' | 'carousel' | 'mini'
  className?: string
  showLabel?: boolean
  isActive?: boolean
  focus?: number
  lightOffset?: number
  stageLightRef?: Ref<StageLightHandle>
  /**
   * Wie voll der angebrochene Behaelter ist, 0–100 — aus dem Bestand. Ohne
   * Angabe die volle Flasche, wie sie im Regal steht.
   */
  fillPct?: number
}

const clamp01 = (value: number) => (Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0)
const clampOffset = (value: number) => (Number.isFinite(value) ? Math.max(-1, Math.min(1, value)) : 0)

// Kein erfundener Platzhalter: ohne bekannte Menge bleibt die Zeile weg.
function sprayAmountLabel(amount?: string | number | null, unit?: string | null): string | null {
  if (amount === null || amount === undefined || amount === '') return null
  return unit ? `${amount} ${unit}` : String(amount)
}

// Das Spray nimmt die naechsten beiden Sprossen der Leiter, die Vial und
// Ampulle schon steigen: 146,7 -> 186,4 -> 236,8, jeder Schritt x1,2706. Die
// Breite folgt immer dem eigenen Verhaeltnis 78/288, damit die Form nie in
// einen fremden Kasten gequetscht wird. Als Klassen geschrieben, weil ein
// Breakpoint nicht in einem Inline-Style leben kann.
const SIZE_CLASS: Record<NonNullable<NasalSprayVisualProps['size']>, string> = {
  large: 'h-[464px] w-[125.7px]',
  carousel: 'h-[186.4px] w-[50.5px] sm:h-[236.8px] sm:w-[64.1px]',
  compact: 'h-[140px] w-[37.9px]',
  mini: 'h-[76px] w-[20.6px]',
}

export function NasalSprayVisual({
  name,
  amount,
  unit,
  color,
  size = 'large',
  className = '',
  showLabel = true,
  isActive = true,
  focus,
  lightOffset = 0,
  stageLightRef,
  fillPct,
}: NasalSprayVisualProps) {
  const uid = useId()
  const reducedMotion = usePrefersReducedMotion()
  const visualFocus = focus === undefined ? (isActive ? 1 : 0.28) : clamp01(focus)
  const visualLightOffset = clampOffset(lightOffset)
  const labelName = name?.trim() || 'Nasenspray'
  const detail = sprayAmountLabel(amount, unit)
  const chamber = NASAL_SPRAY_SPEC.chamber!

  const rootRef = useRef<HTMLDivElement | null>(null)
  const shadowRef = useRef<SVGEllipseElement | null>(null)
  const bloomRef = useRef<SVGRectElement | null>(null)
  const sweepRef = useRef<SVGRectElement | null>(null)
  const outlineRef = useRef<SVGUseElement | null>(null)
  const headLightRef = useRef<SVGRectElement | null>(null)
  const liquidRef = useRef<LiquidGraphicHandle | null>(null)
  const labelSheenRef = useRef<HTMLDivElement | null>(null)

  const applyStageLight = useCallback((f: number, o: number) => {
    rootRef.current?.setAttribute('data-nasal-spray-focus', f.toFixed(2))
    rootRef.current?.setAttribute('data-nasal-spray-light-offset', o.toFixed(2))
    shadowRef.current?.setAttribute('cx', (60 - o * 6).toFixed(2))
    shadowRef.current?.setAttribute('rx', (26 + f * 9).toFixed(2))
    shadowRef.current?.setAttribute('opacity', (0.2 + f * 0.28).toFixed(3))
    outlineRef.current?.setAttribute('stroke-opacity', (0.36 + f * 0.28).toFixed(3))
    bloomRef.current?.setAttribute('transform', `translate(${(o * 14).toFixed(2)} 0)`)
    bloomRef.current?.setAttribute('opacity', (0.2 + f * 0.42).toFixed(3))
    sweepRef.current?.setAttribute('transform', `translate(${(o * 22).toFixed(2)} 0)`)
    sweepRef.current?.setAttribute('opacity', (0.14 + f * 0.34).toFixed(3))
    // Der Kopf ist matt: sein Licht wandert, aber es glaenzt nicht auf.
    headLightRef.current?.setAttribute('transform', `translate(${(o * 9).toFixed(2)} 0)`)
    headLightRef.current?.setAttribute('opacity', (0.18 + f * 0.2).toFixed(3))
    liquidRef.current?.applyStageLight(f, o)

    if (labelSheenRef.current) {
      labelSheenRef.current.style.transform = `translateX(${(o * 12).toFixed(2)}%)`
      labelSheenRef.current.style.opacity = (0.6 + f * 0.22).toFixed(3)
    }
  }, [])

  useStageLight(applyStageLight, { focus: visualFocus, lightOffset: visualLightOffset }, stageLightRef)

  const nameClass = size === 'large'
    ? 'text-sm sm:text-base leading-tight font-black text-white tracking-normal drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]'
    : size === 'carousel'
      ? 'text-[8.5px] sm:text-[10px] leading-tight font-black text-white tracking-normal drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]'
      : 'text-[7px] leading-tight font-black text-white'
  const detailClass = size === 'large'
    ? 'text-[10px] sm:text-xs mt-0.5 font-bold uppercase tracking-wide text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]'
    : 'text-[6px] mt-0.5 font-bold uppercase tracking-wide text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]'

  return (
    <div
      ref={rootRef}
      data-nasal-spray-detail="root"
      className={`relative mx-auto select-none ${SIZE_CLASS[size]} ${className}`}
      data-nasal-spray-focus={Number(visualFocus.toFixed(2))}
      data-nasal-spray-light-offset={Number(visualLightOffset.toFixed(2))}
      aria-label={detail ? `${labelName}, ${detail}` : labelName}
    >
      <svg
        data-nasal-spray-detail="glass"
        className="absolute inset-0 h-full w-full overflow-visible"
        viewBox="21 6 78 288"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <path id={`${uid}-outer`} d={NASAL_SPRAY_BODY_PATH} />
          <path id={`${uid}-inner`} d={NASAL_SPRAY_BODY_INNER_PATH} />
          <clipPath id={`${uid}-outerClip`}>
            <use href={`#${uid}-outer`} />
          </clipPath>
          <clipPath id={`${uid}-innerClip`}>
            <use href={`#${uid}-inner`} />
          </clipPath>
          {/* Vereinigung der drei Kopfteile. Ohne diesen Clip malte das
              Kopflicht einen hellen Streifen in die Luft neben der Düse —
              derselbe Fehler, den die Kantenlichter der Ampulle hatten. */}
          <clipPath id={`${uid}-headClip`}>
            <path d={NASAL_SPRAY_COLLAR_PATH} />
            <rect
              x={NASAL_SPRAY_FLANGE.x}
              y={NASAL_SPRAY_FLANGE.y}
              width={NASAL_SPRAY_FLANGE.width}
              height={NASAL_SPRAY_FLANGE.height}
              rx={NASAL_SPRAY_FLANGE.rx}
            />
            <path d={NASAL_SPRAY_NOZZLE_PATH} />
          </clipPath>
          {/* Klarglas: nur die Kanten tragen die Tiefe der Wandstaerke. */}
          <linearGradient id={`${uid}-glassDepth`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(2,6,23,0.62)" />
            <stop offset="9%" stopColor="rgba(226,232,240,0.11)" />
            <stop offset="32%" stopColor="rgba(255,255,255,0.02)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0)" />
            <stop offset="72%" stopColor="rgba(15,23,42,0.11)" />
            <stop offset="100%" stopColor="rgba(2,6,23,0.72)" />
          </linearGradient>
          <radialGradient id={`${uid}-glassBloom`} gradientUnits="userSpaceOnUse" cx="60" cy="215" r="80">
            <stop offset="0%" stopColor="rgba(255,255,255,0.13)" />
            <stop offset="48%" stopColor="rgba(255,255,255,0.03)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <linearGradient id={`${uid}-glassSweep`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.55)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          {/* Weisses Polypropylen: matt, weiche Kante, kein Metallglanz. Ein
              metallischer Kopf truege die Farbfamilie der Vial-Boerdelkappe. */}
          <linearGradient id={`${uid}-pp`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#9aa6b4" />
            <stop offset="16%" stopColor="#f4f7fb" />
            <stop offset="52%" stopColor="#e2e8f0" />
            <stop offset="86%" stopColor="#c2cbd7" />
            <stop offset="100%" stopColor="#8d99a8" />
          </linearGradient>
          <linearGradient id={`${uid}-headLight`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.5)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <radialGradient id={`${uid}-stageShadow`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(0,0,0,0.78)" />
            <stop offset="62%" stopColor="rgba(0,0,0,0.5)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
          <filter id={`${uid}-soft`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="2.1" />
          </filter>
        </defs>

        <ellipse
          ref={shadowRef}
          data-nasal-spray-detail="stage-shadow"
          cx={60 - visualLightOffset * 6}
          cy="296"
          rx={26 + visualFocus * 9}
          ry="5"
          fill={`url(#${uid}-stageShadow)`}
          opacity={0.2 + visualFocus * 0.28}
        />

        <use
          ref={outlineRef}
          data-nasal-spray-detail="outer-contour"
          href={`#${uid}-outer`}
          fill={`url(#${uid}-glassDepth)`}
          stroke="rgba(203,213,225,0.56)"
          strokeOpacity={0.36 + visualFocus * 0.28}
          strokeWidth="1.25"
          vectorEffect="non-scaling-stroke"
        />

        <g clipPath={`url(#${uid}-outerClip)`}>
          <rect
            ref={bloomRef}
            x="-40"
            y="120"
            width="200"
            height="200"
            fill={`url(#${uid}-glassBloom)`}
            opacity={0.2 + visualFocus * 0.42}
            transform={`translate(${visualLightOffset * 14} 0)`}
          />
          <rect
            ref={sweepRef}
            data-nasal-spray-detail="glass-sweep"
            x="44"
            y="130"
            width="32"
            height="170"
            fill={`url(#${uid}-glassSweep)`}
            opacity={0.14 + visualFocus * 0.34}
            transform={`translate(${visualLightOffset * 22} 0)`}
          />
        </g>

        {/* Die Fluessigkeit wird von der INNEN-Kontur beschnitten, nie von der
            aeusseren: sonst fehlt der Glasboden und sie klebt an der Aussenwand. */}
      </svg>

      {/* Flüssigkeit als Zeichenfläche (LiquidCanvas) zwischen Glas hinten und Glas vorn:
          ihre Bewegung malt nur sie neu, nicht das Glas samt Filtern (iPhone 07.11.2026) */}
      <LiquidCanvas
        fill={fillPct == null ? NASAL_SPRAY_FILL : NASAL_SPRAY_FILL * clamp01(fillPct / 100)}
        chamberAspect={chamber.aspect}
        x={chamber.x}
        y={chamber.y}
        width={chamber.width}
        height={chamber.height}
        color={color}
        bubbles={size === 'large'}
        reducedMotion={reducedMotion}
        seedFocus={visualFocus}
        seedLightOffset={visualLightOffset}
        handleRef={liquidRef}
        viewBox={NASAL_SPRAY_VIEWBOX}
        fit="meet"
        clipPath={NASAL_SPRAY_BODY_INNER_PATH}
        detail={NASAL_SPRAY_LIQUID_DETAIL}
      />

      <svg
        data-nasal-spray-detail="glass-front"
        className="absolute inset-0 h-full w-full overflow-visible"
        viewBox="21 6 78 288"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >

        {/* Die Wandstaerke. Non-scaling, damit sie die Karussellbreite ueberlebt. */}
        <use
          data-nasal-spray-detail="inner-contour"
          href={`#${uid}-inner`}
          fill="none"
          stroke="rgba(226,232,240,0.34)"
          strokeWidth="0.9"
          vectorEffect="non-scaling-stroke"
        />

        {/* Kantenlichter am Glas, auf den Koerper beschnitten. */}
        <g data-nasal-spray-detail="edge-lights" clipPath={`url(#${uid}-outerClip)`}>
          <path
            d="M25.5 168 L25.5 272 C 25.5 283 29 289 36 292"
            fill="none"
            stroke="rgba(255,255,255,0.52)"
            strokeOpacity={Math.max(0.08, Math.min(1, 0.6 - visualLightOffset * 0.6))}
            strokeWidth="4.4"
            strokeLinecap="round"
            filter={`url(#${uid}-soft)`}
          />
          <path
            d="M94.5 180 L94.5 272 C 94.5 281 91 287 85 290"
            fill="none"
            stroke="rgba(255,255,255,0.5)"
            strokeOpacity={Math.max(0.08, Math.min(1, 0.5 + visualLightOffset * 0.6))}
            strokeWidth="2.4"
            strokeLinecap="round"
            filter={`url(#${uid}-soft)`}
          />
        </g>

        {/* Der Kopf liegt ueber dem Glas: sein unterer Rand deckt die Naht am
            Flaschenhals ab. */}
        <g data-nasal-spray-detail="head">
          <path
            data-nasal-spray-detail="collar"
            d={NASAL_SPRAY_COLLAR_PATH}
            fill={`url(#${uid}-pp)`}
            stroke="rgba(148,163,184,0.5)"
            strokeWidth="1.4"
            vectorEffect="non-scaling-stroke"
          />
          <path
            data-nasal-spray-detail="collar-groove"
            d={NASAL_SPRAY_COLLAR_GROOVE_PATH}
            fill="none"
            stroke="rgba(120,132,148,0.5)"
            strokeWidth="1.6"
            vectorEffect="non-scaling-stroke"
          />
          <rect
            data-nasal-spray-detail="flange"
            x={NASAL_SPRAY_FLANGE.x}
            y={NASAL_SPRAY_FLANGE.y}
            width={NASAL_SPRAY_FLANGE.width}
            height={NASAL_SPRAY_FLANGE.height}
            rx={NASAL_SPRAY_FLANGE.rx}
            fill={`url(#${uid}-pp)`}
            stroke="rgba(148,163,184,0.5)"
            strokeWidth="1.4"
            vectorEffect="non-scaling-stroke"
          />
          <path
            data-nasal-spray-detail="nozzle"
            d={NASAL_SPRAY_NOZZLE_PATH}
            fill={`url(#${uid}-pp)`}
            stroke="rgba(148,163,184,0.5)"
            strokeWidth="1.4"
            vectorEffect="non-scaling-stroke"
          />
          <g clipPath={`url(#${uid}-headClip)`}>
            <rect
              ref={headLightRef}
              data-nasal-spray-detail="head-light"
              x="30"
              y="6"
              width="24"
              height="135"
              fill={`url(#${uid}-headLight)`}
              opacity={0.18 + visualFocus * 0.2}
              transform={`translate(${visualLightOffset * 9} 0)`}
            />
          </g>
        </g>
      </svg>

      {showLabel && (
        <StageLabel
          name={labelName}
          detail={detail}
          className="left-0 right-0 rounded-sm"
          nameClassName={nameClass}
          detailClassName={detailClass}
          wrapperProps={{
            'data-nasal-spray-detail': 'label',
            style: {
              top: `${(NASAL_SPRAY_LABEL.topPct * 100).toFixed(1)}%`,
              height: `${(NASAL_SPRAY_LABEL.heightPct * 100).toFixed(1)}%`,
            },
          }}
          innerProps={{ className: 'flex h-full flex-col justify-center px-1' }}
          sheenRef={labelSheenRef}
          sheenStyle={{
            transform: `translateX(${visualLightOffset * 12}%)`,
            opacity: 0.6 + visualFocus * 0.22,
          }}
        />
      )}
    </div>
  )
}
