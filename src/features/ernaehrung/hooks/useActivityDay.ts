import { useCallback, useEffect, useMemo, useState } from 'react'
import { addDays, parseISO } from 'date-fns'
import { getActiveEnergyTotal } from '../../../lib/health'
import { type ActivityDay, type ActivityLog, activityBonus, activityTotal, estimateActiveKcal } from '../lib/activity'
import type { Goals } from '../lib/nutrition'
import { addActivityLog, deleteActivityLog, loadActivityLogs, loadBodyData, loadDayTrainings } from '../services/nutritionStore'

type RawTraining = Awaited<ReturnType<typeof loadDayTrainings>>[number]

/** Was für einen Tag geladen ist — mit seinem Datum, damit beim Tageswechsel nichts vom alten Tag stehen bleibt. */
interface Loaded {
  date: string
  healthKcal: number | null
  trainings: readonly RawTraining[]
  logs: readonly ActivityLog[]
  /** Eine Quelle ist ausgefallen (die anderen werden trotzdem gezeigt). */
  failed: boolean
}

/**
 * Bewegung des gewählten Tages: Apple Health (nur in der iPhone-App), Trainings aus
 * der App und selbst Eingetragenes. Liefert, was zählt, und was davon aufs Ziel kommt.
 */
export function useActivityDay(userId: string, date: string, goals: Goals) {
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [weightKg, setWeightKg] = useState<number | null>(null)
  const [round, setRound] = useState(0)

  // Gewicht nur für Schätzungen (Trainings ohne Uhr, Einträge ohne kcal).
  useEffect(() => {
    let off = false
    loadBodyData(userId).then(b => { if (!off) setWeightKg(b.weightKg) }).catch(() => {})
    return () => { off = true }
  }, [userId])

  useEffect(() => {
    let off = false
    const from = parseISO(date)
    const to = addDays(from, 1)
    // Jede Quelle für sich: fällt eine aus, bleiben die anderen sichtbar.
    void Promise.allSettled([
      loadActivityLogs(userId, date),
      loadDayTrainings(userId, date),
      getActiveEnergyTotal({ startDate: from, endDate: to < new Date() ? to : new Date() }),
    ]).then(([logs, trainings, health]) => {
      if (off) return
      setLoaded({
        date,
        logs: logs.status === 'fulfilled' ? logs.value : [],
        trainings: trainings.status === 'fulfilled' ? trainings.value : [],
        healthKcal: health.status === 'fulfilled' ? health.value : null,
        failed: logs.status === 'rejected' || trainings.status === 'rejected',
      })
    })
    return () => { off = true }
  }, [userId, date, round])

  // Nur der Stand des gezeigten Tages zählt; Schätzungen rechnen mit dem aktuellen Gewicht.
  const current = loaded?.date === date ? loaded : null
  const day: ActivityDay | null = useMemo(() => current && {
    healthKcal: current.healthKcal,
    logs: current.logs,
    trainings: current.trainings.map(t => {
      const est = t.kcal == null && t.durationS ? estimateActiveKcal(t.durationS / 60, weightKg) : null
      return { id: t.id, title: t.title, startedAt: t.startedAt, kcal: t.kcal ?? est, estimated: t.kcal == null && est !== null }
    }),
  }, [current, weightKg])

  const total = day ? activityTotal(day, goals.activitySources) : { kcal: 0, trainingsInHealth: false }
  const bonus = activityBonus(goals, total.kcal)

  const add = useCallback(async (log: Omit<ActivityLog, 'id'>) => {
    const saved = await addActivityLog(userId, date, log)
    // Nur in den Tag einfügen, für den gespeichert wurde (inzwischen gewechselt: dort lädt er ohnehin neu).
    setLoaded(l => (l && l.date === date ? { ...l, logs: [...l.logs, saved] } : l))
  }, [userId, date])

  const remove = useCallback(async (id: string) => {
    await deleteActivityLog(id)
    setLoaded(l => (l ? { ...l, logs: l.logs.filter(x => x.id !== id) } : l))
  }, [])

  const reload = useCallback(() => setRound(r => r + 1), [])

  return { day, error: !!current?.failed, total, bonus, weightKg, add, remove, reload }
}
