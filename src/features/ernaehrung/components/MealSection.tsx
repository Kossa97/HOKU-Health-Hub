import { ChefHat, Copy, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { type LogEntry, type Meal, per100FromEntry, sumNutrients } from '../lib/nutrition'
import { FoodOrb } from './FoodOrb'
import { ScoreBadge } from './ScoreBadge'
import { CARD, DIM, MUTED } from '../styles'

export function MealSection({ meal, entries, hideKcal, goalKcal, busy, onAdd, onOpen, onCopyYesterday, onSaveAsDish }: {
  meal: Meal
  entries: LogEntry[]
  hideKcal: boolean
  /** Tagesziel: Größe der Essens-Kugeln im Verhältnis zur Tageskugel. */
  goalKcal: number
  busy: boolean
  onAdd: () => void
  onOpen: (entry: LogEntry) => void
  onCopyYesterday: () => void
  /** Diese Mahlzeit als Gericht speichern (Einträge mit Menge). */
  onSaveAsDish: () => void
}) {
  const { t } = useTranslation()
  const sum = sumNutrients(entries.map(e => e.nutrients))
  const headingId = `nutr-meal-${meal}`
  // Erst ab zwei Zutaten ist es ein Gericht.
  const canSaveAsDish = entries.filter(e => e.source !== 'quick' && e.amount).length >= 2

  return (
    <section aria-labelledby={headingId} className={CARD} data-meal={meal}>
      <div className="flex items-center justify-between px-4 pt-3.5">
        <h2 id={headingId} className="text-[17px] font-semibold text-[var(--lg-text)]">{t(`nutr_meal_${meal}`)}</h2>
        {entries.length > 0 && (
          <span className={`text-[15px] tabular-nums ${MUTED}`}>
            {hideKcal ? `${Math.round(sum.protein)} g ${t('nutr_protein_short')}` : `${Math.round(sum.kcal)} kcal`}
          </span>
        )}
      </div>

      {entries.length > 0 && (
        <ul className="lg-rows mt-1">
          {entries.map(e => (
            <li key={e.id}>
              <button type="button" onClick={() => onOpen(e)}
                aria-label={t('nutr_entry_open', { name: e.name })}
                className="flex min-h-[56px] w-full items-center justify-between gap-3 py-2 pl-2 pr-4 text-left transition-colors active:bg-[var(--lg-fill)]">
                <FoodOrb values={e.nutrients} goalKcal={goalKcal} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[17px] text-[var(--lg-text)]">{e.name}</span>
                  <span className={`block truncate text-[13px] tabular-nums ${MUTED}`}>
                    {e.amount != null ? `${Math.round(e.amount)} ${e.unit} · ` : ''}
                    {Math.round(e.nutrients.protein)} {t('nutr_p')} · {Math.round(e.nutrients.carbs)} {t('nutr_c')} · {Math.round(e.nutrients.fat)} {t('nutr_f')}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2.5">
                  <ScoreBadge per100={per100FromEntry(e)} unit={e.unit} />
                  {!hideKcal && <span className={`text-[15px] tabular-nums ${DIM}`}>{Math.round(e.nutrients.kcal)}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2 px-3 pb-3 pt-2">
        <button type="button" onClick={onAdd} disabled={busy} className="lg-gray-btn flex-1">
          <Plus size={16} aria-hidden="true" />{t('nutr_add')}
        </button>
        {canSaveAsDish && (
          <button type="button" onClick={onSaveAsDish} disabled={busy} data-quiet
            aria-label={t('nutr_save_as_dish_aria', { meal: t(`nutr_meal_${meal}`) })}
            className="lg-gray-btn !px-3.5 !text-[13px]">
            <ChefHat size={14} aria-hidden="true" />{t('nutr_save_as_dish')}
          </button>
        )}
        {entries.length === 0 && (
          <button type="button" onClick={onCopyYesterday} disabled={busy} data-quiet
            className="lg-gray-btn !px-3.5 !text-[13px]">
            <Copy size={14} aria-hidden="true" />{t('nutr_copy_yesterday')}
          </button>
        )}
      </div>
    </section>
  )
}
