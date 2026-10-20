import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, PenLine, Star, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Sheet } from './Panel'
import { MAX_AMOUNT, MEALS, type Food, type Meal, amountValid, macroMismatch, nutrientsFor, parseAmount, showDecimal } from '../lib/nutrition'
import { portionsText } from '../lib/recipe'
import { ERROR_TEXT, MUTED, WARN_BOX, chip } from '../styles'
import { SheetClose } from '../../../components/ui/SheetClose'
import { MacroCells } from './MacroCells'
import { FoodOrb, type FoodOrbHandle } from './FoodOrb'
import { FLIGHT_MS, setOrbOrigin, setOrbPreview } from '../lib/orbBridge'
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
export function PortionSheet({ food, meal: startMeal, startAmount, mode, pickLabel, busy, onSave, onClose, onDelete, onCorrect, onToggleFavorite, hideKcal, goalKcal, preview = false }: {
  food: Food
  meal: Meal
  startAmount?: number
  mode: 'add' | 'edit' | 'ingredient'
  /** Beschriftung des Knopfs im Modus `ingredient` (Standard: „Zum Gericht"). */
  pickLabel?: string
  busy: boolean
  hideKcal: boolean
  /** Gibt false zurück, wenn das Speichern scheiterte (dann bleibt die Essens-Kugel voll und es fliegt nichts). */
  onSave: (amount: number, meal: Meal) => Promise<boolean> | void
  onClose: () => void
  onDelete?: () => void
  /** Werte dieses Lebensmittels korrigieren (wird zur eigenen Fassung) bzw. das Gericht bearbeiten. */
  onCorrect?: () => void
  onToggleFavorite?: () => void
  /** Tagesziel: Größe der Essens-Kugel im Verhältnis zur Tageskugel. */
  goalKcal: number
  /** Nur beim Eintragen für den gezeigten Tag: die Tageskugel oben zeigt diese Portion als Vorschau. */
  preview?: boolean
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
  const orb = useRef<FoodOrbHandle>(null)
  /** Punkte fliegen gerade aus der Essens-Kugel in die Tageskugel: erst danach wieder schließen oder hinzufügen. */
  const [flying, setFlying] = useState(false)
  const flyTimer = useRef(0)
  useEffect(() => () => window.clearTimeout(flyTimer.current), [])

  // Vorschau in der Tageskugel oben; während des Flugs und beim Schließen aus.
  useEffect(() => {
    setOrbPreview(preview && nu && !flying ? { kcal: nu.kcal, protein: nu.protein, carbs: nu.carbs, fat: nu.fat } : null)
  }, [preview, nu, flying])
  useEffect(() => () => setOrbPreview(null), [])

  /**
   * Eintragen: Die Punkte fliegen aus der Essens-Kugel (sie leert sich von oben)
   * in die Tageskugel. Das Formular bleibt offen; bis alle angekommen sind, sind
   * Hinzufügen und Schließen gesperrt — danach noch einmal oder schließen.
   */
  const save = async () => {
    if (!valid || busy || flying) return
    if (mode !== 'add') { await onSave(amount, meal); return }
    setOrbOrigin(orb.current?.origin() ?? null)
    setFlying(true)
    if ((await onSave(amount, meal)) === false) {
      setOrbOrigin(null)
      setFlying(false)
      return
    }
    // Gespeichert: jetzt startet der Flug oben — die Essens-Kugel leert sich im selben Takt.
    orb.current?.pour(460, FLIGHT_MS)
    flyTimer.current = window.setTimeout(() => setFlying(false), FLIGHT_MS)
  }
  const servings = portion ? [] : food.serving ? [{ amount: food.serving.amount, text: food.serving.label ? `${food.serving.label}` : `1 × ${food.serving.amount} ${food.unit}` }] : []

  return (
    <Sheet labelledBy="nutr-portion-title" busy={busy || flying} onClose={onClose}>
      <div className="flex items-start justify-between gap-2">
        {/* Die Kugel dieses Essens: gleiche Punktdichte wie die Tageskugel (ein ganzer Tag wäre so groß wie sie). */}
        <FoodOrb ref={orb} values={nu ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 }} goalKcal={goalKcal} size={96} fullFrac={0.73} />
        <div className="min-w-0 flex-1 self-center">
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
          <SheetClose onClick={onClose} disabled={busy || flying} />
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
        <button type="button" className="lg-btn lg-btn-primary flex-1 !px-4" disabled={!valid || busy || flying} onClick={() => void save()}>
          {flying ? t('nutr_adding') : mode === 'edit' ? t('nutr_save') : mode === 'ingredient' ? (pickLabel ?? t('nutr_add_to_dish')) : t('nutr_add')}
        </button>
      </div>
    </Sheet>
  )
}
