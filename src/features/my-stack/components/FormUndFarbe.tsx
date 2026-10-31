import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { ColorSwatchPicker } from '../../../components/ColorSwatchPicker'
import { DOSAGE_FORMS, getDosageForm, isStageRenderable, showsColor } from '../lib/dosageForms'
import type { DosageFormKey } from '../types'
import { DosageFormIcon } from './DosageFormIcon'
import { DosageFormPreview } from './DosageFormPreview'

// Die Form ohne Farbe: neutral, damit die gewaehlte Karte heraussticht.
const NEUTRAL = '#5b6068'

/**
 * Form und Farbe auf der Substanzseite. Unter dem Treffer steht eine Reihe mit
 * ALLEN Darreichungsformen der App — die der Katalog kennt, tragen
 * „Empfohlen", und die erste davon ist vorausgewaehlt. Ist eine Form gewaehlt,
 * erscheint darunter die Farbe; die Form faerbt sich mit.
 * Frueher waren Form und Farbe je ein eigener Schritt mit zwei grossen
 * Karussells.
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
  const vorschlag = new Set(suggestedForms)
  const reiheRef = useRef<HTMLDivElement>(null)
  const getippt = useRef(false)
  // Die gewaehlte Form steht in der Mitte der Reihe — beim Erscheinen und
  // wenn sie von aussen kommt (Katalogwahl, Scan). Nicht animiert: das ist
  // ein Ausgangszustand, keine Bewegung. Ein Tipp in der Reihe springt nicht.
  useEffect(() => {
    if (getippt.current) {
      getippt.current = false
      return
    }
    const reihe = reiheRef.current
    const karte = value ? reihe?.querySelector<HTMLElement>(`[data-form-option="${value}"]`) : null
    if (!reihe || !karte) return
    reihe.scrollLeft = karte.offsetLeft - (reihe.clientWidth - karte.clientWidth) / 2
  }, [value])
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
        <legend className="mb-2 text-[13px] font-medium text-slate-500">
          {t('my_stack_form_question', { defaultValue: 'In welcher Form?' })}
        </legend>
        <div
          role="radiogroup"
          aria-label={String(t('my_stack_dosage_form', { defaultValue: 'Darreichungsform' }))}
          ref={reiheRef}
          data-form-carousel
          className="relative -mx-4 flex snap-x snap-mandatory scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-1 sm:scroll-px-6 [scrollbar-width:none] sm:-mx-6 sm:px-6 [&::-webkit-scrollbar]:hidden"
        >
          {DOSAGE_FORMS.map(form => {
            const key = form.key
            const gewaehlt = value === key
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={gewaehlt}
                data-form-option={key}
                aria-label={String(t(form.labelKey))}
                aria-description={vorschlag.has(key) ? String(t('my_stack_form_recommended', { defaultValue: 'Empfohlen' })) : undefined}
                onClick={() => {
                  getippt.current = key !== value
                  onSelect(key)
                }}
                // Keine Karte drumherum: die Form steht frei. Gewaehlt ist sie
                // farbig und hell, die anderen grau — auch das Pflaster, das
                // seine Hautfarbe sonst immer mitbringt.
                className="stack-form-option flex min-h-11 w-[5.75rem] shrink-0 snap-start flex-col items-center gap-2 rounded-2xl px-1 pb-2 pt-1 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
              >
                <span aria-hidden="true" data-gewaehlt={gewaehlt || undefined} className="stack-form-art flex h-24 w-full items-end justify-center overflow-hidden text-slate-400">
                  {isStageRenderable(key)
                    ? <DosageFormPreview dosageForm={key} colorHex={gewaehlt && farbe ? farbe : NEUTRAL} size="mini" showLabel={false} />
                    : <DosageFormIcon form={key} size={34} />}
                </span>
                <span className={`text-sm font-medium transition-colors duration-200 ${gewaehlt ? 'text-white' : 'text-slate-500'}`}>{t(form.labelKey)}</span>
                {vorschlag.has(key)
                  ? <span data-form-recommended className="text-[11px] font-medium text-sky-300">{t('my_stack_form_recommended', { defaultValue: 'Empfohlen' })}</span>
                  : <span aria-hidden="true" className={`size-1.5 rounded-full transition-colors duration-200 ${gewaehlt ? 'bg-sky-400' : 'bg-transparent'}`} />}
              </button>
            )
          })}
        </div>
        {error && (
          <p id="stack-dosage-form-error" role="alert" className="mt-3 text-sm text-rose-300">
            {t('my_stack_dosage_form_required', { defaultValue: 'Bitte wähle eine Darreichungsform.' })}
          </p>
        )}
      </fieldset>

      {value && showsColor(value) && (
        <div key={value} role="group" aria-labelledby="stack-color-label" data-form-color className="stack-reveal">
          <p id="stack-color-label" className="mb-2 text-[13px] font-medium text-slate-500">
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
