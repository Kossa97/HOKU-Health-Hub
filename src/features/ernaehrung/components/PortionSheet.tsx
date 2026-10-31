import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, ChevronsUpDown, Info, Minus, PenLine, Plus, Star, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Sheet } from './Panel'
import { MAX_AMOUNT, MEALS, type Food, type Meal, amountValid, macroMismatch, nutrientsFor, parseAmount, showDecimal } from '../lib/nutrition'
import { pieceFor } from '../lib/pieces'
import { nutritionScore } from '../lib/rating'
import { usePrefersReducedMotion } from '../lib/orbZone'
import { ERROR_TEXT, MUTED, WARN_BOX } from '../styles'
import { SheetClose } from '../../../components/ui/SheetClose'
import { MacroCells } from './MacroCells'
import { FoodOrb, type FoodOrbHandle } from './FoodOrb'
import { FLIGHT_MS, setOrbOrigin, setOrbPreview } from '../lib/orbBridge'
import { SourceBadge } from './SourceBadge'
import { ScoreBadge } from './ScoreBadge'
import { ScoreInfo } from './ScoreInfo'

/** Zahl fürs Feld, auf Deutsch mit Komma: g/ml mit zwei, kg/l mit vier Nachkommastellen (82,5 g = 0,0825 kg). */
const shown = (n: number, lang: string, digits = 2) => showDecimal(Math.round(n * 10 ** digits) / 10 ** digits, lang)

/**
 * Bis die Seite oben steht: erst dann sieht man den Flug in die Tageskugel. Dauert das
 * sanfte Gleiten zu lange (lange Seite, langsames Gerät), springt sie nach `ms` ganz hin —
 * der Startpunkt des Flugs wird erst danach gemessen.
 */
function scrollToTop(smooth: boolean, ms = 900): Promise<void> {
  if (window.scrollY <= 1) return Promise.resolve()
  window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' })
  const t0 = performance.now()
  return new Promise(resolve => {
    const check = () => {
      if (window.scrollY <= 1) return resolve()
      if (performance.now() - t0 > ms) { window.scrollTo({ top: 0, behavior: 'auto' }); return resolve() }
      requestAnimationFrame(check)
    }
    requestAnimationFrame(check)
  })
}

