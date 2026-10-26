import { useCallback, useEffect, useState } from 'react'
import { loadFoodAiConsent, setFoodAiConsent } from '../services/foodPhoto'

/**
 * Einwilligung in die Foto-Erkennung: `consent` undefined solange geladen
 * wird, sonst Zeitpunkt oder null. Bei einem Lesefehler `error` — dann weder
 * fragen noch senden, sondern „erneut versuchen" anbieten.
 */
export function useFoodAiConsent(userId: string) {
  const [state, setState] = useState<{ for: string; value: string | null } | { for: string; error: true } | null>(null)
  const [round, setRound] = useState(0)

  useEffect(() => {
    let current = true
    loadFoodAiConsent(userId)
      .then(value => { if (current) setState({ for: userId, value }) })
      .catch(() => { if (current) setState({ for: userId, error: true }) })
    return () => { current = false }
  }, [userId, round])

  const set = useCallback(async (granted: boolean) => {
    const value = await setFoodAiConsent(userId, granted)
    setState({ for: userId, value })
  }, [userId])

  /** Der Server sagt, sie fehlt (etwa nach Widerruf auf einem anderen Gerät). */
  const forget = useCallback(() => setState({ for: userId, value: null }), [userId])
  const reload = useCallback(() => { setState(null); setRound(n => n + 1) }, [])

  const s = state?.for === userId ? state : null
  return { consent: s && !('error' in s) ? s.value : undefined, error: Boolean(s && 'error' in s), set, forget, reload }
}
