import { useCallback, useId, useRef } from 'react'
import type { Ref } from 'react'
import { LiquidCanvas, type LiquidGraphicHandle } from '../../stage/LiquidCanvas'
import { StageLabel } from '../../stage/StageLabel'
import { usePrefersReducedMotion } from '../../stage/usePrefersReducedMotion'
import { useStageLight, type StageLightHandle } from '../../stage/useStageLight'
import {
  SPRAY_ACTUATOR,
  SPRAY_ACTUATOR_RIDGE_PATH,
  SPRAY_BLOOM_SHIFT,
  SPRAY_CHAMBER,
  SPRAY_COLLAR,
  SPRAY_COLLAR_GROOVE_PATH,
  SPRAY_COLLAR_RIB_XS,
  SPRAY_COLLAR_RIB_YS,
  SPRAY_DIP_TUBE,
  SPRAY_FILL,
  SPRAY_GROUND_SHIFT,
  SPRAY_HEAD_LIGHT_SHIFT,
  SPRAY_INNER_PATH,
  SPRAY_LABEL_HEIGHT_PCT,
  SPRAY_LABEL_INSET_PCT,
  SPRAY_LABEL_TOP_PCT,
  SPRAY_NOZZLE,
  SPRAY_NOZZLE_MOUTH,
  SPRAY_OUTER_PATH,
  SPRAY_SHEEN_SHIFT,
} from './sprayShape'

/** viewBox des Glases, fest: die Zeichenfläche zeichnet nur bei neuen Werten neu */
const SPRAY_VIEWBOX = [23, 72, 74, 220] as const
const SPRAY_LIQUID_DETAIL = { 'data-spray-detail': 'liquid-canvas' }

