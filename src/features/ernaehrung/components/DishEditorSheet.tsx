import { useState } from 'react'
import { ChevronDown, Plus, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Sheet } from './Panel'
import { type DishDraft, dishFromDraft } from '../lib/dishDraft'
import { MAX_AMOUNT, MEALS, type Food, amountValid, nutrientsFor, parseAmount, showDecimal } from '../lib/nutrition'
import { MAX_INGREDIENTS, portionsValid } from '../lib/recipe'
import { DIM, ERROR_TEXT, MUTED, chip } from '../styles'
import { SheetClose } from '../../../components/ui/SheetClose'
import { MacroCells } from './MacroCells'
import { ScoreBadge } from './ScoreBadge'

/**
 * Gericht anlegen oder bearbeiten: Name, Portionen, Zutaten mit Menge.
 * Zutaten kommen über die gewohnte Suche (Häufig, Meine, Marken, Barcode).
 * Die Gericht-Kugel oben (DishStage) zeigt eine Portion; eine aufgeklappte
 * Zutat (`focus`) zeigt ihre Nährwerte, und ihre Punkte pulsieren oben.
 */
export function DishEditorSheet({ draft, busy, hideKcal, focus, onFocus, onChange, onAddIngredient, onSave, onDelete, onClose }: {
  draft: DishDraft
  busy: boolean
  hideKcal: boolean
  focus: number | null
  onFocus: (k: number | null) => void
  onChange: (d: DishDraft) => void
  onAddIngredient: () => void
  onSave: (dish: Food) => void
  onDelete?: () => void
  onClose: () => void
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language ?? 'de'
  const [tried, setTried] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const dish = dishFromDraft(draft)
  const portion = dish?.serving?.amount ?? null
  const perPortion = dish && portion ? nutrientsFor(dish.per100, portion) : null
  const portionsOk = portionsValid(parseAmount(draft.portions))
  const portions = parseAmount(draft.portions)
  const weight = draft.items.reduce((sum, i) => sum + (parseAmount(i.text) || 0), 0)
  const tooHeavy = portionsOk && weight / portions > MAX_AMOUNT

  const setItem = (k: number, text: string) => onChange({ ...draft, items: draft.items.map((i, j) => (j === k ? { ...i, text } : i)) })
  const removeItem = (k: number) => {
    onFocus(null)
    onChange({ ...draft, items: draft.items.filter((_, j) => j !== k) })
  }

  const submit = () => {
    setTried(true)
    if (dish) onSave(dish)
  }

  return (
    // Ein versehentlicher Tipp daneben soll kein halb gebautes Gericht verwerfen: dann schließt nur das X.
    <Sheet labelledBy="nutr-dish-title" busy={busy} onClose={draft.name.trim() || draft.items.length ? () => {} : onClose} tall>
      <div className="flex items-center justify-between gap-2">
        {/* Punkte des ganzen Gerichts stehen oben an der Gericht-Kugel. */}
        <h2 id="nutr-dish-title" className="lg-title2 min-w-0 truncate">{t(draft.itemId ? 'nutr_dish_edit' : 'nutr_dish_new')}</h2>
        <SheetClose onClick={onClose} disabled={busy} />
      </div>

      <div className="mt-3 flex gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor="nutr-dish-name" className="label">{t('nutr_f_name')}</label>
          <input id="nutr-dish-name" value={draft.name} maxLength={120} autoFocus={!draft.name}
            placeholder={t('nutr_dish_name_ph')} onChange={e => onChange({ ...draft, name: e.target.value })}
            aria-invalid={tried && !draft.name.trim()} className="input" />
        </div>
        <div className="w-24 shrink-0">
          <label htmlFor="nutr-dish-portions" className="label truncate">{t('nutr_dish_portions')}</label>
          <input id="nutr-dish-portions" inputMode="decimal" value={draft.portions}
            onChange={e => onChange({ ...draft, portions: e.target.value })} onFocus={e => e.currentTarget.select()}
            aria-invalid={tried && !portionsOk} className="input tabular-nums" />
        </div>
      </div>

      <div className="mt-4 flex items-baseline justify-between gap-2">
        <p className="label !mb-0" id="nutr-dish-meal">{t('nutr_dish_meal')}</p>
        <span className={`text-[12px] ${MUTED}`}>{t('nutr_dish_meal_hint')}</span>
      </div>
      {/* Umschalter statt Radio: erneutes Antippen hebt die Zuordnung auf. */}
      <div role="group" aria-labelledby="nutr-dish-meal" className="mt-1.5 flex flex-wrap gap-1.5">
        {MEALS.map(m => (
          <button key={m} type="button" aria-pressed={draft.meal === m}
            onClick={() => onChange({ ...draft, meal: draft.meal === m ? null : m })} className={chip(draft.meal === m)}>
            {t(`nutr_meal_${m}`)}
          </button>
        ))}
      </div>

      <p className="label mt-4" id="nutr-dish-ingredients">{t('nutr_dish_ingredients')}</p>
      {draft.items.length > 0 ? (
        <ul aria-labelledby="nutr-dish-ingredients" className="lg-rows -mx-5">
          {draft.items.map(({ ing, text }, k) => {
            const amount = parseAmount(text)
            const ok = amountValid(amount)
            const nu = ok ? nutrientsFor(ing.per100, amount) : null
            const open = focus === k
            const extras = nu ? ([['nutr_f_sugar', nu.sugar], ['nutr_f_sat_fat', nu.satFat], ['nutr_f_fiber', nu.fiber], ['nutr_f_salt', nu.salt]] as const)
              .filter(([, v]) => v != null).map(([key, v]) => `${t(key)} ${showDecimal(Math.round(v! * 10) / 10, lang)} g`) : []
            return (
              <li key={k} className="py-1.5 pl-5 pr-2">
                <div className="flex min-h-[44px] items-center gap-2">
                {/* Antippen klappt die Nährwerte auf; oben pulsieren die Punkte dieser Zutat. */}
                <button type="button" aria-expanded={open} aria-controls={open ? `nutr-dish-ing-${k}` : undefined} onClick={() => onFocus(open ? null : k)}
                  className="min-w-0 flex-1 text-left">
                  <span className="flex items-center gap-1">
                    <span className="truncate text-[17px] text-[var(--lg-text)]">{ing.name}</span>
                    <ChevronDown size={14} aria-hidden="true" className={`shrink-0 text-[var(--lg-text-3)] transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                  </span>
                  {/* Punkte in der zweiten Zeile: Der Name braucht den Platz. */}
                  <span className={`flex items-center gap-1.5 text-[13px] tabular-nums ${MUTED}`}>
                    <ScoreBadge per100={ing.per100} unit={ing.unit} />
                    <span className="truncate">
                      {nu ? (hideKcal
                        ? `${Math.round(nu.protein)} g ${t('nutr_protein_short')}`
                        : `${Math.round(nu.kcal)} kcal`) : '–'}
                      {ing.brand ? ` · ${ing.brand}` : ''}
                    </span>
                  </span>
                </button>
                <input inputMode="decimal" value={text} onChange={e => setItem(k, e.target.value)} onFocus={e => e.currentTarget.select()}
                  aria-label={t('nutr_dish_ingredient_amount', { name: ing.name, unit: ing.unit })} aria-invalid={!ok}
                  className="input !min-h-10 !w-[4.5rem] shrink-0 !px-2.5 text-right tabular-nums" />
                <span className={`w-6 shrink-0 text-[15px] ${DIM}`}>{ing.unit}</span>
                <button type="button" onClick={() => removeItem(k)} aria-label={t('nutr_dish_remove_ingredient', { name: ing.name })}
                  className="lg-icon-btn shrink-0 !text-[var(--lg-text-3)]">
                  <X size={18} />
                </button>
                </div>
                {open && (
                  <div id={`nutr-dish-ing-${k}`} className="pb-2 pr-3 pt-1.5">
                    <MacroCells nutrients={nu} hideKcal={hideKcal} />
                    {extras.length > 0 && <p className={`mt-1.5 px-1 text-[12px] tabular-nums ${MUTED}`}>{extras.join(' · ')}</p>}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className={`px-1 py-3 text-[15px] ${MUTED}`}>{t('nutr_dish_no_ingredients')}</p>
      )}
      {draft.items.length < MAX_INGREDIENTS && (
        <button type="button" onClick={onAddIngredient} disabled={busy} className="lg-gray-btn mt-2 w-full">
          <Plus size={16} aria-hidden="true" />{t('nutr_dish_add_ingredient')}
        </button>
      )}

      {perPortion && portion && (
        <>
          <p className="label mt-4">{t('nutr_dish_per_portion', { amount: Math.round(portion) })}</p>
          <MacroCells nutrients={perPortion} hideKcal={hideKcal} />
        </>
      )}

      {tried && !dish && (
        <p role="alert" className={`mt-3 px-1 ${ERROR_TEXT}`}>{t(tooHeavy ? 'nutr_dish_too_heavy' : 'nutr_dish_invalid')}</p>
      )}

      <div className="mt-5 flex gap-2">
        {onDelete && (
          <button type="button" disabled={busy} data-tone="bad"
            onClick={() => (confirmDelete ? onDelete() : setConfirmDelete(true))}
            aria-label={confirmDelete ? undefined : t('nutr_dish_delete')}
            className={`lg-gray-btn !min-h-12 shrink-0 ${confirmDelete ? '!px-4' : '!w-12 !px-0'}`}>
            <Trash2 size={18} aria-hidden={confirmDelete} />{confirmDelete && t('nutr_dish_delete_confirm')}
          </button>
        )}
        <button type="button" className="lg-btn lg-btn-primary flex-1 !px-4" disabled={busy} onClick={submit}>{t('nutr_dish_save')}</button>
      </div>
    </Sheet>
  )
}
