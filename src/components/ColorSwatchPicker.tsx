import { useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { ColorField } from './ColorField'
import { SWATCH_COLORS } from '../features/my-stack/lib/colors'


const gleich = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * Farbwahl wie in den Apple-Apps: eine Reihe runder Felder, das gewaehlte mit
 * Ring, und am Ende „Eigene Farbe" — sie klappt die freie Farbflaeche auf.
 * Ein Tipp genuegt fuer den Normalfall; wer eine bestimmte Farbe will,
 * bekommt trotzdem die ganze Flaeche.
 */
export function ColorSwatchPicker({ value, onChange }: {
  value: string
  onChange: (hex: string) => void
}) {
  const { t } = useTranslation()
  const istVorgabe = SWATCH_COLORS.some(farbe => gleich(farbe.hex, value))
  const [eigeneOffen, setEigeneOffen] = useState(() => Boolean(value) && !istVorgabe)

  return (
    <div data-color-swatches>
      <div
        role="radiogroup"
        aria-label={String(t('my_stack_color_optional', { defaultValue: 'Farbe (optional)' }))}
        className="grid grid-cols-7 justify-items-center gap-y-3"
      >
        {SWATCH_COLORS.map(farbe => {
          const gewaehlt = gleich(farbe.hex, value) && !eigeneOffen
          return (
            <button
              key={farbe.hex}
              type="button"
              role="radio"
              aria-checked={gewaehlt}
              aria-label={String(t(`color_${farbe.name}`, { defaultValue: farbe.name }))}
              data-swatch={farbe.hex}
              onClick={() => {
                setEigeneOffen(false)
                onChange(farbe.hex)
              }}
              className="stack-swatch"
              style={{ '--swatch': farbe.hex } as CSSProperties}
            >
              <span aria-hidden="true" className="stack-swatch-dot" data-checked={gewaehlt || undefined} />
            </button>
          )
        })}
        <button
          type="button"
          role="radio"
          aria-checked={eigeneOffen}
          aria-label={String(t('my_stack_color_custom', { defaultValue: 'Eigene Farbe' }))}
          data-swatch="custom"
          onClick={() => setEigeneOffen(offen => !offen)}
          className="stack-swatch"
          style={{ '--swatch': eigeneOffen || !istVorgabe ? (value || '#8e8e93') : '#8e8e93' } as CSSProperties}
        >
          <span aria-hidden="true" className="stack-swatch-dot stack-swatch-custom" data-checked={eigeneOffen || undefined}>
            <span className="stack-swatch-custom-core" />
          </span>
        </button>
      </div>
      {eigeneOffen && (
        <div data-color-custom className="stack-color-custom mt-4">
          <ColorField value={value} onChange={onChange} />
        </div>
      )}
    </div>
  )
}
