import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { supabase } from '../../../lib/supabase'
import { localDay } from '../../wearables/lib/healthDaily'
import type { BadgeId } from '../lib/badgeIds'
import { wornTitle, type PersonalTitleId, type ProfileTitle, type TitleBadgeId, type TitleSettings } from '../lib/titles'
import type { EigenerFortschritt } from './useEigenerFortschritt'
import { DEFAULT_TITLE_SETTINGS, withChoice, withConsent, withPersonalAllowed } from '../lib/titleChoices'

type Stand = { von: TitleSettings | null; wert: TitleSettings; nr: number }

const zeile = (s: TitleSettings) => ({
  title_choice: s.choice,
  personal_titles: s.personalAllowed,
  title_consents: s.consents,
})

/**
 * Titel-Einstellungen der eigenen Profilzeile (`title_choice`,
 * `personal_titles`, `title_consents`) wie `useWebSettings`: sofort sichtbar,
 * dann gespeichert, in Tipp-Reihenfolge (jeder Tipp schreibt alle drei
 * Spalten). Scheitert das Speichern, kommt der zuletzt gespeicherte Stand
 * zurück — nur, wenn kein neuerer Tipp darüber liegt — mit Meldung.
 *
 * `geladen` kommt aus der eigenen Sicht (`view.titleSettings`) oder der
 * Profilzeile (`parseTitleSettings`); `null` = noch nicht geladen.
 */
export function useTitleSettings(userId: string | undefined, geladen: TitleSettings | null) {
  const { t } = useTranslation()
  const [eigen, setEigen] = useState<Stand | null>(null)
  const stand = useRef<Stand | null>(null)
  const bestaetigt = useRef<{ von: TitleSettings | null; wert: TitleSettings } | null>(null)
  const kette = useRef<Promise<unknown>>(Promise.resolve())
  const settings = eigen && eigen.von === geladen ? eigen.wert : geladen ?? DEFAULT_TITLE_SETTINGS

  const apply = useCallback(async (make: (current: TitleSettings) => TitleSettings): Promise<boolean> => {
    if (!userId) return false
    const prev = stand.current && stand.current.von === geladen ? stand.current.wert : geladen ?? DEFAULT_TITLE_SETTINGS
    const next = make(prev)
    const nr = (stand.current?.nr ?? 0) + 1
    const gesichert = () => bestaetigt.current && bestaetigt.current.von === geladen
      ? bestaetigt.current.wert : geladen ?? DEFAULT_TITLE_SETTINGS
    const setze = (w: TitleSettings) => { stand.current = { von: geladen, wert: w, nr }; setEigen(stand.current) }
    setze(next)
    const speichern = kette.current.then(() => supabase.from('profiles').update(zeile(next)).eq('id', userId))
    kette.current = speichern.catch(() => undefined)
    const { error } = await speichern.catch((e: unknown) => ({ error: e }))
    if (!error) {
      bestaetigt.current = { von: geladen, wert: next }
      return true
    }
    if (stand.current?.nr === nr) setze(gesichert())
    toast.error(t('fehler_speichern'))
    return false
  }, [userId, geladen, t])

  /** `null` = Rang tragen. */
  const choose = useCallback((choice: TitleBadgeId | null) => apply(s => withChoice(s, choice)), [apply])
  /** Aus = Widerruf aller Bestätigungen (siehe `withPersonalAllowed`). */
  const setPersonalAllowed = useCallback((on: boolean) => apply(s => withPersonalAllowed(s, on)), [apply])
  /** Bestätigt heute (`day`) und trägt den persönlichen Titel. */
  const consentAndWear = useCallback((id: PersonalTitleId, day: string) => apply(s => withConsent(s, id, day)), [apply])

  return { settings, choose, setPersonalAllowed, consentAndWear }
}

/**
 * Alles, was Chip und Sheet „Dein Titel“ in der eigenen Sicht brauchen: die
 * Einstellungen (`useTitleSettings`), der getragene Titel — lokal gerechnet aus
 * den verdienten Abzeichen (frischer als der Server), solange das lädt der Titel
 * vom Server — sowie Stand der Abzeichen und Tage mit Eintrag.
 */
export function useEigenerTitel(
  userId: string | undefined,
  geladen: TitleSettings | null,
  fortschritt: EigenerFortschritt,
  vomServer: ProfileTitle | null,
) {
  const titel = useTitleSettings(userId, geladen)
  const ok = fortschritt.status === 'ok' ? fortschritt.state : null
  const earned = useMemo(() => (ok ? new Set(Object.keys(ok.badges.earned) as BadgeId[]) : null), [ok])
  const worn = earned ? wornTitle(titel.settings, earned) : vomServer
  const { consentAndWear } = titel
  /** Bestätigt mit dem heutigen Tag. */
  const consent = useCallback((id: PersonalTitleId) => consentAndWear(id, localDay(new Date())), [consentAndWear])
  return {
    ...titel,
    worn,
    states: ok?.badges.states ?? null,
    entryDays: ok?.entryDays ?? null,
    consent,
  }
}
