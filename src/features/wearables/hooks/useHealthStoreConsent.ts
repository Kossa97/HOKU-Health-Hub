import { useCallback, useEffect, useState } from 'react'
import { loadHealthStoreConsent, setHealthStoreConsent } from '../services/healthStore'

/**
 * Einwilligung in die Speicherung von Daten aus Apple Health / Health Connect:
 * `consent` undefined solange geladen wird (oder ohne Nutzer), sonst Zeitpunkt
 * oder null. Bei einem Lesefehler `error` — dann weder fragen noch importieren.
 */
export function useHealthStoreConsent(userId: string | null) {
  const [state, setState] = useState<{ for: string; value: string | null } | { for: string; error: true } | null>(null)
  const [round, setRound] = useState(0)

  useEffect(() => {
    if (!userId) return
    let current = true
    loadHealthStoreConsent(userId)
      .then(value => { if (current) setState({ for: userId, value }) })
      .catch(() => { if (current) setState({ for: userId, error: true }) })
    return () => { current = false }
  }, [userId, round])

  const set = useCallback(async (granted: boolean) => {
    if (!userId) throw new Error('not signed in')
    const value = await setHealthStoreConsent(userId, granted)
    setState({ for: userId, value })
  }, [userId])

  const reload = useCallback(() => { setState(null); setRound(n => n + 1) }, [])

  const s = state && state.for === userId ? state : null
  return { consent: s && !('error' in s) ? s.value : undefined, error: Boolean(s && 'error' in s), set, reload }
}
