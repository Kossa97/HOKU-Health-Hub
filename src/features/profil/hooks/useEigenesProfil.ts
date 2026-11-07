import { useEffect, useState } from 'react'
import i18n from 'i18next'
import { supabase } from '../../../lib/supabase'
import { localProfileView, parseProfileView, type ProfileView } from '../lib/profileView'
import type { ProfileSnapshotData } from '../lib/profileSnapshot'

export type ProfilZeile = Record<string, unknown>

export type EigenesProfil =
  | { status: 'laden' }
  | { status: 'fehler' }
  | { status: 'ok'; row: ProfilZeile; view: ProfileView; quelle: 'server' | 'lokal' }

const appLang = (): 'de' | 'en' =>
  (i18n.resolvedLanguage ?? i18n.language ?? '').toLowerCase().startsWith('de') ? 'de' : 'en'

/** Lokal gerechneter Schnappschuss; `null`, wenn das Laden scheitert. */
async function lokalerSchnappschuss(userId: string): Promise<ProfileSnapshotData | null> {
  try {
    const [{ loadProfileSnapshotInput }, { buildProfileSnapshot }] = await Promise.all([
      import('../services/profileSnapshotStore'),
      import('../lib/profileSnapshot'),
    ])
    const now = new Date()
    return buildProfileSnapshot(await loadProfileSnapshotInput(userId, now, appLang()), now)
  } catch {
    return null
  }
}

/**
 * Eigenes Profil: Profilzeile (für „Bearbeiten“) und die eigene Sicht über
 * `profile_view` — mit allen Feldern und den Stufen. Fehlt die Funktion (vor
 * der Migration) oder scheitert sie, rechnet das Gerät die Werte selbst; die
 * Seite bricht nie leer ab.
 */
async function ladeProfil(userId: string): Promise<EigenesProfil> {
  const { data: row, error } = await supabase.from('profiles').select('*').eq('id', userId).single()
  if (error || !row) return { status: 'fehler' }
  const zeile = row as ProfilZeile
  if (typeof zeile.username === 'string' && zeile.username) {
    const antwort = await supabase.rpc('profile_view', { p_username: zeile.username })
    const view = antwort.error ? null : parseProfileView(antwort.data)
    if (view?.own) return { status: 'ok', row: zeile, view, quelle: 'server' }
  }
  return { status: 'ok', row: zeile, view: localProfileView(zeile, await lokalerSchnappschuss(userId)), quelle: 'lokal' }
}

export function useEigenesProfil(userId: string | undefined) {
  const [state, setState] = useState<EigenesProfil>({ status: 'laden' })

  useEffect(() => {
    if (!userId) return
    let aktiv = true
    void ladeProfil(userId).then(next => { if (aktiv) setState(next) })
    return () => { aktiv = false }
  }, [userId])

  return { state, setState }
}
