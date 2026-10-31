import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { supabase } from '../../../lib/supabase'
import { getRestingHeartRate, getSleep, getWorkouts, isIOS, isNative } from '../../../lib/health'
import type { CustomExercise, TrainingRoutine, TrainingSession, TrainingSettings } from '../types'
import { DEFAULT_TRAINING_SETTINGS } from '../types'
import * as repo from '../services/trainingRepo'
import { isGlp1Substance, type WeightPoint } from '../lib/glp1'
import { dedupeAgainst, mapHealthWorkout } from '../lib/healthImport'
import { localDateKey } from '../lib/energy'
import type { ReadinessInput } from '../lib/readiness'
import { useHealthStoreConsent } from '../../wearables/hooks/useHealthStoreConsent'
import { loadHealthStoreConsent } from '../../wearables/services/healthStore'

/**
 * Alles, was der Workout-Tracker liest — eigene Daten und der Kontext aus dem
 * Rest der App (Gewicht, Stack, Blutwerte, Tagesform). Der Kontext ist
 * optional: fehlt eine Tabelle oder scheitert eine Abfrage, laeuft das
 * Training trotzdem, nur ohne diesen Teil.
 */

export interface ChartMarker {
  date: string
  kind: 'substance_start' | 'substance_end' | 'bloodwork'
  label: string
}

export interface TrainingContext {
  weights: WeightPoint[]
  latestWeightKg: number | null
  /** Namen der GLP-1-Eintraege im Stack (leer = keiner). */
  glp1Names: string[]
  /** Zeitpunkte bestaetigter GLP-1-Einnahmen der letzten 90 Tage. */
  glp1Doses: string[]
  markers: ChartMarker[]
  wellnessToday: { sleep: number | null; energy: number | null } | null
  health: Pick<ReadinessInput, 'sleepHours' | 'restingHr'>
}

const EMPTY_CONTEXT: TrainingContext = {
  weights: [], latestWeightKg: null, glp1Names: [], glp1Doses: [], markers: [],
  wellnessToday: null, health: {},
}

const DAY = 24 * 60 * 60 * 1000

/** Ortsdatum `YYYY-MM-DD` — Nacht und Tag zaehlen nach der Uhr des Nutzers, nicht nach UTC. */
const dayKey = (date: Date) => localDateKey(date.toISOString())

async function loadContext(userId: string): Promise<TrainingContext> {
  const since180 = new Date(Date.now() - 180 * DAY).toISOString()
  const since90 = new Date(Date.now() - 90 * DAY).toISOString()

  const [weightsRes, itemsRes, cyclesRes, bloodRes, dailyRes] = await Promise.all([
    supabase.from('weight_logs').select('logged_at, weight_kg').eq('user_id', userId)
      .gte('logged_at', since180).order('logged_at'),
    supabase.from('stack_items').select('id, display_name').eq('user_id', userId),
    supabase.from('cycles').select('start_date, end_date, name, stack_items(display_name)').eq('user_id', userId),
    supabase.from('bloodwork').select('tested_at').eq('user_id', userId).order('tested_at'),
    supabase.from('daily_logs').select('schlaf, energie').eq('user_id', userId).eq('log_date', dayKey(new Date())).maybeSingle(),
  ])

  const weights: WeightPoint[] = (weightsRes.data ?? [])
    .map(row => ({ date: String(row.logged_at), kg: Number(row.weight_kg) }))
    .filter(w => w.kg > 0)

  const items = (itemsRes.data ?? []) as Array<{ id: string; display_name: string | null }>
  const glp1Items = items.filter(item => isGlp1Substance(item.display_name))

  let glp1Doses: string[] = []
  if (glp1Items.length > 0) {
    const { data } = await supabase.from('dose_logs').select('logged_at')
      .eq('user_id', userId).eq('taken', true)
      .in('stack_item_id', glp1Items.map(i => i.id))
      .gte('logged_at', since90).order('logged_at')
    glp1Doses = (data ?? []).map(row => String(row.logged_at))
  }

  const markers: ChartMarker[] = []
  type CycleRow = { start_date: string | null; end_date: string | null; name: string | null; stack_items: { display_name: string } | { display_name: string }[] | null }
  for (const cycle of (cyclesRes.data ?? []) as CycleRow[]) {
    const item = Array.isArray(cycle.stack_items) ? cycle.stack_items[0] : cycle.stack_items
    const label = item?.display_name || cycle.name || ''
    if (!label) continue
    if (cycle.start_date) markers.push({ date: cycle.start_date, kind: 'substance_start', label })
    if (cycle.end_date) markers.push({ date: cycle.end_date, kind: 'substance_end', label })
  }
  const bloodDates = new Set((bloodRes.data ?? []).map(row => String(row.tested_at).slice(0, 10)))
  for (const date of bloodDates) markers.push({ date, kind: 'bloodwork', label: '' })
  markers.sort((a, b) => a.date.localeCompare(b.date))

  const daily = dailyRes.data as { schlaf: number | null; energie: number | null } | null
  return {
    weights,
    latestWeightKg: weights.length ? weights[weights.length - 1].kg : null,
    glp1Names: glp1Items.map(i => i.display_name ?? ''),
    glp1Doses,
    markers,
    wellnessToday: daily && (daily.schlaf != null || daily.energie != null)
      ? { sleep: daily.schlaf, energy: daily.energie }
      : null,
    health: {},
  }
}

