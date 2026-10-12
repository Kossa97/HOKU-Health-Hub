import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../../context/AuthContext'
import {
  buildEntryCurve,
  loadBlutspiegelEntries,
  loadEntryHistories,
  type BlutspiegelEntry,
  type EntryCurve,
  type EntryHistory,
  type ReadyEntry,
} from './entries'

// PK-Kurven aendern sich im Minuten- bis Stundentakt. Einmal pro Minute
// werden Eintraege und Einnahmen neu geladen und die Kurve bis „jetzt"
// neu gerechnet — oefter lohnt sich nicht.
export const BLUTSPIEGEL_REFRESH_MS = 60_000

export interface BlutspiegelData {
  loading: boolean
  error: boolean
  entries: BlutspiegelEntry[]
  ready: ReadyEntry[]
  curves: Map<string, EntryCurve>
  /** Zeitpunkt des letzten Abrufs (Unix ms) — „jetzt" fuer die Ansicht. */
  asOf: number
  /** Ein Abruf laeuft gerade (auch der minuetliche im Hintergrund). */
  refreshing: boolean
  /** Sofort neu laden (Aktualisieren-Knopf). */
  refresh: () => void
}

interface Loaded {
  userId: string
  entries: BlutspiegelEntry[]
  histories: Map<string, EntryHistory>
  asOf: number
}

async function fetchAll(userId: string) {
  const entries = await loadBlutspiegelEntries(userId)
  const histories = await loadEntryHistories(entries)
  return { entries, histories }
}

/**
 * Letzter Stand, ueber Seitenwechsel hinweg (Uebersicht ↔ Detail): die neue
 * Seite zeigt ihn sofort und laedt im Hintergrund nach, statt mit Spinner.
 */
let zwischenstand: Loaded | null = null

/** Zwischenstand verwerfen (Tests). Er gilt ohnehin nur fuer dieselbe Nutzer-ID. */
export function vergissBlutspiegelStand(): void {
  zwischenstand = null
}

export function useBlutspiegelData(): BlutspiegelData {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [loaded, setLoaded] = useState<Loaded | null>(() => (zwischenstand && zwischenstand.userId === userId ? zwischenstand : null))
  const [error, setError] = useState(false)

  const [refreshing, setRefreshing] = useState(false)
  const runRef = useRef<() => void>(() => {})

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    let inFlight = false
    const run = () => {
      if (inFlight) return
      inFlight = true
      setRefreshing(true)
      fetchAll(userId)
        .then(data => {
          if (cancelled) return
          const neu = { userId, ...data, asOf: Date.now() }
          zwischenstand = neu
          setLoaded(neu)
          setError(false)
        })
        .catch(() => { if (!cancelled) setError(true) })
        .finally(() => { inFlight = false; if (!cancelled) setRefreshing(false) })
    }
    runRef.current = run
    run()
    const id = window.setInterval(run, BLUTSPIEGEL_REFRESH_MS)
    return () => { cancelled = true; runRef.current = () => {}; window.clearInterval(id) }
  }, [userId])

  const refresh = useCallback(() => runRef.current(), [])

  const current = loaded && loaded.userId === userId ? loaded : null
  const entries = useMemo(() => current?.entries ?? [], [current])
  const ready = useMemo(() => entries.filter((e): e is ReadyEntry => e.kind === 'ready'), [entries])
  const curves = useMemo(
    () => new Map(ready.map(entry => [entry.key, buildEntryCurve(entry, current?.histories.get(entry.cycleId))])),
    [ready, current],
  )

  return {
    loading: Boolean(userId) && !current && !error,
    error,
    entries,
    ready,
    curves,
    asOf: current?.asOf ?? 0,
    refreshing,
    refresh,
  }
}
