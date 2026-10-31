import { useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'

/**
 * Erlaubnis fuer Mitteilungen — gefragt wird nur dort, wo eine Funktion sie
 * braucht, und nur aus dem Tippen heraus (Erinnerung im Stack, Pausen-Hinweis
 * im Training, Profil). Beim App-Start fragt nichts mehr.
 *
 * Der Systemdialog ist die Abfrage selbst; eine Vorab-Frage gibt es nicht.
 * Lehnt jemand ab, steht an der Stelle ein Hinweis, dass Mitteilungen aus sind.
 */

export type NotificationSupport =
  | 'native-app'        // Store-App (Capacitor): Web-Mitteilungen kommen dort nicht an
  | 'ios-needs-install' // iPhone/iPad im Browser: erst nach „Zum Home-Bildschirm"
  | 'unsupported'
  | 'denied'
  | 'default'
  | 'granted'

/** Nach jeder Antwort auf den Systemdialog — damit Hinweise sofort nachziehen. */
export const NOTIFICATION_PERMISSION_EVENT = 'hoku:notification-permission'

export function isIOSDevice(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

export function isInstalledPWA(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    !!(window.navigator as unknown as { standalone?: boolean }).standalone
  )
}

export function notificationSupport(): NotificationSupport {
  if (Capacitor.isNativePlatform()) return 'native-app'
  if (isIOSDevice() && !isInstalledPWA()) return 'ios-needs-install'
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission
}

/**
 * Zeigt den Systemdialog, wenn noch nie gefragt wurde. Muss synchron aus einem
 * Tippen heraus aufgerufen werden — Safari zeigt den Dialog sonst nicht.
 */
export async function requestNotificationPermission(): Promise<NotificationSupport> {
  const before = notificationSupport()
  if (before !== 'default') return before
  try {
    await Notification.requestPermission()
  } catch {
    /* aeltere Browser: Callback-Form oder gar nichts — Stand unten neu lesen */
  }
  window.dispatchEvent(new Event(NOTIFICATION_PERMISSION_EVENT))
  return notificationSupport()
}

/** Stand fuer lokale Mitteilungen (ohne Push-Abo), zieht nach jeder Antwort nach. */
export function useNotificationSupport(): NotificationSupport {
  const [support, setSupport] = useState<NotificationSupport>(() => notificationSupport())
  useEffect(() => {
    const onChange = () => setSupport(notificationSupport())
    window.addEventListener(NOTIFICATION_PERMISSION_EVENT, onChange)
    // Erlaubnis in den Geraeteeinstellungen geaendert und zurueck in die App
    document.addEventListener('visibilitychange', onChange)
    return () => {
      window.removeEventListener(NOTIFICATION_PERMISSION_EVENT, onChange)
      document.removeEventListener('visibilitychange', onChange)
    }
  }, [])
  return support
}
