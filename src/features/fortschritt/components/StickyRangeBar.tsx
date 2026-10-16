import { useTranslation } from 'react-i18next'
import { RANGE_CHIPS, type RangeChipKey } from '../lib/verlaufRange'

const CHIPS_HEIGHT = 28
const HINT_HEIGHT = 14
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
                  onClick={() => onChange(chip.key)}
                  style={{
                    flex: 1,
                    padding: 0,
                    borderRadius: 8,
                    fontSize: '0.65rem',
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
            fontSize: '0.5rem',
            fontWeight: 700,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            textAlign: 'center',
            lineHeight: 1.3,
            opacity: 0.75,
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
