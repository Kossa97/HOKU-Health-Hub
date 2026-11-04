import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { supabase } from '../../../lib/supabase'
import { webBadgeOn, withWebBadge, type BadgeId, type WebBadgeOverrides } from '../lib/badgeIds'

/** `nr` zählt die Tipps: Bei Wahrheitswerten sagt der Wert allein nicht, ob ein neuerer Tipp darüber liegt. */
type Stand<T> = { von: T | null; wert: T; nr: number }

/**
 * Eine Spalte der eigenen Profilzeile, wie `useFieldVisibility`: sofort
 * sichtbar, dann gespeichert, in Tipp-Reihenfolge (jeder Tipp schreibt den
 * ganzen Wert, zwei offene Anfragen könnten sonst vertauscht ankommen).
 * Scheitert das Speichern, kommt der zuletzt gespeicherte Stand zurück — nur,
 * wenn kein neuerer Tipp darüber liegt. Kommt vom Server ein neuer Stand (`geladen`),
 * gilt wieder er.
 */
function useGespeicherteSpalte<T>(
  userId: string | undefined, spalte: 'web_badges' | 'web_indexable', geladen: T | null, leer: T,
) {
  const { t } = useTranslation()
  const [eigen, setEigen] = useState<Stand<T> | null>(null)
  const stand = useRef<Stand<T> | null>(null)
  // Was die Datenbank sicher hat (letzter gespeicherter Tipp, sonst `geladen`):
  // Dahin geht es bei einem Fehler zurück — nicht auf einen älteren Tipp, der
  // womöglich selbst gescheitert ist.
  const bestaetigt = useRef<{ von: T | null; wert: T } | null>(null)
  const kette = useRef<Promise<unknown>>(Promise.resolve())
  const wert = eigen && eigen.von === geladen ? eigen.wert : geladen ?? leer

  const apply = useCallback(async (make: (current: T) => T): Promise<boolean> => {
    if (!userId) return false
    const prev = stand.current && stand.current.von === geladen ? stand.current.wert : geladen ?? leer
    const next = make(prev)
    const nr = (stand.current?.nr ?? 0) + 1
    const gesichert = () => bestaetigt.current && bestaetigt.current.von === geladen ? bestaetigt.current.wert : geladen ?? leer
    const setze = (w: T) => { stand.current = { von: geladen, wert: w, nr }; setEigen(stand.current) }
    setze(next)
    const speichern = kette.current.then(() => supabase.from('profiles').update({ [spalte]: next }).eq('id', userId))
    kette.current = speichern.catch(() => undefined)
    const { error } = await speichern.catch((e: unknown) => ({ error: e }))
    if (!error) {
      bestaetigt.current = { von: geladen, wert: next }
      return true
    }
    // Die Kette läuft nacheinander: alle älteren Tipps sind hier schon entschieden.
    if (stand.current?.nr === nr) setze(gesichert())
    toast.error(t('fehler_speichern'))
    return false
  }, [userId, spalte, geladen, leer, t])

  return { wert, apply }
}

const KEINE: WebBadgeOverrides = {}

/**
 * Einstellungen für die Seite ohne Anmeldung und die Link-Karte (2c):
 * Abzeichen im Web (`profiles.web_badges`, nur Abweichungen vom Standard) und
 * „In Suchmaschinen auffindbar“ (`profiles.web_indexable`).
 *
 * `geladen` kommt aus der eigenen Profilzeile (`useEinstellungen`) oder der
 * eigenen Sicht von `profile_view` (`webBadges`, `webIndexable`); `null` =
 * noch nicht geladen oder vor der Migration 2c.
 */
export function useWebSettings(
  userId: string | undefined,
  geladen: { badges: WebBadgeOverrides | null; indexable: boolean | null },
) {
  const badges = useGespeicherteSpalte(userId, 'web_badges', geladen.badges, KEINE)
  const indexable = useGespeicherteSpalte(userId, 'web_indexable', geladen.indexable, false)
  const applyBadges = badges.apply
  const applyIndexable = indexable.apply

  const isBadgeOn = useCallback((id: BadgeId) => webBadgeOn(id, badges.wert), [badges.wert])

  const setBadge = useCallback((id: BadgeId, on: boolean) =>
    applyBadges(current => withWebBadge(current, id, on)), [applyBadges])

  /** „Auf Standard zurücksetzen“ = `{}`. */
  const resetBadges = useCallback(() => applyBadges(() => ({})), [applyBadges])

  const setIndexable = useCallback((on: boolean) => applyIndexable(() => on), [applyIndexable])

  return { badges: badges.wert, isBadgeOn, setBadge, resetBadges, indexable: indexable.wert, setIndexable }
}
