import { useEffect, useMemo, useState } from 'react'
import { alterAm } from '../../blutwerte/lib/referenzbereiche'
import type { Goals, LogEntry } from '../lib/nutrition'
import { type TargetContext, dayNutrients, gapsOf, nutrientStatus } from '../lib/nutrientTargets'
import { type BodyData, loadBodyData } from '../services/nutritionStore'

/**
 * Nährstoffe des gezeigten Tages gegen die Ziele (Richtwert nach Alter und Geschlecht
 * oder eigenes Ziel). Lücken erst, wenn der Tag weit genug ist: vergangen, oder schon
 * 70 % des Kalorienziels (mit Bewegung) gegessen.
 */
export function useDayNutrients({ userId, date, today, entries, goals, kcal, bonus }: {
  userId: string
  date: string
  today: string
  entries: readonly LogEntry[]
  goals: Goals
  /** Heute gegessen (kcal). */
  kcal: number
  /** Bewegung auf dem Tagesbedarf (kcal), sonst 0. */
  bonus: number
}) {
  const [body, setBody] = useState<BodyData | null>(null)
  useEffect(() => {
    let off = false
    loadBodyData(userId).then(b => { if (!off) setBody(b) }).catch(() => {})
    return () => { off = true }
  }, [userId])

  const ctx: TargetContext = useMemo(() => ({
    sex: body?.sex ?? null,
    age: body ? alterAm(body.birthDate, today) : null,
    kcal: goals.kcal,
  }), [body, today, goals.kcal])

  const foodEntries = useMemo(() => entries.filter(e => e.source !== 'quick'), [entries])
  const dayDone = date < today || (goals.kcal + bonus > 0 && kcal >= 0.7 * (goals.kcal + bonus))
  const list = useMemo(
    () => nutrientStatus(dayNutrients(foodEntries.map(e => e.nutrients)), ctx, goals.nutrientGoals, dayDone),
    [foodEntries, ctx, goals.nutrientGoals, dayDone],
  )
  const gaps = useMemo(() => gapsOf(list), [list])
  return { list, gaps, ctx, dayDone, entries: foodEntries }
}
