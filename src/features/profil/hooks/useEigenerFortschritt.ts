import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import i18n from 'i18next'
import toast from 'react-hot-toast'
import { localDay } from '../../wearables/lib/healthDaily'
import { requestProfileSnapshot } from './useProfileSnapshotSync'
import { computeProgressState, type ProgressData, type ProgressState } from '../lib/progressState'
import { defaultDirection, type Direction, type MetricId } from '../lib/progressScore'
import { withDirection, withNewStart, withRestoredStart, type ProgressSettings } from '../lib/progressSettings'

/**
 * Eigener Gesamtfortschritt fuer Profilkarte, Zeitreise und Aufschluesselung:
 * laedt die eigenen Daten einmal, rechnet auf dem Geraet und rechnet nach
 * jeder Aenderung sofort neu. Aenderungen (Richtung, Start) werden optimistisch
 * gezeigt und gespeichert; scheitert das Speichern, gilt wieder der alte Stand,
 * mit Meldung. Danach wird der Schnappschuss fuer andere aufgefrischt.
 */

const appLang = (): 'de' | 'en' =>
  (i18n.resolvedLanguage ?? i18n.language ?? '').toLowerCase().startsWith('de') ? 'de' : 'en'

export type EigenerFortschritt =
  | { status: 'laden' }
  | { status: 'fehler' }
  | { status: 'ok'; data: ProgressData; state: ProgressState; today: string }

async function ladeDaten(userId: string, now: Date): Promise<ProgressData> {
  const [{ loadProfileSnapshotInput }, { loadProgressParts }] = await Promise.all([
    import('../services/profileSnapshotStore'),
    import('../services/progressStore'),
  ])
  const [input, parts] = await Promise.all([loadProfileSnapshotInput(userId, now, appLang()), loadProgressParts(userId, now)])
  return { input, ...parts }
}

export function useEigenerFortschritt(userId: string | undefined) {
  const [data, setData] = useState<ProgressData | null>(null)
  const [fehler, setFehler] = useState(false)
  const [busy, setBusy] = useState(false)
  const today = useMemo(() => localDay(new Date()), [])
  // Letzter gespeicherter Stand: Ziel des Zuruecksetzens, wenn Speichern scheitert
  const saved = useRef<ProgressSettings | null>(null)

  useEffect(() => {
    if (!userId) return
    let aktiv = true
    ladeDaten(userId, new Date())
      .then(next => { if (aktiv) { saved.current = next.settings; setData(next) } })
      .catch(() => { if (aktiv) setFehler(true) })
    return () => { aktiv = false }
  }, [userId])

  const state = useMemo(() => (data ? computeProgressState(data, today) : null), [data, today])

  /** Optimistisch setzen, speichern, bei Fehler zurueck. */
  const aendern = useCallback(async (
    next: ProgressSettings,
    speichern: (store: typeof import('../services/progressStore')) => Promise<Partial<ProgressSettings> | void>,
  ) => {
    if (!userId) return false
    const vorher = saved.current
    setData(d => (d ? { ...d, settings: next } : d))
    try {
      const store = await import('../services/progressStore')
      const extra = await speichern(store)
      const final = { ...next, ...(extra ?? {}) }
      saved.current = final
      setData(d => (d ? { ...d, settings: final } : d))
      requestProfileSnapshot()
      return true
    } catch {
      if (vorher) setData(d => (d ? { ...d, settings: vorher } : d))
      toast.error(i18n.t('pf_speichern_fehler'))
      return false
    }
  }, [userId])

  const setDirection = useCallback((id: MetricId, direction: Direction) => {
    if (!data || !userId) return
    const directions = withDirection(data.settings.directions, id, direction, defaultDirection(id, data.goals))
    void aendern({ ...data.settings, directions }, store => store.saveProgressSettings(userId, { directions }))
  }, [data, userId, aendern])

  /** Start wechseln (neu = heute, oder ein frueherer); liest die Baseline aus Health fuer diesen Start. */
  const wechsleStart = useCallback(async (next: ProgressSettings) => {
    if (!userId || !next.startOn) return false
    const start = next.startOn
    setBusy(true)
    try {
      return await aendern(next, async store => {
        const { readStartBaseline } = await import('../services/progressBaseline')
        const { baselines } = await readStartBaseline(userId, start)
        await store.saveProgressSettings(userId, { startOn: start, previousStarts: next.previousStarts })
        return { baselines }
      })
    } finally {
      setBusy(false)
    }
  }, [userId, aendern])

  const setNewStart = useCallback(() => {
    if (!data || !state?.setup) return Promise.resolve(false)
    return wechsleStart(withNewStart(data.settings, today, state.setup.startOn))
  }, [data, state, today, wechsleStart])

  const restoreStart = useCallback((day: string) => {
    if (!data || !state?.setup) return Promise.resolve(false)
    return wechsleStart(withRestoredStart(data.settings, day, state.setup.startOn))
  }, [data, state, wechsleStart])

  const fortschritt: EigenerFortschritt = fehler
    ? { status: 'fehler' }
    : data && state ? { status: 'ok', data, state, today } : { status: 'laden' }

  return { fortschritt, busy, setDirection, setNewStart, restoreStart }
}
