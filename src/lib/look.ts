import { useCallback, useEffect, useState } from 'react'

/**
 * Das Erscheinungsbild der App, auf diesem Gerät gespeichert.
 *
 * - `schwarz`: reines Schwarz, Karten aus dunklem Glas mit Lichtkante
 * - `satin`: reines Schwarz, Karten mit dicker, matter Glaskante, hellem
 *   Innenrand und einem Lichtreflex, der beim Scrollen und Berühren wandert
 *   (src/lib/reflex.ts)
 * - `licht`: farbiges Umgebungslicht hinter der Seite, das Glas zeigt es
 *   gebrochen (der Stand von Fortschritt im Schwarzglas-Entwurf)
 * - `nacht`: Schwarz mit gedämpftem Umgebungslicht, klares Glas mit leiser,
 *   getönter Kante und Prismasaum, feines Korn auf dem Grund
 *
 * Gesetzt wird nur `data-look` am `<html>`; was sich ändert, steht in
 * liquid-glass.css unter `html[data-look='…']`.
 */
export type Look = 'schwarz' | 'satin' | 'licht' | 'nacht'

export const LOOKS: readonly Look[] = ['schwarz', 'satin', 'licht', 'nacht']

const STORAGE_KEY = 'tyd_look'

export function getLook(): Look {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return LOOKS.find(look => look === stored) ?? 'schwarz'
  } catch {
    return 'schwarz'
  }
}

export function applyLook(look: Look): void {
  document.documentElement.setAttribute('data-look', look)
}

export function useLook() {
  const [look, setLookState] = useState<Look>(getLook)

  const setLook = useCallback((next: Look) => {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Ohne Speicher gilt die Wahl bis zum Neuladen.
    }
    applyLook(next)
    setLookState(next)
  }, [])

  return { look, setLook }
}

function documentLook(): Look {
  const current = document.documentElement.getAttribute('data-look')
  return LOOKS.find(look => look === current) ?? 'schwarz'
}

/** Der gerade gezeigte Look; folgt jedem Wechsel am `<html>` (z. B. für 3D-Licht). */
export function useActiveLook(): Look {
  const [look, setLook] = useState<Look>(documentLook)
  useEffect(() => {
    const observer = new MutationObserver(() => setLook(documentLook()))
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-look'] })
    return () => observer.disconnect()
  }, [])
  return look
}
