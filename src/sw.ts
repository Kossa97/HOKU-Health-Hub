/// <reference lib="webworker" />

import { precacheAndRoute, cleanupOutdatedCaches, matchPrecache } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { clientsClaim } from 'workbox-core'

declare const self: ServiceWorkerGlobalScope

// ── Precaching (manifest injected by vite-plugin-pwa) ────────────────────────
clientsClaim()
// eslint-disable-next-line @typescript-eslint/no-explicit-any
precacheAndRoute((self as any).__WB_MANIFEST ?? [])
cleanupOutdatedCaches()

// ── Seitenaufrufe ohne Netz: App-Gerüst aus dem Vorab-Cache ─────────────────
// Mit Netz unverändert vom Server (auch die vorgerenderten Peptipedia-Seiten,
// die erst nach dem Manifest entstehen). Ohne Netz startet die App aus dem
// Cache und zeigt die zuletzt geladenen Daten (src/lib/stoerung.ts) — statt
// der Offline-Seite des Browsers.
registerRoute(new NavigationRoute(async ({ request }) => {
  try {
    return await fetch(request)
  } catch {
    return (await matchPrecache('/index.html')) ?? Response.error()
  }
}, { denylist: [/^\/api\//] }))

// ── pdf.js erst bei Gebrauch cachen ──────────────────────────────────────────
// pdf.js (~1,8 MB mit Worker) ist vom Precache ausgenommen (vite.config.ts):
// nur die PDF-Vorschau braucht es. Einmal geladen, liegt es hier, damit die
// Vorschau danach auch offline geht. Die Dateinamen tragen einen Hash —
// eine neue Fassung verdraengt die alte gleichen Typs.
const PDFJS_CACHE = 'tyd-pdfjs'
const PDFJS_FILE = /\/assets\/(pdf-[\w-]+\.js|pdf\.worker[\w.-]*\.m?js)$/

/** Dateiname ohne Hash (Vite: 8 Zeichen) — „pdf.js", „pdf.worker.min.mjs" … */
function pdfjsKind(pathname: string): string {
  return pathname.replace(/-[\w-]{8}(\.m?js)$/, '$1')
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin || !PDFJS_FILE.test(url.pathname)) return

  event.respondWith((async () => {
    const cache = await caches.open(PDFJS_CACHE)
    const hit = await cache.match(event.request)
    if (hit) return hit
    const response = await fetch(event.request)
    if (response.ok) {
      const kind = pdfjsKind(url.pathname)
      for (const old of await cache.keys()) {
        if (pdfjsKind(new URL(old.url).pathname) === kind) await cache.delete(old)
      }
      await cache.put(event.request, response.clone())
    }
    return response
  })())
})

// ── Activate new SW immediately so Home/features updates reach PWA users ───
self.addEventListener('install', () => {
  void self.skipWaiting()
})

// ── Skip waiting on explicit message ─────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

type PushPayload = {
  title?: string
  body?: string
  tag?: string
  url?: string
}

function parsePushPayload(event: PushEvent): PushPayload {
  try {
    return (event.data?.json() ?? {}) as PushPayload
  } catch {
    return { body: event.data?.text() ?? '' }
  }
}

async function notifyOpenClients(payload: PushPayload, title: string, body: string) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
  for (const client of clients) {
    client.postMessage({
      type:  'PUSH_RECEIVED',
      title,
      body,
      url:   payload.url ?? '/kalender',
    })
  }
}

// ── Push notification handler ─────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  const payload = parsePushPayload(event)
  const title   = payload.title ?? 'TYD – Track Your Dose'
  const body    = payload.body ?? ''

  // iOS braucht absolute Icon-URLs
  const iconUrl = new URL('/icon-192.png', self.location.origin).href
  const options: NotificationOptions = {
    body,
    icon: iconUrl,
    tag:  payload.tag ?? 'tyd-reminder',
    data: { url: payload.url ?? '/kalender' },
  }

  event.waitUntil(
    (async () => {
      await notifyOpenClients(payload, title, body)
      try {
        await self.registration.showNotification(title, options)
      } catch (err) {
        console.error('[SW] showNotification failed:', err)
        await self.registration.showNotification(title, { body, tag: options.tag })
      }
    })(),
  )
})

// ── Notification click → open / focus app (iOS: navigate statt nur focus) ───
self.addEventListener('notificationclick', (event) => {
  event.preventDefault()
  event.notification.close()

  const rawUrl = (event.notification.data?.url as string | undefined) ?? '/kalender'
  const targetUrl = rawUrl.startsWith('http') ? rawUrl : new URL(rawUrl, self.location.origin).href

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('navigate' in client) {
            return (client as WindowClient).navigate(targetUrl).then((c) => c?.focus())
          }
          if ('focus' in client) return (client as WindowClient).focus()
        }
        if (self.clients.openWindow) return self.clients.openWindow(targetUrl)
        return undefined
      }),
  )
})
