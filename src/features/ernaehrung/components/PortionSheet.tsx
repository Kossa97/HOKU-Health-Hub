import { useMemo, useState } from 'react'
import { AlertTriangle, PenLine, Star, Trash2, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Sheet } from '../../compliance/components/Sheet'
import { MAX_AMOUNT, MEALS, type Food, type Meal, amountValid, macroMismatch, nutrientsFor, parseAmount } from '../lib/nutrition'
import { MACRO_COLORS, PRESSABLE, chip, dim, input, label, muted } from '../styles'
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
          <h2 id="nutr-portion-title" className="text-lg font-extrabold leading-snug" style={{ color: 'var(--text)' }}>{food.name}</h2>
          <p className="mt-0.5 flex items-center gap-1.5 text-[0.78rem]" style={muted}>
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
              className={`grid h-11 w-11 place-items-center rounded-xl ${PRESSABLE}`}>
              <Star size={19} style={food.favorite ? { color: 'var(--cat-amber)', fill: 'var(--cat-amber)' } : dim} />
            </button>
          )}
          <button type="button" data-app-back-close aria-label={t('close')} onClick={onClose} disabled={busy}
            className={`grid h-11 w-11 place-items-center rounded-xl ${PRESSABLE}`} style={dim}><X size={20} /></button>
        </div>
      </div>

      {suspicious && (
        <div className="mt-3 flex gap-2 rounded-xl p-2.5 text-[0.78rem]" style={{ background: 'color-mix(in srgb, var(--cat-amber) 12%, transparent)', color: 'var(--text-dim)' }}>
          <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0" style={{ color: 'var(--cat-amber)' }} />
          <span>{t('nutr_mismatch')}</span>
        </div>
      )}

      <label htmlFor="nutr-amount" className="mt-4 block" style={label}>{t('nutr_amount', { unit: food.unit })}</label>
      <input id="nutr-amount" inputMode="decimal" enterKeyHint="done" value={text} autoFocus={mode === 'add'}
        onChange={e => setText(e.target.value)} onFocus={e => e.currentTarget.select()}
        onKeyDown={e => { if (e.key === 'Enter' && valid && !busy) onSave(amount, meal) }}
        aria-invalid={!valid} aria-describedby={!valid ? 'nutr-amount-error' : undefined}
        className="mt-1.5" style={{ ...input, fontSize: 20, fontWeight: 800 }} />
      {!valid && text.trim() !== '' && (
        <p id="nutr-amount-error" role="alert" className="mt-1 text-[0.76rem]" style={{ color: 'var(--cat-rose)' }}>
          {t('nutr_amount_invalid', { max: MAX_AMOUNT, unit: food.unit })}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {servings.map(s => (
          <button key="serving" type="button" onClick={() => setText(String(s.amount))} className={PRESSABLE} style={chip(amount === s.amount)}>{s.text}</button>
        ))}
        {PRESETS.filter(p => !servings.some(s => s.amount === p)).map(p => (
          <button key={p} type="button" onClick={() => setText(String(p))} className={PRESSABLE} style={chip(amount === p)}>{p} {food.unit}</button>
        ))}
      </div>

      <div className={`mt-4 grid gap-2 ${cells.length === 4 ? 'grid-cols-4' : 'grid-cols-3'}`} aria-live="polite">
        {cells.map(c => (
          <div key={c.key} className="min-w-0 overflow-hidden rounded-xl pb-2 text-center" style={{ background: 'var(--surface-input)', border: '1px solid var(--border)' }}>
            <div className="h-[3px]" style={{ background: c.color }} aria-hidden="true" />
            <div className="mt-1.5 text-[1rem] font-extrabold tabular-nums" style={{ color: 'var(--text)' }}>{c.value == null ? '–' : `${Math.round(c.value)}${c.unit}`}</div>
            <div className="mt-0.5 px-0.5 text-[0.66rem] font-semibold leading-tight" style={muted}>{c.name}</div>
          </div>
        ))}
      </div>

      <p className="mt-4" style={label} id="nutr-meal-label">{t('nutr_meal')}</p>
      <div role="radiogroup" aria-labelledby="nutr-meal-label" className="mt-1.5 flex flex-wrap gap-1.5">
        {MEALS.map(m => (
          <button key={m} type="button" role="radio" aria-checked={meal === m} onClick={() => setMeal(m)}
            className={PRESSABLE} style={chip(meal === m)}>
            {t(`nutr_meal_${m}`)}
          </button>
        ))}
      </div>

      <div className="mt-5 flex gap-2">
        {mode === 'edit' && onDelete && (
          <button type="button" onClick={onDelete} disabled={busy} aria-label={t('nutr_delete')}
            className={`grid h-11 w-12 shrink-0 place-items-center rounded-xl ${PRESSABLE}`}
            style={{ border: '1px solid var(--border-strong)', color: 'var(--cat-rose)' }}>
            <Trash2 size={18} />
          </button>
        )}
        {onCorrect && (
          <button type="button" onClick={onCorrect} disabled={busy}
            className={`btn-secondary flex items-center justify-center gap-1.5 ${suspicious ? 'flex-1' : ''}`}>
            <PenLine size={15} aria-hidden="true" />{suspicious ? t('nutr_correct') : <span className="sr-only">{t('nutr_correct')}</span>}
          </button>
        )}
        <button type="button" className="btn-primary flex-1" disabled={!valid || busy} onClick={() => onSave(amount, meal)}>
          {mode === 'edit' ? t('nutr_save') : t('nutr_add')}
        </button>
      </div>
    </Sheet>
  )
}
