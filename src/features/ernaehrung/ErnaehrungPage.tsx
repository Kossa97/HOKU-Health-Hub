import { useState } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import { ChevronLeft, ChevronRight, ScanBarcode, Target, Trash2, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { getDateLocale } from '../../i18n/dateLocales'
import { Sheet } from '../compliance/components/Sheet'
import { AddFoodSheet } from './components/AddFoodSheet'
import { BarcodeScanner } from './components/BarcodeScanner'
import { DaySummary } from './components/DaySummary'
import { FoodEditorSheet } from './components/FoodEditorSheet'
import { GoalsSheet } from './components/GoalsSheet'
import { MealSection } from './components/MealSection'
import { PortionSheet } from './components/PortionSheet'
import { WaterCard } from './components/WaterCard'
import { WeekStrip } from './components/WeekStrip'
import { toDateKey, useNutritionDay } from './hooks/useNutritionDay'
import { foodFromEntry } from './lib/foodSearch'
import { MEALS, type Food, type LogEntry, type Meal, mealForHour } from './lib/nutrition'
import { LookupUnavailableError, lookupBarcode } from './services/foodLookup'
import { PRESSABLE, card, chip, dim, muted } from './styles'

type SheetState =
  | null
  | { kind: 'add'; meal: Meal }
  | { kind: 'scan'; meal: Meal }
  | { kind: 'portion'; meal: Meal; food: Food; amount?: number }
  | { kind: 'edit'; entry: LogEntry; food: Food }
  | { kind: 'quick'; entry: LogEntry }
  | { kind: 'editor'; meal: Meal; base: Food | null; name?: string; barcode: string | null; then: { entry?: LogEntry; amount?: number } }
  | { kind: 'goals' }

export function ErnaehrungPage() {
  const { user } = useAuth()
  const { t, i18n } = useTranslation()
  const locale = getDateLocale()
  const userId = user!.id
  const todayKey = toDateKey(new Date())
  const [date, setDate] = useState(todayKey)
  const isToday = date === todayKey
  const n = useNutritionDay(userId, date)
  const [sheet, setSheet] = useState<SheetState>(null)
  const [busy, setBusy] = useState(false)
  const lang = i18n.language?.startsWith('en') ? 'en' : 'de'

  /** Schreibvorgang mit Sperre und sichtbarem Fehler. Gibt false zurück, wenn er scheiterte. */
  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    try { await fn(); return true } catch { toast.error(t('nutr_error')); return false } finally { setBusy(false) }
  }

  const shiftDay = (days: number) => setDate(d => {
    const next = toDateKey(addDays(parseISO(d), days))
    return next > todayKey ? todayKey : next
  })

  /**
   * Ein Eintrag zeigt beim Bearbeiten SEINE Werte (Schnappschuss), nicht die
   * heutigen des Lebensmittels — sonst schriebe eine Mengenänderung alte Tage
   * still um. Von „Meine Lebensmittel" kommen nur Stern, Portion und Barcode.
   */
  const openEntry = (entry: LogEntry) => {
    const snapshot = foodFromEntry(entry)
    if (!snapshot) { setSheet({ kind: 'quick', entry }); return }
    const mine = entry.itemId ? n.myFoods.find(f => f.itemId === entry.itemId) : undefined
    const food = mine ? { ...snapshot, favorite: mine.favorite, serving: mine.serving, barcode: mine.barcode } : snapshot
    setSheet({ kind: 'edit', entry, food })
  }

  /** Hat der Nutzer im Bearbeiten die Werte korrigiert oder das Lebensmittel gemerkt? */
  const entryFoodChanged = (entry: LogEntry, food: Food) => {
    const snapshot = foodFromEntry(entry)
    return food.itemId !== entry.itemId || JSON.stringify(food.per100) !== JSON.stringify(snapshot?.per100)
  }

  const removeWithUndo = (entry: LogEntry) => run(async () => {
    await n.remove(entry)
    setSheet(null)
    toast(tt => (
      <span className="flex items-center gap-3">
        <span>{t('nutr_deleted', { name: entry.name })}</span>
        <button type="button" className="font-bold" style={{ color: 'var(--accent)' }}
          onClick={() => { toast.dismiss(tt.id); n.restore(entry).catch(() => toast.error(t('nutr_error'))) }}>
          {t('nutr_undo')}
        </button>
      </span>
    ), { duration: 6000 })
  })

  const handleBarcode = async (meal: Meal, code: string) => {
    const mine = n.findByBarcode(code)
    if (mine) { setSheet({ kind: 'portion', meal, food: mine }); return }
    setBusy(true)
    try {
      const found = await lookupBarcode(code, lang)
      if (found) setSheet({ kind: 'portion', meal, food: found })
      else {
        toast(t('nutr_barcode_unknown'))
        setSheet({ kind: 'editor', meal, base: null, barcode: code, then: {} })
      }
    } catch (error) {
      toast.error(t(error instanceof LookupUnavailableError ? 'nutr_lookup_unavailable' : 'nutr_error'))
      setSheet({ kind: 'add', meal })
    } finally {
      setBusy(false)
    }
  }

  /**
   * Merken (Stern): eigenes Lebensmittel umschalten bzw. fremdes als eigene
   * Fassung speichern. Bei eigenen wird die gespeicherte Fassung umgeschaltet,
   * nie der angezeigte (evtl. ältere) Schnappschuss zurückgeschrieben.
   */
  const toggleFavorite = (food: Food, rewrap: (f: Food) => SheetState) => run(async () => {
    const mine = food.itemId ? n.myFoods.find(f => f.itemId === food.itemId) : undefined
    const saved = await n.saveFood({ ...(mine ?? food), favorite: !food.favorite })
    setSheet(rewrap({ ...food, itemId: saved.itemId, favorite: saved.favorite }))
  })

  const meal0 = mealForHour(new Date().getHours())

  return (
    <div className="mx-auto max-w-lg px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-4">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-[1.45rem] font-extrabold" style={{ color: 'var(--text)' }}>{t('nutr_title')}</h1>
        <div className="flex gap-1">
          <button type="button" onClick={() => setSheet({ kind: 'scan', meal: isToday ? meal0 : 'snack' })} aria-label={t('nutr_scan')}
            className={`grid h-11 w-11 place-items-center rounded-xl ${PRESSABLE}`} style={{ color: 'var(--accent)' }}>
            <ScanBarcode size={21} />
          </button>
          <button type="button" onClick={() => setSheet({ kind: 'goals' })}
            className={`flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-[0.86rem] font-bold ${PRESSABLE}`} style={{ color: 'var(--accent)' }}>
            <Target size={17} aria-hidden="true" />{t('nutr_goals')}
          </button>
        </div>
      </header>

      <nav aria-label={t('nutr_day_nav')} className="mt-1 flex items-center justify-between">
        <button type="button" aria-label={t('nutr_prev_day')} onClick={() => shiftDay(-1)}
          className={`grid h-11 w-11 place-items-center rounded-xl ${PRESSABLE}`} style={dim}><ChevronLeft size={22} /></button>
        <button type="button" onClick={() => setDate(todayKey)} disabled={isToday} aria-live="polite"
          className="min-h-11 px-3 text-[0.95rem] font-bold disabled:cursor-default" style={{ color: 'var(--text)' }}>
          {isToday ? t('nutr_today') : date === toDateKey(addDays(new Date(), -1)) ? t('nutr_yesterday') : format(parseISO(date), 'EEEE, d. MMMM', { locale })}
        </button>
        <button type="button" aria-label={t('nutr_next_day')} onClick={() => shiftDay(1)} disabled={isToday}
          className={`grid h-11 w-11 place-items-center rounded-xl disabled:opacity-30 ${PRESSABLE}`} style={dim}><ChevronRight size={22} /></button>
      </nav>

      {n.loadError && (
        <div role="alert" className="mt-2 flex items-center justify-between gap-3 rounded-2xl p-3 text-[0.86rem]"
          style={{ background: 'color-mix(in srgb, var(--cat-rose) 10%, transparent)', border: '1px solid color-mix(in srgb, var(--cat-rose) 35%, transparent)', color: 'var(--text)' }}>
          {t('nutr_load_error')}
          <button type="button" className="btn-secondary shrink-0" onClick={n.reload}>{t('lab_retry')}</button>
        </div>
      )}

      {n.goalsSet === false && (
        <button type="button" onClick={() => setSheet({ kind: 'goals' })}
          className={`mt-2 w-full rounded-2xl p-3.5 text-left text-[0.86rem] ${PRESSABLE}`}
          style={{ background: 'var(--accent-weak)', border: '1px solid var(--accent-border)', color: 'var(--text)' }}>
          <b>{t('nutr_set_goals')}</b> <span style={dim}>{t('nutr_set_goals_hint')}</span>
        </button>
      )}

      <div className="mt-3 space-y-3">
        {n.day ? <DaySummary total={n.total} goals={n.goals} /> : <div className="h-[164px] animate-pulse" style={card} aria-hidden="true" />}

        {MEALS.map(meal => (
          <MealSection key={meal} meal={meal} entries={n.byMeal[meal]} hideKcal={n.goals.hideKcal} busy={busy || !n.day}
            onAdd={() => setSheet({ kind: 'add', meal })}
            onOpen={openEntry}
            onCopyYesterday={() => run(async () => {
              const count = await n.copyFromYesterday(meal)
              toast(count ? t('nutr_copied', { count }) : t('nutr_copy_empty'))
            })} />
        ))}

        {n.day && (
          <>
            <WaterCard ml={n.day.waterMl} goalMl={n.goals.waterMl}
              onChange={ml => { n.setWater(ml).catch(() => toast.error(t('nutr_error'))) }} />
            <WeekStrip date={date} week={n.day.week} goalKcal={n.goals.kcal} goalProtein={n.goals.proteinG}
              hideKcal={n.goals.hideKcal} onPick={setDate} />
          </>
        )}
      </div>

      <p className="mt-6 px-2 text-center text-[0.7rem] leading-relaxed" style={muted}>
        {t('nutr_credit_off')}{' '}
        <a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer" className="underline">Open Food Facts</a>
        {' '}(<a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer" className="underline">ODbL</a>).
        {' '}{t('nutr_credit_note')}
      </p>

      {sheet?.kind === 'add' && (
        <AddFoodSheet meal={sheet.meal} frequent={n.frequentFor(sheet.meal)} myFoods={n.myFoods} hideKcal={n.goals.hideKcal}
          onClose={() => setSheet(null)}
          onPick={(food, amount) => setSheet({ kind: 'portion', meal: sheet.meal, food, amount })}
          onScan={() => setSheet({ kind: 'scan', meal: sheet.meal })}
          onCreate={name => setSheet({ kind: 'editor', meal: sheet.meal, base: null, name, barcode: null, then: {} })}
          onQuick={async (kcal, protein) => {
            const ok = await run(async () => { await n.addQuick(sheet.meal, t('nutr_quick_name'), kcal, protein) })
            if (ok) { setSheet(null); toast.success(t('nutr_added')) }
          }} />
      )}

      {sheet?.kind === 'scan' && (
        <BarcodeScanner busy={busy} onClose={() => setSheet({ kind: 'add', meal: sheet.meal })} onCode={code => handleBarcode(sheet.meal, code)} />
      )}

      {sheet?.kind === 'portion' && (
        <PortionSheet key={`${sheet.food.sourceRef ?? sheet.food.name}-${JSON.stringify(sheet.food.per100)}`} mode="add" food={sheet.food} meal={sheet.meal} startAmount={sheet.amount}
          busy={busy} hideKcal={n.goals.hideKcal}
          onClose={() => setSheet({ kind: 'add', meal: sheet.meal })}
          onSave={(amount, meal) => run(async () => {
            await n.add(meal, sheet.food, amount)
            setSheet(null)
            toast.success(t('nutr_added'))
          })}
          onCorrect={() => setSheet({ kind: 'editor', meal: sheet.meal, base: sheet.food, barcode: sheet.food.barcode, then: { amount: sheet.amount } })}
          onToggleFavorite={() => toggleFavorite(sheet.food, food => ({ ...sheet, food }))} />
      )}

      {sheet?.kind === 'edit' && (
        <PortionSheet key={`${sheet.entry.id}-${JSON.stringify(sheet.food.per100)}`} mode="edit" food={sheet.food} meal={sheet.entry.meal}
          startAmount={sheet.entry.amount ?? undefined} busy={busy} hideKcal={n.goals.hideKcal}
          onClose={() => setSheet(null)}
          onSave={(amount, meal) => run(async () => {
            await n.update(sheet.entry, { amount, meal, food: entryFoodChanged(sheet.entry, sheet.food) ? sheet.food : undefined })
            setSheet(null)
          })}
          onDelete={() => removeWithUndo(sheet.entry)}
          onCorrect={() => setSheet({
            kind: 'editor', meal: sheet.entry.meal, barcode: sheet.food.barcode, then: { entry: sheet.entry },
            // Gibt es das Lebensmittel in „Meine", deren aktuelle Werte — nie den alten Schnappschuss zurückschreiben.
            base: n.myFoods.find(f => f.itemId && f.itemId === sheet.food.itemId) ?? sheet.food,
          })}
          onToggleFavorite={() => toggleFavorite(sheet.food, food => ({ ...sheet, food }))} />
      )}

      {sheet?.kind === 'quick' && (
        <Sheet labelledBy="nutr-quick-title" busy={busy} onClose={() => setSheet(null)}>
          <div className="flex items-center justify-between">
            <h2 id="nutr-quick-title" className="text-lg font-extrabold" style={{ color: 'var(--text)' }}>{sheet.entry.name}</h2>
            <button type="button" data-app-back-close aria-label={t('close')} onClick={() => setSheet(null)}
              className={`grid h-11 w-11 place-items-center rounded-xl ${PRESSABLE}`} style={dim}><X size={20} /></button>
          </div>
          <p className="mt-1 text-[0.86rem]" style={dim}>
            {n.goals.hideKcal ? '' : `${Math.round(sheet.entry.nutrients.kcal)} kcal · `}{Math.round(sheet.entry.nutrients.protein)} g {t('nutr_protein')}
          </p>
          <div role="radiogroup" aria-label={t('nutr_meal')} className="mt-4 flex flex-wrap gap-1.5">
            {MEALS.map(m => (
              <button key={m} type="button" role="radio" aria-checked={sheet.entry.meal === m} disabled={busy}
                onClick={() => run(async () => { await n.update(sheet.entry, { meal: m }); setSheet(null) })}
                className={PRESSABLE} style={chip(sheet.entry.meal === m)}>{t(`nutr_meal_${m}`)}</button>
            ))}
          </div>
          <button type="button" disabled={busy} onClick={() => removeWithUndo(sheet.entry)}
            className={`btn-secondary mt-5 flex w-full items-center justify-center gap-2 ${PRESSABLE}`} style={{ color: 'var(--cat-rose)' }}>
            <Trash2 size={16} aria-hidden="true" />{t('nutr_delete')}
          </button>
        </Sheet>
      )}

      {sheet?.kind === 'editor' && (
        <FoodEditorSheet base={sheet.base} initialName={sheet.name} barcode={sheet.barcode} busy={busy}
          onClose={() => {
            if (sheet.then.entry && sheet.base) setSheet({ kind: 'edit', entry: sheet.then.entry, food: sheet.base })
            else if (sheet.base) setSheet({ kind: 'portion', meal: sheet.meal, food: sheet.base, amount: sheet.then.amount })
            else setSheet({ kind: 'add', meal: sheet.meal })
          }}
          onSave={food => run(async () => {
            const saved = await n.saveFood(food)
            setSheet(sheet.then.entry
              ? { kind: 'edit', entry: sheet.then.entry, food: saved }
              : { kind: 'portion', meal: sheet.meal, food: saved, amount: sheet.then.amount })
          })} />
      )}

      {sheet?.kind === 'goals' && (
        <GoalsSheet userId={userId} today={todayKey} current={n.goals} busy={busy} onClose={() => setSheet(null)}
          onSave={g => run(async () => { await n.saveGoals(g); setSheet(null); toast.success(t('nutr_goals_saved')) })} />
      )}
    </div>
  )
}

export default ErnaehrungPage
