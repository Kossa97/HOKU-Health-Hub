import { useTranslation } from 'react-i18next'
import { RANGE_CHIPS, type RangeChipKey } from '../lib/verlaufRange'
import { GlassSegmented } from './GlassSegmented'

/** Höhe der schwebenden Leiste unterhalb der Safe-Area (Polster + Glas-Segment). */
export const RANGE_BAR_CONTENT_HEIGHT = 8 + 44 + 14

interface Props {
  value: RangeChipKey
  onChange: (chip: RangeChipKey) => void
}

/**
 * Zeitraum für die ganze Seite: schwebende Glas-Leiste oben. Der Inhalt läuft
 * beim Scrollen unter dem Glas durch; ein Verlauf ins Schwarz hält den Rand ruhig.
 * Fest positioniert statt sticky, weil die App-Hülle overflow-x: hidden setzt.
 */
export function StickyRangeBar({ value, onChange }: Props) {
  const { t } = useTranslation()
  return (
    <>
      <div className="fg-rangebar">
        <GlassSegmented
          equal
          ariaLabel={t('fortschritt_range_aria')}
          value={value}
          onChange={onChange}
          options={RANGE_CHIPS.map(chip => ({ key: chip.key, label: t(`fortschritt_range_${chip.key}`) }))}
        />
      </div>
      <div aria-hidden style={{ height: `calc(${RANGE_BAR_CONTENT_HEIGHT}px + env(safe-area-inset-top))` }} />
    </>
  )
}
