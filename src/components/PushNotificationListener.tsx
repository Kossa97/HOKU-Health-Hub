import { useEffect } from 'react'
import toast from 'react-hot-toast'

export type PushPayloadMessage = {
  type: 'PUSH_RECEIVED'
  title?: string
  body?: string
  url?: string
}

/** Zeigt Push-Inhalte in der App, wenn iOS/Safari keine System-Benachrichtigung anzeigt (z. B. App im Vordergrund). */
export function PushNotificationListener() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    const onMessage = (event: MessageEvent<PushPayloadMessage>) => {
      if (event.data?.type !== 'PUSH_RECEIVED') return

      const title = event.data.title ?? 'HOKU'
      const body  = event.data.body ?? ''

      // System-Banner, wenn die App nicht sichtbar ist (funktioniert auf einigen Geräten besser als nur SW)
      if (document.visibilityState === 'hidden' && Notification.permission === 'granted') {
        try {
          const n = new Notification(title, {
            body,
            icon: '/icon-192.png',
            tag:  'tyd-push',
            data: { url: event.data.url ?? '/kalender' },
          })
          n.onclick = () => {
            window.focus()
            const url = (n.data as { url?: string } | undefined)?.url ?? '/kalender'
            window.location.assign(url)
          }
        } catch {
          /* ignore – In-App-Toast reicht */
        }
      }

      toast(
        body ? `${title}\n${body}` : title,
        {
          duration: 6000,
          icon: '🔔',
          style: { whiteSpace: 'pre-line', maxWidth: 'min(92vw, 360px)' },
        },
      )
    }

    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [])

  return null
}
