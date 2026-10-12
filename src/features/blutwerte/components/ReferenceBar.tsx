import { useTranslation } from 'react-i18next'
import type { EffectiveRange } from '../lib/bloodwork'
import { referenceBarGeometry } from '../lib/referenceBar'
import { bereichsHerkunft } from '../lib/bereichsHerkunft'
import { formatNumber, formatRange } from '../lib/format'
import { GREEN, MUTED, RED, TEXT } from '../styles'

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
        <div
          className="absolute rounded-full"
          style={{
            left: `${geo.valuePercent}%`,
            top: -3,
            width: 10,
            height: 16,
            marginLeft: -5,
            background: inRange === false ? RED : GREEN,
            border: '2px solid var(--surface)',
          }}
        />
      </div>

      <div className="flex justify-between mt-1.5">
        <span className="text-[0.65rem]" style={{ color: MUTED }}>{formatNumber(geo.scaleMin)}</span>
        <span className="text-[0.65rem]" style={{ color: MUTED }}>{formatNumber(geo.scaleMax)}</span>
      </div>
    </div>
  )
}
