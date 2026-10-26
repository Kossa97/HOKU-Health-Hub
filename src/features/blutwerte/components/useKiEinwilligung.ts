import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../context/AuthContext'
import { ladeKiEinwilligung, setzeKiEinwilligung, type ConsentClient } from '../lib/aiConsent'

const client = supabase as unknown as ConsentClient

type Stand = { fuer: string; wert: string | null } | { fuer: string; fehler: true }

/**
 * Stand der KI-Einwilligung:
 *   `einwilligung` — undefined solange geladen wird, sonst Zeitpunkt oder null
 *   `fehler`       — Lesen fehlgeschlagen: weder fragen noch senden, sondern
 *                    „erneut versuchen" anbieten; sonst ueberschriebe eine
 *                    zweite Einwilligung den Zeitpunkt der ersten
 * `vergessen()` setzt sie lokal auf null — wenn der Server sagt, dass sie
 * fehlt (etwa nach Widerruf auf einem anderen Geraet).
 */
export function useKiEinwilligung() {
  const { user } = useAuth()
  const userId = user?.id ?? null
  const [stand, setStand] = useState<Stand | null>(null)
  const [runde, setRunde] = useState(0)

  useEffect(() => {
    if (!userId) return
    let aktuell = true
    ladeKiEinwilligung(client, userId)
      .then(wert => { if (aktuell) setStand({ fuer: userId, wert }) })
      .catch(() => { if (aktuell) setStand({ fuer: userId, fehler: true }) })
    return () => { aktuell = false }
  }, [userId, runde])

  const setze = useCallback(async (erteilt: boolean) => {
    if (!userId) return
    const wert = await setzeKiEinwilligung(client, userId, erteilt ? new Date() : null)
    setStand({ fuer: userId, wert })
  }, [userId])

  const vergessen = useCallback(() => {
    if (userId) setStand({ fuer: userId, wert: null })
  }, [userId])

  const neuLaden = useCallback(() => {
    if (userId) setStand(null)
    setRunde(n => n + 1)
  }, [userId])

  const gilt = stand && stand.fuer === userId ? stand : null
  return {
    einwilligung: gilt && !('fehler' in gilt) ? gilt.wert : undefined,
    fehler: Boolean(gilt && 'fehler' in gilt),
    setze,
    vergessen,
    neuLaden,
  }
}
