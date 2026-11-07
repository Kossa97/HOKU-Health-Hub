import { useEffect, useState } from 'react'
import { signedMediaUrl } from '../services/profileMedia'

/** Bis die URL eines neuen Pfads da ist, bleibt die vorige stehen — kein Aufblitzen des Platzhalters. */
export function useSignedUrl(path: string | null) {
  const [signiert, setSigniert] = useState<{ path: string; url: string | null } | null>(null)
  useEffect(() => {
    if (!path) return
    let aktiv = true
    void signedMediaUrl(path).then(url => { if (aktiv) setSigniert({ path, url }) })
    return () => { aktiv = false }
  }, [path])
  // Ohne Pfad (entfernt) vergessen: ein späteres neues Bild zeigt nicht kurz das entfernte.
  if (!path && signiert) setSigniert(null)
  return path ? signiert?.url ?? null : null
}
