import { useEffect, useState } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { supabase } from '../../../lib/supabase'

/**
 * Wer darf Dot aus dem Haus holen und mit ihm reden?
 *
 * Sichtbar ist er für alle (sein Logo wohnt in der Leiste). Bis Pro startet,
 * kommt er für alle heraus (`PRO_PFLICHT` aus). Danach nur mit Pro — oder zum
 * Testen: Admins und der Entwicklungs-Build. Testkonten
 * bekommen `pro_until` per SQL; an der E-Mail-Adresse hängt nichts, weil die
 * Registrierung offen ist. Die Edge Function `coach` prüft auf dem Server
 * dasselbe (ohne den Entwicklungs-Build); hier ist nur die Oberfläche.
 */

/** Gleicher Schalter auf dem Server: `PRO_PFLICHT` in supabase/functions/coach/prompt.ts. */
export const PRO_PFLICHT = false

export function istTester(istAdmin: boolean, entwicklung: boolean) {
  return entwicklung || istAdmin
}

export function hatPro(proBis: string | null | undefined, jetzt = new Date()) {
  if (!proBis) return false
  const t = Date.parse(proBis)
  return Number.isFinite(t) && t > jetzt.getTime()
}

export interface DotZugang {
  geladen: boolean
  darfRaus: boolean
  /** Zeitpunkt der Einwilligung in den Chat, null = nicht erteilt. */
  einwilligung: string | null
  setEinwilligung(wert: string | null): void
}

export function useDotZugang(): DotZugang {
  const { user } = useAuth()
  const [stand, setStand] = useState<{ fuer: string | null; darfRaus: boolean; einwilligung: string | null }>({ fuer: null, darfRaus: false, einwilligung: null })

  useEffect(() => {
    if (!user) return
    let aus = false
    // `*`, nicht einzelne Spalten: vor der Migration fehlen `pro_until` und
    // `coach_consent_at`, und eine Abfrage nach fehlenden Spalten schlüge fehl.
    void supabase.from('profiles').select('*').eq('id', user.id).maybeSingle().then(({ data }) => {
      if (aus) return
      const p = (data ?? {}) as Record<string, unknown>
      const darfRaus = !PRO_PFLICHT || hatPro(p.pro_until as string | null) || istTester(p.is_admin === true, import.meta.env.DEV)
      setStand({ fuer: user.id, darfRaus, einwilligung: (p.coach_consent_at as string | null) ?? null })
    })
    return () => { aus = true }
  }, [user])

  const geladen = !!user && stand.fuer === user.id
  return {
    geladen,
    darfRaus: geladen && stand.darfRaus,
    einwilligung: geladen ? stand.einwilligung : null,
    setEinwilligung: wert => setStand(s => ({ ...s, einwilligung: wert })),
  }
}
