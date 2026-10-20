import { useMemo, useRef, useState } from 'react'
import { AlertTriangle, PenLine, Star, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Sheet } from '../../compliance/components/Sheet'
import { MAX_AMOUNT, MEALS, type Food, type Goals, type Meal, amountValid, macroMismatch, nutrientsFor, parseAmount, showDecimal } from '../lib/nutrition'
import { portionsText } from '../lib/recipe'
import { ERROR_TEXT, MUTED, WARN_BOX, chip } from '../styles'
import { SheetClose } from '../../../components/ui/SheetClose'
import { MacroCells } from './MacroCells'
import { PortionOrb, type PortionOrbHandle } from './PortionOrb'
import type { DayTotals } from '../lib/dayRings'
import { SourceBadge } from './SourceBadge'
import { ScoreBadge } from './ScoreBadge'

const PRESETS = [50, 100, 150, 200, 250]
/** Bei Gerichten wählt man Portionen statt Gramm. */
const PORTION_PRESETS = [{ n: 0.5, text: '½' }, { n: 1, text: '1' }, { n: 1.5, text: '1½' }, { n: 2, text: '2' }]

/**
 * Menge wählen. Das Feld hält Text und wird erst beim Speichern geprüft — ein
 * halb getipptes „2," setzt nichts zurück (Klage über Yazio: Menge springt zurück).
 * Bei Gerichten steht im Feld die Zahl der Portionen; gespeichert wird immer in Gramm.
 * `ingredient`: Menge einer Zutat fürs Gericht — ohne Mahlzeit.
 */
