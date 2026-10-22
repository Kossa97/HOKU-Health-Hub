import { ChefHat, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { type LogEntry, type Meal, per100FromEntry, showDecimal, sumNutrients } from '../lib/nutrition'
import { type Piece, countFor, servingNoun } from '../lib/pieces'
import { FoodOrb } from './FoodOrb'
import { SwipeRow } from './SwipeRow'
import { ScoreBadge } from './ScoreBadge'
import { CARD, DIM, MUTED } from '../styles'

export function MealSection({ meal, entries, hideKcal, goalKcal, busy, pieceOf, onAdd, onOpen, onDelete, onSaveAsDish }: {
  meal: Meal
  entries: LogEntry[]
  hideKcal: boolean
  /** Tagesziel: Größe der Essens-Kugeln im Verhältnis zur Tageskugel. */
  goalKcal: number
  busy: boolean
  /** Zählbar wie im Mengenblatt (gleiche Quelle), für „2 Stück“ statt „110 g“. */
  pieceOf: (entry: LogEntry) => Piece | null
  onAdd: () => void
  onOpen: (entry: LogEntry) => void
  /** Wischen → Löschen; false, wenn es scheiterte. */
  onDelete: (entry: LogEntry) => Promise<boolean>
  /** Diese Mahlzeit als Gericht speichern (Einträge mit Menge). */
  onSaveAsDish: () => void
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language ?? 'de'
  const sum = sumNutrients(entries.map(e => e.nutrients))
  const headingId = `nutr-meal-${meal}`
  // Erst ab zwei Zutaten ist es ein Gericht.
  const canSaveAsDish = entries.filter(e => e.source !== 'quick' && e.amount).length >= 2
  /** „2 Stück · “ für Gezähltes (Eier, Scheiben Brot), sonst „110 g · “. */
  const amountText = (e: LogEntry) => {
    if (e.amount == null) return ''
    const piece = pieceOf(e)
    const n = piece && countFor(e.amount, piece.grams)
    if (!n) return `${Math.round(e.amount)} ${e.unit} · `
    if (piece.label) return `${n === 1 ? piece.label : `${showDecimal(n, lang)} × ${servingNoun(piece.label)}`} · `
    return `${t(`nutr_piece_${piece.kind}`, { count: n, n: showDecimal(n, lang) })} · `
  }

  return (
    <section aria-labelledby={headingId} className={CARD} data-meal={meal}>
      {/* Titel · Summe · Hinzufügen in einer Zeile. */}
      <div className="flex items-center gap-2 pl-4 pr-2 pt-2">
        <h2 id={headingId} className="min-w-0 flex-1 truncate text-[17px] font-semibold text-[var(--lg-text)]">{t(`nutr_meal_${meal}`)}</h2>
        {entries.length > 0 && (
          <span className={`shrink-0 text-[15px] tabular-nums ${MUTED}`}>
            {hideKcal ? `${Math.round(sum.protein)} g ${t('nutr_protein_short')}` : `${Math.round(sum.kcal)} kcal`}
          </span>
        )}
        <button type="button" onClick={onAdd} disabled={busy}
          className="flex min-h-11 shrink-0 touch-manipulation select-none items-center gap-1 rounded-full px-2.5 text-[15px] font-semibold text-[var(--accent)] transition-opacity active:opacity-60 disabled:opacity-40">
          <Plus size={18} strokeWidth={2.4} aria-hidden="true" />{t('nutr_add')}
        </button>
      </div>

      {entries.length > 0 && (
        <ul className="lg-rows mt-1">
          {entries.map(e => (
            <li key={e.id}>
              <SwipeRow id={e.id} label={t('nutr_entry_open', { name: e.name })} editLabel={t('nutr_edit')} deleteLabel={t('nutr_delete')}
                disabled={busy} onTap={() => onOpen(e)} onEdit={() => onOpen(e)} onDelete={() => onDelete(e)}>
                <FoodOrb values={e.nutrients} goalKcal={goalKcal} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[17px] text-[var(--lg-text)]">{e.name}</span>
                  <span className={`block truncate text-[13px] tabular-nums ${MUTED}`}>
                    {amountText(e)}
                    {Math.round(e.nutrients.protein)} {t('nutr_p')} · {Math.round(e.nutrients.carbs)} {t('nutr_c')} · {Math.round(e.nutrients.fat)} {t('nutr_f')}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2.5">
                  <ScoreBadge per100={per100FromEntry(e)} unit={e.unit} />
                  {!hideKcal && <span className={`text-[15px] tabular-nums ${DIM}`}>{Math.round(e.nutrients.kcal)}</span>}
                </span>
              </SwipeRow>
            </li>
          ))}
        </ul>
      )}

      {canSaveAsDish ? (
        <div className="flex px-3 pb-3 pt-2">
          <button type="button" onClick={onSaveAsDish} disabled={busy} data-quiet
            aria-label={t('nutr_save_as_dish_aria', { meal: t(`nutr_meal_${meal}`) })}
            className="lg-gray-btn !px-3.5 !text-[13px]">
            <ChefHat size={14} aria-hidden="true" />{t('nutr_save_as_dish')}
          </button>
        </div>
      ) : <div className={entries.length > 0 ? 'h-1.5' : 'h-2'} />}
    </section>
  )
}
