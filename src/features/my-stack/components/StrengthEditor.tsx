import { useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { stockAmountLabel, stockUnitSingular } from '../lib/bestandLabels'
import { getDosageForm, strengthHintKey, strengthShapeFor } from '../lib/dosageForms'
import { konzentrationProMl } from '../lib/konzentration'
import type { IngredientValidationErrors } from '../lib/validation'
import type { DosageFormKey, StackCategory, StackItemIngredient, StrengthShape } from '../types'

type IngredientChanges = Partial<Omit<StackItemIngredient, 'position'>>

export interface StrengthEditorProps {
  dosageForm: DosageFormKey
  /**
   * Die Kategorie der Substanz. Sie entscheidet beim Vial mit: ein Peptid
   * liegt dort als Pulver und wird aufgeloest, ein Hormon liegt fertig
   * geloest darin. Dieselbe Form, zwei verschiedene Fragen.
   */
  category: StackCategory | null
  ingredient: StackItemIngredient
  ingredientIndex: number
  ingredientName?: string
  errors?: IngredientValidationErrors
  onChange: (changes: IngredientChanges) => void
}

// Die deutschen Vorgaben zu den fuenf Staerke-Formen. Ausgelagert, weil sie
// im JSX die Zeile sprengen wuerden — der Wortlaut kommt im Betrieb aus den
// Sprachdateien (`my_stack_strength_hint_*`).
const HINWEIS_FALLBACK: Record<StrengthShape, string> = {
  per_unit: 'Wie viel Wirkstoff steckt in EINER Einheit? Trage die Zahl von der Verpackung ein. Beispiel: 500 mg pro 1 Kapsel. Die Produktmenge steht schon auf 1 — ändere sie nur, wenn die Packung es anders angibt. Keine Dosierungsempfehlung.',
  per_volume: 'Trage die Konzentration ein, wie sie auf dem Etikett steht. Beispiel: 250 mg pro 1 ml. Keine Dosierungsempfehlung.',
  reconstituted: 'Ein Pulver-Vial (Peptid) wird vor der ersten Einnahme aufgelöst — die Rekonstitution. Links die Wirkstoffmenge im Vial, rechts wie viel Lösungsmittel du zugibst. Beispiel: 10 mg auf 2 ml ergibt 5 mg/ml. Ist das Vial schon flüssig, steht beides auf dem Etikett. Keine Dosierungsempfehlung.',
  per_mass: 'Wie viel Wirkstoff steckt in einer Produktmenge? Trage ein, was auf der Verpackung steht. Beispiel: 50 mg pro 1 g. Keine Dosierungsempfehlung.',
  free: 'Wie viel Wirkstoff ist in welcher Produktmenge enthalten? Trage ein, was auf der Verpackung steht. Beispiel: 250 mg/ml = 250 mg pro 1 ml. Keine Dosierungsempfehlung.',
}

// Ein Vial, in dem schon eine Loesung steht (Testosteron Enantat etwa). Es
// bekommt einen eigenen Satz statt des allgemeinen Konzentrationshinweises,
// weil es die eine Stelle ist, an der die Kategorie danebenliegen kann — HCG
// ist ein Hormon und liegt trotzdem als Pulver vor. Der Satz nennt deshalb
// den Ausweg, statt ihn den Nutzer suchen zu lassen.
const HINWEIS_VIAL_LOESUNG = 'Trage die Konzentration ein, wie sie auf dem Etikett steht. Beispiel: 250 mg pro 1 ml. Liegt in deinem Vial ein Pulver, das du erst auflöst, wähle als Kategorie „Peptid" — dann fragt der Schritt nach dem Lösungsmittel. Keine Dosierungsempfehlung.'

function numericValue(value: string): number | null {
  if (value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

/** Der Eintrag „Andere Einheit …" in der Auswahl — kein gespeicherter Wert. */
const EIGENE_EINHEIT = '__eigene__'

export function StrengthEditor({
  dosageForm,
  category,
  ingredient,
  ingredientIndex,
  ingredientName,
  errors = {},
  onChange,
}: StrengthEditorProps) {
  const { t, i18n } = useTranslation()
  const language = i18n?.resolvedLanguage ?? i18n?.language ?? 'de'
  const form = getDosageForm(dosageForm)
  // Der Schritt fragt ueberall dieselben zwei Zahlen ab. Was sie BEDEUTEN,
  // haengt am Paar aus Substanz und Form: bei einer Kapsel steckt die Staerke
  // in einem Stueck, bei einer Ampulle in einem Milliliter — und beim Vial
  // haengt es daran, was drinliegt. BPC-157 ist ein Pulver und wird
  // aufgeloest; Testosteron Enantat ist ein Oel und traegt seine
  // Konzentration auf dem Etikett.
  const shape = strengthShapeFor(dosageForm, category)
  const istRekonstitution = shape === 'reconstituted'
  const konzentration = konzentrationProMl(
    ingredient.amount_value,
    ingredient.amount_unit,
    ingredient.basis_value,
    ingredient.basis_unit,
  )
  const amountUnits = ingredient.amount_unit && !form.suggestedUnits.includes(ingredient.amount_unit)
    ? [...form.suggestedUnits, ingredient.amount_unit]
    : form.suggestedUnits
  // Die Produkteinheit kommt aus einer Auswahl mit Namen („Sprühstoß",
  // „Tropfen"), nicht als Rohwert („spray"). Was nicht in der Liste steht,
  // traegt man frei ein — dann bleibt das Feld ein Textfeld.
  // Ob das Feld frei ist, folgt dem Wert: eine Einheit ausserhalb der Liste
  // (oder eine nach einem Formwechsel nicht mehr passende) bleibt sichtbar
  // und aenderbar. `freiGewaehlt` haelt nur den Moment nach „Andere Einheit …"
  // fest, solange noch nichts eingetippt ist.
  const [freiGewaehlt, setFreiGewaehlt] = useState(false)
  const eigeneEinheit = freiGewaehlt
    || (Boolean(ingredient.basis_unit) && !form.basisUnits.includes(ingredient.basis_unit!))

  const amountValueErrorId = `stack-strength-${ingredientIndex}-amount-value-error`
  const amountUnitErrorId = `stack-strength-${ingredientIndex}-amount-unit-error`
  const basisValueErrorId = `stack-strength-${ingredientIndex}-basis-value-error`
  const basisUnitErrorId = `stack-strength-${ingredientIndex}-basis-unit-error`
  const displayedIngredientName = ingredientName || t(
    `my_stack_ingredient_${ingredientIndex + 1}`,
    { defaultValue: `Inhaltsstoff ${ingredientIndex + 1}` },
  )
  const hasPreview = (
    ingredient.amount_value !== null
    && Boolean(ingredient.amount_unit?.trim())
    && ingredient.basis_value !== null
    && Boolean(ingredient.basis_unit?.trim())
  )

  return (
    <fieldset className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <legend className="px-1 text-sm font-medium text-slate-200">
        {displayedIngredientName}
      </legend>

      <p data-strength-hint={shape} className="mt-3 rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2.5 text-xs leading-relaxed text-slate-400">
        {t(strengthHintKey(dosageForm, category), {
          defaultValue: dosageForm === 'vial' && shape === 'per_volume'
            ? HINWEIS_VIAL_LOESUNG
            : HINWEIS_FALLBACK[shape],
        })}
      </p>

      <div className="mt-4 grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_minmax(0,1fr)_minmax(0,1fr)] sm:items-start">
        <div className="min-w-0">
          <label htmlFor={`stack-strength-${ingredientIndex}-amount-value`} className="mb-2 block text-sm font-medium text-slate-300">
            {istRekonstitution
              ? t('my_stack_strength_value_vial', { defaultValue: 'Wirkstoff im Vial' })
              : t('my_stack_strength_value', { defaultValue: 'Wirkstoffmenge' })}
          </label>
          <input
            id={`stack-strength-${ingredientIndex}-amount-value`}
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={ingredient.amount_value ?? ''}
            onChange={event => onChange({ amount_value: numericValue(event.target.value) })}
            data-field={`ingredients.${ingredientIndex}.amountValue`}
            aria-invalid={Boolean(errors.amountValue) || undefined}
            aria-describedby={errors.amountValue ? amountValueErrorId : undefined}
            className="input min-h-11 w-full min-w-0 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          />
          {errors.amountValue && (
            <p id={amountValueErrorId} role="alert" className="mt-2 flex items-center gap-2 text-sm text-rose-300">
              <AlertCircle aria-hidden="true" size={16} />
              {t('my_stack_strength_value_required', { defaultValue: 'Bitte gib die Wirkstoffmenge an.' })}
            </p>
          )}
        </div>

        <div className="min-w-0">
          <label htmlFor={`stack-strength-${ingredientIndex}-amount-unit`} className="mb-2 block text-sm font-medium text-slate-300">
            {t('my_stack_strength_unit', { defaultValue: 'Wirkstoffeinheit' })}
          </label>
          <input
            id={`stack-strength-${ingredientIndex}-amount-unit`}
            list={`stack-strength-${ingredientIndex}-amount-units`}
            value={ingredient.amount_unit ?? ''}
            onChange={event => onChange({ amount_unit: event.target.value || null })}
            data-field={`ingredients.${ingredientIndex}.amountUnit`}
            aria-invalid={Boolean(errors.amountUnit) || undefined}
            aria-describedby={errors.amountUnit ? amountUnitErrorId : undefined}
            autoComplete="off"
            className="input min-h-11 w-full min-w-0 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          />
          <datalist id={`stack-strength-${ingredientIndex}-amount-units`}>
            {amountUnits.map(unit => <option key={unit} value={unit} />)}
          </datalist>
          {errors.amountUnit && (
            <p id={amountUnitErrorId} role="alert" className="mt-2 flex items-center gap-2 text-sm text-rose-300">
              <AlertCircle aria-hidden="true" size={16} />
              {t('my_stack_strength_unit_required', { defaultValue: 'Bitte wähle eine Wirkstoffeinheit.' })}
            </p>
          )}
        </div>

        <div className="col-span-2 min-w-0 sm:col-span-1">
          <span aria-hidden="true" className="mb-2 hidden h-5 sm:block">&nbsp;</span>
          <span className="flex min-h-6 items-center justify-center text-sm font-medium text-sky-300 sm:min-h-11">
            {t('my_stack_per', { defaultValue: 'pro' })}
          </span>
        </div>

        <div className="min-w-0">
          <label htmlFor={`stack-strength-${ingredientIndex}-basis-value`} className="mb-2 block text-sm font-medium text-slate-300">
            {istRekonstitution
              ? t('my_stack_basis_value_solvent', { defaultValue: 'Lösungsmittel' })
              : t('my_stack_basis_value', { defaultValue: 'Produktmenge' })}
          </label>
          <input
            id={`stack-strength-${ingredientIndex}-basis-value`}
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={ingredient.basis_value ?? ''}
            onChange={event => onChange({ basis_value: numericValue(event.target.value) })}
            data-field={`ingredients.${ingredientIndex}.basisValue`}
            aria-invalid={Boolean(errors.basisValue) || undefined}
            aria-describedby={errors.basisValue ? basisValueErrorId : undefined}
            className="input min-h-11 w-full min-w-0 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          />
          {errors.basisValue && (
            <p id={basisValueErrorId} role="alert" className="mt-2 flex items-center gap-2 text-sm text-rose-300">
              <AlertCircle aria-hidden="true" size={16} />
              {t('my_stack_basis_value_required', { defaultValue: 'Bitte gib die Produktmenge an.' })}
            </p>
          )}
        </div>

        <div className="min-w-0">
          <label htmlFor={`stack-strength-${ingredientIndex}-basis-unit`} className="mb-2 block text-sm font-medium text-slate-300">
            {istRekonstitution
              ? t('my_stack_basis_unit_solvent', { defaultValue: 'Einheit' })
              : t('my_stack_basis_unit', { defaultValue: 'Produkteinheit' })}
          </label>
          {eigeneEinheit ? (
            <>
            <input
              id={`stack-strength-${ingredientIndex}-basis-unit`}
              value={ingredient.basis_unit ?? ''}
              onChange={event => onChange({ basis_unit: event.target.value || null })}
              data-field={`ingredients.${ingredientIndex}.basisUnit`}
              aria-invalid={Boolean(errors.basisUnit) || undefined}
              aria-describedby={errors.basisUnit ? basisUnitErrorId : undefined}
              autoComplete="off"
              autoFocus={!ingredient.basis_unit}
              className="input min-h-11 w-full min-w-0 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            />
            <button
              type="button"
              onClick={() => {
                setFreiGewaehlt(false)
                onChange({ basis_unit: null })
              }}
              className="mt-1.5 text-xs font-medium text-sky-300 hover:text-[var(--lg-text)]"
            >
              {t('my_stack_basis_unit_from_list', { defaultValue: 'Aus der Liste wählen' })}
            </button>
            </>
          ) : (
            <select
              id={`stack-strength-${ingredientIndex}-basis-unit`}
              value={ingredient.basis_unit ?? ''}
              onChange={event => {
                if (event.target.value === EIGENE_EINHEIT) {
                  setFreiGewaehlt(true)
                  onChange({ basis_unit: null })
                  return
                }
                onChange({ basis_unit: event.target.value || null })
              }}
              data-field={`ingredients.${ingredientIndex}.basisUnit`}
              aria-invalid={Boolean(errors.basisUnit) || undefined}
              aria-describedby={errors.basisUnit ? basisUnitErrorId : undefined}
              className="select min-h-11 w-full min-w-0 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
            >
              {!ingredient.basis_unit && (
                <option value="">{t('my_stack_basis_unit_choose', { defaultValue: 'Bitte wählen' })}</option>
              )}
              {form.basisUnits.map(unit => <option key={unit} value={unit}>{stockUnitSingular(t, unit)}</option>)}
              <option value={EIGENE_EINHEIT}>{t('my_stack_basis_unit_custom', { defaultValue: 'Andere Einheit …' })}</option>
            </select>
          )}
          {errors.basisUnit && (
            <p id={basisUnitErrorId} role="alert" className="mt-2 flex items-center gap-2 text-sm text-rose-300">
              <AlertCircle aria-hidden="true" size={16} />
              {t('my_stack_basis_unit_required', { defaultValue: 'Bitte wähle eine Produkteinheit.' })}
            </p>
          )}
        </div>
      </div>

      {hasPreview && (
        <p
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="mt-4 rounded-xl border border-sky-400/15 bg-sky-400/[0.05] px-3 py-2 text-sm text-sky-100"
        >
          {displayedIngredientName}: {ingredient.amount_value} {ingredient.amount_unit} {t('my_stack_per', { defaultValue: 'pro' })} {stockAmountLabel(t, ingredient.basis_value!, ingredient.basis_unit!, language)}
          {/* Was in einem Milliliter steckt, ist die Zahl, mit der man
              aufzieht — „10 mg pro 2 ml" allein sagt sie nicht. */}
          {konzentration && (
            <span data-strength-concentration className="ml-1 font-medium">
              {t('my_stack_strength_concentration', {
                defaultValue: '= {{value}} {{unit}}/ml',
                value: konzentration.value,
                unit: konzentration.unit,
              })}
            </span>
          )}
        </p>
      )}
    </fieldset>
  )
}