export function PortionSheet({ food, meal: startMeal, startAmount, mode, pickLabel, busy, onSave, onClose, onDelete, onCorrect, onToggleFavorite, hideKcal, day }: {
  food: Food
  meal: Meal
  startAmount?: number
  mode: 'add' | 'edit' | 'ingredient'
  /** Beschriftung des Knopfs im Modus `ingredient` (Standard: „Zum Gericht"). */
  pickLabel?: string
  busy: boolean
  hideKcal: boolean
  /** Gibt false zurück, wenn das Speichern scheiterte (dann springt die Kugel zurück zur Vorschau). */
  onSave: (amount: number, meal: Meal) => Promise<boolean> | void
  onClose: () => void
  onDelete?: () => void
  /** Werte dieses Lebensmittels korrigieren (wird zur eigenen Fassung) bzw. das Gericht bearbeiten. */
  onCorrect?: () => void
  onToggleFavorite?: () => void
  /** Nur beim Eintragen: Tagesstand und Ziele für die Kugel mit Vorschau oben im Blatt. */
  day?: { total: DayTotals; goals: Goals }
}) {
  const { t, i18n } = useTranslation()
  const lang = i18n.language ?? 'de'
  const portion = food.recipe && food.serving ? food.serving.amount : null
  const [initialText] = useState(() => portion
    ? showDecimal(startAmount ? portionsText(startAmount, portion) : 1, lang)
    : String(startAmount ?? food.serving?.amount ?? 100))
  const [text, setText] = useState(initialText)
  const [meal, setMeal] = useState<Meal>(startMeal)
  const typed = parseAmount(text)
  // Unverändert gelassen: genau die alte Menge — „0,33 Portionen" zurückgerechnet wären 99 statt 100 g.
  const amount = !portion ? typed : startAmount && text === initialText ? startAmount : Math.round(typed * portion * 10) / 10
  const valid = amountValid(amount)
  const nu = useMemo(() => (valid ? nutrientsFor(food.per100, amount) : null), [food, amount, valid])
  // Bei Gerichten stammen die Werte aus den Zutaten — dort gäbe es keine Packung zum Vergleichen.
  const suspicious = !food.recipe && macroMismatch(food.per100)
  const orb = useRef<PortionOrbHandle>(null)
  const [settling, setSettling] = useState(false)
  /** Eintragen: erst rastet die Vorschau in der Kugel ein, dann wird gespeichert. */
  const save = async () => {
    if (!valid || busy || settling) return
    const settled = mode === 'add' && orb.current
    if (settled) {
      setSettling(true)
      try { await orb.current!.settle() } finally { setSettling(false) }
    }
    if ((await onSave(amount, meal)) === false && settled) orb.current?.revert()
  }
  const servings = portion ? [] : food.serving ? [{ amount: food.serving.amount, text: food.serving.label ? `${food.serving.label}` : `1 × ${food.serving.amount} ${food.unit}` }] : []

  return (
    <Sheet labelledBy="nutr-portion-title" busy={busy} onClose={onClose}>
      {mode === 'add' && day && (
        <PortionOrb handle={orb} day={day.total} goals={day.goals} add={nu && { kcal: nu.kcal, protein: nu.protein, carbs: nu.carbs, fat: nu.fat }} />
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {/* Abzeichen neben, nicht in der Überschrift: sie benennt das Blatt. */}
          <div className="flex items-center gap-2.5">
            <h2 id="nutr-portion-title" className="lg-title2 min-w-0">{food.name}</h2>
            <ScoreBadge per100={food.per100} unit={food.unit} size="lg" />
          </div>
          <p className={`mt-1 flex items-center gap-1.5 text-[13px] ${MUTED}`}>
            <SourceBadge source={food.source} own={food.itemId !== null} />
            <span className="truncate">
              {portion && food.recipe
                ? t('nutr_dish_ingredient_count', { count: food.recipe.ingredients.length })
                : [food.brand, hideKcal ? null : t('nutr_per100', { kcal: Math.round(food.per100.kcal), unit: food.unit })].filter(Boolean).join(' · ')}
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

      <label htmlFor="nutr-amount" className="label mt-4">
        {portion ? t('nutr_portions_amount', { amount: Math.round(portion) }) : t('nutr_amount', { unit: food.unit })}
      </label>
      <input id="nutr-amount" inputMode="decimal" enterKeyHint="done" value={text} autoFocus={mode !== 'edit'}
        onChange={e => setText(e.target.value)} onFocus={e => e.currentTarget.select()}
        onKeyDown={e => { if (e.key === 'Enter') void save() }}
        aria-invalid={!valid} aria-describedby={!valid ? 'nutr-amount-error' : undefined}
        className="input !text-[20px] font-semibold tabular-nums" />
      {!valid && text.trim() !== '' && (
        <p id="nutr-amount-error" role="alert" className={`mt-1.5 px-1 ${ERROR_TEXT}`}>
          {portion
            ? t('nutr_amount_invalid', { max: Math.floor((MAX_AMOUNT / portion) * 10) / 10, unit: t('nutr_dish_portions') })
            : t('nutr_amount_invalid', { max: MAX_AMOUNT, unit: food.unit })}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {servings.map(s => (
          <button key="serving" type="button" onClick={() => setText(String(s.amount))} aria-pressed={amount === s.amount} className={chip(amount === s.amount)}>{s.text}</button>
        ))}
        {portion && PORTION_PRESETS.map(p => (
          <button key={p.text} type="button" onClick={() => setText(showDecimal(p.n, lang))} aria-pressed={typed === p.n} className={chip(typed === p.n)}>{p.text}</button>
        ))}
        {!portion && PRESETS.filter(p => !servings.some(s => s.amount === p)).map(p => (
          <button key={p} type="button" onClick={() => setText(String(p))} aria-pressed={amount === p} className={chip(amount === p)}>{p} {food.unit}</button>
        ))}
      </div>

      <div className="mt-4"><MacroCells nutrients={nu} hideKcal={hideKcal} /></div>

      {mode !== 'ingredient' && (
        <>
          <p className="label mt-4" id="nutr-meal-label">{t('nutr_meal')}</p>
          <div role="radiogroup" aria-labelledby="nutr-meal-label" className="flex flex-wrap gap-1.5">
            {MEALS.map(m => (
              <button key={m} type="button" role="radio" aria-checked={meal === m} onClick={() => setMeal(m)}
                className={chip(meal === m)}>
                {t(`nutr_meal_${m}`)}
              </button>
            ))}
          </div>
        </>
      )}

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
            <PenLine size={15} aria-hidden="true" />
            {suspicious ? t('nutr_correct') : <span className="sr-only">{t(portion ? 'nutr_dish_edit' : 'nutr_correct')}</span>}
          </button>
        )}
        <button type="button" className="lg-btn lg-btn-primary flex-1 !px-4" disabled={!valid || busy || settling} onClick={() => void save()}>
          {mode === 'edit' ? t('nutr_save') : mode === 'ingredient' ? (pickLabel ?? t('nutr_add_to_dish')) : t('nutr_add')}
        </button>
      </div>
    </Sheet>
  )
}
