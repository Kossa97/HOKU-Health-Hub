import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ColorSwatchPicker } from '../../../components/ColorSwatchPicker'
import { DOSAGE_FORMS, getDosageForm, isStageRenderable, showsColor } from '../lib/dosageForms'
import type { DosageFormKey } from '../types'
import { DosageFormIcon } from './DosageFormIcon'
import { DosageFormPreview } from './DosageFormPreview'

// Die Form ohne Farbe: neutral, damit die gewaehlte Karte heraussticht.
const NEUTRAL = '#5b6068'

/**
 * Form und Farbe auf der Substanzseite. Unter dem Treffer erscheint ein
 * kleines Karussell mit den Formen, die der Katalog fuer diese Substanz kennt
 * — „Andere Form" haengt die uebrigen an. Ist eine Form gewaehlt, erscheint
 * darunter die Farbe; die Karte im Karussell faerbt sich mit.
 * Frueher waren Form und Farbe je ein eigener Schritt mit zwei grossen
 * Karussells; fuer die meisten Substanzen gibt es aber nur zwei, drei Formen.
 */
export function FormUndFarbe({ value, suggestedForms, colorHex, displayName, error = false, onSelect, onColorChange }: {
  value: DosageFormKey | null
  suggestedForms: readonly DosageFormKey[]
  colorHex: string
  displayName: string
  error?: boolean
  onSelect: (dosageForm: DosageFormKey) => void
  onColorChange: (colorHex: string) => void
}) {
  const { t } = useTranslation()
  const vorschlag = Array.from(new Set(suggestedForms)).filter(key => DOSAGE_FORMS.some(form => form.key === key))
  const [alle, setAlle] = useState(vorschlag.length === 0)
  // Die gewaehlte Form steht immer in der Reihe, auch wenn der Katalog sie
  // nicht vorschlaegt (beim Bearbeiten, nach einem Scan).
  const sichtbar = alle
    ? [...vorschlag, ...DOSAGE_FORMS.map(form => form.key).filter(key => !vorschlag.includes(key))]
    : value && !vorschlag.includes(value) ? [...vorschlag, value] : vorschlag
  const farbe = colorHex || null

  return (
    <div className="space-y-6">
      <fieldset
        data-field="dosageForm"
        tabIndex={-1}
        aria-invalid={error || undefined}
        aria-describedby={error ? 'stack-dosage-form-error' : undefined}
        className="stack-reveal min-w-0"
      >
        <legend className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {t('my_stack_form_question', { defaultValue: 'In welcher Form?' })}
        </legend>
        <div
          role="radiogroup"
          aria-label={String(t('my_stack_dosage_form', { defaultValue: 'Darreichungsform' }))}
          data-form-carousel
          className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-1 sm:scroll-px-6 [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden"
        >
          {sichtbar.map(key => {
            const form = DOSAGE_FORMS.find(entry => entry.key === key)!
            const gewaehlt = value === key
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={gewaehlt}
                data-form-option={key}
                onClick={() => onSelect(key)}
                className={`stack-form-card flex w-[6.75rem] shrink-0 snap-start flex-col items-center gap-2 rounded-2xl border px-2 pb-3 pt-3 text-center transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 motion-reduce:transition-none ${
                  gewaehlt ? 'border-sky-400/80 bg-sky-400/[0.08]' : 'border-white/10 bg-white/[0.03] hover:border-white/20'
                }`}
              >
                <span aria-hidden="true" className="flex h-24 w-full items-end justify-center overflow-hidden text-slate-400">
                  {isStageRenderable(key)
                    ? <DosageFormPreview dosageForm={key} colorHex={gewaehlt && farbe ? farbe : NEUTRAL} size="mini" showLabel={false} />
                    : <DosageFormIcon form={key} size={34} />}
                </span>
                <span className={`text-sm font-semibold ${gewaehlt ? 'text-white' : 'text-slate-300'}`}>{t(form.labelKey)}</span>
              </button>
            )
          })}
          {!alle && (
            <button
              type="button"
              data-form-more
              onClick={() => setAlle(true)}
              className="flex min-h-11 w-[6.75rem] shrink-0 snap-start flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 px-2 py-3 text-center text-sm font-semibold text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              {t('my_stack_form_more', { defaultValue: 'Andere Form' })}
            </button>
          )}
        </div>
        {error && (
          <p id="stack-dosage-form-error" role="alert" className="mt-3 text-sm text-rose-300">
            {t('my_stack_dosage_form_required', { defaultValue: 'Bitte wähle eine Darreichungsform.' })}
          </p>
        )}
      </fieldset>

      {value && showsColor(value) && (
        <div key={value} role="group" aria-labelledby="stack-color-label" data-form-color className="stack-reveal">
          <p id="stack-color-label" className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {hatFluessigkeit(value)
              ? t('my_stack_color_of_liquid', { defaultValue: 'Farbe der Flüssigkeit' })
              : t('my_stack_color_optional', { defaultValue: 'Farbe (optional)' })}
          </p>
          <ColorSwatchPicker value={colorHex} onChange={onColorChange} />
          <p className="mt-3 text-sm text-slate-400">
            {t('my_stack_color_hint', { name: displayName.trim() || t('my_stack_this_substance', { defaultValue: 'diese Substanz' }) })}
          </p>
        </div>
      )}
    </div>
  )
}

/** Hat die Form eine Fluessigkeit, deren Farbe man waehlt? Aus den Eigenschaften der Form. */
function hatFluessigkeit(key: DosageFormKey): boolean {
  return getDosageForm(key).capabilities.some(eigenschaft => eigenschaft === 'liquid' || eigenschaft === 'reconstitutable')
}
