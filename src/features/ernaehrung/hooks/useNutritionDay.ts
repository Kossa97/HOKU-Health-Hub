import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { dayKey } from '../../../lib/sharedDay'
import { frequentFoods } from '../lib/foodSearch'
import { DEFAULT_GOALS, type Food, type Goals, type LogEntry, type Meal, groupByMeal, sumNutrients } from '../lib/nutrition'
import * as store from '../services/nutritionStore'
import { type DayTotals, EMPTY_TOTALS, addTotals, weekRange } from '../lib/dayRings'

export const toDateKey = dayKey

/** Ein Tag im Speicher (ohne Datum — das ist der Schlüssel). */
type DayData = Omit<DayState, 'date'>

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
  /**
   * Geladene Tage (Einträge, Wasser) der Woche, zwischengespeichert: ein Tageswechsel darin ist
   * sofort da; der gezeigte Tag wird trotzdem frisch nachgeladen. Wochensummen kommen von hier.
   */
  const [days, setDays] = useState<Record<string, DayData>>({})
  // Anderes Konto: nichts vom vorigen zeigen.
  const [owner, setOwner] = useState(userId)
  if (owner !== userId) {
    setOwner(userId)
    setDays({})
  }
  /** Stand je Tag: jede Änderung hier zählt hoch — ein älterer Serverstand überschreibt sie nicht. */
  const versions = useRef<Record<string, number>>({})
  useEffect(() => { versions.current = {} }, [userId])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [weekError, setWeekError] = useState<string | null>(null)
  const [goals, setGoals] = useState<Goals>(DEFAULT_GOALS)
  const [goalsSet, setGoalsSet] = useState<boolean | null>(null)
  const [myFoods, setMyFoods] = useState<Food[]>([])
  const [recent, setRecent] = useState<LogEntry[]>([])
  const [reloadToken, setReloadToken] = useState(0)
  const { from: weekFrom, to: weekTo } = weekRange(date)

  /** Einen Tag ändern (nur, wenn er geladen ist) und seinen Stand hochzählen. */
  const updateDay = useCallback((key: string, fn: (d: DayData) => DayData) => {
    versions.current[key] = (versions.current[key] ?? 0) + 1
    setDays(all => (all[key] ? { ...all, [key]: fn(all[key]) } : all))
  }, [])

  useEffect(() => {
    let cancelled = false
    const v = versions.current[date] ?? 0
    store.loadDay(userId, date)
      .then(d => {
        if (cancelled) return
        setLoadError(null)
        // Inzwischen hier geändert (Eintrag, Wasser …): die Anzeige ist neuer als diese Antwort.
        // Noch gar nicht geladen: die Antwort nehmen (sonst bliebe der Tag leer).
        setDays(all => (all[date] && (versions.current[date] ?? 0) !== v ? all : { ...all, [date]: d }))
      })
      .catch(() => { if (!cancelled) setLoadError(date) })
    return () => { cancelled = true }
  }, [userId, date, reloadToken])

  // Die Woche vorladen (und beim Neuladen auffrischen). Nur die Woche bleibt im Speicher.
  useEffect(() => {
    let cancelled = false
    const before = { ...versions.current }
    store.loadDays(userId, weekFrom, weekTo)
      .then(loaded => {
        if (cancelled) return
        setWeekError(null)
        setDays(all => {
          const next: Record<string, DayData> = {}
          for (const [k, v] of Object.entries(loaded)) {
            next[k] = all[k] && (versions.current[k] ?? 0) !== (before[k] ?? 0) ? all[k] : v
          }
          return next
        })
      })
      .catch(() => { if (!cancelled) setWeekError(weekFrom) })
    return () => { cancelled = true }
  }, [userId, weekFrom, weekTo, reloadToken])

  const cached = days[date]
  const current = useMemo<DayState | null>(() => (cached ? { date, ...cached } : null), [cached, date])
  /** Summen je Tag der Woche — aus den geladenen Tagen, so stimmen sie nach jeder Änderung. */
  const week = useMemo(() => {
    const out: Record<string, DayTotals> = {}
    for (const [k, d] of Object.entries(days)) {
      if (k >= weekFrom && k <= weekTo) out[k] = d.entries.reduce((t, e) => addTotals(t, e.nutrients), EMPTY_TOTALS)
    }
    return Object.keys(out).length ? out : null
  }, [days, weekFrom, weekTo])

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

  /** Einträge lokal einsortieren — jeweils in ihren Tag (falls geladen) — und in „Häufig". */
  const applyAdded = useCallback((added: LogEntry[]) => {
    for (const e of added) updateDay(e.date, d => ({ ...d, entries: [...d.entries.filter(x => x.id !== e.id), e] }))
    const ids = new Set(added.map(e => e.id))
    setRecent(r => [...[...added].reverse(), ...r.filter(e => !ids.has(e.id))].slice(0, 200))
  }, [updateDay])

  const applyRemoved = useCallback((removed: LogEntry) => {
    updateDay(removed.date, d => ({ ...d, entries: d.entries.filter(e => e.id !== removed.id) }))
    setRecent(r => r.filter(e => e.id !== removed.id))
  }, [updateDay])

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

  /**
   * Verschieben (Halten und Ziehen): sofort anzeigen, dann speichern; schlägt es fehl,
   * steht der Eintrag wieder am alten Platz. Ein anderer Tag zählt in der Woche mit.
   */
  const applyMoved = useCallback((from: LogEntry, to: LogEntry) => {
    // Wie Entfernen + Hinzufügen, aber „Häufig“ bleibt unberührt: Verschieben ist kein neues Essen.
    // Beide Tage, soweit geladen — so stimmt auch ein Tag, auf den man gerade verschoben hat.
    updateDay(from.date, d => ({ ...d, entries: d.entries.filter(e => e.id !== from.id) }))
    updateDay(to.date, d => ({ ...d, entries: [...d.entries.filter(e => e.id !== to.id), to] }))
  }, [updateDay])

  const move = useCallback(async (entry: LogEntry, to: { date: string; meal: Meal; sortKey: number }) => {
    const moved: LogEntry = { ...entry, date: to.date, meal: to.meal, sortKey: to.sortKey }
    applyMoved(entry, moved)
    try {
      const saved = await store.moveEntry(entry, to)
      updateDay(saved.date, d => ({ ...d, entries: d.entries.map(e => (e.id === saved.id ? saved : e)) }))
      return saved
    } catch (error) {
      applyMoved(moved, entry)
      throw error
    }
  }, [applyMoved, updateDay])

  /** Plätze in einer Mahlzeit neu verteilen (wenn zwischen zwei Nachbarn kein Platz mehr ist). */
  const setOrder = useCallback(async (updates: readonly { id: string; sortKey: number }[]) => {
    const before = new Map((current?.entries ?? []).map(e => [e.id, e.sortKey]))
    const keys = new Map(updates.map(u => [u.id, u.sortKey]))
    updateDay(date, d => ({ ...d, entries: d.entries.map(e => (keys.has(e.id) ? { ...e, sortKey: keys.get(e.id)! } : e)) }))
    try {
      await store.setSortKeys(updates)
    } catch (error) {
      updateDay(date, d => ({ ...d, entries: d.entries.map(e => (before.has(e.id) && keys.has(e.id) ? { ...e, sortKey: before.get(e.id)! } : e)) }))
      throw error
    }
  }, [current?.entries, date, updateDay])

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

  const setWater = useCallback(async (ml: number) => {
    const prev = current?.waterMl ?? 0
    updateDay(date, d => ({ ...d, waterMl: ml }))
    try {
      await store.saveWater(userId, date, ml)
    } catch (error) {
      updateDay(date, d => ({ ...d, waterMl: prev }))
      throw error
    }
  }, [userId, date, current?.waterMl, updateDay])

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
    setDays(all => {
      for (const k of Object.keys(all)) versions.current[k] = (versions.current[k] ?? 0) + 1
      return Object.fromEntries(Object.entries(all).map(([k, d]) => [k, { ...d, entries: d.entries.map(unlink) }]))
    })
  }, [])

  const findByBarcode = useCallback((barcode: string) => {
    return myFoods.find(f => f.barcode === barcode) ?? null
  }, [myFoods])

  const total = useMemo(() => sumNutrients((current?.entries ?? []).map(e => e.nutrients)), [current])
  const byMeal = useMemo(() => groupByMeal(current?.entries ?? []), [current])
  const frequentFor = useCallback((meal: Meal | null) => frequentFoods(recent, meal, myFoods), [recent, myFoods])

  return {
    day: current, week, loadError: loadError === date || weekError === weekFrom, reload, goals, goalsSet, myFoods, total, byMeal, frequentFor,
    add, addMany, addQuick, update, remove, restore, move, setOrder, setWater, saveGoals, saveFood, removeFood, findByBarcode,
  }
}
