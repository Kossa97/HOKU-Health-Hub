import { Copy, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { type LogEntry, type Meal, sumNutrients } from '../lib/nutrition'
import { PRESSABLE, card, dim, muted } from '../styles'

export function MealSection({ meal, entries, hideKcal, busy, onAdd, onOpen, onCopyYesterday }: {
  meal: Meal
  entries: LogEntry[]
  hideKcal: boolean
  busy: boolean
  onAdd: () => void
  onOpen: (entry: LogEntry) => void
  onCopyYesterday: () => void
}) {
  const { t } = useTranslation()
  const sum = sumNutrients(entries.map(e => e.nutrients))
  const headingId = `nutr-meal-${meal}`

  return (
    <section aria-labelledby={headingId} style={card} data-meal={meal}>
      <div className="flex items-center justify-between px-4 pt-3.5">
        <h2 id={headingId} className="text-[0.95rem] font-extrabold" style={{ color: 'var(--text)' }}>{t(`nutr_meal_${meal}`)}</h2>
        {entries.length > 0 && (
          <span className="text-[0.78rem] font-semibold tabular-nums" style={muted}>
            {hideKcal ? `${Math.round(sum.protein)} g ${t('nutr_protein_short')}` : `${Math.round(sum.kcal)} kcal`}
          </span>
        )}
      </div>

      {entries.length > 0 && (
        <ul className="mt-1 px-1.5">
          {entries.map(e => (
            <li key={e.id}>
              <button type="button" onClick={() => onOpen(e)}
                aria-label={t('nutr_entry_open', { name: e.name })}
                className={`flex min-h-[52px] w-full items-center justify-between gap-3 rounded-xl px-2.5 py-1.5 text-left ${PRESSABLE}`}>
                <span className="min-w-0">
                  <span className="block truncate text-[0.88rem] font-semibold" style={{ color: 'var(--text)' }}>{e.name}</span>
                  <span className="block truncate text-[0.74rem] tabular-nums" style={muted}>
                    {e.amount != null ? `${Math.round(e.amount)} ${e.unit} · ` : ''}
                    {Math.round(e.nutrients.protein)} {t('nutr_p')} · {Math.round(e.nutrients.carbs)} {t('nutr_c')} · {Math.round(e.nutrients.fat)} {t('nutr_f')}
                  </span>
                </span>
                {!hideKcal && <span className="shrink-0 text-[0.86rem] font-bold tabular-nums" style={dim}>{Math.round(e.nutrients.kcal)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-1 p-1.5">
        <button type="button" onClick={onAdd} disabled={busy}
          className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl text-[0.86rem] font-bold disabled:opacity-50 ${PRESSABLE}`}
          style={{ color: 'var(--accent)' }}>
          <Plus size={16} aria-hidden="true" />{t('nutr_add')}
        </button>
        {entries.length === 0 && (
          <button type="button" onClick={onCopyYesterday} disabled={busy}
            className={`flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-[0.8rem] font-semibold disabled:opacity-50 ${PRESSABLE}`}
            style={dim}>
            <Copy size={14} aria-hidden="true" />{t('nutr_copy_yesterday')}
          </button>
        )}
      </div>
    </section>
  )
}
