import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { parseWebBadges, type WebBadgeOverrides } from '../lib/badgeIds'
import { parseVisibilityMap } from '../lib/profileVisibility'

/**
 * Die eigene Profilzeile für die Einstellungen (2a) und ihre Unterseiten:
 * Sichtbarkeit, Web-Link und die Web-Einstellungen aus 2c.
 */
export interface Einstellungen {
  username: string
  privat: boolean
  webLink: boolean
  isAdmin: boolean
  visibility: ReturnType<typeof parseVisibilityMap>
  /** `null` = Spalte fehlt (vor der Migration 2c): dann nicht schaltbar. */
  webBadges: WebBadgeOverrides | null
  webIndexable: boolean | null
}

export function useEinstellungen(userId: string | undefined) {
  const [werte, setWerte] = useState<Einstellungen | null>(null)
  const [fehler, setFehler] = useState(false)
  useEffect(() => {
    if (!userId) return
    let aktiv = true
    void supabase.from('profiles').select('*').eq('id', userId).single().then(({ data, error }) => {
      if (!aktiv) return
      if (error || !data) { setFehler(true); return }
      setWerte({
        username: typeof data.username === 'string' ? data.username : '',
        privat: data.profile_private === true,
        webLink: data.web_link_enabled === true,
        isAdmin: data.is_admin === true,
        visibility: parseVisibilityMap(data.field_visibility),
        // Vor der Migration 2c fehlen beide Spalten in der Zeile
        webBadges: data.web_badges == null ? null : parseWebBadges(data.web_badges),
        webIndexable: typeof data.web_indexable === 'boolean' ? data.web_indexable : null,
      })
    })
    return () => { aktiv = false }
  }, [userId])
  return { werte, setWerte, fehler }
}
