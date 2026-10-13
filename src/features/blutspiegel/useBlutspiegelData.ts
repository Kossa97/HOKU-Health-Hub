import { useEffect, useMemo, useRef, useState } from 'react'
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

// Zwei Takte. Alle fuenf Sekunden wird die Kurve bis „jetzt" neu gerechnet —
// lokal, ohne Abfrage; das ist der Live-Takt mit Countdown. Einmal pro Minute
// werden Eintraege und Einnahmen neu geladen: oefter aendern sie sich nicht,
// und jede Abfrage kostet.
export const BLUTSPIEGEL_TAKT_MS = 5_000
export const BLUTSPIEGEL_REFRESH_MS = 60_000
/** So lange dreht sich das Symbol nach einem Takt — sichtbar, nicht hektisch. */
const TAKT_ANZEIGE_MS = 700

export interface BlutspiegelData {
  loading: boolean
  error: boolean
  entries: BlutspiegelEntry[]
  ready: ReadyEntry[]
  curves: Map<string, EntryCurve>
  /** Stand der Kurve (Unix ms) — „jetzt" fuer die Ansicht, alle 5 s neu. */
  asOf: number
  /** Gerade wird neu gerechnet oder geladen (fuer das drehende Symbol). */
  refreshing: boolean
  /** Wann der naechste Takt kommt (Unix ms) — fuer den Countdown. */
  naechsterTakt: number
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

  const [laedt, setLaedt] = useState(false)
  const [takt, setTakt] = useState(() => ({ jetzt: Date.now(), naechster: Date.now() + BLUTSPIEGEL_TAKT_MS }))
  const [dreht, setDreht] = useState(false)
  const fehlerRef = useRef(false)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    let inFlight = false
    let letzterAbruf = 0
    let anzeige = 0
    const laden = () => {
      if (inFlight) return
      inFlight = true
      letzterAbruf = Date.now()
      setLaedt(true)
      fetchAll(userId)
        .then(data => {
          if (cancelled) return
          const neu = { userId, ...data, asOf: Date.now() }
          zwischenstand = neu
          setLoaded(neu)
          setError(false)
          fehlerRef.current = false
        })
        .catch(() => { if (!cancelled) { setError(true); fehlerRef.current = true } })
        .finally(() => { inFlight = false; if (!cancelled) setLaedt(false) })
    }
    const tick = () => {
      const jetzt = Date.now()
      setTakt({ jetzt, naechster: jetzt + BLUTSPIEGEL_TAKT_MS })
      setDreht(true)
      window.clearTimeout(anzeige)
      anzeige = window.setTimeout(() => { if (!cancelled) setDreht(false) }, TAKT_ANZEIGE_MS)
      // Nach einem Fehler beim naechsten Takt erneut versuchen, sonst einmal pro Minute.
      if (fehlerRef.current || jetzt - letzterAbruf >= BLUTSPIEGEL_REFRESH_MS) laden()
    }
    laden()
    setTakt({ jetzt: Date.now(), naechster: Date.now() + BLUTSPIEGEL_TAKT_MS })
    const id = window.setInterval(tick, BLUTSPIEGEL_TAKT_MS)
    return () => { cancelled = true; window.clearInterval(id); window.clearTimeout(anzeige) }
  }, [userId])

  const current = loaded && loaded.userId === userId ? loaded : null
  const entries = useMemo(() => current?.entries ?? [], [current])
  const ready = useMemo(() => entries.filter((e): e is ReadyEntry => e.kind === 'ready'), [entries])
  // Neu gerechnet bei jedem Takt: die Kurve endet „jetzt" (buildEntryCurve
  // rechnet bis zur aktuellen Uhrzeit).
  const curves = useMemo(
    () => new Map(ready.map(entry => [entry.key, buildEntryCurve(entry, current?.histories.get(entry.cycleId))])),
    // takt.jetzt ist Absicht: ohne ihn bliebe die Kurve auf dem Stand des letzten Abrufs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ready, current, takt.jetzt],
  )

  return {
    loading: Boolean(userId) && !current && !error,
    error,
    entries,
    ready,
    curves,
    asOf: current ? Math.max(current.asOf, takt.jetzt) : 0,
    refreshing: laedt || dreht,
    naechsterTakt: takt.naechster,
  }
}
