import { useEffect, useMemo, useState } from 'react'
import { addDays, parseISO } from 'date-fns'
import { dayKey } from '../../../lib/sharedDay'
import { getActiveEnergy, isIOS, isNative } from '../../../lib/health'
import { type ActivityLog, activityBonus, activityDayFrom, activityTotal } from '../lib/activity'
import { weekRange } from '../lib/dayRings'
import type { Goals } from '../lib/nutrition'
import { loadActivityLogsRange, loadBodyData, loadTrainingsRange } from '../services/nutritionStore'

interface Loaded {
  from: string
  logs: Record<string, ActivityLog[]>
  trainings: Record<string, { durationS: number | null; kcal: number | null }[]>
  health: Record<string, number | null>
}

/**
 * Bewegungs-Bonus je Tag für die Wochenleiste (Vor-, diese und nächste Woche), damit jede
 * kleine Kugel bis zu ihrem Tagesziel füllt — wie die große am gewählten Tag. Nur nötig, wenn
 * die Bewegung auf den Tagesbedarf zählt. Apple Health nur für vergangene Tage und heute
 * der gezeigten Woche (je Tag eine Abfrage auf dem Gerät).
 */
export function useWeekActivity(userId: string, date: string, today: string, goals: Goals, refresh = 0): Record<string, number> {
  const active = goals.activityMode === 'budget' && !goals.hideKcal
  const { from: weekFrom, to: weekTo } = weekRange(date)
  const from = dayKey(addDays(parseISO(weekFrom), -7))
  const to = dayKey(addDays(parseISO(weekTo), 7))
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [weightKg, setWeightKg] = useState<number | null>(null)

  useEffect(() => {
    if (!active) return
    let off = false
    loadBodyData(userId).then(b => { if (!off) setWeightKg(b.weightKg) }).catch(() => {})
    return () => { off = true }
  }, [userId, active])

  useEffect(() => {
    if (!active) return
    let off = false
    const healthDays: string[] = []
    for (let d = parseISO(weekFrom); dayKey(d) <= weekTo && dayKey(d) <= today; d = addDays(d, 1)) healthDays.push(dayKey(d))
    const withHealth = goals.activitySources.includes('health')
    Promise.allSettled([
      loadActivityLogsRange(userId, from, to),
      loadTrainingsRange(userId, from, to),
      Promise.all(healthDays.map(async d => {
        if (!withHealth) return [d, null] as const
        const start = parseISO(d)
        const end = addDays(start, 1)
        return [d, await getActiveEnergy({ startDate: start, endDate: end < new Date() ? end : new Date() })] as const
      })),
    ]).then(([logs, trainings, health]) => {
      if (off) return
      setLoaded({
        from,
        logs: logs.status === 'fulfilled' ? logs.value : {},
        trainings: trainings.status === 'fulfilled' ? trainings.value : {},
        health: health.status === 'fulfilled' ? Object.fromEntries(health.value) : {},
      })
    })
    return () => { off = true }
  // `refresh`: eigene Einträge des gezeigten Tags haben sich geändert → Woche neu holen.
  }, [userId, from, to, weekFrom, weekTo, today, active, goals.activitySources, refresh])

  return useMemo(() => {
    // Beim Wochenwechsel bleibt der alte Stand stehen, bis der neue da ist (kein Flackern).
    if (!active || !loaded) return {}
    // Mit Apple Health kennt nur die gezeigte Woche die aktive Energie; Nachbarwochen ohne sie
    // würden anders rechnen als später, wenn man hinwischt — dort dann lieber das Grundziel.
    const healthOnly = goals.activitySources.includes('health') && isNative && isIOS
    const out: Record<string, number> = {}
    const days = new Set([...Object.keys(loaded.logs), ...Object.keys(loaded.trainings), ...Object.keys(loaded.health)])
    for (const d of days) {
      if (healthOnly && !(d in loaded.health)) continue
      const day = activityDayFrom({
        healthKcal: loaded.health[d] ?? null,
        logs: loaded.logs[d] ?? [],
        trainings: (loaded.trainings[d] ?? []).map((t, i) => ({ id: String(i), title: '', startedAt: d, ...t })),
      }, weightKg)
      const b = activityBonus(goals, activityTotal(day, goals.activitySources).kcal)
      if (b > 0) out[d] = b
    }
    return out
  }, [active, loaded, goals, weightKg])
}