/** Schlaf und Ruhepuls der letzten 4 Wochen von der Uhr — je Nacht bzw. Tag ein Wert. */
async function loadHealthReadiness(): Promise<TrainingContext['health']> {
  if (!isNative) return {}
  const startDate = new Date(Date.now() - 29 * DAY)
  const [sleep, resting] = await Promise.all([
    getSleep({ startDate }).catch(() => []),
    getRestingHeartRate({ startDate }).catch(() => []),
  ])

  // Schlaf je Nacht: Phasen nach dem Aufwachtag summieren.
  const byNight = new Map<string, number>()
  for (const s of sleep) {
    if (s.state && /awake|inbed/i.test(s.state)) continue
    const key = dayKey(s.endDate)
    byNight.set(key, (byNight.get(key) ?? 0) + s.durationHours)
  }
  const today = dayKey(new Date())
  const nights = [...byNight.entries()].sort(([a], [b]) => a.localeCompare(b))
  const sleepToday = byNight.get(today) ?? null
  const sleepHistory = nights.filter(([k]) => k !== today).map(([, v]) => v).filter(v => v >= 2 && v <= 14)

  const byDay = new Map<string, number[]>()
  for (const r of resting) {
    const key = dayKey(r.date)
    byDay.set(key, [...(byDay.get(key) ?? []), r.bpm])
  }
  const dayAvg = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length
  const hrToday = byDay.has(today) ? dayAvg(byDay.get(today)!) : null
  const hrHistory = [...byDay.entries()].filter(([k]) => k !== today).map(([, v]) => dayAvg(v))

  return {
    sleepHours: sleepToday != null || sleepHistory.length ? { today: sleepToday != null && sleepToday >= 2 ? sleepToday : null, history: sleepHistory } : undefined,
    restingHr: hrToday != null || hrHistory.length ? { today: hrToday, history: hrHistory } : undefined,
  }
}

export type LoadState = 'loading' | 'ready' | 'error' | 'missing'

