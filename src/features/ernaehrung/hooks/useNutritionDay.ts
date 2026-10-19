import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { addDays, format, parseISO } from 'date-fns'
import { frequentFoods } from '../lib/foodSearch'
import { DEFAULT_GOALS, type Food, type Goals, type LogEntry, type Meal, groupByMeal, sumNutrients } from '../lib/nutrition'
import * as store from '../services/nutritionStore'

export const toDateKey = (d: Date) => format(d, 'yyyy-MM-dd')

export interface DayState {
  /** Für welchen Tag die Daten gelten — beim Tageswechsel wird nichts vom alten Tag angezeigt. */
  date: string
  entries: LogEntry[]
  waterMl: number
  week: Record<string, { kcal: number; protein: number }>
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
  const [reloadToken, setReloadToken] = useState(0)
  const dateRef = useRef(date)
  useEffect(() => { dateRef.current = date }, [date])

  useEffect(() => {
    let cancelled = false
    const from = toDateKey(addDays(parseISO(date), -6))
    Promise.all([store.loadDay(userId, date), store.loadRange(userId, from, date)])
      .then(([d, week]) => { if (!cancelled) { setDay({ ...d, week, date }); setLoadError(false) } })
      .catch(() => { if (!cancelled) setLoadError(true) })
    return () => { cancelled = true }
  }, [userId, date, reloadToken])

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
      const today = added.filter(e => e.date === dateRef.current)
      const week = { ...d.week }
      for (const e of added) {
        if (!(e.date in week) && e.date !== dateRef.current) continue
        const w = week[e.date] ?? { kcal: 0, protein: 0 }
        week[e.date] = { kcal: w.kcal + e.nutrients.kcal, protein: w.protein + e.nutrients.protein }
      }
      return { ...d, entries: [...d.entries, ...today], week }
    })
    const ids = new Set(added.map(e => e.id))
    setRecent(r => [...[...added].reverse(), ...r.filter(e => !ids.has(e.id))].slice(0, 200))
  }, [])

  const applyRemoved = useCallback((removed: LogEntry) => {
    setDay(d => {
      if (!d) return d
      const w = d.week[removed.date]
      const week = w ? { ...d.week, [removed.date]: { kcal: w.kcal - removed.nutrients.kcal, protein: w.protein - removed.nutrients.protein } } : d.week
      return { ...d, entries: d.entries.filter(e => e.id !== removed.id), week }
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
    day: current, loadError, reload, goals, goalsSet, myFoods, total, byMeal, frequentFor,
    add, addMany, addQuick, update, remove, restore, copyFromYesterday, setWater, saveGoals, saveFood, removeFood, findByBarcode,
  }
}
