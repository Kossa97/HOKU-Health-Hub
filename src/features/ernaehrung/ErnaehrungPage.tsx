import { useEffect, useMemo, useRef, useState } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import { Target, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { readSharedDay, writeSharedDay } from '../../lib/sharedDay'
import { getDateLocale } from '../../i18n/dateLocales'
import { Sheet } from './components/Panel'
import { AddFoodSheet } from './components/AddFoodSheet'
import { BarcodeScanner } from './components/BarcodeScanner'
import { DaySummary } from './components/DaySummary'
import { DishStage } from './components/DishStage'
import { DishEditorSheet } from './components/DishEditorSheet'
import { FoodEditorSheet } from './components/FoodEditorSheet'
import { GoalsSheet } from './components/GoalsSheet'
import { pieceFor } from './lib/pieces'
import { MonthSheet } from './components/MonthSheet'
import { EntryRowContent, MealSection } from './components/MealSection'
import { type DropTarget, useEntryDrag } from './components/EntryDrag'
import { entryKey, keyAt, renumber } from './lib/entryOrder'
import { PhotoSheet } from './components/PhotoSheet'
import { SheetClose } from '../../components/ui/SheetClose'
import { PortionSheet } from './components/PortionSheet'
import { WaterCard } from './components/WaterCard'
import { WeekStrip } from './components/WeekStrip'
import { toDateKey, useNutritionDay } from './hooks/useNutritionDay'
import { type DishDraft, addToDraft, draftFromDish, draftFromIngredients } from './lib/dishDraft'
import { foodFromEntry } from './lib/foodSearch'
import { EMPTY_FLOW, type PhotoFlow, chooseFood } from './lib/photoRows'
import { MEALS, type Food, type LogEntry, type Meal, mealForHour } from './lib/nutrition'
import { type Ingredient, ingredientFromEntry, ingredientFromFood } from './lib/recipe'
import { LookupUnavailableError, lookupBarcode } from './services/foodLookup'
import { DIM, MUTED, chip } from './styles'

/**
 * Gericht bearbeiten. Nach dem Speichern: mit `meal` gleich eintragen, mit
 * `entry` zurück zu diesem Eintrag, sonst nur speichern. `back` = wohin „Schließen" führt.
 */
type DishSheet = { kind: 'dish'; draft: DishDraft; meal: Meal | null; entry?: LogEntry; back: SheetState }

/**
 * Essen per Foto: `flow` = Stand von Aufnahme, Auswahl und Zuordnung;
 * `row` = für welche Zeile gerade ein Lebensmittel gesucht wird (null = neue).
 */
type PhotoState = { kind: 'photo'; meal: Meal; flow: PhotoFlow; row: number | null }

/** `pick`: Wir suchen gerade ein Lebensmittel für ein Gericht bzw. eine Zeile der Foto-Prüfliste. */
type Picker = DishSheet | PhotoState

type SheetState =
  | null
  | { kind: 'add'; meal: Meal; pick?: Picker }
  | { kind: 'scan'; meal: Meal; pick?: Picker }
  | PhotoState
  /** `done`: hier wurde schon eingetragen — Schließen führt dann zurück zum Tag statt zur Suche. */
  | { kind: 'portion'; meal: Meal; food: Food; amount?: number; pick?: Picker; back?: SheetState; done?: boolean }
  | { kind: 'edit'; entry: LogEntry; food: Food }
  | { kind: 'quick'; entry: LogEntry }
  | { kind: 'editor'; meal: Meal; base: Food | null; name?: string; barcode: string | null; then: { entry?: LogEntry; amount?: number }; pick?: Picker }
  | DishSheet
  | { kind: 'goals' }
  | { kind: 'month' }

/** Das gewählte Lebensmittel mit Menge zurück an Gericht bzw. Foto-Prüfliste. */
function withPicked(pick: Picker, food: Food, amount: number, lang: string): SheetState {
  if (pick.kind === 'dish') return { ...pick, draft: addToDraft(pick.draft, food, amount, lang) }
  return { ...pick, row: null, flow: { ...pick.flow, rows: chooseFood(pick.flow.rows ?? [], pick.row, food, amount) } }
}

export function ErnaehrungPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const locale = getDateLocale()
  const userId = user!.id
  const todayKey = toDateKey(new Date())
  // Gemeinsamer Tag mit dem Kalender (siehe sharedDay.ts), nie in der Zukunft.
  const [date, setDate] = useState(() => {
    const shared = readSharedDay(todayKey)
    return shared && shared < todayKey ? shared : todayKey
  })
  /** Tag wechseln — nur hier wird der gemeinsame Tag geschrieben, nicht beim Öffnen (sonst ginge ein im Kalender gewählter künftiger Tag verloren). */
  const pickDate = (d: string) => {
    const next = d > todayKey ? todayKey : d
    setDate(next)
    writeSharedDay(next, todayKey)
  }
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

  /**
   * Ein Eintrag zeigt beim Bearbeiten SEINE Werte (Schnappschuss), nicht die
   * heutigen des Lebensmittels — sonst schriebe eine Mengenänderung alte Tage
   * still um. Von „Meine Lebensmittel" kommen nur Stern, Portion und Barcode.
   */
  const openEntry = (entry: LogEntry) => {
    const snapshot = foodFromEntry(entry)
    if (!snapshot) { setSheet({ kind: 'quick', entry }); return }
    const mine = entry.itemId ? n.myFoods.find(f => f.itemId === entry.itemId) : undefined
    const food = mine ? { ...snapshot, favorite: mine.favorite, serving: mine.serving, barcode: mine.barcode, recipe: mine.recipe } : snapshot
    setSheet({ kind: 'edit', entry, food })
  }

  /** Zählbar wie beim Bearbeiten: Portion aus „Meine Lebensmittel“, sonst nach dem Namen. */
  const pieceOf = (entry: LogEntry) => {
    const mine = entry.itemId ? n.myFoods.find(f => f.itemId === entry.itemId) : undefined
    return pieceFor({ name: entry.name, unit: entry.unit, serving: mine?.serving ?? null, recipe: mine?.recipe ?? null })
  }

  /**
   * Halten und Verschieben: an einen Platz einer Mahlzeit (gezeigter Tag) oder auf einen
   * Tag der Woche (dort ans Ende derselben Mahlzeit). Mahlzeit- oder Tageswechsel lassen
   * sich rückgängig machen; nur umsortiert gibt es keinen Hinweis.
   */
  const dropEntry = (entry: LogEntry, target: DropTarget) => {
    const list = target.kind === 'meal' ? n.byMeal[target.meal].filter(e => e.id !== entry.id) : []
    const key = target.kind === 'meal' ? keyAt(list, target.index) : keyAt([], 0)
    // Kein Platz zwischen den Nachbarn: die Mahlzeit bekommt neue, gleichmäßige Plätze.
    const spread = key == null && target.kind === 'meal' ? renumber(list, entry, target.index) : []
    const to = target.kind === 'meal'
      ? { date, meal: target.meal, sortKey: key ?? spread.find(u => u.id === entry.id)!.sortKey }
      // Auf einen anderen Tag: ans Ende derselben Mahlzeit (Schlüssel „jetzt“).
      : { date: target.date, meal: entry.meal, sortKey: key! }
    if (to.date === entry.date && to.meal === entry.meal && target.kind === 'day') return
    const back = { date: entry.date, meal: entry.meal, sortKey: entryKey(entry) }
    void run(async () => {
      const saved = await n.move(entry, to)
      const others = spread.filter(u => u.id !== entry.id)
      if (others.length) await n.setOrder(others)
      if (to.date === back.date && to.meal === back.meal) return
      const where = to.date !== back.date
        ? t('nutr_moved_day', { day: format(parseISO(to.date), 'EEEE, d. MMMM', { locale }) })
        : t('nutr_moved', { meal: t(`nutr_meal_${to.meal}`) })
      toast(tt => (
        <span className="flex items-center gap-3">
          <span>{where}</span>
          <button type="button" className="font-semibold text-[var(--lg-accent-text)]"
            onClick={() => {
              toast.dismiss(tt.id)
              // Den aktuellen Stand zurückschieben (falls inzwischen bearbeitet), sonst den gespeicherten.
              const now = entriesRef.current.find(e => e.id === saved.id) ?? saved
              n.move(now, back).catch(() => toast.error(t('nutr_error')))
            }}>
            {t('nutr_undo')}
          </button>
        </span>
      ), { duration: 6000 })
    })
  }
  const entriesRef = useRef<LogEntry[]>([])
  useEffect(() => { entriesRef.current = n.day?.entries ?? [] })
  const entryDrag = useEntryDrag({
    date,
    onDrop: dropEntry,
    onSpringDay: pickDate,
    renderGhost: entry => <EntryRowContent entry={entry} hideKcal={n.goals.hideKcal} goalKcal={n.goals.kcal} pieceOf={pieceOf} />,
  })
  const liftEntry = (entry: LogEntry, index: number, at: Parameters<typeof entryDrag.start>[2]) =>
    entryDrag.start(entry, { meal: entry.meal, index, date }, at)
  const dragFor = (meal: Meal) => entryDrag.drag && {
    id: entryDrag.drag.entry.id,
    height: entryDrag.drag.height,
    index: entryDrag.drag.target.kind === 'meal' && entryDrag.drag.target.meal === meal ? entryDrag.drag.target.index : null,
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
        <button type="button" className="font-semibold text-[var(--lg-accent-text)]"
          onClick={() => { toast.dismiss(tt.id); n.restore(entry).catch(() => toast.error(t('nutr_error'))) }}>
          {t('nutr_undo')}
        </button>
      </span>
    ), { duration: 6000 })
  })

  const handleBarcode = async (meal: Meal, code: string, pick?: Picker) => {
    const mine = n.findByBarcode(code)
    if (mine) { setSheet({ kind: 'portion', meal, food: mine, pick }); return }
    setBusy(true)
    try {
      const found = await lookupBarcode(code, lang)
      if (found) setSheet({ kind: 'portion', meal, food: found, pick })
      else {
        toast(t('nutr_barcode_unknown'))
        setSheet({ kind: 'editor', meal, base: null, barcode: code, then: {}, pick })
      }
    } catch (error) {
      toast.error(t(error instanceof LookupUnavailableError ? 'nutr_lookup_unavailable' : 'nutr_error'))
      setSheet({ kind: 'add', meal, pick })
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
  const myDishes = useMemo(() => n.myFoods.filter(f => f.recipe), [n.myFoods])

  /** Gericht bearbeiten — immer die gespeicherte Fassung, nie einen alten Schnappschuss. */
  const openDish = (dish: Food, rest: Omit<DishSheet, 'kind' | 'draft'>) => {
    const mine = n.myFoods.find(f => f.itemId && f.itemId === dish.itemId) ?? dish
    setSheet({ kind: 'dish', draft: draftFromDish(mine, lang), ...rest })
  }

  /** Gericht in Arbeit — im Editor oder beim Suchen einer Zutat dafür. */
  const dishOpen = sheet?.kind === 'dish' ? sheet : sheet && 'pick' in sheet && sheet.pick?.kind === 'dish' ? sheet.pick : null
  /** Aufgeklappte Zutat im Editor (ihre Punkte pulsieren oben); beim Zutat-Suchen zu. */
  const [dishFocus, setDishFocus] = useState<number | null>(null)

  /** „Als Gericht": die Einträge dieser Mahlzeit als Zutaten. Schnelleinträge haben keine Menge und fallen weg. */
  const saveMealAsDish = (meal: Meal) => {
    const ingredients = n.byMeal[meal].map(ingredientFromEntry).filter((i): i is Ingredient => i !== null)
    setSheet({ kind: 'dish', draft: draftFromIngredients(ingredients, lang, undefined, meal), meal: null, back: null })
  }

  return (
    <div className="mx-auto max-w-lg pb-6">
      <h1 className="sr-only">{t('nutr_title')}</h1>
      {/* Feste Kugel oben; alles Weitere — Tag oder Formular — läuft darunter. Beim Gericht (auch beim Zutat-Suchen) dessen Kugel. */}
      {dishOpen ? <DishStage draft={dishOpen.draft} goals={n.goals} focus={sheet?.kind === 'dish' ? dishFocus : null} /> : <DaySummary total={n.total} goals={n.goals} date={date} ready={!!n.day}
        onOpenGoals={() => setSheet({ kind: 'goals' })}
        // Zurück, woher man kam; direkt eingestiegen (kein Verlauf) zur Startseite.
        onClose={() => (typeof window.history.state?.idx === 'number' && window.history.state.idx > 0 ? navigate(-1) : navigate('/'))} />}

      {!sheet && (<>
      {n.loadError && (
        <div role="alert" className="mt-2 flex items-center justify-between gap-3 rounded-[18px] bg-[color-mix(in_srgb,var(--lg-bad)_14%,transparent)] p-3.5 text-[15px] text-[var(--lg-text)]">
          {t('nutr_load_error')}
          <button type="button" data-quiet className="lg-gray-btn shrink-0" onClick={n.reload}>{t('lab_retry')}</button>
        </div>
      )}

      {n.goalsSet === false && (
        <button type="button" onClick={() => setSheet({ kind: 'goals' })}
          className="lg-surface lg-flat mt-2 flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors active:bg-[var(--lg-surface-2)]">
          <span className="lg-icon-tile" style={{ background: 'var(--accent)', color: 'var(--accent-contrast)' }} aria-hidden="true"><Target size={17} /></span>
          <span className="min-w-0 flex-1 text-[15px] leading-snug">
            <span className="font-semibold text-[var(--lg-text)]">{t('nutr_set_goals')}</span>{' '}
            <span className={DIM}>{t('nutr_set_goals_hint')}</span>
          </span>
        </button>
      )}

      <div className="mt-3 space-y-3">
        {/* Bleibt beim Tageswechsel stehen; der gewählte Tag kommt live aus seinen Einträgen. */}
        <WeekStrip date={date} today={todayKey} week={{ ...n.week, ...(n.day ? { [date]: n.total } : {}) }} goals={n.goals}
          dayLabel={isToday
            ? `${t('nutr_today')}, ${format(parseISO(date), 'd. MMM', { locale })}`
            : date === toDateKey(addDays(new Date(), -1)) ? t('nutr_yesterday') : format(parseISO(date), 'EEEE, d. MMM', { locale })}
          onPick={pickDate} onOpenMonth={() => setSheet({ kind: 'month' })}
          dropDay={entryDrag.drag?.target.kind === 'day' ? entryDrag.drag.target.date : null} />

        {MEALS.map(meal => (
          <MealSection key={meal} meal={meal} entries={n.byMeal[meal]} hideKcal={n.goals.hideKcal} goalKcal={n.goals.kcal} busy={busy || !n.day}
            onAdd={() => setSheet({ kind: 'add', meal })}
            onOpen={openEntry}
            pieceOf={pieceOf}
            onDelete={removeWithUndo}
            onSaveAsDish={() => saveMealAsDish(meal)}
            drag={dragFor(meal)} onLift={liftEntry} ready={!!n.day} />
        ))}

        {n.day && (
          <>
            <WaterCard ml={n.day.waterMl} goalMl={n.goals.waterMl}
              onChange={ml => { n.setWater(ml).catch(() => toast.error(t('nutr_error'))) }} />
          </>
        )}
      </div>

      <p className={`mt-6 px-4 text-center text-[12px] leading-relaxed ${MUTED}`}>
        {t('nutr_credit_off')}{' '}
        <a href="https://world.openfoodfacts.org" target="_blank" rel="noreferrer" className="underline">Open Food Facts</a>
        {' '}(<a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noreferrer" className="underline">ODbL</a>).
        {' '}{t('nutr_credit_note')}
      </p>
      </>)}

      {sheet?.kind === 'add' && (sheet.pick ? (
        <AddFoodSheet mode="ingredient" goalKcal={n.goals.kcal} meal={sheet.meal} frequent={n.frequentFor(sheet.pick.kind === 'photo' ? sheet.meal : null)} myFoods={n.myFoods}
          exclude={sheet.pick.kind === 'dish' ? sheet.pick.draft.itemId : null}
          // Foto: mit dem kurzen Suchbegriff der KI vorbelegen („Spaghetti" statt „Spaghetti, gekocht")
          initialQuery={sheet.pick.kind === 'photo' && sheet.pick.row !== null ? sheet.pick.flow.rows?.[sheet.pick.row]?.search : undefined}
          hideKcal={n.goals.hideKcal}
          onClose={() => setSheet(sheet.pick!.kind === 'photo' ? { ...sheet.pick!, row: null } : sheet.pick!)}
          onPick={(food, amount) => setSheet({ kind: 'portion', meal: sheet.meal, food, amount, pick: sheet.pick })}
          onScan={() => setSheet({ kind: 'scan', meal: sheet.meal, pick: sheet.pick })}
          onCreate={name => setSheet({ kind: 'editor', meal: sheet.meal, base: null, name, barcode: null, then: {}, pick: sheet.pick })} />
      ) : (
        <AddFoodSheet goalKcal={n.goals.kcal} meal={sheet.meal} frequent={n.frequentFor(sheet.meal)} myFoods={n.myFoods} hideKcal={n.goals.hideKcal}
          onClose={() => setSheet(null)}
          onPick={(food, amount) => setSheet({ kind: 'portion', meal: sheet.meal, food, amount })}
          onScan={() => setSheet({ kind: 'scan', meal: sheet.meal })}
          onPhoto={() => setSheet({ kind: 'photo', meal: sheet.meal, flow: EMPTY_FLOW, row: null })}
          onCreate={name => setSheet({ kind: 'editor', meal: sheet.meal, base: null, name, barcode: null, then: {} })}
          onNewDish={() => setSheet({ kind: 'dish', draft: draftFromIngredients([], lang, undefined, sheet.meal), meal: sheet.meal, back: sheet })}
          onQuick={async (kcal, protein) => {
            const ok = await run(async () => { await n.addQuick(sheet.meal, t('nutr_quick_name'), kcal, protein) })
            if (ok) { setSheet(null); toast.success(t('nutr_added')) }
          }} />
      ))}

      {sheet?.kind === 'photo' && (
        <PhotoSheet userId={userId} meal={sheet.meal} flow={sheet.flow} myDishes={myDishes} hideKcal={n.goals.hideKcal} busy={busy}
          // Funktionsform: Erkennen läuft asynchron, der Stand darf dazwischen nicht veralten.
          onFlow={patch => setSheet(s => (s?.kind === 'photo' ? { ...s, flow: { ...s.flow, ...patch } } : s))}
          onLogDish={dish => setSheet({ kind: 'portion', meal: sheet.meal, food: dish, back: sheet })}
          onSaveAsDish={(name, list) => setSheet({
            kind: 'dish', meal: sheet.meal, back: sheet,
            draft: { ...draftFromIngredients(list.map(c => ingredientFromFood(c.food, c.amount)), lang, undefined, sheet.meal), name },
          })}
          onMeal={meal => setSheet({ ...sheet, meal })}
          onPickRow={row => setSheet({ kind: 'add', meal: sheet.meal, pick: { ...sheet, row } })}
          onClose={() => setSheet({ kind: 'add', meal: sheet.meal })}
          onLog={(meal, list) => run(async () => {
            await n.addMany(meal, list)
            setSheet(null)
            toast.success(t('nutr_photo_logged', { count: list.length }))
          })} />
      )}

      {sheet?.kind === 'scan' && (
        <BarcodeScanner busy={busy} onClose={() => setSheet({ kind: 'add', meal: sheet.meal, pick: sheet.pick })}
          onCode={code => handleBarcode(sheet.meal, code, sheet.pick)} />
      )}

      {sheet?.kind === 'portion' && (
        <PortionSheet key={`${sheet.food.sourceRef ?? sheet.food.name}-${JSON.stringify(sheet.food.per100)}`} mode={sheet.pick ? 'ingredient' : 'add'}
          pickLabel={sheet.pick?.kind === 'photo' ? t('nutr_photo_take_over') : undefined}
          food={sheet.food} meal={sheet.meal} startAmount={sheet.amount}
          busy={busy} hideKcal={n.goals.hideKcal} goalKcal={n.goals.kcal}
          // Vorschau oben: in der Tageskugel beim Eintragen (Tag geladen), in der Gericht-Kugel bei einer Zutat dafür.
          preview={sheet.pick ? sheet.pick.kind === 'dish' : !!n.day}
          onClose={() => setSheet(sheet.done ? null : sheet.back ?? { kind: 'add', meal: sheet.meal, pick: sheet.pick })}
          onSave={(amount, meal) => {
            if (sheet.pick) { setSheet(withPicked(sheet.pick, sheet.food, amount, lang)); return }
            // Das Formular bleibt offen: Punkte fliegen in die Kugel, danach noch einmal oder schließen.
            return run(async () => {
              await n.add(meal, sheet.food, amount)
              setSheet(s => (s?.kind === 'portion' ? { ...s, done: true } : s))
              toast.success(t('nutr_added_to', { meal: t(`nutr_meal_${meal}`) }))
            })
          }}
          // Ein Gericht als Zutat wird hier nicht bearbeitet — die Werte-Korrektur ließe seine Zutaten stehen.
          onCorrect={sheet.food.recipe && sheet.pick ? undefined : () => (sheet.food.recipe
            ? openDish(sheet.food, { meal: sheet.meal, back: sheet })
            : setSheet({ kind: 'editor', meal: sheet.meal, base: sheet.food, barcode: sheet.food.barcode, then: { amount: sheet.amount }, pick: sheet.pick }))}
          onToggleFavorite={() => toggleFavorite(sheet.food, food => ({ ...sheet, food }))} />
      )}

      {sheet?.kind === 'edit' && (
        <PortionSheet key={`${sheet.entry.id}-${JSON.stringify(sheet.food.per100)}`} mode="edit" food={sheet.food} meal={sheet.entry.meal}
          startAmount={sheet.entry.amount ?? undefined} busy={busy} hideKcal={n.goals.hideKcal} goalKcal={n.goals.kcal}
          onClose={() => setSheet(null)}
          onSave={(amount, meal) => run(async () => {
            await n.update(sheet.entry, { amount, meal, food: entryFoodChanged(sheet.entry, sheet.food) ? sheet.food : undefined })
            setSheet(null)
          })}
          onDelete={() => removeWithUndo(sheet.entry)}
          onCorrect={() => (sheet.food.recipe ? openDish(sheet.food, { meal: null, entry: sheet.entry, back: sheet }) : setSheet({
            kind: 'editor', meal: sheet.entry.meal, barcode: sheet.food.barcode, then: { entry: sheet.entry },
            // Gibt es das Lebensmittel in „Meine", deren aktuelle Werte — nie den alten Schnappschuss zurückschreiben.
            base: n.myFoods.find(f => f.itemId && f.itemId === sheet.food.itemId) ?? sheet.food,
          }))}
          onToggleFavorite={() => toggleFavorite(sheet.food, food => ({ ...sheet, food }))} />
      )}

      {sheet?.kind === 'quick' && (
        <Sheet labelledBy="nutr-quick-title" busy={busy} onClose={() => setSheet(null)}>
          <div className="flex items-center justify-between gap-2">
            <h2 id="nutr-quick-title" className="lg-title2 min-w-0 truncate">{sheet.entry.name}</h2>
            <SheetClose onClick={() => setSheet(null)} />
          </div>
          <p className={`mt-1 text-[15px] ${DIM}`}>
            {n.goals.hideKcal ? '' : `${Math.round(sheet.entry.nutrients.kcal)} kcal · `}{Math.round(sheet.entry.nutrients.protein)} g {t('nutr_protein')}
          </p>
          <div role="radiogroup" aria-label={t('nutr_meal')} className="mt-4 flex flex-wrap gap-1.5">
            {MEALS.map(m => (
              <button key={m} type="button" role="radio" aria-checked={sheet.entry.meal === m} disabled={busy}
                onClick={() => run(async () => { await n.update(sheet.entry, { meal: m }); setSheet(null) })}
                className={chip(sheet.entry.meal === m)}>{t(`nutr_meal_${m}`)}</button>
            ))}
          </div>
          <button type="button" disabled={busy} onClick={() => removeWithUndo(sheet.entry)}
            data-tone="bad" className="lg-gray-btn mt-5 w-full !min-h-12">
            <Trash2 size={16} aria-hidden="true" />{t('nutr_delete')}
          </button>
        </Sheet>
      )}

      {sheet?.kind === 'editor' && (
        <FoodEditorSheet base={sheet.base} initialName={sheet.name} barcode={sheet.barcode} busy={busy}
          onClose={() => {
            if (sheet.then.entry && sheet.base) setSheet({ kind: 'edit', entry: sheet.then.entry, food: sheet.base })
            else if (sheet.base) setSheet({ kind: 'portion', meal: sheet.meal, food: sheet.base, amount: sheet.then.amount, pick: sheet.pick })
            else setSheet({ kind: 'add', meal: sheet.meal, pick: sheet.pick })
          }}
          onSave={food => run(async () => {
            const saved = await n.saveFood(food)
            setSheet(sheet.then.entry
              ? { kind: 'edit', entry: sheet.then.entry, food: saved }
              : { kind: 'portion', meal: sheet.meal, food: saved, amount: sheet.then.amount, pick: sheet.pick })
          })} />
      )}

      {sheet?.kind === 'dish' && (
        <DishEditorSheet draft={sheet.draft} busy={busy} hideKcal={n.goals.hideKcal} focus={dishFocus} onFocus={setDishFocus}
          onChange={draft => setSheet({ ...sheet, draft })}
          onClose={() => { setDishFocus(null); setSheet(sheet.back) }}
          onAddIngredient={() => { setDishFocus(null); setSheet({ kind: 'add', meal: sheet.meal ?? sheet.entry?.meal ?? meal0, pick: sheet }) }}
          onSave={dish => run(async () => {
            const saved = await n.saveFood(dish)
            setDishFocus(null)
            if (sheet.entry) setSheet({ kind: 'edit', entry: sheet.entry, food: saved })
            else if (sheet.meal) setSheet({ kind: 'portion', meal: sheet.meal, food: saved })
            else { setSheet(null); toast.success(t('nutr_dish_saved')) }
          })}
          onDelete={sheet.draft.itemId ? () => run(async () => {
            await n.removeFood(sheet.draft.itemId!)
            setDishFocus(null)
            setSheet(sheet.meal ? { kind: 'add', meal: sheet.meal } : null)
            toast(t('nutr_dish_deleted'))
          }) : undefined} />
      )}

      {sheet?.kind === 'goals' && (
        <GoalsSheet userId={userId} today={todayKey} current={n.goals} busy={busy} onClose={() => setSheet(null)}
          onSave={g => run(async () => { await n.saveGoals(g); setSheet(null); toast.success(t('nutr_goals_saved')) })} />
      )}

      {entryDrag.ghost}

      {sheet?.kind === 'month' && (
        <MonthSheet userId={userId} date={date} today={todayKey} goals={n.goals} live={n.total}
          onPick={pickDate} onClose={() => setSheet(null)} />
      )}
    </div>
  )
}

export default ErnaehrungPage
