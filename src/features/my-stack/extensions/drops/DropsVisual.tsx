import { useCallback, useId, useRef } from 'react'
import type { Ref } from 'react'
import { LiquidCanvas, type LiquidGraphicHandle } from '../../stage/LiquidCanvas'
import { StageLabel } from '../../stage/StageLabel'
import { usePrefersReducedMotion } from '../../stage/usePrefersReducedMotion'
import { useStageLight, type StageLightHandle } from '../../stage/useStageLight'
import {
  DROPS_CAP,
  DROPS_CAP_RIB_XS,
  DROPS_CAP_DOME,
  DROPS_CAP_PATH,
  DROPS_CAP_TOP_BAND,
  DROPS_TEAT,
  DROPS_TEAT_PATH,
  DROPS_CAP_RIB_YS,
  DROPS_FILL,
  DROPS_GROUND_SHIFT,
  DROPS_INNER_PATH,
  DROPS_LABEL,
  DROPS_OUTER_PATH,
  DROPS_PIPETTE_PATH,
  DROPS_SHEEN_SHIFT,
  DROPS_SPEC,
} from './dropsShape'

/** viewBox des Glases, fest: die Zeichenfläche zeichnet nur bei neuen Werten neu */
const DROPS_VIEWBOX = [14, 16, 72, 272] as const
const DROPS_LIQUID_DETAIL = { 'data-drops-detail': 'liquid-canvas' }

