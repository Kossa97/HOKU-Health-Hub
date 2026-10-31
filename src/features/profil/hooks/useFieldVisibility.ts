import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { supabase } from '../../../lib/supabase'
import { filterFehlerSchluessel } from '../../compliance/lib/moderation'
import {
  withSectionVisibility, withVisibility,
  type ProfileField, type ProfileSection, type Visibility, type VisibilityMap,
} from '../lib/profileVisibility'

type Stand = { von: VisibilityMap | null; map: VisibilityMap }

/**
 * Stufen der eigenen Profilfelder (`profiles.field_visibility`): sofort
 * sichtbar, dann gespeichert. Scheitert das Speichern, kommt der vorige Stand
 * zurück — aber nur, wenn inzwischen kein neuerer Tipp darüber liegt.
 *
 * `geladen` ist der Stand vom Server; kommt ein neuer, gilt wieder er (ohne
 * Effekt, also ohne kurzes Aufblitzen der alten Stufen).
 */
export function useFieldVisibility(userId: string | undefined, geladen: VisibilityMap | null) {
  const { t } = useTranslation()
  const [eigen, setEigen] = useState<Stand | null>(null)
  // Letzter gesetzter Stand für schnelle Tipps hintereinander (der Render-Stand hinkt nach)
  const stand = useRef<Stand | null>(null)
  const map = eigen && eigen.von === geladen ? eigen.map : geladen ?? {}

  const apply = useCallback(async (make: (current: VisibilityMap) => VisibilityMap): Promise<boolean> => {
    if (!userId) return false
    const prev = stand.current && stand.current.von === geladen ? stand.current.map : geladen ?? {}
    const next = make(prev)
    const setze = (m: VisibilityMap) => { stand.current = { von: geladen, map: m }; setEigen(stand.current) }
    setze(next)
    const { error } = await supabase.from('profiles').update({ field_visibility: next }).eq('id', userId)
    if (!error) return true
    if (stand.current?.map === next) setze(prev)
    // Die Bio läuft durch den Textfilter, sobald sie nicht mehr privat ist — dann sagen, warum.
    const filter = filterFehlerSchluessel(error.message)
    toast.error(filter ? t(filter) : t('fehler_speichern'), { duration: filter ? 6000 : undefined })
    return false
  }, [userId, geladen, t])

  const setField = useCallback((field: ProfileField, v: Visibility) =>
    apply(current => withVisibility(current, field, v)), [apply])

  const setSection = useCallback((section: ProfileSection, v: Visibility) =>
    apply(current => withSectionVisibility(current, section, v)), [apply])

  return { map, setField, setSection }
}