export interface SprayVisualProps {
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

// Eine Sprosse unter dem Nasenspray: 146,7 -> 186,4 statt 186,4 -> 236,8.
// Schritt x1,2706, die Leiter also intakt — es ist dieselbe Hoehe wie Vial,
// Ampulle und Tropfflasche. Das Mundspray ist auch am echten Objekt die
// kleinere Flasche, und zwei Pumpspraydosen auf derselben Sprosse waeren in
// der Reihe nicht auseinanderzuhalten.
const SIZE_CLASS: Record<NonNullable<SprayVisualProps['size']>, string> = {
  large: 'h-[365px] w-[122.8px]',
  carousel: 'h-[146.7px] w-[49.3px] sm:h-[186.4px] sm:w-[62.7px]',
  compact: 'h-[110px] w-[37px]',
  mini: 'h-[60px] w-[20.2px]',
}

export function SprayVisual({
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
}: SprayVisualProps) {
  const uid = useId()
  const reducedMotion = usePrefersReducedMotion()
  const visualFocus = focus === undefined ? (isActive ? 1 : 0.28) : clamp01(focus)
  const visualLightOffset = clampOffset(lightOffset)
  const labelName = name?.trim() || 'Spray'
  const detail = sprayAmountLabel(amount, unit)

  const rootRef = useRef<HTMLDivElement | null>(null)
  const shadowRef = useRef<SVGEllipseElement | null>(null)
  const bloomRef = useRef<SVGRectElement | null>(null)
  const sweepRef = useRef<SVGRectElement | null>(null)
  const outlineRef = useRef<SVGUseElement | null>(null)
  const headLightRef = useRef<SVGRectElement | null>(null)
  const liquidRef = useRef<LiquidGraphicHandle | null>(null)
  const labelSheenRef = useRef<HTMLDivElement | null>(null)

  const applyStageLight = useCallback((f: number, o: number) => {
    rootRef.current?.setAttribute('data-spray-focus', f.toFixed(2))
    rootRef.current?.setAttribute('data-spray-light-offset', o.toFixed(2))
    // Schatten weg von der Lampe, Glanz zu ihr hin — die Regel, die
    // stageLightDirection.test.ts fuer alle Formen festhaelt.
    shadowRef.current?.setAttribute('cx', (60 - o * SPRAY_GROUND_SHIFT).toFixed(2))
    shadowRef.current?.setAttribute('rx', (22 + f * 8).toFixed(2))
    shadowRef.current?.setAttribute('opacity', (0.2 + f * 0.28).toFixed(3))
    outlineRef.current?.setAttribute('stroke-opacity', (0.36 + f * 0.28).toFixed(3))
    bloomRef.current?.setAttribute('transform', `translate(${(o * SPRAY_BLOOM_SHIFT).toFixed(2)} 0)`)
    bloomRef.current?.setAttribute('opacity', (0.2 + f * 0.42).toFixed(3))
    sweepRef.current?.setAttribute('transform', `translate(${(o * SPRAY_SHEEN_SHIFT).toFixed(2)} 0)`)
    sweepRef.current?.setAttribute('opacity', (0.14 + f * 0.34).toFixed(3))
    headLightRef.current?.setAttribute('transform', `translate(${(o * SPRAY_HEAD_LIGHT_SHIFT).toFixed(2)} 0)`)
    headLightRef.current?.setAttribute('opacity', (0.16 + f * 0.22).toFixed(3))
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
      data-spray-detail="root"
      className={`relative mx-auto select-none ${SIZE_CLASS[size]} ${className}`}
      data-spray-focus={Number(visualFocus.toFixed(2))}
      data-spray-light-offset={Number(visualLightOffset.toFixed(2))}
      aria-label={detail ? `${labelName}, ${detail}` : labelName}
    >
      <svg
        data-spray-detail="glass"
        className="absolute inset-0 h-full w-full overflow-visible"
        viewBox="23 72 74 220"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <path id={`${uid}-outer`} d={SPRAY_OUTER_PATH} />
          <path id={`${uid}-inner`} d={SPRAY_INNER_PATH} />
          <clipPath id={`${uid}-outerClip`}>
            <use href={`#${uid}-outer`} />
          </clipPath>
          <clipPath id={`${uid}-innerClip`}>
            <use href={`#${uid}-inner`} />
          </clipPath>
          {/* Vereinigung der drei Kopfteile. Unbeschnitten malte das Kopflicht
              einen hellen Streifen in die Luft neben der Duese — derselbe
              Fehler, den die Kantenlichter der Ampulle hatten. */}
          <clipPath id={`${uid}-headClip`}>
            <rect
              x={SPRAY_ACTUATOR.x}
              y={SPRAY_ACTUATOR.y}
              width={SPRAY_ACTUATOR.width}
              height={SPRAY_ACTUATOR.height}
              rx={SPRAY_ACTUATOR.rx}
            />
            <rect
              x={SPRAY_NOZZLE.x}
              y={SPRAY_NOZZLE.y}
              width={SPRAY_NOZZLE.width}
              height={SPRAY_NOZZLE.height}
              rx={SPRAY_NOZZLE.rx}
            />
            <rect
              x={SPRAY_COLLAR.x}
              y={SPRAY_COLLAR.y}
              width={SPRAY_COLLAR.width}
              height={SPRAY_COLLAR.height}
            />
          </clipPath>
          {/* Dasselbe Klarglas wie bei Vial, Ampulle, Nasenspray und
              Tropfflasche — Stop fuer Stop, nicht nur aehnlich. */}
          <linearGradient id={`${uid}-glassDepth`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(2,6,23,0.62)" />
            <stop offset="9%" stopColor="rgba(226,232,240,0.11)" />
            <stop offset="32%" stopColor="rgba(255,255,255,0.02)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0)" />
            <stop offset="72%" stopColor="rgba(15,23,42,0.11)" />
            <stop offset="100%" stopColor="rgba(2,6,23,0.72)" />
          </linearGradient>
          <radialGradient id={`${uid}-glassBloom`} gradientUnits="userSpaceOnUse" cx="60" cy="215" r="72">
            <stop offset="0%" stopColor="rgba(255,255,255,0.13)" />
            <stop offset="48%" stopColor="rgba(255,255,255,0.03)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <linearGradient id={`${uid}-glassSweep`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.55)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          {/* Weisses Polypropylen: matt, weiche Kante, kein Metallglanz —
              dasselbe Material wie am Nasenspraykopf, und dasselbe, aus dem
              ein Mundspraykopf in Wirklichkeit ist.
              Vorher trug der Kopf die EINTRAGSFARBE. Das machte aus einem
              Pumpkopf ein gefaerbtes Bauteil, das es so nicht gibt: die Farbe
              gehoert dem Inhalt (Fluessigkeit und Etikettband), nicht der
              Mechanik darueber. */}
          <linearGradient id={`${uid}-pp`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#9aa6b4" />
            <stop offset="16%" stopColor="#f4f7fb" />
            <stop offset="52%" stopColor="#e2e8f0" />
            <stop offset="86%" stopColor="#c2cbd7" />
            <stop offset="100%" stopColor="#8d99a8" />
          </linearGradient>
          {/* Licht und Schatten auf dem Zylinder, jetzt auf hellem Material —
              deshalb flacher als zuvor: die alten Werte waren fuer eine
              gesaettigte Eintragsfarbe gerechnet und machten aus Weiss Grau. */}
          <linearGradient id={`${uid}-headShade`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(0,0,0,0.30)" />
            <stop offset="9%" stopColor="rgba(0,0,0,0.10)" />
            <stop offset="26%" stopColor="rgba(255,255,255,0.30)" />
            <stop offset="48%" stopColor="rgba(255,255,255,0.06)" />
            <stop offset="74%" stopColor="rgba(0,0,0,0.08)" />
            <stop offset="93%" stopColor="rgba(0,0,0,0.20)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.32)" />
          </linearGradient>
          <linearGradient id={`${uid}-headLight`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.5)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          <linearGradient id={`${uid}-tube`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(15,23,42,0.34)" />
            <stop offset="34%" stopColor="rgba(255,255,255,0.42)" />
            <stop offset="70%" stopColor="rgba(226,232,240,0.14)" />
            <stop offset="100%" stopColor="rgba(15,23,42,0.36)" />
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
          data-spray-detail="stage-shadow"
          cx={60 - visualLightOffset * SPRAY_GROUND_SHIFT}
          cy="294"
          rx={22 + visualFocus * 8}
          ry="4.5"
          fill={`url(#${uid}-stageShadow)`}
          opacity={0.2 + visualFocus * 0.28}
        />

        <use
          ref={outlineRef}
          data-spray-detail="outer-contour"
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
            data-spray-detail="bloom"
            x="-40"
            y="110"
            width="200"
            height="200"
            fill={`url(#${uid}-glassBloom)`}
            opacity={0.2 + visualFocus * 0.42}
            transform={`translate(${(visualLightOffset * SPRAY_BLOOM_SHIFT).toFixed(2)} 0)`}
          />
          <rect
            ref={sweepRef}
            data-spray-detail="glass-sweep"
            x="46"
            y="120"
            width="26"
            height="176"
            fill={`url(#${uid}-glassSweep)`}
            opacity={0.14 + visualFocus * 0.34}
            transform={`translate(${(visualLightOffset * SPRAY_SHEEN_SHIFT).toFixed(2)} 0)`}
          />
        </g>

        {/* Die Fluessigkeit wird von der INNEN-Kontur beschnitten, nie von der
            aeusseren: sonst fehlt der Glasboden und sie klebt an der Aussenwand. */}
      </svg>

      {/* Flüssigkeit als Zeichenfläche (LiquidCanvas) zwischen Glas hinten und Glas vorn:
          ihre Bewegung malt nur sie neu, nicht das Glas samt Filtern (iPhone 07.11.2026) */}
      <LiquidCanvas
        fill={fillPct == null ? SPRAY_FILL : SPRAY_FILL * clamp01(fillPct / 100)}
        chamberAspect={SPRAY_CHAMBER.aspect}
        x={SPRAY_CHAMBER.x}
        y={SPRAY_CHAMBER.y}
        width={SPRAY_CHAMBER.width}
        height={SPRAY_CHAMBER.height}
        color={color}
        bubbles={size === 'large'}
        reducedMotion={reducedMotion}
        seedFocus={visualFocus}
        seedLightOffset={visualLightOffset}
        handleRef={liquidRef}
        viewBox={SPRAY_VIEWBOX}
        fit="meet"
        clipPath={SPRAY_INNER_PATH}
        detail={SPRAY_LIQUID_DETAIL}
      />

      <svg
        data-spray-detail="glass-front"
        className="absolute inset-0 h-full w-full overflow-visible"
        viewBox="23 72 74 220"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >

        {/* Das Steigrohr steht IM Glas, also nach der Fluessigkeit gezeichnet
            und auf denselben Innenraum beschnitten: es ragt durch den Pegel
            hindurch, statt davor zu schweben. */}
        <g data-spray-detail="dip-tube" clipPath={`url(#${uid}-innerClip)`}>
          <rect
            x={SPRAY_DIP_TUBE.x}
            y={SPRAY_DIP_TUBE.top}
            width={SPRAY_DIP_TUBE.width}
            height={SPRAY_DIP_TUBE.bottom - SPRAY_DIP_TUBE.top}
            fill={`url(#${uid}-tube)`}
          />
        </g>

        {/* Die Wandstaerke. Non-scaling, damit sie die Karussellbreite ueberlebt. */}
        <use
          data-spray-detail="inner-contour"
          href={`#${uid}-inner`}
          fill="none"
          stroke="rgba(226,232,240,0.34)"
          strokeWidth="0.9"
          vectorEffect="non-scaling-stroke"
        />

        {/* Kantenlichter am Glas, auf den Koerper beschnitten. */}
        <g data-spray-detail="edge-lights" clipPath={`url(#${uid}-outerClip)`}>
          <path
            d="M33.5 166 L33.5 274 C 33.5 283, 37 288, 43 290"
            fill="none"
            stroke="rgba(255,255,255,0.52)"
            strokeOpacity={Math.max(0.08, Math.min(1, 0.6 - visualLightOffset * 0.6))}
            strokeWidth="3.8"
            strokeLinecap="round"
            filter={`url(#${uid}-soft)`}
          />
          <path
            d="M86.5 176 L86.5 274 C 86.5 281, 83 286, 78 288"
            fill="none"
            stroke="rgba(255,255,255,0.5)"
            strokeOpacity={Math.max(0.08, Math.min(1, 0.5 + visualLightOffset * 0.6))}
            strokeWidth="2.2"
            strokeLinecap="round"
            filter={`url(#${uid}-soft)`}
          />
        </g>

        {/* Der Kopf liegt ueber dem Glas: sein unterer Rand deckt die Naht am
            Flaschenhals ab. Duese zuerst, damit der Druckkopf ihre Wurzel
            verdeckt und sie angesetzt wirkt statt angeklebt. */}
        <g data-spray-detail="head">
          <rect
            data-spray-detail="nozzle"
            x={SPRAY_NOZZLE.x}
            y={SPRAY_NOZZLE.y}
            width={SPRAY_NOZZLE.width}
            height={SPRAY_NOZZLE.height}
            rx={SPRAY_NOZZLE.rx}
            fill={`url(#${uid}-pp)`}
          />
          <rect
            data-spray-detail="collar"
            x={SPRAY_COLLAR.x}
            y={SPRAY_COLLAR.y}
            width={SPRAY_COLLAR.width}
            height={SPRAY_COLLAR.height}
            fill={`url(#${uid}-pp)`}
          />
          <rect
            data-spray-detail="actuator"
            x={SPRAY_ACTUATOR.x}
            y={SPRAY_ACTUATOR.y}
            width={SPRAY_ACTUATOR.width}
            height={SPRAY_ACTUATOR.height}
            rx={SPRAY_ACTUATOR.rx}
            fill={`url(#${uid}-pp)`}
          />

          {/* Licht und Schatten liegen als eigene Ebene ueber allen drei
              Teilen, damit der Kopf aus einem Guss wirkt und nicht aus drei
              verschieden hellen Stuecken. */}
          <g clipPath={`url(#${uid}-headClip)`}>
            <rect x="23" y="72" width="74" height="46" fill={`url(#${uid}-headShade)`} />
            <g data-spray-detail="collar-ribs" fill="none">
              {SPRAY_COLLAR_RIB_XS.map(x => (
                <path
                  key={x}
                  d={`M${x} ${SPRAY_COLLAR_RIB_YS.top} L${x} ${SPRAY_COLLAR_RIB_YS.bottom}`}
                  stroke="rgba(0,0,0,0.26)"
                  strokeWidth="0.9"
                />
              ))}
            </g>
            <path
              data-spray-detail="actuator-ridge"
              d={SPRAY_ACTUATOR_RIDGE_PATH}
              fill="none"
              stroke="rgba(255,255,255,0.24)"
              strokeWidth="1.2"
            />
            <path
              data-spray-detail="collar-groove"
              d={SPRAY_COLLAR_GROOVE_PATH}
              fill="none"
              stroke="rgba(0,0,0,0.4)"
              strokeWidth="1.4"
            />
            <rect
              ref={headLightRef}
              data-spray-detail="head-light"
              x="42"
              y="72"
              width="16"
              height="46"
              fill={`url(#${uid}-headLight)`}
              opacity={0.16 + visualFocus * 0.22}
              transform={`translate(${(visualLightOffset * SPRAY_HEAD_LIGHT_SHIFT).toFixed(2)} 0)`}
            />
          </g>

          {/* Die Spruehoeffnung. Ohne sie ist die Duese ein Stummel. */}
          <circle
            data-spray-detail="nozzle-mouth"
            cx={SPRAY_NOZZLE_MOUTH.cx}
            cy={SPRAY_NOZZLE_MOUTH.cy}
            r={SPRAY_NOZZLE_MOUTH.r}
            fill="rgba(0,0,0,0.55)"
          />
        </g>
      </svg>

      {showLabel && (
        <StageLabel
          name={labelName}
          detail={detail}
          className="rounded-sm"
          nameClassName={nameClass}
          detailClassName={detailClass}
          wrapperProps={{
            'data-spray-detail': 'label',
            style: {
              top: `${(SPRAY_LABEL_TOP_PCT * 100).toFixed(1)}%`,
              height: `${(SPRAY_LABEL_HEIGHT_PCT * 100).toFixed(1)}%`,
              left: `${(SPRAY_LABEL_INSET_PCT * 100).toFixed(2)}%`,
              right: `${(SPRAY_LABEL_INSET_PCT * 100).toFixed(2)}%`,
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
