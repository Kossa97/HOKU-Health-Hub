import { useMemo, useState } from 'react'
import { AlertTriangle, PenLine, Star, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Sheet } from '../../compliance/components/Sheet'
import { MAX_AMOUNT, MEALS, type Food, type Meal, amountValid, macroMismatch, nutrientsFor, parseAmount } from '../lib/nutrition'
import { ERROR_TEXT, MACRO_COLORS, MUTED, WARN_BOX, chip } from '../styles'
import { SheetClose } from '../../../components/ui/SheetClose'
import { SourceBadge } from './SourceBadge'

const PRESETS = [50, 100, 150, 200, 250]

/**
 * Menge wählen. Das Feld hält Text und wird erst beim Speichern geprüft — ein
 * halb getipptes „2," setzt nichts zurück (Klage über Yazio: Menge springt zurück).
 */
export function PortionSheet({ food, meal: startMeal, startAmount, mode, busy, onSave, onClose, onDelete, onCorrect, onToggleFavorite, hideKcal }: {
  food: Food
  meal: Meal
  startAmount?: number
  mode: 'add' | 'edit'
  busy: boolean
  hideKcal: boolean
  onSave: (amount: number, meal: Meal) => void
  onClose: () => void
  onDelete?: () => void
  /** Werte dieses Lebensmittels korrigieren (wird zur eigenen Fassung). */
  onCorrect?: () => void
  onToggleFavorite?: () => void
}) {
  const { t } = useTranslation()
  const [text, setText] = useState(String(startAmount ?? food.serving?.amount ?? 100))
  const [meal, setMeal] = useState<Meal>(startMeal)
  const amount = parseAmount(text)
  const valid = amountValid(amount)
  const nu = useMemo(() => (valid ? nutrientsFor(food.per100, amount) : null), [food, amount, valid])
  const suspicious = macroMismatch(food.per100)
  const servings = food.serving ? [{ amount: food.serving.amount, text: food.serving.label ? `${food.serving.label}` : `1 × ${food.serving.amount} ${food.unit}` }] : []

  const cells = [
    ...(hideKcal ? [] : [{ key: 'kcal', value: nu?.kcal, unit: '', name: 'kcal', color: MACRO_COLORS.kcal }]),
    { key: 'p', value: nu?.protein, unit: ' g', name: t('nutr_protein'), color: MACRO_COLORS.protein },
    { key: 'c', value: nu?.carbs, unit: ' g', name: t('nutr_carbs_short'), color: MACRO_COLORS.carbs },
    { key: 'f', value: nu?.fat, unit: ' g', name: t('nutr_fat'), color: MACRO_COLORS.fat },
  ]

  return (
    <Sheet labelledBy="nutr-portion-title" busy={busy} onClose={onClose}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 id="nutr-portion-title" className="lg-title2">{food.name}</h2>
          <p className={`mt-1 flex items-center gap-1.5 text-[13px] ${MUTED}`}>
            <SourceBadge source={food.source} own={food.itemId !== null} />
            <span className="truncate">
              {[food.brand, hideKcal ? null : t('nutr_per100', { kcal: Math.round(food.per100.kcal), unit: food.unit })].filter(Boolean).join(' · ')}
            </span>
          </p>
        </div>
        <div className="flex shrink-0">
          {onToggleFavorite && (
            <button type="button" onClick={onToggleFavorite} disabled={busy} aria-pressed={food.favorite}
              aria-label={t(food.favorite ? 'nutr_unfavorite' : 'nutr_favorite')}
              className="lg-icon-btn">
              <Star size={20} className={food.favorite ? 'fill-[#ffd60a] text-[#ffd60a]' : 'text-[var(--lg-text-2)]'} />
            </button>
          )}
          <SheetClose onClick={onClose} disabled={busy} />
        </div>
      </div>

      {suspicious && (
        <div className={`mt-3 ${WARN_BOX}`}>
          <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--lg-warn-text)]" />
          <span>{t('nutr_mismatch')}</span>
        </div>
      )}

      <label htmlFor="nutr-amount" className="label mt-4">{t('nutr_amount', { unit: food.unit })}</label>
      <input id="nutr-amount" inputMode="decimal" enterKeyHint="done" value={text} autoFocus={mode === 'add'}
        onChange={e => setText(e.target.value)} onFocus={e => e.currentTarget.select()}
        onKeyDown={e => { if (e.key === 'Enter' && valid && !busy) onSave(amount, meal) }}
        aria-invalid={!valid} aria-describedby={!valid ? 'nutr-amount-error' : undefined}
        className="input !text-[20px] font-semibold tabular-nums" />
      {!valid && text.trim() !== '' && (
        <p id="nutr-amount-error" role="alert" className={`mt-1.5 px-1 ${ERROR_TEXT}`}>
          {t('nutr_amount_invalid', { max: MAX_AMOUNT, unit: food.unit })}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {servings.map(s => (
          <button key="serving" type="button" onClick={() => setText(String(s.amount))} aria-pressed={amount === s.amount} className={chip(amount === s.amount)}>{s.text}</button>
        ))}
        {PRESETS.filter(p => !servings.some(s => s.amount === p)).map(p => (
          <button key={p} type="button" onClick={() => setText(String(p))} aria-pressed={amount === p} className={chip(amount === p)}>{p} {food.unit}</button>
        ))}
      </div>

      <div className={`mt-4 grid gap-2 ${cells.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`} aria-live="polite">
        {cells.map(c => (
          <div key={c.key} className="min-w-0 rounded-[14px] bg-[var(--lg-surface-2)] px-1 py-2.5 text-center">
            <div className="text-[17px] font-semibold tabular-nums text-[var(--lg-text)]">{c.value == null ? '–' : `${Math.round(c.value)}${c.unit}`}</div>
            <div className={`mt-0.5 flex items-center justify-center gap-1 text-[12px] leading-tight ${MUTED}`}>
              <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c.color }} />
              <span className="truncate">{c.name}</span>
            </div>
          </div>
        ))}
      </div>

      <p className="label mt-4" id="nutr-meal-label">{t('nutr_meal')}</p>
      <div role="radiogroup" aria-labelledby="nutr-meal-label" className="flex flex-wrap gap-1.5">
        {MEALS.map(m => (
          <button key={m} type="button" role="radio" aria-checked={meal === m} onClick={() => setMeal(m)}
            className={chip(meal === m)}>
            {t(`nutr_meal_${m}`)}
          </button>
        ))}
      </div>

      <div className="mt-5 flex gap-2">
        {mode === 'edit' && onDelete && (
          <button type="button" onClick={onDelete} disabled={busy} aria-label={t('nutr_delete')}
            data-tone="bad" className="lg-gray-btn !min-h-12 !w-12 shrink-0 !px-0">
            <Trash2 size={18} />
          </button>
        )}
        {onCorrect && (
          <button type="button" onClick={onCorrect} disabled={busy}
            data-quiet className={`lg-gray-btn !min-h-12 ${suspicious ? 'flex-1' : '!w-12 shrink-0 !px-0'}`}>
            <PenLine size={15} aria-hidden="true" />{suspicious ? t('nutr_correct') : <span className="sr-only">{t('nutr_correct')}</span>}
          </button>
        )}
        <button type="button" className="lg-btn lg-btn-primary flex-1 !px-4" disabled={!valid || busy} onClick={() => onSave(amount, meal)}>
          {mode === 'edit' ? t('nutr_save') : t('nutr_add')}
        </button>
      </div>
    </Sheet>
  )
}
