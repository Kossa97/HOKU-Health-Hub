import { useCallback, useState } from 'react'
import { isNative } from '../../../lib/health'

const askedKey = (userId: string) => `hoku.healthStoreConsent.asked.${userId}`

function wasAsked(userId: string | null): boolean {
  if (!userId) return true
  try { return localStorage.getItem(askedKey(userId)) === '1' } catch { return false }
}

/**
 * Wer den Uhr-Import schon an hat, aber noch keine Einwilligung gegeben hat,
 * wird beim Oeffnen des Trainings einmal gefragt. Nach einer Antwort (auch
 * „Nicht jetzt") nicht wieder — nachholen geht in den Trainingseinstellungen.
 */
export function useHealthConsentAsk(userId: string | null, paused: boolean) {
  const [asked, setAsked] = useState(() => wasAsked(userId))

  const done = useCallback(() => {
    setAsked(true)
    if (!userId) return
    try { localStorage.setItem(askedKey(userId), '1') } catch { /* kein Speicher */ }
  }, [userId])

  return { open: isNative && paused && !asked, done }
}
