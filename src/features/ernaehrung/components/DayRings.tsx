import type { Ring } from '../lib/dayRings'
import { MACRO_COLORS } from '../styles'

/**
 * Ringe eines Tages, ineinander wie bei Apple Fitness: außen Kalorien, innen
 * Eiweiß, Kohlenhydrate, Fett. Die Spur bleibt sichtbar, auch an leeren Tagen,
 * damit das Raster ruhig wirkt. Rein grafisch — die Werte stehen im
 * aria-label des Knopfes drumherum.
 */
export function DayRings({ rings, size, dim = false }: { rings: Ring[]; size: number; dim?: boolean }) {
  // Mit drei Ringen (Kalorien ausgeblendet) etwas dicker, damit es gleich voll wirkt.
  const stroke = rings.length > 3 ? 3.2 : 4
  const gap = 1.2
  const c = 20
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} aria-hidden="true" className="-rotate-90"
      style={{ opacity: dim ? 0.35 : 1 }}>
      {rings.map((ring, i) => {
        const r = c - stroke / 2 - i * (stroke + gap)
        const len = 2 * Math.PI * r
        return (
          <g key={ring.key}>
            <circle cx={c} cy={c} r={r} fill="none" strokeWidth={stroke} stroke={MACRO_COLORS[ring.key]} strokeOpacity={0.14} />
            {ring.fraction > 0 && (
              <circle cx={c} cy={c} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round" stroke={MACRO_COLORS[ring.key]}
                strokeDasharray={len} strokeDashoffset={len * (1 - ring.fraction)} />
            )}
          </g>
        )
      })}
    </svg>
  )
}
