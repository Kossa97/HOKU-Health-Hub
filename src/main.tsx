import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import './styles/liquid-glass.css'
import { applyDirection, i18nReady } from './i18n'
import App from './App.tsx'
import { installDenyFeedback } from './lib/denyFeedback'
import { initMonitoring, reactRootErrorOptions } from './lib/monitoring'
import { installUpdateWatch } from './lib/staleChunkReload'
import { applyLook, getLook } from './lib/look'
import { installReflex } from './lib/reflex'
import { installFlashlight } from './lib/flashlight'

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

// Sprach-Richtung beim Start setzen
const savedLang = localStorage.getItem('tyd_lang') || navigator.language.split('-')[0]
applyDirection(savedLang)

// Erst rendern, wenn das Locale-Bundle der aktiven Sprache geladen ist —
// verhindert kurzes Aufblitzen roher i18n-Keys. .finally: auch bei
// fehlgeschlagenem Laden rendern (i18next fällt dann auf 'de' zurück).
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