export function useTrainingData() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [state, setState] = useState<LoadState>('loading')
  const [sessions, setSessions] = useState<TrainingSession[]>([])
  const [routines, setRoutines] = useState<TrainingRoutine[]>([])
  const [customExercises, setCustomExercises] = useState<CustomExercise[]>([])
  const [settings, setSettings] = useState<TrainingSettings>(DEFAULT_TRAINING_SETTINGS)
  const [context, setContext] = useState<TrainingContext>(EMPTY_CONTEXT)
  const [reloadKey, setReloadKey] = useState(0)
  const syncedRef = useRef(false)
  const { consent: healthConsent, reload: reloadHealthConsent } = useHealthStoreConsent(userId)
  // Uhr-Daten nur mit Einstellung UND Einwilligung (Art. 9 DSGVO). Fehlt die Einwilligung, pausiert der Import.
  const healthAllowed = settings.healthImport && !!healthConsent
  const healthImportPaused = state === 'ready' && settings.healthImport && healthConsent === null

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    // Kein Zuruecksetzen auf 'loading' beim Neuladen: die alten Daten bleiben
    // sichtbar, bis die neuen da sind.
    Promise.all([
      repo.loadSessions(userId),
      repo.loadRoutines(userId),
      repo.loadCustomExercises(userId),
      repo.loadSettings(userId),
    ]).then(([s, r, c, st]) => {
      if (cancelled) return
      setSessions(s); setRoutines(r); setCustomExercises(c); setSettings(st)
      setState('ready')
    }).catch(error => {
      if (cancelled) return
      setState(repo.isMissingTable(error) ? 'missing' : 'error')
    })
    loadContext(userId).then(ctx => { if (!cancelled) setContext(prev => ({ ...ctx, health: prev.health })) }).catch(() => {})
    return () => { cancelled = true }
  }, [userId, reloadKey])

  // Uhr-Daten nur mit ausdruecklicher Einstellung — sonst fragt die App nie nach Health.
  useEffect(() => {
    if (state !== 'ready' || !healthAllowed || !isNative) return
    let cancelled = false
    loadHealthReadiness().then(health => { if (!cancelled) setContext(prev => ({ ...prev, health })) }).catch(() => {})
    return () => { cancelled = true }
  }, [state, healthAllowed])

  const reload = useCallback(() => setReloadKey(k => k + 1), [])

  const saveSession = useCallback(async (session: Omit<TrainingSession, 'id'> & { id?: string }) => {
    if (!userId) throw new Error('not signed in')
    const saved = session.id
      ? await repo.updateSession(userId, session as TrainingSession)
      : await repo.insertSession(userId, session)
    setSessions(prev => [saved, ...prev.filter(s => s.id !== saved.id)]
      .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt)))
    return saved
  }, [userId])

  const removeSession = useCallback(async (id: string) => {
    if (!userId) return
    const removed = sessions.find(s => s.id === id)
    await repo.deleteSession(userId, id)
    setSessions(prev => prev.filter(s => s.id !== id))
    // Von der Uhr uebernommen? Dann merken, damit der Abgleich es nicht zurueckholt.
    if (removed?.externalId && (removed.source === 'healthkit' || removed.source === 'health_connect')) {
      const next = {
        ...settings,
        dismissedExternalIds: [...settings.dismissedExternalIds.filter(x => x !== removed.externalId), removed.externalId]
          .slice(-repo.MAX_DISMISSED),
      }
      setSettings(next)
      await repo.saveSettings(userId, next).catch(() => {})
    }
  }, [userId, sessions, settings])

  const saveRoutine = useCallback(async (routine: Omit<TrainingRoutine, 'id'> & { id?: string }) => {
    if (!userId) throw new Error('not signed in')
    const saved = await repo.saveRoutine(userId, routine)
    setRoutines(prev => {
      const next = prev.some(r => r.id === saved.id) ? prev.map(r => r.id === saved.id ? saved : r) : [...prev, saved]
      return next.sort((a, b) => a.sortOrder - b.sortOrder)
    })
    return saved
  }, [userId])

  const removeRoutine = useCallback(async (id: string) => {
    if (!userId) return
    await repo.deleteRoutine(userId, id)
    setRoutines(prev => prev.filter(r => r.id !== id))
  }, [userId])

  const addCustomExercise = useCallback(async (exercise: Omit<CustomExercise, 'id'>) => {
    if (!userId) throw new Error('not signed in')
    const saved = await repo.insertCustomExercise(userId, exercise)
    setCustomExercises(prev => [...prev, saved].sort((a, b) => a.name.localeCompare(b.name)))
    return saved
  }, [userId])

  const updateSettings = useCallback(async (next: TrainingSettings) => {
    if (!userId) return
    const previous = settings
    setSettings(next)
    try { await repo.saveSettings(userId, next) } catch (error) { setSettings(previous); throw error }
  }, [userId, settings])

  const importSessions = useCallback(async (incoming: Array<Omit<TrainingSession, 'id'>>) => {
    if (!userId) return 0
    const count = await repo.importSessions(userId, incoming)
    reload()
    return count
  }, [userId, reload])

  /**
   * Workouts von der Uhr uebernehmen: neue anlegen, parallel aufgezeichnete
   * nur um kcal/Puls ergaenzen. Laeuft einmal je Seitenaufruf von selbst,
   * sonst ueber „Jetzt synchronisieren".
   */
  const syncHealthWorkouts = useCallback(async (): Promise<{ created: number; enriched: number }> => {
    if (!userId || !isNative) return { created: 0, enriched: 0 }
    // Frisch gelesen: auf einem anderen Geraet widerrufen heisst hier sofort kein Import mehr.
    if (!(await loadHealthStoreConsent(userId))) return { created: 0, enriched: 0 }
    const platform = isIOS ? 'ios' : 'android'
    // Puls nur fuer Workouts nachschlagen, die noch nicht uebernommen sind —
    // sonst fragt jeder Seitenaufruf HealthKit fuer alle 30 Tage erneut ab.
    const known = new Set(sessions.map(s => s.externalId).filter((id): id is string => !!id))
    const workouts = await getWorkouts(
      { startDate: new Date(Date.now() - 30 * DAY) },
      { withHeartRate: id => !known.has(id) },
    )
    const dismissed = new Set(settings.dismissedExternalIds)
    const result = dedupeAgainst(sessions, workouts
      .map(w => mapHealthWorkout(w, platform))
      .filter(w => !w.externalId || !dismissed.has(w.externalId)))
    let created = 0
    if (result.create.length) created = await repo.importSessions(userId, result.create)
    for (const patch of result.enrich) await repo.enrichSession(userId, patch.id, patch)
    if (created || result.enrich.length) reload()
    return { created, enriched: result.enrich.length }
  }, [userId, sessions, settings.dismissedExternalIds, reload])

  useEffect(() => {
    if (state !== 'ready' || !healthAllowed || syncedRef.current) return
    syncedRef.current = true
    syncHealthWorkouts().catch(() => {})
  }, [state, healthAllowed, syncHealthWorkouts])

  const glp1Active = settings.glp1Mode ?? context.glp1Names.length > 0

  return useMemo(() => ({
    state, sessions, routines, customExercises, settings, context, glp1Active,
    healthConsent, healthImportPaused, reloadHealthConsent,
    reload, saveSession, removeSession, saveRoutine, removeRoutine, addCustomExercise,
    updateSettings, importSessions, syncHealthWorkouts,
  }), [state, sessions, routines, customExercises, settings, context, glp1Active,
    healthConsent, healthImportPaused, reloadHealthConsent,
    reload, saveSession, removeSession, saveRoutine, removeRoutine, addCustomExercise,
    updateSettings, importSessions, syncHealthWorkouts])
}

export type TrainingData = ReturnType<typeof useTrainingData>
