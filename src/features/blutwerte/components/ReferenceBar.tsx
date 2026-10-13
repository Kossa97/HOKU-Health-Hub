import { useTranslation } from 'react-i18next'
import type { EffectiveRange } from '../lib/bloodwork'
import { referenceBarGeometry } from '../lib/referenceBar'
import { bereichsHerkunft } from '../lib/bereichsHerkunft'
import { formatNumber, formatRange } from '../lib/format'
import { GREEN, MUTED, RED, TEXT } from '../styles'

/** #rrggbb mit Deckkraft als rgba(). */
function hexAlpha(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1, 7), 16)
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`
}

interface Props {
  value: number
  unit: string
  range: EffectiveRange
  inRange: boolean | null
}

export function ReferenceBar({ value, unit, range, inRange }: Props) {
  const { t } = useTranslation()
  const geo = referenceBarGeometry(value, range)
  const referenzText = formatRange(range.min, range.max, unit)
  const herkunft = bereichsHerkunft(range, t)
  const farbe = inRange === false ? RED : GREEN

  if (!geo) {
    // Kein Balken darstellbar (z.B. einseitige Untergrenze wie eGFR "ab 90") —
    // trotzdem den Referenztext zeigen, statt gar keine Information.
    return (
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold" style={{ color: TEXT }}>{t('bw_reference_range')}</p>
        <p className="text-xs" style={{ color: MUTED }}>
          {referenzText}
          {herkunft && <span data-bw-range-source> ({herkunft})</span>}
        </p>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-xs font-semibold" style={{ color: TEXT }}>{t('bw_reference_range')}</p>
        <p className="text-xs" style={{ color: MUTED }}>
          {referenzText}
          {herkunft && <span data-bw-range-source> ({herkunft})</span>}
        </p>
      </div>

      <div className="relative h-2.5 rounded-full" style={{ background: 'var(--border)' }}>
        <div
          className="absolute top-0 bottom-0 rounded-full"
          style={{
            left: `${geo.zoneStartPercent}%`,
            width: `${geo.zoneEndPercent - geo.zoneStartPercent}%`,
            background: 'rgba(16,185,129,0.35)',
          }}
        />
        {/* Der aktuelle Wert leuchtet auf: beim Oeffnen einmal hell, dann ein
            ruhiger Schein in seiner Farbe. Nur transform und opacity bewegen
            sich; bei „Bewegung reduzieren“ bleibt nur der ruhige Schein. */}
        <div
          className="absolute"
          style={{ left: `${geo.valuePercent}%`, top: -3, width: 10, height: 16, marginLeft: -5 }}
          data-bw-value-marker
        >
          <span
            aria-hidden="true"
            className="bw-marker-glow pointer-events-none absolute rounded-full"
            style={{ inset: -9, background: `radial-gradient(closest-side, ${hexAlpha(farbe, 0.55)}, ${hexAlpha(farbe, 0)})` }}
          />
          <span
            className="absolute inset-0 rounded-full"
            style={{
              background: `linear-gradient(180deg, ${hexAlpha('#ffffff', 0.35)} 0%, ${hexAlpha('#ffffff', 0)} 55%), ${farbe}`,
              border: '2px solid var(--surface)',
              boxShadow: `0 0 8px 1px ${hexAlpha(farbe, 0.6)}`,
            }}
          />
        </div>
      </div>
      <style>{`
        @keyframes bw-marker-aufleuchten {
          0% { opacity: 0; transform: scale(0.6) }
          35% { opacity: 1; transform: scale(1.35) }
          100% { opacity: 0.7; transform: scale(1) }
        }
        .bw-marker-glow { opacity: 0.7; animation: bw-marker-aufleuchten 900ms cubic-bezier(0.23, 1, 0.32, 1) 150ms both }
        @media (prefers-reduced-motion: reduce) { .bw-marker-glow { animation: none } }
      `}</style>

      <div className="flex justify-between mt-1.5">
        <span className="text-[0.65rem]" style={{ color: MUTED }}>{formatNumber(geo.scaleMin)}</span>
        <span className="text-[0.65rem]" style={{ color: MUTED }}>{formatNumber(geo.scaleMax)}</span>
      </div>
    </div>
  )
}
