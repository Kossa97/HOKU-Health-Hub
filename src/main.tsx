import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import './styles/liquid-glass.css'
import { i18nReady } from './i18n'
import App from './App.tsx'
import { installDenyFeedback } from './lib/denyFeedback'
import { initMonitoring, reactRootErrorOptions } from './lib/monitoring'
import { installUpdateWatch } from './lib/staleChunkReload'
import { applyLook, getLook } from './lib/look'
import { installReflex } from './lib/reflex'
import { installFlashlight } from './lib/flashlight'
import { installHokuLicht } from './lib/hokuLicht'
import { LINSE_STANDARD, wendeLinseAn } from './lib/linse'
import { installStoerungsFetch } from './lib/stoerung'

// Vor allem anderen: jede Dienst-Anfrage läuft ab jetzt über lib/stoerung.ts
// (Offline-Lesecache, Störungsschalter)
installStoerungsFetch()

// Falls das Startskript in index.html nicht lief (Tests, alte Seiten-Caches)
applyLook(getLook())
installReflex()
installFlashlight()
// Prüfschalter fürs Gerät, nur über die Adresse (kein Knopf): ?licht=aus
// schaltet Hokus Licht ab, ?effekte=aus die schweren Look-Effekte (Leuchtschatten,
// Glas auf Karten, Kanten), ?hintergrund=aus den Seitenhintergrund der Looks
// (Rauschen, große Verläufe), ?schwappen=aus die lebende Flüssigkeit in den
// Fläschchen (MyStack). So lässt sich am iPhone eingrenzen, was bremst.
try {
  const pruef = new URLSearchParams(location.search)
  if (pruef.get('licht') === 'aus') document.documentElement.dataset.lichtAus = ''
  if (pruef.get('effekte') === 'aus') document.documentElement.dataset.effekteAus = ''
  if (pruef.get('hintergrund') === 'aus') document.documentElement.dataset.hintergrundAus = ''
  if (pruef.get('schwappen') === 'aus') document.documentElement.dataset.schwappenAus = ''
} catch { /* ohne Adresse nichts zu tun */ }
installHokuLicht()
wendeLinseAn(LINSE_STANDARD)
// Die Test-Regler sind entfernt: ihre gespeicherten Werte aufräumen
try { localStorage.removeItem('tyd_linse_3') } catch { /* ohne Speicher nichts zu tun */ }

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
