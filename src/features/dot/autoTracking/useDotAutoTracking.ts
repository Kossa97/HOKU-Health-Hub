import { useEffect } from 'react'
import { supabase } from '../../../lib/supabase'
import { fuehreAutoTrackingAus } from './autoTracking'

/** Alle fünf Minuten, beim Start und wenn die App wieder in den Vordergrund kommt. */
const TAKT_MS = 5 * 60_000

/** Lässt Dot fällige Einnahmen eintragen, solange der Nutzer Pro hat. */
export function useDotAutoTracking(userId: string | undefined, aktiv: boolean) {
  useEffect(() => {
    if (!userId || !aktiv) return
    let aus = false
    const lauf = () => {
      if (aus || document.visibilityState === 'hidden') return
      fuehreAutoTrackingAus(supabase, userId).catch(e => console.error('[Dot] automatisch eintragen:', e))
    }
    lauf()
    const takt = window.setInterval(lauf, TAKT_MS)
    const beiSicht = () => { if (document.visibilityState === 'visible') lauf() }
    document.addEventListener('visibilitychange', beiSicht)
    return () => { aus = true; window.clearInterval(takt); document.removeEventListener('visibilitychange', beiSicht) }
  }, [userId, aktiv])
}