export interface DropsVisualProps {
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
function dropsAmountLabel(amount?: string | number | null, unit?: string | null): string | null {
  if (amount === null || amount === undefined || amount === '') return null
  return unit ? `${amount} ${unit}` : String(amount)
}

// Die Tropfflasche nimmt dieselbe Sprosse wie die Ampulle: 146,7 -> 186,4.
// Die Breite folgt dem eigenen Verhaeltnis 72/272 = 0,265 — fast genau das
// der Ampulle, weshalb beide nebeneinander wie eine Familie wirken.
const SIZE_CLASS: Record<NonNullable<DropsVisualProps['size']>, string> = {
  large: 'h-[365px] w-[96.6px]',
  carousel: 'h-[146.7px] w-[38.8px] sm:h-[186.4px] sm:w-[49.3px]',
  compact: 'h-[110px] w-[29.1px]',
  mini: 'h-[60px] w-[15.9px]',
}

// Weiss, fett, mit Schattenkante — wie bei Vial, Ampulle und Nasenspray. Die
// Schattenkante traegt den Kontrast, wenn helle Fluessigkeit dahinter steht.
const NAME_SHARED = 'leading-tight font-black text-white tracking-normal drop-shadow-[0_1px_2px_rgba(0,0,0,0.55)]'
const DETAIL_SHARED = 'mt-0.5 font-bold uppercase tracking-wide text-white/90 drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)]'

const NAME_CLASS: Record<NonNullable<DropsVisualProps['size']>, string> = {
  large: `text-[13px] ${NAME_SHARED}`,
  carousel: `text-[7px] sm:text-[8.5px] ${NAME_SHARED}`,
  compact: `text-[5.5px] ${NAME_SHARED}`,
  mini: `text-[3px] ${NAME_SHARED}`,
}

const DETAIL_CLASS: Record<NonNullable<DropsVisualProps['size']>, string> = {
  large: `text-[10px] sm:text-xs ${DETAIL_SHARED}`,
  carousel: `text-[5px] sm:text-[6px] ${DETAIL_SHARED}`,
  compact: `text-[4px] ${DETAIL_SHARED}`,
  mini: `text-[2.5px] ${DETAIL_SHARED}`,
}

export function DropsVisual({
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
}: DropsVisualProps) {
  const uid = useId()
  const reducedMotion = usePrefersReducedMotion()
  const visualFocus = focus === undefined ? (isActive ? 1 : 0.28) : clamp01(focus)
  const visualLightOffset = clampOffset(lightOffset)
  const labelName = name?.trim() || 'Tropfen'
  const detail = dropsAmountLabel(amount, unit)
  const chamber = DROPS_SPEC.chamber!

  const rootRef = useRef<HTMLDivElement | null>(null)
  const shadowRef = useRef<SVGEllipseElement | null>(null)
  const sweepRef = useRef<SVGRectElement | null>(null)
  const bloomRef = useRef<SVGRectElement | null>(null)
  const bulbLightRef = useRef<SVGEllipseElement | null>(null)
  const teatLightRef = useRef<SVGEllipseElement | null>(null)
  const outlineRef = useRef<SVGUseElement | null>(null)
  const liquidRef = useRef<LiquidGraphicHandle | null>(null)
  const labelSheenRef = useRef<HTMLDivElement | null>(null)

  const applyStageLight = useCallback((f: number, o: number) => {
    rootRef.current?.setAttribute('data-drops-focus', f.toFixed(2))
    rootRef.current?.setAttribute('data-drops-light-offset', o.toFixed(2))
    shadowRef.current?.setAttribute('cx', (50 - o * DROPS_GROUND_SHIFT).toFixed(2))
    shadowRef.current?.setAttribute('rx', (26 + f * 7).toFixed(2))
    shadowRef.current?.setAttribute('opacity', (0.2 + f * 0.28).toFixed(3))
    sweepRef.current?.setAttribute('transform', `translate(${(o * DROPS_SHEEN_SHIFT).toFixed(2)} 0)`)
    sweepRef.current?.setAttribute('opacity', (0.1 + f * 0.26).toFixed(3))
    bloomRef.current?.setAttribute('transform', `translate(${(o * 9).toFixed(2)} 0)`)
    bloomRef.current?.setAttribute('opacity', (0.2 + f * 0.42).toFixed(3))
    bulbLightRef.current?.setAttribute('cx', (39 + o * 4).toFixed(2))
    bulbLightRef.current?.setAttribute('opacity', (0.16 + f * 0.26).toFixed(3))
    teatLightRef.current?.setAttribute('cx', (DROPS_CAP_DOME.cx - 5 + o * 2.8).toFixed(2))
    teatLightRef.current?.setAttribute('opacity', (0.16 + f * 0.26).toFixed(3))
    outlineRef.current?.setAttribute('stroke-opacity', (0.36 + f * 0.28).toFixed(3))
    liquidRef.current?.applyStageLight?.(f, o)
    if (labelSheenRef.current) {
      labelSheenRef.current.style.transform = `translateX(${(o * 12).toFixed(2)}%)`
      labelSheenRef.current.style.opacity = (0.6 + f * 0.22).toFixed(3)
    }
  }, [])

  useStageLight(applyStageLight, { focus: visualFocus, lightOffset: visualLightOffset }, stageLightRef)

  return (
    <div
      ref={rootRef}
      data-drops-detail="root"
      className={`relative mx-auto select-none ${SIZE_CLASS[size]} ${className}`}
      data-drops-focus={Number(visualFocus.toFixed(2))}
      data-drops-light-offset={Number(visualLightOffset.toFixed(2))}
      aria-label={labelName}
    >
      <svg
        className="absolute inset-0 h-full w-full overflow-visible"
        viewBox="14 16 72 272"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        <defs>
          <path id={`${uid}-outer`} d={DROPS_OUTER_PATH} />
          <path id={`${uid}-inner`} d={DROPS_INNER_PATH} />
          <clipPath id={`${uid}-outerClip`}>
            <use href={`#${uid}-outer`} />
          </clipPath>
          <clipPath id={`${uid}-innerClip`}>
            <use href={`#${uid}-inner`} />
          </clipPath>
          <clipPath id={`${uid}-capClip`}>
            <path d={DROPS_CAP_PATH} />
          </clipPath>
          <clipPath id={`${uid}-teatClip`}>
            <path d={DROPS_TEAT_PATH} />
          </clipPath>

          {/* Klarglas, dieselben Werte wie bei Vial, Ampulle und Nasenspray:
              nur die Raender tragen die Glasdicke, die Mitte bleibt leer.
              Deshalb ist die Pipette dahinter zu sehen und die Fluessigkeit
              zeigt ihre echte Farbe, statt vom Braun gedaempft zu werden. */}
          <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(2,6,23,0.62)" />
            <stop offset="9%" stopColor="rgba(226,232,240,0.11)" />
            <stop offset="32%" stopColor="rgba(255,255,255,0.02)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0)" />
            <stop offset="72%" stopColor="rgba(15,23,42,0.11)" />
            <stop offset="100%" stopColor="rgba(2,6,23,0.72)" />
          </linearGradient>
          {/* Der weiche Schein im Bauch der Flasche. */}
          <radialGradient id={`${uid}-glassBloom`} gradientUnits="userSpaceOnUse" cx="50" cy="212" r="74">
            <stop offset="0%" stopColor="rgba(255,255,255,0.13)" />
            <stop offset="48%" stopColor="rgba(255,255,255,0.03)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </radialGradient>
          <linearGradient id={`${uid}-sweep`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(255,255,255,0)" />
            <stop offset="50%" stopColor="rgba(255,255,255,0.55)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          {/* Zwei Materialien, wie in der Vorlage. Der Sauger ist mattes
              Gummi: dunkler, mit einem breiten weichen Glanz statt einer
              scharfen Kante. Die Kappe ist glatterer Kunststoff: heller, mit
              einem schmaleren, helleren Glanzstreifen. Beide sind Zylinder,
              deshalb links und rechts abfallend. */}
          {/* Ein Kopf, eine Farbe — beide Teile tragen die Eintragsfarbe.
              Unterschieden werden sie ueber das Material: der Sauger ist
              mattes Gummi und liegt deshalb durchgehend dunkler, mit einem
              breiten weichen Glanz statt einer scharfen Kante. */}
          <linearGradient id={`${uid}-teatShade`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(0,0,0,0.7)" />
            <stop offset="22%" stopColor="rgba(0,0,0,0.2)" />
            <stop offset="46%" stopColor="rgba(0,0,0,0.34)" />
            <stop offset="74%" stopColor="rgba(0,0,0,0.46)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.72)" />
          </linearGradient>
          {/* Die Kuppe faengt oben zusaetzlich Licht — Gummi ist nie ganz
              matt, aber der Uebergang bleibt weich. */}
          <linearGradient id={`${uid}-teatCrown`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
            <stop offset="55%" stopColor="rgba(255,255,255,0.05)" />
            <stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </linearGradient>
          {/* Die Kappe traegt die Eintragsfarbe, der Sauger nicht: sie ist
              die groessere, glattere Flaeche und haelt die Farbe sauber,
              waehrend mattes Gummi sie stumpf machen wuerde. Der Verlauf
              legt darueber nur Licht und Schatten, damit aus der flachen
              Farbe ein Zylinder wird. */}
          <linearGradient id={`${uid}-capShade`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(0,0,0,0.58)" />
            <stop offset="18%" stopColor="rgba(255,255,255,0.32)" />
            <stop offset="46%" stopColor="rgba(255,255,255,0.04)" />
            <stop offset="74%" stopColor="rgba(0,0,0,0.12)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0.62)" />
          </linearGradient>
          {/* Die Oberseite zeigt vom Licht weg. */}
          <linearGradient id={`${uid}-capTop`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(0,0,0,0.42)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </linearGradient>
          <linearGradient id={`${uid}-collar`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#20242b" />
            <stop offset="22%" stopColor="#5b626d" />
            <stop offset="54%" stopColor="#383d45" />
            <stop offset="82%" stopColor="#4d535d" />
            <stop offset="100%" stopColor="#1b1f25" />
          </linearGradient>
          <radialGradient id={`${uid}-groundShadow`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(0,0,0,0.7)" />
            <stop offset="62%" stopColor="rgba(0,0,0,0.4)" />
            <stop offset="100%" stopColor="rgba(0,0,0,0)" />
          </radialGradient>
        </defs>

        <ellipse
          ref={shadowRef}
          data-drops-detail="ground-shadow"
          cx={50 - visualLightOffset * DROPS_GROUND_SHIFT}
          cy="292"
          rx={26 + visualFocus * 7}
          ry="4.5"
          fill={`url(#${uid}-groundShadow)`}
          opacity={0.2 + visualFocus * 0.28}
        />

        <use data-drops-detail="glass" href={`#${uid}-outer`} fill={`url(#${uid}-glass)`} />

        {/* Schein und Glanzband liegen im Glas, hinter der Fluessigkeit —
            beide auf den Umriss beschnitten, sonst malen sie neben die
            Flasche. Dieselbe Reihenfolge wie bei Ampulle und Nasenspray. */}
        <g clipPath={`url(#${uid}-outerClip)`}>
          <rect
            ref={bloomRef}
            data-drops-detail="bloom"
            x="-40"
            y="100"
            width="200"
            height="200"
            fill={`url(#${uid}-glassBloom)`}
            opacity={0.2 + visualFocus * 0.42}
            transform={`translate(${(visualLightOffset * 9).toFixed(2)} 0)`}
          />
          <rect
            ref={sweepRef}
            data-drops-detail="sweep"
            x="22"
            y="112"
            width="15"
            height="180"
            fill={`url(#${uid}-sweep)`}
            opacity={0.1 + visualFocus * 0.26}
            transform={`translate(${(visualLightOffset * DROPS_SHEEN_SHIFT).toFixed(2)} 0)`}
          />
        </g>

        {/* Die Fluessigkeit wird von der INNEN-Kontur beschnitten, nie von der
            aeusseren: sonst fehlt der Glasboden und sie klebt an der Aussenwand. */}
      </svg>

      {/* Flüssigkeit als Zeichenfläche (LiquidCanvas) zwischen Glas hinten und Glas vorn:
          ihre Bewegung malt nur sie neu, nicht das Glas samt Filtern (iPhone 07.11.2026) */}
      <LiquidCanvas
        fill={fillPct == null ? DROPS_FILL : DROPS_FILL * clamp01(fillPct / 100)}
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
        viewBox={DROPS_VIEWBOX}
        fit="meet"
        clipPath={DROPS_INNER_PATH}
        detail={DROPS_LIQUID_DETAIL}
      />

      <svg
        data-drops-detail="glass-front"
        className="absolute inset-0 h-full w-full overflow-visible"
        viewBox="14 16 72 272"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >

        {/* Die Wandstaerke. Ohne Hals ist die Oberkante echte Schulter und
            wird mitgezeichnet — der offene Pfad von vorher war nur noetig,
            solange die Kontur in einem schmalen Hals endete. Non-scaling,
            damit sie die Karussellbreite ueberlebt. */}
        <use
          data-drops-detail="inner-contour"
          href={`#${uid}-inner`}
          fill="none"
          stroke="rgba(226,232,240,0.34)"
          strokeWidth="0.9"
          vectorEffect="non-scaling-stroke"
        />

        {/* Sauger, Kappe und Pipette sind ein Teil und stehen deshalb in
            einer Gruppe: beim Aufschrauben kaeme die Pipette mit heraus. Die
            Reihenfolge ist die, in der sie uebereinander liegen — Pipette,
            dann Sauger, dann Kappe. Die Kappe deckt oben beides ab: das Ende
            der Pipette und den Kragen des Saugers. Die Gruppe steht hinter
            der Wandstaerke, weil die vordere Glaswand vor der Pipette liegt. */}
        <g data-drops-detail="dropper">
          {/* Die Pipette ist selbst leer: was dahinter liegt, scheint durch.
              Eine gefuellte waere eine Aussage ueber eine Menge, die die App
              nicht kennt. */}
          <path
            data-drops-detail="pipette"
            d={DROPS_PIPETTE_PATH}
            fill="rgba(226,232,240,0.18)"
            stroke="rgba(100,116,139,0.55)"
            strokeWidth="0.9"
            vectorEffect="non-scaling-stroke"
          />

          <g data-drops-detail="teat">
            <path data-drops-detail="teat-fill" d={DROPS_TEAT_PATH} fill={color} />
            <path d={DROPS_TEAT_PATH} fill={`url(#${uid}-teatShade)`} />
            <path d={DROPS_TEAT_PATH} fill={`url(#${uid}-teatCrown)`} />
            {/* Der weiche Laengsglanz auf dem Gummi. Er wandert mit dem
                Licht und liegt im Umriss, sonst malt er daneben. */}
            <g clipPath={`url(#${uid}-teatClip)`}>
              <ellipse
                ref={teatLightRef}
                data-drops-detail="dome-light"
                cx={DROPS_CAP_DOME.cx - 5 + visualLightOffset * 2.8}
                cy={DROPS_TEAT.widest + 12}
                rx="3.6"
                ry="17"
                fill="rgba(255,255,255,0.4)"
                opacity={0.16 + visualFocus * 0.26}
              />
            </g>
            <path
              d={DROPS_TEAT_PATH}
              fill="none"
              stroke="rgba(0,0,0,0.4)"
              strokeWidth="0.8"
              vectorEffect="non-scaling-stroke"
            />
          </g>

          {/* Die Kappe. Der Sauger sitzt ihr auf, also deckt ihr Rand seinen
              Kragen ab und es entsteht die Naht, die die Vorlage zeigt. */}
          <path data-drops-detail="cap" d={DROPS_CAP_PATH} fill={color} />
          <path d={DROPS_CAP_PATH} fill={`url(#${uid}-capShade)`} />
          <g clipPath={`url(#${uid}-capClip)`}>
            {/* Die flache Oberseite rund um den Sauger. */}
            <rect
              data-drops-detail="cap-top"
              x={DROPS_CAP.x}
              y={DROPS_CAP.y}
              width={DROPS_CAP.width}
              height={DROPS_CAP_TOP_BAND}
              fill={`url(#${uid}-capTop)`}
            />
            {/* Geriffelt ist nur der Mantel. Jede Rille ist eine dunkle
                Kerbe mit einer hellen Kante rechts daneben — das ist es,
                was sie als Rille statt als Strich lesbar macht. */}
            <g data-drops-detail="cap-ribs" fill="none" strokeWidth="0.7">
              {DROPS_CAP_RIB_XS.map(x => (
                <g key={x}>
                  <path
                    d={`M${x} ${DROPS_CAP_RIB_YS.top} L${x} ${DROPS_CAP_RIB_YS.bottom}`}
                    stroke="rgba(0,0,0,0.3)"
                  />
                  <path
                    d={`M${x + 0.9} ${DROPS_CAP_RIB_YS.top} L${x + 0.9} ${DROPS_CAP_RIB_YS.bottom}`}
                    stroke="rgba(255,255,255,0.12)"
                    strokeWidth="0.5"
                  />
                </g>
              ))}
            </g>
            <ellipse
              ref={bulbLightRef}
              data-drops-detail="cap-light"
              cx={39 + visualLightOffset * 4}
              cy={DROPS_CAP.y + DROPS_CAP.height / 2}
              rx="4.5"
              ry="9"
              fill="rgba(255,255,255,0.34)"
              opacity={0.16 + visualFocus * 0.26}
            />
          </g>
          <path
            d={DROPS_CAP_PATH}
            fill="none"
            stroke="rgba(0,0,0,0.35)"
            strokeWidth="0.9"
            vectorEffect="non-scaling-stroke"
          />
        </g>

        <use
          ref={outlineRef}
          data-drops-detail="outer-contour"
          href={`#${uid}-outer`}
          fill="none"
          stroke="rgba(203,213,225,0.56)"
          strokeOpacity={0.36 + visualFocus * 0.28}
          strokeWidth="1.4"
          vectorEffect="non-scaling-stroke"
        />
      </svg>

      {showLabel && (
        <StageLabel
          name={labelName}
          detail={detail}
          className="left-0 right-0 rounded-sm"
          nameClassName={NAME_CLASS[size]}
          detailClassName={DETAIL_CLASS[size]}
          wrapperProps={{
            'data-drops-detail': 'label',
            style: {
              top: `${(DROPS_LABEL.topPct * 100).toFixed(1)}%`,
              height: `${(DROPS_LABEL.heightPct * 100).toFixed(1)}%`,
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
