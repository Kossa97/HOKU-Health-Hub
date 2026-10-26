import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { reportError } from '../../../lib/monitoring'
import { loadBioProfile, saveBioProfile, type BioProfile } from '../lib/bioProfile'

/**
 * Geburtsdatum und Geschlecht des angemeldeten Nutzers. `profil` ist
 * undefined, solange nichts geladen ist (oder das Laden scheiterte) — dann
 * gelten die allgemeinen Bereiche.
 */
export function useBioProfil() {
  const { user } = useAuth()
  const [von, setVon] = useState<{ userId: string; profil: BioProfile } | null>(null)
  const [fehlerVon, setFehlerVon] = useState<{ userId: string; versuch: number } | null>(null)
  const [versuch, setVersuch] = useState(0)

  useEffect(() => {
    if (!user) return
    let aktuell = true
    const userId = user.id
    loadBioProfile(userId).then(
      profil => { if (aktuell) setVon({ userId, profil }) },
      error => {
        reportError(error, 'blutwerte.bio-profile')
        if (aktuell) setFehlerVon({ userId, versuch })
      },
    )
    return () => { aktuell = false }
  }, [user, versuch])

  const profil = von && von.userId === user?.id ? von.profil : undefined
  /** Laden gescheitert (und seitdem nicht neu versucht). */
  const fehler = !profil && !!fehlerVon && fehlerVon.userId === user?.id && fehlerVon.versuch === versuch
  const erneut = useCallback(() => setVersuch(v => v + 1), [])

  /** Speichert und übernimmt den neuen Stand erst nach Erfolg; wirft bei Fehler. */
  const speichern = useCallback(async (next: BioProfile) => {
    if (!user) throw new Error('not signed in')
    await saveBioProfile(user.id, next)
    setVon({ userId: user.id, profil: next })
  }, [user])

  return { profil, fehler, erneut, speichern }
}