/**
 * Menge wählen — kompakt, damit Formular und Hinzufügen unter die Tageskugel passen
 * und man den Flug sieht. Zwei verbundene Zeilen: „Menge“ (Zahl + Einheit g/kg bzw.
 * ml/l) und — wo zählbar — Portionen/Stück mit −/+. Wer tippt, behält seinen Text, das
 * andere Feld rechnet mit; gespeichert wird immer in g/ml. Halb getipptes („2,“) setzt
 * nichts zurück (Klage über Yazio: Menge springt zurück).
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
  const reduce = usePrefersReducedMotion()
  const dish = !!food.recipe && !!food.serving
  /** Eine Portion des Gerichts bzw. ein Stück (Ei, Scheibe, „1 Becher“) — oder nichts zum Zählen. */
  const piece = useMemo(() => (dish ? { kind: 'serving' as const, grams: food.serving!.amount, label: null } : pieceFor(food)), [food, dish])
  const per = piece?.grams ?? null

  // Eine Menge in g/ml; die Felder zeigen sie, bis man in eines tippt.
  const [grams, setGrams] = useState(() => startAmount ?? per ?? food.serving?.amount ?? 100)
  const [big, setBig] = useState(false)
  const [amountText, setAmountText] = useState<string | null>(null)
  const [countText, setCountText] = useState<string | null>(null)
  const [meal, setMeal] = useState<Meal>(startMeal)
  const [mealMenu, setMealMenu] = useState(false)
  const [info, setInfo] = useState(false)
  const factor = big ? 1000 : 1
  const unitLabel = big ? (food.unit === 'ml' ? 'l' : 'kg') : food.unit
  const amount = grams
  const valid = amountValid(amount)
  const count = per ? amount / per : null
  const shownCount = countText != null ? parseAmount(countText) : count

  const nu = useMemo(() => (valid ? nutrientsFor(food.per100, amount) : null), [food, amount, valid])
  // Bei Gerichten stammen die Werte aus den Zutaten — dort gäbe es keine Packung zum Vergleichen.
  const suspicious = !food.recipe && macroMismatch(food.per100)
  const hasScore = nutritionScore(food.per100, food.unit) != null
  const orb = useRef<FoodOrbHandle>(null)
  const mealRef = useRef<HTMLDivElement>(null)
  /** Punkte fliegen gerade aus der Essens-Kugel in die Tageskugel: erst danach wieder schließen oder hinzufügen. */
  const [flying, setFlying] = useState(false)
  const flyTimer = useRef(0)
  useEffect(() => () => window.clearTimeout(flyTimer.current), [])

  // Vorschau in der Tageskugel oben; während des Flugs und beim Schließen aus.
  useEffect(() => {
    setOrbPreview(preview && nu && !flying ? { kcal: nu.kcal, protein: nu.protein, carbs: nu.carbs, fat: nu.fat } : null)
  }, [preview, nu, flying])
  useEffect(() => () => setOrbPreview(null), [])

  // Mahlzeit-Auswahl: ein Tipp daneben schließt sie.
  useEffect(() => {
    if (!mealMenu) return
    const outside = (e: PointerEvent) => { if (!mealRef.current?.contains(e.target as Node)) setMealMenu(false) }
    document.addEventListener('pointerdown', outside, true)
    return () => document.removeEventListener('pointerdown', outside, true)
  }, [mealMenu])

  const typeAmount = (raw: string) => {
    setAmountText(raw)
    setCountText(null)
    const n = parseAmount(raw)
    setGrams(Number.isFinite(n) ? Math.round(n * factor * 10) / 10 : NaN)
  }
  const typeCount = (raw: string) => {
    if (!per) return
    setCountText(raw)
    setAmountText(null)
    const n = parseAmount(raw)
    setGrams(Number.isFinite(n) ? Math.round(n * per * 10) / 10 : NaN)
  }
  /** −/+ zählen ganze Stücke bzw. Portionen; unter 1 in Hälften. */
  const step = (dir: 1 | -1) => {
    if (!per) return
    const n = shownCount != null && Number.isFinite(shownCount) ? shownCount : 0
    const next = dir > 0 ? (n < 1 ? 1 : Math.floor(n) + 1) : (n > 1 ? Math.ceil(n) - 1 : 0.5)
    setCountText(null)
    setAmountText(null)
    setGrams(Math.round(next * per * 10) / 10)
  }

  /**
   * Eintragen: Die Punkte fliegen aus der Essens-Kugel (sie leert sich von oben)
   * in die Tageskugel. Steht die Seite nicht oben, gleitet sie erst hin — sonst läge
   * die Tageskugel unter dem Blatt. Das Formular bleibt offen; bis alle angekommen sind,
   * sind Hinzufügen und Schließen gesperrt — danach noch einmal oder schließen.
   */
  const save = async () => {
    if (!valid || busy || flying) return
    setMealMenu(false)
    if (mode !== 'add') {
      // Zutat für ein Gericht (mit Vorschau oben): ihre Punkte fliegen gleich in die Gericht-Kugel.
      // Solange die Seite hochgleitet, ist das Blatt gesperrt (kein Schließen, kein zweites Speichern).
      if (mode === 'ingredient' && preview) {
        setFlying(true)
        await scrollToTop(!reduce)
        setOrbOrigin(orb.current?.origin() ?? null)
      }
      await onSave(amount, meal)
      setFlying(false)
      return
    }
    setFlying(true)
    await scrollToTop(!reduce)
    setOrbOrigin(orb.current?.origin() ?? null)
    if ((await onSave(amount, meal)) === false) {
      setOrbOrigin(null)
      setFlying(false)
      return
    }
    // Gespeichert: jetzt startet der Flug oben — die Essens-Kugel leert sich im selben Takt.
    orb.current?.pour(460, FLIGHT_MS)
    flyTimer.current = window.setTimeout(() => setFlying(false), FLIGHT_MS)
  }

  const countWord = piece ? t(`nutr_count_word_${piece.kind}`, { count: shownCount != null && Number.isFinite(shownCount) ? shownCount : 1 }) : ''
  const pieceOne = piece ? (piece.label ?? t(`nutr_piece_${piece.kind}`, { count: 1, n: '1' })) : ''
  // Teile umbrechen nur zwischen, nie in sich („1 / Flasche = 330 g“).
  const details = [
    dish ? t('nutr_dish_ingredient_count', { count: food.recipe!.ingredients.length }) : hideKcal ? null : t('nutr_per100', { kcal: Math.round(food.per100.kcal), unit: food.unit }),
    piece ? `${pieceOne} = ${Math.round(piece.grams)} ${food.unit}` : null,
  ].filter((d): d is string => !!d)

  if (info) {
    return (
      <Sheet labelledBy="nutr-score-title" onClose={() => setInfo(false)}>
        <ScoreInfo per100={food.per100} unit={food.unit} name={food.name} onBack={() => setInfo(false)} />
      </Sheet>
    )
  }

  return (
    <Sheet labelledBy="nutr-portion-title" busy={busy || flying} onClose={onClose}>
      {/* Kugel · Name · Knöpfe; auf schmalen Geräten (iPhone SE) steht der Name darunter in voller Breite. */}
      <div className="grid grid-cols-[auto_1fr_auto] items-start gap-x-3">
        {/* Die Kugel dieses Essens: gleiche Punktdichte wie die Tageskugel (ein ganzer Tag wäre so groß wie sie). */}
        <FoodOrb ref={orb} values={nu ?? { kcal: 0, protein: 0, carbs: 0, fat: 0 }} goalKcal={goalKcal} size={64} fullFrac={0.73} spin />
        <div className="col-start-2 row-start-1 min-w-0 pt-1 max-[379px]:col-span-3 max-[379px]:col-start-1 max-[379px]:row-start-2 max-[379px]:mt-2 max-[379px]:pt-0">
          {/* Alles ausgeschrieben: der Name darf umbrechen (höchstens drei Zeilen), Abzeichen stehen darunter. */}
          <h2 id="nutr-portion-title" lang={lang} className="line-clamp-3 hyphens-auto text-[20px] font-medium leading-tight text-[var(--lg-text)] [overflow-wrap:anywhere]">{food.name}</h2>
          <div className={`mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] leading-snug ${MUTED}`}>
            {hasScore && (
              <span className="inline-flex items-center">
                <ScoreBadge per100={food.per100} unit={food.unit} size="lg" />
                <button type="button" onClick={() => { setMealMenu(false); setInfo(true) }} aria-label={t('nutr_score_info')} disabled={busy || flying}
                  className="-my-2 grid h-9 w-9 place-items-center text-[var(--lg-text-2)]">
                  <Info size={18} strokeWidth={1.5} aria-hidden="true" />
                </button>
              </span>
            )}
            <SourceBadge source={food.source} own={food.itemId !== null} long />
            {food.brand && <span>{food.brand}</span>}
          </div>
          {details.length > 0 && (
            <p className={`mt-1 flex flex-wrap gap-x-1 font-mono text-[12px] leading-snug tabular-nums ${MUTED}`}>
              {details.map((d, i) => <span key={d} className="whitespace-nowrap">{i > 0 && '· '}{d}</span>)}
            </p>
          )}
        </div>
        <div className="col-start-3 row-start-1 flex shrink-0 items-center">
          {onToggleFavorite && (
            <button type="button" onClick={onToggleFavorite} disabled={busy} aria-pressed={food.favorite}
              aria-label={t(food.favorite ? 'nutr_unfavorite' : 'nutr_favorite')}
              className="lg-icon-btn">
              <Star size={20} strokeWidth={1.5} className={food.favorite ? 'fill-current text-[var(--lg-text)]' : 'text-[var(--lg-text-2)]'} />
            </button>
          )}
          <SheetClose onClick={onClose} disabled={busy || flying} />
        </div>
      </div>

      {suspicious && (
        <div className={`mt-3 ${WARN_BOX}`}>
          <AlertTriangle size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--lg-warn-text)]" />
          <span className="min-w-0 flex-1">
            {t('nutr_mismatch')}
            {onCorrect && mode !== 'edit' && (
              <button type="button" onClick={onCorrect} disabled={busy} className="mt-1 block font-medium text-[var(--lg-accent-text)]">{t('nutr_correct')}</button>
            )}
          </span>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <label htmlFor="nutr-amount" className="w-[5.75rem] shrink-0 text-[16px] text-[var(--lg-text-2)]">{t('nutr_amount_label')}</label>
        <div className="input !flex !h-12 min-w-0 flex-1 items-center !p-0 focus-within:outline focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-[var(--accent)]">
          <input id="nutr-amount" inputMode="decimal" enterKeyHint="done" autoFocus={mode !== 'edit' && !per}
            aria-label={t('nutr_amount', { unit: unitLabel })}
            value={amountText ?? (Number.isFinite(amount) ? shown(amount / factor, lang, big ? 4 : 2) : '')}
            onChange={e => typeAmount(e.target.value)} onFocus={e => e.currentTarget.select()}
            onKeyDown={e => { if (e.key === 'Enter') void save() }}
            aria-invalid={!valid} aria-describedby={!valid ? 'nutr-amount-error' : undefined}
            className="h-full min-w-0 flex-1 bg-transparent pl-3 pr-1.5 text-right text-[20px] font-medium tabular-nums text-[var(--lg-text)] outline-none" />
          <span className="relative flex h-full shrink-0 items-center">
            <select aria-label={t('nutr_amount_unit')} value={big ? 'big' : 'base'}
              onChange={e => { setBig(e.target.value === 'big'); setAmountText(null) }}
              className="h-full appearance-none bg-transparent pl-0.5 pr-7 text-[17px] font-medium text-[var(--lg-accent-text)] outline-none">
              <option value="base">{food.unit}</option>
              <option value="big">{food.unit === 'ml' ? 'l' : 'kg'}</option>
            </select>
            <ChevronsUpDown size={14} aria-hidden="true" className="pointer-events-none absolute right-2.5 text-[var(--lg-accent-text)]" />
          </span>
        </div>
      </div>

      {piece && per && (
        <div className="mt-2 flex items-center gap-3">
          <label htmlFor="nutr-count" className="w-[5.75rem] shrink-0 text-[16px] leading-tight text-[var(--lg-text-2)]">
            {countWord}
            <span className={`block font-mono text-[12px] tabular-nums ${MUTED}`}>{t('nutr_count_each', { amount: Math.round(per), unit: food.unit })}</span>
          </label>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button type="button" onClick={() => step(-1)} aria-label={t('nutr_count_less')}
              disabled={shownCount != null && Number.isFinite(shownCount) && shownCount <= 0.5}
              className="lg-gray-btn !min-h-12 !w-12 shrink-0 !px-0"><Minus size={18} aria-hidden="true" /></button>
            <input id="nutr-count" inputMode="decimal" enterKeyHint="done"
              aria-label={dish ? t('nutr_portions_amount', { amount: Math.round(per) }) : t('nutr_count_amount', { one: pieceOne, amount: Math.round(per), unit: food.unit })}
              value={countText ?? (count != null && Number.isFinite(count) ? shown(count, lang) : '')}
              onChange={e => typeCount(e.target.value)} onFocus={e => e.currentTarget.select()}
              onKeyDown={e => { if (e.key === 'Enter') void save() }}
              className="input !h-12 min-w-0 flex-1 !px-2 text-center !text-[20px] font-medium tabular-nums" />
            <button type="button" onClick={() => step(1)} aria-label={t('nutr_count_more')}
              className="lg-gray-btn !min-h-12 !w-12 shrink-0 !px-0"><Plus size={18} aria-hidden="true" /></button>
          </div>
        </div>
      )}

      {!valid && (amountText ?? countText ?? 'x').trim() !== '' && (
        <p id="nutr-amount-error" role="alert" className={`mt-2 px-1 ${ERROR_TEXT}`}>
          {/* Grenze in der Einheit des Felds, in das man gerade tippt. */}
          {countText != null && per
            ? t('nutr_amount_invalid', { max: showDecimal(Math.floor((MAX_AMOUNT / per) * 10) / 10, lang), unit: t(`nutr_count_word_${piece!.kind}`, { count: 2 }) })
            : t('nutr_amount_invalid', { max: showDecimal(MAX_AMOUNT / factor, lang), unit: unitLabel })}
        </p>
      )}

      <div className="mt-4"><MacroCells nutrients={nu} hideKcal={hideKcal} compact /></div>

      <div className="mt-4 flex gap-2">
        {mode !== 'ingredient' && (
          <div ref={mealRef} className="relative shrink-0"
            onKeyDown={e => { if (e.key === 'Escape' && mealMenu) { e.stopPropagation(); setMealMenu(false) } }}>
            {mealMenu && (
              <div role="listbox" aria-label={t('nutr_meal')}
                className="absolute bottom-[calc(100%+8px)] left-0 z-10 flex w-52 flex-col gap-0.5 rounded-[14px] border border-[var(--lg-hair)] bg-[var(--lg-sheet-solid)] p-1 shadow-[0_12px_32px_rgba(0,0,0,0.45)]">
                {MEALS.map(m => (
                  <button key={m} type="button" role="option" aria-selected={meal === m}
                    onClick={() => { setMeal(m); setMealMenu(false) }}
                    className={`flex min-h-11 items-center justify-between rounded-[10px] px-3 text-left text-[16px] text-[var(--lg-text)] ${meal === m ? 'bg-[var(--lg-fill)]' : ''}`}>
                    {t(`nutr_meal_${m}`)}
                    {meal === m && <Check size={16} strokeWidth={2} aria-hidden="true" className="text-[var(--lg-accent-text)]" />}
                  </button>
                ))}
              </div>
            )}
            <button type="button" onClick={() => setMealMenu(v => !v)} aria-haspopup="listbox" aria-expanded={mealMenu}
              aria-label={`${t('nutr_meal')}: ${t(`nutr_meal_${meal}`)}`}
              className="lg-gray-btn !min-h-12 gap-1 !px-3 !text-[15px]">
              {t(`nutr_meal_${meal}`)}<ChevronsUpDown size={16} strokeWidth={1.5} aria-hidden="true" className="opacity-70" />
            </button>
          </div>
        )}
        {mode !== 'edit' && onCorrect && (
          <button type="button" onClick={onCorrect} disabled={busy} data-quiet aria-label={t(dish ? 'nutr_dish_edit' : 'nutr_correct')}
            className="lg-gray-btn !min-h-12 !w-12 shrink-0 !px-0">
            <PenLine size={16} aria-hidden="true" />
          </button>
        )}
        <button type="button" className="lg-btn lg-btn-primary min-w-0 flex-1 !px-4" disabled={!valid || busy || flying} onClick={() => void save()}>
          {flying ? t('nutr_adding') : mode === 'edit' ? t('nutr_save') : mode === 'ingredient' ? (pickLabel ?? t('nutr_add_to_dish')) : t('nutr_add')}
        </button>
      </div>

      {/* Beim Bearbeiten (kein Flug): Korrigieren und Löschen ausgeschrieben in einer eigenen Zeile. */}
      {mode === 'edit' && (onDelete || onCorrect) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {onCorrect && (
            <button type="button" onClick={onCorrect} disabled={busy} data-quiet className="lg-gray-btn !min-h-10 !px-3 !text-[14px]">
              <PenLine size={14} aria-hidden="true" />{t(dish ? 'nutr_dish_edit' : 'nutr_correct')}
            </button>
          )}
          {onDelete && (
            <button type="button" onClick={onDelete} disabled={busy} data-tone="bad" className="lg-gray-btn !min-h-10 !px-3 !text-[14px]">
              <Trash2 size={14} aria-hidden="true" />{t('nutr_delete')}
            </button>
          )}
        </div>
      )}
    </Sheet>
  )
}
