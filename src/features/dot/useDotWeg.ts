import { useEffect } from 'react'
import { dotStore } from './dotStore'

/**
 * Für Seiten mit Kamera (Barcode, Etikett, Foto): solange `aktiv`, ist Dot
 * ganz weg — er zerstiebt in Funken und setzt sich danach wieder zusammen.
 */
export function useDotWeg(aktiv: boolean) {
  useEffect(() => {
    if (!aktiv) return
    dotStore.kameraAuf()
    return () => dotStore.kameraZu()
  }, [aktiv])
}
