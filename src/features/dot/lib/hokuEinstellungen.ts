/**
 * Hokus Einstellungen (Nutzer 03.11.2026), auf der Seite „Hoku“ im Profil. Gespeichert nur auf
 * dem Gerät, wie seine Farbe und das App-Design.
 *
 * - `ruhig`: keine Rundflüge, kein Partikel-Auftritt, keine Hinweis-Flüge auf der Anmeldung, kein
 *   Portal beim Anmelden. Er atmet, schaut und reagiert weiter. „Bewegung reduzieren“ am Gerät
 *   geht weiter und gilt ohnehin.
 * - `raus`: er kommt für Hinweise von selbst aus dem Haus. Das betrifft nur zwei Fälle: Seiten
 *   ohne untere Leiste und den Rundflug im Kalorientracker. Sonst bleibt er drin, bis man aufs
 *   Logo tippt.
 * - `hinweise`: Sprechblasen und Hinweise, die er von selbst sagt (Hinweis der Seite, Rundflug,
 *   „automatisch eingetragen“, Hinweise auf der Anmeldung). Antworten im Chat bleiben.
 */
import { useCallback, useEffect, useState } from 'react'

export interface HokuEinstellungen { ruhig: boolean; raus: boolean; hinweise: boolean }
export type HokuEinstellung = keyof HokuEinstellungen

export const HOKU_STANDARD: HokuEinstellungen = { ruhig: false, raus: true, hinweise: true }

const SCHLUESSEL: Record<HokuEinstellung, string> = { ruhig: 'tyd.hoku.ruhig', raus: 'tyd.hoku.raus', hinweise: 'tyd.hoku.hinweise' }
const EREIGNIS = 'tyd-hoku-einstellungen'

export function leseHokuEinstellungen(): HokuEinstellungen {
  const lies = (k: HokuEinstellung) => {
    try {
      const w = localStorage.getItem(SCHLUESSEL[k])
      return w === '1' ? true : w === '0' ? false : HOKU_STANDARD[k]
    } catch {
      return HOKU_STANDARD[k]
    }
  }
  return { ruhig: lies('ruhig'), raus: lies('raus'), hinweise: lies('hinweise') }
}

export function setzeHokuEinstellung(k: HokuEinstellung, an: boolean) {
  try { localStorage.setItem(SCHLUESSEL[k], an ? '1' : '0') } catch { /* ohne Speicher gilt sie bis zum Neuladen */ }
  window.dispatchEvent(new CustomEvent(EREIGNIS))
}

/** Meldet jede Änderung (auch aus einem anderen Tab); gibt das Abmelden zurück. */
export function beobachteHokuEinstellungen(beiAenderung: () => void): () => void {
  const schluessel = new Set(Object.values(SCHLUESSEL))
  const onStorage = (e: StorageEvent) => { if (e.key && schluessel.has(e.key)) beiAenderung() }
  window.addEventListener(EREIGNIS, beiAenderung)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(EREIGNIS, beiAenderung)
    window.removeEventListener('storage', onStorage)
  }
}

export function useHokuEinstellungen(): [HokuEinstellungen, (k: HokuEinstellung, an: boolean) => void] {
  const [werte, setWerte] = useState<HokuEinstellungen>(leseHokuEinstellungen)
  useEffect(() => beobachteHokuEinstellungen(() => setWerte(leseHokuEinstellungen())), [])
  const setze = useCallback((k: HokuEinstellung, an: boolean) => {
    setzeHokuEinstellung(k, an)
    setWerte(w => ({ ...w, [k]: an }))
  }, [])
  return [werte, setze]
}
