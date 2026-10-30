export type PushPayloadMessage = {
  type: 'PUSH_RECEIVED'
  title?: string
  body?: string
  url?: string
}

const TEST_TITLE = '✅ HOKU – Test erfolgreich'
const TEST_BODY  = 'Push-Notifications funktionieren!'

/** Wartet auf PUSH_RECEIVED vom Service Worker (Push ist am Gerät angekommen). */
export function waitForServiceWorkerPush(timeoutMs = 3000): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return Promise.resolve(false)

  return new Promise((resolve) => {
    let done = false
    const finish = (ok: boolean) => {
      if (done) return
      done = true
      navigator.serviceWorker.removeEventListener('message', onMessage)
      clearTimeout(timer)
      resolve(ok)
    }

    const onMessage = (event: MessageEvent<PushPayloadMessage>) => {
      if (event.data?.type === 'PUSH_RECEIVED') finish(true)
    }

    const timer = setTimeout(() => finish(false), timeoutMs)
    navigator.serviceWorker.addEventListener('message', onMessage)
  })
}

/** System-Benachrichtigung aus dem Seiten-Kontext (iOS-PWA-Fallback). */
export function showPageNotification(
  title = TEST_TITLE,
  body = TEST_BODY,
  url = '/kalender',
  tag = 'tyd-test',
): boolean {
  // iOS-Safari (nicht als PWA) kennt `Notification` nicht.
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return false
  try {
    const n = new Notification(title, {
      body,
      icon: new URL('/icon-192.png', window.location.origin).href,
      tag,
      data: { url },
    })
    n.onclick = () => {
      window.focus()
      // Schon auf der Seite: nur nach vorn holen, nicht neu laden (offene Eingaben bleiben)
      if (window.location.pathname !== url) window.location.assign(url)
    }
    return true
  } catch {
    return false
  }
}

export { TEST_TITLE, TEST_BODY }
