import { AlertCircle, Plus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { IngredientValidationErrors } from '../lib/validation'
import type { StackItemIngredient, SubstanceCatalogEntry } from '../types'
import { IngredientCatalogPicker } from './IngredientCatalogPicker'

type IngredientChanges = Partial<Omit<StackItemIngredient, 'position'>>

// Ohne Namensfeld. Der Name steht im ersten Schritt — er hier ein zweites Mal
// unter einer anderen Aufschrift („Produktname“ statt „Was moechtest du
// hinzufuegen?“) machte aus einem Wert zwei Dinge, die derselbe waren. Wer ihn
// aendern will, geht einen Schritt zurueck; dafuer gibt es die Schrittleiste.
export interface IngredientEditorProps {
  ingredients: StackItemIngredient[]
  catalogNames?: Readonly<Record<string, string>>
  /** Der Katalog, damit JEDE Zeile daran haengen kann — nicht nur die erste. */
  catalogEntries?: readonly SubstanceCatalogEntry[]
  errors?: IngredientValidationErrors[]
  onIngredientChange: (index: number, changes: IngredientChanges) => void
  onAddIngredient: () => void
  onRemoveIngredient: (index: number) => void
}

export function IngredientEditor({
  ingredients,
  catalogNames = {},
  catalogEntries = [],
  errors = [],
  onIngredientChange,
  onAddIngredient,
  onRemoveIngredient,
}: IngredientEditorProps) {
  const { t } = useTranslation()
  const eintragZu = (id: string | null) =>
    (id ? catalogEntries.find(eintrag => eintrag.id === id) ?? null : null)

  return (
    <div className="space-y-5">
      {/* Der Schritt stand ohne ein Wort der Erklaerung da: ein Feld mit dem
          schon eingetragenen Namen und ein Knopf „Inhaltsstoff hinzufuegen".
          Was ein Inhaltsstoff hier ist und warum es mehr als einer sein
          koennte, musste man raten.
          Die Ueberschrift wiederholt nicht „Inhaltsstoffe" — das steht schon
          als Untertitel ueber dem Schritt —, sondern stellt die Frage, die
          der Schritt beantwortet. Dieselbe Teilung wie im Tiefenschritt
          („Tracking-Tiefe" oben, „Wie genau moechtest du tracken?" hier). */}
      <div>
        <h3 className="text-base font-medium text-white">
          {t('my_stack_ingredients_question', { defaultValue: 'Was steckt in deinem Produkt?' })}
        </h3>
        <p className="mt-1 text-[13px] leading-snug text-slate-400">
          {t('my_stack_ingredients_intro', {
            defaultValue: 'Meist ein einziger Wirkstoff — er steht schon da. Ein Kombipräparat bekommt je Wirkstoff eine eigene Zeile.',
          })}
        </p>
      </div>

      <div className="space-y-3">
        {ingredients.map((ingredient, index) => {
          const labelKey = `my_stack_ingredient_${index + 1}`
          const fieldError = errors[index]?.name
          const catalogName = ingredient.catalog_substance_id
            ? catalogNames[ingredient.catalog_substance_id]
            : undefined

          return (
            <div key={`${ingredient.position}-${ingredient.catalog_substance_id ?? 'custom'}`} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <div className="mb-2 flex items-center justify-between gap-3">
                <label htmlFor={`stack-ingredient-${index}`} className="text-sm font-medium text-slate-200">
                  {t(labelKey, { defaultValue: `Inhaltsstoff ${index + 1}` })}
                </label>
                {ingredients.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemoveIngredient(index)}
                    aria-label={String(t('remove', { defaultValue: 'Entfernen' }))}
                    className="grid min-h-11 min-w-11 cursor-pointer place-items-center rounded-xl text-slate-400 transition-colors duration-200 hover:bg-rose-400/10 hover:text-rose-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 motion-reduce:transition-none"
                  >
                    <Trash2 aria-hidden="true" size={18} />
                  </button>
                )}
              </div>
              {/* Die ERSTE Zeile ist die Substanz des Eintrags — sie kommt
                  aus dem Substanzschritt und wird hier nur angezeigt. Jede
                  WEITERE haengt an ihrer eigenen Katalogsuche: ohne sie war
                  der zweite Wirkstoff eines Kombipraeparats reiner Freitext,
                  also ohne Einheitenvorschlaege und ohne PK-Profil. */}
              {index === 0 && catalogName ? (
                <input
                  id={`stack-ingredient-${index}`}
                  value={catalogName}
                  readOnly
                  aria-readonly="true"
                  className="min-h-11 w-full rounded-xl border border-sky-400/20 bg-sky-400/[0.06] px-3 font-medium text-sky-100 outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                />
              ) : index === 0 ? (
                <input
                  id={`stack-ingredient-${index}`}
                  value={ingredient.custom_name}
                  onChange={event => onIngredientChange(index, { custom_name: event.target.value, catalog_substance_id: null })}
                  data-field={`ingredients.${index}.name`}
                  aria-invalid={Boolean(fieldError) || undefined}
                  aria-describedby={fieldError ? `stack-ingredient-${index}-error` : undefined}
                  className="input min-h-11 w-full text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
                />
              ) : (
                <IngredientCatalogPicker
                  entry={eintragZu(ingredient.catalog_substance_id)}
                  customName={ingredient.custom_name}
                  entries={catalogEntries}
                  inputId={`stack-ingredient-${index}`}
                  fieldName={`ingredients.${index}.name`}
                  invalid={Boolean(fieldError)}
                  describedBy={fieldError ? `stack-ingredient-${index}-error` : undefined}
                  onPick={eintrag => onIngredientChange(index, {
                    catalog_substance_id: eintrag.id,
                    custom_name: eintrag.canonical_name,
                  })}
                  onCustomName={name => onIngredientChange(index, {
                    custom_name: name,
                    catalog_substance_id: null,
                  })}
                  onDetach={() => onIngredientChange(index, { catalog_substance_id: null })}
                />
              )}
              {fieldError && (
                <p id={`stack-ingredient-${index}-error`} role="alert" className="mt-2 flex items-center gap-2 text-sm text-rose-300">
                  <AlertCircle aria-hidden="true" size={16} />
                  {t('my_stack_ingredient_required', { defaultValue: 'Bitte benenne den Inhaltsstoff.' })}
                </p>
              )}
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={onAddIngredient}
        className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 font-medium text-slate-200 transition-colors duration-200 hover:border-sky-400/25 hover:text-sky-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 motion-reduce:transition-none"
      >
        <Plus aria-hidden="true" size={18} />
        {t('my_stack_add_ingredient', { defaultValue: 'Inhaltsstoff hinzufügen' })}
      </button>

      {/* Wozu das Ganze: der naechste Schritt fragt je Wirkstoff nach der
          Menge. Dieselbe Machart wie der Hinweiskasten dort
          (`my_stack_no_dosage_advice`) — erklaert, was als Naechstes kommt,
          statt es den Nutzer erst dort entdecken zu lassen. */}
      <p
        data-ingredients-next
        className="rounded-xl border border-white/[0.07] bg-black/20 px-3 py-2.5 text-xs leading-relaxed text-slate-400"
      >
        {t('my_stack_ingredients_next', {
          defaultValue: 'Im nächsten Schritt gibst du je Wirkstoff an, wie viel davon in einer Produkteinheit steckt — die Zahl von der Verpackung. Erst damit rechnet die App in Milligramm statt in Kapseln.',
        })}
      </p>
    </div>
  )
}
