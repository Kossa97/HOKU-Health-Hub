import { useTranslation } from 'react-i18next'
import { RANGE_CHIPS, type RangeChipKey } from '../lib/verlaufRange'

/** 36 px sichtbar, per ::after auf 44 px Tippfläche erweitert (Apple-Mindestmaß). */
const CHIPS_HEIGHT = 36
const HINT_HEIGHT = 16

const CHIP_CSS = `
  .fortschritt-range-chip { position: relative; }
  .fortschritt-range-chip::after { content: ''; position: absolute; inset: -4px 0; }
`
const BAR_PADDING_BOTTOM = 6

/** Gesamthöhe unterhalb der Safe-Area (Chips + Hinweis + Padding). */
export const RANGE_BAR_CONTENT_HEIGHT = CHIPS_HEIGHT + 6 + HINT_HEIGHT + BAR_PADDING_BOTTOM

interface Props {
  value: RangeChipKey
  onChange: (chip: RangeChipKey) => void
}

export function StickyRangeBar({ value, onChange }: Props) {
  const { t } = useTranslation()
  return (
    <>
      <style>{CHIP_CSS}</style>
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        paddingTop: 'env(safe-area-inset-top)',
        paddingLeft: 12,
        paddingRight: 12,
        paddingBottom: BAR_PADDING_BOTTOM,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div>
          <div style={{
            display: 'flex',
            gap: 4,
            height: CHIPS_HEIGHT,
            alignItems: 'stretch',
          }}>
            {RANGE_CHIPS.map(chip => {
              const on = value === chip.key
              return (
                <button
                  key={chip.key}
                  type="button"
                  className="fortschritt-range-chip"
                  aria-pressed={on}
                  onClick={() => onChange(chip.key)}
                  style={{
                    flex: 1,
                    padding: 0,
                    borderRadius: 8,
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    cursor: 'pointer',
                    background: on ? 'var(--accent-weak)' : 'transparent',
                    color: on ? 'var(--accent)' : 'var(--text-muted)',
                    border: on ? '1px solid var(--accent-border)' : '1px solid var(--border)',
                  }}
                >
                  {t(`fortschritt_range_${chip.key}`)}
                </button>
              )
            })}
          </div>
          <p style={{
            margin: '6px 0 0',
            fontSize: '0.68rem',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textAlign: 'center',
            lineHeight: 1.3,
          }}>
            {t('fortschritt_range_hint')}
          </p>
        </div>
      </div>
      <div
        aria-hidden
        style={{ height: `calc(${RANGE_BAR_CONTENT_HEIGHT}px + env(safe-area-inset-top))` }}
      />
    </>
  )
}
