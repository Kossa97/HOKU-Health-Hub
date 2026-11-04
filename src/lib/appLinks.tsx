import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { zielAusLink } from './appLinkZiel'

/**
 * Universal Links (iOS) und App Links (Android): tippt man in der Mail auf „In Hoku öffnen",
 * öffnet sich die installierte App statt des Browsers. Capacitor meldet die Adresse; hier
 * springt die App an die passende Stelle (die Anmeldung bestätigt dann selbst).
 * Einrichtung: docs/registrierung/APP-LINKS.md. Im Browser tut die Komponente nichts.
 */
export function AppLinks() {
  const navigate = useNavigate()
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let weg: (() => void) | null = null
    let aus = false
    void import('@capacitor/app').then(({ App }) => App.addListener('appUrlOpen', ({ url }) => {
      const ziel = zielAusLink(url)
      if (ziel) navigate(ziel)
    })).then(h => { if (aus) void h.remove(); else weg = () => void h.remove() })
    return () => { aus = true; weg?.() }
  }, [navigate])
  return null
}
