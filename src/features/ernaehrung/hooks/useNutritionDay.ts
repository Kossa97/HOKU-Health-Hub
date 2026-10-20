import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { addDays, parseISO } from 'date-fns'
import { dayKey } from '../../../lib/sharedDay'
import { frequentFoods } from '../lib/foodSearch'
import { DEFAULT_GOALS, type Food, type Goals, type LogEntry, type Meal, groupByMeal, sumNutrients } from '../lib/nutrition'
import * as store from '../services/nutritionStore'
import { type DayTotals, EMPTY_TOTALS, addTotals, weekRange } from '../lib/dayRings'

export const toDateKey = dayKey

export interface DayState {
  /** Für welchen Tag die Daten gelten — beim Tageswechsel wird nichts vom alten Tag angezeigt. */
  date: string
  entries: LogEntry[]
  waterMl: number
}

/**
 * Daten eines Tages plus alles, was Hinzufügen braucht (Ziele, Meine
 * Lebensmittel, letzte Einträge). Schreibvorgänge aktualisieren die Anzeige
 * sofort und nehmen die Änderung bei einem Fehler zurück.
 */
export function useNutritionDay(userId: string, date: string) {
  const [day, setDay] = useState<DayState | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS)
  const [goalsSet, setGoalsSet] = useState<boolean | null>(null)
  const [myFoods, setMyFoods] = useState<Food[]>([])
  const [recent, setRecent] = useState<LogEntry[]>([])
  /** Summen je Tag der Kalenderwoche (Mo–So). Eigener Stand: bleibt beim Tageswechsel innerhalb der Woche stehen. */
  const [week, setWeek] = useState<{ from: string; totals: Record<string, DayTotals> } | null>(null)
  const [weekError, setWeekError] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const dateRef = useRef(date)
  useEffect(() => { dateRef.current = date }, [date])
  const { from: weekFrom, to: weekTo } = weekRange(date)

  useEffect(() => {
    let cancelled = false
    store.loadDay(userId, date)
      .then(d => { if (!cancelled) { setDay({ ...d, date }); setLoadError(false) } })
      .catch(() => { if (!cancelled) setLoadError(true) })
    return () => { cancelled = true }
  }, [userId, date, reloadToken])

  // Die Woche nur neu laden, wenn sie wechselt — nicht bei jedem Tag darin.
  useEffect(() => {
    let cancelled = false
    store.loadRange(userId, weekFrom, weekTo)
      .then(totals => { if (!cancelled) { setWeek({ from: weekFrom, totals }); setWeekError(false) } })
      .catch(() => { if (!cancelled) setWeekError(true) })
    return () => { cancelled = true }
  }, [userId, weekFrom, weekTo, reloadToken])

  // Gehört der geladene Stand nicht zum gewählten Tag (Wechsel läuft oder scheiterte), gibt es keinen.
  const current = day?.date === date ? day : null

  useEffect(() => {
    let cancelled = false
    store.loadGoals(userId)
      .then(g => { if (!cancelled) { if (g) setGoals(g); setGoalsSet(!!g) } })
      .catch(() => { if (!cancelled) setGoalsSet(true) }) // Fehler: keinen Ziel-Hinweis aufdrängen
    store.loadMyFoods(userId).then(f => { if (!cancelled) setMyFoods(f) }).catch(() => {})
    store.loadRecentEntries(userId).then(r => { if (!cancelled) setRecent(r) }).catch(() => {})
    return () => { cancelled = true }
  }, [userId])

  const reload = useCallback(() => setReloadToken(n => n + 1), [])

  /** Eintrag lokal einsortieren (Tag + Wochenwert + „Häufig"). */
  const applyAdded = useCallback((added: LogEntry[]) => {
    setDay(d => {
      if (!d || d.date !== dateRef.current) return d
      return { ...d, entries: [...d.entries, ...added.filter(e => e.date === dateRef.current)] }
    })
    setWeek(w => {
      if (!w) return w
      const totals = { ...w.totals }
      for (const e of added) {
        if (e.date >= w.from && e.date <= weekRange(w.from).to) totals[e.date] = addTotals(totals[e.date] ?? EMPTY_TOTALS, e.nutrients)
      }
      return { ...w, totals }
    })
    const ids = new Set(added.map(e => e.id))
    setRecent(r => [...[...added].reverse(), ...r.filter(e => !ids.has(e.id))].slice(0, 200))
  }, [])

  const applyRemoved = useCallback((removed: LogEntry) => {
    setDay(d => (d ? { ...d, entries: d.entries.filter(e => e.id !== removed.id) } : d))
    setWeek(w => {
      const t = w?.totals[removed.date]
      return w && t ? { ...w, totals: { ...w.totals, [removed.date]: addTotals(t, removed.nutrients, -1) } } : w
    })
    setRecent(r => r.filter(e => e.id !== removed.id))
  }, [])

  const add = useCallback(async (meal: Meal, food: Food, amount: number) => {
    const e = await store.addEntry(userId, date, meal, food, amount)
    applyAdded([e])
    return e
  }, [userId, date, applyAdded])

  const addMany = useCallback(async (meal: Meal, list: { food: Food; amount: number }[]) => {
    const added = await store.addEntries(userId, date, meal, list)
    applyAdded(added)
    return added
  }, [userId, date, applyAdded])

  const addQuick = useCallback(async (meal: Meal, name: string, kcal: number, protein: number) => {
    const e = await store.addQuickEntry(userId, date, meal, name, kcal, protein)
    applyAdded([e])
    return e
  }, [userId, date, applyAdded])

  const update = useCallback(async (entry: LogEntry, change: { amount?: number; meal?: Meal; food?: Food }) => {
    const next = await store.updateEntry(entry, change)
    applyRemoved(entry)
    applyAdded([next])
    return next
  }, [applyAdded, applyRemoved])

  /** Löschen sofort anzeigen; schlägt es fehl, kommt der Eintrag zurück. */
  const remove = useCallback(async (entry: LogEntry) => {
    applyRemoved(entry)
    try {
      await store.deleteEntry(entry.id)
    } catch (error) {
      applyAdded([entry])
      throw error
    }
  }, [applyAdded, applyRemoved])

  /** Rückgängig nach dem Löschen: gleicher Inhalt, neue ID. */
  const restore = useCallback(async (entry: LogEntry) => {
    const [copy] = await store.insertCopies(userId, [entry])
    if (copy) applyAdded([copy])
  }, [userId, applyAdded])

  /** Mahlzeit vom Vortag übernehmen. Liefert die Zahl der übernommenen Einträge. */
  const copyFromYesterday = useCallback(async (meal: Meal) => {
    const yesterday = toDateKey(addDays(parseISO(date), -1))
    const source = await store.loadEntriesOn(userId, yesterday, meal)
    const copies = await store.insertCopies(userId, source, { date, meal })
    applyAdded(copies)
    return copies.length
  }, [userId, date, applyAdded])

  const setWater = useCallback(async (ml: number) => {
    const prev = current?.waterMl ?? 0
    setDay(d => (d ? { ...d, waterMl: ml } : d))
    try {
      await store.saveWater(userId, date, ml)
    } catch (error) {
      setDay(d => (d ? { ...d, waterMl: prev } : d))
      throw error
    }
  }, [userId, date, current?.waterMl])

  const saveGoals = useCallback(async (g: Goals) => {
    await store.saveGoals(userId, g)
    setGoals(g)
    setGoalsSet(true)
  }, [userId])

  const saveFood = useCallback(async (food: Food) => {
    const existing = food.itemId ? null : myFoods.find(f =>
      (food.barcode && f.barcode === food.barcode) || (food.sourceRef && f.source === food.source && f.sourceRef === food.sourceRef))
    const saved = await store.saveMyFood(userId, existing ? { ...food, itemId: existing.itemId } : food)
    setMyFoods(list => [...list.filter(f => f.itemId !== saved.itemId), saved].sort((a, b) => a.name.localeCompare(b.name)))
    return saved
  }, [userId, myFoods])

  /** Eigenes Lebensmittel/Gericht löschen. Einträge behalten ihren Schnappschuss (`on delete set null`). */
  const removeFood = useCallback(async (itemId: string) => {
    await store.deleteMyFood(itemId)
    setMyFoods(list => list.filter(f => f.itemId !== itemId))
    // Wie in der Datenbank: Einträge zeigen auf nichts mehr — sonst böte „Häufig" das gelöschte Lebensmittel weiter an.
    const unlink = (e: LogEntry) => (e.itemId === itemId ? { ...e, itemId: null } : e)
    setRecent(r => r.map(unlink))
    setDay(d => (d ? { ...d, entries: d.entries.map(unlink) } : d))
  }, [])

  const findByBarcode = useCallback((barcode: string) => {
    return myFoods.find(f => f.barcode === barcode) ?? null
  }, [myFoods])

  const total = useMemo(() => sumNutrients((current?.entries ?? []).map(e => e.nutrients)), [current])
  const byMeal = useMemo(() => groupByMeal(current?.entries ?? []), [current])
  const frequentFor = useCallback((meal: Meal | null) => frequentFoods(recent, meal, myFoods), [recent, myFoods])

  return {
    day: current, week: week?.from === weekFrom ? week.totals : null, loadError: loadError || weekError, reload, goals, goalsSet, myFoods, total, byMeal, frequentFor,
    add, addMany, addQuick, update, remove, restore, copyFromYesterday, setWater, saveGoals, saveFood, removeFood, findByBarcode,
  }
}
