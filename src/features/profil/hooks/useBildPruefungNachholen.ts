import { useEffect, useRef } from 'react'
import { checkProfileMedia, type MediaKind } from '../services/profileMedia'
import type { MediaStatus } from '../lib/profileView'

/**
 * Offene Bild-Checks beim Öffnen des eigenen Profils nachholen (Spec 2a,
 * Abschnitt 6): Bilder aus Teilprojekt 1 und solche, deren Prüfung beim
 * Hochladen scheiterte, stehen auf `pending`. Läuft einmal je Seitenaufruf,
 * sobald `offen` bekannt ist; bleibt das Ergebnis `pending`, meldet es nichts.
 */
export function useBildPruefungNachholen(
  offen: readonly { kind: MediaKind; pfad: string }[] | null,
  /** `pfad`: das geprüfte Bild — gilt nur, solange es noch hinterlegt ist. */
  onErgebnis: (kind: MediaKind, status: MediaStatus | null, pfad: string) => void,
) {
  const gelaufen = useRef(false)
  const melden = useRef(onErgebnis)
  useEffect(() => { melden.current = onErgebnis })

  useEffect(() => {
    if (!offen || gelaufen.current) return
    gelaufen.current = true
    for (const { kind, pfad } of offen) {
      void checkProfileMedia(kind).then(status => {
        if (status !== 'pending') melden.current(kind, status, pfad)
      })
    }
  }, [offen])
}
