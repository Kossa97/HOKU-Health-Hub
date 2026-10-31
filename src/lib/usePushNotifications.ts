import { useCallback, useEffect, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { supabase } from './supabase'
import type { User } from '@supabase/supabase-js'
import { showPageNotification, waitForServiceWorkerPush, TEST_BODY, TEST_TITLE } from './pushLocal'
import { isInstalledPWA, isIOSDevice, NOTIFICATION_PERMISSION_EVENT } from './notificationPermission'

const VITE_VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

async function fetchServerVapidPublicKey(): Promise<string | null> {
  try {
    const res = await fetch('/api/vapid-public')
    if (!res.ok) return null
    const data = (await res.json()) as { publicKey?: string }
    return data.publicKey?.trim() || null
  } catch {
    return null
  }
}

function urlBase64ToArrayBuffer(base64: string): ArrayBuffer {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64     = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = atob(b64)
  const arr     = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr.buffer
}

export type PushState =
  | 'loading'
  | 'unsupported'
  | 'ios-needs-install'
  | 'ios-native-app'
  | 'denied'
  | 'default'
  | 'subscribed'

interface UsePushNotificationsReturn {
  state: PushState
  subscribe: () => Promise<boolean>
  unsubscribe: () => Promise<void>
  reconnect: () => Promise<boolean>
  sendTestPush: () => Promise<{ ok: boolean; error?: string; delivered?: boolean }>
}

export function usePushNotifications(user: User | null): UsePushNotificationsReturn {
  const [state, setState] = useState<PushState>('loading')
  // Antwortet jemand anderswo auf den Systemdialog (Erinnerung im Stack,
  // Training), zieht der Stand hier nach, ohne neu zu laden.
  const [permissionTick, setPermissionTick] = useState(0)
  useEffect(() => {
    const onChange = () => setPermissionTick(n => n + 1)
    window.addEventListener(NOTIFICATION_PERMISSION_EVENT, onChange)
    return () => window.removeEventListener(NOTIFICATION_PERMISSION_EVENT, onChange)
  }, [])

  useEffect(() => {
    if (!user) return

    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
      setState('ios-native-app')
      return
    }

    if (isIOSDevice() && !isInstalledPWA()) {
      setState('ios-needs-install')
      return
    }

    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setState('unsupported')
      return
    }

    if (Notification.permission === 'denied') { setState('denied'); return }

    navigator.serviceWorker.ready
      .then(async (reg) => {
        await reg.update().catch(() => {})
        const sub = await reg.pushManager.getSubscription()
        setState(sub ? 'subscribed' : 'default')
        // Die serverseitige Erinnerung (`api/send-reminders.js`) fragt
        // `push_subscriptions.timezone` ab -- eine gespeicherte Spalte, kein
        // Live-Wert. Geschrieben wurde sie bisher nur beim Abonnieren
        // selbst. Reist jemand, ohne die Push-Benachrichtigungen neu zu
        // verbinden, bliebe die Erinnerung auf der Zeitzone von damals
        // stehen -- genau der Ausnahme von „wo immer ich bin", die der
        // Kalender selbst nicht hat (der liest bei jedem Rendern live).
        // Deshalb hier bei jedem Start nachziehen, nicht nur beim
        // Abonnieren.
        if (sub) {
          // `await`, nicht `void`: der PostgREST-Builder von supabase-js ist
          // ein Thenable, das erst in seiner eigenen `then()`-Methode
          // ueberhaupt einen Fetch ausloest (`_fetch(...)` steckt dort drin,
          // nicht im Konstruktor). `void ausdruck` ruft `.then()` nie auf --
          // die Kette waere nur aufgebaut, nie ausgefuehrt worden, und
          // `push_subscriptions.timezone` bliebe stumm auf dem alten Wert.
          await supabase.from('push_subscriptions')
            .update({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })
            .eq('user_id', user.id)
            .eq('endpoint', sub.endpoint)
        }
      })
      .catch(() => setState('default'))
  }, [user, permissionTick])

  const saveSubscription = useCallback(async (forceFresh: boolean): Promise<boolean> => {
    if (!user) return false
    if (!('PushManager' in window)) return false

    // Zuerst der Systemdialog: Safari zeigt ihn nur, solange der Aufruf noch
    // zum Tippen gehoert — nach einem Netzabruf davor waere das vorbei.
    const permission = await Notification.requestPermission()
    window.dispatchEvent(new Event(NOTIFICATION_PERMISSION_EVENT))
    if (permission !== 'granted') { setState(permission === 'denied' ? 'denied' : 'default'); return false }

    const serverKey = await fetchServerVapidPublicKey()
    const vapidKey  = serverKey ?? VITE_VAPID_PUBLIC_KEY?.trim() ?? null
    if (!vapidKey) {
      console.warn('[Push] Kein VAPID public key (/api/vapid-public und VITE leer)')
      return false
    }
    if (serverKey && VITE_VAPID_PUBLIC_KEY && serverKey !== VITE_VAPID_PUBLIC_KEY.trim()) {
      console.warn('[Push] VITE_VAPID_PUBLIC_KEY ≠ Server – nutze Server-Key')
    }

    const reg = await navigator.serviceWorker.ready

    if (forceFresh) {
      const old = await reg.pushManager.getSubscription()
      if (old) await old.unsubscribe().catch(() => {})
      await supabase.from('push_subscriptions').delete().eq('user_id', user.id)
    }

    let sub = forceFresh ? null : await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToArrayBuffer(vapidKey),
      })
    }

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id:      user.id,
        endpoint:     sub.endpoint,
        subscription: sub.toJSON(),
        timezone,
      },
      { onConflict: 'user_id,endpoint' },
    )

    if (error) { console.error('[Push] save error:', error); return false }
    setState('subscribed')
    return true
  }, [user])

  const subscribe = useCallback(async (): Promise<boolean> => {
    try {
      return await saveSubscription(isIOSDevice())
    } catch (err) {
      console.error('[Push] subscribe error:', err)
      return false
    }
  }, [saveSubscription])

  const reconnect = useCallback(async (): Promise<boolean> => {
    try {
      return await saveSubscription(true)
    } catch (err) {
      console.error('[Push] reconnect error:', err)
      return false
    }
  }, [saveSubscription])

  const unsubscribe = useCallback(async (): Promise<void> => {
    if (!user) return
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await sub.unsubscribe()
        await supabase.from('push_subscriptions').delete().eq('user_id', user.id)
      }
      setState('default')
    } catch (err) {
      console.error('[Push] unsubscribe error:', err)
    }
  }, [user])

  const sendTestPush = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return { ok: false, error: 'Nicht eingeloggt' }

      let endpoint: string | null = null
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.ready
        endpoint = (await reg.pushManager.getSubscription())?.endpoint ?? null
      }

      const res = await fetch('/api/test-push', {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({ endpoint }),
      })
      const raw = await res.text()
      let body: { hint?: string; error?: string } = {}
      try { body = raw ? JSON.parse(raw) : {} } catch { /* ignore */ }

      if (!res.ok) {
        return { ok: false, error: body.hint ?? body.error ?? `HTTP ${res.status}` }
      }

      const delivered = await waitForServiceWorkerPush(3500)
      if (!delivered) showPageNotification(TEST_TITLE, TEST_BODY)

      return { ok: true, delivered }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  }, [])

  return { state, subscribe, unsubscribe, reconnect, sendTestPush }
}
