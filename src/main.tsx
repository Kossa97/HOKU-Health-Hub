import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
// Schriften des Looks HOKU (nur Latein; andere Schriftsysteme fallen auf die Systemschrift zurück)
import '@fontsource/ibm-plex-sans/latin-400.css'
import '@fontsource/ibm-plex-sans/latin-500.css'
import '@fontsource/ibm-plex-sans/latin-600.css'
import '@fontsource/ibm-plex-mono/latin-400.css'
import '@fontsource/ibm-plex-mono/latin-500.css'
import './index.css'
import './styles/liquid-glass.css'
import './styles/look-hoku.css'
import { i18nReady } from './i18n'
import App from './App.tsx'
import { installDenyFeedback } from './lib/denyFeedback'
import { initMonitoring, reactRootErrorOptions } from './lib/monitoring'
import { installUpdateWatch } from './lib/staleChunkReload'
import { applyLook, getLook } from './lib/look'
import { installReflex } from './lib/reflex'
import { installFlashlight } from './lib/flashlight'
import { installStoerungsFetch } from './lib/stoerung'

// Vor allem anderen: jede Dienst-Anfrage läuft ab jetzt über lib/stoerung.ts
// (Offline-Lesecache, Störungsschalter)
installStoerungsFetch()

// Falls das Startskript in index.html nicht lief (Tests, alte Seiten-Caches)
applyLook(getLook())
installReflex()
installFlashlight()

const DEV_SW_RESET_KEY = 'tyd_dev_sw_reset'

if (import.meta.env.DEV && 'serviceWorker' in navigator) {
  const clearStalePwaState = async () => {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map(registration => registration.unregister()))

    if ('caches' in window) {
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)))
    }

    if (navigator.serviceWorker.controller && !sessionStorage.getItem(DEV_SW_RESET_KEY)) {
      sessionStorage.setItem(DEV_SW_RESET_KEY, '1')
      window.location.reload()
    }
  }

  void clearStalePwaState()
}

// Erst rendern, wenn das Locale-Bundle der aktiven Sprache geladen ist —
// verhindert kurzes Aufblitzen roher i18n-Keys. .finally: auch bei
// fehlgeschlagenem Laden rendern (i18next fällt dann auf 'en' zurück).
// Gesperrte Knoepfe (aria-disabled) antworten app-weit mit rotem Wackelrahmen.
installDenyFeedback()

// Neue Version uebernommen: beim naechsten Seitenwechsel neu laden (lib/staleChunkReload.ts).
installUpdateWatch()

// Fehler-Monitoring (Sentry) — nur mit VITE_SENTRY_DSN, siehe lib/monitoring.ts.
void initMonitoring()

i18nReady.finally(() => {
  const root = document.getElementById('root')!
  const app = <StrictMode><App /></StrictMode>
  if (root.hasChildNodes()) hydrateRoot(root, app, reactRootErrorOptions)
  else createRoot(root, reactRootErrorOptions).render(app)
})
